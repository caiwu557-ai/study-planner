"""隔离的界面回归服务，不读取或修改用户数据库与密钥。"""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


with tempfile.TemporaryDirectory(prefix='study-planner-feedback-') as directory:
    root = Path(directory)
    server.DATA_DIR = root
    server.DB_PATH = root / 'study_planner.db'
    server.BACKUP_DIR = root / 'backups'
    server.SECRETS_DIR = root / 'secrets'
    server.SEED_PATH = root / 'seed.json'
    today = server.today_bj()
    monday = today - server.timedelta(days=today.weekday())
    server.SEED_PATH.write_text(json.dumps({
        'semester_start': monday.isoformat(), 'semester_weeks': 18,
        'review_offsets_days': [0, 1, 3], 'source': 'isolated UI test',
        'lessons': [{'date': today.isoformat(), 'week': 1, 'weekday': today.isoweekday(), 'course': '测试课程', 'start_section': 1, 'end_section': 2}],
    }, ensure_ascii=False), encoding='utf-8')
    server.init_db()
    server.update_lesson_topic(1, topic='测试复习主题', today_str=today.isoformat())
    server.create_task({'title': '示例项目材料提交', 'planned_date': today.isoformat(), 'due_date': (today + server.timedelta(days=2)).isoformat(), 'course': '测试课程', 'type': 'assignment'})
    server.create_task({'title': '未安排日期的测试任务'})
    with server.SingleInstanceHTTPServer(('127.0.0.1', 18765), server.Handler) as http:
        print('ISOLATED UI SERVER READY 18765', flush=True)
        http.serve_forever()
