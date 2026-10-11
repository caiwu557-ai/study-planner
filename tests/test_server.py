import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server


class StudyPlannerBackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.data = self.root / "data"
        self.data.mkdir()
        self.seed = self.data / "seed_schedule.json"
        self.db = self.data / "study_planner.db"
        self.backups = self.data / "backups"
        self.seed.write_text(json.dumps({
            "semester_start": "2026-09-07",
            "semester_weeks": 18,
            "review_offsets_days": [1,3,7,14,30],
            "source": "test",
            "lessons": [{
                "date": "2026-09-14", "week": 2, "weekday": 1,
                "course": "示例课程A", "start_section": 1,
                "end_section": 2, "teacher": "示例教师", "location": "示例教室"
            }]
        }, ensure_ascii=False), encoding="utf-8")
        self.patches = [
            patch.object(server, "DATA_DIR", self.data),
            patch.object(server, "DB_PATH", self.db),
            patch.object(server, "SEED_PATH", self.seed),
            patch.object(server, "BACKUP_DIR", self.backups),
            patch.object(server, "SECRETS_DIR", self.data / "secrets"),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.tmp.cleanup()

    def test_init_db_records_schema_version_4(self):
        server.init_db()
        conn = server.db_connect()
        value = conn.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()
        conn.close()
        self.assertIsNotNone(value)
        self.assertEqual(value["value"], "4")

    def test_existing_v1_database_is_migrated_without_losing_tasks(self):
        conn = sqlite3.connect(self.db)
        conn.executescript("""
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL, course TEXT DEFAULT '', type TEXT NOT NULL DEFAULT 'task',
            planned_date TEXT DEFAULT '', due_date TEXT DEFAULT '', notes TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, completed_at TEXT DEFAULT ''
        );
        INSERT INTO meta(key,value) VALUES('semester_start','2026-09-07');
        INSERT INTO tasks(title,created_at) VALUES('保留我','2026-09-14T10:00:00');
        """)
        conn.commit(); conn.close()

        server.init_db()
        conn = server.db_connect()
        schema = conn.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()["value"]
        title = conn.execute("SELECT title FROM tasks WHERE id=1").fetchone()["title"]
        conn.close()
        self.assertEqual(schema, "4")
        self.assertEqual(title, "保留我")

    def test_v3_pure_date_due_is_migrated_to_datetime(self):
        """v3 的纯日期 DDL 升级后必须补上默认时刻（当天结束前），语义不能变。"""
        conn = sqlite3.connect(self.db)
        conn.executescript("""
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL, course TEXT DEFAULT '', type TEXT NOT NULL DEFAULT 'task',
            planned_date TEXT DEFAULT '', due_date TEXT DEFAULT '', notes TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, completed_at TEXT DEFAULT ''
        );
        INSERT INTO meta(key,value) VALUES('semester_start','2026-09-07');
        INSERT INTO meta(key,value) VALUES('schema_version','3');
        INSERT INTO tasks(title,due_date,created_at) VALUES('旧DDL','2026-09-21','2026-09-14T10:00:00');
        INSERT INTO tasks(title,due_date,created_at) VALUES('已带时刻','2026-09-22T18:30','2026-09-14T10:00:00');
        INSERT INTO tasks(title,due_date,created_at) VALUES('没有DDL','','2026-09-14T10:00:00');
        """)
        conn.commit(); conn.close()

        server.init_db()
        conn = server.db_connect()
        rows = {r["title"]: r["due_date"] for r in conn.execute("SELECT title,due_date FROM tasks").fetchall()}
        conn.close()
        self.assertEqual(rows["旧DDL"], "2026-09-21T23:59")
        self.assertEqual(rows["已带时刻"], "2026-09-22T18:30")     # 已是 datetime 不二次加工
        self.assertEqual(rows["没有DDL"], "")

    def test_due_migration_is_idempotent(self):
        """迁移重复执行不能把 23:59 再补一次，也不能破坏已有 datetime。"""
        conn = sqlite3.connect(self.db)
        conn.executescript("""
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL, course TEXT DEFAULT '', type TEXT NOT NULL DEFAULT 'task',
            planned_date TEXT DEFAULT '', due_date TEXT DEFAULT '', notes TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, completed_at TEXT DEFAULT ''
        );
        INSERT INTO meta(key,value) VALUES('schema_version','3');
        INSERT INTO tasks(title,due_date,created_at) VALUES('旧DDL','2026-09-21','2026-09-14T10:00:00');
        """)
        conn.commit(); conn.close()

        server.init_db()
        conn = server.db_connect()
        with conn:
            server.migrate_due_date_to_datetime(conn)
            server.migrate_due_date_to_datetime(conn)
        due = conn.execute("SELECT due_date FROM tasks WHERE title='旧DDL'").fetchone()["due_date"]
        conn.close()
        self.assertEqual(due, "2026-09-21T23:59")

    def test_task_due_accepts_only_date_and_fills_default_time(self):
        """纯日期输入仍要能用（补 23:59）；带时刻的按分钟保存。"""
        only_date = server.validate_task_payload({"title": "只写日期", "type": "ddl", "due_date": "2026-09-21"})
        self.assertEqual(only_date["due_date"], "2026-09-21T23:59")
        with_time = server.validate_task_payload({"title": "带时刻", "type": "ddl", "due_date": "2026-09-21T18:00"})
        self.assertEqual(with_time["due_date"], "2026-09-21T18:00")
        no_due = server.validate_task_payload({"title": "无截止", "type": "task", "due_date": ""})
        self.assertEqual(no_due["due_date"], "")

    def test_task_due_rejects_malformed_time(self):
        for bad in ("2026-09-21T25:00", "2026-09-21T18:70", "2026-09-21T傍晚", "2026-09-21T"):
            with self.assertRaises(ValueError, msg=f"{bad!r} 应被拒绝"):
                server.validate_task_payload({"title": "坏时间", "type": "ddl", "due_date": bad})
        # 只到小时也接受，补 :00
        self.assertEqual(
            server.validate_task_payload({"title": "只到小时", "type": "ddl", "due_date": "2026-09-21T18"})["due_date"],
            "2026-09-21T18:00",
        )

    def test_due_time_on_same_day_does_not_drop_task_from_day_board(self):
        """回归：due_date 带时刻后，同一天的 DDL 不能从单日看板消失。

        v3 时代用 `due_date=?` 直接匹配，带时刻的数据永远匹配不上纯日期，
        任务会看起来「填了却没出现」。
        """
        server.init_db()
        created = server.create_task({
            "title": "带时刻的DDL", "course": "", "type": "ddl",
            "planned_date": "", "due_date": "2026-09-21T18:00", "notes": ""
        })
        day = server.get_day_payload("2026-09-21")
        self.assertIn(created["id"], [t["id"] for t in day["tasks"]])
        cal = server.calendar_payload("2026-09-01", "2026-09-30")
        self.assertIn(created["id"], [t["id"] for t in cal["tasks"]])

    def test_due_sort_key_orders_pure_date_like_datetime(self):
        """纯日期与 datetime 必须落在同一坐标系里比较，否则排序会颠倒。"""
        self.assertEqual(server.due_sort_key("2026-09-21"), "2026-09-21T23:59")
        self.assertEqual(server.due_sort_key("2026-09-21T09:00"), "2026-09-21T09:00")
        self.assertEqual(server.due_sort_key(""), "")
        self.assertLess(
            server.due_sort_key("2026-09-21T09:00"),
            server.due_sort_key("2026-09-21"),          # 09:00 早于当天 23:59
        )

    def test_due_day_strips_time(self):
        self.assertEqual(server.due_day("2026-09-21T18:00"), "2026-09-21")
        self.assertEqual(server.due_day("2026-09-21"), "2026-09-21")
        self.assertEqual(server.due_day(""), "")

    def test_parse_due_datetime_tolerates_garbage(self):
        self.assertIsNone(server.parse_due_datetime(""))
        self.assertIsNone(server.parse_due_datetime("不是时间"))
        self.assertEqual(
            server.parse_due_datetime("2026-09-21").isoformat(timespec="minutes"),
            "2026-09-21T23:59",
        )

    def test_validate_task_payload_rejects_invalid_calendar_date(self):
        with self.assertRaises(ValueError):
            server.validate_task_payload({"title": "测试", "type": "task", "planned_date": "2026-99-99"})

    def test_validate_task_payload_rejects_due_before_planned(self):
        with self.assertRaises(ValueError):
            server.validate_task_payload({
                "title": "测试", "type": "assignment",
                "planned_date": "2026-09-20", "due_date": "2026-09-18"
            })

    def test_create_task_blocks_exact_pending_duplicate(self):
        server.init_db()
        payload = {
            "title": "疫苗小组作业", "course": "示例课程A",
            "type": "assignment", "planned_date": "2026-09-16", "due_date": "2026-09-18", "notes": ""
        }
        first = server.create_task(payload)
        self.assertEqual(first["title"], "疫苗小组作业")
        with self.assertRaises(ValueError):
            server.create_task(payload)

    def test_update_lesson_topic_returns_generated_review_count(self):
        server.init_db()
        conn = server.db_connect()
        lesson_id = conn.execute("SELECT id FROM lessons LIMIT 1").fetchone()["id"]
        conn.close()
        result = server.update_lesson_topic(
            lesson_id,
            topic="疫苗与免疫预防",
            lesson_code="II-02",
            material_ref="",
            today_str="2026-09-14",
        )
        self.assertEqual(result["review_count"], 5)
        self.assertEqual(result["lesson"]["topic"], "疫苗与免疫预防")

    def test_late_review_completion_shifts_only_later_pending_reviews(self):
        server.init_db()
        conn = server.db_connect()
        lesson_id = conn.execute("SELECT id FROM lessons LIMIT 1").fetchone()["id"]
        conn.execute("UPDATE lessons SET topic='疫苗' WHERE id=?", (lesson_id,))
        conn.commit()
        server.generate_review_chain(conn, lesson_id, "2026-09-14")
        first = conn.execute("SELECT * FROM reviews WHERE lesson_id=? AND stage=1", (lesson_id,)).fetchone()
        server.complete_review(conn, first["id"], "2026-09-18")
        rows = conn.execute("SELECT stage,due_date,status FROM reviews WHERE lesson_id=? ORDER BY stage", (lesson_id,)).fetchall()
        conn.close()
        self.assertEqual([(r["stage"], r["due_date"], r["status"]) for r in rows], [
            (1, "2026-09-15", "completed"),
            (2, "2026-09-20", "pending"),
            (3, "2026-09-24", "pending"),
            (4, "2026-10-01", "pending"),
            (5, "2026-10-17", "pending"),
        ])

    def test_undo_review_completion_restores_pending_state_and_dates(self):
        server.init_db()
        conn = server.db_connect()
        lesson_id = conn.execute("SELECT id FROM lessons LIMIT 1").fetchone()["id"]
        conn.execute("UPDATE lessons SET topic='疫苗' WHERE id=?", (lesson_id,))
        conn.commit()
        server.generate_review_chain(conn, lesson_id, "2026-09-14")
        first = conn.execute("SELECT * FROM reviews WHERE lesson_id=? AND stage=1", (lesson_id,)).fetchone()
        server.complete_review(conn, first["id"], "2026-09-18")
        server.undo_review_completion(conn, first["id"])
        rows = conn.execute("SELECT stage,due_date,status FROM reviews WHERE lesson_id=? ORDER BY stage", (lesson_id,)).fetchall()
        conn.close()
        self.assertEqual([(r["stage"], r["due_date"], r["status"]) for r in rows], [
            (1, "2026-09-15", "pending"),
            (2, "2026-09-17", "pending"),
            (3, "2026-09-21", "pending"),
            (4, "2026-09-28", "pending"),
            (5, "2026-10-14", "pending"),
        ])

    def test_task_status_supports_soft_delete_and_restore(self):
        server.init_db()
        created = server.create_task({
            "title": "测试任务", "course": "", "type": "task", "planned_date": "2026-09-14", "due_date": "", "notes": ""
        })
        updated = server.set_task_status(created["id"], "deleted")
        self.assertEqual(updated["status"], "deleted")
        restored = server.set_task_status(created["id"], "pending")
        self.assertEqual(restored["status"], "pending")

    def test_deleted_task_disappears_from_day_calendar_and_list(self):
        """软删除后，任务不得再出现在日看板、日历区间与任务清单。"""
        server.init_db()
        created = server.create_task({
            "title": "会被删掉的任务", "course": "", "type": "assignment",
            "planned_date": "2026-09-20", "due_date": "2026-09-22", "notes": ""
        })
        before_day = server.get_day_payload("2026-09-20")
        self.assertIn(created["id"], [t["id"] for t in before_day["tasks"]])
        before_cal = server.calendar_payload("2026-09-01", "2026-09-30")
        self.assertIn(created["id"], [t["id"] for t in before_cal["tasks"]])

        server.set_task_status(created["id"], "deleted")

        after_day = server.get_day_payload("2026-09-20")
        self.assertNotIn(created["id"], [t["id"] for t in after_day["tasks"]])
        self.assertNotIn(created["id"], [t["id"] for t in after_day["upcoming"]])
        after_cal = server.calendar_payload("2026-09-01", "2026-09-30")
        self.assertNotIn(created["id"], [t["id"] for t in after_cal["tasks"]])
        self.assertNotIn(created["id"], [t["id"] for t in server.get_tasks_list()["tasks"]])

    def test_deleted_task_shows_in_trash_and_can_be_restored(self):
        server.init_db()
        created = server.create_task({
            "title": "误删的任务", "course": "", "type": "task",
            "planned_date": "2026-09-20", "due_date": "", "notes": ""
        })
        server.set_task_status(created["id"], "deleted")

        trash_ids = [t["id"] for t in server.get_deleted_tasks()["tasks"]]
        self.assertIn(created["id"], trash_ids)

        restored = server.restore_task(created["id"])
        self.assertEqual(restored["task"]["status"], "pending")
        self.assertNotIn(created["id"], [t["id"] for t in server.get_deleted_tasks()["tasks"]])
        self.assertIn(created["id"], [t["id"] for t in server.get_tasks_list()["tasks"]])

    def test_restore_rejects_task_that_is_not_deleted(self):
        server.init_db()
        created = server.create_task({
            "title": "正常任务", "course": "", "type": "task", "planned_date": "2026-09-20", "due_date": "", "notes": ""
        })
        with self.assertRaises(ValueError):
            server.restore_task(created["id"])

    def test_purge_only_allows_deleted_task(self):
        server.init_db()
        created = server.create_task({
            "title": "彻底清除任务", "course": "", "type": "task", "planned_date": "2026-09-20", "due_date": "", "notes": ""
        })
        with self.assertRaises(ValueError):
            server.purge_deleted_task(created["id"])
        server.set_task_status(created["id"], "deleted")
        server.purge_deleted_task(created["id"])
        conn = server.db_connect()
        row = conn.execute("SELECT id FROM tasks WHERE id=?", (created["id"],)).fetchone()
        conn.close()
        self.assertIsNone(row)

    def test_deleted_slot_can_be_reused_by_new_task(self):
        """软删除后重新录入完全相同内容，不应被重复拦截挡住。"""
        server.init_db()
        payload = {
            "title": "同学术英语任务", "course": "", "type": "assignment",
            "planned_date": "2026-09-20", "due_date": "2026-09-22", "notes": ""
        }
        first = server.create_task(payload)
        server.set_task_status(first["id"], "deleted")
        second = server.create_task(payload)
        self.assertNotEqual(first["id"], second["id"])
        self.assertEqual(second["status"], "pending")

    def test_duplicate_still_blocked_while_pending(self):
        server.init_db()
        payload = {
            "title": "重复拦截任务", "course": "", "type": "task",
            "planned_date": "2026-09-20", "due_date": "", "notes": ""
        }
        server.create_task(payload)
        with self.assertRaises(ValueError):
            server.create_task(payload)

    def test_settings_payload_has_defaults(self):
        server.init_db()
        settings = server.get_settings_payload()
        self.assertEqual(settings["appearance"]["theme_name"], "lemon-salt")
        self.assertEqual(settings["appearance"]["accent_2"], "#E8C21C")
        self.assertIn("base_url", settings["ai"])

    def test_preset_theme_names_are_all_kept(self):
        server.init_db()
        for name in ("lemon-salt", "margarita", "vanilla-cream", "mono"):
            server.save_appearance_settings({"theme_name": name})
            settings = server.get_settings_payload()
            self.assertEqual(settings["appearance"]["theme_name"], name)

    def test_unknown_theme_name_falls_back_to_custom(self):
        server.init_db()
        server.save_appearance_settings({"theme_name": "some-removed-theme"})
        settings = server.get_settings_payload()
        self.assertEqual(settings["appearance"]["theme_name"], "custom")

    def test_mono_theme_keeps_user_picked_color(self):
        server.init_db()
        server.save_appearance_settings({"theme_name": "mono", "accent": "#2B3A55", "accent_2": "#B7C1D0"})
        settings = server.get_settings_payload()
        self.assertEqual(settings["appearance"]["theme_name"], "mono")
        self.assertEqual(settings["appearance"]["accent"], "#2B3A55")

    def test_custom_theme_keeps_user_colors(self):
        server.init_db()
        server.save_appearance_settings({"theme_name": "custom", "accent": "#123456", "accent_2": "#ABCDEF"})
        settings = server.get_settings_payload()
        self.assertEqual(settings["appearance"]["theme_name"], "custom")
        self.assertEqual(settings["appearance"]["accent"], "#123456")
        self.assertEqual(settings["appearance"]["accent_2"], "#ABCDEF")


    def test_invalid_date_query_param_does_not_raise(self):
        """路由段写错（如 #/home 把字面量 'home' 当日期传进来）不能让接口 500。

        查询参数没有前端约束，非法日期必须退化成默认值而不是抛异常。
        """
        for bad in ("home", "", "2026-13-45", "2026/09/19", "not-a-date"):
            self.assertIsNone(server._valid_date_or_none(bad), f"{bad!r} 应判为非法")
        # 合法值要原样规范化返回
        self.assertEqual(server._valid_date_or_none("2026-09-19"), "2026-09-19")
        self.assertIsNone(server._valid_date_or_none(None))

    def test_day_payload_tolerates_bad_date_via_route_fallback(self):
        """模拟路由用 _valid_date_or_none 兜底后，非法日期应落到今天而不是抛错。"""
        server.init_db()
        import datetime as _dt
        for bad in ("home", "", "banana"):
            target = server._valid_date_or_none(bad) or server.today_bj().isoformat()
            payload = server.get_day_payload(target)
            self.assertIn("tasks", payload)

    def test_calendar_route_normalizes_swapped_and_bad_range(self):
        """区间颠倒要自动交换；非法值要退化成默认值。两者都不能抛异常。"""
        server.init_db()
        v = server._valid_date_or_none
        # 颠倒 → 路由层交换，等价于正序
        start, end = "2026-09-30", "2026-09-01"
        start, end = (v(start) or ""), (v(end) or "")
        if start > end:
            start, end = end, start
        self.assertEqual((start, end), ("2026-09-01", "2026-09-30"))
        self.assertIn("lessons", server.calendar_payload(start, end))
        # 非法 → None，路由层回落到默认区间
        self.assertIsNone(v("home"))


class ListViewTests(unittest.TestCase):
    """三个功能视图：复习清单 / 待办清单 / 到期清单。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.data = self.root / "data"
        self.data.mkdir()
        self.seed = self.data / "seed_schedule.json"
        self.db = self.data / "study_planner.db"
        self.seed.write_text(json.dumps({
            "semester_start": "2026-09-07", "semester_weeks": 18,
            "review_offsets_days": [1, 3, 7, 14, 30], "source": "test",
            "lessons": [{
                "date": "2026-09-14", "week": 2, "weekday": 1,
                "course": "示例课程A", "start_section": 1,
                "end_section": 2, "teacher": "示例教师", "location": "示例教室"
            }]
        }, ensure_ascii=False), encoding="utf-8")
        self.patches = [
            patch.object(server, "DATA_DIR", self.data),
            patch.object(server, "DB_PATH", self.db),
            patch.object(server, "SEED_PATH", self.seed),
            patch.object(server, "BACKUP_DIR", self.data / "backups"),
            patch.object(server, "SECRETS_DIR", self.data / "secrets"),
        ]
        for p in self.patches:
            p.start()
        server.init_db()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.tmp.cleanup()

    def test_unknown_view_or_mode_is_rejected(self):
        with self.assertRaises(ValueError):
            server.list_payload("nope", "today", "2026-09-19")
        with self.assertRaises(ValueError):
            server.list_payload("review", "nope", "2026-09-19")

    def test_today_mode_always_returns_exactly_one_group(self):
        for view in ("review", "todo", "ddl"):
            payload = server.list_payload(view, "today", "2026-09-19")
            self.assertEqual(len(payload["groups"]), 1, view)
            self.assertTrue(payload["groups"][0]["is_today"], view)
            self.assertEqual(payload["groups"][0]["date"], "2026-09-19", view)

    def test_today_group_is_kept_even_when_empty(self):
        """今天没有任何内容时也要留一个空区域，作为长列表里的「现在」锚点。"""
        payload = server.list_payload("ddl", "all", "2026-09-19")
        self.assertEqual(payload["groups"][0]["date"], "2026-09-19")
        self.assertTrue(payload["groups"][0]["is_today"])
        self.assertEqual(payload["groups"][0]["sections"][0]["items"], [])

    def test_today_section_skeleton_survives_empty_items(self):
        """「今天没事项」要看起来像「今天很轻」，而不是「页面坏了」。

        今日态必须保留「待办」这一段的骨架，不能因为 0 条就整段消失。
        """
        payload = server.list_payload("review", "today", "2026-09-19")
        sections = payload["groups"][0]["sections"]
        self.assertEqual([s["key"] for s in sections], ["pending"])
        self.assertEqual(sections[0]["label"], "待复习")
        self.assertEqual(sections[0]["items"], [])

    def test_all_mode_puts_today_first_then_future_ascending_then_past(self):
        """排序算法的核心契约：今天 → 未来升序 → 过去降序。

        今天的区域必须落在最可见位置（列表顶部），过期内容沉到最后。
        """
        payload = server.list_payload("review", "all", "2026-09-19")
        keys = [g["key"] for g in payload["groups"]]
        self.assertEqual(keys[0], "2026-09-19")                      # 今天第一
        future = [k for k in keys if k > "2026-09-19"]
        past = [k for k in keys if k < "2026-09-19"]
        self.assertEqual(future, sorted(future))                     # 未来升序
        self.assertEqual(past, sorted(past, reverse=True))           # 过去降序
        # 未来与过去不能交错
        self.assertEqual(keys[1:len(future) + 1], future)
        self.assertEqual(keys[len(future) + 1:], past)

    def test_review_today_splits_pending_and_done(self):
        conn = server.db_connect()
        lesson_id = conn.execute("SELECT id FROM lessons LIMIT 1").fetchone()["id"]
        conn.execute("UPDATE lessons SET topic='疫苗' WHERE id=?", (lesson_id,))
        conn.commit()
        server.generate_review_chain(conn, lesson_id, "2026-09-19")
        first = conn.execute(
            "SELECT id FROM reviews WHERE lesson_id=? AND status='pending' ORDER BY stage LIMIT 1", (lesson_id,)
        ).fetchone()
        server.complete_review(conn, first["id"], "2026-09-19")
        conn.close()

        payload = server.list_payload("review", "today", "2026-09-19")
        sections = payload["groups"][0]["sections"]
        labels = [s["label"] for s in sections]
        self.assertEqual(labels, ["待复习", "已复习"])
        self.assertTrue(all(i["status"] != "completed" for i in sections[0]["items"]))
        self.assertTrue(all(i["status"] == "completed" for i in sections[1]["items"]))

    def test_todo_today_splits_pending_and_done(self):
        created = server.create_task({
            "title": "今天的待办", "course": "", "type": "task",
            "planned_date": "2026-09-19", "due_date": "", "notes": ""
        })
        done = server.create_task({
            "title": "今天做完了", "course": "", "type": "task",
            "planned_date": "2026-09-18", "due_date": "", "notes": ""
        })
        conn = server.db_connect()
        with conn:
            conn.execute("UPDATE tasks SET status='completed', completed_at=? WHERE id=?",
                         ("2026-09-19T10:00:00", done["id"]))
        conn.close()

        payload = server.list_payload("todo", "today", "2026-09-19")
        sections = payload["groups"][0]["sections"]
        self.assertEqual([s["label"] for s in sections], ["待办", "已完成"])
        self.assertIn(created["id"], [t["id"] for t in sections[0]["items"]])
        self.assertIn(done["id"], [t["id"] for t in sections[1]["items"]])

    def test_ddl_view_has_no_done_section_and_no_tick(self):
        """DDL 只提醒不勾选；任务完成则 DDL 自动取消，故不存在「已完成」区。"""
        created = server.create_task({
            "title": "交英语作业", "course": "", "type": "ddl",
            "planned_date": "", "due_date": "2026-09-19T18:00", "notes": ""
        })
        payload = server.list_payload("ddl", "today", "2026-09-19")
        self.assertFalse(payload["tickable"])
        self.assertEqual(payload["done_label"], "")
        sections = payload["groups"][0]["sections"]
        self.assertEqual([s["key"] for s in sections], ["pending"])
        self.assertIn(created["id"], [t["id"] for t in sections[0]["items"]])

        # 完成后 DDL 自动从清单里消失
        server.set_task_status(created["id"], "completed")
        after = server.list_payload("ddl", "today", "2026-09-19")
        ids = [t["id"] for g in after["groups"] for s in g["sections"] for t in s["items"]]
        self.assertNotIn(created["id"], ids)

    def test_ddl_with_time_matches_its_own_day(self):
        """带时刻的 DDL 必须落在它那一天的区域里，不能被时刻挤掉。"""
        created = server.create_task({
            "title": "带时刻DDL", "course": "", "type": "ddl",
            "planned_date": "", "due_date": "2026-09-21T09:30", "notes": ""
        })
        payload = server.list_payload("ddl", "focus", "2026-09-19", focus_date="2026-09-21")
        self.assertEqual(len(payload["groups"]), 1)
        ids = [t["id"] for s in payload["groups"][0]["sections"] for t in s["items"]]
        self.assertIn(created["id"], ids)

    def test_focus_mode_returns_only_that_day(self):
        server.create_task({
            "title": "21号DDL", "course": "", "type": "ddl",
            "planned_date": "", "due_date": "2026-09-21", "notes": ""
        })
        payload = server.list_payload("ddl", "focus", "2026-09-19", focus_date="2026-09-21")
        self.assertEqual([g["date"] for g in payload["groups"]], ["2026-09-21"])
        self.assertEqual(payload["focus_date"], "2026-09-21")

    def test_focus_mode_on_empty_day_keeps_the_day_visible(self):
        """聚焦到没有事项的那天，仍要能看到「这一天」，不能是空白页。

        聚焦是导航动作（跳到那天），不是筛选动作（把那天空掉）。
        """
        payload = server.list_payload("ddl", "focus", "2026-09-19", focus_date="2030-01-01")
        self.assertEqual([g["date"] for g in payload["groups"]], ["2030-01-01"])
        self.assertEqual(payload["groups"][0]["sections"][0]["items"], [])
        self.assertFalse(payload["groups"][0]["is_today"])

    def test_focus_mode_without_focus_date_falls_back_to_today(self):
        server.create_task({
            "title": "今天的DDL", "course": "", "type": "ddl",
            "planned_date": "", "due_date": "2026-09-19", "notes": ""
        })
        payload = server.list_payload("ddl", "focus", "2026-09-19", focus_date=None)
        self.assertEqual([g["date"] for g in payload["groups"]], ["2026-09-19"])

    def test_list_payload_never_leaks_deleted_tasks(self):
        created = server.create_task({
            "title": "会被删的", "course": "", "type": "task",
            "planned_date": "2026-09-19", "due_date": "", "notes": ""
        })
        server.set_task_status(created["id"], "deleted")
        payload = server.list_payload("todo", "all", "2026-09-19")
        ids = [t["id"] for g in payload["groups"] for s in g["sections"] for t in s["items"]]
        self.assertNotIn(created["id"], ids)

    def test_order_days_keeps_today_first_even_without_items(self):
        days = {"2026-09-15", "2026-09-25", "2026-09-10"}
        ordered = server._order_days(days, "2026-09-19", 180)
        self.assertEqual(ordered[0], "2026-09-19")
        self.assertEqual(ordered[1:], ["2026-09-25", "2026-09-15", "2026-09-10"])

    def test_order_days_limits_history(self):
        days = {"2026-09-0%d" % i for i in range(1, 10)}
        ordered = server._order_days(days, "2026-09-19", 3)
        self.assertEqual(ordered[0], "2026-09-19")
        self.assertEqual(ordered[1:], ["2026-09-09", "2026-09-08", "2026-09-07"])

    def test_ddl_alert_level_thresholds(self):
        """<12h 升级为 modal，<24h 为 banner，更远则不提示。"""
        from datetime import datetime as _dt, timedelta as _td
        now = _dt(2026, 9, 19, 12, 0)
        self.assertEqual(server.ddl_alert_level("2026-09-19T23:00", now), "modal")    # 11h
        self.assertEqual(server.ddl_alert_level("2026-09-20T08:00", now), "banner")   # 20h
        self.assertEqual(server.ddl_alert_level("2026-09-22T12:00", now), "")         # 72h
        self.assertEqual(server.ddl_alert_level("2026-09-18T12:00", now), "modal")    # 已过期
        self.assertEqual(server.ddl_alert_level("", now), "")
        self.assertEqual(server.ddl_alert_level("坏数据", now), "")

    def test_collect_ddl_alerts_only_pending_and_within_window(self):
        far = server.create_task({
            "title": "很远", "course": "", "type": "ddl",
            "planned_date": "", "due_date": "2099-01-01", "notes": ""
        })
        near = server.create_task({
            "title": "很近", "course": "", "type": "ddl",
            "planned_date": "", "due_date": "2099-01-01T00:00", "notes": ""
        })
        # 用真实的「现在 + 1 小时」构造临近项，避免依赖固定时钟
        # 「现在」必须和服务端同源（server.now_bj，北京墙钟）——
        # 测试机时区不同时，本地 now 会和服务端的北京 now 差出十几小时。
        from datetime import datetime as _dt, timedelta as _td
        soon = (server.now_bj() + _td(hours=1)).isoformat(timespec="minutes")
        conn = server.db_connect()
        try:
            with conn:
                conn.execute("UPDATE tasks SET due_date=? WHERE id=?", (soon, near["id"]))
                # 普通任务（非 ddl）即使临近也不该报警
                conn.execute(
                    "INSERT INTO tasks(title,type,planned_date,due_date,notes,status,created_at,completed_at) "
                    "VALUES('普通任务','task','',?,'','pending',?,'')",
                    (soon, server.now_bj().isoformat(timespec="seconds")),
                )
        finally:
            conn.close()

        alerts = server.get_ddl_alerts()
        ids = [a["id"] for a in alerts]
        self.assertIn(near["id"], ids)
        self.assertNotIn(far["id"], ids)
        titles = [a["title"] for a in alerts]
        self.assertNotIn("普通任务", titles)
        self.assertTrue(all(a["hours_left"] <= 24 for a in alerts))

    def test_collect_ddl_alerts_marks_level_and_overdue(self):
        from datetime import datetime as _dt, timedelta as _td
        now = server.now_bj()
        soon = (now + _td(hours=1)).isoformat(timespec="minutes")
        late = (now - _td(hours=3)).isoformat(timespec="minutes")
        near = server.create_task({
            "title": "一小时后", "course": "", "type": "ddl",
            "planned_date": "", "due_date": soon, "notes": ""
        })
        missed = server.create_task({
            "title": "已过期", "course": "", "type": "ddl",
            "planned_date": "", "due_date": late, "notes": ""
        })
        alerts = {a["id"]: a for a in server.get_ddl_alerts()}
        self.assertEqual(alerts[near["id"]]["alert"], "modal")
        self.assertFalse(alerts[near["id"]]["overdue"])
        self.assertEqual(alerts[missed["id"]]["alert"], "modal")
        self.assertTrue(alerts[missed["id"]]["overdue"])

    def test_completed_task_ddl_is_auto_cancelled_in_alerts(self):
        """任务完成 → DDL 自动取消，不该再提醒。"""
        from datetime import datetime as _dt, timedelta as _td
        soon = (server.now_bj() + _td(hours=1)).isoformat(timespec="minutes")
        created = server.create_task({
            "title": "马上到期", "course": "", "type": "ddl",
            "planned_date": "", "due_date": soon, "notes": ""
        })
        self.assertIn(created["id"], [a["id"] for a in server.get_ddl_alerts()])
        server.set_task_status(created["id"], "completed")
        self.assertNotIn(created["id"], [a["id"] for a in server.get_ddl_alerts()])


if __name__ == "__main__":
    unittest.main()
