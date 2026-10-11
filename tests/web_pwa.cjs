async function emptyFixture(p){
  await p.locator('#guideWelcome[open]').waitFor();await p.locator('#guideSkip').click();
  await p.evaluate(async()=>{const {transact}=await import('./storage.js');const {emptyState}=await import('./engine.js');await transact(s=>{Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,emptyState());});});
  await p.reload();await p.waitForFunction(()=>document.querySelector('#sidebarMeta').textContent.includes('浏览器存档'));
}
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.argv[2]||'http://127.0.0.1:18770/';
(async()=>{
  const profileRoot=process.env.WEB_TEST_PROFILE_ROOT||require('node:os').tmpdir();
  fs.mkdirSync(profileRoot,{recursive:true});
  const profile=fs.mkdtempSync(path.join(profileRoot,'study-planner-pwa-'));
  const browser=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:1280,height:960},...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const swPath=path.join(__dirname,'../site/web/sw.js'),original=fs.readFileSync(swPath,'utf8');let changed=false;
  try {
    const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(base+'web/');await p.waitForFunction(()=>document.querySelector('#sidebarMeta').textContent.includes('浏览器存档'));await emptyFixture(p);
    await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>navigator.serviceWorker.controller);
    const cdp=await p.context().newCDPSession(p);
    const installability=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(installability.installabilityErrors,[]);
    const write=await p.evaluate(async()=>{
      const saved=IDBObjectStore.prototype.put;
      try{IDBObjectStore.prototype.put=function(){throw new DOMException('Test quota failure','QuotaExceededError');};
        const response=await fetch('/api/tasks',{method:'POST',body:JSON.stringify({title:'不能保存的任务'})});return {ok:response.ok,data:await response.json()};
      }finally{IDBObjectStore.prototype.put=saved;}
    });assert.equal(write.ok,false);
    await p.reload();await p.waitForFunction(()=>document.querySelector('#sidebarMeta').textContent.includes('浏览器存档'));
    assert.equal(await p.evaluate(async()=>((await (await fetch('/api/tasks')).json()).tasks.length)),0);
    await p.evaluate(()=>fetch('/api/tasks',{method:'POST',body:JSON.stringify({title:'更新前保存的记录'})}));
    await p.locator('[data-view=settings]').click();await p.locator('#quickAddBtn').click();await p.locator('#taskTitle').fill('尚未提交');
    // Only the ignored build artifact is temporarily changed, then restored.
    fs.writeFileSync(swPath,original.replace(/(const CACHE = '[^']+)';/,"$1-update-test';"),'utf8');changed=true;
    await p.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});
    await p.waitForFunction(()=>!document.querySelector('#updateBtn').classList.contains('hidden'));
    assert.equal(await p.locator('#taskTitle').inputValue(),'尚未提交');
    await p.locator('#cancelTask').click();p.once('dialog',d=>d.dismiss());await p.locator('#updateBtn').click();
    assert.equal(await p.evaluate(async()=>((await (await fetch('/api/tasks')).json()).tasks.length)),1);
    p.once('dialog',d=>d.accept());await Promise.all([p.waitForEvent('load'),p.locator('#updateBtn').click()]);await p.waitForFunction(()=>document.querySelector('#sidebarMeta').textContent.includes('浏览器存档'));
    assert.equal(await p.evaluate(async()=>((await (await fetch('/api/tasks')).json()).tasks[0].title)),'更新前保存的记录');
    await p.locator('[data-view=settings]').click();
    if(process.env.WEB_DESKTOP_SCREENSHOT)await p.screenshot({path:process.env.WEB_DESKTOP_SCREENSHOT,animations:'disabled'});
    assert.deepEqual(errors,[]);
    console.log('PWA: Chrome installation requirements, failed-write rollback, opt-in update and saved data retention passed.');
  } finally{if(changed)fs.writeFileSync(swPath,original,'utf8');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
