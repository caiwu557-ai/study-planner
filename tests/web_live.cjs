const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.argv[2]||'https://caiwu557-ai.github.io/study-planner/';
(async()=>{
  const profileRoot=process.env.WEB_TEST_PROFILE_ROOT||require('node:os').tmpdir();fs.mkdirSync(profileRoot,{recursive:true});
  const browser=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(profileRoot,'study-planner-live-')),{headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try {
    const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'web/');await p.waitForFunction(()=>document.querySelector('#sidebarMeta').textContent.includes('浏览器存档'));
    await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>navigator.serviceWorker.controller);
    const cdp=await p.context().newCDPSession(p);assert.deepEqual((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors,[]);
    for(const file of ['app.js','core.js','engine.js','storage.js','entry.js','onboarding.js','manifest.json','icon.svg']){
      const response=await p.request.get(base+'web/'+file);assert.equal(response.status(),200);
      assert.equal((await response.text()).replace(/\r\n/g,'\n'),fs.readFileSync(path.join(__dirname,'../site/web',file),'utf8').replace(/\r\n/g,'\n'),`Published file differs: ${file}`);
    }
    assert.deepEqual(errors,[]);console.log('Live HTTPS: installability and deployed application file read-back passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
