// sw.js - Service Worker 离线缓存引擎（v3 Neural 神经网络语音升级版）

const CACHE_NAME = 'kids-go-v8-smart-ai';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/audio.js',
  './js/voice.js',
  './js/go-engine.js',
  './js/puzzles.js',
  './js/ai.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

// 核心微软 Edge Neural 神经网络语音包预缓存
const VOICE_PACKS = [
  { name: 'xiaoxiao', ext: 'mp3' },
  { name: 'xiaoyi', ext: 'mp3' },
  { name: 'yunxia', ext: 'mp3' },
  { name: 'yunxi', ext: 'mp3' }
];

const BASE_AUDIO_CLIPS = [
  'err_goal',
  'err_liberty',
  'match_capture',
  'match_atari',
  'match_ai_atari',
  'match_win',
  'match_promote',
  'match_lose',
  'p1_intro', 'p1_win', 'p1_t1', 'p1_t2', 'p1_ans',
  'p2_intro', 'p2_win', 'p2_t1', 'p2_t2', 'p2_ans',
  'p3_intro', 'p3_win', 'p3_t1', 'p3_t2', 'p3_ans',
  'p4_intro', 'p4_win', 'p4_t1', 'p4_t2', 'p4_ans',
  'p5_intro', 'p5_win', 'p5_t1', 'p5_t2', 'p5_ans',
  'p6_intro', 'p6_win', 'p6_t1', 'p6_t2', 'p6_ans',
  'p7_intro', 'p7_win', 'p7_t1', 'p7_t2', 'p7_ans',
  'p8_intro', 'p8_win', 'p8_t1', 'p8_t2', 'p8_ans',
  'p9_intro', 'p9_win', 'p9_t1', 'p9_t2', 'p9_ans',
  'p10_intro', 'p10_win', 'p10_t1', 'p10_t2', 'p10_ans',
  'p11_intro', 'p11_win', 'p11_t1', 'p11_t2', 'p11_ans',
  'p12_intro', 'p12_win', 'p12_t1', 'p12_t2', 'p12_ans',
  'p13_intro', 'p13_win', 'p13_t1', 'p13_t2', 'p13_ans',
  'p14_intro', 'p14_win', 'p14_t1', 'p14_t2', 'p14_ans',
  'p15_intro', 'p15_win', 'p15_t1', 'p15_t2', 'p15_ans',
  'p16_intro', 'p16_win', 'p16_t1', 'p16_t2', 'p16_ans',
  'p17_intro', 'p17_win', 'p17_t1', 'p17_t2', 'p17_ans',
  'p18_intro', 'p18_win', 'p18_t1', 'p18_t2', 'p18_ans',
  'p19_intro', 'p19_win', 'p19_t1', 'p19_t2', 'p19_ans',
  'p20_intro', 'p20_win', 'p20_t1', 'p20_t2', 'p20_ans'
];

VOICE_PACKS.forEach(pack => {
  BASE_AUDIO_CLIPS.forEach(clip => {
    STATIC_ASSETS.push(`./assets/audio/${pack.name}/${clip}.${pack.ext}`);
  });
});

// 安装阶段：预缓存全部关键资源，并立即接管
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(STATIC_ASSETS.slice(0, 12));
      await Promise.allSettled(
        STATIC_ASSETS.slice(12).map(url =>
          cache.add(url).catch(err => console.warn('[SW] 音频预缓存跳过:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// 激活阶段：彻底清理旧版 v1/v2 机械语音缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 拦截请求：代码文件采用 Network-First（确保最新修改即时生效），音频资源采用 Cache-First
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 动态实时 TTS 接口直接走网络
  if (url.pathname.startsWith('/api/tts')) {
    return;
  }

  const isAudioOrImage = url.pathname.endsWith('.mp3') || url.pathname.endsWith('.png');

  if (isAudioOrImage) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseToCache));
          }
          return networkResponse;
        });
      })
    );
  } else {
    // HTML / JS / CSS 优先请求最新网络版本，离线时回退缓存
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true }) || caches.match('./index.html'))
    );
  }
});
