const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const base = process.argv[2] || 'http://127.0.0.1:18769/';
  const errors = [];
  try {
    const page = await browser.newPage({viewport:{width:1280,height:960}});
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'app/');
    await page.locator('#lessonList .lesson-title').first().waitFor();
    assert.ok(Number(await page.locator('#numLessons').textContent())>0);
    await page.locator('[data-view="reviews"]').click();
    await page.locator('#reviewsView .toggle-review').first().click();
    await page.locator('#reviewsView .is-done').first().waitFor();
    assert.ok(await page.locator('#reviewsView .is-done').count()>0);
    await page.locator('[data-view="todos"]').click();
    await page.locator('#quickAddBtn').click();
    const title='演示 <img src=x onerror=alert(1)> & 笔记';
    await page.locator('#taskTitle').fill(title);
    await page.locator('#taskForm button[type=submit]').click();
    await page.getByText(title,{exact:true}).waitFor();
    assert.equal(await page.locator('#todosView img').count(),0);
    const row=page.locator('#todosView .task-item').filter({hasText:title});
    await row.locator('.edit-task').click();
    await row.locator('[name=title]').fill('更新后的演示任务');
    await row.locator('button[type=submit]').click();
    const updated=page.locator('#todosView .task-item').filter({hasText:'更新后的演示任务'});
    await updated.locator('.delete-task').click();
    await page.locator('#actionToast button').click();
    await updated.waitFor();
    await updated.locator('.delete-task').click();
    await page.locator('#toggleTrash').click();
    assert.ok(await page.locator('#trashList').textContent().then(t=>t.includes('更新后的演示任务')));
    await page.locator('#trashList button').first().click();
    await updated.waitFor();
    await page.locator('[data-view=settings]').click();
    assert.equal(await page.locator('#aiKeyInput').isDisabled(),true);
    await page.locator('[data-theme=vanilla-cream]').click();
    await page.locator('#fontScaleInput').fill('18');
    assert.equal(await page.locator('#fontScaleInput').inputValue(),'18');
    await page.locator('#testApiBtn').click();
    await page.getByText('展示页不连接 AI，也不保存密钥；请在完整版体验。',{exact:false}).first().waitFor();
    const scenes=['home','calendar','reviews','todos','ddls','settings'];
    for (const scene of scenes) {
      const p=await browser.newPage({viewport:{width:1280,height:900}});
      p.on('pageerror',e=>errors.push(scene+': '+e.message));
      p.on('console',m=>{if(m.type()==='error'&&m.text().includes('Missing scene target'))errors.push(scene+': '+m.text())});
      await p.addInitScript(()=>{window.sceneDone=false;window.addEventListener('message',e=>{if(e.data?.text==='自动演示 · 此处使用虚构数据'){window.sceneDone=true;postMessage({playDemo:false},location.origin)}})});
      await p.goto(base+'app/?scene='+scene);
      await p.waitForFunction(()=>window.demoDirectorReady&&document.querySelector('#sidebarMeta').textContent.includes('次课程'));
      await p.evaluate(()=>postMessage({playDemo:true},location.origin));
      await p.waitForFunction(()=>window.sceneDone,{},{timeout:45000});
      console.log('Automatic scene passed:',scene);
      await p.close();
    }
    await page.goto(base);
    await page.locator('iframe[data-scene=home]').scrollIntoViewIfNeeded();
    await page.locator('.chapter').first().locator('.status').filter({hasText:'首页，把今天'}).waitFor();
    await page.locator('#pause').click();
    assert.equal(await page.locator('#pause').textContent(),'播放自动演示');
    await page.setViewportSize({width:393,height:852});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(process.env.DEMO_SCREENSHOT)await page.screenshot({path:process.env.DEMO_SCREENSHOT,fullPage:true});
    assert.deepEqual(errors,[]);
    // CSS and application code in the shipped demo must be exactly the desktop files.
    for(const name of ['styles.css','app.js','core.js']) {
      const response=await page.request.get(base+'app/'+name);
      assert.equal(response.status(),200);
      assert.equal((await response.text()).replace(/\r\n/g,'\n'),fs.readFileSync(path.join(__dirname,'../static',name),'utf8').replace(/\r\n/g,'\n'));
    }
    console.log('Real frontend, tasks, restore, review, settings, all six automatic scenes and phone landing checks passed.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
