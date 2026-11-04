const { GoEngine, BLACK, WHITE } = require('./js/go-engine.js');
const { PUZZLE_LEVELS } = require('./js/puzzles.js');
const { GoAI, RANKS } = require('./js/ai.js');

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
console.log('====================================================');
console.log('🎉 自动化测试通过，符合 AGENTS.md 准则！');
console.log('====================================================');
