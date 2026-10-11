// Development-only: rasterize our own SVG for Android / desktop installation.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{for(const size of [192,512]){
    const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
    const svg=fs.readFileSync(path.join(__dirname,'icon.svg'),'utf8');
    await page.setContent(`<style>body{margin:0;background:#f6f5f4}svg{width:100vw;height:100vh;display:block}</style>${svg}`);
    await page.screenshot({path:path.join(__dirname,`icon-${size}.png`)});await page.close();
  }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
