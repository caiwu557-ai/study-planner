"""Build Pages with the real frontend and an isolated fictional database snapshot."""
import json
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'site'
assert OUT.resolve() != ROOT.resolve()
OUT.mkdir(parents=True, exist_ok=True)
app = OUT / 'app'
app.mkdir(exist_ok=True)
for name in ['index.html', 'styles.css', 'app.js', 'core.js']:
    shutil.copyfile(ROOT / 'static' / name, app / name)
html = (app / 'index.html').read_text(encoding='utf-8')
html = html.replace('href="/styles.css"', 'href="./styles.css"').replace('href="/schedule-skill.md"', 'href="./schedule-skill.md"')
html = html.replace('<script type="module" src="/app.js"></script>', '<script src="./snapshot.js"></script><script src="./adapter.js"></script><script type="module" src="./app.js"></script><script src="./director.js" defer></script>')
(app / 'index.html').write_text(html, encoding='utf-8')
for name in ['adapter.js', 'director.js']:
    shutil.copyfile(ROOT / 'demo' / name, app / name)
shutil.copyfile(ROOT / '.agents/skills/study-planner-schedule/SKILL.md', app / 'schedule-skill.md')
shutil.copyfile(ROOT / 'demo/index.html', OUT / 'index.html')
shutil.copyfile(ROOT / 'demo/embed.html', OUT / 'embed.html')
with tempfile.TemporaryDirectory(prefix='sp-pages-') as directory:
    temp = Path(directory)
    server.DATA_DIR = temp
    server.DB_PATH = temp / 'demo.db'
    server.BACKUP_DIR = temp / 'backups'
    server.SECRETS_DIR = temp / 'secrets'
    server.SEED_PATH = temp / 'seed.json'
    today = server.today_bj()
    monday = today - server.timedelta(days=today.weekday())
    lessons = []
    for w in range(3):
        for day, course, section, room in [(0, '学习方法导论', 1, '研讨室 A'), (2, '信息素养', 3, '研讨室 B'), (4, '写作与表达', 5, '研讨室 C')]:
            d = monday + server.timedelta(days=w * 7 + day)
            lessons.append(dict(date=d.isoformat(), week=w + 1, weekday=d.isoweekday(), course=course, start_section=section, end_section=section + 1, location=room, teacher='示例教师'))
    lessons.append(dict(date=today.isoformat(), week=1, weekday=today.isoweekday(), course='自主学习', start_section=7, end_section=8, location='图书馆'))
    server.SEED_PATH.write_text(json.dumps(dict(semester_start=monday.isoformat(), semester_weeks=18, review_offsets_days=[0, 1, 3, 7], source='虚构交互演示', lessons=lessons)), encoding='utf-8')
    server.init_db()
    conn = server.db_connect()
    try:
        ids = [r[0] for r in conn.execute('SELECT id FROM lessons')]
    finally:
        conn.close()
    for i in ids:
        server.update_lesson_topic(i, topic=['概念梳理与课后总结', '检索方法与信息筛选', '观点整理与表达练习'][i % 3], today_str=today.isoformat())
    for title, days, due in [('整理本周课堂笔记', 0, 3), ('完成课程报告初稿', 0, 5), ('准备小组讨论', 2, 7)]:
        server.create_task(dict(title=title, planned_date=(today + server.timedelta(days=days)).isoformat(), due_date=(today + server.timedelta(days=due)).isoformat() + 'T18:00', course='学习方法导论', type='assignment', notes='目标：梳理课程重点\n材料：课堂笔记与阅读资料\n交付：一份清晰的总结'))
    conn = server.db_connect()
    try:
        meta = {r['key']: r['value'] for r in conn.execute('SELECT key,value FROM meta')}
    finally:
        conn.close()
    cal = server.calendar_payload((monday - server.timedelta(days=35)).isoformat(), (monday + server.timedelta(days=90)).isoformat())
    meta.update(course_count=4, lesson_count=len(lessons), ai_enabled=False)
    settings = server.get_settings_payload()
    settings['ai']['api_key_configured'] = False
    data = dict(today=today.isoformat(), meta=meta, settings=settings, calendar=cal, day=server.get_day_payload(today.isoformat()), specs=server.VIEW_SPECS)
    assert not settings['ai']['api_key_configured'] and len(cal['lessons']) == len(lessons)
    (app / 'snapshot.js').write_text('window.DEMO_SEED=' + json.dumps(data, ensure_ascii=False) + ';', encoding='utf-8')
print('Built real frontend demo:', OUT)
