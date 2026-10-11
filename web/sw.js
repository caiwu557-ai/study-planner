// Build inserts a content hash and the complete local asset list.
const CACHE = '__CACHE__';
const ASSETS = __ASSETS__;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(path=>new Request(path,{cache:'reload'}))))));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('study-planner-web-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  // Cache only shipped code, never AI traffic or personal data.
  const asset=ASSETS.find(path=>new URL(path,self.registration.scope).pathname===url.pathname);
  if(!asset&&event.request.mode!=='navigate')return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(asset||'./index.html');return cached||fetch(event.request);
  }));
});
