const CACHE='masterSRM-v0.3.0';
const ASSETS=['./','./index.html','./app.css','./app.js','./manifest.webmanifest','./data/srm-index.json','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./icons/home-button.png','./assets/fig5-major-subzones.png','./assets/fig2-st2.png','./assets/fig2-st3.png','./assets/fig2-st7.png','./assets/fig3-components.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{ if(e.request.method!=='GET')return; e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const copy=res.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return res;}).catch(()=>caches.match('./index.html')))); });
