// ai.js - 少儿自适应围棋对弈 AI 引擎（涵盖5级卡通对手、启发式估值、动态难度升降级）

const RANKS = [
  {
    level: 1,
    name: "18K 萌新小兔",
    animal: "小兔",
    icon: "🐰",
    title: "吃子棋学徒",
    desc: "刚刚学会下棋的小白兔，偶尔会走神把棋子送到你嘴边哦！",
    quotes: ["你好呀！我们来比比谁先吃到萝卜吧！", "哎呀，这颗棋子怎么跑这儿来啦~", "你真厉害，小兔要加油啦！"],
    tactics: { captureChance: 0.5, escapeChance: 0.4, randomness: 0.7, searchDepth: 1 }
  },
  {
    level: 2,
    name: "14K 机智小狐",
    animal: "小狐狸",
    icon: "🦊",
    title: "机灵探索者",
    desc: "聪明的小狐狸，已经学会保护自己的气，还会趁机咬一口！",
    quotes: ["嘻嘻，我可不会轻易让你吃到棋子！", "小心哦，小狐狸的眼睛很尖的！", "这步棋有两下子嘛！"],
    tactics: { captureChance: 0.75, escapeChance: 0.7, randomness: 0.45, searchDepth: 1 }
  },
  {
    level: 3,
    name: "10K 沉着小鹿",
    animal: "小鹿",
    icon: "🦌",
    title: "森林围地家",
    desc: "懂得占角占边、连接自己棋子的稳重高手。",
    quotes: ["金角银边，我们一步一步稳扎稳打！", "互相连起来，棋子才更有力量。", "你的棋风很沉稳呢！"],
    tactics: { captureChance: 0.9, escapeChance: 0.85, randomness: 0.25, searchDepth: 2 }
  },
  {
    level: 4,
    name: "5K 威武大象",
    animal: "大象",
    icon: "🐘",
    title: "破阵大将军",
    desc: "擅长分断攻击和做活两只眼，力量惊人！",
    quotes: ["大象漫步，稳如泰山！看我这一手！", "注意你的薄弱点哦！", "精彩的交锋，佩服佩服！"],
    tactics: { captureChance: 0.98, escapeChance: 0.95, randomness: 0.1, searchDepth: 2 }
  },
  {
    level: 5,
    name: "1D 神算熊猫",
    animal: "熊猫师傅",
    icon: "🐼",
    title: "棋圣大宗师",
    desc: "精通算路与死活大局观的国宝级师傅！",
    quotes: ["静下心来，棋盘上有大千世界。", "神之一手，妙趣横生！", "后生可畏，未来可期！"],
    tactics: { captureChance: 1.0, escapeChance: 1.0, randomness: 0.02, searchDepth: 3 }
  }
];

class GoAI {
  constructor() {
    this.currentRankIndex = 0; // 默认 18K 小兔
    this.consecutiveLosses = 0; // 记录小朋友连败局数（用于自适应温柔放水）
    this.consecutiveWins = 0;  // 记录连胜局数（用于自适应晋升提示）
  }

  getCurrentRank() {
    return RANKS[this.currentRankIndex];
  }

  setRankIndex(index) {
    if (index >= 0 && index < RANKS.length) {
      this.currentRankIndex = index;
    }
  }

  // 胜负记录与自适应升降难度
  recordGameResult(playerWon) {
    if (playerWon) {
      this.consecutiveWins++;
      this.consecutiveLosses = 0;
      // 赢了 2 盘且不是最高段位，建议晋级
      if (this.consecutiveWins >= 2 && this.currentRankIndex < RANKS.length - 1) {
        this.currentRankIndex++;
        this.consecutiveWins = 0;
        return { promoted: true, newRank: this.getCurrentRank() };
      }
    } else {
      this.consecutiveLosses++;
      this.consecutiveWins = 0;
      // 如果连败 2 盘，微调放水以保护孩子积极性
      if (this.consecutiveLosses >= 2 && this.currentRankIndex > 0) {
        this.currentRankIndex--;
        this.consecutiveLosses = 0;
        return { demoted: true, newRank: this.getCurrentRank() };
      }
    }
    return { promoted: false, demoted: false, currentRank: this.getCurrentRank() };
  }

