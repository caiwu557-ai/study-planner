"""Build the full browser edition without importing personal data or server state."""
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = (Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'site') / 'web'
OUT.mkdir(parents=True, exist_ok=True)
for name in ['index.html', 'styles.css', 'app.js', 'core.js']:
    shutil.copyfile(ROOT / 'static' / name, OUT / name)
html = (OUT / 'index.html').read_text(encoding='utf-8')
html = html.replace('href="/styles.css"', 'href="./styles.css"').replace('href="/schedule-skill.md"', 'href="./schedule-skill.md"')
html = html.replace('<title>Study Planner V3</title>', '''<title>Study Planner · 个人学习日历</title>
  <meta name="theme-color" content="#2e5fa3" />
  <meta name="description" content="打开即用的学习日历，课表、复习和任务保存在你的浏览器中。" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'none'" />
  <link rel="manifest" href="./manifest.json" />
  <link rel="icon" href="./icon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="./icon-192.png" />
  <link rel="stylesheet" href="./web.css" />''')
html = html.replace('<script type="module" src="/app.js"></script>', '<script type="module" src="./entry.js"></script>')
assert 'src="/app.js"' not in html
(OUT / 'index.html').write_text(html, encoding='utf-8')
app = (OUT / 'app.js').read_text(encoding='utf-8')
# Browser UI preferences are isolated from the fictional demo on the same origin.
app = app.replace('sp_rail_collapsed', 'sp_web_rail_collapsed').replace('sp_ddl_', 'sp_web_ddl_')
app = app.replace('SQLite v${meta.schema_version || 3}', '浏览器存档').replace('SQLite v${meta.schema_version}', '浏览器存档')
(OUT / 'app.js').write_text(app, encoding='utf-8')
for name in ['engine.js', 'storage.js', 'entry.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png']:
    shutil.copyfile(ROOT / 'web' / name, OUT / name)
shutil.copyfile(ROOT / 'web/styles.css', OUT / 'web.css')
shutil.copyfile(ROOT / '.agents/skills/study-planner-schedule/SKILL.md', OUT / 'schedule-skill.md')
assets = ['./', './index.html', './styles.css', './web.css', './app.js', './core.js', './engine.js', './storage.js', './entry.js', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png', './schedule-skill.md']
digest = hashlib.sha256(b''.join((OUT / x.removeprefix('./')).read_bytes() for x in assets if x != './')).hexdigest()[:16]
sw = (ROOT / 'web/sw.js').read_text(encoding='utf-8').replace('__CACHE__', 'study-planner-web-' + digest).replace('__ASSETS__', json.dumps(assets))
(OUT / 'sw.js').write_text(sw, encoding='utf-8')
print('Built full browser edition:', OUT)
