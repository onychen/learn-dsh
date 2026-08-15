# learn-dsh：拆解 DeepSeek Harness

> 仿照 [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) 的渐进式教学风格，
> 但**主线来自 DeepSeek Harness 自己的架构分层**，而不是照搬那 12 课。
> 温馨提醒，由于当前dsh暂时是 v0.1 开发者预览版，很多设计不一定完善，但我这个教程会持续跟随dsh的更新而更新的

## 这门课教什么

DeepSeek Harness（下称 **dsh**）的世界观和"一个 while 循环里不断加东西"截然不同。
它的骨架只有几条：

- **一切皆插件（Cordis）**：没有可打补丁的"特权核心"。模型适配器、工具注册表、
  会话日志、甚至 agent loop 本身都是插件，向共享的 `ctx` 贡献服务、类型化事件和可回退副作用。
- **仅追加的 SessionEvent 日志是唯一真源**：模型看到的历史不是单独存的，
  而是用 `deriveMessages()` 从事件日志**投影**出来的。"模型可见即已记录"。
- **Turn / Step 轮次**：`step` = 一次模型请求 + 它触发的工具调用；`turn` = 零或多个 step。
- **能力 seam**：一个可替换能力 = interface + implementation + consumer 三角色。
  换一个 provider 就能整体换掉产品的一块能力。
- **可选能力挂在 seam 上，不进 loop 主干**：subagent、compaction、skills、jobs、goal
  都是可选能力，各自是独立机制，不属于 agent loop 核心。

**和 learn-claude-code 最本质的区别**：原版是"循环不变、能力层层叠加"；
dsh 是"**内核极薄、一切经由插件树 + 事件 + seam 组合**"。
所以本课主线不是"往循环里塞功能"，而是"**先立起 Cordis 插件/事件/seam 这套骨架，
再逐层把每个能力作为插件挂上去**"。

## 课程地图（七主题 · 一条主线）

编号 L01–L22 是**一条连续的阅读主线**，下面七个主题只是给这条主线分段贴标签。
个别课（如 L22）编号靠后但概念归属较早的主题，已在括号里标注——按编号顺序读即可。

```text
主题 A · 内核骨架
  ├ L01  最小 Agent Loop
  ├ L02  Cordis 插件 + 可逆注册
  └ L03  四种事件分发
  ▼
主题 B · 会话即真源
  ├ L04  仅追加事件日志
  ├ L05  deriveMessages 投影
  └ L22  显式 Trace 查看   （扩展课·读侧对称面，依赖 L04/L05/L15）
  ▼
主题 C · 轮次与模型边界
  ├ L06  Turn / Step 生命周期
  ├ L07  pre-step 拦截
  └ L08  LLM 适配器与流式
  ▼
主题 D · 作用域与工具
  ├ L09  Scope 与 shadowing
  ├ L10  工具注册表
  ├ L11  工具执行管线与策略
  ├ L12  能力 seam
  └ L13  System Prompt 装配
  ▼
主题 E · 上下文的可持续性
  ├ L14  Skills 按需加载
  └ L15  Compaction 压缩
  ▼
主题 F · 委派与并发
  ├ L16  Subagent 上下文隔离
  ├ L17  Jobs 后台任务
  ├ L18  持久 Goal 领域
  └ L19  Goal Round Driver
  ▼
主题 G · 组装成产品
  ├ L20  Profile / Bundle
  ├ L21  Capstone 合成 mini-dsh
  └ 附录 X  持久化 / flush / 崩溃恢复   （仅讲义，无代码）
```

> **关于 L22 的编号**：它排在末尾，但概念上是主题 B（会话即真源）的**读侧对称面**，
> 依赖 L04 / L05 / L15。可以学完这三课后跳看，或按主线读到最后自然抵达。

## 22 课 motto 一览

| 课 | 主题 | Motto |
|---|---|---|
| L01 | 最小 Agent Loop | 一个循环 + 一次模型调用 + 一个工具，就是 agent 的胚胎 |
| L02 | Cordis 插件 + 可逆注册 | 不改核心，只在旁边挂插件；每个注册都能被回退 |
| L03 | 四种事件分发 | 能力调用走 `ctx.<service>`，观察/拦截/策略走事件 |
| L04 | 仅追加事件日志 | 不存消息历史，只存事件；一切皆可回放 |
| L05 | deriveMessages 投影 | 模型看到的是投影，不是存储；模型可见即已记录 |
| L06 | Turn/Step 生命周期 | step=一次请求+其工具；turn=零或多个 step，跑完才关 |
| L07 | pre-step 拦截 | 用 waterfall 在请求前改写或拒绝要进模型的消息 |
| L08 | LLM 适配器与流式 | 模型本身也是可替换的 provider |
| L09 | Scope 与 shadowing | 同名最具体者胜；作用域是 per-agent 人格的根 |
| L10 | 工具注册表 | 加一个工具，只加一个定义，循环不用动 |
| L11 | 工具执行管线与策略 | pre→guard→execute→post→result，策略挂在管线上而非工具里 |
| L12 | 能力 seam | 换一个 provider，就换掉产品的一整块能力 |
| L13 | System Prompt 装配 | 提示词不是一段字符串，是各插件贡献的段落 + 工具 schema |
| L14 | Skills 按需加载 | 用到什么知识再加载什么 |
| L15 | Compaction 压缩 | 日志从不删除，只追加一条 replace 事件把旧范围移出 surface |
| L16 | Subagent 隔离 | 每个子任务一份干净的上下文，只回传结果 |
| L17 | Jobs 后台任务 | Jobs 管生命周期，控制器负责把完成事实重新交回 Agent |
| L18 | 持久 Goal 领域 | 给会话挂一个持久目标，它是状态不是调度器 |
| L19 | Goal Round Driver | 目标未完成就再开一轮，直到完成或阻塞 |
| L20 | Profile / Bundle | 产品 = 有序层叠的插件树，任意一行都能被 patch 替换 |
| L21 | Capstone | 所有机制合一，对照真实 harness 看每层如何插在一起 |
| L22 | 显式 Trace 查看 | 一切皆事件，所以一切皆可显式回溯 |

