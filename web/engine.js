// Browser counterpart of server.py. Keep rules aligned with the local edition.
import {addDays, bjISO, bjNow, dueDay, parseISO, parseDue, weekdayCN} from './core.js';

const fail = message => { throw new Error(message); };
export function text(value, max = 500) {
  if (value != null && typeof value !== 'string') fail('文本字段必须是字符串');
  const s = (value || '').trim();
  if (s.length > max) fail(`内容过长，最多 ${max} 个字符`);
  return s;
}
export function date(value, label = '日期', required = false) {
  const s = text(value, 10);
  if (!s && !required) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || +s.slice(0,4) < 1000 || addDays(s, 0) !== s) fail(`${label}不是有效的 YYYY-MM-DD 日期`);
  return s;
}
function datetime(value) {
  const s = text(value, 16);
  if (!s) return '';
  const [day, time] = s.split('T');
  date(day, '截止日期', true);
  if (time === undefined) return `${day}T23:59`;
  if (!/^\d{2}:\d{2}$/.test(time) || +time.slice(0,2) > 23 || +time.slice(3) > 59) fail('截止时间请使用 HH:MM 格式');
  return s;
}
function integer(value, min, max, label) {
  if (typeof value === 'string' && /^\d+$/.test(value)) value = Number(value);
  if (!Number.isInteger(value) || value < min || value > max) fail(`${label}必须是 ${min}–${max} 的整数`);
  return value;
}
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('JSON 必须为对象');
  return value;
}
export const sectionTimes = {1:'08:00-08:45',2:'08:55-09:40',3:'10:00-10:45',4:'10:55-11:40',5:'11:50-12:35',6:'14:00-14:45',7:'14:55-15:40',8:'15:50-16:35',9:'16:45-17:30',10:'17:40-18:25',11:'19:00-19:45',12:'19:55-20:40'};
export function emptyState() {
  return {version:1, meta:{semester_start:'',semester_weeks:18,source:''},
    settings:{appearance:{theme_name:'lemon-salt',accent:'#2E5FA3',accent_2:'#E8C21C',density:'compact',font_scale:'normal'},review_offsets:[1,3,7,14,30],ai:{base_url:'https://api.deepseek.com',model:'deepseek-v4-flash'}},
    lessons:[], reviews:[], tasks:[], ids:{lessons:0,reviews:0,tasks:0}};
}
const stamp = () => {const now=bjNow();return `${bjISO(now)}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;};
const daysBetween = (a,b) => Math.round((Date.parse(`${a}T00:00:00Z`)-Date.parse(`${b}T00:00:00Z`))/86400000);
const lessonKey = l => JSON.stringify([l.lesson_date,l.course,l.start_section,l.end_section]);
const manualLessonKey = l => JSON.stringify([lessonKey(l),l.location,l.teacher]);
const find = (items,id,label) => items.find(x=>x.id===id) || fail(`${label}不存在`);
const next = (s,table) => ++s.ids[table];
const courses = s => [...new Set(s.lessons.map(x=>x.course))].sort();
const lessonView = l => ({...l,section_label:l.start_section===l.end_section?`${l.start_section}节`:`${l.start_section}–${l.end_section}节`});
const reviewView = (s,r) => {const l=find(s.lessons,r.lesson_id,'课程');return {...r,...Object.fromEntries(['course','topic','lesson_code','lesson_date','start_section','end_section'].map(k=>[k,l[k]]))};};
const sortText = (a,b) => String(a||'').localeCompare(String(b||''));
const sortTasks = (a,b) => ({ddl:0,assignment:1}[a.type]??2)-({ddl:0,assignment:1}[b.type]??2)||sortText(a.due_date,b.due_date)||a.id-b.id;
export function taskPayload(p) {
  object(p);
  const title=text(p.title,180), type=text(p.type||'task',20), planned_date=date(p.planned_date,'计划日期'), due_date=datetime(p.due_date);
  if (!title) fail('任务标题不能为空');
  if (!['task','assignment','ddl','other'].includes(type)) fail('任务类型无效');
  if (planned_date && due_date && dueDay(due_date)<planned_date) fail('截止时间不能早于计划日期');
  return {title,type,planned_date,due_date,course:text(p.course,180),notes:text(p.notes,2000)};
}
function lessonPayload(p) {
  object(p);
  const course=text(p.course,120), lesson_date=date(p.lesson_date,'上课日期',true), start_section=integer(p.start_section,1,12,'开始节'),end_section=integer(p.end_section,1,12,'结束节');
  if(!course)fail('课程名称不能为空');
  if(end_section<start_section)fail('结束节不能早于开始节');
  return {course,lesson_date,start_section,end_section,teacher:text(p.teacher,80),location:text(p.location,80),lesson_code:text(p.lesson_code,80),topic:text(p.topic,240)};
}
function week(s,day) {return s.meta.semester_start?Math.max(1,Math.floor(daysBetween(day,s.meta.semester_start)/7)+1):1;}
function enrichLesson(s,p) {return {...p,week:week(s,p.lesson_date),weekday:parseISO(p.lesson_date).getDay()||7};}
export function generateReviews(s,l,today=bjISO()) {
  if(!l.topic || !l.review_enabled)return;
  const offsets=s.settings.review_offsets, shift=Math.max(0,daysBetween(today,addDays(l.lesson_date,offsets[0])));
  offsets.forEach((off,i)=>{
    const due=addDays(l.lesson_date,off+shift), old=s.reviews.find(r=>r.lesson_id===l.id&&r.stage===i+1);
    if(old){if(old.status!=='completed')old.due_date=due;}
    else s.reviews.push({id:next(s,'reviews'),lesson_id:l.id,stage:i+1,due_date:due,status:'pending',created_at:stamp(),completed_at:''});
  });
}
export function replan(s,today=bjISO()) {
  for(const l of s.lessons.filter(l=>l.topic)) {
    const pending=s.reviews.filter(r=>r.lesson_id===l.id&&r.status==='pending').sort((a,b)=>a.stage-b.stage);
    if(pending.length&&pending[0].due_date<today){const delta=daysBetween(today,pending[0].due_date);pending.forEach(r=>r.due_date=addDays(r.due_date,delta));}
  }
}
export function complete(s,id,day=bjISO()) {
  date(day,'完成日期',true);
  const r=find(s.reviews,id,'复习任务');
  if(r.status==='completed')return;
  r.status='completed';r.completed_at=`${day}T${stamp().slice(11)}`;
  const delta=Math.max(0,daysBetween(day,r.due_date));
  s.reviews.filter(x=>x.lesson_id===r.lesson_id&&x.stage>r.stage&&x.status==='pending').forEach(x=>x.due_date=addDays(x.due_date,delta));
}
export function undo(s,id) {
  const r=find(s.reviews,id,'复习任务');if(r.status!=='completed')return;
  const delta=r.completed_at?Math.max(0,daysBetween(dueDay(r.completed_at),r.due_date)):0;
  r.status='pending';r.completed_at='';
  s.reviews.filter(x=>x.lesson_id===r.lesson_id&&x.stage>r.stage&&x.status==='pending').forEach(x=>x.due_date=addDays(x.due_date,-delta));
}
function taskStatus(s,id,status) {
  if(!['pending','completed','deleted'].includes(status))fail('任务状态无效');
  const task=find(s.tasks,id,'任务');task.status=status;task.completed_at=status==='completed'?stamp():'';return {task};
}
function alert(t,now=bjNow()) {
  const due=parseDue(t.due_date), hours=due?(due-now)/3600000:Infinity;
  return {...t,alert:hours<=12?'modal':hours<=24?'banner':'',overdue:hours<0,hours_left:Math.round(hours*10)/10};
}
const alerts = s => s.tasks.filter(t=>t.status==='pending'&&t.type==='ddl'&&t.due_date).map(t=>alert(t)).filter(t=>t.alert).sort((a,b)=>sortText(a.due_date,b.due_date));
const specs = {
  review:{title:'复习清单',kicker:'按到期日排布 · 到点就勾掉',pending_label:'待复习',done_label:'已复习',tickable:true},
  todo:{title:'待办清单',kicker:'计划与截止都在这里 · 点条目可改',pending_label:'待办',done_label:'已完成',tickable:true},
  ddl:{title:'到期清单',kicker:'只做提醒，不需要打钩 · 任务完成即自动取消',pending_label:'即将到期',done_label:'',tickable:false}};
function sections(s,view,day) {
  const spec=specs[view];let pending=[],done=[];
  if(view==='review'){
    const items=s.reviews.filter(r=>r.due_date===day).map(r=>reviewView(s,r)).sort((a,b)=>sortText(a.course,b.course)||a.stage-b.stage);
    pending=items.filter(r=>r.status==='pending');done=items.filter(r=>r.status==='completed');
  }else if(view==='todo'){
    pending=s.tasks.filter(t=>t.status==='pending'&&(t.planned_date===day||dueDay(t.due_date)===day)).sort(sortTasks).map(t=>({...t,alert:t.type==='ddl'?alert(t).alert:''}));
    done=s.tasks.filter(t=>t.status==='completed'&&dueDay(t.completed_at)===day).sort(sortTasks).map(t=>({...t,alert:''}));
  }else pending=s.tasks.filter(t=>t.status==='pending'&&dueDay(t.due_date)===day).sort((a,b)=>sortText(a.due_date,b.due_date)||a.id-b.id).map(t=>alert(t));
  return [{key:'pending',label:spec.pending_label,items:pending},...(done.length?[{key:'done',label:spec.done_label,items:done}]:[])];
}
function list(s,q,today) {
  const view=q.get('view'), spec=specs[view];if(!spec)fail('清单类型无效');
  const mode=['today','all','focus'].includes(q.get('mode'))?q.get('mode'):'today', focus=date(q.get('date')||today),days=new Set();
  if(view==='review')s.reviews.forEach(r=>days.add(r.due_date));
  else s.tasks.forEach(t=>{
    if(t.status==='pending'){if(t.due_date)days.add(dueDay(t.due_date));if(view==='todo'&&t.planned_date)days.add(t.planned_date);}
    if(view==='todo'&&t.status==='completed')days.add(dueDay(t.completed_at));
  });
  const order=mode==='all'?[today,...[...days].filter(d=>d>today).sort(),...[...days].filter(d=>d<today).sort().reverse().slice(0,180)]:[mode==='focus'?focus:today];
  const groups=order.map(d=>({key:d,date:d,label:`${+d.slice(5,7)}月${+d.slice(8)}日`,weekday:weekdayCN(parseISO(d)),is_today:d===today,is_past:d<today,sections:sections(s,view,d).filter(x=>mode!=='all'||d===today||x.items.length)})).filter(g=>g.sections.length||g.is_today);
  if(view==='todo'){
    // Undated tasks belong to today too, so creating one never makes it disappear.
    const undated=s.tasks.filter(t=>t.status==='pending'&&!t.planned_date&&!t.due_date);
    if(undated.length&&(mode==='all'||order.includes(today)))groups.push({key:'undated',date:'',label:'未安排日期',weekday:'',is_today:false,is_past:false,sections:[{key:'pending',label:'待办',items:undated}]});
  }
  return {...spec,view:spec.title,mode,today,focus_date:mode==='focus'?focus:today,groups};
}
export function validateSchedule(p) {
  object(p);if(p.format!=='study-planner-schedule'||p.version!==1)fail('课表格式无效，请使用项目 Skill 生成 version 1 JSON 文件');
  const m=object(p.metadata),start=date(m.semester_start,'学期开始日期',true);
  if(m.timezone!=='Asia/Shanghai')fail('课表时区必须为 Asia/Shanghai');
  if(parseISO(start).getDay()!==1)fail('学期开始日期必须是第一周的周一');
  if(typeof m.semester_weeks!=='number')fail('semester_weeks 必须为整数');
  const weeks=integer(m.semester_weeks,1,54,'学期周数');
  if(!Array.isArray(p.lessons)||!p.lessons.length||p.lessons.length>5000)fail('课表需要包含 1–5000 节具体课程');
  const lessons=p.lessons.map((l,i)=>{try{
    object(l);if(typeof l.start_section!=='number'||typeof l.end_section!=='number')fail('节次必须为整数');
    const item=lessonPayload(l),delta=daysBetween(item.lesson_date,start);
    if(item.topic||item.lesson_code)fail('导入课表不接受主题或课程编号，请载入后填写');
    if(delta<0||delta>=weeks*7)fail('上课日期不在学期范围内');
    return {...item,week:Math.floor(delta/7)+1,weekday:parseISO(item.lesson_date).getDay()||7};
  }catch(e){fail(`第 ${i+1} 节课程：${e.message}`)}});
  return {lessons,metadata:{semester_start:start,semester_weeks:weeks,source:text(m.source,500)}};
}
function importSchedule(s,p,preview) {
  const {lessons,metadata}=validateSchedule(p),existing=new Set(s.lessons.map(lessonKey)),wasEmpty=!existing.size;let added=0,skipped=0;
  for(const l of lessons){const key=lessonKey(l);if(existing.has(key)){skipped++;continue;}existing.add(key);added++;
    if(!preview)s.lessons.push({...l,id:next(s,'lessons'),topic:'',lesson_code:'',material_ref:'',review_enabled:1});}
  if(!preview&&wasEmpty)s.meta=metadata;
  const dates=lessons.map(l=>l.lesson_date).sort();return {total:lessons.length,added,skipped,start_date:dates[0],end_date:dates.at(-1),sample:lessons.slice(0,5)};
}
export function appearance(p) {
  const def=emptyState().settings.appearance,clean={};
  for(const k of Object.keys(def))clean[k]=text(p[k]||def[k],80);
  if(!['lemon-salt','margarita','vanilla-cream','mono','custom'].includes(clean.theme_name))fail('主题无效');
  if(!['compact','comfortable'].includes(clean.density))fail('布局密度无效');
  if(!['normal','large'].includes(clean.font_scale))integer(clean.font_scale,12,20,'字号');
  if(!/^#[a-f\d]{6}$/i.test(clean.accent)||!/^#[a-f\d]{6}$/i.test(clean.accent_2))fail('配色无效');
  return clean;
}
export function offsets(p) {
  if(!Array.isArray(p)||!p.length||p.length>366)fail('复习间隔无效');
  return [...new Set(p.map(n=>integer(n,0,365,'复习间隔')))].sort((a,b)=>a-b);
}
export function aiConfig(p) {
  const base_url=text(p.base_url,200).replace(/\/+$/,''),model=text(p.model,120);let url;
  try{url=new URL(base_url)}catch{fail('API 地址无效');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)fail('网页版 API 地址须使用 HTTPS，不能包含密钥、查询参数或片段');
  if(!model)fail('请填写模型名称');
  return {base_url,model};
}
export function settings(s,key) {return {...s.settings,ai:{...s.settings.ai,api_key_configured:!!key},section_times:sectionTimes};}
export function handle(s,path,method,p,q=new URLSearchParams(),today=bjISO(),key='') {
  object(p);
  if(path==='/api/meta')return {...s.meta,course_count:courses(s).length,lesson_count:s.lessons.length,ai_enabled:!!key,deepseek_model:s.settings.ai.model,schema_version:1,storage:'browser'};
  if(path==='/api/settings')return settings(s,key);
  if(path==='/api/courses')return {courses:courses(s)};
  if(path==='/api/ddl/alerts')return {alerts:alerts(s),modal_threshold_hours:12,banner_threshold_hours:24};
  if(path==='/api/tasks/trash')return {tasks:s.tasks.filter(t=>t.status==='deleted').sort((a,b)=>sortText(b.created_at,a.created_at)||b.id-a.id).slice(0,50)};
  if(path==='/api/tasks'&&method==='GET')return {tasks:s.tasks.filter(t=>t.status!=='deleted').sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1)||sortText(a.planned_date||a.due_date||'9999',b.planned_date||b.due_date||'9999')||a.id-b.id)};
  if(path==='/api/lists'){replan(s,today);return list(s,q,today);}
  if(path==='/api/day'){
    const d=date(q.get('date')||today);if(d===today)replan(s,today);
    const lessons=s.lessons.filter(l=>l.lesson_date===d).sort((a,b)=>a.start_section-b.start_section||a.end_section-b.end_section||sortText(a.course,b.course)).map(lessonView);
    const reviews=s.reviews.filter(r=>r.due_date===d&&(r.status==='pending'||dueDay(r.completed_at)===d)).map(r=>reviewView(s,r)).sort((a,b)=>sortText(b.status,a.status)||sortText(a.course,b.course)||a.stage-b.stage);
    const tasks=s.tasks.filter(t=>t.status==='pending'?(t.planned_date===d||dueDay(t.due_date)===d||d===today&&!t.planned_date&&!t.due_date):t.status==='completed'&&dueDay(t.completed_at)===d).sort(sortTasks);
    const delta=s.meta.semester_start?daysBetween(d,s.meta.semester_start):-1;
    return {date:d,week:lessons[0]?.week??(delta>=0&&delta<s.meta.semester_weeks*7?week(s,d):null),lessons,reviews,tasks,upcoming:s.tasks.filter(t=>t.status==='pending'&&t.due_date>=`${d}T23:59`).sort((a,b)=>sortText(a.due_date,b.due_date)).slice(0,6),ddl_alerts:alerts(s),ddl_modal_hours:12,ddl_banner_hours:24,missing_topic_count:lessons.filter(l=>!l.topic).length,progress:{review_total:reviews.filter(r=>r.status==='pending').length,task_total:tasks.filter(t=>t.status==='pending').length,review_done:s.reviews.filter(r=>r.status==='completed'&&dueDay(r.completed_at)===d).length,task_done:s.tasks.filter(t=>t.status==='completed'&&dueDay(t.completed_at)===d).length}};
  }
  if(path==='/api/calendar'){
    let start=date(q.get('start')||`${today.slice(0,7)}-01`),end=date(q.get('end')||addDays(start,40));if(start>end)[start,end]=[end,start];
    if(start<=today&&end>=today)replan(s,today);const between=d=>d>=start&&d<=end;
    return {lessons:s.lessons.filter(l=>between(l.lesson_date)).sort((a,b)=>sortText(a.lesson_date,b.lesson_date)||a.start_section-b.start_section).map(lessonView),reviews:s.reviews.filter(r=>r.status==='pending'&&between(r.due_date)).sort((a,b)=>sortText(a.due_date,b.due_date)||a.stage-b.stage).map(r=>reviewView(s,r)),tasks:s.tasks.filter(t=>t.status==='pending'&&(between(t.planned_date)||between(dueDay(t.due_date)))).sort((a,b)=>sortText(a.planned_date||a.due_date,b.planned_date||b.due_date)||a.id-b.id)};
  }
  if(path==='/api/tasks'&&method==='POST'){
    const item=taskPayload(p);if(s.tasks.some(t=>t.status!=='deleted'&&Object.keys(item).every(k=>t[k]===item[k])))fail('这条任务已经存在');
    const task={...item,id:next(s,'tasks'),status:'pending',created_at:stamp(),completed_at:''};s.tasks.push(task);return {task};
  }
  if(path==='/api/lessons'&&method==='POST'){
    const item=enrichLesson(s,lessonPayload(p));if(s.lessons.some(l=>manualLessonKey(l)===manualLessonKey(item)))fail('同一时间已存在完全相同的课程记录');
    const lesson={...item,id:next(s,'lessons'),material_ref:'',review_enabled:1};s.lessons.push(lesson);generateReviews(s,lesson,today);return {lesson:lessonView(lesson)};
  }
  const match=path.match(/^\/api\/(lessons|tasks|reviews)\/(\d+)(?:\/(topic|update|status|restore|purge|complete|undo))?$/);
  if(match){const [,table,idText,action]=match,id=Number(idText),item=find(s[table],id,table==='lessons'?'课程':table==='reviews'?'复习任务':'任务');
    if(table==='lessons'){
      if(method==='DELETE'){s.lessons=s.lessons.filter(l=>l.id!==id);s.reviews=s.reviews.filter(r=>r.lesson_id!==id);return {lesson:lessonView(item)};}
      if(action==='topic'){Object.assign(item,{topic:text(p.topic,240),lesson_code:text(p.lesson_code,80),material_ref:text(p.material_ref,1000)});}
      else if(action==='update'){const value=enrichLesson(s,lessonPayload(p));if(s.lessons.some(l=>l.id!==id&&manualLessonKey(l)===manualLessonKey(value)))fail('同一时间已存在完全相同的课程记录');Object.assign(item,value);}
      else fail('课程操作无效');
      if(item.topic)generateReviews(s,item,today);else s.reviews=s.reviews.filter(r=>r.lesson_id!==id||r.status==='completed');
      return {lesson:lessonView(item),review_count:s.reviews.filter(r=>r.lesson_id===id).length};
    }
    if(table==='reviews'){if(action==='complete')complete(s,id,p.completed_date||today);else if(action==='undo')undo(s,id);else fail('复习操作无效');return {ok:true};}
    if(action==='purge'){if(item.status!=='deleted')fail('请先删除这条任务，再从回收站彻底清除');s.tasks=s.tasks.filter(t=>t.id!==id);return {task:item};}
    if(action==='restore'){if(item.status!=='deleted')fail('这条任务没有被删除');return taskStatus(s,id,'pending');}
    if(action==='status'||method==='DELETE')return taskStatus(s,id,method==='DELETE'?'deleted':p.status||'pending');
    if(action==='update'){if(item.status==='deleted')fail('任务不存在');Object.assign(item,taskPayload(p));return {task:item};}
  }
  if(path==='/api/settings/appearance'){s.settings.appearance=appearance(p);return settings(s,key);}
  if(path==='/api/settings/review'){s.settings.review_offsets=offsets(p.review_offsets);return settings(s,key);}
  if(path==='/api/schedule/preview'||path==='/api/schedule/import')return importSchedule(s,p,path.endsWith('preview'));
  fail('API 路径不存在');
}

export function validateBackup(p) {
  object(p);if(p.format!=='study-planner-browser-backup'||p.version!==1)fail('备份格式或版本不支持');
  const raw=object(p.data);if(raw.version!==1)fail('存档版本不支持');
  const s=emptyState(),meta=object(raw.meta),config=object(raw.settings);
  s.meta={semester_start:date(meta.semester_start),semester_weeks:integer(meta.semester_weeks,1,54,'学期周数'),source:text(meta.source,500)};
  s.settings={appearance:appearance(object(config.appearance)),review_offsets:offsets(config.review_offsets),ai:aiConfig(object(config.ai))};
  const idsets={};
  for(const table of ['lessons','reviews','tasks']){
    if(!Array.isArray(raw[table])||raw[table].length>100000)fail('备份记录数量无效');
    const ids=new Set();idsets[table]=ids;
    s[table]=raw[table].map(item=>{
      object(item);const id=integer(item.id,1,Number.MAX_SAFE_INTEGER,'记录 ID');if(ids.has(id))fail('备份有重复 ID');ids.add(id);
      if(table==='lessons'){const value=lessonPayload(item);return {...enrichLesson(s,value),id,week:integer(item.week,1,10000,'课程周次'),review_enabled:integer(item.review_enabled,0,1,'复习开关'),material_ref:text(item.material_ref,1000)};}
      const status=text(item.status,20);if(!(table==='reviews'?['pending','completed']:['pending','completed','deleted']).includes(status))fail('备份状态无效');
      const created_at=timestamp(item.created_at),completed_at=timestamp(item.completed_at);
      if(status==='completed'&&!completed_at)fail('已完成记录缺少完成时间');
      if(table==='tasks')return {...taskPayload(item),id,status,created_at,completed_at};
      return {id,lesson_id:integer(item.lesson_id,1,Number.MAX_SAFE_INTEGER,'课程 ID'),stage:integer(item.stage,1,366,'复习阶段'),due_date:date(item.due_date,'复习日期',true),status,created_at,completed_at};
    });
    s.ids[table]=Math.max(integer(object(raw.ids)[table],0,Number.MAX_SAFE_INTEGER-1,'记录序号'),[...ids].reduce((max,id)=>Math.max(max,id),0));
  }
  if(new Set(s.lessons.map(manualLessonKey)).size!==s.lessons.length)fail('备份有重复课程');
  const reviewKeys=new Set();for(const r of s.reviews){if(!idsets.lessons.has(r.lesson_id))fail('复习记录关联的课程缺失');const k=`${r.lesson_id}/${r.stage}`;if(reviewKeys.has(k))fail('备份有重复复习阶段');reviewKeys.add(k);}
  return s;
}
function timestamp(value) {
  const s=text(value,19);if(!s)return '';
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s))fail('备份时间格式无效');
  date(s.slice(0,10),'记录日期',true);datetime(s.slice(0,16));if(+s.slice(17)>59)fail('记录时间无效');return s;
}
export function backup(s) {return {format:'study-planner-browser-backup',version:1,exported_at:stamp(),timezone:'Asia/Shanghai',data:structuredClone(s)};}
