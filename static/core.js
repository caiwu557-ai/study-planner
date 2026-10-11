export function localISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---- 北京时间（Asia/Shanghai, UTC+8）----
// 本应用所有「今天 / 现在」的语义都是北京墙上时间，不跟浏览器系统时区走
//（用户系统时区不保证是北京时间）。做法：用 Intl 取北京墙上时间的字段，
// 再构造一个「本地字段 = 北京墙上时间」的 Date——parseISO/parseDue 这类
// 按本地字段解释日期的工具因此完全不用改，与后端（同样按北京墙钟写库）天然对齐。
export function bjNow() {
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date());                       // 'YYYY-MM-DD HH:MM:SS'
  return new Date(s.replace(' ', 'T'));
}

/** 北京时间的今天，'YYYY-MM-DD' */
export function bjISO(d = bjNow()) { return localISO(d); }

/** 北京时间的 时:分，'HH:MM' */
export function bjHM(d = bjNow()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function parseISO(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(dateOrISO, amount) {
  const d = typeof dateOrISO === 'string' ? parseISO(dateOrISO) : new Date(dateOrISO);
  d.setDate(d.getDate() + amount);
  return localISO(d);
}

export function startOfWeek(dateOrISO) {
  const d = typeof dateOrISO === 'string' ? parseISO(dateOrISO) : new Date(dateOrISO);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localISO(d);
}

export function esc(s = '') {
  return String(s).replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

export function weekdayCN(d) {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
}

export function dateLabel(s) {
  const d = parseISO(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ---- 截止时间（due_date 已升级为「日期 + 时间」）----
// 后端保证要么是 ''、要么是 'YYYY-MM-DD'、要么是 'YYYY-MM-DDTHH:MM'。
// 下面这几个都是纯函数，不要在这里做本地时区换算——日期部分就是字面量。

/** 取出日期部分：'2026-09-21T18:00' → '2026-09-21' */
export function dueDay(due) {
  return String(due || '').split('T')[0];
}

/** 取出时刻部分：'2026-09-21T18:00' → '18:00'；纯日期返回 '' */
export function dueTime(due) {
  const parts = String(due || '').split('T');
  return parts[1] ? parts[1].slice(0, 5) : '';
}

/** 把日期 + 可选时刻拼回后端要的格式。时刻留空时只发日期，由后端补 23:59。 */
export function joinDue(day, time) {
  const d = String(day || '').trim();
  if (!d) return '';
  const t = String(time || '').trim();
  return t ? `${d}T${t}` : d;
}

/** 解析成 Date（本地时区）；无法解析返回 null */
export function parseDue(due) {
  const text = String(due || '').trim();
  if (!text) return null;
  const [day, time] = text.split('T');
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return null;
  if (time) {
    const [hh, mm] = time.split(':').map(Number);
    return new Date(y, m - 1, d, hh || 0, mm || 0);
  }
  return new Date(y, m - 1, d, 23, 59);
}

export function longDateLabel(s) {
  const d = parseISO(s);
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${weekdayCN(d)}`;
}

export function monthTitle(dateOrISO) {
  const d = typeof dateOrISO === 'string' ? parseISO(dateOrISO) : new Date(dateOrISO);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

export function api(path, opts = {}) {
  return fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  }).then(async res => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  });
}

export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2400);
}

/** duration：撤销窗口毫秒数。普通完成 8s 够用；删课程这类重操作传更长（调用方决定）。 */
export function showActionToast(message, actionLabel, actionFn, duration = 8000) {
  const bar = document.getElementById('actionToast');
  if (!bar) return;
  hideActionToast();
  document.getElementById('toast')?.classList.remove('show');
  clearTimeout(toast.timer);
  bar.querySelector('.action-toast-copy').textContent = message;
  const btn = bar.querySelector('.action-toast-btn');
  btn.textContent = actionLabel || '撤销';
  btn.onclick = async () => {
    btn.disabled = true;
    try { await actionFn?.(); hideActionToast(); }
    catch (err) { toast(err.message || '撤销失败，请重试'); }
    finally { btn.disabled = false; }
  };
  btn.disabled = false;
  bar.classList.add('show');
  const countdown = bar.querySelector('.action-toast-countdown');
  const edge = bar.querySelector('.action-toast-edge rect');
  edge.setAttribute('width', bar.offsetWidth - 2);
  edge.setAttribute('height', bar.offsetHeight - 2);
  edge.setAttribute('rx', (bar.offsetHeight - 2) / 2);
  const end = performance.now() + duration;
  const tick = () => {
    const remaining = Math.max(0, end - performance.now());
    countdown.textContent = `${Math.ceil(remaining / 1000)}s`;
    edge.style.strokeDashoffset = String(100 * (1 - remaining / duration));
    if (!remaining) return hideActionToast();
    showActionToast.frame = requestAnimationFrame(tick);
  };
  tick();
}

export function hideActionToast() {
  cancelAnimationFrame(showActionToast.frame);
  const bar = document.getElementById('actionToast');
  if (!bar) return;
  bar.classList.remove('show');
}
