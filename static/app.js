import { api, addDays, bjHM, bjISO, bjNow, dateLabel, dueDay, dueTime, esc, hideActionToast, joinDue, localISO, longDateLabel, monthTitle, parseDue, parseISO, showActionToast, startOfWeek, toast, weekdayCN } from './core.js';

const THEMES = {
  'lemon-salt': {
    label: '柠檬海盐',
    desc: '清爽学院风，冷白卡片浮在淡蓝纸面，适合长时间看课表',
    accent: '#2E5FA3', accent2: '#E8C21C',
    bg: '#F1F5FB', tintA: 'rgba(46,95,163,.14)', tintB: 'rgba(232,194,28,.16)',
    card: '#FFFFFF', surface: 'rgba(255,255,255,.88)', surface2: '#E8EFF8',
    line: '#DCE3EE', softLine: '#E8EDF5',
    sidebar: 'rgba(255,255,255,.80)', sidebarLine: '#E0E7F1',
    segBg: '#E5ECF6', chipBg: '#EAF0F8', chipText: '#5C6579',
    shadow: '0 10px 28px rgba(46,95,163,.09)',
    btnShadow: '0 2px 6px rgba(46,95,163,.20)',
    text: '#212936', muted: '#6D7789',
  },
  'margarita': {
    label: '玛格丽特',
    desc: '暖调活力风，奶油橘纸面配樱桃红主操作，适合任务密集的冲刺周',
    accent: '#BE3A3B', accent2: '#E8842A',
    bg: '#FBF3EC', tintA: 'rgba(190,58,59,.13)', tintB: 'rgba(232,132,42,.17)',
    card: '#FFFDFB', surface: 'rgba(255,253,251,.90)', surface2: '#F6EAE0',
    line: '#EFE0D4', softLine: '#F4E9DE',
    sidebar: 'rgba(255,252,248,.84)', sidebarLine: '#F0E3D7',
    segBg: '#F4E8DC', chipBg: '#F6ECE1', chipText: '#7C5F50',
    shadow: '0 10px 28px rgba(160,74,54,.10)',
    btnShadow: '0 2px 6px rgba(190,58,59,.20)',
    text: '#312523', muted: '#877065',
  },
  'vanilla-cream': {
    label: '薄荷奶绿',
    desc: '薄荷绿配奶油白，像速记本一样安静，适合长时段的复习',
    // 「奶」= 奶油色：暖调浅奶油。原来这里是 #D9B44A（土黄/芥末），
    // 和「奶」的意象相反，已换成奶油浅调 #F3DCA6。
    // 辅色只用于装饰标记（小标题左杠 / 今天的顶线与光圈 / 品牌角标），
    // 浅奶油足够清晰，还能和薄荷绿形成暖冷对照。
    accent: '#2F7A63', accent2: '#F3DCA6',
    bg: '#F5F7EF', tintA: 'rgba(47,122,99,.12)', tintB: 'rgba(243,220,166,.22)',
    card: '#FFFDF6', surface: 'rgba(255,253,246,.92)', surface2: '#EDF1E3',
    line: '#DCE4CD', softLine: '#E7ECDA',
    sidebar: 'rgba(255,253,246,.88)', sidebarLine: '#DFE6D2',
    segBg: '#EAEFDF', chipBg: '#EFF2E4', chipText: '#5E6B52',
    shadow: '0 10px 28px rgba(47,122,99,.10)',
    btnShadow: '0 2px 6px rgba(47,122,99,.18)',
    text: '#22302B', muted: '#6C7A5F',
  },
  'mono': {
    label: '纯色',
    desc: '在下方调色盘只选一种深色，浅色由它自动加白衍生，整站同一色系',
    custom: true,
    accent: '#3A4759', accent2: '#5A6A82',
    bg: '#F4F5F7', tintA: 'rgba(58,71,89,.12)', tintB: 'rgba(58,71,89,.06)',
    card: '#FFFFFF', surface: 'rgba(255,255,255,.88)', surface2: '#EFF1F4',
    line: '#DDE1E8', softLine: '#E7EAF0',
    sidebar: 'rgba(255,255,255,.82)', sidebarLine: '#E3E6EC',
    segBg: '#ECEEF2', chipBg: '#EEF0F4', chipText: '#5D6570',
    shadow: '0 10px 28px rgba(58,66,84,.09)',
    btnShadow: '0 2px 6px rgba(58,71,89,.20)',
    text: '#262B36', muted: '#70778A',
  },
};
const SECTION_ORDER = [1,2,3,4,5,6,7,8,9,10,11,12];
// 「纯色」主题没有第二种颜色可选，辅色由主色加白 15% 衍生——保持同色系，
// 只比主色浅一点，仍能作为「小标题短杠 / 当天下划线」被看清。
const MONO_A2_T = 0.15;
const COURSE_PALETTES = [
  ['#C0483F', '#F5E3E1', '#FBF3F2'], ['#3E5E86', '#E3EAF3', '#F4F7FB'],
  ['#6B4A86', '#EDE6F2', '#F8F5FB'], ['#2F7A63', '#E1F0EB', '#F3F9F7'],
  ['#9A6B24', '#F4EBD9', '#FBF7EF'], ['#4B5A78', '#E5E9F0', '#F5F7FA'],
];

const state = {
  // 「今天」一律北京时间（bjISO），不跟浏览器系统时区——与后端写库的北京墙钟对齐。
  today: bjISO(),
  view: 'home',
  selectedDate: bjISO(),
  calendarMode: 'week',
  calendarMonth: (() => { const b = bjNow(); return new Date(b.getFullYear(), b.getMonth(), 1); })(),
  filter: 'all',
  meta: null,
  settings: null,
  courses: [],
  dayData: null,
  calData: { lessons: [], reviews: [], tasks: [] },
  trashList: [],
  flashTaskId: null,
  // 三个功能视图：每个各自记住自己的展示态（仅今日 / 全部 / 聚焦某天），
  // 切换到别的视图再回来时不会丢上下文。
  listMode: { review: 'today', todo: 'today', ddl: 'today' },
  listFocus: { review: '', todo: '', ddl: '' },
  listData: {},
  // 侧边栏收起态：记在 localStorage，刷新后保持
  railCollapsed: localStorage.getItem('sp_rail_collapsed') === '1',
  // 已弹过窗的 DDL（按 id + 截止时间做键）：避免同一件事反复打扰。
  // 键会同步进 localStorage（当天有效）——不然 F5 一下同一件事又弹一遍。
  ddlPopped: loadPoppedDdl(),
};

// 「稍后再说」的当天持久化：键里带日期（北京时间），第二天自然过期，不用清理逻辑。
function poppedDdlKey() { return `sp_ddl_popped_${bjISO()}`; }
function loadPoppedDdl() {
  try {
    return new Set(JSON.parse(localStorage.getItem(poppedDdlKey()) || '[]'));
  } catch { return new Set(); }
}
function rememberPoppedDdl(keys) {
  keys.forEach(k => state.ddlPopped.add(k));
  try {
    localStorage.setItem(poppedDdlKey(), JSON.stringify([...state.ddlPopped]));
  } catch { /* localStorage 满/禁用时退化为会话内去重，不打断主流程 */ }
}

// 视图名 → 清单类型。三个清单页共用一套渲染，靠这张表路由。
const LIST_VIEWS = { reviews: 'review', todos: 'todo', ddls: 'ddl' };
const LIST_META = {
  review: { title: '复习清单', tickable: true, icony: 'review' },
  todo: { title: '待办清单', tickable: true, icony: 'todo' },
  ddl: { title: '到期清单', tickable: false, icony: 'ddl' },
};

let drawerDataCache = null;
let lessonModalCtx = null;
let currentThemeKey = 'custom';
let pendingShortcutHelp = false;
// 请求令牌：快速切换日期/视图时，迟到的旧响应不能覆盖新状态。
// 不加这个，左右箭头连点几下的用户会看到"标题是 A 日、内容是 B 日"的缝合页面。
// AbortController 与令牌叠加：令牌丢渲染，abort 真取消在途请求。
let dayReqSeq = 0, dayAbort = null;
let listReqSeq = 0, listAbort = null;
let calReqSeq = 0, calAbort = null;

// ---- 首页时钟：只展示北京时间的 时:分，纯展示、不响应点击。----
// 应用的时间基准是北京墙钟（见 core.js bjNow），系统时区不同的机器上
// 这个时钟才是和课程/复习对得上号的那个「现在」。每秒对表，分钟翻转才写 DOM。
let clockLastHM = '';
const SHORTCUTS = [
  ...['home', 'reviews', 'todos', 'ddls', 'calendar', 'settings'].map((view, i) => ({
    key: `alt+${i + 1}`, label: `Alt + ${i + 1}`, text: ['首页', '复习清单', '待办清单', '到期清单', '日历看板', '设置'][i],
    run: () => document.querySelector(`.nav-item[data-view="${view}"]`).click(),
  })),
  { key: 'ctrl+k', label: 'Ctrl + K', text: '添加事项', run: () => openModal() },
  { key: 'ctrl+enter', label: 'Ctrl + Enter', text: '提交当前表单', editing: true, run: e => {
    const form = e.target.closest('form') || document.querySelector('.modal.open form');
    if (form && !form.querySelector('button[type="submit"]:disabled')) form.requestSubmit();
  } },
  { key: 'escape', label: 'Esc', text: '关闭弹窗、侧栏详情或当前编辑', editing: true, run: e => {
    e.target.closest('.inline-task-editor')?.querySelector('button[type="button"]').click();
    closeModal(); closeLessonModal(); closeDrawer(); hideDdlPopup(); hideActionToast();
  } },
  { key: 'arrowleft', label: '←', text: '首页前一天 / 日历上一周或月', when: () => ['home', 'calendar'].includes(state.view), run: () => state.view === 'home' ? navigateHome(addDays(state.selectedDate, -1)) : shiftCalendar(-1) },
  { key: 'arrowright', label: '→', text: '首页后一天 / 日历下一周或月', when: () => ['home', 'calendar'].includes(state.view), run: () => state.view === 'home' ? navigateHome(addDays(state.selectedDate, 1)) : shiftCalendar(1) },
  { key: 't', label: 'T', text: '首页或日历回到今天', when: () => ['home', 'calendar'].includes(state.view), run: () => state.view === 'home' ? navigateHome(state.today) : document.getElementById('rangeTitle').click() },
  { key: 'w', label: 'W', text: '日历切换周课表', when: () => state.view === 'calendar', run: () => navigateCalendar('week', state.selectedDate) },
  { key: 'm', label: 'M', text: '日历切换月清单', when: () => state.view === 'calendar', run: () => navigateCalendar('month', state.selectedDate) },
  { key: 'b', label: 'B', text: '收起 / 展开侧边栏', run: () => setRail(!state.railCollapsed) },
  { key: '?', label: '?', text: '查看快捷键', run: () => {
    pendingShortcutHelp = true;
    if (state.view === 'settings') focusShortcutHelp();
    else navigateSettings();
  } },
];
function tickHomeClock() {
  const el = document.getElementById('homeClockTime');
  if (!el) return;
  const hm = bjHM();
  if (hm !== clockLastHM) {
    clockLastHM = hm;
    el.textContent = hm;
  }
}

init();

async function init() {
  bindUI();
  setRail(state.railCollapsed);   // 恢复上次的侧边栏收起态
  tickHomeClock();
  setInterval(tickHomeClock, 1000);
  try {
    const [meta, settings, coursesRes] = await Promise.all([api('/api/meta'), api('/api/settings'), api('/api/courses')]);
    state.meta = meta;
    state.settings = settings;
    state.courses = coursesRes.courses || [];
    document.getElementById('sidebarMeta').textContent = `${meta.lesson_count} 次课程 · SQLite v${meta.schema_version || 3}`;
    document.getElementById('aiStatus').textContent = settings.ai.api_key_configured ? `已配置 · ${settings.ai.model}` : '未配置 API Key · 仍可手动录入';
    fillCourseOptions();
    renderThemePresets();
    applyAppearance(settings.appearance);
    renderSettings();
    window.addEventListener('hashchange', handleRoute);
    if (!location.hash) {
      navigateHome(state.today, true);
    } else {
      handleRoute();
    }
  } catch (e) {
    toast(e.message);
  }
}

