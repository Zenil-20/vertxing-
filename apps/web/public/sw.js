/*
 * Vertxing — Real-Time Video Meeting Platform
 * ---------------------------------------------------------------------------
 * File:    apps/web/public/sw.js
 * Layer:   Web / PWA (service worker)
 * Purpose: The minimum that makes the app INSTALLABLE and resilient, PLUS the
 *          background-call ringer. It is deliberately NOT an aggressive cache —
 *          this is a real-time app, so we never cache API/socket/media; we keep
 *          only the app shell. The `push` handler shows an incoming-call
 *          notification even when the app is fully closed; `notificationclick`
 *          opens the app deep-linked to answer or decline.
 * ---------------------------------------------------------------------------
 */

const CACHE = 'vertxing-shell-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add('/')).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-first for page navigations; fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/')));
  }
  // Everything else passes straight through to the network.
});

// ── Background calls: ring even when the app is closed ───────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  if (data.type !== 'incoming-call') return;

  const from = (data.from && data.from.name) || 'Someone';
  const title = data.mode === 'VIDEO' ? 'Incoming video call' : 'Incoming call';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: `${from} is calling…`,
      tag: `call-${data.callId}`, // collapse duplicate pushes for the same call
      renotify: true,
      requireInteraction: true, // keep ringing until the user acts
      vibrate: [300, 200, 300, 200, 300],
      data,
      actions: [
        { action: 'accept', title: 'Answer' },
        { action: 'decline', title: 'Decline' },
      ],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  if (data.type !== 'incoming-call') return;

  const origin = self.registration.scope.replace(/\/$/, '');
  const url =
    event.action === 'decline'
      ? `${origin}/app?declineCall=${encodeURIComponent(data.callId)}`
      : `${origin}/app?acceptCall=${encodeURIComponent(data.callId)}` +
        `&from=${encodeURIComponent((data.from && data.from.name) || '')}` +
        `&mode=${encodeURIComponent(data.mode || 'AUDIO')}`;

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) {
          try {
            await client.navigate(url);
          } catch (e) {
            /* navigate can throw if cross-origin; fall through to focus */
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    })(),
  );
});
