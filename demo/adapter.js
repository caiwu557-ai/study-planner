/* The desktop frontend stays unchanged; only demo requests use fictional, in-memory data. */
(() => {
  const seed = window.DEMO_SEED, copy = x => JSON.parse(JSON.stringify(x));
  const NativeDate = Date, fixed = new NativeDate(seed.today + 'T10:00:00+08:00').getTime();
  window.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } };
  let model;
  window.resetDemo = () => { model = copy(seed); };
  window.resetDemo();
  const dayOf = s => (s || '').slice(0, 10);
  const nativeFetch = window.fetch.bind(window);
  function taskDay(t, date) { return t.status === 'completed' ? dayOf(t.completed_at) === date : t.planned_date === date || dayOf(t.due_date) === date || (!t.planned_date && !t.due_date && date === seed.today); }
  function list(kind, mode, date) {
    const spec = model.specs[kind], items = kind === 'review' ? model.calendar.reviews : model.calendar.tasks;
    let dates = mode === 'all' ? [...new Set(items.flatMap(t => kind === 'review' ? [dayOf(t.due_date)] : kind === 'ddl' ? [dayOf(t.due_date)] : [t.planned_date, dayOf(t.due_date), dayOf(t.completed_at)]).filter(Boolean))].sort() : [mode === 'focus' ? date : seed.today];
    dates.sort((a,b) => a === seed.today ? -1 : b === seed.today ? 1 : a.localeCompare(b));
    const groups = dates.map(date => {
      const pool = items.filter(t => t.status !== 'deleted' && (kind === 'review' ? dayOf(t.due_date) === date : kind === 'ddl' ? t.status === 'pending' && dayOf(t.due_date) === date : taskDay(t, date)));
      const d = new NativeDate(date + 'T00:00:00');
      const sections = [{ key:'pending', label:spec.pending_label, items:pool.filter(t=>t.status==='pending') }];
      const done = pool.filter(t=>t.status==='completed');
      if (kind !== 'ddl' && done.length) sections.push({ key:'done', label:spec.done_label, items:done });
      return { key:date,date,label:`${d.getMonth()+1}月${d.getDate()}日`,weekday:'周'+'日一二三四五六'[d.getDay()],is_today:date===seed.today,is_past:date<seed.today,sections };
    }).filter(g=>mode!=='all'||g.sections.some(s=>s.items.length));
    return {...spec,view:spec.title,mode,today:seed.today,focus_date:date,groups};
  }
  function handle(url, method, p) {
    const path=url.pathname,q=url.searchParams,cal=model.calendar;
    if(path==='/api/meta')return model.meta;
    if(path==='/api/settings')return model.settings;
    if(path==='/api/courses')return {courses:[...new Set(cal.lessons.map(l=>l.course))]};
    if(path==='/api/ddl/alerts')return {alerts:[],modal_hours:12,banner_hours:24};
    if(path==='/api/calendar'){const start=q.get('start'),end=q.get('end'),between=d=>d>=start&&d<=end;return {lessons:cal.lessons.filter(l=>between(l.lesson_date)),reviews:cal.reviews.filter(r=>r.status==='pending'&&between(r.due_date)),tasks:cal.tasks.filter(t=>t.status==='pending'&&(between(t.planned_date)||between(dayOf(t.due_date))))};}
    if(path==='/api/day'){const date=q.get('date')||seed.today,lessons=cal.lessons.filter(l=>l.lesson_date===date),reviews=cal.reviews.filter(r=>dayOf(r.due_date)===date),tasks=cal.tasks.filter(t=>t.status!=='deleted'&&taskDay(t,date));return {...model.day,date,lessons,reviews,tasks,upcoming:cal.tasks.filter(t=>t.status==='pending'&&t.due_date),ddl_alerts:[],missing_topic_count:lessons.filter(l=>!l.topic).length,progress:{review_total:reviews.filter(r=>r.status==='pending').length,review_done:reviews.filter(r=>r.status==='completed').length,task_total:tasks.filter(t=>t.status==='pending').length,task_done:tasks.filter(t=>t.status==='completed').length}};}
    if(path==='/api/lists')return list(q.get('view'),q.get('mode')||'today',q.get('date')||q.get('focus_date')||seed.today);
    if(path==='/api/tasks/trash')return {tasks:cal.tasks.filter(t=>t.status==='deleted')};
    if(path==='/api/tasks'&&method==='POST'){const task={...p,id:Math.max(0,...cal.tasks.map(t=>t.id))+1,status:'pending',created_at:seed.today,completed_at:null,deleted_at:null};if(!String(p.title||'').trim())throw Error('请填写任务标题');cal.tasks.push(task);return {task};}
    const taskMatch=path.match(/^\/api\/tasks\/(\d+)\/(status|update|restore|purge)$/);
    if(taskMatch){const task=cal.tasks.find(t=>t.id===Number(taskMatch[1]));if(!task)throw Error('演示事项不存在');const action=taskMatch[2];if(action==='update')Object.assign(task,p);else if(action==='purge')cal.tasks=cal.tasks.filter(t=>t!==task);else {task.status=action==='restore'?'pending':p.status;task.completed_at=task.status==='completed'?seed.today+'T10:00:00':null;task.deleted_at=task.status==='deleted'?seed.today+'T10:00:00':null;}return {ok:true,task};}
    const reviewMatch=path.match(/^\/api\/reviews\/(\d+)\/(complete|undo)$/);
    if(reviewMatch){const r=cal.reviews.find(r=>r.id===Number(reviewMatch[1]));if(!r)throw Error('演示复习不存在');r.status=reviewMatch[2]==='complete'?'completed':'pending';r.completed_at=r.status==='completed'?seed.today+'T10:00:00':null;return {ok:true};}
    const lessonMatch=path.match(/^\/api\/lessons\/(\d+)\/(topic|update)$/);
    if(lessonMatch){const lesson=cal.lessons.find(l=>l.id===Number(lessonMatch[1]));if(!lesson)throw Error('演示课程不存在');Object.assign(lesson,p);if(p.date)lesson.lesson_date=p.date;if(p.start_section||p.end_section)lesson.section_label=`${lesson.start_section}–${lesson.end_section}节`;cal.reviews.filter(r=>r.lesson_id===lesson.id).forEach(r=>{r.topic=lesson.topic;r.course=lesson.course});return {ok:true,lesson};}
    if(path==='/api/settings/appearance'){Object.assign(model.settings.appearance,p);return model.settings;}
    if(path==='/api/settings/review'){model.settings.review_offsets=p.review_offsets;return model.settings;}
    if(path.startsWith('/api/ai')||path==='/api/settings/ai')throw Error('展示页不连接 AI，也不保存密钥；请在完整版体验。');
    throw Error('这项操作请在完整版体验，演示页不会修改真实数据。');
  }
  window.fetch=async (path,opts={})=>{const url=new URL(path,location.href);if(!url.pathname.startsWith('/api/'))return nativeFetch(path,opts);try {if(opts.signal?.aborted)throw new DOMException('Aborted','AbortError');return new Response(JSON.stringify(handle(url,opts.method||'GET',opts.body?JSON.parse(opts.body):{})),{headers:{'Content-Type':'application/json'}});}catch(e){if(e.name==='AbortError')throw e;return new Response(JSON.stringify({error:e.message}),{status:400,headers:{'Content-Type':'application/json'}});}};
  const style=document.createElement('style');style.textContent='.demo-label{position:fixed;right:18px;bottom:12px;z-index:200;font-size:11px;background:#fff;color:#6d7789;border:1px solid #dce3ee;padding:5px 12px;border-radius:20px;pointer-events:none}.demo-cursor{position:fixed;z-index:500;pointer-events:none;width:22px;height:22px;border:3px solid #2e5fa3;border-radius:50%;background:#fff9;box-shadow:0 0 0 7px #2e5fa31a;transition:top .7s ease,left .7s ease;left:50%;top:50%}.demo-cursor.click{background:#e8c21c;box-shadow:0 0 0 13px #e8c21c33}';document.head.append(style);
  document.addEventListener('DOMContentLoaded',()=>{const label=document.createElement('div');label.className='demo-label';label.textContent=`虚构数据演示 · ${seed.today} · 不连接 AI`;document.body.append(label);const key=document.querySelector('#aiKeyInput');if(key){key.disabled=true;key.placeholder='演示页无需密钥'} });
})();
