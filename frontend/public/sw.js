self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let data = { title: 'Trekfin', body: 'Пора заглянуть в ваш бюджет' };
  try { data = {...data, ...event.data.json()}; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/icon-192.png', badge: '/icon-192.png', tag: data.tag || 'trekfin', data: {url: '/'} }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window'}).then(clients => {
    const client = clients.find(c => new URL(c.url).origin === self.location.origin);
    return client ? client.focus() : self.clients.openWindow('/');
  }));
});