function bindUI() {
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    if (view === 'home') navigateHome(state.selectedDate);
    if (view === 'reviews') navigateList('review');
    if (view === 'todos') navigateList('todo');
    if (view === 'ddls') navigateList('ddl');
    if (view === 'calendar') navigateCalendar(state.calendarMode, state.selectedDate);
    if (view === 'settings') navigateSettings();
  }));

  ['quickAddBtn', 'calendarQuickAdd'].forEach(id => document.getElementById(id)?.addEventListener('click', () => openModal()));
  document.getElementById('toggleTrash').onclick = () => {
    const btn = document.getElementById('toggleTrash');
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    document.getElementById('trashList').classList.toggle('hidden', open);
    btn.textContent = open ? '展开' : '收起';
  };
  document.getElementById('closeModal').onclick = closeModal;
  document.getElementById('cancelTask').onclick = closeModal;
  document.getElementById('modalBackdrop').onclick = () => { closeModal(); closeLessonModal(); };
  document.getElementById('closeDrawer').onclick = closeDrawer;
  document.getElementById('drawerBackdrop').onclick = closeDrawer;
  document.getElementById('goTodayBtn').onclick = () => navigateHome(state.today);
  document.getElementById('prevDayBtn').onclick = () => navigateHome(addDays(state.selectedDate, -1));
  document.getElementById('nextDayBtn').onclick = () => navigateHome(addDays(state.selectedDate, 1));
  document.getElementById('jumpWeekBtn').onclick = () => navigateCalendar('week', state.selectedDate);
  document.getElementById('calendarBackHome').onclick = () => navigateHome(state.selectedDate);
  document.getElementById('prevRange').onclick = () => shiftCalendar(-1);
  document.getElementById('nextRange').onclick = () => shiftCalendar(1);
  document.getElementById('rangeTitle').onclick = () => {
    const d = parseISO(state.today);
    state.calendarMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    if (state.calendarMode === 'month') navigateCalendar('month', `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    else navigateCalendar('week', state.today);
  };
  document.querySelectorAll('.filter').forEach(btn => btn.onclick = () => {
    document.querySelectorAll('.filter').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    state.filter = btn.dataset.filter;
    renderCalendar();
  });
  document.querySelectorAll('.seg').forEach(btn => btn.onclick = () => {
    navigateCalendar(btn.dataset.mode, state.selectedDate);
  });
  document.getElementById('taskForm').addEventListener('submit', submitTask);
  document.getElementById('lessonForm').addEventListener('submit', submitLesson);
  // 同一个底部按钮负责展开与收起，位置保持不变。
  document.getElementById('sidebarToggle').onclick = () => setRail(!state.railCollapsed);
  document.getElementById('ddlPopupLater').onclick = () => hideDdlPopup();
  document.getElementById('ddlPopupGo').onclick = () => { hideDdlPopup(); navigateList('ddl'); };
  document.getElementById('closeLessonModal').onclick = closeLessonModal;
  document.getElementById('cancelLesson').onclick = closeLessonModal;
  document.getElementById('deleteLessonBtn').onclick = deleteLesson;
  document.querySelectorAll('.module-expand').forEach(btn => btn.onclick = () => toggleModuleCard(btn.closest('.module-card').id));
  document.getElementById('aiParseBtn').onclick = parseAI;
  document.getElementById('trashList').addEventListener('click', e => {
    const btn = e.target.closest('.restore-task');
    if (btn) restoreTask({ currentTarget: btn });
  });

  // ---- 键盘可达性（全局注册一次）----
  // ① 行级：焦点在清单行上时 Enter / Space 触发点击，等价于鼠标点整行。
  //    焦点在行内按钮/输入框上时不拦截，走浏览器默认行为。
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    const row = target.closest('.task-item[data-task-id], .task-item[data-review-id]');
    if (!row || target !== row) return;
    e.preventDefault();
    row.click();
  });
  // ② 弹窗焦点圈：Tab 在打开的 modal 内循环，键盘焦点不会漏到背景页面。
  const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]';
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const modal = document.querySelector('.modal.open');
    if (!modal) return;
    const nodes = [...modal.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const inside = modal.contains(document.activeElement);
    if (e.shiftKey && (!inside || document.activeElement === first)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
      e.preventDefault();
      first.focus();
    }
  });
  document.getElementById('appearanceForm').addEventListener('submit', saveAppearance);
  document.getElementById('reviewForm').addEventListener('submit', saveReviewSettings);
  document.getElementById('aiForm').addEventListener('submit', saveAISettings);
  document.getElementById('clearApiKeyBtn').onclick = clearApiKey;
  document.getElementById('testApiBtn').onclick = () => testAIConnection();
  bindScheduleImport();
  document.getElementById('densityInput').onclick = () => {
    const control = document.getElementById('densityInput');
    control.value = control.value === 'compact' ? 'comfortable' : 'compact';
    updateReadingControls(); liveApplyTheme();
  };
  document.getElementById('fontScaleInput').oninput = () => { updateReadingControls(); liveApplyTheme(); };
  document.getElementById('shortcutList').innerHTML = SHORTCUTS.map(s => `<div class="shortcut-row"><span>${esc(s.text)}</span><kbd>${esc(s.label)}</kbd></div>`).join('');
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.isComposing || e.repeat || e.getModifierState('AltGraph') || !state.settings) return;
    const prefix = (e.ctrlKey || e.metaKey ? 'ctrl+' : '') + (e.altKey ? 'alt+' : '');
    if (e.shiftKey && e.key !== '?') return;
    const shortcut = SHORTCUTS.find(s => s.key === prefix + e.key.toLowerCase());
    if (!shortcut || (shortcut.when && !shortcut.when())) return;
    const editing = isTextInput(e.target) || document.querySelector('.modal.open, .inline-task-editor') || document.getElementById('dayDrawer').classList.contains('open') || document.getElementById('ddlPopup').classList.contains('open');
    if (editing && !shortcut.editing) return;
    e.preventDefault(); shortcut.run(e);
  });
}

function isTextInput(target) {
  return ['INPUT','TEXTAREA','SELECT'].includes(target?.tagName) || target?.isContentEditable;
}

function focusShortcutHelp() {
  pendingShortcutHelp = false;
  const card = document.getElementById('shortcutsCard');
  card.scrollIntoView({ block: 'center' });
  card.focus({ preventScroll: true });
}

// 路由段的日期必须是合法的 YYYY-MM-DD，否则一律回落到今天/当月。
// 这样 `#/home`（缺少日期段）、手改 hash、旧书签都不会把脏值发给后端。
function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00');
  return !Number.isNaN(d.getTime()) && localISO(d) === value;
}

function handleRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  const first = parts[0] || 'home';  if (first === 'settings') {
    state.view = 'settings';
    renderViewShell();
    if (pendingShortcutHelp) focusShortcutHelp();
    return;
  }
  if (first === 'tasks') {
    return location.replace('#/todos/all');
  }
  // 三个清单页：`#/reviews`、`#/todos`、`#/ddls`，可带模式段
  // 例：#/ddls/all、#/ddls/focus/2026-09-21
  if (LIST_VIEWS[first]) {
    const kind = LIST_VIEWS[first];
    state.view = first;
    const modeRaw = parts[1] || '';
    if (modeRaw === 'all') state.listMode[kind] = 'all';
    else if (modeRaw === 'focus') {
      state.listMode[kind] = 'focus';
      state.listFocus[kind] = isISODate(parts[2]) ? parts[2] : state.today;
    } else state.listMode[kind] = 'today';
    renderViewShell();
    loadListView(kind);
    return;
  }
  if (first === 'calendar') {
    state.view = 'calendar';
    state.calendarMode = parts[1] || 'week';
    document.querySelectorAll('.seg').forEach(x => x.classList.toggle('active', x.dataset.mode === state.calendarMode));
    if (state.calendarMode === 'month') {
      const monthRaw = parts[2] || state.today.slice(0, 7);
      const [y, m] = (monthRaw || '').split('-').map(Number);
      if (!y || !m || m < 1 || m > 12) {
        const b = bjNow();
        state.calendarMonth = new Date(b.getFullYear(), b.getMonth(), 1);
      } else {
        state.calendarMonth = new Date(y, m - 1, 1);
      }
      state.selectedDate = localISO(new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth(), 1));
    } else {
      state.selectedDate = isISODate(parts[2]) ? parts[2] : state.today;
    }
    renderViewShell();
    loadCalendar();
    return;
  }
  state.view = 'home';
  // 只接受合法日期段：`#/home` 这种缺日期的写法，parts[0] 是字面量 'home'，
  // 不能拿它当日期用（会让后端收到 date=home）。不合法就回落到今天。
  state.selectedDate = isISODate(parts[1]) ? parts[1] : state.today;
  renderViewShell();
  loadDay();
}

function renderViewShell() {
  document.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x.dataset.view === state.view));
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active-view'));
  const el = document.getElementById(`${state.view}View`);
  if (el) el.classList.add('active-view');
  const trash = document.getElementById('trashCard');
  trash.hidden = !['todos', 'ddls'].includes(state.view);
  if (!trash.hidden) el.appendChild(trash);
}

function navigateHome(date, replace = false) {
  const hash = `#/home/${date}`;
  replace ? location.replace(hash) : (location.hash = hash);
}

function navigateCalendar(mode = 'week', anchor = state.selectedDate) {
  const route = mode === 'month'
    ? `#/calendar/month/${anchor.length > 7 ? anchor.slice(0,7) : anchor}`
    : `#/calendar/week/${anchor}`;
  location.hash = route;
}

function navigateSettings() { location.hash = '#/settings'; }

/** 跳到某个功能视图。mode='today' 时不写模式段，保持 URL 干净。 */
function navigateList(kind, mode, focusDate) {
  const slug = { review: 'reviews', todo: 'todos', ddl: 'ddls' }[kind];
  const m = mode || state.listMode[kind] || 'today';
  if (m === 'all') return void (location.hash = `#/${slug}/all`);
  if (m === 'focus') {
    const d = focusDate || state.listFocus[kind] || state.today;
    return void (location.hash = `#/${slug}/focus/${d}`);
  }
  location.hash = `#/${slug}`;
}

/** 侧边栏收起/展开。状态写进 localStorage，刷新后保持不变。 */
function setRail(collapsed) {
  state.railCollapsed = !!collapsed;
  document.getElementById('app').classList.toggle('rail-collapsed', state.railCollapsed);
  const toggle = document.getElementById('sidebarToggle');
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(!state.railCollapsed));
    toggle.setAttribute('aria-label', state.railCollapsed ? '展开侧边栏' : '收起侧边栏');
  }
  try { localStorage.setItem('sp_rail_collapsed', state.railCollapsed ? '1' : '0'); } catch { /* 隐私模式下忽略 */ }
}

async function refreshCurrentView() {
  if (state.view === 'home') await loadDay();
  else if (LIST_VIEWS[state.view]) await loadListView(LIST_VIEWS[state.view]);
  else if (state.view === 'calendar') await loadCalendar();
}

async function loadDay() {
  const seq = ++dayReqSeq;
  dayAbort?.abort();
  const ctrl = new AbortController();
  dayAbort = ctrl;
  setHomeLoading();
  try {
    const data = await api(`/api/day?date=${state.selectedDate}`, { signal: ctrl.signal });
    if (seq !== dayReqSeq) return;   // 期间用户又切了日期，丢弃迟到响应
    state.dayData = data;
    renderHome(data);
  } catch (e) {
    if (e?.name === 'AbortError' || seq !== dayReqSeq) return;   // 被新请求取消，静默
    toast(e.message);
  }
}

