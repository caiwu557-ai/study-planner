const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const base=process.argv[2]||'http://127.0.0.1:18769/';
  try {
    for(const scene of (process.argv[3]?[process.argv[3]]:['home','calendar','reviews','todos','ddls','settings'])) {
      const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base,{waitUntil:'domcontentloaded'});
      const frame=page.locator(`iframe[data-scene=${scene}]`);
      await frame.scrollIntoViewIfNeeded();
      await page.frameLocator(`iframe[data-scene=${scene}]`).locator('#sidebarMeta').filter({hasText:'次课程'}).waitFor();
      await page.evaluate(scene=>{const f=document.querySelector(`iframe[data-scene=${scene}]`);window.scrollTo({top:scrollY+f.getBoundingClientRect().top-220,behavior:'instant'})},scene);
      await page.waitForTimeout(300);
      await page.evaluate(scene=>{
        const f=document.querySelector(`iframe[data-scene=${scene}]`);
        window.demoPositions=[scrollY];window.demoFinished=false;
        window.addEventListener('scroll',()=>window.demoPositions.push(scrollY));
        window.addEventListener('message',e=>{if(e.source===f.contentWindow&&e.data?.text==='自动演示 · 此处使用虚构数据'){window.demoFinished=true;f.contentWindow.postMessage({playDemo:false},location.origin)}});
        f.contentWindow.postMessage({playDemo:true},location.origin);
      },scene);
      await page.waitForFunction(()=>window.demoFinished,{},{timeout:45000});
      const positions=await page.evaluate(()=>[...window.demoPositions,scrollY]);
      const drift=Math.max(...positions)-Math.min(...positions);
      assert.ok(drift<=1,`${scene}: outer page moved ${drift}px (${positions.join(', ')})`);
      assert.deepEqual(errors,[]);
      console.log(`${scene}: outer page stayed fixed (${drift}px drift)`);
      await page.close();
    }
    const host=await browser.newPage({viewport:{width:1440,height:1000}});
    await host.setContent(`<div style="height:150px">External host</div><iframe title="Embedded demo" src="${new URL('embed.html?scene=todos',base)}" style="border:0;width:1000px;height:720px"></iframe><div style="height:1500px"></div>`);
    const embedded=host.frameLocator('iframe');
    await embedded.locator('#status').filter({hasText:'直接在清单'}).waitFor();
    const position=await host.evaluate(()=>scrollY);
    await host.waitForTimeout(6500);
    assert.equal(await host.evaluate(()=>scrollY),position);
    await embedded.locator('#pause').click();
    assert.equal(await embedded.locator('#pause').textContent(),'播放');
    await embedded.locator('#replay').click();
    assert.equal(await embedded.locator('#pause').textContent(),'暂停');
    await host.goto(new URL('app/',base).href);
    assert.ok(await host.evaluate(()=>HTMLElement.prototype.focus.toString().includes('[native code]')));
    await host.close();
    console.log('External embed stayed fixed; pause/replay and manual focus passed.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
