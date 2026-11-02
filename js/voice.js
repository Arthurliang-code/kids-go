// voice.js - 少儿专属神经网络自然语音引擎（基于 Microsoft Edge Neural TTS 中国大陆直连 + 本地高清神经网络语音包）

const VoiceNarrator = (() => {
  // 默认使用微软旗舰少儿故事女声：晓晓 (zh-CN-XiaoxiaoNeural)
  let currentVoicePack = 'xiaoxiao';
  let currentAudio = null;
  let isSpeaking = false;
  let onStartCallback = null;
  let onEndCallback = null;
  let autoEnabled = true;

  // 旧版音色名自动映射到全新神经网络音色
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

  // Web Speech API 离线兜底
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

  function stop() {
    if (currentAudio) {
      currentAudio.onplay = null;
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    if (synth) {
      synth.cancel();
    }
    if (isSpeaking) {
      isSpeaking = false;
      if (onEndCallback) onEndCallback();
    }
  }

  // 播放预生成的高清 Edge-TTS 神经网络音频片段（毫秒级响应，优先使用单文件内嵌 Base64 语音包，支持 100% 纯本地离线 HTML）
  function playClip(clipName, fallbackText = '', isManual = false) {
    if (!isManual && !autoEnabled) return;
    stop();

    const pack = PACK_ALIAS[currentVoicePack] || 'xiaoxiao';
    let audioSrc = `assets/audio/${pack}/${clipName}.mp3?v=neural1`;

    // 若运行于打包后的单文件离线 HTML 模式，直接读取内嵌的 Base64 神经网络语音数据
    if (typeof window !== 'undefined' && window.INLINE_VOICE_PACKS) {
      const packData = window.INLINE_VOICE_PACKS[pack] || window.INLINE_VOICE_PACKS['xiaoxiao'];
      if (packData && packData[clipName]) {
        audioSrc = packData[clipName];
      }
    }

    const audio = new Audio(audioSrc);
    currentAudio = audio;

    audio.onplay = () => {
      isSpeaking = true;
      if (onStartCallback) onStartCallback();
    };

    audio.onended = () => {
      isSpeaking = false;
      currentAudio = null;
      if (onEndCallback) onEndCallback();
    };

    audio.onerror = () => {
      currentAudio = null;
      isSpeaking = false;
      if (fallbackText) {
        speak(fallbackText, isManual);
      } else if (onEndCallback) {
        onEndCallback();
      }
    };

    audio.play().catch(err => {
      console.warn('[Voice] 自动播放受浏览器策略限制或中断:', err);
      currentAudio = null;
      isSpeaking = false;
      if (isManual && fallbackText) {
        speak(fallbackText, true);
      } else if (onEndCallback) {
        onEndCallback();
      }
    });
  }

  // 朗读关卡题目（优先播放预生成的微软 Neural 原声包）
  function speakPuzzle(puzzleId, fallbackText = '', isManual = false) {
    const clipName = `p${puzzleId}_intro`;
    playClip(clipName, fallbackText, isManual);
  }

  // 朗读通关喜讯
  function speakSuccess(puzzleId, fallbackText = '', isManual = false) {
    const clipName = `p${puzzleId}_win`;
    playClip(clipName, fallbackText, isManual);
  }

  // 朗读错误引导
  function speakError(errType, fallbackText = '', isManual = false) {
    const clipName = errType === 'liberty' ? 'err_liberty' : 'err_goal';
    playClip(clipName, fallbackText, isManual);
  }

  // 朗读对弈事件（提子、打吃、胜利、晋级等）
  function speakMatchEvent(eventName, fallbackText = '', isManual = false) {
    playClip(eventName, fallbackText, isManual);
  }

  // 选择系统内置最佳中文自然音色（仅当离线且无预置音频包时兜底）
  function pickBestSystemVoice() {
    if (!synth) return null;
    const voices = synth.getVoices() || [];
    const zhVoices = voices.filter(v => /zh|cmn/i.test(v.lang));
    if (!zhVoices.length) return null;

    // 优先匹配微软 Edge / Windows / macOS 的 Neural / Natural 高质量语音
    const priorityKeywords = ['Xiaoxiao', 'Xiaoyi', 'Yunxi', 'Yunxia', 'Neural', 'Natural', 'Premium', 'Enhanced', 'Tingting'];
    for (const kw of priorityKeywords) {
      const found = zhVoices.find(v => v.name.includes(kw));
      if (found) return found;
    }
    return zhVoices[0];
  }

  // 浏览器原生 Web Speech 兜底
  function speakWithBrowserTTS(cleanText) {
    if (!synth) {
      if (onEndCallback) onEndCallback();
      return;
    }
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = 'zh-CN';
    const bestVoice = pickBestSystemVoice();
    if (bestVoice) utter.voice = bestVoice;
    utter.rate = 1.0;
    utter.pitch = 1.0;

    utter.onstart = () => {
      isSpeaking = true;
      if (onStartCallback) onStartCallback();
    };
    utter.onend = () => {
      isSpeaking = false;
      if (onEndCallback) onEndCallback();
    };
    utter.onerror = () => {
      isSpeaking = false;
      if (onEndCallback) onEndCallback();
    };

    synth.speak(utter);
  }

  // 通用动态文本朗读：优先通过本地服务端 /api/tts 实时调用微软 Edge Neural TTS，离线则回退系统语音
  function speak(text, isManual = false) {
    if (!isManual && !autoEnabled) return;
    if (!text) return;
    stop();

    const cleanText = text.replace(/<[^>]+>/g, '').replace(/[★*#_`~💡🎉🏆🌿]/g, '').trim();
    if (!cleanText) return;

    // 如果是纯本地单文件 HTML 运行环境（file:// 或 data: 或内嵌打包），对于未预置的动态台词直接调用系统自然语音
    if (
      typeof window !== 'undefined' &&
      (window.IS_STANDALONE_HTML || window.location.protocol === 'file:' || window.location.protocol === 'data:')
    ) {
      speakWithBrowserTTS(cleanText);
      return;
    }

    const pack = PACK_ALIAS[currentVoicePack] || 'xiaoxiao';
    const ttsUrl = `/api/tts?voice=${encodeURIComponent(pack)}&text=${encodeURIComponent(cleanText)}`;
    const audio = new Audio(ttsUrl);
    currentAudio = audio;

    audio.onplay = () => {
      isSpeaking = true;
      if (onStartCallback) onStartCallback();
    };
    audio.onended = () => {
      isSpeaking = false;
      currentAudio = null;
      if (onEndCallback) onEndCallback();
    };
    audio.onerror = () => {
      currentAudio = null;
      isSpeaking = false;
      speakWithBrowserTTS(cleanText);
    };

    audio.play().catch(() => {
      currentAudio = null;
      isSpeaking = false;
      speakWithBrowserTTS(cleanText);
    });
  }

  return {
    speakPuzzle,
    speakSuccess,
    speakError,
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
