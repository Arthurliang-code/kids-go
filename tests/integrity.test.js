const { GoEngine, BLACK, WHITE } = require('../js/go-engine.js');
const { PUZZLE_LEVELS } = require('../js/puzzles.js');
const { GoAI, RANKS } = require('../js/ai.js');

console.log('====================================================');
console.log('🚀 执行 AGENTS.md 规范：全量自动化闭环测试');
console.log('====================================================');

// 1. 题库完整性测试 (30关)
console.log('\n[TEST 1] 题库数据结构与规则引擎闭环验证 (30关)...');
if (PUZZLE_LEVELS.length !== 30) {
  throw new Error(`预期 30 关，实际得到 ${PUZZLE_LEVELS.length} 关！`);
}

const engine = new GoEngine(9);

PUZZLE_LEVELS.forEach((p, idx) => {
  const levelNum = idx + 1;
  if (p.id !== levelNum) {
    throw new Error(`关卡 ID 序号不连续：索引 ${idx} 处 id 为 ${p.id}，应为 ${levelNum}`);
  }
  if (!p.title || !p.badge || !p.category || !p.tip || !p.explain) {
    throw new Error(`第 ${p.id} 关缺少基础字段！`);
  }
  if (![5, 7, 9].includes(p.boardSize)) {
    throw new Error(`第 ${p.id} 关棋盘尺寸非法：${p.boardSize}`);
  }
  if (!p.initialBoard || p.initialBoard.length !== p.boardSize) {
    throw new Error(`第 ${p.id} 关棋盘高度不等于 boardSize: ${p.boardSize}`);
  }
  for (let r = 0; r < p.boardSize; r++) {
    if (p.initialBoard[r].length !== p.boardSize) {
      throw new Error(`第 ${p.id} 关第 ${r} 行宽度不匹配！`);
    }
  }

  // 教学步骤检查
  if (!p.teachingSteps || p.teachingSteps.length < 2) {
    throw new Error(`第 ${p.id} 关教学步骤不足 2 步！`);
  }
  p.teachingSteps.forEach((st, sIdx) => {
    if (!st.title || !st.text) {
      throw new Error(`第 ${p.id} 关图解步骤 ${sIdx} 缺少 title 或 text`);
    }
    if (st.board && st.board.length !== p.boardSize) {
      throw new Error(`第 ${p.id} 关图解步骤 ${sIdx} board 尺寸不符！`);
    }
    if (st.markers) {
      st.markers.forEach(m => {
        if (m.x < 0 || m.x >= p.boardSize || m.y < 0 || m.y >= p.boardSize) {
          throw new Error(`第 ${p.id} 关图解步骤 ${sIdx} marker 坐标越界: (${m.x}, ${m.y})`);
        }
      });
    }
  });

  // 正解落子验证
  engine.loadBoard(p.initialBoard, p.playerColor || BLACK);
  if (p.type === 'play_move') {
    if (!p.validMoves || p.validMoves.length === 0) {
      throw new Error(`第 ${p.id} 关为 play_move 但缺少 validMoves！`);
    }
    p.validMoves.forEach(vm => {
      if (p.initialBoard[vm.y][vm.x] !== 0) {
        throw new Error(`第 ${p.id} 关正解坐标 (${vm.x}, ${vm.y}) 在 initialBoard 上非空！`);
      }
      const testRes = engine.testMove(vm.x, vm.y, p.playerColor || BLACK);
      if (!testRes.valid) {
        throw new Error(`第 ${p.id} 关正解落子 (${vm.x}, ${vm.y}) 不符合围棋规则：${testRes.reason}`);
      }
    });
  } else if (p.type === 'identify_liberties' || p.type === 'identify_false_eye' || p.type === 'identify_suicide') {
    if (!p.targetPoints || p.targetPoints.length === 0) {
      throw new Error(`第 ${p.id} 关为点击识别题，但缺少 targetPoints！`);
    }
    p.targetPoints.forEach(pt => {
      if (pt.x < 0 || pt.x >= p.boardSize || pt.y < 0 || pt.y >= p.boardSize) {
        throw new Error(`第 ${p.id} 关 targetPoint 越界：(${pt.x}, ${pt.y})`);
      }
    });
  }
});

console.log('✅ 30 关全部通过尺寸、字段、图解与规则引擎合法性校验！');

// 2. AI 战术引擎与对弈模拟验证
console.log('\n[TEST 2] AI 战术引擎与对弈模拟验证...');
const ai = new GoAI();
RANKS.forEach((rk, rIdx) => {
  ai.setRankIndex(rIdx);
  const testEngine = new GoEngine(9);
  let moves = 0;
  let currentColor = BLACK;
  while (moves < 30) {
    const bestMove = ai.getBestMove(testEngine, currentColor, true);
    if (!bestMove) break;
    const res = testEngine.play(bestMove.x, bestMove.y, currentColor);
    if (!res.success) {
      throw new Error(`AI 在段位 ${rk.name} 走出非法落子：(${bestMove.x}, ${bestMove.y})`);
    }
    currentColor = currentColor === BLACK ? WHITE : BLACK;
    moves++;
  }
  console.log(`  - 段位 [${rk.name}] 模拟走子 ${moves} 手成功，无死循环或非法走子`);
});

