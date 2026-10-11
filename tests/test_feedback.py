import copy
import io
import json
import unittest
import urllib.error
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

import test_server as fixtures
import server


class FeedbackTests(unittest.TestCase):
    setUp = fixtures.StudyPlannerBackendTests.setUp
    tearDown = fixtures.StudyPlannerBackendTests.tearDown

    def test_font_size_legacy_compatibility_and_atomic_validation(self):
        server.init_db()
        original = server.get_settings_payload()['appearance']
        for size in ('normal', 'large', '12', '17', '20'):
            result = server.save_appearance_settings({**original, 'font_scale': size, 'density': 'comfortable'})
            self.assertEqual(result['appearance']['font_scale'], size)
        before = server.get_settings_payload()
        for size in ('11', '21', 'NaN', '17.5', 'True'):
            with self.assertRaises(ValueError):
                server.save_appearance_settings({**original, 'font_scale': size})
            self.assertEqual(server.get_settings_payload(), before)
        with self.assertRaises(ValueError):
            server.save_appearance_settings({**original, 'density': 'invalid'})

    def schedule(self):
        return json.loads((fixtures.ROOT / 'static/schedule-example.json').read_text(encoding='utf-8'))

    def test_schedule_preview_is_read_only_and_import_is_duplicate_safe(self):
        server.init_db()
        payload = self.schedule()
        before = server.db_connect()
        original = [dict(r) for r in before.execute('SELECT * FROM lessons')]
        before.close()
        self.assertEqual(server.schedule_import(payload, preview=True)['added'], 1)
        self.assertEqual(server.schedule_import(payload)['added'], 1)
        self.assertEqual(server.schedule_import(payload)['skipped'], 1)
        conn = server.db_connect()
        self.assertEqual(dict(conn.execute('SELECT * FROM lessons WHERE id=?', (original[0]['id'],)).fetchone()), original[0])
        self.assertEqual(conn.execute('SELECT COUNT(*) FROM lessons').fetchone()[0], 2)
        self.assertEqual(conn.execute('SELECT COUNT(*) FROM reviews').fetchone()[0], 0)
        conn.close()

    def test_invalid_last_lesson_rejects_entire_import(self):
        server.init_db()
        payload = self.schedule()
        bad = copy.deepcopy(payload['lessons'][0])
        bad['lesson_date'] = '2026-02-30'
        payload['lessons'].append(bad)
        with self.assertRaises(ValueError):
            server.schedule_import(payload)
        conn = server.db_connect()
        self.assertEqual(conn.execute('SELECT COUNT(*) FROM lessons').fetchone()[0], 1)
        conn.close()

    def test_schedule_boundaries_and_duplicates(self):
        payload = self.schedule()
        for value in (0, 55, True, '18'):
            bad = copy.deepcopy(payload)
            bad['metadata']['semester_weeks'] = value
            with self.assertRaises(ValueError):
                server.validate_schedule(bad)
        for value in (0, 13, 1.5, True):
            bad = copy.deepcopy(payload)
            bad['lessons'][0]['start_section'] = value
            with self.assertRaises(ValueError):
                server.validate_schedule(bad)
        server.init_db()
        payload['lessons'] *= 2
        result = server.schedule_import(payload)
        self.assertEqual((result['added'], result['skipped']), (1, 1))

    def test_import_requires_backup(self):
        server.init_db()
        with patch.object(server, 'backup_database', return_value=False):
            with self.assertRaises(RuntimeError):
                server.schedule_import(self.schedule())

    def test_undated_task_remains_manageable_after_removing_tasks_page(self):
        server.init_db()
        task = server.create_task({'title': '未安排日期'})
        all_items = [i for g in server.list_payload('todo', 'all')['groups'] for s in g['sections'] for i in s['items']]
        self.assertIn(task['id'], [i['id'] for i in all_items])
        today_items = [i for g in server.list_payload('todo', 'today')['groups'] for s in g['sections'] for i in s['items']]
        self.assertNotIn(task['id'], [i['id'] for i in today_items])

    def test_test_connection_uses_unsaved_configuration_without_writing(self):
        server.init_db()
        old = server.get_settings_payload()['ai']
        opener = MagicMock()
        opener.open.return_value.__enter__.return_value.read.return_value = json.dumps({'choices': [{'message': {'content': 'OK'}}]}).encode()
        with patch.object(server.urllib.request, 'build_opener', return_value=opener):
            self.assertEqual(server.test_ai_connection({'base_url': 'https://example.test/v1', 'model': 'test-model', 'api_key': 'test-key'})['model'], 'test-model')
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, 'https://example.test/v1/chat/completions')
        self.assertEqual(json.loads(request.data)['messages'], [{'role': 'user', 'content': 'Reply OK.'}])
        self.assertEqual(server.get_settings_payload()['ai'], old)
        self.assertFalse((server.SECRETS_DIR / 'deepseek_api_key.bin').exists())

    def test_api_errors_do_not_echo_provider_secrets(self):
        server.init_db()
        opener = MagicMock()
        opener.open.side_effect = urllib.error.HTTPError('https://example.test', 401, 'error', {}, io.BytesIO(b'test-key'))
        with patch.object(server.urllib.request, 'build_opener', return_value=opener):
            with self.assertRaises(RuntimeError) as result:
                server.test_ai_connection({'api_key': 'test-key'})
        self.assertIn('401', str(result.exception))
        self.assertNotIn('test-key', str(result.exception))

    def test_other_websites_cannot_invoke_local_secret_backed_api(self):
        handler = object.__new__(server.Handler)
        handler.server = SimpleNamespace(server_port=8765)
        handler.rfile = io.BytesIO(b'{}')
        for origin in ('https://example.test', 'null', 'http://localhost:9999'):
            handler.headers = {'Origin': origin, 'Content-Length': '2'}
            with self.assertRaises(ValueError):
                handler.read_json()
        handler.headers = {'Origin': 'http://127.0.0.1:8765', 'Content-Length': '2'}
        self.assertEqual(handler.read_json(), {})

    def test_api_rejects_unsafe_url_and_invalid_response(self):
        server.init_db()
        for url in ('http://example.test', 'https://key@example.test', 'https://example.test?key=secret'):
            with self.assertRaises(ValueError):
                server.test_ai_connection({'base_url': url, 'api_key': 'test-key'})
        opener = MagicMock()
        opener.open.return_value.__enter__.return_value.read.return_value = b'{"choices":[]}'
        with patch.object(server.urllib.request, 'build_opener', return_value=opener):
            with self.assertRaises(RuntimeError):
                server.test_ai_connection({'api_key': 'test-key'})

    def test_ai_notes_are_formatted_and_not_saved_until_confirmation(self):
        server.init_db()
        content = {'title': '准备作业', 'course': '', 'type': 'assignment', 'planned_date': '2026-09-19', 'due_date': '2026-09-20', 'notes': {'steps': ['先读材料', '写初稿'], 'materials': ['讲义'], 'requirements': ['提交 PDF'], 'unclear': []}}
        with patch.object(server, 'ai_chat', return_value=(json.dumps(content), 'test-model')):
            result = server.deepseek_parse('凌乱输入', '2026-09-19')
        self.assertEqual(result['notes'], '执行步骤\n1. 先读材料\n2. 写初稿\n\n材料与资料\n1. 讲义\n\n注意事项\n1. 提交 PDF')
        self.assertEqual(result['due_date'], '2026-09-20T23:59')
        conn = server.db_connect()
        self.assertEqual(conn.execute('SELECT COUNT(*) FROM tasks').fetchone()[0], 0)
        conn.close()


if __name__ == '__main__':
    unittest.main()
