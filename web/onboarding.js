import {transact} from './storage.js';
import {bjISO, toast} from './core.js';

const steps=[
  ['认识首页','先看今天，再决定做什么','首页把当天课程、复习、待办和到期提醒放在一起。这一周是虚构示例，可以放心练习；绿色、黄色、红色分别对应复习、待办、到期。','home','#lessonList'],
  ['课程主题','展开本节主题','已为你展开主题编辑栏。写下这节课学了什么并保存，才会生成复习链；仅有课表不会自动产生复习。可以点击“暂停，自己试试”再修改。','home','.topic-editor', 'topic'],
  ['周课表','一周上课安排，一眼看清','周课表按节次摆放课程。点击空白格可以添加课程；点击已有课程可以改日期、节次、地点。示例覆盖当前一周。','week','#weekGrid'],
  ['调课弹窗','课程可以直接调整','已打开一节课程的编辑弹窗。修改上课日期就是调课，也可修改教师、教室和主题。指引不会自动保存或删除，确认好再点击“保存课程”。','week','#lessonModal','lesson'],
  ['月清单','看这个月要跟进的事','月清单展示复习、待办、DDL 的日期与提示灯；课程时间安排看周课表。点某一天可以展开当天明细。','month','#calendarGrid'],
  ['复习清单','勾选完成，也可以撤销','这里切换到“全部事项”，方便看到完整复习安排。复习按到期日分组，勾选后完成；底部撤销按钮有倒计时。逾期时后续安排会一起顺延。','reviews','#reviewsView [data-list-groups]'],
  ['待办清单','在原行编辑，不用来回跳','已展开一条任务的编辑栏。这里能改标题、计划日、截止时间和备注；保存后立即更新。任务完成后，相关到期提醒也会取消。','todos','.inline-task-editor','task'],
  ['回收站','删除后仍能找回来','已展开回收站，里面有一条示例记录可练习恢复。删除任务后先有短时撤销；错过倒计时也能从这里恢复，不会因倒计时结束而永久删除。','todos','#trashCard','trash'],
  ['添加与解析','打开添加事项弹窗','这里可以手动录入任务。可选的一句话解析会把凌乱输入整理为步骤、材料、注意事项和待确认；配置 API 后才能解析，结果需确认添加才保存。','todos','#quickAddModal','add'],
  ['到期清单','截止提醒与任务联动','到期清单只做提醒，不需要再勾一次。需要修改时点编辑图标；实际完成请在待办清单打钩。只有日期、没填时间时，截止按当天 23:59 处理。','ddls','#ddlsView'],
  ['外观调整','挑配色，也调阅读手感','左边选主题，右边调颜色、密度和字号。拖动字号滑块可实时预览；预设配色锁定，选“纯色”可自行调色。调整完记得保存外观。','settings','#appearanceForm'],
  ['AI 接口','填自己的接口，先测试连接','填写 HTTPS 地址、模型和自己的 Key，保存后自动测试。手动功能完全不需要 Key。网页接口须支持浏览器直连；解析输入会发给所选服务商，普通备份不含密钥。','settings','#aiForm'],
  ['个人课表','用自己的 JSON 换掉示例','下载这里的 Skill，把 Skill 和课表交给 AI，生成 JSON；拖入文件、核对预览，再载入。首次载入会替换所有标记为示例的课程、复习和示例任务；自己添加的记录保留。以后导入只新增并去重。','settings','#scheduleDropZone'],
  ['存档与快捷键','把练习变成自己的学习日历','在这里导出备份、申请持久存储、安装 Web App；下方还有快捷键说明。数据属于当前浏览器，清除网站数据会删除记录。指引可随时从设置重新打开，不会重新插入示例。','settings','.web-storage-card'],
];
const visible = el => el && el.getClientRects().length && getComputedStyle(el).visibility!=='hidden';
const values = form => JSON.stringify([...form.querySelectorAll('input,textarea,select')].map(el=>[el.name||el.id,el.value]));
async function waitFor(selector) {
  const end=performance.now()+5000;
  while(performance.now()<end){const el=[...document.querySelectorAll(selector)].find(visible);if(el)return el;await new Promise(r=>setTimeout(r,40));}
  return null;
}
export async function setupOnboarding() {
  const saved=await transact(s=>({guide:s.onboarding,examples:s.lessons.some(l=>l.is_example)}));
  const reopen=document.createElement('button');reopen.id='openGuideBtn';reopen.className='secondary-btn';reopen.textContent='新手操作指引';
  document.querySelector('.web-storage-actions').prepend(reopen);
  const banner=document.createElement('div');banner.className='guide-example-banner';banner.id='exampleBanner';
  banner.innerHTML='<strong>当前包含一周示例</strong><span>可编辑练习；载入个人 JSON 会替换示例课程与练习，自己添加的记录保留。</span><button class="text-btn" id="bannerGuideBtn">查看指引 →</button>';
  banner.hidden=!saved.examples;document.querySelector('.main').prepend(banner);
  document.querySelector('#scheduleDropZone').parentElement.querySelectorAll('.field-help')[1].textContent='载入时替换标记为示例的课程、关联复习及示例任务，自己添加的记录保留；以后导入只新增并去重。';
  const welcome=document.createElement('dialog');welcome.id='guideWelcome';welcome.className='guide-welcome';
  welcome.innerHTML=`<div class="board-kicker">Start here</div><h2>跟着示例，走一遍学习日历</h2><p>按章节打开页面、展开编辑栏与弹窗。你可以随时暂停，亲自修改；指引不会自动提交任何操作。</p><div class="guide-welcome-map">看首页 <span>→</span> 调课表 <span>→</span> 管清单 <span>→</span> 改设置</div><p class="field-help">示例不是你的真实课表。载入个人 JSON 时会替换示例，自己添加的课程、任务会保留。</p><div class="form-actions"><button class="ghost-btn" id="guideSkip">稍后再看</button><button class="primary-btn" id="guideStart">开始指引</button></div>`;
  document.body.append(welcome);
  const panel=document.createElement('aside');panel.id='guidePanel';panel.className='guide-panel';panel.hidden=true;panel.setAttribute('aria-label','新手操作指引');
  panel.innerHTML=`<div class="guide-panel-head"><span id="guideChapter"></span><button class="text-btn" id="guidePause">暂停，自己试试</button></div><div class="guide-progress" aria-hidden="true"><span id="guideProgress"></span></div><div aria-live="polite"><h2 id="guideTitle"></h2><p id="guideText"></p></div><div class="guide-actions"><button class="ghost-btn" id="guidePrev">上一步</button><span id="guideCount"></span><button class="primary-btn" id="guideNext">下一步</button></div>`;
  document.body.append(panel);
  let index=saved.guide?.status==='done'?0:saved.guide?.step||0,active=false,busy=false,target=null,forms=new Map();
  const persist=status=>transact(s=>{s.onboarding={version:1,status,step:index};});
  function clearHighlight(){target?.classList.remove('guide-target');target=null;}
  const resize=new ResizeObserver(()=>document.body.style.setProperty('--guide-height',`${panel.offsetHeight}px`));resize.observe(panel);
  function closeOpened(){['closeModal','closeLessonModal','closeDrawer'].forEach(id=>document.getElementById(id)?.click());document.querySelectorAll('.inline-task-editor button[type="button"]').forEach(btn=>btn.click());}
  function canLeave(){return ![...forms].some(([form,before])=>visible(form)&&values(form)!==before)||confirm('这一步的编辑尚未提交。继续指引会关闭编辑，是否放弃未保存的修改？也可以取消后先保存或暂停指引。');}
  async function showStep(nextIndex) {
    if(busy||!canLeave())return;
    busy=true;panel.querySelectorAll('button').forEach(btn=>btn.disabled=true);
    try {
      closeOpened();clearHighlight();index=nextIndex;active=true;panel.hidden=false;document.body.classList.add('guide-active');
      const [chapter,title,description,view,selector,action]=steps[index];
      document.getElementById('guideChapter').textContent=chapter;document.getElementById('guideTitle').textContent=title;document.getElementById('guideText').textContent=description;
      document.getElementById('guideCount').textContent=`${index+1} / ${steps.length}`;document.getElementById('guideProgress').style.width=`${(index+1)/steps.length*100}%`;document.getElementById('guideNext').textContent=index===steps.length-1?'完成指引':'下一步';
      const routes={home:`#/home/${bjISO()}`,week:`#/calendar/week/${bjISO()}`,month:`#/calendar/month/${bjISO().slice(0,7)}`,reviews:'#/reviews/all',todos:'#/todos/all',ddls:'#/ddls/all',settings:'#/settings'};
      location.hash=routes[view];await new Promise(r=>setTimeout(r,0));
      const container=await waitFor(`#${view==='week'||view==='month'?'calendar':view}View`);
      if(action==='topic'){const btn=await waitFor('#lessonList .topic-toggle, #lessonList .edit-topic');btn?.click();}
      if(action==='lesson'){const btn=await waitFor('#weekGrid .week-event');btn?.click();}
      if(action==='task'){const btn=await waitFor('#todosView .edit-task');btn?.click();}
      if(action==='trash'){await waitFor('#toggleTrash');if(document.getElementById('trashList').classList.contains('hidden'))document.getElementById('toggleTrash').click();}
      if(action==='add')document.getElementById('quickAddBtn').click();
      target=await waitFor(selector)||container;
      if(target){target.classList.add('guide-target');target.scrollIntoView({block:'center',behavior:'instant'});}
      forms=new Map([...document.querySelectorAll('#taskForm,#lessonForm,.inline-task-editor,.topic-editor')].filter(visible).map(f=>[f,values(f)]));
      await persist('running');
      document.getElementById('guideNext').focus({preventScroll:true});
    }catch(e){toast(`指引暂时无法展开：${e.message}`);}
    finally{busy=false;panel.querySelectorAll('button').forEach(btn=>btn.disabled=false);document.getElementById('guidePrev').disabled=index===0;}
  }
  async function pause(status='dismissed'){active=false;panel.hidden=true;document.body.classList.remove('guide-active');clearHighlight();await persist(status);}
  async function open(){if(active)return;welcome.querySelector('h2').textContent=index?'继续走一遍学习日历':'跟着示例，走一遍学习日历';welcome.showModal();}
  reopen.onclick=open;document.getElementById('bannerGuideBtn').onclick=open;
  document.getElementById('guideSkip').onclick=async()=>{welcome.close();await persist('dismissed');};
  welcome.addEventListener('cancel',()=>{persist('dismissed').catch(e=>toast(e.message));});
  document.getElementById('guideStart').onclick=()=>{welcome.close();showStep(index);};
  document.getElementById('guidePause').onclick=()=>pause().catch(e=>toast(e.message));
  document.getElementById('guidePrev').onclick=()=>showStep(index-1);
  document.getElementById('guideNext').onclick=async()=>{if(index<steps.length-1)return showStep(index+1);await pause('done');toast('指引已完成，随时可从设置重新打开');};
  window.addEventListener('schedule-imported',async()=>{banner.hidden=!(await transact(s=>s.lessons.some(l=>l.is_example)));});
  if(saved.guide&&['pending','running'].includes(saved.guide.status)){await waitFor('#sidebarMeta');await open();}
}
