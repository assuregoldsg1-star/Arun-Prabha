/* Assure Gold portal service worker: push notifications only */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{
  let d={}; try{ d=e.data?e.data.json():{}; }catch(_){}
  e.waitUntil(self.registration.showNotification(d.title||'Assure Gold',{
    body:d.body||'', icon:'/assets/images/icon-192.png', badge:'/assets/images/icon-192.png',
    tag:d.tag||undefined, data:{url:d.url||'/portal.html'} }));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const url=new URL((e.notification.data&&e.notification.data.url)||'/portal.html',self.location.origin).href;
  e.waitUntil((async()=>{
    const all=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of all){
      if(new URL(c.url).pathname.endsWith('/portal.html')){
        try{ await c.focus(); }catch(_){}
        c.postMessage({type:'open-log',url}); return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
