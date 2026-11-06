// ai.js - 少儿自适应围棋对弈 AI 引擎（融合 1~30 关教学手筋识别、多步算路推演、实战学以致用喝彩与教练支招）

if (typeof window === 'undefined' && typeof require !== 'undefined') {
  const _engine = require('./go-engine.js');
  global.BLACK = _engine.BLACK;
  global.WHITE = _engine.WHITE;
  global.EMPTY = _engine.EMPTY;
  global.GoEngine = _engine.GoEngine;
}

const RANKS = [
  {
    level: 1,
    name: "18K 萌新小兔",
    animal: "小兔",
    icon: "🐰",
    title: "吃子棋学徒",
    desc: "刚刚学会下棋的小白兔，偶尔会走神把棋子送到你嘴边让你练习手筋哦！",
    quotes: ["你好呀！我们来比比谁先吃到萝卜吧！", "哎呀，这颗棋子怎么跑这儿来啦~", "你真厉害，小兔要加油啦！"],
    tactics: {
      captureChance: 0.55,
      escapeChance: 0.45,
      randomness: 0.65,
      feedTesujiChance: 0.5, // 主动给小朋友喂招（留出双打吃/门吃/抱吃机会）
      useTesuji: false,
      useLadder: false,
      searchDepth: 1
    }
  },
  {
    level: 2,
    name: "14K 机智小狐",
    animal: "小狐狸",
    icon: "🦊",
    title: "机灵探索者",
    desc: "聪明的小狐狸，已经学会保护自己的气和真眼，还会趁机咬一口！",
    quotes: ["嘻嘻，我可不会轻易让你吃到棋子！", "小心哦，小狐狸的眼睛很尖的！", "这步棋有两下子嘛！"],
    tactics: {
      captureChance: 0.78,
      escapeChance: 0.72,
      randomness: 0.38,
      feedTesujiChance: 0.25,
      useTesuji: true,
      useLadder: false,
      searchDepth: 1
    }
  },
  {
    level: 3,
    name: "10K 沉着小鹿",
    animal: "小鹿",
    icon: "🦌",
    title: "森林围地家",
    desc: "懂得占角占边、使用门吃与双打吃的稳重高手。",
    quotes: ["金角银边，我们一步一步稳扎稳打！", "互相连起来，棋子才更有力量。", "你的棋风很沉稳呢！"],
    tactics: {
      captureChance: 0.92,
      escapeChance: 0.88,
      randomness: 0.18,
      feedTesujiChance: 0,
      useTesuji: true,
      useLadder: false,
      searchDepth: 2
    }
  },
  {
    level: 4,
    name: "5K 威武大象",
    animal: "大象",
    icon: "🐘",
    title: "破阵大将军",
    desc: "擅长扭羊头征子、飞枷、挖断攻击和做活两只眼，力量惊人！",
    quotes: ["大象漫步，稳如泰山！看我这一手！", "注意你的薄弱点哦！", "精彩的交锋，佩服佩服！"],
    tactics: {
      captureChance: 0.98,
      escapeChance: 0.96,
      randomness: 0.06,
      feedTesujiChance: 0,
      useTesuji: true,
      useLadder: true,
      searchDepth: 2
    }
  },
  {
    level: 5,
    name: "1D 神算熊猫",
    animal: "熊猫师傅",
    icon: "🐼",
    title: "棋圣大宗师",
    desc: "融会贯通 20 关全部手筋与死活绝技、精通多步算路的国宝级师傅！",
    quotes: ["静下心来，棋盘上有大千世界。", "神之一手，妙趣横生！", "后生可畏，未来可期！"],
    tactics: {
      captureChance: 1.0,
      escapeChance: 1.0,
      randomness: 0.0,
      feedTesujiChance: 0,
      useTesuji: true,
      useLadder: true,
      searchDepth: 3
    }
  }
];

