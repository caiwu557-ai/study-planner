"""Compare the browser's migrated rules with the actual SQLite local edition."""
import json
import subprocess
import sys
import tempfile
from datetime import date, datetime
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server

with tempfile.TemporaryDirectory(prefix='sp-web-parity-') as directory:
    root = Path(directory)
    with patch.multiple(server, DATA_DIR=root, DB_PATH=root/'test.db', BACKUP_DIR=root/'backups', SECRETS_DIR=root/'secrets', SEED_PATH=root/'seed.json'), patch.object(server, 'today_bj', return_value=date(2026,9,14)), patch.object(server, 'now_bj', return_value=datetime(2026,9,14,10,0)):
        server.SEED_PATH.write_text(json.dumps({'semester_start':'2026-09-07','semester_weeks':18,'source':'test','lessons':[{'date':'2026-09-07','week':1,'weekday':1,'course':'课程','start_section':1,'end_section':2}]}), encoding='utf-8')
        server.init_db()
        server.create_task({'title':'任务','planned_date':'2026-09-14','due_date':'2026-09-14','type':'ddl'})
        def records():
            conn = server.db_connect()
            try:
                return {table:[dict(row) for row in conn.execute(f'SELECT * FROM {table} ORDER BY id')] for table in ('lessons','reviews','tasks')}
            finally:
                conn.close()
        state = {'version':1,'meta':{'semester_start':'2026-09-07','semester_weeks':18,'source':'test'},'settings':server.get_settings_payload(),**records(),'ids':{'lessons':1,'reviews':0,'tasks':1}}
        result = subprocess.run([sys.argv[1], str(ROOT/'tests/web_parity.mjs')], input=json.dumps(state), encoding='utf-8', capture_output=True, check=True)
        web = json.loads(result.stdout)
        local = []
        server.update_lesson_topic(1,'复习主题',today_str='2026-09-14');local.append(records())
        conn=server.db_connect()
        server.complete_review(conn,1,'2026-09-17');local.append(records())
        server.undo_review_completion(conn,1);local.append(records())
        server.replan_overdue(conn,date(2026,9,22));local.append(records());conn.close()
        server.set_task_status(1,'completed');local.append(records())
        server.set_task_status(1,'deleted');local.append(records())
        server.restore_task(1);local.append(records())
        server.update_lesson_topic(1,'');local.append(records())
        server.delete_lesson(1);local.append(records())
        def normalized(snapshots):
            return [{table:[{k:v for k,v in row.items() if k not in ('created_at','completed_at')} for row in rows] for table,rows in frame.items()} for frame in snapshots]
        assert normalized(web) == normalized(local), 'Browser rules diverged from SQLite rules'
print('Browser / SQLite parity: nine review, task and lesson transitions matched.')
