// voice.js - 少儿专属神经网络自然语音引擎（基于 Microsoft Edge Neural TTS 预置全量语音包 + 智能防冲突播报）

const VoiceNarrator = (() => {
  // 默认使用微软旗舰少儿故事女声：晓晓 (zh-CN-XiaoxiaoNeural)
  let currentVoicePack = 'xiaoxiao';
  let currentAudio = null;
  let isSpeaking = false;
  let onStartCallback = null;
  let onEndCallback = null;
  let autoEnabled = true;
  let playToken = 0; // 防抖与并发令牌，防止快速切换关卡或连点时声音重叠
  let ttsTimer = null;

  // 音色名映射（4套全量预生成的微软 Neural 少儿/导师音色）
  const PACK_ALIAS = {
    xiaoxiao: 'xiaoxiao', // 🌟 晓晓老师 (zh-CN-XiaoxiaoNeural)
    xiaoyi: 'xiaoyi',     // 👧 晓伊姐姐 (zh-CN-XiaoyiNeural)
    yunxia: 'yunxia',     // 👦 云夏弟弟 (zh-CN-YunxiaNeural)
    yunxi: 'yunxi',       // 🐼 云希哥哥 (zh-CN-YunxiNeural)
    tingting: 'xiaoxiao',
    meijia: 'xiaoyi',
    shelley: 'xiaoyi',
    flo: 'yunxia',
    eddy: 'yunxia',
    reed: 'yunxi'
  };

  // Web Speech API 离线兜底（仅当个别动态台词无预置音频且无本地 TTS 服务时使用）
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

  function stop() {
    playToken++;
    if (ttsTimer) {
      clearTimeout(ttsTimer);
      ttsTimer = null;
    }
    if (currentAudio) {
      currentAudio.onplay = null;
      currentAudio.onended = null;
      currentAudio.onerror = null;
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch (e) {}
      currentAudio = null;
    }
    if (synth) {
      try {
        synth.cancel();
      } catch (e) {}
    }
    if (isSpeaking) {
      isSpeaking = false;
      if (onEndCallback) onEndCallback();
    }
  }

  // 播放预生成的高清 Edge-TTS 神经网络音频片段（毫秒级响应，同时支持在线静态部署与单文件内嵌 Base64 离线版）
  function playClip(clipName, fallbackText = '', isManual = false) {
    if (!isManual && !autoEnabled) return;
    stop();
    const myToken = playToken;

    const pack = PACK_ALIAS[currentVoicePack] || 'xiaoxiao';
    let audioSrc = `assets/audio/${pack}/${clipName}.mp3?v=neural2`;

    // 若运行于打包后的单文件离线 HTML 模式，优先读取内嵌的 Base64 神经网络语音数据
    if (typeof window !== 'undefined' && window.INLINE_VOICE_PACKS) {
      const packData = window.INLINE_VOICE_PACKS[pack] || window.INLINE_VOICE_PACKS['xiaoxiao'];
      if (packData && packData[clipName]) {
        audioSrc = packData[clipName];
      }
    }

    const audio = new Audio(audioSrc);
    audio.preload = 'auto';
    currentAudio = audio;

    audio.onplay = () => {
      if (myToken !== playToken) return;
      isSpeaking = true;
      if (onStartCallback) onStartCallback();
    };

    audio.onended = () => {
      if (myToken !== playToken) return;
      isSpeaking = false;
      currentAudio = null;
      if (onEndCallback) onEndCallback();
    };

    audio.onerror = () => {
      if (myToken !== playToken) return;
      currentAudio = null;
      isSpeaking = false;
      if (fallbackText) {
        speak(fallbackText, isManual);
      } else if (onEndCallback) {
        onEndCallback();
      }
    };

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(err => {
        if (myToken !== playToken) return;
        currentAudio = null;
        isSpeaking = false;
        // 若是因为刚打开页面尚未产生首次交互（NotAllowedError），静默等待用户点击即可，不强行触发机械音
        if (err && err.name === 'NotAllowedError') {
          if (onEndCallback) onEndCallback();
          return;
        }
        if (isManual && fallbackText) {
          speak(fallbackText, true);
        } else if (onEndCallback) {
          onEndCallback();
        }
      });
    }
  }

  // 朗读关卡题目（使用预生成的微软 Neural 原声包 p{id}_intro.mp3）
  function speakPuzzle(puzzleId, fallbackText = '', isManual = false) {
    const clipName = `p${puzzleId}_intro`;
    playClip(clipName, fallbackText, isManual);
  }

  // 朗读关卡图解教学步骤（使用预生成的微软 Neural 原声包 p{id}_t1.mp3 / p{id}_t2.mp3）
  function speakTeach(puzzleId, stepIndex, fallbackText = '', isManual = false) {
    const clipName = `p${puzzleId}_t${stepIndex + 1}`;
    playClip(clipName, fallbackText, isManual);
  }

  // 朗读关卡标准答案解析（使用预生成的微软 Neural 原声包 p{id}_ans.mp3）
  function speakAnswer(puzzleId, fallbackText = '', isManual = false) {
    const clipName = `p${puzzleId}_ans`;
    playClip(clipName, fallbackText, isManual);
  }

  // 朗读通关喜讯（使用预生成的微软 Neural 原声包 p{id}_win.mp3）
  function speakSuccess(puzzleId, fallbackText = '', isManual = false) {
    const clipName = `p${puzzleId}_win`;
    playClip(clipName, fallbackText, isManual);
  }

  // 朗读错误引导（使用预生成的微软 Neural 原声包 err_liberty / err_goal / err_occupied / err_suicide / err_false_eye / err_not_eye / err_choice_badge）
  function speakError(errType, fallbackText = '', isManual = false) {
    const errMap = {
      liberty: 'err_liberty',
      goal: 'err_goal',
      occupied: 'err_occupied',
      suicide: 'err_suicide',
      false_eye: 'err_false_eye',
      not_eye: 'err_not_eye',
      choice_badge: 'err_choice_badge'
    };
    const clipName = errMap[errType] || 'err_goal';
    playClip(clipName, fallbackText, isManual);
  }

  // 朗读关卡专属错误/陷阱引导（使用预生成的微软 Neural 原声包 p{id}_wrong.mp3）
  function speakWrong(puzzleId, fallbackText = '', isManual = false) {
    const clipName = `p${puzzleId}_wrong`;
    playClip(clipName, fallbackText, isManual);
  }

  // 朗读对弈导师锦囊支招（使用预生成的微软 Neural 原声包 hint_coach.mp3）
  function speakHint(fallbackText = '', isManual = true) {
    playClip('hint_coach', fallbackText, isManual);
  }

  // 朗读对弈事件（提子、打吃、胜利、晋级等）
  function speakMatchEvent(eventName, fallbackText = '', isManual = false) {
    playClip(eventName, fallbackText, isManual);
  }

  // 选择系统内置最佳中文自然音色（仅当动态未知文本且离线无预置音频时兜底）
  function pickBestSystemVoice() {
    if (!synth) return null;
    const voices = synth.getVoices() || [];
    const zhVoices = voices.filter(v => /zh|cmn/i.test(v.lang));
    if (!zhVoices.length) return null;

    const priorityKeywords = ['Xiaoxiao', 'Xiaoyi', 'Yunxi', 'Yunxia', 'Neural', 'Natural', 'Premium', 'Enhanced', 'Tingting'];
    for (const kw of priorityKeywords) {
      const found = zhVoices.find(v => v.name.includes(kw));
      if (found) return found;
    }
    return zhVoices[0];
  }

  // 浏览器原生 Web Speech 兜底（带 WebKit cancel 后延迟 60ms 防吞字保护）
  function speakWithBrowserTTS(cleanText, myToken) {
    if (!synth) {
      if (onEndCallback) onEndCallback();
      return;
    }
    ttsTimer = setTimeout(() => {
      ttsTimer = null;
      if (myToken !== playToken) return;
      const utter = new SpeechSynthesisUtterance(cleanText);
      utter.lang = 'zh-CN';
      const bestVoice = pickBestSystemVoice();
      if (bestVoice) utter.voice = bestVoice;
      utter.rate = 1.0;
      utter.pitch = 1.0;

      utter.onstart = () => {
        if (myToken !== playToken) return;
        isSpeaking = true;
        if (onStartCallback) onStartCallback();
      };
      utter.onend = () => {
        if (myToken !== playToken) return;
        isSpeaking = false;
        if (onEndCallback) onEndCallback();
      };
      utter.onerror = () => {
        if (myToken !== playToken) return;
        isSpeaking = false;
        if (onEndCallback) onEndCallback();
      };

      try {
        synth.speak(utter);
      } catch (e) {
        if (onEndCallback) onEndCallback();
      }
    }, 60);
  }

  // 通用动态文本朗读（离线纯本地优先：直接走浏览器原生 Web Speech 引擎，严禁依赖远程服务端接口）
  function speak(text, isManual = false) {
    if (!isManual && !autoEnabled) return;
    if (!text) return;
    stop();
    const myToken = playToken;

    const cleanText = text.replace(/<[^>]+>/g, '').replace(/[★*#_`~💡🎉🏆🌿📖🎯✓✗]/g, '').trim();
    if (!cleanText) return;

    speakWithBrowserTTS(cleanText, myToken);
  }

  return {
    speakPuzzle,
    speakTeach,
    speakAnswer,
    speakSuccess,
    speakError,
    speakWrong,
    speakHint,
    speakMatchEvent,
    speak,
    stop,
    toggle(val) {
      if (typeof val === 'boolean') autoEnabled = val;
      else autoEnabled = !autoEnabled;
      if (!autoEnabled) stop();
      return autoEnabled;
    },
    setAutoRead(val) {
      autoEnabled = !!val;
      if (!autoEnabled) stop();
    },
    isAutoReadEnabled: () => autoEnabled,
    isEnabled: () => autoEnabled,
    isSpeakingNow: () => isSpeaking,
    setVoicePack(pack) {
      if (PACK_ALIAS[pack]) {
        currentVoicePack = PACK_ALIAS[pack];
      }
    },
    getVoicePack: () => currentVoicePack,
    setCallbacks(onStart, onEnd) {
      onStartCallback = onStart;
      onEndCallback = onEnd;
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VoiceNarrator };
}
