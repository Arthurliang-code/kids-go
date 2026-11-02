// app.js - 萌宝少儿围棋 主控制器（触控交互、高分屏Canvas渲染、关卡逻辑、AI对战、音效联动）

document.addEventListener('DOMContentLoaded', () => {
  // DOM 元素引用
  const canvas = document.getElementById('boardCanvas');
  const ctx = canvas.getContext('2d');
  const boardWrapper = document.getElementById('boardWrapper');
  const touchLoupe = document.getElementById('touchLoupe');

  // 导航与视图
  const tabAcademy = document.getElementById('tabAcademy');
  const tabMatch = document.getElementById('tabMatch');
  const tabBadges = document.getElementById('tabBadges');
  const viewAcademy = document.getElementById('viewAcademy');
  const viewBadges = document.getElementById('viewBadges');
  const gameLayout = document.getElementById('gameLayout');
  const academyControls = document.getElementById('academyControls');
  const matchControls = document.getElementById('matchControls');
  const scoreBox = document.getElementById('scoreBox');

  // 对弈状态与控制
  const petAvatar = document.getElementById('petAvatar');
  const petName = document.getElementById('petName');
  const petRank = document.getElementById('petRank');
  const petSpeech = document.getElementById('petSpeech');
  const blackScoreEl = document.getElementById('blackScore');
  const whiteScoreEl = document.getElementById('whiteScore');
  const btnRestart = document.getElementById('btnRestart');
  const btnUndo = document.getElementById('btnUndo');
  const btnPass = document.getElementById('btnPass');
  const btnHint = document.getElementById('btnHint');
  const toggleLiberties = document.getElementById('toggleLiberties');
  const toggleSound = document.getElementById('toggleSound');
  const selectBoardSize = document.getElementById('selectBoardSize');
  const selectGameMode = document.getElementById('selectGameMode');

  // 闯关相关
  const levelChipsContainer = document.getElementById('levelChipsContainer');
  const puzzleInstruction = document.getElementById('puzzleInstruction');
  const btnNextPuzzle = document.getElementById('btnNextPuzzle');
  const btnResetPuzzle = document.getElementById('btnResetPuzzle');
  const toggleVoice = document.getElementById('toggleVoice');
  const btnSpeakInstruction = document.getElementById('btnSpeakInstruction');
  const voiceBtnText = document.getElementById('voiceBtnText');
  const selectVoicePack = document.getElementById('selectVoicePack');

  // 语音播报视觉联动
  VoiceNarrator.setCallbacks(
    () => {
      if (btnSpeakInstruction) btnSpeakInstruction.classList.add('speaking');
      if (petAvatar) petAvatar.classList.add('speaking');
      if (voiceBtnText) voiceBtnText.textContent = '正在朗读...';
    },
    () => {
      if (btnSpeakInstruction) btnSpeakInstruction.classList.remove('speaking');
      if (petAvatar) petAvatar.classList.remove('speaking');
      if (voiceBtnText) voiceBtnText.textContent = '听师傅读题';
    }
  );

  // 弹窗
  const victoryModal = document.getElementById('victoryModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const btnModalAction = document.getElementById('btnModalAction');
  const btnInstallGuide = document.getElementById('btnInstallGuide');
  const installGuideModal = document.getElementById('installGuideModal');
  const installGuideSteps = document.getElementById('installGuideSteps');
  const btnCloseInstallGuide = document.getElementById('btnCloseInstallGuide');

  // 核心实例
  const engine = new GoEngine(9);
  const ai = new GoAI();

  // 运行时状态
  let currentMode = 'academy'; // 'academy' | 'match'
  let currentPuzzleIndex = 0;
  let puzzleIdentifiedPoints = new Set(); // 答题模式下已点击的点
  let touchActive = false;
  let hoverGridCoord = null;
  let hintCoord = null;         // 熊猫支招专属提示坐标
  let hintTimer = null;         // 支招高亮定时器
  let showLiberties = true;
  let isAITurn = false;
  let aiTimer = null;           // 托管 AI 延时走子定时器，避免模式切换/悔棋竞态穿透
  let isCaptureGameMode = true; // 初学吃子模式 vs 常规数地模式
  let targetCaptures = 3;       // 吃满3子获胜

  // 竞态定时器与提示光圈清理工具函数
  function clearAITimer() {
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    isAITurn = false;
  }

  function clearHint() {
    if (hintTimer) {
      clearTimeout(hintTimer);
      hintTimer = null;
    }
    hintCoord = null;
  }

  // 本地存储进度
  let userProgress = {
    passedPuzzles: [1], // 默认解锁第1关
    unlockedBadges: [],
    stars: 0,
    gamesWon: 0
  };

  try {
    const saved = localStorage.getItem('kids_go_progress');
    if (saved) {
      userProgress = Object.assign(userProgress, JSON.parse(saved));
    }
  } catch (e) {
    console.warn('读取本地记录失败', e);
  }

  function saveProgress() {
    try {
      localStorage.setItem('kids_go_progress', JSON.stringify(userProgress));
    } catch (e) {}
  }

  // ====== 1. 高分辨率与响应式画布尺寸自适应 ======
  function resizeCanvas() {
    const rect = boardWrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const padding = 20;
    const displaySize = Math.min(rect.width, rect.height) - padding * 2;

    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;
    canvas.width = Math.floor(displaySize * dpr);
    canvas.height = Math.floor(displaySize * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawBoard();
  }

  window.addEventListener('resize', resizeCanvas);

  // ====== 2. 坐标转换与星位计算 ======
  function getBoardMetrics() {
    const rect = canvas.getBoundingClientRect();
    const size = engine.size;
    const boardDimension = Math.min(rect.width, rect.height) || 400;
    // 动态计算边距：保证边缘棋子（半径 0.44 格宽）外围拥有充裕呼吸间隙，5路/7路棋盘边缘绝不裁切
    const marginRatio = 0.6;
    const cellSize = boardDimension / (size - 1 + marginRatio * 2);
    const margin = (boardDimension - (size - 1) * cellSize) / 2;
    return { rect, margin, cellSize, size };
  }

  function gridToPixel(gx, gy) {
    const { margin, cellSize } = getBoardMetrics();
    return {
      px: margin + gx * cellSize,
      py: margin + gy * cellSize
    };
  }

  function pixelToGrid(px, py) {
    const { margin, cellSize, size } = getBoardMetrics();
    const gx = Math.round((px - margin) / cellSize);
    const gy = Math.round((py - margin) / cellSize);
    if (gx >= 0 && gx < size && gy >= 0 && gy < size) {
      // 允许一定的触控热区吸附
      const center = gridToPixel(gx, gy);
      const dist = Math.hypot(px - center.px, py - center.py);
      if (dist < cellSize * 0.65) {
        return { gx, gy };
      }
    }
    return null;
  }

  function getStarPoints(size) {
    if (size === 5) return [{ x: 2, y: 2 }];
    if (size === 7) return [{ x: 3, y: 3 }];
    if (size === 9) {
      return [
        { x: 2, y: 2 }, { x: 6, y: 2 },
        { x: 4, y: 4 },
        { x: 2, y: 6 }, { x: 6, y: 6 }
      ];
    }
    if (size === 13) {
      return [
        { x: 3, y: 3 }, { x: 9, y: 3 },
        { x: 6, y: 6 },
        { x: 3, y: 9 }, { x: 9, y: 9 }
      ];
    }
    if (size === 19) {
      return [
        { x: 3, y: 3 }, { x: 9, y: 3 }, { x: 15, y: 3 },
        { x: 3, y: 9 }, { x: 9, y: 9 }, { x: 15, y: 9 },
        { x: 3, y: 15 }, { x: 9, y: 15 }, { x: 15, y: 15 }
      ];
    }
    return [];
  }

  // ====== 3. 棋盘与棋子专业渲染引擎 ======
  function drawBoard() {
    const { rect, margin, cellSize, size } = getBoardMetrics();
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // 棋盘格线
    ctx.strokeStyle = '#5a3d1b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < size; i++) {
      const p1 = gridToPixel(i, 0);
      const p2 = gridToPixel(i, size - 1);
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);

      const p3 = gridToPixel(0, i);
      const p4 = gridToPixel(size - 1, i);
      ctx.moveTo(p3.px, p3.py);
      ctx.lineTo(p4.px, p4.py);
    }
    ctx.stroke();

    // 星位（天元与星）
    const stars = getStarPoints(size);
    ctx.fillStyle = '#5a3d1b';
    for (const s of stars) {
      const pt = gridToPixel(s.x, s.y);
      ctx.beginPath();
      ctx.arc(pt.px, pt.py, Math.max(3.2, cellSize * 0.09), 0, Math.PI * 2);
      ctx.fill();
    }

    // 绘制棋子
    const stoneRadius = cellSize * 0.44;
    const groups = engine.getAllGroups();
    const libertyMap = new Map();
    for (const g of groups) {
      for (const s of g.stones) {
        libertyMap.set(`${s.x},${s.y}`, g.libertyCount);
      }
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const color = engine.board[y][x];
        if (color !== EMPTY) {
          const pt = gridToPixel(x, y);
          drawStone(pt.px, pt.py, stoneRadius, color);

          // 显示儿童气数或打吃危险提醒
          if (showLiberties) {
            const libs = libertyMap.get(`${x},${y}`) || 0;
            drawLibertyBadge(pt.px, pt.py, stoneRadius, libs);
          }
        }
      }
    }

    // 最后一手落子红点/光圈标记
    if (engine.lastMove && !engine.lastMove.pass) {
      const pt = gridToPixel(engine.lastMove.x, engine.lastMove.y);
      ctx.beginPath();
      ctx.arc(pt.px, pt.py, stoneRadius * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = engine.lastMove.color === BLACK ? '#ff4757' : '#2ed573';
      ctx.fill();
    }

    // 闯关模式下的特殊标记（已点击认出的气、提示点等）
    if (currentMode === 'academy') {
      const puzzle = PUZZLE_LEVELS[currentPuzzleIndex];
      if (puzzle.type === 'identify_liberties' || puzzle.type === 'identify_suicide') {
        for (const ptStr of puzzleIdentifiedPoints) {
          const [ix, iy] = ptStr.split(',').map(Number);
          const p = gridToPixel(ix, iy);
          ctx.beginPath();
          ctx.arc(p.px, p.py, stoneRadius * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(46, 213, 115, 0.7)';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // 绘制可爱小笑脸
          ctx.fillStyle = '#fff';
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✓', p.px, p.py);
        }
      }
    }

    // 触控悬浮半透明棋子预落子投影
    if (hoverGridCoord && engine.board[hoverGridCoord.gy][hoverGridCoord.gx] === EMPTY) {
      const pt = gridToPixel(hoverGridCoord.gx, hoverGridCoord.gy);
      ctx.save();
      ctx.globalAlpha = 0.55;
      drawStone(pt.px, pt.py, stoneRadius, engine.turn);
      ctx.restore();
    }

    // 熊猫导师锦囊妙计专属金色光圈与灯泡指引（与触控悬浮完全独立，不冲突）
    if (hintCoord && engine.board[hintCoord.gy][hintCoord.gx] === EMPTY) {
      const pt = gridToPixel(hintCoord.gx, hintCoord.gy);
      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.px, pt.py, stoneRadius * 0.95, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
      ctx.fill();

      ctx.font = `bold ${Math.max(14, Math.floor(cellSize * 0.42))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💡', pt.px, pt.py);
      ctx.restore();
    }
  }

  // 绘制具备 3D 拟真质感的黑白棋子
  function drawStone(px, py, r, color) {
    ctx.save();

    // 立体阴影
    ctx.beginPath();
    ctx.arc(px + 2, py + 3, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fill();

    // 棋子本体
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);

    if (color === BLACK) {
      const grad = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r);
      grad.addColorStop(0, '#596275');
      grad.addColorStop(0.3, '#303952');
      grad.addColorStop(1, '#1e272e');
      ctx.fillStyle = grad;
      ctx.fill();
    } else {
      const grad = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.85, '#eef1f6');
      grad.addColorStop(1, '#ced6e0');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#a4b0be';
      ctx.stroke();
    }

    ctx.restore();
  }

  // 绘制气数角标
  function drawLibertyBadge(px, py, r, count) {
    ctx.save();
    let badgeColor = '#2ed573'; // 3气及以上：安全绿
    if (count === 1) {
      badgeColor = '#ff4757'; // 1口气：打吃高危红
    } else if (count === 2) {
      badgeColor = '#ffa502'; // 2口气：提醒黄
    }

    const badgeR = Math.max(9, r * 0.38);
    ctx.beginPath();
    ctx.arc(px + r * 0.5, py - r * 0.5, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = badgeColor;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(badgeR * 1.3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(count === 1 ? '!' : count, px + r * 0.5, py - r * 0.5);

    ctx.restore();
  }

  // ====== 4. 触控与手势事件管理 (带放大悬浮准星) ======
  function handlePointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const grid = pixelToGrid(px, py);

      if (grid) {
        const changed = !hoverGridCoord || hoverGridCoord.gx !== grid.gx || hoverGridCoord.gy !== grid.gy;
        hoverGridCoord = grid;
        const pt = gridToPixel(grid.gx, grid.gy);

        const canvasRect = canvas.getBoundingClientRect();
        const wrapperRect = boardWrapper.getBoundingClientRect();
        const offsetX = canvasRect.left - wrapperRect.left;
        const offsetY = canvasRect.top - wrapperRect.top;

        // 触控移动时显示略微偏上的放大准星，避免手指挡住落子点
        if (e.pointerType === 'touch' || touchActive) {
          touchLoupe.style.display = 'block';
          touchLoupe.style.left = `${offsetX + pt.px}px`;
          touchLoupe.style.top = `${offsetY + pt.py - 35}px`;
        }
        if (changed) {
          drawBoard();
        }
      } else if (hoverGridCoord !== null) {
        hoverGridCoord = null;
        touchLoupe.style.display = 'none';
        drawBoard();
      }
    } else {
      if (hoverGridCoord !== null || touchLoupe.style.display !== 'none') {
        hoverGridCoord = null;
        touchLoupe.style.display = 'none';
        drawBoard();
      }
    }
  }

  function handlePointerDown(e) {
    if (isAITurn) return;
    touchActive = true;
    handlePointerMove(e);
  }

  function handlePointerUp(e) {
    touchActive = false;
    touchLoupe.style.display = 'none';

    if (isAITurn) return;
    if (hoverGridCoord) {
      executePlayerAction(hoverGridCoord.gx, hoverGridCoord.gy);
      hoverGridCoord = null;
    }
  }

  canvas.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', () => {
    touchActive = false;
    touchLoupe.style.display = 'none';
    hoverGridCoord = null;
    drawBoard();
  });

  // ====== 5. 业务落子与闯关判定 ======
  function executePlayerAction(gx, gy) {
    clearHint();
    if (currentMode === 'academy') {
      handlePuzzleMove(gx, gy);
    } else {
      handleMatchMove(gx, gy);
    }
  }

  // 闯关模式点击处理
  function handlePuzzleMove(gx, gy) {
    const puzzle = PUZZLE_LEVELS[currentPuzzleIndex];

    // 类型 A: 识别气或禁着点
    if (puzzle.type === 'identify_liberties' || puzzle.type === 'identify_suicide') {
      const key = `${gx},${gy}`;
      const isTarget = puzzle.targetPoints.some(p => p.x === gx && p.y === gy);

      if (isTarget) {
        puzzleIdentifiedPoints.add(key);
        SoundEffects.playStone();
        drawBoard();

        // 检查是否全部找齐
        if (puzzleIdentifiedPoints.size === puzzle.targetPoints.length) {
          onPuzzleComplete(puzzle);
        }
      } else {
        SoundEffects.playGentleError();
        petSpeech.textContent = "唔~ 这个点不是它的气哦，仔细看跟它直接连着的线！";
        if (VoiceNarrator.isEnabled()) {
          VoiceNarrator.speakError('liberty', petSpeech.textContent);
        }
      }
      return;
    }

    // 类型 B: 实战落子（打吃、提子、逃跑、两眼做活等）
    if (puzzle.type === 'play_move') {
      const isCorrect = puzzle.validMoves.some(m => m.x === gx && m.y === gy);
      if (isCorrect) {
        const res = engine.play(gx, gy, puzzle.playerColor);
        if (res.success) {
          if (res.captures.length > 0) {
            SoundEffects.playCapture();
          } else {
            SoundEffects.playStone();
          }
          drawBoard();
          onPuzzleComplete(puzzle);
        }
      } else {
        SoundEffects.playGentleError();
        petSpeech.textContent = "这一步没有达到效果呢，再想想提示，加油！";
        if (VoiceNarrator.isEnabled()) {
          VoiceNarrator.speakError('goal', petSpeech.textContent);
        }
      }
    }
  }

  // 闯关通关庆祝
  function onPuzzleComplete(puzzle) {
    SoundEffects.playSuccess();
    petSpeech.textContent = puzzle.successMsg;
    if (VoiceNarrator.isEnabled()) {
      VoiceNarrator.speakSuccess(puzzle.id, puzzle.voiceSuccess || puzzle.successMsg);
    }

    // 记录通关关卡与解锁下一关（确保第10关以及全关卡均能点亮星星和通关标识）
    if (!userProgress.passedPuzzles.includes(puzzle.id)) {
      userProgress.passedPuzzles.push(puzzle.id);
    }
    const nextId = puzzle.id + 1;
    if (!userProgress.passedPuzzles.includes(nextId) && nextId <= PUZZLE_LEVELS.length) {
      userProgress.passedPuzzles.push(nextId);
    }
    if (!userProgress.unlockedBadges.includes(puzzle.badge)) {
      userProgress.unlockedBadges.push(puzzle.badge);
    }
    userProgress.stars += 3;
    saveProgress();
    renderLevelChips();
    renderBadges();

    // 弹出庆祝模态框
    showVictoryModal({
      title: "闯关大成功！★★★",
      desc: `${puzzle.successMsg}\n\n【知识点】：${puzzle.explain}`,
      actionText: nextId <= PUZZLE_LEVELS.length ? "下一关！" : "再玩一次",
      onAction: () => {
        if (nextId <= PUZZLE_LEVELS.length) {
          loadPuzzle(nextId - 1);
        } else {
          loadPuzzle(0);
        }
      }
    });
  }

  // 对弈模式玩家走子
  function handleMatchMove(gx, gy) {
    const playColor = BLACK; // 玩家始终执黑
    if (engine.turn !== playColor) return;

    const res = engine.play(gx, gy, playColor);
    if (!res.success) {
      SoundEffects.playGentleError();
      petSpeech.textContent = `这里不能下：${res.reason}`;
      return;
    }

    if (res.captures.length > 0) {
      SoundEffects.playCapture();
      petSpeech.textContent = `哇塞！你吃掉了我的 ${res.captures.length} 颗棋子，太厉害了！`;
      if (VoiceNarrator.isEnabled()) {
        VoiceNarrator.speakMatchEvent('match_capture', petSpeech.textContent);
      }
    } else {
      SoundEffects.playStone();
      // 检查对手是否被打吃
      const oppStonesInAtari = engine.getAllGroups().filter(g => g.color === WHITE && g.libertyCount === 1);
      if (oppStonesInAtari.length > 0) {
        SoundEffects.playAtari();
        petSpeech.textContent = "呀！我的棋子被打吃啦，好紧张！";
        if (VoiceNarrator.isEnabled()) {
          VoiceNarrator.speakMatchEvent('match_atari', petSpeech.textContent);
        }
      } else {
        const quotes = ai.getCurrentRank().quotes;
        petSpeech.textContent = quotes[Math.floor(Math.random() * quotes.length)];
      }
    }

    updateScoreDisplay();
    drawBoard();

    // 胜负判定（吃子棋或盘满）
    if (checkGameEnd()) return;

    // 轮到 AI 落子（清理历史异步定时器，彻底杜绝竞态穿透）
    clearAITimer();
    isAITurn = true;
    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (currentMode !== 'match' || engine.turn !== WHITE) {
        isAITurn = false;
        return;
      }
      aiMove();
    }, 600);
  }

  // AI 智能走子
  function aiMove() {
    if (currentMode !== 'match' || engine.turn !== WHITE) {
      isAITurn = false;
      return;
    }
    const aiColor = WHITE;
    const best = ai.getBestMove(engine, aiColor, isCaptureGameMode);

    if (!best) {
      // AI Pass
      engine.pass();
      petSpeech.textContent = "小萌宠没有好下的地方，选择虚手（Pass）啦！";
      isAITurn = false;
      drawBoard();
      checkGameEnd();
      return;
    }

    const res = engine.play(best.x, best.y, aiColor);
    if (res.success) {
      if (res.captures.length > 0) {
        SoundEffects.playCapture();
        petSpeech.textContent = `嘻嘻！我吃掉了你 ${res.captures.length} 颗棋子哦~`;
      } else {
        SoundEffects.playStone();
        // 检查玩家棋子是否被打吃
        const playerInAtari = engine.getAllGroups().filter(g => g.color === BLACK && g.libertyCount === 1);
        if (playerInAtari.length > 0) {
          SoundEffects.playAtari();
          petSpeech.textContent = "小心哦！你的小黑棋被打吃了，快看看能不能逃！";
          if (VoiceNarrator.isEnabled()) {
            VoiceNarrator.speakMatchEvent('match_ai_atari', petSpeech.textContent);
          }
        }
      }
    }

    isAITurn = false;
    updateScoreDisplay();
    drawBoard();
    checkGameEnd();
  }

  // 胜负判定与自适应等级调整
  function checkGameEnd() {
    const blackCaps = engine.capturedStones[BLACK];
    const whiteCaps = engine.capturedStones[WHITE];

    // 吃子模式
    if (isCaptureGameMode) {
      if (whiteCaps >= targetCaptures) {
        // 玩家（黑方）吃满白子，玩家胜利！
        handleGameOver(true, `率先吃满 ${targetCaptures} 颗棋子！`);
        return true;
      }
      if (blackCaps >= targetCaptures) {
        // AI（白方）吃满黑子，AI 胜利
        handleGameOver(false, `萌宠率先吃满了 ${targetCaptures} 颗棋子哦！`);
        return true;
      }
    }

    // 连续两次虚手或无子可下
    if (engine.history.length >= 2) {
      const last = engine.history[engine.history.length - 1];
      const prev = engine.history[engine.history.length - 2];
      if (last.lastMove && last.lastMove.pass && prev.lastMove && prev.lastMove.pass) {
        const est = engine.estimateTerritory();
        const playerWon = est.blackScore > est.whiteScore;
        handleGameOver(playerWon, `黑棋 ${est.blackScore} 目 vs 白棋 ${est.whiteScore} 目`);
        return true;
      }
    }

    return false;
  }

  function handleGameOver(playerWon, reason) {
    const result = ai.recordGameResult(playerWon);

    if (playerWon) {
      userProgress.gamesWon++;
      saveProgress();
      if (result.promoted) {
        SoundEffects.playLevelUp();
        if (VoiceNarrator.isEnabled()) {
          VoiceNarrator.speakMatchEvent('match_promote', `恭喜你连胜晋级到了${result.newRank.name}，解锁了新对手${result.newRank.animal}！`);
        }
        showVictoryModal({
          title: "🎉 恭喜晋级新段位！",
          desc: `连胜晋级！你成功晋升到了【${result.newRank.name}】！\n解锁了新对手【${result.newRank.animal}】！`,
          actionText: "挑战新对手",
          onAction: () => {
            initMatchView();
          }
        });
      } else {
        SoundEffects.playSuccess();
        if (VoiceNarrator.isEnabled()) {
          VoiceNarrator.speakMatchEvent('match_win', `太棒啦！${reason}`);
        }
        showVictoryModal({
          title: "🏆 对局大获全胜！",
          desc: `太棒啦！${reason}\n继续保持连胜，就能晋级更高段位哦！`,
          actionText: "再来一局",
          onAction: () => {
            resetMatch();
          }
        });
      }
    } else {
      SoundEffects.playGentleError();
      let hintText = "差一点点就赢啦！吸取教训，稳扎稳打再来一次！";
      if (result.demoted) {
        hintText = "对手微调了难度，多加练习，下一局一定行！";
      }
      if (VoiceNarrator.isEnabled()) {
        VoiceNarrator.speakMatchEvent('match_lose', hintText);
      }
      showVictoryModal({
        title: "🌿 棋艺切磋完成",
        desc: `${reason}\n${hintText}`,
        actionText: "重新挑战",
        onAction: () => {
          resetMatch();
        }
      });
    }

    updatePetCard();
  }

  // ====== 6. 界面与控制器状态更新 ======
  function updateScoreDisplay() {
    blackScoreEl.textContent = engine.capturedStones[WHITE]; // 黑棋吃到的白子数
    whiteScoreEl.textContent = engine.capturedStones[BLACK]; // 白棋吃到的黑子数
  }

  function updatePetCard() {
    const rank = ai.getCurrentRank();
    petAvatar.textContent = rank.icon;
    petName.textContent = rank.name;
    petRank.textContent = rank.title;
  }

  function showVictoryModal({ title, desc, actionText, onAction }) {
    modalTitle.textContent = title;
    modalDesc.innerText = desc;
    btnModalAction.textContent = actionText;
    btnModalAction.onclick = () => {
      victoryModal.classList.remove('show');
      if (onAction) onAction();
    };
    victoryModal.classList.add('show');
  }

  // 加载指定关卡
  function loadPuzzle(index) {
    clearAITimer();
    clearHint();
    if (scoreBox) scoreBox.style.display = 'none';
    currentPuzzleIndex = index;
    const puzzle = PUZZLE_LEVELS[index];
    puzzleIdentifiedPoints.clear();

    engine.loadBoard(puzzle.initialBoard, puzzle.playerColor);
    puzzleInstruction.innerHTML = `<strong>${puzzle.title}</strong><br>${puzzle.tip}`;
    petSpeech.textContent = puzzle.tip;

    renderLevelChips();
    resizeCanvas();

    // 自动为小朋友语音朗读题目要求（非手动强制，遵循自动朗读设置）
    VoiceNarrator.speakPuzzle(puzzle.id, puzzle.voiceTip || puzzle.tip, false);
  }

  // 渲染关卡选项卡
  function renderLevelChips() {
    levelChipsContainer.innerHTML = '';
    PUZZLE_LEVELS.forEach((p, idx) => {
      const chip = document.createElement('div');
      const isPassed = userProgress.passedPuzzles.includes(p.id) || userProgress.passedPuzzles.includes(p.id + 1);
      chip.className = `level-chip ${idx === currentPuzzleIndex ? 'active' : ''} ${isPassed ? 'passed' : ''}`;
      chip.textContent = `${idx + 1}. ${p.category}`;
      chip.onclick = () => {
        SoundEffects.playClick();
        loadPuzzle(idx);
      };
      levelChipsContainer.appendChild(chip);
    });
  }

  // 渲染荣誉徽章
  function renderBadges() {
    const badgeGrid = document.getElementById('badgeGrid');
    if (!badgeGrid) return;

    const allBadges = [
      { name: "入门徽章", icon: "🌱", desc: "完成数气启蒙" },
      { name: "观察小能手", icon: "🔍", desc: "掌握角边死活" },
      { name: "吃子小神童", icon: "🥕", desc: "掌握提子技巧" },
      { name: "威风凛凛", icon: "⚡", desc: "熟练运用打吃" },
      { name: "逃脱大师", icon: "🏃", desc: "成功逃脱虎口" },
      { name: "智慧之眼", icon: "👁️", desc: "识别禁着陷阱" },
      { name: "大门守卫", icon: "🚪", desc: "掌握门吃技巧" },
      { name: "爱心怀抱", icon: "🤗", desc: "掌握抱吃技巧" },
      { name: "不败宗师", icon: "🏰", desc: "掌握两眼活棋" },
      { name: "追击神将", icon: "🐏", desc: "完成扭羊头征子" }
    ];

    badgeGrid.innerHTML = '';
    allBadges.forEach(b => {
      const unlocked = userProgress.unlockedBadges.includes(b.name);
      const card = document.createElement('div');
      card.className = `badge-item ${unlocked ? 'unlocked' : ''}`;
      card.innerHTML = `
        <div class="badge-icon">${b.icon}</div>
        <div class="badge-name">${b.name}</div>
        <div class="badge-status">${unlocked ? '已获得 ★★★' : '闯关解锁'}</div>
      `;
      badgeGrid.appendChild(card);
    });
  }

  // 对战重开
  function resetMatch() {
    clearAITimer();
    clearHint();
    const size = parseInt(selectBoardSize.value, 10);
    engine.reset(size);
    isAITurn = false;
    updateScoreDisplay();
    updatePetCard();
    resizeCanvas();
  }

  function initMatchView() {
    clearAITimer();
    clearHint();
    currentMode = 'match';
    if (scoreBox) scoreBox.style.display = 'flex';
    updatePetCard();
    resetMatch();
  }

  // ====== 7. 按钮与交互绑定 ======
  tabAcademy.onclick = () => {
    SoundEffects.playClick();
    VoiceNarrator.stop();
    clearAITimer();
    clearHint();
    tabAcademy.classList.add('active');
    tabMatch.classList.remove('active');
    tabBadges.classList.remove('active');
    viewAcademy.classList.add('active');
    viewBadges.classList.remove('active');
    gameLayout.style.display = 'flex';
    if (scoreBox) scoreBox.style.display = 'none';
    academyControls.style.display = 'block';
    matchControls.style.display = 'none';
    currentMode = 'academy';
    petAvatar.textContent = '🐼';
    petName.textContent = '熊猫师傅';
    petRank.textContent = '启蒙导师';
    loadPuzzle(currentPuzzleIndex);
  };

  tabMatch.onclick = () => {
    SoundEffects.playClick();
    VoiceNarrator.stop();
    clearAITimer();
    clearHint();
    tabMatch.classList.add('active');
    tabAcademy.classList.remove('active');
    tabBadges.classList.remove('active');
    viewAcademy.classList.remove('active');
    viewBadges.classList.remove('active');
    gameLayout.style.display = 'flex';
    if (scoreBox) scoreBox.style.display = 'flex';
    academyControls.style.display = 'none';
    matchControls.style.display = 'flex';
    initMatchView();
  };

  tabBadges.onclick = () => {
    SoundEffects.playClick();
    VoiceNarrator.stop();
    clearAITimer();
    clearHint();
    tabBadges.classList.add('active');
    tabAcademy.classList.remove('active');
    tabMatch.classList.remove('active');
    viewAcademy.classList.remove('active');
    viewBadges.classList.add('active');
    gameLayout.style.display = 'none';
    if (scoreBox) scoreBox.style.display = 'none';
    renderBadges();
  };

  // 悔棋
  btnUndo.onclick = () => {
    SoundEffects.playClick();
    if (currentMode === 'match') {
      clearAITimer();
      clearHint();
      // 撤回玩家和 AI 各一步
      engine.undo();
      engine.undo();
      drawBoard();
      updateScoreDisplay();
      petSpeech.textContent = "好的，时光倒流！重新走一步吧~";
    }
  };

  // 重开局
  btnRestart.onclick = () => {
    SoundEffects.playClick();
    clearAITimer();
    clearHint();
    resetMatch();
  };

  // 虚手
  btnPass.onclick = () => {
    SoundEffects.playClick();
    clearAITimer();
    clearHint();
    engine.pass();
    petSpeech.textContent = "黑棋选择虚手（停一手），轮到萌宠啦！";
    drawBoard();
    if (!checkGameEnd()) {
      isAITurn = true;
      aiTimer = setTimeout(() => {
        aiTimer = null;
        if (currentMode !== 'match' || engine.turn !== WHITE) {
          isAITurn = false;
          return;
        }
        aiMove();
      }, 600);
    }
  };

  // 熊猫导师锦囊妙计 (Hint)
  btnHint.onclick = () => {
    SoundEffects.playClick();
    const legal = engine.getLegalMoves(BLACK);
    if (legal.length > 0) {
      // 找出当前最推荐的一手
      const tempAI = new GoAI();
      tempAI.setRankIndex(4); // 借用 1D 熊猫智力评估
      const rec = tempAI.getBestMove(engine, BLACK);
      if (rec) {
        clearHint();
        hintCoord = { gx: rec.x, gy: rec.y };
        drawBoard();
        petSpeech.textContent = `💡 熊猫师傅提示：下在 (${rec.x + 1}, ${rec.y + 1}) 是一步好棋哦！`;
        hintTimer = setTimeout(() => {
          clearHint();
          drawBoard();
        }, 3000);
      }
    }
  };

  // 气数开关
  toggleLiberties.onchange = (e) => {
    showLiberties = e.target.checked;
    drawBoard();
  };

  // 声音开关
  toggleSound.onclick = () => {
    const isMuted = SoundEffects.toggleMute();
    toggleSound.textContent = isMuted ? '🔇' : '🔊';
  };

  // 棋盘大小选择
  selectBoardSize.onchange = () => {
    resetMatch();
  };

  // 对弈模式选择
  selectGameMode.onchange = (e) => {
    isCaptureGameMode = e.target.value === 'capture';
    targetCaptures = parseInt(selectGameMode.options[selectGameMode.selectedIndex].dataset.target || '3', 10);
    resetMatch();
  };

  // 闯关重置本题
  btnResetPuzzle.onclick = () => {
    SoundEffects.playClick();
    loadPuzzle(currentPuzzleIndex);
  };

  // 闯关下一题
  btnNextPuzzle.onclick = () => {
    SoundEffects.playClick();
    if (currentPuzzleIndex < PUZZLE_LEVELS.length - 1) {
      loadPuzzle(currentPuzzleIndex + 1);
    }
  };

  // 听师傅读题按钮 (专门为不识字的小朋友设计，手动点击始终朗读，不被自动朗读开关屏蔽)
  if (btnSpeakInstruction) {
    btnSpeakInstruction.onclick = () => {
      SoundEffects.playClick();
      const puzzle = PUZZLE_LEVELS[currentPuzzleIndex];
      VoiceNarrator.speakPuzzle(puzzle.id, puzzle.voiceTip || puzzle.tip, true);
    };
  }

  // 配音角色音色切换（试听当前关卡题目）
  if (selectVoicePack) {
    selectVoicePack.onchange = (e) => {
      SoundEffects.playClick();
      VoiceNarrator.setVoicePack(e.target.value);
      const puzzle = PUZZLE_LEVELS[currentPuzzleIndex];
      VoiceNarrator.speakPuzzle(puzzle.id, puzzle.voiceTip || puzzle.tip, true);
    };
  }

  // 语音自动朗读开关
  if (toggleVoice) {
    toggleVoice.onclick = () => {
      const enabled = VoiceNarrator.toggle();
      toggleVoice.textContent = enabled ? '🗣️' : '🤐';
      toggleVoice.title = enabled ? '自动语音朗读：已开启' : '自动语音朗读：已关闭';
    };
  }

  // 专为异地长辈设计的「📲 放到桌面」大字傻瓜式图文引导
  const isStandaloneApp =
    window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

  if (btnInstallGuide) {
    if (isStandaloneApp) {
      btnInstallGuide.style.display = 'none';
    } else {
      btnInstallGuide.onclick = () => {
        SoundEffects.playClick();
        const isWeChat = /MicroMessenger/i.test(navigator.userAgent || '');
        if (installGuideSteps) {
          if (isWeChat) {
            installGuideSteps.innerHTML = `
              <div class="install-step-item">
                <span class="install-step-num">1</span>
                <div>请点击微信右上角的 <strong>【···】三个点</strong> 按钮</div>
              </div>
              <div class="install-step-item">
                <span class="install-step-num">2</span>
                <div>选择 <strong>【🧭 在默认浏览器(Safari)中打开】</strong></div>
              </div>
              <div class="install-step-item">
                <span class="install-step-num">3</span>
                <div>在浏览器右上角点 <strong>【分享按钮 ⎋】➔【➕ 添加到主屏幕】</strong>，桌面上就有【🐼 萌宝围棋】图标啦！</div>
              </div>
            `;
          } else {
            installGuideSteps.innerHTML = `
              <div class="install-step-item">
                <span class="install-step-num">1</span>
                <div>点击屏幕右上角的 <strong>【分享按钮 ⎋（带向上箭头的方框）】</strong></div>
              </div>
              <div class="install-step-item">
                <span class="install-step-num">2</span>
                <div>在弹出菜单往下滑，点击 <strong>【➕ 添加到主屏幕】</strong>，再点右上角 <strong>【添加】</strong> 即可！</div>
              </div>
            `;
          }
        }
        if (installGuideModal) {
          installGuideModal.classList.add('show');
        }
      };
    }
  }

  if (btnCloseInstallGuide && installGuideModal) {
    btnCloseInstallGuide.onclick = () => {
      SoundEffects.playClick();
      installGuideModal.classList.remove('show');
    };
  }

  // ====== 8. 初始化执行 ======
  renderLevelChips();
  loadPuzzle(0);

  // iPad 微信 / Safari 首次触摸自动解锁语音（解决苹果系统禁止网页未点击自动出声的问题）
  let firstTouchUnlocked = false;
  const unlockVoiceOnFirstTouch = (e) => {
    if (firstTouchUnlocked) return;
    firstTouchUnlocked = true;
    // 如果点击的不是朗读按钮本身，且当前正在闯关界面但尚未发声，则在首次点击时友好播报题目
    const target = e.target;
    const clickedVoiceControl =
      target &&
      (target.closest('#btnSpeakInstruction') ||
       target.closest('#selectVoicePack') ||
       target.closest('#toggleVoice'));
    if (!clickedVoiceControl && currentMode === 'academy' && VoiceNarrator.isEnabled() && !VoiceNarrator.isSpeakingNow()) {
      const puzzle = PUZZLE_LEVELS[currentPuzzleIndex];
      VoiceNarrator.speakPuzzle(puzzle.id, puzzle.voiceTip || puzzle.tip, false);
    }
  };
  window.addEventListener('pointerdown', unlockVoiceOnFirstTouch, { once: true });

  // ====== 9. iPad / PWA 离线运行 Service Worker 注册 ======
  if (
    'serviceWorker' in navigator &&
    !window.IS_STANDALONE_HTML &&
    (window.location.protocol === 'http:' || window.location.protocol === 'https:')
  ) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => {
          console.log('[PWA] Service Worker 离线引擎就绪:', reg.scope);
        })
        .catch(err => {
          console.warn('[PWA] Service Worker 注册提示:', err);
        });
    });
  }
});