function setHomeLoading() {
  document.getElementById('lessonList').innerHTML = '<div class="loading-bar"></div><div class="loading-bar"></div>';
  document.getElementById('reviewList').innerHTML = '<div class="loading-bar"></div>';
  document.getElementById('taskList').innerHTML = '<div class="loading-bar"></div>';
  document.getElementById('upcomingList').innerHTML = '<div class="loading-bar"></div>';
  const banner = document.getElementById('ddlBanner');
  if (banner) { banner.classList.add('hidden'); banner.innerHTML = ''; }
}

/** 首页 DDL 警示：<24h 出横幅；<12h 另有右下角弹窗。 */
function renderDdlAlerts(data) {
  const alerts = data.ddl_alerts || [];
  const banner = document.getElementById('ddlBanner');
  if (!banner) return;
  if (!alerts.length) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    hideDdlPopup();
    return;
  }
  const urgent = alerts.some(a => a.alert === 'modal');
  banner.classList.remove('hidden');
  banner.classList.toggle('is-urgent', urgent);
  banner.innerHTML = `
    <div class="ddl-banner-head">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      <span>${urgent ? '有 DDL 不到 12 小时' : '有 DDL 快到 24 小时'}</span>
    </div>
    <ul class="ddl-banner-list">${alerts.map(ddlAlertLineHTML).join('')}</ul>
  `;
  banner.onclick = () => navigateList('ddl');
  // <12h：同时弹窗。同一件事（id + 截止时间）只弹一次，别反复打扰。
  const urgentOnes = alerts.filter(a => a.alert === 'modal');
  const fresh = urgentOnes.filter(a => !state.ddlPopped.has(`${a.id}@${a.due_date}`));
  if (fresh.length) {
    rememberPoppedDdl(fresh.map(a => `${a.id}@${a.due_date}`));
    showDdlPopup(fresh);
  } else if (!urgentOnes.length) {
    hideDdlPopup();
  }
}

function ddlAlertLineHTML(a) {
  const when = a.overdue ? '已过期' : a.hours_left < 1 ? '不到 1 小时' : `${Math.floor(a.hours_left)} 小时后`;
  const time = dueTime(a.due_date);
  return `<li>
    <span class="ddl-what">${esc(a.title)}</span>
    ${a.course ? `<span class="ddl-course">${esc(a.course)}</span>` : ''}
    <span class="ddl-when">${time ? esc(time) + ' · ' : ''}${esc(when)}</span>
  </li>`;
}

function showDdlPopup(alerts) {
  const popup = document.getElementById('ddlPopup');
  if (!popup) return;
  document.getElementById('ddlPopupTitle').textContent = `有 ${alerts.length} 个 DDL 快到 12 小时`;
  document.getElementById('ddlPopupList').innerHTML = alerts.map(ddlAlertLineHTML).join('');
  popup.classList.add('open');
  popup.setAttribute('aria-hidden', 'false');
}

function hideDdlPopup() {
  const popup = document.getElementById('ddlPopup');
  if (!popup) return;
  popup.classList.remove('open');
  popup.setAttribute('aria-hidden', 'true');
}

function renderHome(data) {
  const d = parseISO(data.date);
  document.getElementById('homeTitle').textContent = `${d.getMonth() + 1}月${d.getDate()}日`;
  document.getElementById('homeSub').textContent = `${data.week ? `第 ${data.week} 周 · ` : ''}${weekdayCN(d)}`;
  const pendingReviews = data.reviews.filter(x => x.status === 'pending');
  const doneReviews = data.reviews.filter(x => x.status !== 'pending');
  const pendingTasks = data.tasks.filter(x => x.status === 'pending');
  const doneTasks = data.tasks.filter(x => x.status !== 'pending');
  document.getElementById('numLessons').textContent = data.lessons.length;
  document.getElementById('footLessons').textContent = data.missing_topic_count ? `${data.missing_topic_count} 节未填主题` : '主题已补齐';
  document.getElementById('numReviews').textContent = pendingReviews.length;
  document.getElementById('footReviews').textContent = doneReviews.length ? `已完成 ${doneReviews.length} 项` : '今天无复习压力';
  document.getElementById('numTasks').textContent = pendingTasks.length;
  document.getElementById('footTasks').textContent = doneTasks.length ? `已完成 ${doneTasks.length} 项` : '今天很轻';
  document.getElementById('numUpcoming').textContent = data.upcoming?.length || 0;
  document.getElementById('footUpcoming').textContent = (data.upcoming?.length || 0) ? '近期硬截止' : '近期没有硬截止';
  document.getElementById('lessonList').innerHTML = data.lessons.length ? data.lessons.map(lessonHTML).join('') : emptyHTML('这一天没有课程。');
  document.getElementById('reviewList').innerHTML = data.reviews.length ? data.reviews.map(reviewHTML).join('') : emptyHTML('这一天没有到期复习。');
  document.getElementById('taskList').innerHTML = data.tasks.length ? data.tasks.map(taskHTML).join('') : emptyHTML('这一天没有额外 To-do。');
  renderUpcoming(data.upcoming);
  renderDdlAlerts(data);
  updateModuleCollapse();
  bindHomeActions();
  if (state.flashTaskId) {
    const item = document.querySelector(`[data-task-id="${state.flashTaskId}"]`);
    if (item) {
      item.classList.add('just-added');
      setTimeout(() => item.classList.remove('just-added'), 1200);
    }
    state.flashTaskId = null;
  }
}

// 首页四张卡的「查看全部」去向。
//   课程：本卡就地展开（课程没有独立页面）
//   复习 / 待办 / 到期：跳到各自的功能视图——那才是「全量」的正确容器，
//   就地展开只能看到今天这一天的更多条目，不是用户点「全部」时想要的东西。
const MODULE_TARGETS = {
  lessonsPanel: { expand: true },
  reviewsPanel: { kind: 'review' },
  tasksPanel: { kind: 'todo' },
  upcomingPanel: { kind: 'ddl' },
};

function updateModuleCollapse() {
  [['lessonsPanel', 'lessonList'], ['reviewsPanel', 'reviewList'], ['tasksPanel', 'taskList'], ['upcomingPanel', 'upcomingList']].forEach(([panelId, listId]) => {
    const card = document.getElementById(panelId);
    const list = document.getElementById(listId);
    const hasMore = list.scrollHeight > list.clientHeight + 4;
    card.classList.toggle('has-more', hasMore);
    const btn = card.querySelector('.module-expand');
    btn.style.display = list.querySelector('.empty') ? 'none' : '';
    if (!hasMore && !card.classList.contains('expanded')) btn.textContent = '查看全部';
  });
}

function toggleModuleCard(id) {
  const target = MODULE_TARGETS[id];
  // 跳转型：直接去清单页，并且进去就是「仅今日」态
  if (target?.kind) {
    state.listMode[target.kind] = 'today';
    return navigateList(target.kind, 'today');
  }
  const grid = document.getElementById('dashGrid');
  const card = document.getElementById(id);
  const wasExpanded = card.classList.contains('expanded');
  grid.querySelectorAll('.module-card.expanded').forEach(c => {
    c.classList.remove('expanded');
    c.querySelector('.module-expand').textContent = '查看全部';
  });
  if (!wasExpanded) {
    card.classList.add('expanded');
    card.querySelector('.module-expand').textContent = '收起';
  }
  grid.classList.toggle('has-expanded', !wasExpanded);
  updateModuleCollapse();
}

function lessonHTML(x) {
  const topic = (x.topic || '').trim();
  const meta = [x.teacher, x.location].filter(Boolean).map(esc).map(v => `<span>${v}</span>`).join('');
  return `<article class="lesson-card ${topic ? 'has-topic' : 'missing-topic'}" data-lesson-id="${x.id}">
    <div class="lesson-time"><strong>${esc(x.section_label)}</strong><span>第 ${x.week} 周</span></div>
    <div class="lesson-body">
      <div class="lesson-title">${esc(x.course)}</div>
      <div class="lesson-meta">${meta}</div>
      ${topic
        ? `<div class="topic-ready"><div class="topic-copy"><span>本节主题${x.lesson_code ? ` · ${esc(x.lesson_code)}` : ''}</span><strong>${esc(topic)}</strong></div><button class="edit-topic">修改</button></div>`
        : `<div class="topic-prompt-row"><div><span>本节主题</span><strong>补上后会自动生成复习链</strong></div><button class="topic-toggle">填写主题</button></div>`}
      <div class="topic-editor" aria-hidden="true">${topicInputs(x)}</div>
    </div>
  </article>`;
}

function topicInputs(x) {
  return `<input class="topic-input" placeholder="例如：疫苗与免疫预防" value="${esc(x.topic || '')}" />
          <input class="code-input" placeholder="课程编号（可选）" value="${esc(x.lesson_code || '')}" />
          <button class="save-topic">保存</button>`;
}

function reviewHTML(x) {
  const done = x.status === 'completed';
  // 同一天同课程可能有两个班次（如 6-7节 / 8-8节）各自生成复习链，
  // 只显示「主题 + 来自日期」会看起来像重复项 —— 补节次区分。
  const sec = x.start_section ? ` · ${x.start_section}-${x.end_section}节` : '';
  return `<div class="task-item review-item ${done ? 'is-done' : ''}" data-review-id="${x.id}" tabindex="0">
    <button class="check-btn toggle-review" aria-label="${done ? '撤销完成' : '完成复习'}">${checkSVG()}</button>
    <div class="task-body">
      <div class="task-title">${esc(x.topic)}</div>
      <div class="task-sub"><span>${esc(x.course)}</span><span>R${x.stage}</span><span>来自 ${dateLabel(x.lesson_date)}${sec}</span></div>
    </div>
    <div class="task-actions"><span class="stage-tag">R${x.stage}</span></div>
  </div>`;
}

function taskHTML(x) {
  const done = x.status === 'completed';
  const klass = x.type === 'ddl' ? 'ddl' : x.type === 'assignment' ? 'assignment' : '';
  const label = { task: 'TASK', assignment: '作业', ddl: 'DDL', other: '其他' }[x.type] || 'TASK';
  const sub = [x.course, x.due_date ? `截止 ${dueLabel(x.due_date)}` : '', x.planned_date ? `计划 ${dateLabel(x.planned_date)}` : (!x.due_date ? '未安排日期' : '')]
    .filter(Boolean).map(esc).map(v => `<span>${v}</span>`).join('');
  // 临期的 DDL 在看板上也要有颜色提示，不能只靠弹窗
  const alert = x.type === 'ddl' ? ddlAlertOf(x) : '';
  const itemCls = ['task-item', 'task-user', done ? 'is-done' : '', alert ? `alert-${alert}` : ''].filter(Boolean).join(' ');
  return `<div class="${itemCls}" data-task-id="${x.id}" tabindex="0">
    <button class="check-btn toggle-task" aria-label="${done ? '撤销完成' : '完成任务'}">${checkSVG()}</button>
    <div class="task-body">
      <div class="task-title">${esc(x.title)}</div>
      <div class="task-sub">${sub}</div>
    </div>
    <div class="task-actions">
      <span class="type-tag ${klass}">${label}</span>
      ${done ? '' : `<button class="delete-task icon-mini" aria-label="删除任务">${trashSVG()}</button>`}
    </div>
  </div>`;
}

/** 本地判断一个 DDL 的临近等级，用于列表着色（首页横幅由后端数据驱动）。 */
function ddlAlertOf(x) {
  const target = parseDue(x.due_date);
  if (!target) return '';
  // parseDue 返回「本地字段 = 北京墙上时间」的 Date（due 是北京语义），
  // 必须和 bjNow（本地字段同样是北京墙上时间）相减才是正确的小时差；
  // 用系统本地 new Date() 会在非北京时区的机器上偏差一整天。
  const hours = (target - bjNow()) / 3600000;
  if (hours <= 12) return 'modal';
  if (hours <= 24) return 'banner';
  return '';
}

