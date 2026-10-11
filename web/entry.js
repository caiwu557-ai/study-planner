import {exportBackup, exportRecovery, restoreBackup, transact} from './storage.js';
import {validateBackup} from './engine.js';
import {bjISO, toast} from './core.js';

const card=document.createElement('section');card.className='board-card web-storage-card';
card.innerHTML=`<div class="board-head"><div><div class="board-kicker">Personal space</div><h2>你的浏览器存档</h2></div><span class="web-badge">正式网页版</span></div>
<p class="field-help">课表、复习、任务与设置保存在这台设备的当前浏览器中，无需注册。本站不接收这些存档；换设备可通过备份转移。同一浏览器使用者共享这份存档。</p>
<div class="web-storage-status" id="storageStatus" role="status" aria-live="polite">正在检查存档…</div>
<div class="web-storage-actions"><button class="primary-btn" id="exportBackupBtn">导出备份</button><label class="secondary-btn web-file-label">选择备份文件<input type="file" accept=".json,application/json" id="backupFile" /></label><button class="secondary-btn" id="recoverBackupBtn">导出操作前快照</button><button class="ghost-btn" id="persistBtn">保护浏览器存档</button></div>
<div class="schedule-preview" id="backupPreview" role="status" aria-live="polite">备份不含 API Key。导入课表或恢复备份前，自动保留最近三份快照。</div><button class="primary-btn hidden" id="restoreBackupBtn">恢复这份备份</button>
<p class="field-help">清除网站数据、无痕模式或浏览器重置会影响存档；请定期导出。时间沿用北京时间。离线可管理数据，AI 需要联网；关闭应用后的准时提醒无法保证。</p>
<div class="web-install-row"><div><h3>像应用一样打开</h3><p class="field-help" id="installHelp">安装后可从桌面或主屏幕打开，首次加载后支持离线使用。</p></div><button class="secondary-btn" id="installBtn">安装应用</button></div><button class="secondary-btn hidden" id="updateBtn">更新已就绪 · 刷新应用</button>`;
document.querySelector('.settings-grid').prepend(card);
document.querySelector('.source-note strong').textContent='个人浏览器存档';
document.getElementById('aiKeyInput').autocomplete='off';
document.querySelector('#aiForm .field-help').textContent='密钥保存到当前浏览器，可清除；共享设备请勿保存。测试只发短消息；解析会将输入文本和可选课程名发给所选 AI 服务。接口必须支持浏览器直连（CORS）。';
document.querySelector('#aiForm').closest('section').querySelector('h2').textContent='AI 接口';
try{if(matchMedia('(max-width:760px)').matches&&localStorage.getItem('sp_web_rail_collapsed')===null)localStorage.setItem('sp_web_rail_collapsed','1');}catch{}

async function storageStatus() {
  const persistent=await navigator.storage?.persisted?.();
  document.getElementById('storageStatus').textContent=`${persistent?'已启用持久存储':'存档已开启 · 建议申请持久存储'}${navigator.onLine?'':' · 当前离线'}。关闭页面后记录仍会保留。`;
}
document.getElementById('persistBtn').onclick=async()=>{
  try{const granted=await navigator.storage?.persist?.();await storageStatus();toast(granted?'已启用持久存储，请仍保留备份':'浏览器未批准持久存储，请定期导出备份');}catch{toast('当前浏览器不支持，请使用导出备份');}
};
function download(data,name) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');
  link.href=url;link.download=`StudyPlanner-${name}-${bjISO()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.getElementById('exportBackupBtn').onclick=async()=>{try{download(await exportBackup(),'备份');toast('备份已导出，不含 API Key');}catch(e){toast(e.message);}};
document.getElementById('recoverBackupBtn').onclick=async()=>{try{const data=await exportRecovery();if(!data)return toast('还没有导入或恢复前快照');download(data,'操作前快照');}catch(e){toast(e.message);}};
let selectedBackup=null,selection=0;
const preview=document.getElementById('backupPreview'),restoreBtn=document.getElementById('restoreBackupBtn');
document.getElementById('backupFile').onchange=async e=>{
  const token=++selection;selectedBackup=null;restoreBtn.classList.add('hidden');
  try{const file=e.target.files[0];if(!file)return;if(file.size>20*1024*1024)throw new Error('备份文件不能超过 20 MB');
    const data=JSON.parse((await file.text()).replace(/^\uFEFF/,'')),s=validateBackup(data);if(token!==selection)return;
    selectedBackup=data;preview.textContent=`${file.name}\n${s.lessons.length} 节课程 · ${s.reviews.length} 条复习 · ${s.tasks.length} 条任务（含回收站）\n恢复将替换当前课表、任务和设置。当前 API 密钥及其接口配置保留；操作前自动保存快照。`;
    restoreBtn.classList.remove('hidden');
  }catch(e){if(token===selection)preview.textContent=`无法恢复：${e.message}`;}
};
restoreBtn.onclick=async()=>{
  if(!selectedBackup||!confirm('恢复将替换当前课表、复习、任务和设置；操作前自动保留快照。确定恢复已预览的备份吗？'))return;
  restoreBtn.disabled=true;
  try{await restoreBackup(selectedBackup);location.reload();}catch(e){preview.textContent=`恢复失败，原存档保留：${e.message}`;restoreBtn.disabled=false;}
};
let installPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;document.getElementById('installHelp').textContent='可安装到桌面或主屏幕，使用独立窗口打开。';});
document.getElementById('installBtn').onclick=async()=>{
  if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}
  else document.getElementById('installHelp').textContent='在 Chrome／Edge 浏览器菜单选择“安装应用”或“添加到主屏幕”。iPhone 请在 Safari 分享菜单中选择“添加到主屏幕”。是否可安装由浏览器决定。';
};
function installed(force=false){if(force||matchMedia('(display-mode:standalone)').matches||navigator.standalone){document.getElementById('installBtn').classList.add('hidden');document.getElementById('installHelp').textContent=force?'已安装，可从桌面或主屏幕打开。':'已在应用窗口中打开。';}}
window.addEventListener('appinstalled',()=>installed(true));installed();
window.addEventListener('online',storageStatus);window.addEventListener('offline',storageStatus);
try {
  await transact(()=>true);await storageStatus();
  await import('./app.js');
  if('serviceWorker' in navigator){
    const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
    const offer=()=>{if(registration.waiting)document.getElementById('updateBtn').classList.remove('hidden');};offer();
    registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offer();});});
    document.getElementById('updateBtn').onclick=()=>{if(!confirm('刷新将关闭尚未提交的表单；已保存存档会保留。确定更新？'))return;if(!registration.waiting)return location.reload();navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});registration.waiting.postMessage({type:'ACTIVATE'});};
  }
} catch(e){document.getElementById('storageStatus').textContent=e.message;toast(e.message);}
