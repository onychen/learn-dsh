# L22 显式 Trace：把事件日志查出来

> **Motto：一切皆事件，所以一切皆可显式回溯。**

## 1. 30 秒运行

运行前先猜：trace 一条 shadowed tool/result 时，应该只告诉你“当前不可见”，还是继续指出哪条
摘要替换了它？assistant/message 引用 chunks 的关系，应从 message 反查还是写入时记录？

```powershell
python lessons/L22_session_trace/main.py
```

预期输出（节选）：

```text
===== read：读全部事件 + surface 三态 =====
  #1  user/message         [shadowed ] ○被压缩遮蔽
  #4  assistant/message    [shadowed ] ○被压缩遮蔽
  #5  tool/call            [log-only ] ·记账事件
  #9  user/message         [current  ] ●在模型上下文

===== trace #6（一条被压缩遮蔽的 tool/result）：谁替换了它 =====
  被替换 (replacedBy): 9  ← 摘要事件 #9
  替换链 (replacementChain): [9]

===== trace #9（那条压缩摘要）：它遮蔽了哪些事件 =====
  它替换掉的事件 (replacedEventSeqs): [1, 2, 3, 4, 5, 6, 7]  ← 旧的 1..7
```

## 2. 观察输出

`read` 给每条事件标了 **surface 三态**：`current`（在模型上下文）、`shadowed`（被压缩遮蔽）、
`log-only`（记账）。`trace #4` 追出它引用的两条 chunk；`trace #6` 追出它被摘要 #9 替换；
`trace #9` 反过来列出它遮蔽掉的旧范围 1..7。被遮蔽的事件**一条没删**，因果链随时可查。

## 3. 为什么需要这一层

前 21 课一路在讲**写侧**：往日志追加事件（L04）、投影给模型看（L05）、用压缩遮蔽旧范围（L15）。
但从没讲**读侧**——怎么反过来查询、追溯、搜索这份日志。

这正是 dsh 事件溯源设计**最受称赞**的兑现点：因为一切皆事件、日志是唯一真源，
所以任意一条事件的因果关系都能被**显式追出来**——它从哪来（引用了哪些来源）、
到哪去（被谁引用/替换）、现在处于什么状态。debug、审计、agent 自查历史，全靠它。

## 4. 心智模型

trace 就是给事件日志装了一套**监控回放 + 关系图谱**：

<!-- dsh:compare id=trace-read-write title="同一份事件日志的写侧与读侧" -->
- **写侧：形成事实** — append 事件、deriveMessages 投影、compaction 遮蔽共同维护会话真源。
- **读侧：理解事实** — read 倒带每一帧，search 按关键词跳转，trace 追踪前因后果。
<!-- /dsh:compare -->

每条事件像监控录像里的一帧：既能顺序回放，也能点开某一帧问"它是谁触发的、后来被什么覆盖了"。

## 5. 方案与图

<!-- dsh:flow id=trace-analysis title="以目标事件为中心，向四个方向追溯关系" variant=map -->
| ID | 节点 | 说明 | 下一步 | 位置 | 类型 |
|---|---|---|---|---|---|
| read | read(seq) | 按序读取事件并附上当前 surface 状态。 | target | 1,2 | |
| search | search(query) | 先定位可能相关的事件，再选择一条深入 trace。 | target | 1,3 | |
| fold | foldSurface | 用完整日志判断目标是 current、shadowed 还是 log-only。 | target[标注状态] | 2,1 | |
| target | 目标事件 | trace 的中心观察点，所有关系都围绕它展开。 | sources[sourceEventSeqs], derived[derivedEventSeqs], replaced[replacedEventSeqs], replacer[replacedBy] | 3,2 | state |
| sources | 上游来源事件 | 目标事件直接引用了哪些事实。 | - | 5,1 | |
| derived | 下游派生事件 | 哪些后续事件把目标 seq 当作来源。 | - | 5,2 | |
| replaced | 被目标替换的范围 | 当目标带 replace 时，它遮蔽了哪些旧事件。 | - | 5,3 | |
| replacer | 替换目标的事件链 | 从 replacedBy 继续追到最终 replacementChain。 | - | 3,4 | terminal |
<!-- /dsh:flow -->

### 执行透视：trace #6 如何恢复一条被遮蔽结果的因果位置

<!-- dsh:trace id=l22-runtime-xray title="surface 状态与因果边是两个独立索引" -->
| 步骤 | 执行位置 | 发生什么 | Target #6 | Surface 索引 | Causal / replacement 关系 |
|---|---|---|---|---|---|
| 构建查询快照 | `SessionQuery.__init__` | 复制事件并计算三态。 | `tool/result c1` | `#6=shadowed` | 尚未追踪。 |
| 初始化结果 | `trace(6)` | 创建固定结构 result。 | type 与 surface 已填。 | 只读。 | 关系字段为空。 |
| 扫来源引用 | `source_event_seqs` | 查找谁直接引用 #6。 | 无直接 derived。 | 不变。 | `derived=[]` |
| 检查自身 replace | `target.surface_op` | #6 是普通 append。 | 不替换别人。 | shadowed。 | `replacedEventSeqs=[]` |
| 查找替换者 | `start <= cur <= end` | 摘要 #9 覆盖 #6。 | 原始 result 仍在。 | 状态得到解释。 | `replacedBy=9; chain=[9]` |
| 返回 trace | `return result` | 同时得到事实、可见性与因果位置。 | 原事件未删除。 | shadowed。 | 可继续 trace #9。 |
<!-- /dsh:trace -->