## 怎么跑

需要 Python 3.10+，**无需 API key、无需联网**：每课内置一个确定性的 Replay LLM。

```powershell
# 从任意一课开始，每个文件都能独立运行
python lessons/L01_agent_loop/main.py
python lessons/L05_derive_messages/main.py
python lessons/L21_capstone/main.py
python lessons/L22_session_trace/main.py
```

## 网页版（推荐阅读方式）

讲义 + 源码另有一个**纯静态**网页版，形式类似 learn.shareai.run：
左侧按阶段分组导航，右侧课程时间线，点进去可切"讲义 / 源码"双标签。

```powershell
python site/build_site.py          # 改过讲义后重新生成数据
start site/index.html              # 双击也行，file:// 就能跑
```

零依赖、不需要 Node/npm、不需要联网。详见 [site/README.md](site/README.md)。

想接真实模型？需要**显式**开启（默认永远走 Replay，避免测试意外联网）：

```powershell
$env:DSH_LIVE = "1"                                   # 必须显式开启；缺 key 会直接报错
$env:DEEPSEEK_API_KEY = "sk-..."
$env:DEEPSEEK_BASE_URL = "https://api.deepseek.com"   # 可选
$env:DEEPSEEK_MODEL = "deepseek-chat"                 # 可选，默认 deepseek-chat
pip install requests                                   # 真实模型路径依赖
# 开启后任意"会调模型"的课都会走真实 API（缺 key 会直接报错）。
# 但请注意下面的局限：工具型 agent 课（L01/L21 等）不保证复现工具流程。
python lessons/L01_agent_loop/main.py
```

> **真实模型路径是可选彩蛋，定位有限，别期望它端到端跑工具**：
> - 它只证明"Replay 与真实 DeepSeek 是同一个 seam 的两个 provider"，并能做**纯文本**对话。
> - 本课的工具调用用的是**教学格式**（`{id,name,arguments}`），不是 DeepSeek/OpenAI 的
>   wire-format；各课也没把工具 schema 传给真实模型。所以像 L01/L21 这类工具型 agent，
>   真实模型**不保证**复现 Replay 的工具流程。把这条链路做成 API 兼容会引入大量适配复杂度，
>   偏离"离线教学"的初衷，故有意不做。**要完整体验工具型 agent，请用默认的 Replay。**
> - `DeepSeekLLM.stream()` 是"先 complete 再切片"的**模拟流式**，不是真 SSE。

## 课程定位（重要）

本课分两种形态，别用同一把尺子衡量：

- **L01–L13 是"渐进式主干"**：概念上后一课在前一课基础上叠一层，主线连续。
- **L14–L22 是"能力实验室"**：每课聚焦一个可选能力（Skills / Compaction / Subagent /
  Jobs / Goal / Trace 等），为了让单课能独立读懂、独立运行，各自搭建该机制的最小上下文，
  **不强求与上一课代码逐行 diff**。真实 dsh 里这些能力也是各自独立的 seam/包。
- **L21 Capstone** 整合的是"核心主干"那 8 层（ctx / 事件 / 日志 / 投影 / turn-step /
  llm seam / 工具管线 / subagent），不是全部 22 层——它是 headless profile 的教学缩影。

## 每课讲义结构

每课 `README.zh.md` 固定八段，**先跑再讲**：

1. **Motto** — 一句话主旨
2. **30 秒运行** — 命令 + 预期输出
3. **观察输出** — 你刚才看到了什么
4. **问题** — 为什么需要这一层
5. **心智模型** — 用一个比喻建立直觉
6. **方案与图** — 网页端渲染为流程、结构、对照或步骤式教学组件
7. **代码拆解** — 最小实现讲解
8. **相对上一课新增 + 简化了什么 vs 真实 dsh** — 附"教学类名 → 真实 `ctx` 服务/事件/包"映射表

## 重要免责声明

**本课的教学代码是玩具！！！！！，不是 dsh 的真实实现！！！！！。** dsh 本体用 TypeScript + Cordis 编写；
本课用 Python 让机制短小易读。每课第 8 段都会明确标出：本课简化了什么、真实工程里
那一层复杂度为什么必要。**一切以官方文档和源码为准**（见 `deepseek-harness/docs/`）。
