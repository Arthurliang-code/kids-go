# 萌宝少儿围棋 (Kids Go Master) - 智能体协作与开发规范 (AGENTS.md)

本文件是所有 AI Agent 参与本项目开发、维护、重构与功能迭代时的**强制性一贯准则**。任何代码修改在提交前均必须严格遵守以下规范与测试验证流程。

---

## 一、 项目核心原则与约束

1. **纯离线优先与无依赖性**：
   - 应用必须保持 100% 离线可用（PWA 离线缓存 + iPad 单文件独立版）。
   - 围棋规则引擎、AI 算路、棋形判断均在客户端纯本地运行，严禁引入不可靠的外部服务端接口依赖（如远程不可达的 `/api/tts` 等）。
2. **少儿与老人双重适老化设计**：
   - 界面字体必须保持大号易读（说明文字 ≥ 16px，标题 ≥ 19px）。
   - 触控按钮必须具备足够的最小高度（≥ 48px ~ 52px）和宽敞圆角，杜绝在 iPad 触控时的误触。
3. **“先教学再练习”的认知教学原则**：
   - 教学闯关模块在关卡加载或切关时，**必须默认展示【📖 原理图解】**，通过示范图与语音讲解先建立认知，再通过【开始动手】主按钮引导进入【🎯 动手闯关】练习。
4. **对弈沉浸体验与降噪准则**：
   - 人机对战应以专注思考为中心。默认取胜条件统一设定为**吃满 5 子获胜**（给予更充裕的中盘手筋与死活交锋空间）。
   - 普通打吃与吃子仅播放音效，不应有频繁弹窗或长语音强行打断对局；“学以致用”等教学联动仅在高阶手筋时以静默胶囊形式呈现。

---

## 二、 强制性测试与验证流程 (Testing & Verification Procedure)

在向用户汇报或执行 `git commit` / `git push` 前，必须按顺序执行以下六个步骤验证，确保全部通过：

### 1. 语法与模块编译检查 (Syntax & Runtime Check)
任何 JS 代码修改后，必须运行以下命令进行 Node.js 静态语法与全局上下文运行时模拟加载验证：
```bash
node -c js/go-engine.js && node -c js/puzzles.js && node -c js/ai.js && node -c js/voice.js && node -c js/app.js && node -c sw.js && node tests/browser_runtime.test.js
```
**标准**：退出码为 0，控制台无任何 SyntaxError，多脚本在同一全局作用域下无重名变量或标识符提升冲突。

### 2. 题库数据结构与规则引擎闭环验证 (Puzzle Integrity Test)
当修改或新增题库（如 `js/puzzles.js`）时，必须执行自动化脚本校验：
- **尺寸吻合**：所有关卡的 `initialBoard` 严格等于其 `boardSize`（5/7/9）。
- **字段完备**：必须具备 `id`, `title`, `playerColor`, `teachingSteps` (至少2步), `validMoves`, `explain`。
- **正解有效**：正解坐标 `validMoves` 在 `initialBoard` 对应的位置必须为空位，且落子后必须通过 `GoEngine.testMove()` 合法性检定。
- **教学图解**：每个 step 的 `board` 结构合法，`lines`、`markers` 坐标均在棋盘范围之内。

### 3. AI 战术引擎与实战手筋验证 (AI Tesuji Verification)
- 运行测试脚本验证 `GoAI` 的 12 项手筋探测器（双打吃、门吃、抱吃、飞枷、倒扑、接不归、挖断、真假眼、点眼破眼、滚打包收、双活公气、金鸡独立等）在对应测试盘面上识别准确率需达到 95% 以上。
- 模拟 18K 至 1D 级别自对弈 30 手以上，验证走子逻辑无死循环或非法走子异常。

### 4. 语音 TTS 资产与降级链路校验 (Audio Reliability Check)
- 验证所有关卡引用的音频片段（如 `p{id}_intro`, `p{id}_t1`, `p{id}_t2`, `p{id}_ans`, `p{id}_win`）均在 `assets/audio/` 存在对应 MP3，或具有严密的非阻塞静音降级机制。
- 严禁向不存在的本地 `/api/tts` 发送会导致 404 并在移动端吞掉声音的请求。
- 确认 Service Worker `sw.js` 与 `build_standalone.py` 包含对应关卡的语音映射。

### 5. 响应式布局与适老化大字号复核 (UI / UX Audit)
- 确认 `.pet-speech`、`.btn-fun`、`.score-box` 等组件在 375px（手机）、768px（标准 iPad）、1024px（iPad Pro 横竖屏）视口下均无挤出、截断或重叠。
- 检查阵营卡中角色名与“执黑/执白”胶囊徽章均完整可见，无 `...` 截断。

### 6. 离线单文件版与描述文件构建验证 (Build Verification)
代码提交前，必须运行：
```bash
python3 build_standalone.py
```
**标准**：
- 成功输出 `萌宝少儿围棋_iPad离线单文件版.html`（含全部 Base64 内嵌语音，大小约 17~25MB）。
- 成功输出 `KidsGo_iPad_Offline.mobileconfig`。
- 构建脚本执行退出码为 0，无正则转义或文件读写报错。

---

## 三、 代码提交与发布规范

1. **版本缓存同步**：修改 JS、CSS 或音频配置后，必须在 `sw.js` 中递增 `CACHE_NAME` 版本号（如 `kids-go-v11-...`）。
2. **Git Commit 规范**：使用规范的语义化提交信息：
   - `feat(...)`: 新功能（如新题库、新教学流程）
   - `fix(...)`: 缺陷修复（如样式截断、音频错误）
   - `refactor(...)`: 重构优化
   - `style(...)`: 纯样式美化调整
3. **安全提交**：Git 提交操作使用 `BypassSandbox: true`，提交后及时推送到远程仓库保证代码同步。