function renderUpcoming(items) {
  document.getElementById('upcomingList').innerHTML = items?.length
    ? items.map(x => `<div class="upcoming-item"><div class="upcoming-date"><strong>${parseISO(dueDay(x.due_date)).getDate()}</strong><span>${dueTime(x.due_date) || `${parseISO(dueDay(x.due_date)).getMonth()+1}月`}</span></div><div class="upcoming-copy"><strong>${esc(x.title)}</strong><span>${esc(x.course || '未关联课程')} · ${esc(dueLabel(x.due_date))}</span></div></div>`).join('')
    : '<div class="empty"><span>近期没有到期任务。</span></div>';
}

function emptyHTML(text) { return `<div class="empty"><span>${esc(text)}</span></div>`; }

// 表单错误就地显示：写在表单内部的错误条里，而不是 toast。
// toast 一闪就没了，表单还开着，用户得凭记忆猜哪里错了。
function showFormError(id, message) {
  const box = document.getElementById(id);
  if (!box) { toast(message); return; }
  box.textContent = message;
  box.hidden = false;
}
function clearFormError(id) {
  const box = document.getElementById(id);
  if (box) { box.hidden = true; box.textContent = ''; }
}

function renderTrash() {
  const items = state.trashList || [];
  const card = document.getElementById('trashCard');
  const list = document.getElementById('trashList');
  const btn = document.getElementById('toggleTrash');
  card.classList.toggle('empty-trash', !items.length);
  btn.textContent = btn.getAttribute('aria-expanded') === 'true' ? '收起' : '展开';
  if (!items.length) {
    list.innerHTML = emptyHTML('回收站是空的。');
    return;
  }
  list.innerHTML = items.map(t => {
    const bits = [t.course, t.planned_date ? `计划 ${dateLabel(t.planned_date)}` : '', t.due_date ? `截止 ${dueLabel(t.due_date)}` : '']
      .filter(Boolean).map(esc).map(v => `<span>${v}</span>`).join('');
    return `<div class="task-item task-user is-trash" data-task-id="${t.id}">
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        <div class="task-sub">${bits || '<span>无日期</span>'}</div>
      </div>
      <div class="task-actions"><button class="secondary-btn restore-task">恢复</button></div>
    </div>`;
  }).join('');
}

async function restoreTask(e) {
  const btn = e.currentTarget;
  const item = btn.closest('.task-item');
  const id = item.dataset.taskId;
  if (btn.disabled) return;   // 防重复点击
  btn.disabled = true;
  try {
    await api(`/api/tasks/${id}/restore`, { method: 'POST', body: '{}' });
    hideActionToast();
    toast('任务已恢复');
    await refreshCurrentView();
  } catch (err) { toast(err.message); btn.disabled = false; }
}

// ============================================================
// 三个功能视图：复习清单 / 待办清单 / 到期清单
// ------------------------------------------------------------
// 页面默认「仅今日」——从首页「查看全部」跳进来时最关心的是今天。
// 「全部事项」按日期铺开，一天一个区域，今天的区域由后端排在最前。
// 「聚焦 年/月/日」是导航，不是筛选：跳到那天，哪怕那天什么都没有。
// ============================================================

function listContainer(kind) {
  const view = document.querySelector(`[data-list-view="${kind}"]`);
  if (!view) return null;
  return {
    view,
    actions: view.querySelector('[data-list-actions]'),
    toolbar: view.querySelector('[data-list-toolbar]'),
    groups: view.querySelector('[data-list-groups]'),
  };
}

async function loadListView(kind) {
  const ui = listContainer(kind);
  if (!ui) return;
  setListLoading(ui);
  const mode = state.listMode[kind] || 'today';
  const focus = state.listFocus[kind] || state.today;
  let url = `/api/lists?view=${kind}&mode=${mode}`;
  if (mode === 'focus') url += `&date=${focus}`;
  const seq = ++listReqSeq;
  listAbort?.abort();
  const ctrl = new AbortController();
  listAbort = ctrl;
  try {
    const [data, trash] = await Promise.all([
      api(url, { signal: ctrl.signal }),
      kind === 'review' ? Promise.resolve(null) : api('/api/tasks/trash', { signal: ctrl.signal }),
    ]);
    // 迟到的响应：期间视图已切走或又发起了新的加载，丢弃
    if (seq !== listReqSeq || LIST_VIEWS[state.view] !== kind) return;
    state.listData[kind] = data;
    renderListView(kind, data);
    if (trash) { state.trashList = trash.tasks || []; renderTrash(); }
  } catch (e) {
    if (e?.name === 'AbortError' || seq !== listReqSeq) return;
    ui.groups.innerHTML = emptyHTML(`读不到清单：${e.message}`);
    toast(e.message);
  }
}

function setListLoading(ui) {
  ui.groups.innerHTML = '<div class="loading-bar"></div><div class="loading-bar"></div><div class="loading-bar"></div>';
}

function renderListView(kind, data) {
  const ui = listContainer(kind);
  if (!ui) return;
  const meta = LIST_META[kind];
  if (kind !== 'review') {
    ui.actions.innerHTML = '<button class="primary-btn list-add-task">＋ 添加事项</button>';
    ui.actions.querySelector('button').onclick = () => openModal();
  }
  ui.view.querySelector('h1').textContent = data.title || meta.title;
  const eyeline = ui.view.querySelector('.eyeline');
  if (eyeline) eyeline.textContent = data.kicker || '清单';
  renderListToolbar(kind, ui, data);
  ui.groups.innerHTML = data.groups?.length
    ? data.groups.map((g, i) => dayRegionHTML(kind, g, i === data.groups.length - 1)).join('')
    : emptyHTML('这里还没有内容。');
  bindListDelegation(kind, ui);
}

function renderListToolbar(kind, ui, data) {
  const mode = data.mode || 'today';
  const focus = data.focus_date || state.today;
  ui.toolbar.innerHTML = `
    <div class="segmented" id="${kind}ModeSwitch">
      <button class="seg ${mode === 'today' ? 'active' : ''}" data-mode="today">仅今日</button>
      <button class="seg ${mode === 'all' ? 'active' : ''}" data-mode="all">全部事项</button>
    </div>
    <button class="ghost-btn" id="${kind}FocusToday">聚焦今天</button>
    <div class="focus-box">
      <label for="${kind}FocusYear">聚焦</label>
      <input class="focus-year" id="${kind}FocusYear" inputmode="numeric" maxlength="4" placeholder="年" value="${mode === 'focus' ? focus.slice(0, 4) : ''}" />
      <span class="focus-sep">/</span>
      <input id="${kind}FocusMonth" inputmode="numeric" maxlength="2" placeholder="月" value="${mode === 'focus' ? String(Number(focus.slice(5, 7))) : ''}" />
      <span class="focus-sep">/</span>
      <input id="${kind}FocusDay" inputmode="numeric" maxlength="2" placeholder="日" value="${mode === 'focus' ? String(Number(focus.slice(8, 10))) : ''}" />
      <button class="secondary-btn" id="${kind}FocusGo">跳转</button>
    </div>
    <span class="list-toolbar-hint">${listToolbarHint(data)}</span>
  `;

  ui.toolbar.querySelectorAll('.seg').forEach(btn => btn.onclick = () => {
    state.listMode[kind] = btn.dataset.mode;
    navigateList(kind, btn.dataset.mode);
  });
  ui.toolbar.querySelector(`#${kind}FocusToday`).onclick = () => {
    state.listFocus[kind] = state.today;
    navigateList(kind, 'focus', state.today);
  };
  const go = () => applyFocusInput(kind);
  ui.toolbar.querySelector(`#${kind}FocusGo`).onclick = go;
  ['Year', 'Month', 'Day'].forEach(part => {
    const input = ui.toolbar.querySelector(`#${kind}Focus${part}`);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    // 只留数字，避免中文/字母混进去让 Date 解析出 NaN
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); });
  });
}

function listToolbarHint(data) {
  if (data.mode === 'today') return '只看今天 · 想看历史或未来点「全部事项」';
  if (data.mode === 'focus') return `聚焦 ${data.focus_date || ''}`;
  const total = (data.groups || []).reduce(
    (n, g) => n + g.sections.reduce((m, s) => m + s.items.length, 0), 0, );
  return `${(data.groups || []).length} 天 · ${total} 项 · 今天排在最前`;
}

/** 把 年/月/日 三个输入框拼成日期。不合法就提示并保持原样，不跳。 */
function applyFocusInput(kind) {
  const ui = listContainer(kind);
  const y = ui.toolbar.querySelector(`#${kind}FocusYear`).value.trim();
  const m = ui.toolbar.querySelector(`#${kind}FocusMonth`).value.trim();
  const d = ui.toolbar.querySelector(`#${kind}FocusDay`).value.trim();
  if (!y || !m || !d) return toast('请把年、月、日都填上');
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // 用 isISODate 反查：它能挡住 2026-02-30 这种「格式对但不存在」的日期
  if (!isISODate(iso)) return toast(`${y}/${m}/${d} 不是一个真实日期`);
  state.listFocus[kind] = iso;
  navigateList(kind, 'focus', iso);
}

function dayRegionHTML(kind, group, isLast) {
  const total = group.sections.reduce((n, s) => n + s.items.length, 0);
  const cls = ['day-region', group.is_today ? 'is-today' : '', group.is_past ? 'is-past' : ''].filter(Boolean).join(' ');
  const count = kind === 'ddl' ? `${total} 项到期` : `${total} 项`;
  const body = group.sections.length
    ? group.sections.map(s => sectionHTML(kind, s)).join('')
    : `<div class="section-empty">这一天没有内容。</div>`;
  return `<section class="${cls}" data-date="${group.date}">
    <div class="day-region-head">
      <strong>${esc(group.label)}</strong>
      <span class="day-region-weekday">${esc(group.weekday)}${group.is_today ? ' · 今天' : ''}</span>
      <span class="day-region-count">${count}</span>
    </div>
    <div class="day-region-body">${body}</div>
  </section>${isLast ? '' : '<div class="region-divider"></div>'}`;
}

function sectionHTML(kind, section) {
  const items = section.items || [];
  const inner = items.length
    ? `<div class="section-items">${items.map(it => listItemHTML(kind, it)).join('')}</div>`
    : `<div class="section-empty">${kind === 'ddl' ? '这一天没有到期项。' : '这一段是空的。'}</div>`;
  return `<div class="section-block"><div class="section-head">${esc(section.label)}<span>${items.length}</span></div>${inner}</div>`;
}

function listItemHTML(kind, x) {
  if (kind === 'ddl') return ddlItemHTML(x);
  if (kind === 'review') return reviewHTML(x);
  return taskItemForListHTML(x);
}

/** 待办清单里的任务行：比看板多一个删除按钮的克制版（不显示类型标签占位） */
function taskItemForListHTML(x) {
  const done = x.status === 'completed';
  const bits = taskSubBits(x);
  return `<div class="task-item task-user ${done ? 'is-done' : ''}" data-task-id="${x.id}" tabindex="0">
    <button class="check-btn toggle-task" aria-label="${done ? '撤销完成' : '完成任务'}">${checkSVG()}</button>
    <div class="task-body">
      <div class="task-title">${esc(x.title)}</div>
      <div class="task-sub">${bits}</div>
    </div>
    <div class="task-actions">
      <button class="edit-task icon-mini" aria-label="编辑任务 / 调整 DDL" title="编辑 / 调整 DDL">${pencilSVG()}</button>
      ${done ? '' : `<button class="delete-task icon-mini" aria-label="删除任务">${trashSVG()}</button>`}
    </div>
  </div>`;
}

