// audio.js - 纯 Web Audio API 声音合成引擎（无需外部音频文件，零依赖离线可用）
const SoundEffects = (() => {
  let ctx = null;
  let muted = false;

  function initCtx() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  // 监听首次交互激活音频上下文
  window.addEventListener('pointerdown', () => initCtx(), { once: true });
  window.addEventListener('keydown', () => initCtx(), { once: true });

  return {
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },

    // 1. 逼真清脆的落子木质敲击声
    playStone() {
      if (muted) return;
      initCtx();
      if (!ctx) return;

      const t = ctx.currentTime;
      // 敲击高频咔哒声
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(1400, t);
      clickOsc.frequency.exponentialRampToValueAtTime(300, t + 0.04);
      clickGain.gain.setValueAtTime(0.8, t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickOsc.start(t);
      clickOsc.stop(t + 0.04);

      // 棋盘厚重共鸣木声
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = 'sine';
      thudOsc.frequency.setValueAtTime(280, t);
      thudOsc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
      thudGain.gain.setValueAtTime(0.7, t);
      thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      thudOsc.connect(thudGain);
      thudGain.connect(ctx.destination);
      thudOsc.start(t);
      thudOsc.stop(t + 0.12);
    },

    // 2. 欢快提子/吃子声（泡泡啵声 + 上滑音）
    playCapture() {
      if (muted) return;
      initCtx();
      if (!ctx) return;

      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.15);
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);

      // 连带的小星光音
      setTimeout(() => {
        if (!ctx || muted) return;
        const t2 = ctx.currentTime;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1046.5, t2); // C6
        gain2.gain.setValueAtTime(0.4, t2);
        gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.15);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(t2);
        osc2.stop(t2 + 0.15);
      }, 70);
    },

    // 3. 打吃预警声（可爱的"噔噔"双音提示）
    playAtari() {
      if (muted) return;
      initCtx();
      if (!ctx) return;

      const playNote = (freq, delay) => {
        setTimeout(() => {
          if (!ctx || muted) return;
          const t = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.4, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.12);
        }, delay);
      };

      playNote(659.25, 0);   // E5
      playNote(783.99, 110); // G5
    },

    // 4. 闯关成功/答对奖励（叮咚欢呼琶音）
    playSuccess() {
      if (muted) return;
      initCtx();
      if (!ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          if (!ctx || muted) return;
          const t = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.5, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.28);
        }, idx * 90);
      });
    },

    // 5. 鼓励性答错提示（温柔的低音，无挫败感）
    playGentleError() {
      if (muted) return;
      initCtx();
      if (!ctx) return;

      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(329.63, t); // E4
      osc.frequency.linearRampToValueAtTime(261.63, t + 0.25); // C4
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.28);
    },

    // 6. 段位晋升大捷胜利号角
    playLevelUp() {
      if (muted) return;
      initCtx();
      if (!ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          if (!ctx || muted) return;
          const t = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.6, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.35);
        }, idx * 100);
      });
    },

    // 7. 通用点击/UI触控声
    playClick() {
      if (muted) return;
      initCtx();
      if (!ctx) return;

      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    }
  };
})();