console.log('✅ AI 对弈引擎全部段位模拟测试通过！');

console.log('\n[TEST 2b] GoAI 战术引擎手筋识别器准确率检定 (AGENTS.md 规范 3)...');
const tesujiTests = [
  { name: '双打吃', levelId: 11, check: (eng, x, y, c) => !!ai.detectDoubleAtari(eng, x, y, c) },
  { name: '门吃', levelId: 7, check: (eng, x, y, c) => {
    const gh = ai.detectGateOrHugCapture(eng, x, y, c);
    return gh && gh.name === '门吃';
  }},
  { name: '抱吃', levelId: 8, check: (eng, x, y, c) => {
    const gh = ai.detectGateOrHugCapture(eng, x, y, c);
    return gh && gh.name === '抱吃';
  }},
  { name: '扭羊头征子', levelId: 10, check: (eng, x, y, c) => !!ai.detectLadderAttack(eng, x, y, c) },
  { name: '飞枷', levelId: 12, check: (eng, x, y, c) => !!ai.detectNetCapture(eng, x, y, c) },
  { name: '倒扑', levelId: 13, check: (eng, x, y, c) => !!ai.detectSnapback(eng, x, y, c) },
  { name: '挖与夹', levelId: 15, check: (eng, x, y, c) => !!ai.detectWedgeAndCut(eng, x, y, c) },
  { name: '两眼做活', levelId: 9, check: (eng, x, y, c) => {
    const ev = ai.detectEyeVitalPoint(eng, x, y, c);
    return ev && ev.type === 'make_two_eyes';
  }},
  { name: '点眼杀棋', levelId: 17, check: (eng, x, y, c) => {
    const ev = ai.detectEyeVitalPoint(eng, x, y, c);
    return ev && ev.type === 'destroy_eye';
  }},
  { name: '金鸡独立', levelId: 20, check: (eng, x, y, c) => !!ai.detectGoldenRooster(eng, x, y, c) },
  { name: '实战学以致用识别 (analyzePlayerMove)', levelId: 20, check: (eng, x, y, c) => {
    const afterEng = new GoEngine(eng.size);
    afterEng.loadBoard(eng.board, c);
    const res = afterEng.play(x, y, c);
    const mv = ai.analyzePlayerMove(eng, afterEng, x, y, c, res.captures);
    return mv && mv.name === '金鸡独立';
  }}
];

let passCount = 0;
tesujiTests.forEach(tc => {
  const p = PUZZLE_LEVELS.find(lvl => lvl.id === tc.levelId);
  if (!p || !p.validMoves || !p.validMoves[0]) {
    throw new Error(`手筋测试关卡 ${tc.levelId} 未找到有效正解坐标`);
  }
  const eng = new GoEngine(p.boardSize);
  eng.loadBoard(p.initialBoard, p.playerColor);
  const vm = p.validMoves[0];
  const passed = tc.check(eng, vm.x, vm.y, p.playerColor);
  if (!passed) {
    throw new Error(`手筋探测器 [${tc.name}] 识别未命中！`);
  }
  passCount++;
});
console.log(`✅ ${passCount}/${tesujiTests.length} 项核心手筋探测器识别准确率 100% 通过！`);

// 3. 语音 TTS 资产与离线映射闭环验证
console.log('\n[TEST 3] 语音 TTS 资产与离线映射校验 (AGENTS.md 规范 4)...');
const fs = require('fs');
const path = require('path');

const voices = ['xiaoxiao', 'xiaoyi', 'yunxia', 'yunxi'];
const clipTypes = ['intro', 't1', 't2', 'ans', 'win'];
let missingClips = 0;

for (let id = 1; id <= 30; id++) {
  clipTypes.forEach(type => {
    const filename = `p${id}_${type}.mp3`;
    voices.forEach(v => {
      const pth = path.join(__dirname, '..', 'assets', 'audio', v, filename);
      if (!fs.existsSync(pth)) {
        console.error(`❌ 缺失语音资产: ${v}/${filename}`);
        missingClips++;
      }
    });
  });
}

if (missingClips > 0) {
  throw new Error(`共发现 ${missingClips} 个缺失的关卡 TTS 语音文件！`);
}

// 检查 sw.js 包含 p30 语音
const swContent = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf-8');
if (!swContent.includes('p30_win')) {
  throw new Error('sw.js 缓存清单未包含 p30_win！');
}

// 检查 voice.js 不包含未实现的 /api/tts 接口调用
const voiceContent = fs.readFileSync(path.join(__dirname, '..', 'js', 'voice.js'), 'utf-8');
if (/['"`]\/api\/tts/.test(voiceContent)) {
  throw new Error('js/voice.js 存在未实现的 /api/tts 调用！');
}

console.log('✅ 全部 30 关 4 套音色（共 600 个教学语音 MP3）及离线缓存清单校验通过！');
console.log('====================================================');
console.log('🎉 自动化测试通过，符合 AGENTS.md 准则！');
console.log('====================================================');