/** DDL 行：没有勾选框——DDL 只是提醒，任务完成了它自己就取消。 */
function ddlItemHTML(x) {
  const time = dueTime(x.due_date);
  const alert = x.alert || '';
  const klass = ['task-item', 'task-user', 'ddl-item', alert ? `alert-${alert}` : '', x.overdue ? 'is-overdue' : ''].filter(Boolean).join(' ');
  const badge = x.overdue
    ? '<span class="ddl-badge modal">已过期</span>'
    : alert === 'modal' ? '<span class="ddl-badge modal">12 小时内</span>'
    : alert === 'banner' ? '<span class="ddl-badge banner">24 小时内</span>'
    : '<span class="ddl-badge">待处理</span>';
  const clock = time ? `<span class="ddl-clock">${esc(time)}</span>` : '<span class="ddl-clock">当天结束前</span>';
  return `<div class="${klass}" data-task-id="${x.id}" tabindex="0">
    <div class="task-body">
      <div class="task-title">${esc(x.title)}</div>
      <div class="task-sub">${clock}${taskSubBits(x, { skipDue: true })}</div>
    </div>
    <div class="task-actions">
      ${badge}
      <button class="edit-task icon-mini" aria-label="调整 DDL" title="调整 DDL">${pencilSVG()}</button>
      <button class="delete-task icon-mini" aria-label="删除任务">${trashSVG()}</button>
    </div>
  </div>`;
}

function taskSubBits(x, opts = {}) {
  const bits = [x.course];
  if (!opts.skipDue && x.due_date) bits.push(`截止 ${dueLabel(x.due_date)}`);
  if (x.planned_date) bits.push(`计划 ${dateLabel(x.planned_date)}`);
  return bits.filter(Boolean).map(esc).map(v => `<span>${v}</span>`).join('');
}

/** 截止时间的短标签：有时刻就带上，方便区分同一天的两件事 */
function dueLabel(due) {
  const day = dueDay(due);
  const time = dueTime(due);
  return time ? `${dateLabel(day)} ${time}` : dateLabel(day);
}

// 事件委托：三个清单页都绑在各自容器上，重渲染不会丢事件
function bindListDelegation(kind, ui) {
  if (ui.groups.dataset.bound === '1') return;
  ui.groups.dataset.bound = '1';
  ui.groups.addEventListener('click', e => {
    const item = e.target.closest('.task-item');
    if (!item) return;
    if (e.target.closest('.toggle-review')) return toggleReview({ currentTarget: e.target.closest('.toggle-review') });
    const id = item.dataset.taskId;
    if (!id) return;
    if (e.target.closest('.toggle-task')) return toggleTask({ currentTarget: e.target.closest('.toggle-task') });
    if (e.target.closest('.delete-task')) return deleteTask({ currentTarget: e.target.closest('.delete-task') });
    const edit = e.target.closest('.edit-task');
    if (e.target.closest('button') && !edit) return;
    if (e.target.closest('.inline-task-editor')) return;
    // 点整行打开编辑（DDL 行也一样，方便改时间）
    const pool = (state.listData[kind]?.groups || []).flatMap(g => g.sections.flatMap(s => s.items));
    const found = pool.find(t => String(t.id) === id);
    if (found) openModalForList(kind, found, item);
  });
}

