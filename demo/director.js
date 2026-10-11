(() => {
  const scene=new URLSearchParams(location.search).get('scene');
  if(!scene)return;
  // App callbacks also focus controls; autoplay must never scroll the containing page.
  const nativeFocus=HTMLElement.prototype.focus;
  HTMLElement.prototype.focus=function(options){return nativeFocus.call(this,{...options,preventScroll:true})};
  function reveal(el){
    for(let box=el.parentElement;box;box=box.parentElement){
      const root=box===document.scrollingElement;
      if(box.scrollHeight<=box.clientHeight||(!root&&!/^(auto|scroll)$/.test(getComputedStyle(box).overflowY)))continue;
      const r=el.getBoundingClientRect(),b=root?{top:0,bottom:innerHeight}:box.getBoundingClientRect();
      const delta=r.top<b.top+20?r.top-b.top-20:r.bottom>b.bottom-20?r.bottom-b.bottom+20:0;
      if(delta)box.scrollTo({top:box.scrollTop+delta,behavior:'instant'});
    }
  }
  location.hash={home:'#/home',calendar:'#/calendar/week',reviews:'#/reviews',todos:'#/todos',ddls:'#/ddls/all',settings:'#/settings'}[scene]||'#/home';
  let playing=false,generation=0;
  const pointer=document.createElement('div');pointer.className='demo-cursor';pointer.hidden=true;document.body.append(pointer);
  const report=text=>parent.postMessage({demoScene:scene,text},location.origin);
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function run(token){
    const check=()=>{if(!playing||token!==generation)throw Error('paused')};
    const pause=async ms=>{await wait(ms);check()};
    const find=async selector=>{for(let i=0;i<35;i++){check();const el=document.querySelector(selector);if(el&&el.getBoundingClientRect().height)return el;await pause(100)}throw Error('Missing scene target: '+selector)};
    const click=async selector=>{const el=await find(selector);reveal(el);await pause(300);const r=el.getBoundingClientRect();pointer.hidden=false;pointer.style.left=r.left+r.width*.65+'px';pointer.style.top=r.top+r.height*.5+'px';await pause(850);pointer.classList.add('click');el.click();await pause(250);pointer.classList.remove('click');await pause(850)};
    const type=async(selector,text)=>{const el=await find(selector);reveal(el);el.focus({preventScroll:true});el.value='';for(const c of text){check();el.value+=c;el.dispatchEvent(new Event('input',{bubbles:true}));await pause(55)}await pause(800)};
    const route=async hash=>{location.hash='#/home';await pause(150);location.hash=hash;await pause(1000)};
    while(playing&&token===generation){
      document.querySelector('#closeModal')?.click();
      document.querySelector('#closeLessonModal')?.click();
      window.resetDemo();
      if(scene==='home'){report('首页，把今天要做的事放在一起');await route('#/home');await pause(1900);report('记录课后主题，接上复习安排');await click('#lessonList .edit-topic');await type('#lessonList .topic-input','概念地图与重点回顾');await click('#lessonList .save-topic');}
      if(scene==='calendar'){report('周课表专注课程时间与地点');await route('#/calendar/week');await pause(2300);report('切换月清单，查看复习、待办和截止日期');await click('#calendarModeSwitch [data-mode="month"]');await pause(1900);await click('#calendarModeSwitch [data-mode="week"]');}
      if(scene==='reviews'){report('按日期查看复习主题');await route('#/reviews');await pause(1800);report('完成一项复习，勾选后即时更新');await click('#reviewsView .toggle-review');await pause(1400);report('误点也可以撤销');await click('#actionToast button');}
      if(scene==='todos'){report('直接在清单里添加、编辑与删除');await route('#/todos');await click('#quickAddBtn');await type('#taskTitle','整理今天的学习笔记');await type('#taskNotes','重点：建立概念地图\n材料：课堂笔记\n交付：一页学习总结');await click('#taskForm button[type="submit"]');await pause(1300);report('删除后保留撤销窗口和倒计时');await click('#todosView .delete-task');await pause(2200);await click('#actionToast button');}
      if(scene==='ddls'){report('截止清单集中查看到期时间');await route('#/ddls/all');await pause(1500);report('在当前清单直接调整事项，无需跳转');await click('#ddlsView .edit-task');await type('#ddlsView .inline-task-editor [name="title"]','课程报告 · 最终稿提交');await click('#ddlsView .inline-task-editor button[type="submit"]');}
      if(scene==='settings'){report('选择喜欢的配色，界面即时变化');await route('#/settings');await click('[data-theme="vanilla-cream"]');await pause(1400);report('调整字号与密度，找到合适的阅读节奏');const slider=await find('#fontScaleInput');reveal(slider);for(const value of [14,16,18,20]){slider.value=value;slider.dispatchEvent(new Event('input',{bubbles:true}));await pause(350)}await click('#densityInput');await pause(900);await click('[data-theme="lemon-salt"]');}
      pointer.hidden=true;report('自动演示 · 此处使用虚构数据');await pause(3500);
    }
  }
  window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||typeof e.data?.playDemo!=='boolean')return;playing=e.data.playDemo;generation++;pointer.hidden=!playing;if(playing)run(generation).catch(e=>{pointer.hidden=true;if(e.message!=='paused'){report('演示暂不可用，请打开交互试用');console.error(e)}})});
  window.demoDirectorReady=true;
  parent.postMessage({demoReady:scene},location.origin);
})();