  // AI 决策计算落子点
  getBestMove(engine, color = WHITE, isCaptureMode = false) {
    const rank = this.getCurrentRank();
    const legalMoves = engine.getLegalMoves(color);
    if (legalMoves.length === 0) {
      return null; // 无合法落子，Pass
    }

    const opponent = color === BLACK ? WHITE : BLACK;
    const isGentleMode = this.consecutiveLosses >= 1; // 孩子刚输过一局，AI温柔一点

    // 1. 检查能否立即吃对方棋子（打吃提子）
    const captureMoves = legalMoves.filter(m => m.captures > 0);

    // 围地数子模式下：如果玩家刚刚选择虚手（Pass），且盘面已无提子机会，AI 随之 Pass 终局结算
    if (!isCaptureMode && engine.lastMove && engine.lastMove.pass) {
      if (captureMoves.length === 0) {
        return null; // 双方连续虚手，进入点目结算
      }
    }

    if (captureMoves.length > 0) {
      const takeChance = isGentleMode ? rank.tactics.captureChance * 0.7 : rank.tactics.captureChance;
      if (Math.random() < takeChance) {
        // 优先吃子最多的那步
        captureMoves.sort((a, b) => b.captures - a.captures);
        return captureMoves[0];
      }
    }

    // 2. 检查自身是否有危在旦夕的棋子（只剩1口气的群组）需要逃跑
    const endangeredGroups = engine.getAllGroups().filter(g => g.color === color && g.libertyCount === 1);
    if (endangeredGroups.length > 0) {
      const escapeChance = isGentleMode ? rank.tactics.escapeChance * 0.6 : rank.tactics.escapeChance;
      if (Math.random() < escapeChance) {
        // 尝试下在其仅剩的这口气上进行逃脱
        for (const g of endangeredGroups) {
          const escapePoint = g.liberties[0];
          const test = engine.testMove(escapePoint.x, escapePoint.y, color);
          if (test.valid) {
            return { x: escapePoint.x, y: escapePoint.y };
          }
        }
      }
    }

    // 3. 随机失误率分支（低段位小朋友对手会偶尔随手下）
    if (Math.random() < rank.tactics.randomness) {
      // 随机挑一个不会自寻死路的空位
      const safeMoves = legalMoves.filter(m => {
        engine.board[m.y][m.x] = color;
        const grp = engine.getGroup(m.x, m.y);
        engine.board[m.y][m.x] = EMPTY;
        return grp && grp.libertyCount > 1;
      });
      if (safeMoves.length > 0) {
        return safeMoves[Math.floor(Math.random() * safeMoves.length)];
      }
      return legalMoves[Math.floor(Math.random() * legalMoves.length)];
    }

    // 4. 启发式估值选点（综合评估：气数增加、占角占边、打吃对方、保护弱点）
    let bestMove = null;
    let maxScore = -999999;

    // 棋盘几何权重：三线四线最佳，角部次之，二线防守，一线谨慎
    const getPositionalWeight = (x, y, size) => {
      const distEdgeX = Math.min(x, size - 1 - x);
      const distEdgeY = Math.min(y, size - 1 - y);
      const minEdge = Math.min(distEdgeX, distEdgeY);

      if (minEdge === 2 || minEdge === 3) return 18; // 三路或四路（金角银边星位）
      if (minEdge === 1) return 8;                   // 二路
      if (minEdge === 0) return -5;                  // 一路死亡线（除收官和吃子外少下）
      return 12;                                     // 天元/腹地
    };

    for (const move of legalMoves) {
      let score = 0;

      // 基础几何分
      score += getPositionalWeight(move.x, move.y, engine.size);

      // 提子奖励分
      score += move.captures * 60;

      // 模拟落子测试
      engine.board[move.y][move.x] = color;
      const selfGroup = engine.getGroup(move.x, move.y);

      if (selfGroup) {
        // 自主气数奖励（气越多越安全健康）
        score += selfGroup.libertyCount * 12;
        // 如果只有1口气但没吃到子，惩罚该步
        if (selfGroup.libertyCount === 1) {
          score -= 150;
        }
      }

      // 测试是否对对手形成了打吃（攻击分）
      for (const n of engine.getNeighbors(move.x, move.y)) {
        if (engine.board[n.y][n.x] === opponent) {
          const oppGroup = engine.getGroup(n.x, n.y);
          if (oppGroup && oppGroup.libertyCount === 1) {
            score += 35; // 叫吃对方
          }
        }
      }

      // 与友军连接奖励
      for (const n of engine.getNeighbors(move.x, move.y)) {
        if (engine.board[n.y][n.x] === color) {
          score += 15;
        }
      }

      // 撤销模拟
      engine.board[move.y][move.x] = EMPTY;

      // 加一点点随机微扰，让对局有变化不呆板
      score += (Math.random() - 0.5) * 5;

      if (score > maxScore) {
        maxScore = score;
        bestMove = move;
      }
    }

    // 如果在围地模式下所有步均为有害负分（自填眼或送死），AI 主动 Pass
    if (!isCaptureMode && maxScore < 0) {
      return null;
    }

    return bestMove || legalMoves[0];
  }
}
