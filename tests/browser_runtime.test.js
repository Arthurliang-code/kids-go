const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('====================================================');
console.log('🌐 执行浏览器环境多脚本加载与运行时初始化检定');
console.log('====================================================');

const canvasCtx = {
  clearRect: ()=>{}, beginPath: ()=>{}, stroke: ()=>{}, fill: ()=>{}, 
  arc: ()=>{}, rect: ()=>{}, fillText: ()=>{}, setTransform: ()=>{},
  createLinearGradient: () => ({ addColorStop: ()=>{} }),
  createRadialGradient: () => ({ addColorStop: ()=>{} }),
  save: ()=>{}, restore: ()=>{}, moveTo: ()=>{}, lineTo: ()=>{}
};

let domLoadedCallback = null;

const document = {
  addEventListener: (evt, cb) => {
    if (evt === 'DOMContentLoaded') {
      domLoadedCallback = cb;
    }
  },
  getElementById: (id) => {
    return { 
      id,
      addEventListener: () => {}, 
      style: {}, 
      classList: { add: ()=>{}, remove: ()=>{}, toggle: ()=>{} },
      options: [{ dataset: { target: '5' } }],
      selectedIndex: 0,
      value: '9',
      appendChild: () => {},
      getBoundingClientRect: () => ({ width: 500, height: 500, left: 0, top: 0 }),
      getContext: () => canvasCtx
    };
  },
  createElement: (tag) => ({ tag, style: {}, classList: { add: ()=>{}, remove: ()=>{} }, appendChild: ()=>{} }),
  querySelectorAll: () => []
};

const window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { protocol: 'http:', hostname: 'localhost' },
  navigator: { userAgent: 'test', serviceWorker: { register: () => Promise.resolve({ scope: '/' }) } },
  document,
  Audio: class { play() { return Promise.resolve(); } pause() {} },
  localStorage: { getItem: () => null, setItem: () => {} },
  requestAnimationFrame: (cb) => cb(),
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  devicePixelRatio: 2,
  getComputedStyle: () => ({ paddingLeft: '10px', paddingRight: '10px', paddingTop: '10px', paddingBottom: '10px' })
};
window.window = window;
window.document = document;

const ctx = vm.createContext(window);

const files = [
  '../js/audio.js',
  '../js/voice.js',
  '../js/go-engine.js',
  '../js/puzzles.js',
  '../js/ai.js',
  '../js/app.js'
];

files.forEach(file => {
  const fullPath = path.join(__dirname, file);
  console.log('Loading script:', file);
  const code = fs.readFileSync(fullPath, 'utf8');
  vm.runInContext(code, ctx);
});

if (typeof domLoadedCallback === 'function') {
  console.log('Triggering DOMContentLoaded...');
  domLoadedCallback();
  console.log('✅ DOMContentLoaded executed smoothly with 0 errors!');
} else {
  throw new Error('DOMContentLoaded listener was never registered!');
}

console.log('====================================================');
console.log('🎉 浏览器端全量脚本运行无任何 SyntaxError 或运行时中断！');
console.log('====================================================');

