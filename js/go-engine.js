// go-engine.js - 围棋核心规则引擎（气、吃子、禁着点、打劫、地盘计算、悔棋）

const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

class GoEngine {
  constructor(size = 9) {
    this.size = size;
    this.board = Array(size).fill(0).map(() => Array(size).fill(EMPTY));
    this.turn = BLACK; // 黑先走
    this.history = []; // 走子历史记录
    this.capturedStones = { [BLACK]: 0, [WHITE]: 0 }; // 双方被提子总数
    this.koPoint = null; // 打劫禁着点
    this.lastMove = null;
  }

  // 重置棋盘
  reset(size = this.size) {
    this.size = size;
    this.board = Array(size).fill(0).map(() => Array(size).fill(EMPTY));
    this.turn = BLACK;
    this.history = [];
    this.capturedStones = { [BLACK]: 0, [WHITE]: 0 };
    this.koPoint = null;
    this.lastMove = null;
  }

  // 坐标合法性
  inBounds(x, y) {
    return x >= 0 && x < this.size && y >= 0 && y < this.size;
  }

  // 四邻接点
  getNeighbors(x, y) {
    const list = [];
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.inBounds(nx, ny)) {
        list.push({ x: nx, y: ny });
      }
    }
    return list;
  }

  // 获取一个棋子所属的整块棋（串）及其全部气
  getGroup(startX, startY) {
    const color = this.board[startY][startX];
    if (color === EMPTY) return null;

    const visited = Array(this.size).fill(0).map(() => Array(this.size).fill(false));
    const stones = [];
    const liberties = new Set();
    const queue = [{ x: startX, y: startY }];
    visited[startY][startX] = true;

    while (queue.length > 0) {
      const { x, y } = queue.shift();
      stones.push({ x, y });

      for (const n of this.getNeighbors(x, y)) {
        const nColor = this.board[n.y][n.x];
        if (nColor === EMPTY) {
          liberties.add(`${n.x},${n.y}`);
        } else if (nColor === color && !visited[n.y][n.x]) {
          visited[n.y][n.x] = true;
          queue.push({ x: n.x, y: n.y });
        }
      }
    }

    return {
      color,
      stones,
      liberties: Array.from(liberties).map(str => {
        const [lx, ly] = str.split(',').map(Number);
        return { x: lx, y: ly };
      }),
      libertyCount: liberties.size
    };
  }

  // 获取棋盘上所有连通块的信息（用于儿童辅助气数显示）
  getAllGroups() {
    const visited = Array(this.size).fill(0).map(() => Array(this.size).fill(false));
    const groups = [];

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.board[y][x] !== EMPTY && !visited[y][x]) {
          const group = this.getGroup(x, y);
          for (const s of group.stones) {
            visited[s.y][s.x] = true;
          }
          groups.push(group);
        }
      }
    }
    return groups;
  }

  // 模拟落子并返回合法性与吃子结果
  testMove(x, y, color = this.turn) {
    if (!this.inBounds(x, y)) return { valid: false, reason: '超出棋盘边界' };
    if (this.board[y][x] !== EMPTY) return { valid: false, reason: '该位置已有棋子' };

    // 打劫检测
    if (this.koPoint && this.koPoint.x === x && this.koPoint.y === y) {
      return { valid: false, reason: '打劫禁着点，需找劫材隔一手再提' };
    }

    const opponent = color === BLACK ? WHITE : BLACK;
    // 假设落子
    this.board[y][x] = color;

    // 检查并收集被提的对方棋子
    const capturedStones = [];
    const checkedOpponents = new Set();

    for (const n of this.getNeighbors(x, y)) {
      if (this.board[n.y][n.x] === opponent) {
        const key = `${n.x},${n.y}`;
        if (!checkedOpponents.has(key)) {
          const oppGroup = this.getGroup(n.x, n.y);
          oppGroup.stones.forEach(s => checkedOpponents.add(`${s.x},${s.y}`));
          if (oppGroup.libertyCount === 0) {
            capturedStones.push(...oppGroup.stones);
          }
        }
      }
    }

    // 检查自身是否有气（自杀检测）
    let isSuicide = false;
    if (capturedStones.length === 0) {
      const selfGroup = this.getGroup(x, y);
      if (selfGroup.libertyCount === 0) {
        isSuicide = true;
      }
    }

    // 恢复棋盘
    this.board[y][x] = EMPTY;

    if (isSuicide) {
      return { valid: false, reason: '禁着点（没有气，也不能提对方棋子）' };
    }

    return {
      valid: true,
      capturedStones
    };
  }

  // 正式落子
  play(x, y, color = this.turn) {
    const test = this.testMove(x, y, color);
    if (!test.valid) {
      return { success: false, reason: test.reason };
    }

    const opponent = color === BLACK ? WHITE : BLACK;
    // 记录历史（便于悔棋）
    this.history.push({
      board: this.board.map(row => [...row]),
      turn: this.turn,
      capturedStones: { ...this.capturedStones },
      koPoint: this.koPoint ? { ...this.koPoint } : null,
      lastMove: this.lastMove ? { ...this.lastMove } : null
    });

    // 真正落子
    this.board[y][x] = color;

    // 执行提子
    for (const s of test.capturedStones) {
      this.board[s.y][s.x] = EMPTY;
    }
    this.capturedStones[opponent] += test.capturedStones.length;

    // 更新劫争判断 (单个子被提且自身只有一口气)
    let newKoPoint = null;
    if (test.capturedStones.length === 1) {
      const selfGroup = this.getGroup(x, y);
      if (selfGroup.stones.length === 1 && selfGroup.libertyCount === 1) {
        newKoPoint = { x: test.capturedStones[0].x, y: test.capturedStones[0].y };
      }
    }
    this.koPoint = newKoPoint;
    this.lastMove = { x, y, color };

    // 换边
    this.turn = opponent;

    return {
      success: true,
      captures: test.capturedStones,
      lastMove: this.lastMove
    };
  }

  // 悔棋
  undo() {
    if (this.history.length === 0) return false;
    const prev = this.history.pop();
    this.board = prev.board;
    this.turn = prev.turn;
    this.capturedStones = prev.capturedStones;
    this.koPoint = prev.koPoint;
    this.lastMove = prev.lastMove;
    return true;
  }

  // 虚手（Pass）
  pass() {
    this.history.push({
      board: this.board.map(row => [...row]),
      turn: this.turn,
      capturedStones: { ...this.capturedStones },
      koPoint: this.koPoint ? { ...this.koPoint } : null,
      lastMove: this.lastMove ? { ...this.lastMove } : null
    });
    this.koPoint = null;
    this.lastMove = { pass: true, color: this.turn };
    this.turn = this.turn === BLACK ? WHITE : BLACK;
    return true;
  }

  // 获取所有合法落子点
  getLegalMoves(color = this.turn) {
    const legal = [];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.board[y][x] === EMPTY) {
          const test = this.testMove(x, y, color);
          if (test.valid) {
            legal.push({ x, y, captures: test.capturedStones.length });
          }
        }
      }
    }
    return legal;
  }

  // 简易地盘与形势估算（洪水填充法）
  estimateTerritory() {
    const visited = Array(this.size).fill(0).map(() => Array(this.size).fill(false));
    let blackTerritory = 0;
    let whiteTerritory = 0;
    let blackStones = 0;
    let whiteStones = 0;
    const territoryMap = Array(this.size).fill(0).map(() => Array(this.size).fill(EMPTY));

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.board[y][x] === BLACK) blackStones++;
        if (this.board[y][x] === WHITE) whiteStones++;

        if (this.board[y][x] === EMPTY && !visited[y][x]) {
          const emptyRegion = [];
          const queue = [{ x, y }];
          visited[y][x] = true;
          let touchesBlack = false;
          let touchesWhite = false;

          while (queue.length > 0) {
            const cur = queue.shift();
            emptyRegion.push(cur);
            for (const n of this.getNeighbors(cur.x, cur.y)) {
              const nc = this.board[n.y][n.x];
              if (nc === BLACK) touchesBlack = true;
              else if (nc === WHITE) touchesWhite = true;
              else if (nc === EMPTY && !visited[n.y][n.x]) {
                visited[n.y][n.x] = true;
                queue.push(n);
              }
            }
          }

          if (touchesBlack && !touchesWhite) {
            blackTerritory += emptyRegion.length;
            emptyRegion.forEach(pt => { territoryMap[pt.y][pt.x] = BLACK; });
          } else if (touchesWhite && !touchesBlack) {
            whiteTerritory += emptyRegion.length;
            emptyRegion.forEach(pt => { territoryMap[pt.y][pt.x] = WHITE; });
          }
        }
      }
    }

    return {
      blackStones,
      whiteStones,
      blackTerritory,
      whiteTerritory,
      blackScore: blackStones + blackTerritory,
      whiteScore: whiteStones + whiteTerritory,
      territoryMap
    };
  }

  // 实时全盘势力与地盘雷达图（Influence Map）
  // 结合落子辐射场强与确定性围空，返回每个格点的势力倾向值 (-1.0 ~ +1.0)
  calculateInfluenceMap(board = this.board, size = this.size) {
    const influence = Array(size).fill(0).map(() => Array(size).fill(0));
    const territoryData = this.estimateTerritory();

    // 1. 各棋子根据距离向周围网格辐射势力
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const color = board[y][x];
        if (color === EMPTY) continue;
        const sign = color === BLACK ? 1 : -1;

        // 本身占据点赋予高强度
        influence[y][x] += sign * 1.5;

        // 向辐射半径 3.2 范围扩散
        for (let py = 0; py < size; py++) {
          for (let px = 0; px < size; px++) {
            if (px === x && py === y) continue;
            const dist = Math.hypot(x - px, y - py);
            if (dist > 3.2) continue;
            const weight = 1 / (1 + dist * 1.35);
            influence[py][px] += sign * weight;
          }
        }
      }
    }

    // 2. 结合确定实空 (Territory) 与归一化
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (territoryData.territoryMap[y][x] === BLACK) {
          influence[y][x] = Math.max(influence[y][x], 1.2);
        } else if (territoryData.territoryMap[y][x] === WHITE) {
          influence[y][x] = Math.min(influence[y][x], -1.2);
        }
        // 双曲正切平滑归一化到 [-1, 1]
        influence[y][x] = Math.tanh(influence[y][x]);
      }
    }

    return {
      influence,
      territoryData
    };
  }

  // 静态工具方法：快速计算指定盘面的势力与地盘
  static calculateInfluence(board, size) {
    const tempEng = new GoEngine(size);
    tempEng.loadBoard(board);
    return tempEng.calculateInfluenceMap(board, size);
  }

  // 导出/导入盘面状态（用于题库初始化）
  loadBoard(matrix, turn = BLACK) {
    this.reset(matrix.length);
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        this.board[y][x] = matrix[y][x];
      }
    }
    this.turn = turn;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GoEngine, EMPTY, BLACK, WHITE };
}
