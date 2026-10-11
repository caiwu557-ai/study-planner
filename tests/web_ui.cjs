const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:18770/';
const browserOptions={headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})};
(async()=>{
  const browser=await chromium.launch(browserOptions),context=await browser.newContext({viewport:{width:1280,height:960}}),errors=[],unexpected=[],aiRequests=[];
  try {
    await context.route('https://**',route=>{unexpected.push(route.request().url());return route.abort();});
    await context.route('https://api.provider.test/**',async route=>{
      const request=route.request(),body=JSON.parse(request.postData());aiRequests.push({url:request.url(),key:request.headers().authorization,body});
      const content=body.messages[0].role==='system'?JSON.stringify({title:'AI 整理任务',course:'示例课程',type:'assignment',planned_date:'',due_date:'',notes:{steps:['阅读资料','整理笔记'],materials:['讲义'],requirements:[],unclear:[]}}):'OK';
      await route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content}}]})});
    });
    const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
    p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))unexpected.push(r.url());});
    await p.goto(base+'web/');await p.waitForFunction(()=>document.querySelector('#sidebarMeta').textContent.includes('浏览器存档'));
    assert.equal(await p.locator('#numLessons').textContent(),'0');
    const request=async(page,path,payload,method='POST')=>page.evaluate(async({path,payload,method})=>{const res=await fetch(path,{method,body:method==='GET'?undefined:JSON.stringify(payload)});return {ok:res.ok,data:await res.json()};},{path,payload,method});
    const today=await p.evaluate(async()=>{const {bjISO}=await import('./core.js');return bjISO();});
    const monday=await p.evaluate(async()=>{const {startOfWeek,bjISO}=await import('./core.js');return startOfWeek(bjISO());});
    const schedule={format:'study-planner-schedule',version:1,metadata:{timezone:'Asia/Shanghai',semester_start:monday,semester_weeks:18,source:'虚构测试'},lessons:[{lesson_date:today,course:'示例课程',start_section:1,end_section:2,teacher:'',location:'教室'}]};
    await p.locator('[data-view=settings]').click();
    await p.locator('#scheduleFile').setInputFiles({name:'schedule.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(schedule))});
    await p.locator('#importScheduleBtn').click();await p.getByText('载入完成：新增 1 节',{exact:false}).waitFor();
    await p.reload();await p.locator('#sidebarMeta').filter({hasText:'1 次课程'}).waitFor();
    await p.locator('[data-view=home]').click();await p.locator('#lessonList .lesson-title').first().waitFor();
    assert.equal((await request(p,'/api/lessons/1/topic',{topic:'真实复习测试'})).ok,true);
    await p.locator('[data-view=reviews]').click();
    // First review is tomorrow: inspect all, then tick and undo in the real UI.
    await p.locator('#reviewsView [data-mode=all]').click();
    await p.locator('#reviewsView .toggle-review').first().click();await p.locator('#reviewsView .is-done').first().waitFor();
    await p.locator('#actionToast button').click();await p.locator('#reviewsView .toggle-review').first().waitFor();
    await p.locator('[data-view=todos]').click();await p.locator('#quickAddBtn').click();
    const title='浏览器 <img src=x onerror=alert(1)> & 任务';await p.locator('#taskTitle').fill(title);await p.locator('#taskForm button[type=submit]').click();
    await p.getByText(title,{exact:true}).waitFor();assert.equal(await p.locator('#todosView img').count(),0);
    await p.reload();await p.getByText(title,{exact:true}).waitFor();
    const row=p.locator('#todosView .task-item').filter({hasText:title});await row.locator('.edit-task').click();await row.locator('[name=title]').fill('修改后任务');await row.locator('button[type=submit]').click();
    const edited=p.locator('#todosView .task-item').filter({hasText:'修改后任务'});await edited.locator('.delete-task').click();await p.locator('#toggleTrash').click();await p.locator('#trashList button').first().click();await edited.waitFor();
    // Separate browser contexts have independent IndexedDB, demo data stays isolated.
    const other=await browser.newContext();const isolated=await other.newPage();await isolated.goto(base+'web/');await isolated.waitForFunction(()=>document.querySelector('#sidebarMeta').textContent.includes('浏览器存档'));
    assert.equal(await isolated.locator('#numLessons').textContent(),'0');assert.equal((await request(isolated,'/api/tasks',{},'GET')).data.tasks.length,0);await other.close();
    const beforeDemo=(await request(p,'/api/tasks',{},'GET')).data.tasks.length;const demo=await context.newPage();await demo.goto(base+'app/');await demo.locator('#lessonList .lesson-title').first().waitFor();
    assert.ok(Number(await demo.locator('#numLessons').textContent())>0);await demo.close();assert.equal((await request(p,'/api/tasks',{},'GET')).data.tasks.length,beforeDemo);
    // Two tabs mutate concurrently without losing any task or duplicating IDs.
    const second=await context.newPage();await second.goto(base+'web/');await second.waitForFunction(()=>document.querySelector('#sidebarMeta').textContent.includes('浏览器存档'));
    const results=await Promise.all(Array.from({length:20},(_,i)=>request(i%2?p:second,'/api/tasks',{title:`并发任务 ${i}`})));assert.ok(results.every(r=>r.ok));
    const all=(await request(p,'/api/tasks',{},'GET')).data.tasks;assert.equal(all.filter(t=>t.title.startsWith('并发任务')).length,20);assert.equal(new Set(all.map(t=>t.id)).size,all.length);
    await second.close();
    // Malformed import rejects all records, transaction failure preserves the saved state.
    const invalid=structuredClone(schedule);invalid.lessons.push({...schedule.lessons[0],lesson_date:'2026-02-30'});
    assert.equal((await request(p,'/api/schedule/import',invalid)).ok,false);
    assert.equal((await request(p,'/api/meta',{},'GET')).data.lesson_count,1);
    assert.equal((await request(p,'/api/tasks',{title:'错误日期',due_date:'2026-02-30'})).ok,false);
    await p.locator('[data-view=settings]').click();await p.locator('[data-theme=vanilla-cream]').click();await p.locator('#fontScaleInput').fill('18');
    await p.locator('#aiBaseUrlInput').fill('https://api.provider.test/v1');await p.locator('#aiKeyInput').fill('fake-test-key');await p.locator('#reviewOffsetsInput').fill('0, 2, 5');
    await p.locator('#appearanceForm button[type=submit]').click();await p.locator('#toast').filter({hasText:'外观设置已保存'}).waitFor();
    assert.equal(await p.locator('#aiBaseUrlInput').inputValue(),'https://api.provider.test/v1');assert.equal(await p.locator('#aiKeyInput').inputValue(),'fake-test-key');assert.equal(await p.locator('#reviewOffsetsInput').inputValue(),'0, 2, 5');
    await p.locator('#aiBaseUrlInput').fill('https://api.provider.test/v1');await p.locator('#aiModelInput').fill('test-model');await p.locator('#aiKeyInput').fill('fake-test-key');await p.locator('#aiForm button[type=submit]').click();await p.waitForFunction(()=>['success','error'].includes(document.querySelector('#apiTestStatus').dataset.state));assert.match(await p.locator('#apiTestStatus').textContent(),/连接成功/);
    await p.reload();await p.locator('#apiConfiguredNote').filter({hasText:'已配置'}).waitFor();assert.equal(await p.locator('#fontScaleInput').inputValue(),'18');
    assert.equal((await request(p,'/api/settings',{},'GET')).data.ai.api_key_configured,true);
    assert.equal((await request(p,'/api/ai/test',{base_url:'https://different.provider.test',model:'test-model'})).ok,false);
    await p.locator('#quickAddBtn').click();await p.locator('#aiInput').fill('阅读讲义，再整理笔记');await p.locator('#aiParseBtn').click();await p.waitForFunction(()=>document.querySelector('#taskTitle').value==='AI 整理任务');
    assert.equal(await p.locator('#taskNotes').inputValue(),'执行步骤\n1. 阅读资料\n2. 整理笔记\n\n材料与资料\n1. 讲义');await p.locator('#cancelTask').click();
    assert.ok(aiRequests.every(r=>r.key==='Bearer fake-test-key'));assert.ok(aiRequests[0].body.messages.every(m=>!m.content.includes('真实复习测试')));
    const downloadPromise=p.waitForEvent('download');await p.locator('#exportBackupBtn').click();const download=await downloadPromise;const exported=JSON.parse(require('node:fs').readFileSync(await download.path(),'utf8'));
    assert.equal(exported.format,'study-planner-browser-backup');assert.ok(!JSON.stringify(exported).includes('fake-test-key'));
    const broken=structuredClone(exported);broken.data.reviews[0].lesson_id=999;
    await p.locator('#backupFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(broken))});await p.locator('#backupPreview').filter({hasText:'无法恢复'}).waitFor();assert.equal(await p.locator('#restoreBackupBtn').isVisible(),false);
    await p.locator('#backupFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await p.locator('#restoreBackupBtn').waitFor();
    const beforeRestore=all.length;await request(p,'/api/tasks',{title:'恢复前新增'});
    p.once('dialog',dialog=>dialog.accept());await Promise.all([p.waitForEvent('load'),p.locator('#restoreBackupBtn').click()]);await p.waitForFunction(()=>document.querySelector('#sidebarMeta').textContent.includes('浏览器存档'));
    assert.equal((await request(p,'/api/tasks',{},'GET')).data.tasks.length,beforeRestore);assert.equal((await request(p,'/api/settings',{},'GET')).data.ai.api_key_configured,true);
    const recovery=await p.evaluate(async()=>{const {exportRecovery}=await import('./storage.js');return exportRecovery();});assert.ok(recovery.data.tasks.some(t=>t.title==='恢复前新增'));assert.ok(!JSON.stringify(recovery).includes('fake-test-key'));
    // Cached code and IndexedDB keep the app usable offline, with no API server.
    await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>navigator.serviceWorker.controller);await context.setOffline(true);await p.reload();await p.waitForFunction(()=>document.querySelector('#sidebarMeta').textContent.includes('浏览器存档'));
    assert.equal((await request(p,'/api/tasks',{title:'离线添加'})).ok,true);await p.reload();assert.ok((await request(p,'/api/tasks',{},'GET')).data.tasks.some(t=>t.title==='离线添加'));
    await context.setOffline(false);await p.locator('[data-view=settings]').click();await p.locator('#clearApiKeyBtn').click();await p.locator('#apiConfiguredNote').filter({hasText:'未配置'}).waitFor();await p.reload();assert.equal((await request(p,'/api/settings',{},'GET')).data.ai.api_key_configured,false);
    const manifest=await (await p.request.get(base+'web/manifest.json')).json();assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'./');
    const phoneContext=await browser.newContext({viewport:{width:393,height:852}}),phone=await phoneContext.newPage();phone.on('pageerror',e=>errors.push(e.message));
    await phone.goto(base+'web/');await phone.waitForFunction(()=>document.querySelector('#sidebarMeta').textContent.includes('浏览器存档'));
    assert.equal(await phone.locator('#app').getAttribute('class'),'rail-collapsed');await request(phone,'/api/schedule/import',schedule);await request(phone,'/api/lessons/1/topic',{topic:'手机课表与复习'});await request(phone,'/api/tasks',{title:'手机长标题任务用于验证清单换行显示',planned_date:today,due_date:today});await phone.reload();await phone.waitForFunction(()=>document.querySelector('#sidebarMeta').textContent.includes('浏览器存档'));
    for(const view of ['home','reviews','todos','ddls','calendar','settings']){await phone.locator(`[data-view=${view}]`).click();assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Mobile overflow: ${view}`);}
    await phone.locator('[data-view=calendar]').click();await phone.locator('[data-mode=month]').click();assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await phone.locator('[data-view=settings]').click();
    if(process.env.WEB_SCREENSHOT)await phone.screenshot({path:process.env.WEB_SCREENSHOT,fullPage:true,animations:'disabled'});await phoneContext.close();
    assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
    console.log('Browser UI: real import/review/tasks, reload, independent users, demo isolation, concurrent tabs, rollback, AI mocks, backup/restore, offline and mobile passed.');
  }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