class GoAI {
  constructor() {
    this.currentRankIndex = 0; // 默认 18K 小兔
    this.consecutiveLosses = 0; // 记录小朋友连败局数（用于自适应温柔放水）
    this.consecutiveWins = 0;   // 记录连胜局数（用于自适应晋升提示）
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
      if (this.consecutiveWins >= 2 && this.currentRankIndex < RANKS.length - 1) {
        this.currentRankIndex++;
        this.consecutiveWins = 0;
        return { promoted: true, newRank: this.getCurrentRank() };
      }
    } else {
      this.consecutiveLosses++;
      this.consecutiveWins = 0;
      if (this.consecutiveLosses >= 2 && this.currentRankIndex > 0) {
        this.currentRankIndex--;
        this.consecutiveLosses = 0;
        return { demoted: true, newRank: this.getCurrentRank() };
      }
    }
    return { promoted: false, demoted: false, currentRank: this.getCurrentRank() };
  }

  // ============================================================================
  // 一、 基础棋盘克隆与几何工具函数
  // ============================================================================

  cloneEngine(src) {
    const sim = new GoEngine(src.size);
    sim.board = src.board.map(row => [...row]);
    sim.turn = src.turn;
    sim.capturedStones = { ...src.capturedStones };
    sim.koPoint = src.koPoint ? { ...src.koPoint } : null;
    sim.lastMove = src.lastMove ? { ...src.lastMove } : null;
    return sim;
  }

  getDiagonals(size, x, y) {
    const list = [];
    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        list.push({ x: nx, y: ny });
      }
    }
    return list;
  }

  // ============================================================================
  // 二、 1~20 关教学手筋与死活探测器 (Tactical & Life-Death Detectors)
  // ============================================================================

  // 1. 真眼与假眼判定（对应第9关：两眼活棋、第16关：假眼鉴别）
  classifyEyePoint(engine, x, y, color) {
    if (engine.board[y][x] !== EMPTY) return 'none';
    const opponent = color === BLACK ? WHITE : BLACK;
    const neighbors = engine.getNeighbors(x, y);

    // 四周正交邻点必须全部是同色棋子，且不能处于 1 气被打吃状态
    for (const n of neighbors) {
      if (engine.board[n.y][n.x] !== color) return 'none';
      const grp = engine.getGroup(n.x, n.y);
      if (!grp || grp.libertyCount <= 1) return 'false_eye';
    }

    // 检查斜对角控制情况
    const diags = this.getDiagonals(engine.size, x, y);
    let oppDiagCount = 0;
    let friendlyDiagCount = 0;
    for (const d of diags) {
      const c = engine.board[d.y][d.x];
      if (c === opponent) {
        oppDiagCount++;
      } else if (c === color) {
        friendlyDiagCount++;
      } else {
        // 空斜角若四周被己方围住也算己方控制
        const dNeighbors = engine.getNeighbors(d.x, d.y);
        if (dNeighbors.every(dn => engine.board[dn.y][dn.x] === color)) {
          friendlyDiagCount++;
        }
      }
    }

    // 中央点有 4 个斜角，若被对方占领 >= 2 个则为假眼；边角点有 1~2 个斜角，被占 >= 1 个即为假眼
    if (diags.length === 4) {
      if (oppDiagCount >= 2) return 'false_eye';
      if (friendlyDiagCount >= 3) return 'real_eye';
    } else {
      if (oppDiagCount >= 1) return 'false_eye';
      if (friendlyDiagCount === diags.length) return 'real_eye';
    }
    return 'semi_eye'; // 半眼（需要补一手成真眼，或被点成假眼）
  }

  // 2. 直三/弯三做眼与点眼破眼急所检测（对应第9关：两眼活棋、第17关：破眼杀棋）
  detectEyeVitalPoint(engine, x, y, color) {
    if (engine.board[y][x] !== EMPTY) return null;
    const opponent = color === BLACK ? WHITE : BLACK;
    const neighbors = engine.getNeighbors(x, y);
    const emptyNeighbors = neighbors.filter(n => engine.board[n.y][n.x] === EMPTY);

    // 情况 A：直三或弯三的中心点（恰有 2 个相邻空位，且这两个空位互不相邻，周围被同一色棋子包围）
    if (emptyNeighbors.length === 2) {
      const [e1, e2] = emptyNeighbors;
      const dist = Math.abs(e1.x - e2.x) + Math.abs(e1.y - e2.y);
      if (dist >= 2) {
        // 统计 (x,y), e1, e2 周围的非空边界棋子颜色
        let sameCount = 0;
        let oppCount = 0;
        const cluster = [{ x, y }, e1, e2];
        for (const pt of cluster) {
          for (const nb of engine.getNeighbors(pt.x, pt.y)) {
            if (cluster.some(c => c.x === nb.x && c.y === nb.y)) continue;
            if (engine.board[nb.y][nb.x] === color) sameCount++;
            else if (engine.board[nb.y][nb.x] === opponent) oppCount++;
          }
        }
        // 己方包围圈内部：落子中心分出左右两只真眼（第9关）
        if (sameCount >= 5 && oppCount <= 1) {
          return {
            type: 'make_two_eyes',
            levelId: 9,
            name: '两眼做活',
            scoreBonus: 185,
            coachText: `下在直三/弯三正中心，瞬间隔出左右两只真眼，用【第9关：两只真眼】让大龙永远活棋！`
          };
        }
        // 对方包围圈内部：敌之要点即我之要点，抢先点眼破眼（第17关）
        if (oppCount >= 5 && sameCount <= 1) {
          const sim = this.cloneEngine(engine);
          const res = sim.play(x, y, color);
          if (res.success) {
            return {
              type: 'destroy_eye',
              levelId: 17,
              name: '点眼杀棋',
              scoreBonus: 260,
              coachText: `敌之要点即我之要点！抢先占领白棋做眼分界中心，用【第17关：点眼杀棋】破掉它的两只眼！`
            };
          }
        }
      }
    }

    // 情况 B：卡眼/破假眼（点在半眼的斜角缺陷或直接扑入破眼，对应第16关）
    for (const d of this.getDiagonals(engine.size, x, y)) {
      if (engine.board[d.y][d.x] === EMPTY) {
        const eyeBefore = this.classifyEyePoint(engine, d.x, d.y, opponent);
        if (eyeBefore === 'semi_eye' || eyeBefore === 'real_eye') {
          const sim = this.cloneEngine(engine);
          if (sim.play(x, y, color).success) {
            const eyeAfter = this.classifyEyePoint(sim, d.x, d.y, opponent);
            if (eyeAfter === 'false_eye') {
              return {
                type: 'make_false_eye',
                levelId: 16,
                name: '破角成假眼',
                scoreBonus: 50,
                coachText: `抢占白棋眼位的斜对角要害，运用【第16关：假眼大揭秘】把白棋的真眼变成假眼！`
              };
            }
          }
        }
      }
    }

    return null;
  }

  // 3. 征子（扭羊头）高速斜向阶梯推演器（对应第10关：扭羊头）
  readLadder(engine, targetX, targetY, attackerColor, depth = 0) {
    if (depth > 16) return false;
    const defenderColor = attackerColor === BLACK ? WHITE : BLACK;
    const grp = engine.getGroup(targetX, targetY);
    if (!grp || grp.color !== defenderColor) return true; // 已被提吃
    if (grp.libertyCount === 0) return true;
    if (grp.libertyCount === 1) {
      // 仅剩 1 气，直接落子即可提吃
      const lastLib = grp.liberties[0];
      return engine.testMove(lastLib.x, lastLib.y, attackerColor).valid;
    }
    if (grp.libertyCount > 2) return false; // 超过 2 气无法直接征吃

    // 若防守方紧邻的攻击方棋串本身只有 1 口气，防守方可以反提解围，征子不成立
    for (const s of grp.stones) {
      for (const n of engine.getNeighbors(s.x, s.y)) {
        if (engine.board[n.y][n.x] === attackerColor) {
          const atkGrp = engine.getGroup(n.x, n.y);
          if (atkGrp && atkGrp.libertyCount === 1) {
            return false;
          }
        }
      }
    }

    // 尝试从 2 口气中的任意一口打吃，看能否形成必死征子
    const [libA, libB] = grp.liberties;
    const candidates = [
      { play: libA, escape: libB },
      { play: libB, escape: libA }
    ];

    for (const { play, escape } of candidates) {
      const sim = this.cloneEngine(engine);
      const atkRes = sim.play(play.x, play.y, attackerColor);
      if (!atkRes.success) continue;

      const atkSelf = sim.getGroup(play.x, play.y);
      if (!atkSelf || atkSelf.libertyCount < 2) continue; // 打吃子自身仅 1 气会被反提

      // 防守方被迫在 escape 处长气逃跑
      const defRes = sim.play(escape.x, escape.y, defenderColor);
      if (!defRes.success) return true; // 防守方连逃跑都是禁着点，必死
      if (defRes.captures && defRes.captures.length > 0) continue; // 防守方提子脱困

      const newDefGrp = sim.getGroup(escape.x, escape.y);
      if (!newDefGrp || newDefGrp.libertyCount <= 1) return true; // 逃跑后仍只有 1 气，必死
      if (newDefGrp.libertyCount === 2) {
        if (this.readLadder(sim, escape.x, escape.y, attackerColor, depth + 1)) {
          return true;
        }
      }
    }
    return false;
  }

  // 检测一步棋是否发动了有效的征子追击（第10关）
  detectLadderAttack(engine, x, y, color) {
    const opponent = color === BLACK ? WHITE : BLACK;
    const sim = this.cloneEngine(engine);
    const res = sim.play(x, y, color);
    if (!res.success) return null;

    const selfGrp = sim.getGroup(x, y);
    if (!selfGrp || selfGrp.libertyCount < 2) return null;

    for (const n of sim.getNeighbors(x, y)) {
      if (sim.board[n.y][n.x] === opponent) {
        const oppGrp = sim.getGroup(n.x, n.y);
        if (oppGrp && oppGrp.libertyCount === 1) {
          const esc = oppGrp.liberties[0];
          const sim2 = this.cloneEngine(sim);
          const defRes = sim2.play(esc.x, esc.y, opponent);
          if (!defRes.success) {
            return { levelId: 10, name: '扭羊头征子', targetSize: oppGrp.stones.length };
          }
          if (defRes.captures.length === 0) {
            const afterEscGrp = sim2.getGroup(esc.x, esc.y);
            if (afterEscGrp && afterEscGrp.libertyCount === 2) {
              if (this.readLadder(sim2, esc.x, esc.y, color, 1)) {
                return {
                  levelId: 10,
                  name: '扭羊头征子',
                  targetSize: oppGrp.stones.length,
                  coachText: `选准方向打吃，启动【第10关：扭羊头（征子）】连续阶梯追击，白棋插翅难逃！`
                };
              }
            }
          }
        }
      }
    }
    return null;
  }

  // 4. 双打吃探测器（对应第11关：双打吃）
  detectDoubleAtari(engine, x, y, color) {
    const opponent = color === BLACK ? WHITE : BLACK;
    // 记录落子前周围对方各块棋的气数
    const beforeLiberties = new Map();
    for (const n of engine.getNeighbors(x, y)) {
      if (engine.board[n.y][n.x] === opponent) {
        const g = engine.getGroup(n.x, n.y);
        if (g) {
          const repKey = g.stones.map(s => `${s.x},${s.y}`).sort().join('|');
          beforeLiberties.set(repKey, g.libertyCount);
        }
      }
    }
    if (beforeLiberties.size < 2) return null;

    const sim = this.cloneEngine(engine);
    const res = sim.play(x, y, color);
    if (!res.success) return null;

    const selfGrp = sim.getGroup(x, y);
    if (!selfGrp || (selfGrp.libertyCount < 2 && res.captures.length === 0)) return null;

    const atariGroups = new Set();
    for (const n of sim.getNeighbors(x, y)) {
      if (sim.board[n.y][n.x] === opponent) {
        const g = sim.getGroup(n.x, n.y);
        if (g && g.libertyCount === 1) {
          const repKey = g.stones.map(s => `${s.x},${s.y}`).sort().join('|');
          if ((beforeLiberties.get(repKey) || 0) > 1) {
            atariGroups.add(repKey);
          }
        }
      }
    }

    if (atariGroups.size >= 2) {
      return {
        levelId: 11,
        name: '双打吃',
        count: atariGroups.size,
        scoreBonus: 115,
        coachText: `一箭双雕！落子在两块白棋中间，使出【第11关：双打吃】同时叫吃两边，白棋顾此失彼必丢其一！`
      };
    }
    return null;
  }

  // 5. 门吃与抱吃探测器（对应第7关：门吃、第8关：抱吃）
  detectGateOrHugCapture(engine, x, y, color) {
    const opponent = color === BLACK ? WHITE : BLACK;
    const sim = this.cloneEngine(engine);
    const res = sim.play(x, y, color);
    if (!res.success) return null;

    const selfGrp = sim.getGroup(x, y);
    if (!selfGrp || selfGrp.libertyCount < 2) return null;

    for (const n of sim.getNeighbors(x, y)) {
      if (sim.board[n.y][n.x] === opponent) {
        const oppGrp = sim.getGroup(n.x, n.y);
        if (oppGrp && oppGrp.libertyCount === 1) {
          const esc = oppGrp.liberties[0];
          // 检查如果对方往唯一的气 esc 逃跑会发生什么
          const sim2 = this.cloneEngine(sim);
          const escRes = sim2.play(esc.x, esc.y, opponent);
          if (!escRes.success || (escRes.captures.length === 0 && sim2.getGroup(esc.x, esc.y).libertyCount <= 1)) {
            // 区分门吃（两侧门柱夹击，正前方空旷）与抱吃（迎面撞上正前方外围墙壁）
            const dx = esc.x - n.x;
            const dy = esc.y - n.y;
            const frontX = esc.x + dx;
            const frontY = esc.y + dy;
            const hasFrontWall = sim.inBounds(frontX, frontY) && sim.board[frontY][frontX] === color;
            const escNeighbors = sim.getNeighbors(esc.x, esc.y);
            const friendlyAroundEsc = escNeighbors.filter(en => sim.board[en.y][en.x] === color && !(en.x === x && en.y === y));

            if (hasFrontWall && friendlyAroundEsc.length >= 1) {
              return {
                levelId: 8,
                name: '抱吃',
                scoreBonus: 124,
                coachText: `对面已有黑棋人墙接应！从外侧包抄打吃，用【第8关：抱吃】把白棋赶进咱们的怀抱里吃掉！`
              };
            }
            if (friendlyAroundEsc.length >= 2) {
              return {
                levelId: 7,
                name: '门吃',
                scoreBonus: 136,
                coachText: `两边门柱已经就位！下在这里用【第7关：门吃】关上大门，白棋就算往前冲也只有 1 口气！`
              };
            }
            if (friendlyAroundEsc.length === 1) {
              return {
                levelId: 8,
                name: '抱吃',
                scoreBonus: 120,
                coachText: `对面已有黑棋接应！从身后打吃，用【第8关：抱吃】把白棋赶进咱们的怀抱里吃掉！`
              };
            }
          }
        }
      }
    }
    return null;
  }

  // 6. 飞枷/枷吃探测器（对应第12关：飞枷）
  detectNetCapture(engine, x, y, color) {
    if (engine.board[y][x] !== EMPTY) return null;
    const opponent = color === BLACK ? WHITE : BLACK;

    // 飞枷特征：(x,y) 与一颗 2 气对方棋子 (ox,oy) 呈对角象步关系，且它们共享的两个正交点 (x,oy) 与 (ox,y) 均为空位（即该对方棋子的仅存 2 口气）
    for (const d of this.getDiagonals(engine.size, x, y)) {
      if (engine.board[d.y][d.x] === opponent) {
        const oppGrp = engine.getGroup(d.x, d.y);
        if (oppGrp && oppGrp.stones.length <= 2 && oppGrp.libertyCount === 2) {
          const p1 = { x: x, y: d.y };
          const p2 = { x: d.x, y: y };
          if (engine.board[p1.y][p1.x] === EMPTY && engine.board[p2.y][p2.x] === EMPTY) {
            const sim = this.cloneEngine(engine);
            if (!sim.play(x, y, color).success) continue;
            const selfGrp = sim.getGroup(x, y);
            if (!selfGrp || selfGrp.libertyCount < 2) continue;

            // 验证对方无论冲 p1 还是冲 p2，气数都无法突破 2 且能被挡死
            let trappedBoth = true;
            for (const [pushPt, blockPt] of [[p1, p2], [p2, p1]]) {
              const simPush = this.cloneEngine(sim);
              const pushRes = simPush.play(pushPt.x, pushPt.y, opponent);
              if (pushRes.success) {
                if (pushRes.captures.length > 0) {
                  trappedBoth = false;
                  break;
                }
                const blockRes = simPush.play(blockPt.x, blockPt.y, color);
                if (!blockRes.success) {
                  trappedBoth = false;
                  break;
                }
                const afterGrp = simPush.getGroup(pushPt.x, pushPt.y);
                if (afterGrp && afterGrp.libertyCount > 1) {
                  trappedBoth = false;
                  break;
                }
              }
            }

            if (trappedBoth) {
              return {
                levelId: 12,
                name: '飞枷',
                scoreBonus: 148,
                coachText: `不用贴着追！在斜前方虚扣一子，使出【第12关：枷吃（飞网捕鱼）】张开大网困住白棋！`
              };
            }
          }
        }
      }
    }
    return null;
  }

  // 7. 倒扑探测器（对应第13关：倒扑）
  detectSnapback(engine, x, y, color) {
    if (engine.board[y][x] !== EMPTY) return null;
    const opponent = color === BLACK ? WHITE : BLACK;
    const sim = this.cloneEngine(engine);
    const res = sim.play(x, y, color);
    if (!res.success) return null;

    const selfGrp = sim.getGroup(x, y);
    // 主动送吃 1 颗子（扑入虎口，自身仅剩 1 气）
    if (selfGrp && selfGrp.stones.length === 1 && selfGrp.libertyCount === 1 && res.captures.length === 0) {
      const lastLib = selfGrp.liberties[0];
      // 模拟对方在 lastLib 提掉这颗扑进去的子
      const sim2 = this.cloneEngine(sim);
      const oppTake = sim2.play(lastLib.x, lastLib.y, opponent);
      if (oppTake.success && oppTake.captures.length === 1) {
        const oppGrpAfter = sim2.getGroup(lastLib.x, lastLib.y);
        // 提子后对方整串棋 (>=3子) 只剩 1 口气（正是刚才扑的位置 x,y），即可反手全部提吃！
        if (oppGrpAfter && oppGrpAfter.stones.length >= 3 && oppGrpAfter.libertyCount === 1) {
          const snapBackMove = sim2.testMove(x, y, color);
          if (snapBackMove.valid && snapBackMove.capturedStones.length >= 3) {
            return {
              levelId: 13,
              name: '倒扑',
              capturedCount: snapBackMove.capturedStones.length,
              scoreBonus: 110,
              coachText: `神仙妙手！主动把棋子送进虎口，用【第13关：倒扑】引诱白棋提子自填其气，下一手反吃整串白棋！`
            };
          }
        }
      }
    }
    return null;
  }

  // 8. 接不归探测器（对应第14关：接不归）
  // 8a. 防守自检：判断下在 (x,y) 救子是否属于“接不归白送死”
  isConnectAndDieSelf(engine, x, y, color) {
    const sim = this.cloneEngine(engine);
    const res = sim.play(x, y, color);
    if (!res.success) return true;
    if (res.captures.length > 0) return false; // 提子解围不算送死
    const selfGrp = sim.getGroup(x, y);
    // 落子后整串棋 >= 2 子但依然只有 1 口气，且不是倒扑妙手 -> 接不归送吃！
    if (selfGrp && selfGrp.stones.length >= 2 && selfGrp.libertyCount === 1) {
      return true;
    }
    return false;
  }

  // 8b. 进攻检测：判断下在 (x,y) 是否造成对方“接不归”或直接斩断接不归
  detectConnectAndDieAttack(engine, x, y, color) {
    const opponent = color === BLACK ? WHITE : BLACK;
    const sim = this.cloneEngine(engine);
    const res = sim.play(x, y, color);
    if (!res.success) return null;

    // 若这步棋直接提吃了对方正在尝试连接的 >= 2 颗子
    if (res.captures.length >= 2) {
      // 检查 (x,y) 周围是否还有对方的其它棋子（说明斩断了归路）
      const adjOpp = sim.getNeighbors(x, y).some(n => sim.board[n.y][n.x] === opponent);
      if (adjOpp) {
        return {
          levelId: 14,
          name: '接不归斩将',
          scoreBonus: 90,
          coachText: `白棋回家的路断啦！抢占连接要害，用【第14关：接不归】一举提吃白棋残兵！`
        };
      }
    }

    // 或者这步打吃让对方只剩 1 气，且对方即使连上也只有 1 气（接不归）
    const selfGrp = sim.getGroup(x, y);
    if (selfGrp && selfGrp.libertyCount >= 2) {
      for (const n of sim.getNeighbors(x, y)) {
        if (sim.board[n.y][n.x] === opponent) {
          const oppGrp = sim.getGroup(n.x, n.y);
          if (oppGrp && oppGrp.libertyCount === 1) {
            const connectPt = oppGrp.liberties[0];
            // 真正的“接不归”要求 connectPt 旁边确实有另一块对方友军尝试接应，但连上后依然只有 1 口气
            const connectsToOtherOpp = sim.getNeighbors(connectPt.x, connectPt.y).some(
              cn => sim.board[cn.y][cn.x] === opponent && !oppGrp.stones.some(s => s.x === cn.x && s.y === cn.y)
            );
            if (connectsToOtherOpp && this.isConnectAndDieSelf(sim, connectPt.x, connectPt.y, opponent)) {
              return {
                levelId: 14,
                name: '接不归',
                scoreBonus: 88,
                coachText: `精妙打吃！使出【第14关：接不归】，白棋就算连回友军也只有 1 口气，必死无疑！`
              };
            }
          }
        }
      }
    }
    return null;
  }

  // 9. 挖与夹分断探测器（对应第15关：挖与夹）
  detectWedgeAndCut(engine, x, y, color) {
    if (engine.board[y][x] !== EMPTY) return null;
    const opponent = color === BLACK ? WHITE : BLACK;

    // 检查水平一格跳 (x-1,y) 与 (x+1,y) 或垂直一格跳 (x,y-1) 与 (x,y+1)
    const pairs = [
      [{ x: x - 1, y }, { x: x + 1, y }],
      [{ x, y: y - 1 }, { x, y: y + 1 }]
    ];

    for (const [p1, p2] of pairs) {
      if (engine.inBounds(p1.x, p1.y) && engine.inBounds(p2.x, p2.y)) {
        if (engine.board[p1.y][p1.x] === opponent && engine.board[p2.y][p2.x] === opponent) {
          const g1 = engine.getGroup(p1.x, p1.y);
          const g2 = engine.getGroup(p2.x, p2.y);
          const sameGroup = g1.stones.some(s => s.x === p2.x && s.y === p2.y);
          if (!sameGroup) {
            const sim = this.cloneEngine(engine);
            const res = sim.play(x, y, color);
            if (!res.success) continue;
            const selfGrp = sim.getGroup(x, y);
            if (!selfGrp || selfGrp.libertyCount < 2) continue;

            const afterG1 = sim.getGroup(p1.x, p1.y);
            const afterG2 = sim.getGroup(p2.x, p2.y);
            if (afterG1 && afterG2 && (afterG1.libertyCount <= 2 || afterG2.libertyCount <= 2)) {
              return {
                levelId: 15,
                name: '挖断手筋',
                scoreBonus: 98,
                coachText: `瞄准白棋间一格跳的薄弱空档，用【第15关：挖与夹】像楔子一样硬插进去，把白棋一刀两断！`
              };
            }
          }
        }
      }
    }
    return null;
  }

  // 10. 滚打包收与愚形空三角检测（对应第18关：滚打包收）
  isEmptyTriangle(engine, x, y, color) {
    // 检查包含 (x,y) 的四个 2x2 方格，若落子后形成 3 颗己方棋子 + 1 个空位，且未紧对方气，则为凝重空三角
    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dx, dy] of dirs) {
      const p1 = { x: x + dx, y };
      const p2 = { x, y: y + dy };
      const pDiag = { x: x + dx, y: y + dy };
      if (engine.inBounds(pDiag.x, pDiag.y)) {
        let sameCount = 1; // 包含 (x,y) 自身
        let emptyCount = 0;
        for (const pt of [p1, p2, pDiag]) {
          if (engine.board[pt.y][pt.x] === color) sameCount++;
          else if (engine.board[pt.y][pt.x] === EMPTY) emptyCount++;
        }
        if (sameCount === 3 && emptyCount === 1) {
          return true;
        }
      }
    }
    return false;
  }

  // 11. 双活公气保护（对应第19关：双活共生）
  isSekiSharedLiberty(engine, x, y, color) {
    if (engine.board[y][x] !== EMPTY) return false;
    const opponent = color === BLACK ? WHITE : BLACK;
    const neighbors = engine.getNeighbors(x, y);
    const touchesSelf = neighbors.some(n => engine.board[n.y][n.x] === color);
    const touchesOpp = neighbors.some(n => engine.board[n.y][n.x] === opponent);
    if (!touchesSelf || !touchesOpp) return false;

    // 如果己方填入 (x,y) 没能吃掉对方，反而使己方 >= 2 子的棋串只剩 1 气（自紧公气送死）
    const simSelf = this.cloneEngine(engine);
    const resSelf = simSelf.play(x, y, color);
    if (!resSelf.success) return false;
    if (resSelf.captures.length > 0) return false;
    const selfGrp = simSelf.getGroup(x, y);
    if (!selfGrp || selfGrp.stones.length < 2 || selfGrp.libertyCount > 1) return false;

    // 同时检查对方如果填入 (x,y) 是否也会导致对方棋串只剩 1 气或禁入
    const simOpp = this.cloneEngine(engine);
    const resOpp = simOpp.play(x, y, opponent);
    if (!resOpp.success) return true;
    if (resOpp.captures.length === 0) {
      const oppGrp = simOpp.getGroup(x, y);
      if (oppGrp && oppGrp.libertyCount <= 1) {
        return true; // 双方谁填谁死 -> 典型双活公气！
      }
    }
    return false;
  }

  // 12. 金鸡独立探测器（对应第20关：金鸡独立）
  detectGoldenRooster(engine, x, y, color) {
    const s = engine.size;
    const isFirstLine = x === 0 || x === s - 1 || y === 0 || y === s - 1;
    if (!isFirstLine || engine.board[y][x] !== EMPTY) return null;

    const opponent = color === BLACK ? WHITE : BLACK;
    const sim = this.cloneEngine(engine);
    const res = sim.play(x, y, color);
    if (!res.success) return null;

    const selfGrp = sim.getGroup(x, y);
    if (!selfGrp || selfGrp.libertyCount < 2) return null;

    // 检查两侧相邻的空位是否对白棋形成了禁着点（自杀），从而冻结白棋
    const emptySides = sim.getNeighbors(x, y).filter(n => sim.board[n.y][n.x] === EMPTY);
    if (emptySides.length >= 2) {
      let forbiddenSides = 0;
      for (const ep of emptySides) {
        const oppTouch = sim.getNeighbors(ep.x, ep.y).some(nn => sim.board[nn.y][nn.x] === opponent);
        if (oppTouch && !sim.testMove(ep.x, ep.y, opponent).valid) {
          forbiddenSides++;
        }
      }
      if (forbiddenSides >= 2) {
        return {
          levelId: 20,
          name: '金鸡独立',
          scoreBonus: 420,
          coachText: `惊世妙手！往一线坚决立下，使出终极绝技【第20关：金鸡独立】，让白棋左右两边都变成禁着点！`
        };
      }
    }
    return null;
  }

  // ============================================================================
  // 三、 玩家实战“学以致用”妙手识别器 (Player Move Recognition)
  // ============================================================================

  analyzePlayerMove(prevEngine, afterEngine, x, y, color = BLACK, capturedStones = []) {
    const opponent = color === BLACK ? WHITE : BLACK;

    // 1. 金鸡独立（第20关）
    const rooster = this.detectGoldenRooster(prevEngine, x, y, color);
    if (rooster) {
      return {
        levelId: 20,
        name: '金鸡独立',
        praiseText: `🌟 学以致用！你使出了【第20关：金鸡独立】！一子立下，两边白棋都被禁着点锁死啦！`
      };
    }

    // 2. 倒扑（第13关）
    const snap = this.detectSnapback(prevEngine, x, y, color);
    if (snap) {
      return {
        levelId: 13,
        name: '倒扑',
        praiseText: `🌟 妙手生花！你使出了【第13关：倒扑】！故意送子入虎口，引诱白棋自填其气，太聪明啦！`
      };
    }

    // 3. 双打吃（第11关）
    const dblAtari = this.detectDoubleAtari(prevEngine, x, y, color);
    if (dblAtari) {
      return {
        levelId: 11,
        name: '双打吃',
        praiseText: `🌟 学以致用！好一招【第11关：双打吃】！一箭双雕同时叫吃两块白棋，对手顾此失彼啦！`
      };
    }

    // 4. 扭羊头征子（第10关）
    const ladder = this.detectLadderAttack(prevEngine, x, y, color);
    if (ladder) {
      return {
        levelId: 10,
        name: '扭羊头征子',
        praiseText: `🌟 学以致用！你启动了【第10关：扭羊头（征子）】！楼梯式连续追击，白棋逃不掉啦！`
      };
    }

    // 5. 飞枷（第12关）
    const net = this.detectNetCapture(prevEngine, x, y, color);
    if (net) {
      return {
        levelId: 12,
        name: '飞枷',
        praiseText: `🌟 高手风范！你使出了【第12关：飞枷】！斜向张开天罗地网，白棋插翅难飞！`
      };
    }

    // 6. 门吃与抱吃（第7关、第8关）
    const gateHug = this.detectGateOrHugCapture(prevEngine, x, y, color);
    if (gateHug) {
      return {
        levelId: gateHug.levelId,
        name: gateHug.name,
        praiseText: `🌟 学以致用！漂亮地使出了【第${gateHug.levelId}关：${gateHug.name}】！把白棋稳稳困在掌心！`
      };
    }

    // 7. 两眼做活（第9关）或 点眼破眼（第17关）/ 破假眼（第16关）
    const eyeMove = this.detectEyeVitalPoint(prevEngine, x, y, color);
    if (eyeMove) {
      return {
        levelId: eyeMove.levelId,
        name: eyeMove.name,
        praiseText: `🌟 火眼金睛！精准命中眼位急所，用出了【第${eyeMove.levelId}关：${eyeMove.name}】！`
      };
    }

    // 8. 挖与夹（第15关）
    const wedge = this.detectWedgeAndCut(prevEngine, x, y, color);
    if (wedge) {
      return {
        levelId: 15,
        name: '挖与夹',
        praiseText: `🌟 势如破竹！你使出了【第15关：挖与夹】！一子楔入白棋中间把它们截成两半！`
      };
    }

    // 9. 接不归（第14关）或 滚打包收大提子（第18关）
    if (capturedStones.length >= 3) {
      return {
        levelId: 18,
        name: '滚打包收',
        praiseText: `🌟 威力无穷！像【第18关：滚打包收】一样一口气端走了 ${capturedStones.length} 颗白棋大包子！`
      };
    }
    const cnd = this.detectConnectAndDieAttack(prevEngine, x, y, color);
    if (cnd) {
      return {
        levelId: 14,
        name: '接不归',
        praiseText: `🌟 学以致用！你造成了白棋【第14关：接不归】，切断了它回家的路！`
      };
    }

    // 10. 高阶杀气与死活手筋（第21~30关：扑紧气、二路下水托、一线扳粘）
    // 扑紧气（第26关）：下在对方虎口中导致自身只有 1 气，但有效紧逼对方
    const selfGrp = afterEngine.getGroup(x, y);
    if (selfGrp && selfGrp.libertyCount === 1) {
      for (const n of afterEngine.getNeighbors(x, y)) {
        if (afterEngine.board[n.y][n.x] === opponent) {
          const oppG = afterEngine.getGroup(n.x, n.y);
          if (oppG && oppG.libertyCount <= 2) {
            return {
              levelId: 26,
              name: '扑紧气',
              praiseText: `🌟 杀气神手！你使出了【第26关：扑紧气】！舍一子反紧对方重气！`
            };
          }
        }
      }
    }

    // 二路下水托（第27关）：在二路贴在对方三路棋子底部
    const isSecondLine = (x === 1 || x === prevEngine.size - 2 || y === 1 || y === prevEngine.size - 2);
    if (isSecondLine) {
      for (const n of prevEngine.getNeighbors(x, y)) {
        if (prevEngine.board[n.y][n.x] === opponent) {
          return {
            levelId: 27,
            name: '二路托渡',
            praiseText: `🌟 灵动如龙！你走出【第27关：二路下水托】！下腹潜渡与大军会师！`
          };
        }
      }
    }

    // 一线先手扳（第29关）：在最边缘一线落子打吃或紧贴
    const isFirstLine = (x === 0 || x === prevEngine.size - 1 || y === 0 || y === prevEngine.size - 1);
    if (isFirstLine) {
      for (const n of prevEngine.getNeighbors(x, y)) {
        if (prevEngine.board[n.y][n.x] === opponent) {
          return {
            levelId: 29,
            name: '一线扳粘',
            praiseText: `🌟 官子如神！你抢到了【第29关：一线先手扳】！先手搜刮大胜！`
          };
        }
      }
    }

    return null;
  }

  // ============================================================================
  // 四、 升级版“熊猫支招”实战教练 (Coaching Hint with Lesson Reference)
  // ============================================================================

  getCoachingHint(engine, color = BLACK, isCaptureMode = false) {
    const legalMoves = engine.getLegalMoves(color);
    if (legalMoves.length === 0) return null;

    // 借用 1D 熊猫宗师评估器计算全盘最佳选点及其背后的教学棋理
    const evaluated = this.evaluateAllCandidates(engine, color, RANKS[4], isCaptureMode, false);
    if (evaluated.length === 0) return null;

    const top = evaluated[0];
    const coordStr = `第${top.x + 1}列·第${top.y + 1}行`;

    if (top.coachInfo) {
      return {
        x: top.x,
        y: top.y,
        levelId: top.coachInfo.levelId,
        tacticName: top.coachInfo.name,
        coachText: `💡 熊猫支招（${coordStr}）：${top.coachInfo.coachText}`
      };
    }

    return {
      x: top.x,
      y: top.y,
      levelId: null,
      tacticName: '稳健好棋',
      coachText: `💡 熊猫支招：推荐下在【${coordStr}】，这里气数充沛、占据要津，是一步堂堂正正的好棋哦！`
    };
  }

  // ============================================================================
  // 五、 多维启发式估值 + 12大手筋加权 + Alpha-Beta 局部算路
  // ============================================================================

  getPositionalWeight(x, y, size) {
    const distEdgeX = Math.min(x, size - 1 - x);
    const distEdgeY = Math.min(y, size - 1 - y);
    const minEdge = Math.min(distEdgeX, distEdgeY);

    if (size === 5) {
      if (x === 2 && y === 2) return 20; // 5路棋盘天元极佳
      if (minEdge === 1) return 16;      // 5路二线金角
      return 4;
    }

    if (minEdge === 2 || minEdge === 3) return 18; // 三路或四路（金角银边星位）
    if (minEdge === 1) return 9;                   // 二路
    if (minEdge === 0) return -6;                  // 一路死亡线
    return 13;                                     // 腹地
  }

  // 评估棋盘整体形势分（用于 Alpha-Beta 多步搜索叶子节点估值）
  evaluateBoardState(engine, rootColor) {
    const opponent = rootColor === BLACK ? WHITE : BLACK;
    let total = 0;

    // 1. 提子差值（最核心实利）
    const myCaps = engine.capturedStones[opponent] || 0;
    const oppCaps = engine.capturedStones[rootColor] || 0;
    total += (myCaps - oppCaps) * 95;

    // 2. 棋块气数与死活健康度
    const groups = engine.getAllGroups();
    for (const g of groups) {
      const sign = g.color === rootColor ? 1 : -1;
      const stoneCount = g.stones.length;
      if (g.libertyCount === 1) {
        total += sign * (-65 * stoneCount); // 被叫吃极度危险
      } else if (g.libertyCount === 2) {
        total += sign * (8 * stoneCount);
      } else {
        total += sign * (18 * stoneCount + Math.min(g.libertyCount, 6) * 5);
      }
    }

    return total;
  }

  // 局部 Alpha-Beta 极小化极大搜索（过滤贪吃中计与近身对杀）
  alphaBeta(engine, depth, alpha, beta, maximizingPlayer, rootColor) {
    if (depth === 0) {
      return this.evaluateBoardState(engine, rootColor);
    }

    const currentColor = maximizingPlayer ? rootColor : (rootColor === BLACK ? WHITE : BLACK);
    const legal = engine.getLegalMoves(currentColor);
    if (legal.length === 0) {
      return this.evaluateBoardState(engine, rootColor);
    }

    // 快速启发式排序，只展开前 5 个最具战术价值的焦点候选点，保证 < 8ms 极速响应
    const tacticalCandidates = legal
      .map(m => {
        let prio = m.captures * 80 + this.getPositionalWeight(m.x, m.y, engine.size);
        for (const n of engine.getNeighbors(m.x, m.y)) {
          if (engine.board[n.y][n.x] !== EMPTY) prio += 20;
        }
        return { ...m, prio };
      })
      .sort((a, b) => b.prio - a.prio)
      .slice(0, 5);

    if (maximizingPlayer) {
      let maxEval = -Infinity;
      for (const m of tacticalCandidates) {
        const sim = this.cloneEngine(engine);
        if (!sim.play(m.x, m.y, currentColor).success) continue;
        const ev = this.alphaBeta(sim, depth - 1, alpha, beta, false, rootColor);
        if (ev > maxEval) maxEval = ev;
        if (ev > alpha) alpha = ev;
        if (beta <= alpha) break;
      }
      return maxEval === -Infinity ? this.evaluateBoardState(engine, rootColor) : maxEval;
    } else {
      let minEval = Infinity;
      for (const m of tacticalCandidates) {
        const sim = this.cloneEngine(engine);
        if (!sim.play(m.x, m.y, currentColor).success) continue;
        const ev = this.alphaBeta(sim, depth - 1, alpha, beta, true, rootColor);
        if (ev < minEval) minEval = ev;
        if (ev < beta) beta = ev;
        if (beta <= alpha) break;
      }
      return minEval === Infinity ? this.evaluateBoardState(engine, rootColor) : minEval;
    }
  }

  // 综合评估所有合法候选步
  evaluateAllCandidates(engine, color, rank, isCaptureMode, isGentleMode) {
    const legalMoves = engine.getLegalMoves(color);
    if (legalMoves.length === 0) return [];

    const opponent = color === BLACK ? WHITE : BLACK;
    const myEndangered = engine.getAllGroups().filter(g => g.color === color && g.libertyCount === 1);
    const evaluated = [];

    for (const move of legalMoves) {
      let score = 0;
      let coachInfo = null;
      const { x, y } = move;

      // 0. 绝对铁律：严禁自填己方真眼（第9关）
      const eyeType = this.classifyEyePoint(engine, x, y, color);
      if (eyeType === 'real_eye') {
        score -= 500;
      }

      // 0b. 严禁盲目填入双活公气自杀（第19关）
      if (this.isSekiSharedLiberty(engine, x, y, color)) {
        score -= 350;
      }

      // 1. 基础几何位置分
      score += this.getPositionalWeight(x, y, engine.size);

      // 2. 直接提子奖励（第3关）
      if (move.captures > 0) {
        score += move.captures * 85 + 40;
        coachInfo = {
          levelId: 3,
          name: '提子吃棋',
          coachText: `白棋只剩最后 1 口气啦！用【第3关：提子】直接吃掉这 ${move.captures} 颗棋子！`
        };
      }

      // 3. 紧急自救逃跑评估（第5关 vs 第10关征子 vs 第14关接不归）
      const savesGroup = myEndangered.find(g => g.liberties[0].x === x && g.liberties[0].y === y);
      if (savesGroup) {
        // 检查逃跑是否是“接不归”（连上还是1口气白送死）
        if (this.isConnectAndDieSelf(engine, x, y, color)) {
          score -= 180; // 接不归不救，避免添油战术送大包
        } else {
          const simEsc = this.cloneEngine(engine);
          simEsc.play(x, y, color);
          const afterEsc = simEsc.getGroup(x, y);
          // 高段位检查逃跑后是否会被对方征子（扭羊头）追死
          if (rank.tactics.useLadder && afterEsc && afterEsc.libertyCount === 2 && this.readLadder(simEsc, x, y, opponent, 1)) {
            score -= 120; // 被征子必死，不盲目逃跑
          } else if (afterEsc && afterEsc.libertyCount >= 2) {
            score += 75 + savesGroup.stones.length * 35;
            if (!coachInfo) {
              coachInfo = {
                levelId: 5,
                name: '长气逃跑',
                coachText: `小心！你的棋子只剩 1 口气处于危险中，快用【第5关：长气逃跑】连回友军长出 ${afterEsc.libertyCount} 口气！`
              };
            }
          }
        }
      }

      // 4. 模拟落子后的自身安全性与手筋探测
      const sim = this.cloneEngine(engine);
      const res = sim.play(x, y, color);
      if (!res.success) continue;
      const selfGroup = sim.getGroup(x, y);

      if (selfGroup) {
        score += Math.min(selfGroup.libertyCount, 6) * 11;

        // 若落子后自身只剩 1 口气且没提子，检查是否是【第13关：倒扑】妙手！
        if (selfGroup.libertyCount === 1 && move.captures === 0) {
          const snap = rank.tactics.useTesuji ? this.detectSnapback(engine, x, y, color) : null;
          if (snap) {
            score += snap.scoreBonus;
            coachInfo = snap;
          } else {
            score -= 220; // 普通自投虎口严厉惩罚（第6关）
          }
        }
      }

      // 5. 进阶教学手筋加成（14K 及以上段位启用）
      if (rank.tactics.useTesuji && (!selfGroup || selfGroup.libertyCount >= 2 || move.captures > 0)) {
        // 5a. 金鸡独立（第20关）
        const rooster = this.detectGoldenRooster(engine, x, y, color);
        if (rooster) {
          score += rooster.scoreBonus;
          coachInfo = rooster;
        }

        // 5b. 双打吃（第11关）
        const dblAtari = this.detectDoubleAtari(engine, x, y, color);
        if (dblAtari) {
          score += dblAtari.scoreBonus;
          if (!coachInfo || dblAtari.scoreBonus > (coachInfo.scoreBonus || 0)) coachInfo = dblAtari;
        }

        // 5c. 门吃与抱吃（第7、8关）
        const gateHug = this.detectGateOrHugCapture(engine, x, y, color);
        if (gateHug) {
          score += gateHug.scoreBonus;
          if (!coachInfo || gateHug.scoreBonus > (coachInfo.scoreBonus || 0)) coachInfo = gateHug;
        }

        // 5d. 扭羊头征子（第10关，5K/1D启用；若已是1步门吃/抱吃则归为门吃/抱吃）
        if (rank.tactics.useLadder && !gateHug) {
          const ladder = this.detectLadderAttack(engine, x, y, color);
          if (ladder) {
            ladder.scoreBonus = 96;
            score += ladder.scoreBonus;
            if (!coachInfo || ladder.scoreBonus > (coachInfo.scoreBonus || 0)) coachInfo = ladder;
          }
        }

        // 5e. 飞枷（第12关）
        const net = this.detectNetCapture(engine, x, y, color);
        if (net) {
          score += net.scoreBonus;
          if (!coachInfo || net.scoreBonus > (coachInfo.scoreBonus || 0)) coachInfo = net;
        }

        // 5f. 接不归进攻（第14关）
        const cnd = this.detectConnectAndDieAttack(engine, x, y, color);
        if (cnd) {
          score += cnd.scoreBonus;
          if (!coachInfo || cnd.scoreBonus > (coachInfo.scoreBonus || 0)) coachInfo = cnd;
        }

        // 5g. 挖与夹（第15关）
        const wedge = this.detectWedgeAndCut(engine, x, y, color);
        if (wedge) {
          score += wedge.scoreBonus;
          if (!coachInfo || wedge.scoreBonus > (coachInfo.scoreBonus || 0)) coachInfo = wedge;
        }

        // 5h. 两眼做活与破眼杀棋（第9、16、17关）
        const eyeVital = this.detectEyeVitalPoint(engine, x, y, color);
        if (eyeVital) {
          score += eyeVital.scoreBonus;
          if (!coachInfo || eyeVital.scoreBonus > (coachInfo.scoreBonus || 0)) coachInfo = eyeVital;
        }
      }

      // 6. 常规打吃（第4关）与削减对方气数（若已触发专项手筋则不重复叠加普通打吃高分）
      const hasSpecialTactic = Boolean(coachInfo && coachInfo.levelId >= 7);
      for (const n of sim.getNeighbors(x, y)) {
        if (sim.board[n.y][n.x] === opponent) {
          const oppGroup = sim.getGroup(n.x, n.y);
          if (oppGroup) {
            if (oppGroup.libertyCount === 1) {
              score += hasSpecialTactic ? 8 : (62 + oppGroup.stones.length * 14);
              if (!coachInfo) {
                coachInfo = {
                  levelId: 4,
                  name: '打吃警告',
                  coachText: `果断出击！用【第4关：打吃】紧逼对方，让这串棋子只剩最后 1 口气！`
                };
              }
            } else if (oppGroup.libertyCount === 2) {
              score += hasSpecialTactic ? 4 : 14;
            }
          }
        }
      }

      // 7. 友军连接与愚形空三角规避（第18关）
      let friendlyNeighbors = 0;
      for (const n of engine.getNeighbors(x, y)) {
        if (engine.board[n.y][n.x] === color) friendlyNeighbors++;
      }
      if (friendlyNeighbors > 0) {
        if (rank.level >= 3 && move.captures === 0 && this.isEmptyTriangle(engine, x, y, color)) {
          score -= 18; // 规避空三角愚形
        } else {
          score += friendlyNeighbors * 6;
        }
      }

      // 7b. 围地大局模式（庄园争夺战）：额外提升金角银边、占领星位与拆边的全局权重
      if (!isCaptureMode) {
        const posWeight = this.getPositionalWeight(x, y, engine.size);
        if (posWeight >= 16) {
          score += 24; // 鼓励占角守角与开阔大场
        }
      }

      // 8. 轻微随机扰动
      score += (Math.random() - 0.5) * 4;

      evaluated.push({ x, y, captures: move.captures, score, coachInfo });
    }

    evaluated.sort((a, b) => b.score - a.score);

    // 9. 高段位（5K 大象 / 1D 熊猫）对前 4 个最佳候选点执行多步 Alpha-Beta 算路校验
    if (rank.tactics.searchDepth >= 2 && evaluated.length > 1 && !isGentleMode) {
      const baselineEval = this.evaluateBoardState(engine, color);
      const topK = evaluated.slice(0, 4);
      const searchDepth = rank.tactics.searchDepth - 1;
      for (const cand of topK) {
        if (cand.score < -100) continue;
        // 若该点已是明确判定的高阶死活/手筋急所（如两眼做活、扭羊头、双打吃、飞枷、倒扑、点眼杀棋、金鸡独立），不被浅层气数差分压制
        if (cand.coachInfo && [7, 8, 9, 10, 11, 12, 13, 15, 17, 20].includes(cand.coachInfo.levelId)) {
          cand.score += 35;
          continue;
        }
        const sim = this.cloneEngine(engine);
        if (sim.play(cand.x, cand.y, color).success) {
          const abScore = this.alphaBeta(sim, searchDepth, -Infinity, Infinity, false, color);
          const delta = abScore - baselineEval;
          cand.score += Math.max(-28, Math.min(28, delta * 0.12));
        }
      }
      evaluated.sort((a, b) => b.score - a.score);
    }

    return evaluated;
  }

  // 18K 小兔 / 14K 小狐专属：“教学喂招”选点器（主动给小朋友创造双打吃、门吃、抱吃或提子靶子）
  findPedagogicalFeedMove(engine, color, safeMoves) {
    const playerColor = color === BLACK ? WHITE : BLACK;
    const feedCandidates = [];

    for (const m of safeMoves) {
      const sim = this.cloneEngine(engine);
      if (!sim.play(m.x, m.y, color).success) continue;
      const g = sim.getGroup(m.x, m.y);
      if (!g || g.libertyCount !== 2) continue;

      // 检查如果 AI 下在 (m.x, m.y)，玩家下一手能否对 AI 施展双打吃、门吃、抱吃或飞枷！
      for (const lib of g.liberties) {
        if (
          this.detectDoubleAtari(sim, lib.x, lib.y, playerColor) ||
          this.detectGateOrHugCapture(sim, lib.x, lib.y, playerColor) ||
          this.detectWedgeAndCut(sim, lib.x, lib.y, playerColor)
        ) {
          feedCandidates.push(m);
          break;
        }
      }
    }

    if (feedCandidates.length > 0) {
      return feedCandidates[Math.floor(Math.random() * feedCandidates.length)];
    }
    return null;
  }

  // ============================================================================
  // 六、 AI 主决策入口 getBestMove
  // ============================================================================

  getBestMove(engine, color = WHITE, isCaptureMode = false) {
    const rank = this.getCurrentRank();
    const legalMoves = engine.getLegalMoves(color);
    if (legalMoves.length === 0) {
      return null; // 无合法落子，Pass
    }

    const isGentleMode = this.consecutiveLosses >= 1; // 孩子刚输过一局，AI温柔一点
    const captureMoves = legalMoves.filter(m => m.captures > 0);

    // 围地数子模式下：如果玩家刚刚选择虚手（Pass），且盘面已无提子机会，AI 随之 Pass 终局结算
    if (!isCaptureMode && engine.lastMove && engine.lastMove.pass) {
      if (captureMoves.length === 0) {
        return null;
      }
    }

    // 1. 低段位随机失误与“教学喂招”分支（18K 小兔 / 14K 小狐）
    const effectiveRandomness = isGentleMode ? Math.min(0.85, rank.tactics.randomness + 0.2) : rank.tactics.randomness;
    if (Math.random() < effectiveRandomness) {
      const safeMoves = legalMoves.filter(m => {
        if (this.classifyEyePoint(engine, m.x, m.y, color) === 'real_eye') return false;
        const sim = this.cloneEngine(engine);
        if (!sim.play(m.x, m.y, color).success) return false;
        const grp = sim.getGroup(m.x, m.y);
        return grp && grp.libertyCount > 1;
      });

      // 尝试触发“教学喂招”：故意走出能让小朋友练习门吃/抱吃/双打吃的棋形
      if (safeMoves.length > 0 && Math.random() < (rank.tactics.feedTesujiChance || 0)) {
        const feedMove = this.findPedagogicalFeedMove(engine, color, safeMoves);
        if (feedMove) return feedMove;
      }

      if (safeMoves.length > 0) {
        return safeMoves[Math.floor(Math.random() * safeMoves.length)];
      }
    }

    // 2. 全盘战术与启发式评估
    const evaluated = this.evaluateAllCandidates(engine, color, rank, isCaptureMode, isGentleMode);
    if (evaluated.length === 0) return null;

    // 根据段位提子概率与逃跑概率微调候选
    const best = evaluated[0];

    // 如果最佳步是提子，但低段位未通过 captureChance 检定，则退选次优非提子安全步
    if (best.captures > 0) {
      const takeChance = isGentleMode ? rank.tactics.captureChance * 0.65 : rank.tactics.captureChance;
      if (Math.random() > takeChance) {
        const nonCapture = evaluated.find(e => e.captures === 0 && e.score > -50);
        if (nonCapture) return nonCapture;
      }
    }

    // 围地模式下若最高分都是严重负分（全盘仅剩自填真眼或双活公气），AI 主动虚手 Pass
    if (!isCaptureMode && best.score < -120) {
      return null;
    }

    return best;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GoAI, RANKS };
}
