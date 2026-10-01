// Cache Name နှင့် Version သတ်မှတ်ချက်
const CACHE_NAME = 'Free-POS-Note-beta';

// Offline အသုံးပြုနိုင်ရန် ကြိုတင် Cache သိမ်းဆည်းမည့် File များနှင့် CDN Libraries များ
const STATIC_ASSETS = [
    './',
    './index.html',
    // External Libraries (CDN)
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://unpkg.com/html5-qrcode'
];

// 1. Install Event: လိုအပ်သော ဖိုင်များကို Cache ထဲသို့ ထည့်သွင်းခြင်း
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Pre-caching offline assets');
            // Cache မရနိုင်သော CDN များကြောင့် install မရပ်တန့်သွားစေရန် individual fetch ပြုလုပ်ခြင်း
            return Promise.allSettled(
                STATIC_ASSETS.map((asset) =>
                    cache.add(asset).catch((err) => {
                        console.warn(`[Service Worker] Failed to cache: ${asset}`, err);
                    })
                )
            );
        }).then(() => self.skipWaiting())
    );
});

// 2. Activate Event: Cache ဗားရှင်းအဟောင်းများကို ဖျက်ထုတ်ခြင်း
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Removing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Fetch Event: Offline ပေါ်တွင် Cache မှ အချက်အလက်များကို ပြန်လည်ဆွဲယူပေးခြင်း
self.addEventListener('fetch', (event) => {
    // Bluetooth သို့မဟုတ် non-http(s) request များကို ကျော်သွားမည်
    if (!event.request.url.startsWith('http')) return;

    // အကယ်၍ အင်တာနက်ရှိပါက Network မှယူမည်၊ မရှိပါက Cache မှ ပြန်လည်အသုံးပြုမည် (Stale-While-Revalidate Strategy)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Cache ထဲတွင် ရှိပြီးသားဖြစ်ပါက ချက်ချင်းပြသမည်
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // မှန်ကန်သော Response ရရှိပါက Cache အသစ် update ပြုလုပ်မည်
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // အင်တာနက်မရှိပါက (Offline ဖြစ်နေပါက)
                if (event.request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('./') || caches.match('./index.html');
                }
            });

            return cachedResponse || fetchPromise;
        })
    );
});