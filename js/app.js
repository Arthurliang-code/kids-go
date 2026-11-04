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
  const playerSideBlack = document.getElementById('playerSideBlack');
  const playerSideWhite = document.getElementById('playerSideWhite');
  const opponentSideName = document.getElementById('opponentSideName');
  const turnBanner = document.getElementById('turnBanner');
  const turnBannerStone = document.getElementById('turnBannerStone');
  const turnBannerText = document.getElementById('turnBannerText');

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
  const btnStageBeginner = document.getElementById('btnStageBeginner');
  const btnStageIntermediate = document.getElementById('btnStageIntermediate');
  const petCard = document.getElementById('petCard');
  const academyStepPills = document.getElementById('academyStepPills');
  const btnTabPractice = document.getElementById('btnTabPractice');
  const btnTabTeach1 = document.getElementById('btnTabTeach1');
  const btnTabTeach2 = document.getElementById('btnTabTeach2');
  const btnReplayTeach = document.getElementById('btnReplayTeach');
  const btnTeachText = document.getElementById('btnTeachText');
  const answerRevealBox = document.getElementById('answerRevealBox');
  const answerRevealText = document.getElementById('answerRevealText');
  const btnAutoPlayAnswer = document.getElementById('btnAutoPlayAnswer');
  const btnShowAnswer = document.getElementById('btnShowAnswer');
  const btnShowAnswerText = document.getElementById('btnShowAnswerText');
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
      if (voiceBtnText) {
        if (currentMode === 'academy' && showPuzzleAnswer) {
          voiceBtnText.textContent = '听答案解析';
        } else if (currentMode === 'academy' && academySubMode === 'teach') {
          voiceBtnText.textContent = '听图解讲解';
        } else {
          voiceBtnText.textContent = '听师傅读题';
        }
      }
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
  let academySubMode = 'teach'; // 'teach' (课前教学演示) | 'practice' (动手闯关练习)
  let currentStage = 'beginner'; // 'beginner' (1~10关) | 'intermediate' (11~20关)
  let currentTeachStepIndex = 0;
  let currentPuzzleIndex = 0;
  let puzzleIdentifiedPoints = new Set(); // 答题模式下已点击的点
  let showPuzzleAnswer = false; // 是否在棋盘与讲台显示本题标准答案
  let isAnimatingFollowUp = false; // 通关后棋盘动态演示锁定
  let followUpTimers = [];
  let touchActive = false;
  let hoverGridCoord = null;
  let hintCoord = null;         // 熊猫支招专属提示坐标
  let hintTimer = null;         // 支招高亮定时器
  let showLiberties = false;    // 气数与危险预警提示默认关闭，可在侧边栏开关手动开启
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

  function clearFollowUpTimers() {
    while (followUpTimers.length > 0) {
      clearTimeout(followUpTimers.pop());
    }
    isAnimatingFollowUp = false;
  }

  // 本地存储进度（passedPuzzles 仅记录真正完成判题过关的关卡 ID）
  let userProgress = {
    passedPuzzles: [],
    unlockedBadges: [],
    stars: 0,
    gamesWon: 0
  };

  try {
    const saved = localStorage.getItem('kids_go_progress');
    if (saved) {
      const parsed = JSON.parse(saved);
      userProgress = Object.assign(userProgress, parsed);
      // 修正旧版本初始把未通关的第1关或下一关塞进 passedPuzzles 的历史遗留数据
      if (
        Array.isArray(userProgress.passedPuzzles) &&
        userProgress.stars === 0 &&
        (!userProgress.unlockedBadges || userProgress.unlockedBadges.length === 0)
      ) {
        userProgress.passedPuzzles = [];
      }
    }
  } catch (e) {
    console.warn('读取本地记录失败', e);
  }

  function saveProgress() {
    try {
      localStorage.setItem('kids_go_progress', JSON.stringify(userProgress));
    } catch (e) {}
  }

  // ====== 1. 高分辨率与响应式画布尺寸自适应（全面适配小尺寸 iPad Pro 横竖屏与分屏） ======
  function resizeCanvas() {
    const rect = boardWrapper.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    const computed = window.getComputedStyle(boardWrapper);
    const padX = (parseFloat(computed.paddingLeft) || 14) + (parseFloat(computed.paddingRight) || 14);
    const padY = (parseFloat(computed.paddingTop) || 14) + (parseFloat(computed.paddingBottom) || 14);
    const borderX = (parseFloat(computed.borderLeftWidth) || 0) + (parseFloat(computed.borderRightWidth) || 0);
    const borderY = (parseFloat(computed.borderTopWidth) || 0) + (parseFloat(computed.borderBottomWidth) || 0);
    const availW = rect.width - padX - borderX;
    const availH = rect.height - padY - borderY;
    const displaySize = Math.max(180, Math.floor(Math.min(availW, availH)));

    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;
    canvas.width = Math.floor(displaySize * dpr);
    canvas.height = Math.floor(displaySize * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawBoard();
  }

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 120);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeCanvas);
  }
  if (typeof ResizeObserver !== 'undefined' && boardWrapper) {
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(boardWrapper);
  }

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
    updateTurnIndicator();

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

    // 棋盘边缘行列数字坐标（1..size），方便对照答案中的“第X列、第Y行”
    ctx.save();
    ctx.fillStyle = 'rgba(90, 61, 27, 0.72)';
    ctx.font = `bold ${Math.max(10, Math.floor(margin * 0.36))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const coordOffset = Math.max(12, margin * 0.54);
    for (let i = 0; i < size; i++) {
      const topPt = gridToPixel(i, 0);
      ctx.fillText(String(i + 1), topPt.px, topPt.py - coordOffset);
      const leftPt = gridToPixel(0, i);
      ctx.fillText(String(i + 1), leftPt.px - coordOffset, leftPt.py);
    }
    ctx.restore();

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

    // 闯关模式下的特殊标记（课前教学图解标注、已点击认出的气、提示点等）
    if (currentMode === 'academy') {
      const puzzle = PUZZLE_LEVELS[currentPuzzleIndex];
      if (academySubMode === 'teach' && puzzle.teachingSteps && puzzle.teachingSteps[currentTeachStepIndex]) {
        drawTeachingStepOverlay(puzzle.teachingSteps[currentTeachStepIndex], stoneRadius, cellSize);
      } else if (puzzle.type === 'identify_liberties' || puzzle.type === 'identify_suicide') {
        for (const ptStr of puzzleIdentifiedPoints) {
          const [ix, iy] = ptStr.split(',').map(Number);
          const p = gridToPixel(ix, iy);
          ctx.beginPath();
          ctx.arc(p.px, p.py, stoneRadius * 0.55, 0, Math.PI * 2);
          ctx.fillStyle = puzzle.type === 'identify_suicide'
            ? 'rgba(255, 71, 87, 0.85)'
            : 'rgba(46, 213, 115, 0.85)';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.fillStyle = '#fff';
          ctx.font = `bold ${Math.max(13, Math.floor(stoneRadius * 0.65))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(puzzle.type === 'identify_suicide' ? '禁' : '✓', p.px, p.py);
        }
      } else if (puzzle.id === 9 && isAnimatingFollowUp) {
        // 第9关两眼活棋完成后，高亮标出新分出来的左右两只真眼
        drawTeachingStepOverlay({
          markers: [
            { x: 2, y: 3, text: '真眼', style: 'good' },
            { x: 4, y: 3, text: '真眼', style: 'good' }
          ]
        }, stoneRadius, cellSize);
      }

      // 如果开启了“显示本题答案”，在棋盘上高亮标出标准答案坐标与后续变化序号
      if (showPuzzleAnswer && !isAnimatingFollowUp) {
        drawPuzzleAnswerOverlay(puzzle, stoneRadius, cellSize);
      }
    }

    // 触控悬浮半透明棋子预落子投影（仅在练习或对战且未锁定时显示）
    if (
      !isAnimatingFollowUp &&
      !(currentMode === 'academy' && academySubMode === 'teach') &&
      hoverGridCoord &&
      engine.board[hoverGridCoord.gy][hoverGridCoord.gx] === EMPTY
    ) {
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

  // 绘制课前教学步骤的可视化辅助图层（呼吸连线、方向箭头、正误与要点角标）
  function drawTeachingStepOverlay(step, stoneRadius, cellSize) {
    ctx.save();

    // 1. 呼吸通道高亮连线
    if (Array.isArray(step.lines)) {
      for (const ln of step.lines) {
        const p1 = gridToPixel(ln.x1, ln.y1);
        const p2 = gridToPixel(ln.x2, ln.y2);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.strokeStyle = ln.color || '#2ed573';
        ctx.lineWidth = Math.max(5, cellSize * 0.12);
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    // 2. 逃生/追击方向引导箭头
    if (Array.isArray(step.arrows)) {
      for (const ar of step.arrows) {
        const p1 = gridToPixel(ar.fromX, ar.fromY);
        const p2 = gridToPixel(ar.toX, ar.toY);
        const angle = Math.atan2(p2.py - p1.py, p2.px - p1.px);
        const headLen = Math.max(10, stoneRadius * 0.55);

        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.strokeStyle = ar.color || '#2ed573';
        ctx.lineWidth = Math.max(4, cellSize * 0.1);
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(p2.px, p2.py);
        ctx.lineTo(p2.px - headLen * Math.cos(angle - Math.PI / 6), p2.py - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(p2.px - headLen * Math.cos(angle + Math.PI / 6), p2.py - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = ar.color || '#2ed573';
        ctx.fill();
      }
    }

    // 3. 交叉点教学圆章标注（①②③④、✓、✗、门柱、真眼等）
    if (Array.isArray(step.markers)) {
      const stylePalette = {
        good: { bg: 'rgba(46, 213, 115, 0.92)', border: '#ffffff' },
        bad: { bg: 'rgba(255, 71, 87, 0.92)', border: '#ffffff' },
        warn: { bg: 'rgba(255, 165, 2, 0.92)', border: '#ffffff' },
        info: { bg: 'rgba(30, 144, 255, 0.92)', border: '#ffffff' }
      };

      for (const mk of step.markers) {
        const pt = gridToPixel(mk.x, mk.y);
        const pal = stylePalette[mk.style] || stylePalette.info;
        const hasStone = engine.inBounds(mk.x, mk.y) && engine.board[mk.y][mk.x] !== EMPTY;
        // 如果该位置已有棋子，则把标签画在棋子正下方或中心胶囊上，避免遮挡整颗棋子
        const isLongText = String(mk.text).length >= 2;
        const badgeR = isLongText ? stoneRadius * 0.68 : stoneRadius * 0.54;

        ctx.beginPath();
        ctx.arc(pt.px, pt.py, badgeR, 0, Math.PI * 2);
        ctx.fillStyle = pal.bg;
        ctx.fill();
        ctx.strokeStyle = pal.border;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        const fontSize = isLongText
          ? Math.max(11, Math.floor(stoneRadius * 0.48))
          : Math.max(14, Math.floor(stoneRadius * 0.68));
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mk.text, pt.px, pt.py + (hasStone ? 0 : 0.5));
      }
    }

    ctx.restore();
  }

  // 绘制试题标准答案棋盘可视化指引（金色星标、正解落点预览与后续连招序号）
  function drawPuzzleAnswerOverlay(puzzle, stoneRadius, cellSize) {
    if (!puzzle) return;
    ctx.save();

    if (puzzle.type === 'identify_liberties' || puzzle.type === 'identify_suicide' || puzzle.type === 'identify_false_eye') {
      const pts = puzzle.targetPoints || [];
      pts.forEach((ptCoord, idx) => {
        const key = `${ptCoord.x},${ptCoord.y}`;
        if (puzzleIdentifiedPoints.has(key)) return; // 已经点对的不重复遮挡
        const pt = gridToPixel(ptCoord.x, ptCoord.y);

        // 外层金色呼吸光环
        ctx.beginPath();
        ctx.arc(pt.px, pt.py, stoneRadius * 0.78, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 215, 0, 0.28)';
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 中心答案角标
        ctx.beginPath();
        ctx.arc(pt.px, pt.py, stoneRadius * 0.54, 0, Math.PI * 2);
        ctx.fillStyle = puzzle.type === 'identify_suicide'
          ? 'rgba(239, 68, 68, 0.94)'
          : (puzzle.type === 'identify_false_eye' ? 'rgba(234, 88, 12, 0.95)' : 'rgba(245, 158, 11, 0.95)');
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        let label = pts.length > 1 ? `★${idx + 1}` : '★正解';
        if (puzzle.type === 'identify_suicide') label = '★禁';
        if (puzzle.type === 'identify_false_eye') label = '★假眼';

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(11, Math.floor(stoneRadius * 0.48))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, pt.px, pt.py);
      });
    } else if (puzzle.type === 'play_move') {
      const moves = puzzle.validMoves || [];
      moves.forEach((mv, idx) => {
        const pt = gridToPixel(mv.x, mv.y);

        // 半透明正解黑子预览
        if (engine.inBounds(mv.x, mv.y) && engine.board[mv.y][mv.x] === EMPTY) {
          ctx.save();
          ctx.globalAlpha = 0.45;
          drawStone(pt.px, pt.py, stoneRadius, puzzle.playerColor || BLACK);
          ctx.restore();
        }

        // 外圈金色光环
        ctx.beginPath();
        ctx.arc(pt.px, pt.py, stoneRadius * 0.92, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // 正解星标胶囊
        ctx.beginPath();
        ctx.arc(pt.px, pt.py, stoneRadius * 0.58, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        const label = moves.length > 1 ? `★${idx + 1}` : '★正解';
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(11, Math.floor(stoneRadius * 0.46))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, pt.px, pt.py);
      });

      // 若有后续连招演示（如第10关扭羊头征子），标出后续步骤序号 ②③④...
      if (Array.isArray(puzzle.followUpSequence) && puzzle.followUpSequence.length > 0) {
        puzzle.followUpSequence.forEach((step, idx) => {
          const pt = gridToPixel(step.x, step.y);
          const stepNum = idx + 2; // 第一手是①，后续从2开始
          ctx.beginPath();
          ctx.arc(pt.px, pt.py, stoneRadius * 0.44, 0, Math.PI * 2);
          ctx.fillStyle = step.color === BLACK
            ? 'rgba(30, 39, 46, 0.88)'
            : 'rgba(255, 255, 255, 0.92)';
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = step.color === BLACK ? '#ffd700' : '#d97706';
          ctx.font = `bold ${Math.max(11, Math.floor(stoneRadius * 0.48))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(stepNum), pt.px, pt.py);
        });
      }
    }

    ctx.restore();
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

  // 判断某个坐标是否是盘面任意一颗棋子的斜角紧邻点（用于第1/2关针对性提醒“斜角不算气”）
  function isDiagonalNeighborOfAnyStone(gx, gy) {
    const diagDirs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [dx, dy] of diagDirs) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (engine.inBounds(nx, ny) && engine.board[ny][nx] !== EMPTY) {
        return true;
      }
    }
    return false;
  }

  // 播放过关后的棋盘动态后续演示（如门吃、抱吃、扭羊头连续追击，或短暂展示提子/做眼效果后再弹窗）
  function playPuzzleFollowUpAndComplete(puzzle) {
    isAnimatingFollowUp = true;
    const seq = Array.isArray(puzzle.followUpSequence) ? puzzle.followUpSequence : [];

    if (seq.length === 0) {
      petSpeech.textContent = puzzle.successMsg;
      const t = setTimeout(() => {
        isAnimatingFollowUp = false;
        onPuzzleComplete(puzzle);
      }, 750);
      followUpTimers.push(t);
      return;
    }

    seq.forEach((step, idx) => {
      const t = setTimeout(() => {
        const res = engine.play(step.x, step.y, step.color);
        if (res.success) {
          if (res.captures && res.captures.length > 0) {
            SoundEffects.playCapture();
          } else {
            SoundEffects.playStone();
          }
        }
        if (step.speech) {
          petSpeech.textContent = step.speech;
        }
        drawBoard();
      }, (idx + 1) * 580);
      followUpTimers.push(t);
    });

    const finalTimer = setTimeout(() => {
      isAnimatingFollowUp = false;
      onPuzzleComplete(puzzle);
    }, (seq.length + 1) * 580 + 350);
    followUpTimers.push(finalTimer);
  }

  // 闯关模式点击处理
  function handlePuzzleMove(gx, gy) {
    if (isAnimatingFollowUp) return;
    const puzzle = PUZZLE_LEVELS[currentPuzzleIndex];

    // 如果当前处于【课前教学演示】阶段，点击棋盘自动推进下一步教学或进入练习
    if (academySubMode === 'teach') {
      const steps = puzzle.teachingSteps || [];
      SoundEffects.playClick();
      if (currentTeachStepIndex < steps.length - 1) {
        startTeachingPhase(currentTeachStepIndex + 1);
      } else {
        startPracticePhase();
      }
      return;
    }

    // 类型 A1: 识别棋子的气（第1关、第2关）
    if (puzzle.type === 'identify_liberties') {
      const key = `${gx},${gy}`;
      const isTarget = puzzle.targetPoints.some(p => p.x === gx && p.y === gy);

      if (isTarget) {
        if (puzzleIdentifiedPoints.has(key)) {
          petSpeech.textContent = "这口气已经找出来标上小绿勾 ✓ 啦！快找找剩下的气吧~";
          return;
        }
        puzzleIdentifiedPoints.add(key);
        SoundEffects.playStone();
        drawBoard();

        // 检查是否全部找齐
        if (puzzleIdentifiedPoints.size === puzzle.targetPoints.length) {
          playPuzzleFollowUpAndComplete(puzzle);
        } else {
          const remain = puzzle.targetPoints.length - puzzleIdentifiedPoints.size;
          petSpeech.textContent = `找对啦！已找到 ${puzzleIdentifiedPoints.size} 口气，还有 ${remain} 口气，继续加油！`;
        }
      } else {
        SoundEffects.playGentleError();
        if (engine.board[gy][gx] !== EMPTY) {
          petSpeech.textContent = "这是棋子自己哦！【气】是跟棋子上下左右紧挨着的空交叉点，请点它身边的空位吧~";
        } else if (isDiagonalNeighborOfAnyStone(gx, gy)) {
          petSpeech.textContent = "注意哦！斜着的角没有横竖线直接相连，不算【气】！请点上下左右十字相连的交叉点~";
        } else {
          petSpeech.textContent = "唔~ 这个点不是它的气哦，仔细看跟它上下左右直接连着的十字线！";
        }
        if (VoiceNarrator.isEnabled()) {
          VoiceNarrator.speakError('liberty', petSpeech.textContent);
        }
      }
      return;
    }

    // 类型 A2: 识别禁着点（第6关）
    if (puzzle.type === 'identify_suicide') {
      const key = `${gx},${gy}`;
      const isTarget = puzzle.targetPoints.some(p => p.x === gx && p.y === gy);

      if (isTarget) {
        puzzleIdentifiedPoints.add(key);
        SoundEffects.playStone();
        drawBoard();

        if (puzzleIdentifiedPoints.size === puzzle.targetPoints.length) {
          playPuzzleFollowUpAndComplete(puzzle);
        }
      } else {
        SoundEffects.playGentleError();
        if (engine.board[gy][gx] !== EMPTY) {
          petSpeech.textContent = "这是白棋的棋子哦！请找一找被白棋四面围住、黑棋不能下的空交叉点（禁着点）~";
        } else {
          petSpeech.textContent = "这里黑棋落子后还有气，是可以安全下子的地方哦！请找一找被四颗白棋堵在正中间、0口气的【禁着点】吧~";
        }
        if (VoiceNarrator.isEnabled()) {
          VoiceNarrator.speak(petSpeech.textContent, false);
        }
      }
      return;
    }

    // 类型 A3: 识别假眼（第16关）
    if (puzzle.type === 'identify_false_eye') {
      const key = `${gx},${gy}`;
      const isTarget = puzzle.targetPoints.some(p => p.x === gx && p.y === gy);

      if (isTarget) {
        puzzleIdentifiedPoints.add(key);
        SoundEffects.playStone();
        drawBoard();

        if (puzzleIdentifiedPoints.size === puzzle.targetPoints.length) {
          playPuzzleFollowUpAndComplete(puzzle);
        }
      } else {
        SoundEffects.playGentleError();
        if (gx === 0 && gy === 0) {
          petSpeech.textContent = "这是真正的真眼哦！它的斜角有白棋紧紧保护着，对手永远破不掉。快找找看哪一只是缺少斜角保护的【假眼】吧！";
        } else if (engine.board[gy][gx] !== EMPTY) {
          petSpeech.textContent = "这是棋子自己哦！请找找看被白棋围在中间、但斜角被黑棋占领的【假眼】空位吧~";
        } else {
          petSpeech.textContent = "这里不是眼位哦！眼位是被白棋包围的空位，请找找看哪只眼是缺少斜角保护的【假眼】吧！";
        }
        if (VoiceNarrator.isEnabled()) {
          VoiceNarrator.speak(petSpeech.textContent, false);
        }
      }
      return;
    }

    // 类型 B: 实战落子（打吃、提子、逃跑、门吃、抱吃、两眼做活、扭羊头等）
    if (puzzle.type === 'play_move') {
      if (engine.board[gy][gx] !== EMPTY) {
        SoundEffects.playGentleError();
        petSpeech.textContent = "这里已经有棋子啦，请下在空的交叉点上哦！";
        return;
      }

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
          playPuzzleFollowUpAndComplete(puzzle);
        }
      } else {
        SoundEffects.playGentleError();
        const coordKey = `${gx},${gy}`;
        const customHint = puzzle.wrongMoveHints && puzzle.wrongMoveHints[coordKey];
        if (customHint) {
          petSpeech.textContent = customHint;
          if (VoiceNarrator.isEnabled()) {
            VoiceNarrator.speak(customHint, false);
          }
        } else {
          const test = engine.testMove(gx, gy, puzzle.playerColor);
          if (!test.valid) {
            petSpeech.textContent = `这里不能下哦：${test.reason}`;
          } else {
            petSpeech.textContent = "这一步没有达到最佳效果呢，可以点【📖 再看教学】复习一下技巧哦！";
          }
          if (VoiceNarrator.isEnabled()) {
            VoiceNarrator.speakError('goal', petSpeech.textContent);
          }
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

    // 仅将真正完成判题过关的关卡 ID 计入 passedPuzzles（修复未通关关卡提前带星标的 Bug）
    if (!userProgress.passedPuzzles.includes(puzzle.id)) {
      userProgress.passedPuzzles.push(puzzle.id);
    }
    const nextId = puzzle.id + 1;
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

  // 实战教学联动：一键跳转复习对应教学关卡与气泡富文本渲染
  let lastMoveWasPlayerTesuji = false;

  function jumpToLessonLevel(levelId) {
    const idx = PUZZLE_LEVELS.findIndex(p => p.id === levelId);
    if (idx !== -1) {
      currentPuzzleIndex = idx;
      tabAcademy.click();
    }
  }

  function renderSpeechWithLessonLink(text, levelId, tacticName, isPraise = false) {
    petSpeech.innerHTML = '';
    if (isPraise) {
      const badge = document.createElement('span');
      badge.className = 'tesuji-praise-badge';
      badge.textContent = '🌟 学以致用';
      petSpeech.appendChild(badge);
    }
    const textSpan = document.createElement('span');
    textSpan.textContent = isPraise
      ? text.replace(/^🌟\s*(学以致用！|妙手生花！|高手风范！|火眼金睛！|势如破竹！|威力无穷！|好险呀！)?/, '')
      : text;
    petSpeech.appendChild(textSpan);

    if (levelId) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hint-lesson-link';
      btn.textContent = `📖 复习第${levelId}关：${tacticName}`;
      btn.onclick = (e) => {
        e.stopPropagation();
        jumpToLessonLevel(levelId);
      };
      petSpeech.appendChild(btn);
    }
  }

  // 对弈模式玩家走子
  function handleMatchMove(gx, gy) {
    const playColor = BLACK; // 玩家始终执黑
    if (engine.turn !== playColor) return;

    const prevEngine = ai.cloneEngine(engine);
    const res = engine.play(gx, gy, playColor);
    if (!res.success) {
      SoundEffects.playGentleError();
      petSpeech.textContent = `这里不能下：${res.reason}`;
      return;
    }

    lastMoveWasPlayerTesuji = false;
    const playerTesuji = ai.analyzePlayerMove(prevEngine, engine, gx, gy, playColor, res.captures);

    if (playerTesuji) {
      lastMoveWasPlayerTesuji = true;
      if (res.captures.length > 0) {
        SoundEffects.playCapture();
      } else {
        SoundEffects.playSuccess();
      }
      renderSpeechWithLessonLink(playerTesuji.praiseText, playerTesuji.levelId, playerTesuji.name, true);
      if (VoiceNarrator.isEnabled()) {
        VoiceNarrator.speak(playerTesuji.praiseText.replace(/^🌟\s*/, ''));
      }
    } else if (res.captures.length > 0) {
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
    }, lastMoveWasPlayerTesuji ? 950 : 600);
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
        if (best.coachInfo && best.coachInfo.levelId >= 7) {
          renderSpeechWithLessonLink(
            `嘻嘻！我用【第${best.coachInfo.levelId}关：${best.coachInfo.name}】吃掉了你 ${res.captures.length} 颗棋子哦~`,
            best.coachInfo.levelId,
            best.coachInfo.name,
            false
          );
        } else {
          petSpeech.textContent = `嘻嘻！我吃掉了你 ${res.captures.length} 颗棋子哦~`;
        }
      } else {
        SoundEffects.playStone();
        // 检查玩家棋子是否被打吃
        const playerInAtari = engine.getAllGroups().filter(g => g.color === BLACK && g.libertyCount === 1);
        if (playerInAtari.length > 0) {
          SoundEffects.playAtari();
          if (best.coachInfo && best.coachInfo.levelId >= 7) {
            renderSpeechWithLessonLink(
              `小心哦！我使出了【第${best.coachInfo.levelId}关：${best.coachInfo.name}】，你的小黑棋危险啦！`,
              best.coachInfo.levelId,
              best.coachInfo.name,
              false
            );
          } else {
            petSpeech.textContent = "小心哦！你的小黑棋被打吃了，快看看能不能逃！";
          }
          if (VoiceNarrator.isEnabled()) {
            VoiceNarrator.speakMatchEvent('match_ai_atari', "小心哦！你的小黑棋被打吃了，快看看能不能逃！");
          }
        } else if (best.coachInfo && [9, 12, 13, 16, 17, 20].includes(best.coachInfo.levelId)) {
          renderSpeechWithLessonLink(
            `看招！我使出了课堂绝技【第${best.coachInfo.levelId}关：${best.coachInfo.name}】哦！`,
            best.coachInfo.levelId,
            best.coachInfo.name,
            false
          );
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
    updateTurnIndicator();
  }

  // 对弈回合指示：高亮当前行棋方阵营卡 + 棋盘上方大横幅
  function updateTurnIndicator() {
    const inMatch = currentMode === 'match';
    if (turnBanner) turnBanner.style.display = inMatch ? 'flex' : 'none';
    if (!inMatch) return;

    const rank = ai.getCurrentRank();
    if (opponentSideName) opponentSideName.textContent = `${rank.icon} ${rank.animal}（执白）`;

    const playerTurn = engine.turn === BLACK;
    if (playerSideBlack) playerSideBlack.classList.toggle('active', playerTurn);
    if (playerSideWhite) playerSideWhite.classList.toggle('active', !playerTurn);

    if (turnBanner) turnBanner.classList.toggle('opponent', !playerTurn);
    if (turnBannerStone) {
      turnBannerStone.classList.toggle('black', playerTurn);
      turnBannerStone.classList.toggle('white', !playerTurn);
    }
    if (turnBannerText) {
      turnBannerText.textContent = playerTurn
        ? '👉 轮到你啦！请下黑棋'
        : `${rank.icon} ${rank.animal}正在思考，下白棋…`;
    }
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

  // 隐藏试题标准答案面版与棋盘高亮
  function hidePuzzleAnswer() {
    showPuzzleAnswer = false;
    if (answerRevealBox) answerRevealBox.style.display = 'none';
    if (btnShowAnswerText) {
      btnShowAnswerText.textContent = '显示答案';
    }
  }

  // 生成当前关卡的标准答案文字与语音详解
  function getPuzzleAnswerDetails(puzzle) {
    if (!puzzle) return { html: '', speech: '' };
    const formatPt = (p) => `<strong>第${p.x + 1}列·第${p.y + 1}行</strong>`;

    if (puzzle.type === 'identify_liberties') {
      const pts = puzzle.targetPoints || [];
      const coordsHtml = pts.map((p, i) => `★${i + 1}(${formatPt(p)})`).join('、');
      return {
        html: `<strong>💡 标准答案（共 ${pts.length} 口气）：</strong>点击棋盘金星 ${coordsHtml}。`,
        speech: puzzle.answerSpeech || puzzle.successMsg
      };
    }

    if (puzzle.type === 'identify_suicide') {
      const pts = puzzle.targetPoints || [];
      const p = pts[0] || { x: 2, y: 2 };
      return {
        html: `<strong>💡 标准答案（禁着点）：</strong>点击白棋包围圈中心 <strong>★禁(${formatPt(p)})</strong>。`,
        speech: puzzle.answerSpeech || puzzle.successMsg
      };
    }

    if (puzzle.type === 'identify_false_eye') {
      const pts = puzzle.targetPoints || [];
      const p = pts[0] || { x: 3, y: 3 };
      return {
        html: `<strong>💡 标准答案（假眼位置）：</strong>点击缺少斜角保护的 <strong>★假眼(${formatPt(p)})</strong>。`,
        speech: puzzle.answerSpeech || puzzle.successMsg
      };
    }

    // play_move
    const moves = puzzle.validMoves || [];
    const coordsHtml = moves.map((p, i) => (moves.length > 1 ? `★${i + 1}(${formatPt(p)})` : `★正解(${formatPt(p)})`)).join(' 或 ');
    let seqNote = '';
    if (Array.isArray(puzzle.followUpSequence) && puzzle.followUpSequence.length > 0) {
      const seqStr = puzzle.followUpSequence
        .map((s, i) => `${i + 2}${s.color === BLACK ? '黑' : '白'}(${s.x + 1},${s.y + 1})`)
        .join(' → ');
      seqNote = ` <span style="color:#b45309;">（后续连招：${seqStr}）</span>`;
    }
    return {
      html: `<strong>💡 标准答案：</strong>落子于棋盘金星 ${coordsHtml}${seqNote}。`,
      speech: puzzle.answerSpeech || puzzle.successMsg
    };
  }

  // 同步更新熊猫导师卡片顶部胶囊状态
  function syncAcademyHeaderUI(puzzle) {
    if (!puzzle) return;
    if (petAvatar) petAvatar.textContent = '🐼';
    if (petName) petName.textContent = puzzle.title;
    if (petRank) petRank.textContent = puzzle.category;
    if (academyStepPills) academyStepPills.style.display = 'inline-flex';

    const steps = puzzle.teachingSteps || [];
    if (btnTabTeach1 && steps[0]) {
      btnTabTeach1.textContent = steps[0].shortLabel || '📖 图解1';
      btnTabTeach1.style.display = '';
    } else if (btnTabTeach1) {
      btnTabTeach1.style.display = 'none';
    }

    if (btnTabTeach2 && steps[1]) {
      btnTabTeach2.textContent = steps[1].shortLabel || '📖 图解2';
      btnTabTeach2.style.display = '';
    } else if (btnTabTeach2) {
      btnTabTeach2.style.display = 'none';
    }

    const isPractice = academySubMode === 'practice';
    if (petCard) {
      petCard.classList.toggle('mode-teach', !isPractice);
    }
    if (btnTabPractice) btnTabPractice.classList.toggle('active', isPractice);
    if (btnTabTeach1) btnTabTeach1.classList.toggle('active', !isPractice && currentTeachStepIndex === 0);
    if (btnTabTeach2) btnTabTeach2.classList.toggle('active', !isPractice && currentTeachStepIndex === 1);

    if (btnTeachText) {
      if (isPractice) {
        btnTeachText.textContent = '看原理图解';
      } else if (currentTeachStepIndex < steps.length - 1) {
        btnTeachText.textContent = '下一张图解';
      } else {
        btnTeachText.textContent = '返回去闯关';
      }
    }
  }

  // 切换显示/隐藏本题标准答案
  function togglePuzzleAnswer() {
    SoundEffects.playClick();
    if (currentMode !== 'academy') return;

    if (showPuzzleAnswer) {
      hidePuzzleAnswer();
      drawBoard();
      return;
    }

    // 如果当前在看图解，先切回练习盘面再标出正解
    if (academySubMode === 'teach') {
      startPracticePhase(true);
    }

    showPuzzleAnswer = true;
    const puzzle = PUZZLE_LEVELS[currentPuzzleIndex];
    const details = getPuzzleAnswerDetails(puzzle);

    if (answerRevealText) {
      answerRevealText.innerHTML = details.html;
    }
    if (answerRevealBox) {
      answerRevealBox.style.display = 'flex';
    }
    if (btnShowAnswerText) {
      btnShowAnswerText.textContent = '隐藏答案';
    }

    drawBoard();
    VoiceNarrator.speakAnswer(puzzle.id, details.speech, true);
  }

  // 一键在棋盘上自动走子演示本题标准答案
  function autoPlayPuzzleAnswer() {
    SoundEffects.playClick();
    if (currentMode !== 'academy') return;
    const puzzle = PUZZLE_LEVELS[currentPuzzleIndex];
    if (!puzzle) return;

    // 先重置到干净的练习棋盘，但保留答案面板展示
    startPracticePhase(true);
    showPuzzleAnswer = true;
    const details = getPuzzleAnswerDetails(puzzle);
    if (answerRevealText) answerRevealText.innerHTML = details.html;
    if (answerRevealBox) answerRevealBox.style.display = 'flex';
    if (btnShowAnswerText) {
      btnShowAnswerText.textContent = '隐藏答案';
    }
    drawBoard();

    if (puzzle.type === 'identify_liberties' || puzzle.type === 'identify_suicide' || puzzle.type === 'identify_false_eye') {
      const pts = puzzle.targetPoints || [];
      pts.forEach((pt, idx) => {
        const t = setTimeout(() => {
          if (currentMode !== 'academy') return;
          handlePuzzleMove(pt.x, pt.y);
        }, (idx + 1) * 480);
        followUpTimers.push(t);
      });
    } else if (puzzle.type === 'play_move') {
      const mv = (puzzle.validMoves && puzzle.validMoves[0]) || null;
      if (mv) {
        const t = setTimeout(() => {
          if (currentMode !== 'academy') return;
          handlePuzzleMove(mv.x, mv.y);
        }, 420);
        followUpTimers.push(t);
      }
    }
  }

  // 切换到指定【原理图解】步骤（使用预生成的微软 Neural 教学语音包 p{id}_t1 / p{id}_t2）
  function startTeachingPhase(stepIndex = 0) {
    clearAITimer();
    clearHint();
    clearFollowUpTimers();
    hidePuzzleAnswer();
    const puzzle = PUZZLE_LEVELS[currentPuzzleIndex];
    const steps = puzzle.teachingSteps || [];
    if (steps.length === 0) {
      startPracticePhase();
      return;
    }

    academySubMode = 'teach';
    currentTeachStepIndex = Math.max(0, Math.min(stepIndex, steps.length - 1));
    const step = steps[currentTeachStepIndex];
    puzzleIdentifiedPoints.clear();

    engine.loadBoard(step.board || puzzle.initialBoard, puzzle.playerColor);

    syncAcademyHeaderUI(puzzle);
    if (voiceBtnText && !VoiceNarrator.isSpeakingNow()) {
      voiceBtnText.textContent = '听图解讲解';
    }

    const nextHint = currentTeachStepIndex < steps.length - 1
      ? '（点棋盘看下一张图解，或点「🎯 动手闯关」直接下棋）'
      : '（点棋盘即可直接开始闯关！）';
    petSpeech.innerHTML = `<strong>${step.title}</strong><br>${step.text} <span style="color:#1e90ff;font-weight:700;">${nextHint}</span>`;

    renderLevelChips();
    resizeCanvas();

    VoiceNarrator.speakTeach(puzzle.id, currentTeachStepIndex, step.voice || step.text, true);
  }

  // 进入当前关卡的【动手闯关练习】阶段（零阻断，进关直接可落子）
  function startPracticePhase(suppressVoice = false) {
    clearAITimer();
    clearHint();
    clearFollowUpTimers();
    hidePuzzleAnswer();
    const puzzle = PUZZLE_LEVELS[currentPuzzleIndex];
    academySubMode = 'practice';
    puzzleIdentifiedPoints.clear();

    engine.loadBoard(puzzle.initialBoard, puzzle.playerColor);

    syncAcademyHeaderUI(puzzle);
    if (voiceBtnText && !VoiceNarrator.isSpeakingNow()) {
      voiceBtnText.textContent = '听师傅读题';
    }

    petSpeech.innerHTML = `<strong>🎯 闯关任务：</strong>${puzzle.tip}`;

    renderLevelChips();
    resizeCanvas();

    if (!suppressVoice) {
      VoiceNarrator.speakPuzzle(puzzle.id, puzzle.voiceTip || puzzle.tip, false);
    }
  }

  // 阶段切换：'beginner' (1~10关) 或 'intermediate' (11~20关)
  function switchStage(stage, targetIndex = null) {
    currentStage = stage;
    if (btnStageBeginner) btnStageBeginner.classList.toggle('active', currentStage === 'beginner');
    if (btnStageIntermediate) btnStageIntermediate.classList.toggle('active', currentStage === 'intermediate');

    if (targetIndex !== null) {
      loadPuzzle(targetIndex);
    } else {
      const minIdx = currentStage === 'beginner' ? 0 : 10;
      const maxIdx = currentStage === 'beginner' ? 9 : 19;
      if (currentPuzzleIndex < minIdx || currentPuzzleIndex > maxIdx) {
        loadPuzzle(minIdx);
      } else {
        renderLevelChips();
      }
    }
  }

  // 加载指定关卡（默认直接进入可交互的闯关棋盘，告别繁琐的强制翻页 PPT；随时可点上方“图解1/2”查看原理）
  function loadPuzzle(index, startInTeach = false) {
    clearAITimer();
    clearHint();
    clearFollowUpTimers();
    if (scoreBox) scoreBox.style.display = 'none';
    currentPuzzleIndex = index;

    // 自动同步所属阶段（初级 vs 中级）
    if (index >= 10 && currentStage !== 'intermediate') {
      currentStage = 'intermediate';
    } else if (index < 10 && currentStage !== 'beginner') {
      currentStage = 'beginner';
    }

    const puzzle = PUZZLE_LEVELS[index];
    if (startInTeach && puzzle.teachingSteps && puzzle.teachingSteps.length > 0) {
      startTeachingPhase(0);
    } else {
      startPracticePhase();
    }
  }

  // 渲染关卡选项卡（根据当前阶段展示 1~10 或 11~20 关，保持界面清爽，方便 iPad 触控）
  function renderLevelChips() {
    if (!levelChipsContainer) return;
    levelChipsContainer.innerHTML = '';
    let activeChipEl = null;

    if (btnStageBeginner) btnStageBeginner.classList.toggle('active', currentStage === 'beginner');
    if (btnStageIntermediate) btnStageIntermediate.classList.toggle('active', currentStage === 'intermediate');

    const startIdx = currentStage === 'beginner' ? 0 : 10;
    const endIdx = currentStage === 'beginner' ? 10 : 20;
    const stagePuzzles = PUZZLE_LEVELS.slice(startIdx, endIdx);

    stagePuzzles.forEach((p, offset) => {
      const idx = startIdx + offset;
      const chip = document.createElement('div');
      const isPassed = userProgress.passedPuzzles.includes(p.id);
      const isActive = idx === currentPuzzleIndex;
      chip.className = `level-chip ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''}`;
      chip.textContent = `${p.id}. ${p.category}`;
      chip.onclick = () => {
        SoundEffects.playClick();
        loadPuzzle(idx);
      };
      if (isActive) activeChipEl = chip;
      levelChipsContainer.appendChild(chip);
    });
    if (activeChipEl && typeof activeChipEl.scrollIntoView === 'function') {
      requestAnimationFrame(() => {
        activeChipEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
    }
  }

  // 渲染荣誉徽章（20关对应20枚专属荣誉勋章）
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
      { name: "追击神将", icon: "🐏", desc: "完成扭羊头征子" },
      { name: "双响炮神", icon: "💣", desc: "掌握双打吃手筋" },
      { name: "天罗地网", icon: "🕸️", desc: "掌握飞枷吃子" },
      { name: "以退为进", icon: "🪃", desc: "掌握倒扑舍子妙手" },
      { name: "断路斩将", icon: "⚔️", desc: "掌握接不归战法" },
      { name: "劈山神斧", icon: "🪓", desc: "掌握挖与夹手筋" },
      { name: "明察秋毫", icon: "🧐", desc: "准确识别真眼与假眼" },
      { name: "一击必杀", icon: "🎯", desc: "掌握破眼杀棋急所" },
      { name: "包子大厨", icon: "🥟", desc: "掌握滚打包收战法" },
      { name: "和平使者", icon: "🕊️", desc: "领悟双活共生之道" },
      { name: "金鸡至尊", icon: "👑", desc: "掌握金鸡独立绝技" }
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
    clearFollowUpTimers();
    const size = parseInt(selectBoardSize.value, 10);
    engine.reset(size);
    isAITurn = false;
    updateScoreDisplay();
    updatePetCard();
    const r = ai.getCurrentRank();
    petSpeech.textContent = `新对局开始！你执 ⚫黑棋 先下，我（${r.animal}）执 ⚪白棋，加油哦！`;
    resizeCanvas();
  }

  function initMatchView() {
    clearAITimer();
    clearHint();
    clearFollowUpTimers();
    hidePuzzleAnswer();
    currentMode = 'match';
    if (petCard) petCard.classList.remove('mode-teach');
    if (academyStepPills) academyStepPills.style.display = 'none';
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
    clearFollowUpTimers();
    tabAcademy.classList.add('active');
    tabMatch.classList.remove('active');
    tabBadges.classList.remove('active');
    viewAcademy.classList.add('active');
    viewBadges.classList.remove('active');
    gameLayout.style.display = '';
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
    clearFollowUpTimers();
    tabMatch.classList.add('active');
    tabAcademy.classList.remove('active');
    tabBadges.classList.remove('active');
    viewAcademy.classList.remove('active');
    viewBadges.classList.remove('active');
    gameLayout.style.display = '';
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
    clearFollowUpTimers();
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

  // 熊猫导师锦囊妙计 (Hint) —— 结合 20 关教学棋理讲解为什么下这里
  btnHint.onclick = () => {
    SoundEffects.playClick();
    const legal = engine.getLegalMoves(BLACK);
    if (legal.length > 0) {
      const hint = ai.getCoachingHint(engine, BLACK, isCaptureGameMode);
      if (hint) {
        clearHint();
        hintCoord = { gx: hint.x, gy: hint.y };
        drawBoard();
        renderSpeechWithLessonLink(hint.coachText, hint.levelId, hint.tacticName, false);
        hintTimer = setTimeout(() => {
          clearHint();
          drawBoard();
        }, 5000);
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

  // 导师卡片右上角【🎯 动手闯关 / 📖 图解1 / 📖 图解2】分段胶囊与右侧【看原理图解】大按钮绑定
  if (btnTabPractice) {
    btnTabPractice.onclick = () => {
      SoundEffects.playClick();
      startPracticePhase();
    };
  }

  if (btnTabTeach1) {
    btnTabTeach1.onclick = () => {
      SoundEffects.playClick();
      startTeachingPhase(0);
    };
  }

  if (btnTabTeach2) {
    btnTabTeach2.onclick = () => {
      SoundEffects.playClick();
      startTeachingPhase(1);
    };
  }

  if (btnReplayTeach) {
    btnReplayTeach.onclick = () => {
      SoundEffects.playClick();
      const puzzle = PUZZLE_LEVELS[currentPuzzleIndex];
      const steps = puzzle.teachingSteps || [];
      if (academySubMode === 'practice') {
        startTeachingPhase(0);
      } else if (currentTeachStepIndex < steps.length - 1) {
        startTeachingPhase(currentTeachStepIndex + 1);
      } else {
        startPracticePhase();
      }
    };
  }

  // 阶段切换按钮（启蒙初级 vs 进阶中级）
  if (btnStageBeginner) {
    btnStageBeginner.onclick = () => {
      SoundEffects.playClick();
      switchStage('beginner');
    };
  }

  if (btnStageIntermediate) {
    btnStageIntermediate.onclick = () => {
      SoundEffects.playClick();
      switchStage('intermediate');
    };
  }

  // 显示/隐藏本题标准答案按钮
  if (btnShowAnswer) {
    btnShowAnswer.onclick = () => {
      togglePuzzleAnswer();
    };
  }

  if (btnAutoPlayAnswer) {
    btnAutoPlayAnswer.onclick = () => {
      autoPlayPuzzleAnswer();
    };
  }

  // 闯关重置本题（重置当前练习盘面）
  btnResetPuzzle.onclick = () => {
    SoundEffects.playClick();
    startPracticePhase();
  };

  // 闯关下一题
  btnNextPuzzle.onclick = () => {
    SoundEffects.playClick();
    if (currentPuzzleIndex < PUZZLE_LEVELS.length - 1) {
      loadPuzzle(currentPuzzleIndex + 1);
    }
  };

  // 播报当前状态的微软 Neural 语音（根据当前处于答案解析、图解步骤或闯关读题自动匹配预置高清音频）
  function speakCurrentAcademyState(isManual = true) {
    const puzzle = PUZZLE_LEVELS[currentPuzzleIndex];
    if (!puzzle) return;
    if (showPuzzleAnswer) {
      VoiceNarrator.speakAnswer(puzzle.id, puzzle.answerSpeech || puzzle.successMsg, isManual);
    } else if (academySubMode === 'teach' && puzzle.teachingSteps && puzzle.teachingSteps[currentTeachStepIndex]) {
      const step = puzzle.teachingSteps[currentTeachStepIndex];
      VoiceNarrator.speakTeach(puzzle.id, currentTeachStepIndex, step.voice || step.text, isManual);
    } else {
      VoiceNarrator.speakPuzzle(puzzle.id, puzzle.voiceTip || puzzle.tip, isManual);
    }
  }

  // 听师傅讲课/读题按钮 (专门为不识字的小朋友设计，手动点击始终朗读，不被自动朗读开关屏蔽)
  if (btnSpeakInstruction) {
    btnSpeakInstruction.onclick = () => {
      SoundEffects.playClick();
      speakCurrentAcademyState(true);
    };
  }

  // 配音角色音色切换（立即用新音色试听当前教学图解、答案或关卡题目）
  if (selectVoicePack) {
    selectVoicePack.onchange = (e) => {
      SoundEffects.playClick();
      VoiceNarrator.setVoicePack(e.target.value);
      speakCurrentAcademyState(true);
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
    const target = e.target;
    const clickedVoiceControl =
      target &&
      (target.closest('#btnSpeakInstruction') ||
       target.closest('#selectVoicePack') ||
       target.closest('#toggleVoice'));
    if (!clickedVoiceControl && currentMode === 'academy' && VoiceNarrator.isEnabled() && !VoiceNarrator.isSpeakingNow()) {
      speakCurrentAcademyState(false);
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
