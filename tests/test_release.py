import json
import errno
import unittest
from pathlib import Path
from unittest.mock import patch

import test_server as fixtures
import server


class ReleaseTests(unittest.TestCase):
    setUp = fixtures.StudyPlannerBackendTests.setUp
    tearDown = fixtures.StudyPlannerBackendTests.tearDown

    def test_empty_public_seed_is_usable_and_import_sets_metadata(self):
        public_seed = json.loads((fixtures.ROOT / 'data/seed_schedule.json').read_text(encoding='utf-8'))
        self.assertEqual(public_seed['lessons'], [])
        self.seed.write_text(json.dumps(public_seed), encoding='utf-8')
        server.init_db()
        conn = server.db_connect()
        self.assertEqual(conn.execute('SELECT COUNT(*) FROM lessons').fetchone()[0], 0)
        self.assertEqual(conn.execute('SELECT COUNT(*) FROM tasks').fetchone()[0], 0)
        conn.close()
        sample = json.loads((fixtures.ROOT / 'static/schedule-example.json').read_text(encoding='utf-8'))
        self.assertEqual(server.schedule_import(sample)['added'], 1)
        conn = server.db_connect()
        self.assertEqual(server._meta_get(conn, 'semester_start'), sample['metadata']['semester_start'])
        conn.close()

    def test_occupied_port_does_not_initialize_data_or_kill_any_process(self):
        with patch.object(server, 'SingleInstanceHTTPServer', side_effect=OSError(errno.EADDRINUSE, 'occupied')), patch.object(server, 'init_db') as initialize:
            with self.assertRaises(SystemExit):
                server.main()
            initialize.assert_not_called()
        self.assertFalse(server.DB_PATH.exists())

    def test_initialization_failure_closes_listener(self):
        with patch.object(server, 'SingleInstanceHTTPServer') as listener, patch.object(server, 'init_db', side_effect=RuntimeError('test failure')):
            with self.assertRaises(RuntimeError):
                server.main()
            listener.return_value.server_close.assert_called_once()
