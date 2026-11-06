// sw.js - Service Worker 离线缓存引擎（v15 包含40关全量 Edge Neural 微软神经网络真声及全部交互提示音预缓存）

const CACHE_NAME = 'kids-go-v15-neural-hints';

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
  'hint_coach',
  'err_choice_badge',
  'err_occupied',
  'err_suicide',
  'err_false_eye',
  'err_not_eye',
  'err_goal',
  'err_liberty',
  'match_capture',
  'match_atari',
  'match_ai_atari',
  'match_win',
  'match_promote',
  'match_lose'
];

// 包含全量关卡语音 p1_intro ~ p40_win, p40_wrong
const PUZZLE_AUDIO_CLIPS = [];
for (let id = 1; id <= 40; id++) {
  ['intro', 'win', 't1', 't2', 'ans', 'wrong'].forEach(type => {
    PUZZLE_AUDIO_CLIPS.push(`p${id}_${type}`);
  });
}

VOICE_PACKS.forEach(pack => {
  [...BASE_AUDIO_CLIPS, ...PUZZLE_AUDIO_CLIPS].forEach(clip => {
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
