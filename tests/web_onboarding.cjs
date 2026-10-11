const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:18770/';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  for(const width of [1440,393]){
   const context=await browser.newContext({viewport:{width,height:960}}),p=await context.newPage(),errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   const read=()=>p.evaluate(async()=>{const {transact}=await import('./storage.js');return transact(s=>s);});
   await p.goto(base+'web/');await p.locator('#guideWelcome[open]').waitFor();
   const before=await read();assert.equal(before.lessons.length,7);assert.equal(before.tasks.length,4);
   await p.locator('#guideStart').click();
   const targets=['#lessonList','.topic-editor','#weekGrid','#lessonModal.open','#calendarGrid','#reviewsView','.inline-task-editor','#trashList','#quickAddModal.open','#ddlsView','#appearanceForm','#aiForm','#scheduleDropZone','.web-storage-card'];
   for(let i=0;i<14;i++){
    await p.waitForFunction(n=>document.querySelector('#guideCount').textContent===`${n} / 14`&&!document.querySelector('#guideNext').disabled,i+1);
    assert.ok(await p.locator(targets[i]).first().isVisible(),`step ${i+1} width ${width}`);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow step ${i+1}`);
    if(i===1){await p.locator('.topic-editor .topic-input').fill('未保存的主题');p.once('dialog',d=>d.dismiss());await p.locator('#guideNext').click();assert.equal(await p.locator('#guideCount').textContent(),'2 / 14');p.once('dialog',d=>d.accept());}
    if(i===3){
     await p.locator('#guideNext').focus();await p.keyboard.press('Shift+Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'guidePrev');
     await p.locator('#lessonCourse').fill('尚未保存');
     p.once('dialog',d=>d.dismiss());await p.locator('#guideNext').click();assert.equal(await p.locator('#guideCount').textContent(),'4 / 14');
     p.once('dialog',d=>d.accept());
    }
    if(process.env.GUIDE_SHOTS && [3,8].includes(i))await p.screenshot({path:`${process.env.GUIDE_SHOTS}/guide-${width}-${i}.png`,animations:'disabled'});
    await p.locator('#guideNext').click();
   }
   await p.locator('#guidePanel').waitFor({state:'hidden'});
   const after=await read();assert.deepEqual(after.lessons,before.lessons);assert.deepEqual(after.tasks,before.tasks);assert.deepEqual(after.reviews,before.reviews);
   assert.equal(after.onboarding.status,'done');
   await p.reload();await p.locator('#openGuideBtn').waitFor();assert.equal(await p.locator('#guideWelcome').getAttribute('open'),null);
   await p.locator('#openGuideBtn').click();await p.locator('#guideStart').click();
   await p.waitForFunction(()=>document.querySelector('#guideCount').textContent==='1 / 14'&&!document.querySelector('#guideNext').disabled);
   await p.locator('#guidePause').click();
   await p.evaluate(async()=>{await fetch('/api/tasks',{method:'POST',body:JSON.stringify({title:'自己的待办'})});});
   const schedule=await p.evaluate(async()=>{const {bjISO,startOfWeek}=await import('./core.js');return {format:'study-planner-schedule',version:1,metadata:{timezone:'Asia/Shanghai',semester_start:startOfWeek(bjISO()),semester_weeks:18},lessons:[{lesson_date:bjISO(),course:'自己的课程',start_section:1,end_section:2}]};});
   await p.locator('[data-view=settings]').click();await p.locator('#scheduleFile').setInputFiles({name:'own.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(schedule))});
   await p.locator('#schedulePreview').filter({hasText:'7'}).waitFor();assert.equal((await read()).lessons.length,7);
   await p.locator('#importScheduleBtn').click();await p.getByText('载入完成：新增 1 节',{exact:false}).waitFor();
   const imported=await read();assert.deepEqual(imported.lessons.map(l=>l.course),['自己的课程']);assert.deepEqual(imported.tasks.map(t=>t.title),['自己的待办']);assert.equal(imported.reviews.length,0);
   await p.locator('#exampleBanner').waitFor({state:'hidden'});await p.reload();await p.locator('#openGuideBtn').waitFor();assert.equal((await read()).lessons.length,1);
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Onboarding: all 14 real screens, desktop/mobile, unsaved edits, pause/reopen, example replacement and personal record retention passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