function openModalForList(kind, item, row) {
  if (kind === 'review') return;      // 复习项不进任务弹窗，勾选就够了
  if (row.querySelector('.inline-task-editor')) return;
  const form = document.createElement('form');
  form.className = 'inline-task-editor task-form';
  const courses = [...new Set([...state.courses, item.course].filter(Boolean))];
  form.innerHTML = `
    <label class="field full">任务<input name="title" required maxlength="180" value="${esc(item.title)}" /></label>
    <label class="field">计划执行<input type="date" name="planned_date" value="${esc(item.planned_date)}" /></label>
    <label class="field">截止时间<input type="datetime-local" name="due_date" value="${esc(item.due_date)}" /></label>
    <label class="field">课程<select name="course"><option value="">不关联课程</option>${courses.map(c => `<option ${c === item.course ? 'selected' : ''} value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label>
    <label class="field">类型<select name="type">${Object.entries({ task: '任务', assignment: '作业', ddl: 'DDL', other: '其他' }).map(([k,v]) => `<option value="${k}" ${k === item.type ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="field full">备注<textarea name="notes" rows="4" maxlength="2000">${esc(item.notes)}</textarea></label>
    <div class="form-error" hidden role="alert"></div>
    <div class="form-actions"><button type="button" class="ghost-btn">取消</button><button class="primary-btn" type="submit">保存修改</button></div>`;
  row.appendChild(form);
  form.querySelector('[name="title"]').focus();
  form.querySelector('button[type="button"]').onclick = () => form.remove();
  form.onsubmit = async e => {
    e.preventDefault();
    const controls = [...form.querySelectorAll('button')];
    controls.forEach(x => x.disabled = true);
    try {
      await api(`/api/tasks/${item.id}/update`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      toast('修改已保存');
      await refreshCurrentView();
    } catch (err) { const error = form.querySelector('.form-error'); error.textContent = err.message; error.hidden = false; }
    finally { controls.forEach(x => x.disabled = false); }
  };
}

// 事件委托：绑在容器上，任何一次重渲染都不会丢事件
function bindHomeActions() {
  document.querySelectorAll('.save-topic').forEach(btn => btn.onclick = saveTopic);
  document.querySelectorAll('.topic-toggle, .edit-topic').forEach(btn => btn.onclick = e => {
    const card = e.currentTarget.closest('.lesson-card');
    card.classList.add('editing');
    card.querySelector('.topic-editor').setAttribute('aria-hidden', 'false');
    setTimeout(() => card.querySelector('.topic-input')?.focus(), 100);
  });
  document.querySelectorAll('#homeView .toggle-review').forEach(btn => btn.onclick = toggleReview);
  document.querySelectorAll('#homeView .toggle-task').forEach(btn => btn.onclick = toggleTask);
  document.querySelectorAll('#homeView .delete-task').forEach(btn => btn.onclick = deleteTask);
}

async function saveTopic(e) {
  // await 之后 e.currentTarget 会失效，先取引用
  const btn = e.currentTarget;
  const card = btn.closest('.lesson-card');
  const id = card.dataset.lessonId;
  const topic = card.querySelector('.topic-input').value.trim();
  const lesson_code = card.querySelector('.code-input').value.trim();
  btn.disabled = true;
  try {
    const result = await api(`/api/lessons/${id}/topic`, { method: 'POST', body: JSON.stringify({ topic, lesson_code, material_ref: '' }) });
    toast(topic ? `主题已保存，已生成 ${result.review_count || 5} 次复习` : '主题已清空');
    await loadDay();
  } catch (err) { toast(err.message); }
  finally { btn.disabled = false; }
}

async function toggleReview(e) {
  const item = e.currentTarget.closest('.task-item');
  // 防双击：请求在途（动画进行中）时忽略后续点击。
  // 否则两次 toggle 相互抵消，用户看到的是"点了没反应"。
  if (item.classList.contains('is-completing') || item.classList.contains('is-removing')) return;
  const id = item.dataset.reviewId;
  const wasDone = item.classList.contains('is-done');
  item.classList.add('is-completing');
  try {
    if (wasDone) {
      await api(`/api/reviews/${id}/undo`, { method: 'POST', body: '{}' });
      toast('已撤销完成');
    } else {
      await api(`/api/reviews/${id}/complete`, { method: 'POST', body: JSON.stringify({ completed_date: state.selectedDate }) });
      showActionToast('复习已完成', '撤销', async () => { await api(`/api/reviews/${id}/undo`, { method: 'POST', body: '{}' }); await refreshCurrentView(); });
    }
    await refreshCurrentView();
  } catch (err) { toast(err.message); item.classList.remove('is-completing'); }
}

async function toggleTask(e) {
  const item = e.currentTarget.closest('.task-item');
  // 同 toggleReview：防双击导致两次状态翻转相互抵消
  if (item.classList.contains('is-completing') || item.classList.contains('is-removing')) return;
  const id = item.dataset.taskId;
  const wasDone = item.classList.contains('is-done');
  item.classList.add('is-completing');
  try {
    await api(`/api/tasks/${id}/status`, { method: 'POST', body: JSON.stringify({ status: wasDone ? 'pending' : 'completed' }) });
    if (!wasDone) showActionToast('任务已完成', '撤销', async () => { await api(`/api/tasks/${id}/status`, { method: 'POST', body: JSON.stringify({ status: 'pending' }) }); await refreshCurrentView(); });
    await refreshCurrentView();
  } catch (err) { toast(err.message); item.classList.remove('is-completing'); }
}

async function deleteTask(e) {
  const item = e.currentTarget.closest('.task-item');
  const id = item.dataset.taskId;
  item.classList.add('is-removing');
  try {
    await api(`/api/tasks/${id}/status`, { method: 'POST', body: JSON.stringify({ status: 'deleted' }) });
    showActionToast('任务已删除', '撤销', async () => { await api(`/api/tasks/${id}/status`, { method: 'POST', body: JSON.stringify({ status: 'pending' }) }); await refreshCurrentView(); });
    await refreshCurrentView();
  } catch (err) { toast(err.message); item.classList.remove('is-removing'); }
}

async function loadCalendar() {
  const seq = ++calReqSeq;
  calAbort?.abort();
  const ctrl = new AbortController();
  calAbort = ctrl;
  try {
    let start, end;
    if (state.calendarMode === 'month') {
      const first = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth(), 1);
      const day = first.getDay() || 7;
      first.setDate(first.getDate() - (day - 1));
      const last = new Date(first); last.setDate(first.getDate() + 41);
      start = localISO(first); end = localISO(last);
      document.getElementById('calendarTitle').textContent = monthTitle(state.calendarMonth);
      document.getElementById('rangeTitle').textContent = monthTitle(state.calendarMonth);
    } else {
      const monday = startOfWeek(state.selectedDate);
      start = monday; end = addDays(monday, 6);
      document.getElementById('calendarTitle').textContent = `${longDateLabel(start)} → ${longDateLabel(end)}`;
      document.getElementById('rangeTitle').textContent = `${dateLabel(start)} – ${dateLabel(end)}`;
    }
    const data = await api(`/api/calendar?start=${start}&end=${end}`, { signal: ctrl.signal });
    if (seq !== calReqSeq) return;   // 期间已切走或重新加载，丢弃迟到响应
    state.calData = data;
    renderCalendar();
  } catch (e) {
    if (e?.name === 'AbortError' || seq !== calReqSeq) return;
    toast(e.message);
  }
}

function renderCalendar() {
  document.getElementById('calendarFilters').hidden = state.calendarMode === 'week';
  document.getElementById('monthBoard').classList.toggle('active-board', state.calendarMode === 'month');
  document.getElementById('weekBoard').classList.toggle('active-board', state.calendarMode === 'week');
  if (state.calendarMode === 'month') renderMonthBoard(); else renderWeekBoard();
}

function renderMonthBoard() {
  const grid = document.getElementById('calendarGrid');
  const first = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth(), 1);
  const day = first.getDay() || 7;
  first.setDate(first.getDate() - (day - 1));
  const events = aggregateEvents(state.calData, state.filter);
  const lamps = aggregateLamps(state.calData);
  // 行数按当月实际跨度计算：4-6 行，避免固定的第 6 行整行空白
  const year = state.calendarMonth.getFullYear();
  const month = state.calendarMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows = Math.ceil((day - 1 + daysInMonth) / 7);
  const total = rows * 7;
  grid.style.gridTemplateRows = `repeat(${rows}, minmax(122px, 1fr))`;
  let html = '';
  for (let i = 0; i < total; i++) {
    const d = new Date(first); d.setDate(first.getDate() + i);
    const iso = localISO(d);
    const items = events[iso] || [];
    const sameMonth = d.getMonth() === month;
    html += `<button class="day-cell ${sameMonth ? '' : 'other-month'} ${iso === state.today ? 'today' : ''}" data-date="${iso}">
      <div class="day-top"><span class="day-number">${d.getDate()}</span><span class="day-lamps">${lampsHTML(lamps[iso])}</span></div>
      <div class="event-list">${items.slice(0,3).map(calEventHTML).join('')}${items.length > 3 ? `<div class="more-events">+${items.length - 3} 项</div>` : ''}</div>
    </button>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.day-cell').forEach(btn => btn.onclick = () => openDrawer(btn.dataset.date));
}

function lampsHTML(l) {
  const r = l?.review || 0, t = l?.todo || 0, dd = l?.ddl || 0;
  const tip = `复习 ${r} · 待办 ${t} · 截止 ${dd}`;
  return `<span class="lamp review ${r ? '' : 'off'}" title="${tip}"></span><span class="lamp todo ${t ? '' : 'off'}" title="${tip}"></span><span class="lamp ddl ${dd ? '' : 'off'}" title="${tip}"></span>`;
}

function aggregateLamps(data) {
  const map = {};
  const bucket = d => (map[d] = map[d] || { review: 0, todo: 0, ddl: 0 });
  data.reviews.forEach(x => bucket(x.due_date).review++);
  data.tasks.forEach(x => {
    if (x.planned_date) bucket(x.planned_date).todo++;
    const day = dueDay(x.due_date);
    if (day) bucket(day).ddl++;
  });
  return map;
}

function aggregateEvents(data, filter) {
  const map = {};
  const push = (date, item) => {
    if (!date) return;
    if (!map[date]) map[date] = [];
    map[date].push(item);
  };
  if (filter === 'all' || filter === 'review') data.reviews.forEach(x => push(x.due_date, { type: 'review', label: `R${x.stage} ${x.topic}` }));
  if (filter === 'all' || filter === 'task') data.tasks.forEach(x => { if (x.planned_date) push(x.planned_date, { type: 'task', label: `计划 · ${x.title}` }); });
  // 截止时间细化到分钟后，日历格子的归属要用日期部分，否则整天都可能空掉
  if (filter === 'all' || filter === 'ddl') data.tasks.forEach(x => {
    const day = dueDay(x.due_date);
    if (day) push(day, { type: 'ddl', label: `截止${dueTime(x.due_date) ? ' ' + dueTime(x.due_date) : ''} · ${x.title}` });
  });
  const priority = { ddl: 0, review: 1, task: 2 };
  Object.values(map).forEach(items => items.sort((a, b) => priority[a.type] - priority[b.type]));
  return map;
}

function calEventHTML(item) {
  return `<div class="cal-event ${item.type}"><span class="dot"></span><span>${esc(item.label)}</span></div>`;
}

function renderWeekBoard() {
  const monday = startOfWeek(state.selectedDate);
  const days = Array.from({length:7}, (_,i)=> addDays(monday, i));

  const grid = document.getElementById('weekGrid');
  // 表头与表体共用同一个 grid：时间列才能真正固定在首列
  let header = `<div class="week-corner" style="grid-row:1;grid-column:1">节序</div>`;
  header += days.map((d, i) => {
    const dd = parseISO(d);
    const cls = [d === state.selectedDate ? 'is-selected' : '', d === state.today ? 'is-today' : ''].filter(Boolean).join(' ');
    return `<button class="week-day-title ${cls}" style="grid-row:1;grid-column:${i + 2}" data-date="${d}">${weekdayCN(dd)}<small>${dd.getMonth()+1}/${dd.getDate()}</small></button>`;
  }).join('');
  let base = header;
  SECTION_ORDER.forEach(section => {
    // 显式定位每个格子的行列，避免自动布局在 sticky 列上产生空洞
    const row = section + 1;
    base += `<div class="week-time-cell" style="grid-row:${row};grid-column:1"><strong>${section}节</strong><span>${state.settings?.section_times?.[section] || ''}</span></div>`;
    for (let d = 0; d < 7; d++) {
      base += `<div class="week-slot" style="grid-row:${row};grid-column:${d + 2}" data-date="${days[d]}" data-section="${section}" title="点击添加课程"></div>`;
    }
  });
  grid.innerHTML = base;
  grid.querySelectorAll('.week-day-title').forEach(btn => btn.onclick = () => navigateHome(btn.dataset.date));
  grid.querySelectorAll('.week-slot').forEach(slot => slot.onclick = () => openLessonModal({
    mode: 'create',
    date: slot.dataset.date,
    section: Number(slot.dataset.section),
  }));
  const lessons = (state.calData.lessons || []).filter(x => x.lesson_date >= monday && x.lesson_date <= addDays(monday, 6));
  lessons.forEach(lesson => {
    const col = days.indexOf(lesson.lesson_date) + 2;
    if (col < 2) return;
    const colors = pickCoursePalette(lesson.course);
    const block = document.createElement('button');
    block.className = 'week-event';
    block.style.gridColumn = `${col}`;
    // 第 1 行是表头，课程从第 2 行起
    block.style.gridRow = `${lesson.start_section + 1} / ${lesson.end_section + 2}`;
    block.style.setProperty('--ev-color', colors[0]);
    block.style.background = colors[2];
    block.innerHTML = `<strong>${esc(shortCourse(lesson.course))}</strong><span>${esc(lesson.location || '')}</span><em>${esc(lesson.teacher || '')}</em>`;
    // 课程名可能被截断（shortCourse），tooltip 里给全名 + 操作提示
    block.title = `${lesson.course}${lesson.lesson_code ? ' · ' + lesson.lesson_code : ''}\n点击编辑 / 调课`;
    block.onclick = () => openLessonModal({ mode: 'edit', lesson });
    grid.appendChild(block);
  });
}

function pickCoursePalette(name='') {
  let hash = 0;
  for (const ch of name) hash = ((hash << 5) - hash) + ch.charCodeAt(0);
  return COURSE_PALETTES[Math.abs(hash) % COURSE_PALETTES.length];
}
function shortCourse(name='') { return name.length > 12 ? name.slice(0, 12) + '…' : name; }

function shiftCalendar(step) {
  if (state.calendarMode === 'month') {
    const d = new Date(state.calendarMonth); d.setMonth(d.getMonth() + step);
    navigateCalendar('month', `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  } else {
    navigateCalendar('week', addDays(state.selectedDate, step * 7));
  }
}

async function openDrawer(dateStr) {
  try {
    const data = await api(`/api/day?date=${dateStr}`);
    drawerDataCache = data;
    document.getElementById('drawerWeekday').textContent = `${data.week ? `第 ${data.week} 周 · ` : ''}${weekdayCN(parseISO(dateStr))}`;
    document.getElementById('drawerDate').textContent = longDateLabel(dateStr);
    document.getElementById('drawerContent').innerHTML = drawerHTML(data);
    document.getElementById('drawerBackdrop').classList.add('open');
    document.getElementById('dayDrawer').classList.add('open');
    bindDrawerActions(data.date);
  } catch (e) { toast(e.message); }
}

function drawerHTML(data) {
  const todos = data.tasks.filter(t => t.planned_date === data.date);
  const dues = data.tasks.filter(t => dueDay(t.due_date) === data.date);
  return [
    drawerSection('课程', data.lessons.length ? data.lessons.map(l => `
      <div class="drawer-row"><strong>${esc(l.section_label)} · ${esc(l.course)}</strong><span>${esc([l.location, l.teacher].filter(Boolean).join(' · ') || '无地点/教师信息')}</span><span>${esc(l.topic || '未填写本节主题')}</span><button class="text-btn edit-lesson-btn" data-lesson-id="${l.id}">编辑 / 调课</button></div>`).join('') : emptyHTML('这一天没有课程。')),
    drawerSection('复习', data.reviews.length ? data.reviews.map(r => `
      <div class="drawer-row ${r.status === 'completed' ? 'is-done' : ''}"><strong>R${r.stage} · ${esc(r.topic)}${r.status === 'completed' ? ' · 已完成' : ''}</strong><span>${esc(r.course)}</span></div>`).join('') : emptyHTML('这一天没有到期复习。')),
    drawerSection('今日待办', todos.length ? todos.map(t => `
      <div class="drawer-row ${t.status === 'completed' ? 'is-done' : ''}"><strong>${esc(t.title)}${t.status === 'completed' ? ' · 已完成' : ''}</strong><span>${esc(t.course || '未关联课程')} · ${esc((t.type || '').toUpperCase())}</span></div>`).join('') : emptyHTML('这一天没有安排待办。')),
    drawerSection('今日截止', dues.length ? dues.map(t => `
      <div class="drawer-row ${t.status === 'completed' ? 'is-done' : ''}"><strong>截止${dueTime(t.due_date) ? ' ' + esc(dueTime(t.due_date)) : ''} · ${esc(t.title)}${t.status === 'completed' ? ' · 已完成' : ''}</strong><span>${esc(t.course || '未关联课程')} · ${esc((t.type || '').toUpperCase())}</span></div>`).join('') : emptyHTML('这一天没有截止项。')),
    `<div class="drawer-actions"><button class="ghost-btn" id="drawerOpenDay">打开单日看板</button><button class="primary-btn" id="drawerQuickAdd">添加事项</button><button class="ghost-btn" id="drawerAddLesson">添加课程</button></div>`
  ].join('');
}

function drawerSection(title, inner) { return `<section class="drawer-section"><h3>${title}</h3>${inner}</section>`; }

function bindDrawerActions(dateStr) {
  const lessons = (drawerDataCache?.lessons || []);
  document.getElementById('drawerOpenDay').onclick = () => { closeDrawer(); navigateHome(dateStr); };
  document.getElementById('drawerQuickAdd').onclick = () => { closeDrawer(); openModal(); };
  document.getElementById('drawerAddLesson').onclick = () => { closeDrawer(); openLessonModal({ mode: 'create', date: dateStr, section: 1 }); };
  document.querySelectorAll('.edit-lesson-btn').forEach(btn => btn.onclick = () => {
    const lesson = lessons.find(l => String(l.id) === btn.dataset.lessonId);
    if (lesson) { closeDrawer(); openLessonModal({ mode: 'edit', lesson }); }
  });
}

function closeDrawer() {
  document.getElementById('drawerBackdrop').classList.remove('open');
  document.getElementById('dayDrawer').classList.remove('open');
}

let taskModalCtx = null;

function openModal(task = null) {
  document.getElementById('quickAddModal').returnFocus = document.activeElement;
  taskModalCtx = task;
  const isEdit = !!task;
  document.getElementById('taskModalTitle').textContent = isEdit ? '编辑任务' : '添加事项';
  document.querySelector('#quickAddModal .ai-box').style.display = isEdit ? 'none' : '';
  document.getElementById('taskTitle').value = task?.title || '';
  document.getElementById('taskType').value = task?.type || 'task';
  document.getElementById('taskCourse').value = task?.course || '';
  const kind = LIST_VIEWS[state.view];
  const date = kind ? (state.listMode[kind] === 'focus' ? state.listFocus[kind] : state.today) : state.selectedDate;
  document.getElementById('taskPlanned').value = task ? (task.planned_date || '') : date;
  // 截止时间拆成「日期 + 时刻」两个控件：日期是主字段，时刻可选。
  // 只在确实是 DDL 时把时刻填上，普通任务的空 due_date 不该显示成 23:59。
  document.getElementById('taskDue').value = task ? dueDay(task.due_date) : '';
  document.getElementById('taskDueTime').value = task ? dueTime(task.due_date) : '';
  document.getElementById('taskNotes').value = task?.notes || '';
  document.querySelector('#taskForm .primary-btn').textContent = isEdit ? '保存修改' : '添加任务';
  document.getElementById('modalBackdrop').classList.add('open');
  document.getElementById('quickAddModal').classList.add('open');
  setTimeout(() => { if (document.getElementById('quickAddModal').classList.contains('open')) document.getElementById('taskTitle').focus(); }, 80);
}

function closeModal() {
  const modal = document.getElementById('quickAddModal');
  if (modal.contains(document.activeElement)) { document.activeElement.blur(); (modal.returnFocus?.isConnected ? modal.returnFocus : document.getElementById('quickAddBtn')).focus(); }
  document.getElementById('modalBackdrop').classList.remove('open');
  document.getElementById('quickAddModal').classList.remove('open');
  clearFormError('taskFormError');
}

function openLessonModal(ctx) {
  document.getElementById('lessonModal').returnFocus = document.activeElement;
  lessonModalCtx = ctx;
  const sel1 = document.getElementById('lessonStart');
  const sel2 = document.getElementById('lessonEnd');
  if (!sel1.options.length) {
    for (let i = 1; i <= 12; i++) {
      sel1.add(new Option(`${i}节`, i));
      sel2.add(new Option(`${i}节`, i));
    }
  }
  document.getElementById('courseList').innerHTML = state.courses.map(c => `<option value="${esc(c)}"></option>`).join('');
  const isEdit = ctx.mode === 'edit';
  document.getElementById('lessonModalTitle').textContent = isEdit ? '编辑课程 / 调课' : '添加课程';
  document.getElementById('deleteLessonBtn').classList.toggle('hidden', !isEdit);
  const l = ctx.lesson || {};
  document.getElementById('lessonCourse').value = l.course || '';
  document.getElementById('lessonDate').value = l.lesson_date || ctx.date || state.selectedDate;
  document.getElementById('lessonLocation').value = l.location || '';
  document.getElementById('lessonStart').value = l.start_section || ctx.section || 1;
  document.getElementById('lessonEnd').value = l.end_section || ctx.section || 1;
  document.getElementById('lessonTeacher').value = l.teacher || '';
  document.getElementById('lessonTopic').value = l.topic || '';
  document.getElementById('modalBackdrop').classList.add('open');
  document.getElementById('lessonModal').classList.add('open');
}

function closeLessonModal() {
  const modal = document.getElementById('lessonModal');
  if (modal.contains(document.activeElement)) { document.activeElement.blur(); (modal.returnFocus?.isConnected ? modal.returnFocus : document.getElementById('quickAddBtn')).focus(); }
  document.getElementById('lessonModal').classList.remove('open');
  clearFormError('lessonFormError');
  if (!document.getElementById('quickAddModal').classList.contains('open')) {
    document.getElementById('modalBackdrop').classList.remove('open');
  }
}

async function submitLesson(e) {
  e.preventDefault();
  const payload = {
    course: document.getElementById('lessonCourse').value.trim(),
    lesson_date: document.getElementById('lessonDate').value,
    start_section: Number(document.getElementById('lessonStart').value),
    end_section: Number(document.getElementById('lessonEnd').value),
    location: document.getElementById('lessonLocation').value.trim(),
    teacher: document.getElementById('lessonTeacher').value.trim(),
    topic: document.getElementById('lessonTopic').value.trim(),
  };
  const isEdit = lessonModalCtx?.mode === 'edit';
  try {
    if (isEdit) {
      await api(`/api/lessons/${lessonModalCtx.lesson.id}/update`, { method: 'POST', body: JSON.stringify(payload) });
      toast('课程已更新');
    } else {
      await api('/api/lessons', { method: 'POST', body: JSON.stringify(payload) });
      toast('课程已添加');
    }
    const coursesRes = await api('/api/courses');
    state.courses = coursesRes.courses || [];
    fillCourseOptions();
    clearFormError('lessonFormError');
    closeLessonModal();
    if (state.view === 'calendar') await loadCalendar();
    else await loadDay();
  } catch (err) { showFormError('lessonFormError', err.message); }
}

async function deleteLesson() {
  const lesson = lessonModalCtx?.lesson;
  if (!lesson) return;
  // 有主题 = 已生成复习链。删除课程会级联清掉它的复习记录，
  // 撤销重建也只是重新生成 pending 轮次，已完成的复习历史找不回来。
  // 这一步值得一次明确的确认，不能只靠 8 秒的撤销窗口。
  if ((lesson.topic || '').trim()) {
    const ok = confirm('这门课已填写主题、生成复习链。\n删除课程会一并清掉它的复习记录，已完成的复习历史不会保留（撤销重建也无法恢复）。\n\n确定删除？');
    if (!ok) return;
  }
  try {
    await api(`/api/lessons/${lesson.id}`, { method: 'DELETE' });
    const snapshot = { ...lesson };
    // 删课程是重操作（级联清复习链），撤销窗口给足 15 秒，普通完成 8 秒就行
    showActionToast('课程已删除', '撤销', async () => {
      const body = {
        course: snapshot.course, lesson_date: snapshot.lesson_date,
        start_section: snapshot.start_section, end_section: snapshot.end_section,
        teacher: snapshot.teacher, location: snapshot.location,
        lesson_code: snapshot.lesson_code, topic: snapshot.topic,
      };
      await api('/api/lessons', { method: 'POST', body: JSON.stringify(body) });
      if (state.view === 'calendar') await loadCalendar(); else await loadDay();
    }, 15000);
    closeLessonModal();
    if (state.view === 'calendar') await loadCalendar(); else await loadDay();
  } catch (err) { toast(err.message); }
}

function fillCourseOptions() {
  const sel = document.getElementById('taskCourse');
  sel.innerHTML = '<option value="">不关联课程</option>' + state.courses.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

async function submitTask(e) {
  e.preventDefault();
  // 必须在 await 之前取引用：异步之后 e.currentTarget 会变成 null
  const form = e.currentTarget;
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  // 截止时间由「日期 + 时刻」两个控件拼成；时刻留空则只发日期，后端补 23:59。
  // 表单里那个 time 输入没有 name，所以不会污染 payload，是刻意留白的。
  payload.due_date = joinDue(
    document.getElementById('taskDue').value,
    document.getElementById('taskDueTime').value,
  );
  try {
    if (taskModalCtx) {
      await api(`/api/tasks/${taskModalCtx.id}/update`, { method: 'POST', body: JSON.stringify(payload) });
      toast('任务已更新');
    } else {
      const created = await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
      state.flashTaskId = created.task.id;
      toast('任务已添加');
    }
    clearFormError('taskFormError');
    closeModal();
    form.reset();
    await refreshCurrentView();
  } catch (err) { showFormError('taskFormError', err.message); }
}

async function parseAI() {
  const text = document.getElementById('aiInput').value.trim();
  if (!text) return toast('请输入一句话');
  const btn = document.getElementById('aiParseBtn');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = '整理中…';
  try {
    const res = await api('/api/ai/parse', { method: 'POST', body: JSON.stringify({ text, current_date: document.getElementById('taskPlanned').value || state.today }) });
    const p = res.parsed || {};
    document.getElementById('taskTitle').value = p.title || '';
    document.getElementById('taskCourse').value = p.course || '';
    document.getElementById('taskType').value = p.type || 'task';
    document.getElementById('taskPlanned').value = p.planned_date || '';
    document.getElementById('taskDue').value = dueDay(p.due_date);
    document.getElementById('taskDueTime').value = dueTime(p.due_date);
    document.getElementById('taskNotes').value = p.notes || '';
    toast('已整理并填入表单，请确认后添加');
  } catch (err) { toast(err.message); }
  finally { btn.disabled = false; btn.textContent = '解析'; }
}

function themePreviewHTML(p) {
  const lamps = ['var(--review)', 'var(--warn)', 'var(--danger)'].map(c => `<i style="background:${c}"></i>`).join('');
  return `<div class="theme-preview" style="background:${p.bg}">
    <span class="tp-glow" style="background:radial-gradient(circle at 88% 0%, ${p.tintA}, transparent 62%), radial-gradient(circle at 6% 100%, ${p.tintB}, transparent 55%)"></span>
    <span class="tp-side" style="background:${p.card};border-color:${p.line}"></span>
    <span class="tp-card" style="background:${p.card};border-color:${p.line}">
      <b style="background:${p.surface2}"></b>
      <i class="tp-accent" style="background:${p.accent}"></i>
      <i class="tp-soft" style="background:${rgba(p.accent, .14)}"></i>
    </span>
    <span class="tp-pill" style="background:${p.accent}"></span>
    <span class="tp-dot" style="background:${p.accent2}"></span>
    <span class="tp-lamps">${lamps}</span>
  </div>`;
}

function setMonoUI(on) {
  document.getElementById('accent2Field').classList.toggle('hidden', on);
  document.getElementById('monoNote').classList.toggle('hidden', !on);
  document.getElementById('presetNote').classList.toggle('hidden', on);
  // 三个预设（柠檬海盐/玛格丽特/薄荷奶绿）的整套配色是设计好的整体，
  // 一旦放开调色盘，customTokens 会按挑选色重新推导 bg/card/line 等全部
  // 底层色，预设的设计被掀翻（用户实际踩过：在玛格丽特上动辅色，整站变色）。
  // 所以只有「纯色」放开两个取色器，预设一律禁用。
  document.getElementById('accentLabel').textContent = on ? '选择一种深色' : '主色 · 随预设锁定';
  document.getElementById('accentInput').disabled = !on;
  document.getElementById('accent2Input').disabled = !on;
}

function renderThemePresets() {
  document.getElementById('themePresets').innerHTML = Object.entries(THEMES).map(([key, value]) => `
    <button type="button" class="theme-swatch" data-theme="${key}">
      ${themePreviewHTML(value)}
      <span class="theme-swatch-copy"><strong>${value.label}</strong><em>${value.desc}</em></span>
    </button>`).join('');
  document.querySelectorAll('.theme-swatch').forEach(btn => btn.onclick = () => {
    const preset = THEMES[btn.dataset.theme];
    currentThemeKey = btn.dataset.theme;
    document.getElementById('accentInput').value = preset.accent;
    document.getElementById('accent2Input').value = preset.custom ? mixHex(preset.accent, '#FFFFFF', MONO_A2_T) : preset.accent2;
    setMonoUI(!!preset.custom);
    document.querySelectorAll('.theme-swatch').forEach(x => x.classList.toggle('active', x === btn));
    document.querySelectorAll('.theme-swatch').forEach(x => x.setAttribute('aria-pressed', String(x === btn)));
    liveApplyTheme();
  });
  document.getElementById('accentInput').addEventListener('input', () => {
    if (currentThemeKey !== 'mono') return;
    document.getElementById('accent2Input').value = mixHex(document.getElementById('accentInput').value, '#FFFFFF', MONO_A2_T);
    liveApplyTheme();
  });
  document.getElementById('accent2Input').addEventListener('input', () => {
    if (currentThemeKey === 'mono') return;
    currentThemeKey = 'custom';
    document.querySelectorAll('.theme-swatch').forEach(x => x.classList.remove('active'));
    liveApplyTheme();
  });
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return [62, 123, 214];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function mixHex(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function presetTokens(p) {
  return {
    '--accent': p.accent, '--accent-2': p.accent2,
    '--accent-soft': rgba(p.accent, .10),
    '--accent-quiet': rgba(p.accent, .05),
    '--on-accent': '#fff',
    '--brand-grad': p.accent,
    '--bg': p.bg, '--tint-a': p.tintA, '--tint-b': p.tintB,
    '--card': p.card, '--surface': p.surface, '--surface-2': p.surface2,
    '--line': p.line, '--soft-line': p.softLine,
    '--sidebar-bg': p.sidebar, '--sidebar-line': p.sidebarLine,
    '--seg-bg': p.segBg, '--chip-bg': p.chipBg, '--chip-text': p.chipText,
    '--shadow': p.shadow, '--btn-shadow': p.btnShadow,
    '--text': p.text, '--muted': p.muted,
  };
}

function monoTokens(main) {
  const base = /^#?[0-9a-f]{6}$/i.test(main || '') ? main : '#3A4759';
  // 深色：用户所选色直接做操作色，只压暗一点点保证白字可读
  const deep = mixHex(base, '#000000', .12);
  return {
    '--accent': deep,
    // 辅色：只提亮 15%，保持同一色系的深色强调（纯色只有一个家族，不做亮色对比）
    '--accent-2': mixHex(base, '#FFFFFF', MONO_A2_T),
    '--accent-soft': rgba(base, .10),
    '--accent-quiet': rgba(base, .05),
    '--on-accent': '#fff',
    '--brand-grad': deep,
    // 浅色层级：面板 / 卡片 / 底色，逐级加白，拉开明度差
    '--bg': mixHex(base, '#FFFFFF', .94),
    '--tint-a': rgba(base, .10), '--tint-b': rgba(base, .05),
    '--card': '#FFFFFF',
    '--surface': 'rgba(255,255,255,.90)',
    '--surface-2': mixHex(base, '#FFFFFF', .90),
    '--line': mixHex(base, '#FFFFFF', .76),
    '--soft-line': mixHex(base, '#FFFFFF', .86),
    '--sidebar-bg': 'rgba(255,255,255,.86)',
    '--sidebar-line': mixHex(base, '#FFFFFF', .82),
    '--seg-bg': mixHex(base, '#FFFFFF', .89),
    '--chip-bg': mixHex(base, '#FFFFFF', .88),
    '--chip-text': mixHex(base, '#000000', .45),
    '--shadow': `0 10px 28px ${rgba(base, .10)}`,
    '--btn-shadow': `0 2px 6px ${rgba(deep, .22)}`,
    '--text': mixHex(base, '#1A1D24', .80),
    '--muted': mixHex(base, '#5F6875', .62),
  };
}

function customTokens(a, b) {
  const accent = /^#?[0-9a-f]{6}$/i.test(a || '') ? a : '#2E5FA3';
  const accent2 = /^#?[0-9a-f]{6}$/i.test(b || '') ? b : accent;
  return {
    '--accent': accent, '--accent-2': accent2,
    '--accent-soft': rgba(accent, .10),
    '--accent-quiet': rgba(accent, .05),
    '--on-accent': '#fff',
    '--brand-grad': accent,
    '--bg': mixHex(accent, '#FFFFFF', .96),
    '--tint-a': rgba(accent, .13), '--tint-b': rgba(accent2, .10),
    '--card': '#FFFFFF', '--surface': 'rgba(255,255,255,.88)',
    '--surface-2': mixHex(accent, '#FFFFFF', .94),
    '--line': mixHex(accent, '#FFFFFF', .87), '--soft-line': mixHex(accent, '#FFFFFF', .91),
    '--sidebar-bg': 'rgba(255,255,255,.80)', '--sidebar-line': mixHex(accent, '#FFFFFF', .88),
    '--seg-bg': mixHex(accent, '#FFFFFF', .94), '--chip-bg': '#EFF1F6', '--chip-text': '#5A6478',
    '--shadow': '0 10px 28px rgba(42,49,80,.09)',
    '--btn-shadow': `0 2px 6px ${rgba(accent, .20)}`,
    '--text': '#232A3C', '--muted': '#70778B',
  };
}

function applyAppearance(app) {
  document.body.dataset.theme = app.theme_name || 'lemon-salt';
  document.body.dataset.density = app.density || 'compact';
  document.body.style.setProperty('--font-scale', fontSize(app.font_scale) / 14);
  const preset = THEMES[app.theme_name];
  let tokens;
  if (preset && preset.custom) tokens = monoTokens(app.accent || preset.accent);
  else if (preset) tokens = presetTokens(preset);
  else tokens = customTokens(app.accent, app.accent_2 || app.accent);
  const style = document.body.style;
  Object.entries(tokens).forEach(([k, v]) => style.setProperty(k, v));
}

function fontSize(value) {
  if (value === 'large') return 15;
  return Math.min(20, Math.max(12, Number(value) || 14));
}

function updateReadingControls() {
  const density = document.getElementById('densityInput');
  const comfortable = density.value === 'comfortable';
  density.setAttribute('aria-checked', String(comfortable));
  density.querySelector('.density-thumb').textContent = comfortable ? '舒展' : '紧凑';
  const range = document.getElementById('fontScaleInput');
  document.getElementById('fontSizeValue').value = `${range.value} px`;
  range.setAttribute('aria-valuetext', `${range.value} 像素`);
  range.style.setProperty('--range-progress', `${(Number(range.value) - 12) / 8 * 100}%`);
}

function liveApplyTheme() {
  const accentInput = document.getElementById('accentInput');
  const accent2Input = document.getElementById('accent2Input');
  if (currentThemeKey === 'mono') accent2Input.value = mixHex(accentInput.value, '#FFFFFF', MONO_A2_T);
  applyAppearance({
    theme_name: currentThemeKey,
    accent: accentInput.value,
    accent_2: accent2Input.value,
    density: document.getElementById('densityInput').value,
    font_scale: document.getElementById('fontScaleInput').value,
  });
}

function renderSettings() {
  const app = state.settings.appearance;
  currentThemeKey = THEMES[app.theme_name] ? app.theme_name : 'custom';
  const preset = THEMES[app.theme_name];
  if (preset?.custom) {
    document.getElementById('accentInput').value = app.accent;
    document.getElementById('accent2Input').value = mixHex(app.accent, '#FFFFFF', MONO_A2_T);
    setMonoUI(true);
  } else if (preset) {
    // 预设的取色器只用于展示该预设的设计值，禁用编辑（见 setMonoUI）。
    // 必须从 preset 读，不能从 app 读——库里可能残留上次自定义/纯色留下
    // 的旧色值，直接显示会让用户以为预设就是这个色。
    document.getElementById('accentInput').value = preset.accent;
    document.getElementById('accent2Input').value = preset.accent2;
    setMonoUI(false);
  } else {
    // 历史遗留的 custom 存档：取色器同样锁住，引导用户点一个预设归位
    document.getElementById('accentInput').value = app.accent;
    document.getElementById('accent2Input').value = app.accent_2 || app.accent;
    setMonoUI(false);
  }
  document.getElementById('densityInput').value = app.density;
  document.getElementById('fontScaleInput').value = fontSize(app.font_scale);
  updateReadingControls();
  document.querySelectorAll('.theme-swatch').forEach(x => x.classList.toggle('active', x.dataset.theme === app.theme_name));
  document.querySelectorAll('.theme-swatch').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.theme === app.theme_name)));
  document.getElementById('reviewOffsetsInput').value = (state.settings.review_offsets || []).join(', ');
  document.getElementById('aiBaseUrlInput').value = state.settings.ai.base_url || '';
  document.getElementById('aiModelInput').value = state.settings.ai.model || '';
  document.getElementById('aiKeyInput').value = '';
  document.getElementById('apiConfiguredNote').textContent = state.settings.ai.api_key_configured ? 'API Key 已配置' : '未配置 API Key';
}

async function saveAppearance(e) {
  e.preventDefault();
  const payload = {
    theme_name: currentThemeKey,
    accent: document.getElementById('accentInput').value,
    accent_2: document.getElementById('accent2Input').value,
    density: document.getElementById('densityInput').value,
    font_scale: document.getElementById('fontScaleInput').value,
  };
  try {
    state.settings = await api('/api/settings/appearance', { method: 'POST', body: JSON.stringify(payload) });
    applyAppearance(state.settings.appearance); renderSettings(); toast('外观设置已保存');
  } catch (err) { toast(err.message); }
}

async function saveReviewSettings(e) {
  e.preventDefault();
  const raw = document.getElementById('reviewOffsetsInput').value;
  const review_offsets = raw.split(',').map(x => x.trim()).filter(Boolean).map(Number);
  try {
    state.settings = await api('/api/settings/review', { method: 'POST', body: JSON.stringify({ review_offsets }) });
    renderSettings(); toast('复习设置已保存');
  } catch (err) { toast(err.message); }
}

async function saveAISettings(e) {
  e.preventDefault();
  const payload = {
    base_url: document.getElementById('aiBaseUrlInput').value.trim(),
    model: document.getElementById('aiModelInput').value.trim(),
    api_key: document.getElementById('aiKeyInput').value.trim(),
  };
  try {
    state.settings = await api('/api/settings/ai', { method: 'POST', body: JSON.stringify(payload) });
    renderSettings();
    document.getElementById('aiStatus').textContent = state.settings.ai.api_key_configured ? `已配置 · ${state.settings.ai.model}` : '未配置 API Key · 仍可手动录入';
    toast('AI 设置已保存');
    await testAIConnection(true);
  } catch (err) { toast(err.message); }
}

async function clearApiKey() {
  try {
    state.settings = await api('/api/settings/ai', { method: 'POST', body: JSON.stringify({ clear_key: true, base_url: document.getElementById('aiBaseUrlInput').value.trim(), model: document.getElementById('aiModelInput').value.trim() }) });
    renderSettings();
    document.getElementById('aiStatus').textContent = state.settings.ai.api_key_configured ? `已配置 · ${state.settings.ai.model}` : '未配置 API Key · 仍可手动录入';
    toast(state.settings.ai.api_key_configured ? '本地密钥已清除，环境变量密钥仍有效' : 'API Key 已清除');
    document.getElementById('apiTestStatus').textContent = '未测试连接';
  } catch (err) { toast(err.message); }
}

async function testAIConnection(saved = false) {
  const btn = document.getElementById('testApiBtn');
  if (btn.disabled) return;
  const status = document.getElementById('apiTestStatus');
  const controls = [...document.querySelectorAll('#aiForm input, #aiForm button')];
  const payload = saved ? {} : {
    base_url: document.getElementById('aiBaseUrlInput').value.trim(),
    model: document.getElementById('aiModelInput').value.trim(),
    api_key: document.getElementById('aiKeyInput').value.trim(),
  };
  controls.forEach(el => el.disabled = true);
  status.textContent = '正在测试连接…';
  status.dataset.state = 'pending';
  try {
    const result = await api('/api/ai/test', { method: 'POST', body: JSON.stringify(payload) });
    status.textContent = `连接成功 · ${result.model}`;
    status.dataset.state = 'success';
  } catch (err) {
    status.textContent = `连接失败：${err.message}`;
    status.dataset.state = 'error';
  } finally { controls.forEach(el => el.disabled = false); }
}

function bindScheduleImport() {
  const zone = document.getElementById('scheduleDropZone');
  const input = document.getElementById('scheduleFile');
  const button = document.getElementById('importScheduleBtn');
  const preview = document.getElementById('schedulePreview');
  let schedule = null;
  let selection = 0;
  let importing = false;
  async function readFile(file) {
    if (importing) return;
    const token = ++selection;
    schedule = null;
    button.disabled = true;
    preview.textContent = '正在校验课表…';
    try {
      if (!file || !file.name.toLowerCase().endsWith('.json')) throw new Error('请选择 JSON 课表文件');
      if (file.size > 900000) throw new Error('课表文件不能超过 900 KB');
      const data = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
      const result = await api('/api/schedule/preview', { method: 'POST', body: JSON.stringify(data) });
      if (token !== selection) return;
      schedule = data;
      preview.textContent = `${file.name}\n${result.total} 节课程 · ${result.start_date} 至 ${result.end_date}\n可新增 ${result.added} 节 · 重复 ${result.skipped} 节（跳过）\n${result.sample.map(x => `${x.lesson_date} · ${x.course} · ${x.start_section}–${x.end_section}节`).join('\n')}`;
      button.disabled = !result.added;
    } catch (err) { if (token === selection) preview.textContent = `无法载入：${err.message}`; }
  }
  input.onchange = () => readFile(input.files[0]);
  zone.ondragover = e => { e.preventDefault(); zone.classList.add('drag-over'); };
  zone.ondragleave = () => zone.classList.remove('drag-over');
  zone.ondrop = e => { e.preventDefault(); zone.classList.remove('drag-over'); readFile(e.dataTransfer.files[0]); };
  button.onclick = async () => {
    if (!schedule || importing) return;
    importing = true;
    button.disabled = true;
    input.disabled = true;
    try {
      const result = await api('/api/schedule/import', { method: 'POST', body: JSON.stringify(schedule) });
      preview.textContent = `载入完成：新增 ${result.added} 节，跳过 ${result.skipped} 节重复课程。已有主题和复习记录已保留。`;
      schedule = null;
      const [meta, courses] = await Promise.all([api('/api/meta'), api('/api/courses')]);
      state.meta = meta;
      state.courses = courses.courses || [];
      fillCourseOptions();
      document.getElementById('sidebarMeta').textContent = `${meta.lesson_count} 次课程 · SQLite v${meta.schema_version}`;
    } catch (err) { preview.textContent = `载入失败：${err.message}`; button.disabled = false; }
    finally { importing = false; input.disabled = false; }
  };
}

// 图标统一取自本地 Lucide 静态库（lucide-static v1.16.0 · ISC），不再手写路径
function checkSVG() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;
}
function pencilSVG() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg>`;
}
function trashSVG() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
}