## 6. 代码拆解

- `fold_surface()`：给每条事件算 `current/shadowed/log-only`——和 L05/L15 同一套 surface 概念的读侧复用。
- `SessionQuery.read()`：按 seq 范围读，附 surface 态。
- `SessionQuery.search()`：字面量全文搜（忽略大小写），返回命中事件及其 surface 态。
- `SessionQuery.trace()`：四条关系——`sourceEventSeqs`（引用的来源）、`derivedEventSeqs`（被谁引用）、
  `replacedEventSeqs`（自己遮蔽了谁）、`replacedBy`+`replacementChain`（被谁一路替换）。
- `build_session()`：造一段含 chunk→message 引用 + 一次压缩遮蔽的真实日志。

### 动手破坏一次

删除 assistant/message 的 `source_event_seqs=[2,3]`，再 trace #4。文本仍存在，但无法证明它由
哪些 chunks 合成。这验证：**因果边必须在事实产生时记录，读侧无法可靠猜回来源。**

## 7. 代码解读：显式 Trace 如何由两类关系拼成

<!-- dsh:code-walkthrough id=l22-code-reading title="surface 折叠、反向引用与替换链" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| append 校验关系所属事件 | 48-64 | 只有 surface event 可带 surface_op/source_event_seqs，其他类型携带即 assert。 | 因果元数据与 surface 语义绑定在写入边界，避免记账事件伪装成模型内容来源。 |
| fold_surface 独立算可见性 | 70-86 | 第一遍收集 replace 范围，第二遍标 current、shadowed 或 log-only。 | 当前是否可见是投影关系，不等于事件是否存在，也不等于因果引用。 |
| read/search 复用同一索引 | 92-107 | Query 冻结事件快照；范围读取与搜索都附预计算状态。 | 不同读 API 对同一事件必须报告一致可见性，集中索引防止规则漂移。 |
| trace 构造正向与反向边 | 110-132 | target 自带 sources；扫描全部事件得到 derived；replace target 还展开范围。 | 日志保存正向引用，反向引用可确定性派生，不维护第二份易失同步的图。 |
| replacementChain 逐级追踪 | 134-149 | 从 target 寻找覆盖当前节点的 replace，再把 replacer 作为新 cur。 | 摘要可能再次被摘要；只返回直接 replacer 会丢失最终 surface 来源。 |
| build_session 写入因果证据 | 152-170 | message 引用 chunks，摘要 replace 1…7。 | Trace 不是读侧魔法，它依赖写侧保存 lossless 事实与关系。 |
<!-- /dsh:code-walkthrough -->

## 8. 相对上一课新增了什么

前面所有课都是"写日志 + 投影给模型"。本课补上**读侧对称面**：一个迷你 `sessionQuery`，
能 read / search / trace，并显式标注 surface 三态、追出事件间的引用与替换因果链。
它是 L04（真源）+ L05（投影规则）+ L15（shadow）三条线的读侧收束。

## 9. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| 内存扫全表搜索 | `ctx.sessionQuery` seam + SQLite provider 全文索引 | 海量历史要快速全文检索 |
| 单个会话 | 逻辑会话语料库，跨会话、live 优先于 persisted | fork/resume 后要跨会话追溯 |
| 三态直接算 | `foldSurface()` 与 `deriveMessages` 同一状态机，原子观测快照 | 读一致性：trace 与模型看到的必须一致 |
| trace 直接返回 seq | `SessionEventTrace` 完整字段 + `SessionEventTraceObservation` 绑定 header | 追溯要绑定确切的会话观测版本 |
| 无授权 | trace/search 有授权校验、封闭错误 code 分类 | 一个 agent 不能随意查别人的会话 |
| 无面向模型工具 | 5 个工具：`session_event_read/search/trace`、`session_search`、`session_trace` | agent 能主动回查自己和历史会话 |

> **对照点**：真实 dsh 里 subagent 之间不自动共享 transcript（L16），正是靠 `sessionQuery`
> 显式追溯——父 agent 想看子会话发生了什么，用 trace 工具查，而非把子会话塞进上下文。

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `SessionQuery` | `ctx.sessionQuery`（`session-query/session-query`） |
| `fold_surface` | `foldSurface()`（与 `deriveMessages` 共用状态机） |
| `read` / `search` / `trace` | `session_event_read` / `session_event_search` / `session_event_trace` |
| surface 三态 | `SessionEventSurface`：`current`/`shadowed`/`log-only` |
| `trace` 的 chain/source | `SessionEventTrace.replacementChain` / `sourceEventSeqs` / `derivedEventSeqs` |

---
[← 上一课 L21](../L21_capstone/README.zh.md) · [返回总览](../../README.md) · [附录 X →](../X_persistence/README.zh.md)
