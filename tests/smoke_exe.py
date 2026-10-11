"""在临时目录检查打包程序，不触碰实际数据，不发送真实 API 请求。"""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
import urllib.error
from pathlib import Path

candidate = Path(sys.argv[1]).resolve()
root = Path(__file__).resolve().parents[1]
with socket.socket() as probe:
    probe.bind(('127.0.0.1', 18766))
with tempfile.TemporaryDirectory(prefix='study-planner-exe-check-') as folder:
    executable = Path(folder) / 'StudyPlanner.exe'
    shutil.copy2(candidate, executable)
    environment = os.environ.copy()
    environment.pop('DEEPSEEK_API_KEY', None)
    environment.update(STUDY_PLANNER_PORT='18766', STUDY_PLANNER_NO_BROWSER='1')
    process = subprocess.Popen([str(executable)], env=environment, cwd=folder, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        for _ in range(100):
            try:
                with urllib.request.urlopen('http://127.0.0.1:18766/', timeout=1) as response:
                    html = response.read().decode('utf-8')
                break
            except (OSError, urllib.error.URLError):
                assert process.poll() is None, 'executable exited before startup'
                time.sleep(.1)
        else:
            raise AssertionError('startup timeout')
        assert '周课表' in html and '月清单' in html and 'apiTestStatus' in html
        assert 'data-view="tasks"' not in html
        assert 'density-switch' in html and 'type="range"' in html and 'shortcutsCard' in html
        assert 'themeNameInput' not in html and '下载格式样例' not in html
        with urllib.request.urlopen('http://127.0.0.1:18766/api/meta') as response:
            assert json.load(response)['lesson_count'] == 0, 'public EXE must start with an empty schedule'
        with urllib.request.urlopen('http://127.0.0.1:18766/api/courses') as response:
            assert json.load(response)['courses'] == []
        with urllib.request.urlopen('http://127.0.0.1:18766/schedule-skill.md') as response:
            assert response.read() == (root / '.agents/skills/study-planner-schedule/SKILL.md').read_bytes()
        with urllib.request.urlopen('http://127.0.0.1:18766/app.js') as response:
            assert 'inline-task-editor' in response.read().decode('utf-8')
        sample = json.loads((root / 'static/schedule-example.json').read_text(encoding='utf-8'))
        request = urllib.request.Request('http://127.0.0.1:18766/api/schedule/preview', json.dumps(sample).encode(), {'Content-Type': 'application/json'})
        with urllib.request.urlopen(request) as response:
            assert json.load(response)['total'] == 1
        request = urllib.request.Request('http://127.0.0.1:18766/api/ai/test', b'{"base_url":"file:///invalid"}', {'Content-Type': 'application/json'})
        try:
            urllib.request.urlopen(request)
            raise AssertionError('unsafe API URL accepted')
        except urllib.error.HTTPError as error:
            assert error.code == 400
        print('PASS packaged EXE startup, bundled UI, schedule preview and API test endpoint')
    finally:
        if process.poll() is None:
            subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        process.wait(timeout=10)

with socket.socket() as occupied, tempfile.TemporaryDirectory(prefix='study-planner-busy-port-') as folder:
    occupied.bind(('127.0.0.1', 18767))
    occupied.listen()
    executable = Path(folder) / 'StudyPlanner.exe'
    shutil.copy2(candidate, executable)
    environment = os.environ.copy()
    environment.pop('DEEPSEEK_API_KEY', None)
    environment.update(STUDY_PLANNER_PORT='18767', STUDY_PLANNER_NO_BROWSER='1')
    blocked = subprocess.run([str(executable)], env=environment, cwd=folder, capture_output=True, timeout=15, creationflags=subprocess.CREATE_NO_WINDOW)
    assert blocked.returncode == 1
    assert not (Path(folder) / 'data').exists(), 'busy-port startup must not create or migrate data'
    with socket.socket() as client:
        client.settimeout(1)
        assert client.connect_ex(('127.0.0.1', 18767)) == 0, 'existing listener must survive'
    print('PASS public EXE empty seed and occupied-port preservation')
