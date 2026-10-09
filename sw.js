// Uuenduse jaoks muuda VERSION → telefon laeb uue versiooni automaatselt.
const VERSION = "1.0.1";
const CACHE = "app-" + VERSION;
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); });
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
// Võrk enne, vahemälu siis kui võrku pole → uuendused jõuavad kohe kohale.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request)));
});

const db = () => new Promise((ok, no) => { const r = indexedDB.open("app", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("msgs", { keyPath: "id" }); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });

self.addEventListener("push", e => e.waitUntil((async () => {
  let m; try { m = e.data.json(); } catch { m = { tag: "INFO", title: e.data ? e.data.text() : "", body: "" }; }
  m.time = m.time || Math.floor(Date.now() / 1000);
  m.id = "p-" + m.time + "-" + Math.random().toString(36).slice(2, 6);
  const d = await db(); const tx = d.transaction("msgs", "readwrite"); tx.objectStore("msgs").put(m);
  await new Promise(ok => tx.oncomplete = ok);
  for (const c of await self.clients.matchAll()) c.postMessage("new");
  await self.registration.showNotification(`${m.tag}: ${m.title}`, {
    body: m.body, icon: "icon-192.png", badge: "icon-192.png", tag: m.id,
    requireInteraction: m.tag === "OTSUS", data: { url: m.url || "./" } });
})()));

self.addEventListener("notificationclick", e => { e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data.url)); });
