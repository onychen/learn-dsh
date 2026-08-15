# L04 仅追加的 SessionEvent 日志

> **Motto：不存消息历史，只存事件；一切皆可回放。**

## 1. 30 秒运行

运行前先预测：如果系统同时保存 `messages` 和审计日志，而进程恰好在“更新 messages”之后、
“写审计日志”之前崩溃，恢复时应该相信哪一份？如果答不出来，说明系统存在两个真源。

```powershell
python lessons/L04_session_log/main.py
```

预期输出（节选）：

```text
===== 会话日志（仅追加，seq 连续）=====
  #0  user/message       {'content': '演示事件日志', 'source': 'human'}
  #1  assistant/message  {'text': '先执行一条命令。'}
  #2  tool/call          {'callId': 'c1', 'name': 'shell', ...}
  #3  tool/result        {'callId': 'c1', 'result': 'event\nsourcing'}
  #4  assistant/message  {'text': '任务完成。'}

===== 回放：从日志重新派生模型历史 =====
  user       '演示事件日志'
  assistant  '先执行一条命令。'
  tool       'event\nsourcing'
  assistant  '任务完成。'
```

## 2. 观察输出

agent 干的活还是没变。但状态的形态彻底变了：不再是一个会被覆盖的 `messages` 列表，
而是一条**只增不改的事件流**。每件发生过的事（说话、调工具、拿结果）都是日志里一条带
`seq` 的事件。最后我们用同一份日志重新"回放"出模型历史。

> 注意：本课**故意不引入 `turn`/`step` 事件**——那是 L06 的主题。这里只追加最基本的
> 四类事件（user/message、assistant/message、tool/call、tool/result），先把"仅追加日志"
> 这一件事讲透，避免过早引入尚未定义的轮次语义。

## 3. 为什么需要这一层

前三课的 `messages` 有个致命问题：它**既是给模型看的历史，又是唯一的状态**。
一旦你想 fork 会话、崩溃恢复、生成遥测、或者事后审计"当时到底发生了什么"，
一个可变列表根本扛不住。

dsh 的答案：**把"发生了什么"和"模型该看什么"彻底分开。** 前者是仅追加日志（本课），
后者是从日志派生出的投影（下一课 L05）。

最直觉但会坏掉的实现是：

```python
messages.append(new_message)       # 给模型看的状态
audit_log.append(new_message)      # 用于恢复和审计的状态
```

这两行之间总可能失败。加重试也会带来重复写入。真正的修复不是“把两次写操作做得更小心”，
而是只写一次权威事实：`session.append(event)`；`messages` 需要时再从事实计算。

**为什么先立日志、再讲 turn/step（L06）？** 因为一旦"唯一真源"确立，
后面每一层（轮次、压缩、fork、持久化）都只是"往日志追加事件"或"从日志派生"，
不必各自维护一份状态。日志是所有后续机制的地基。

## 4. 心智模型

把会话想成**银行账本**，而不是**账户余额**：

<!-- dsh:compare id=balance-vs-ledger title="不要保存余额，要保存账本" -->
- **账户余额（可变状态）** — `100` 被改成 `80` 后，变化过程消失，无法解释余额怎么来的。
- **交易账本（仅追加日志）** — 依次记录“存入 100、取出 20”，每笔都在，当前余额随时可以重算。
<!-- /dsh:compare -->

模型历史 = 账本上算出来的"当前余额"。账本本身永不修改。

## 5. 方案与图

<!-- dsh:flow id=session-log-flow title="Session 是循环的真源，messages 只是临时投影" variant=map -->
| ID | 节点 | 说明 | 下一步 | 位置 | 类型 |
|---|---|---|---|---|---|
| input | 接收用户输入 | 输入先变成事件，不直接修改一个长期 messages。 | user_event | 1,1 | |
| user_event | 追加 user/message | 把用户事实写进仅追加日志。 | session | 2,1 | |
| session | Session 事件日志 | 保存所有用户、助手、工具调用和结果，是唯一真源。 | derive | 3,1 | state |
| derive | 派生 messages | 每次请求模型前，从当前日志重新投影。 | model | 4,1 | |
| model | 请求模型 | 模型只读取投影结果，返回文本或工具调用。 | assistant_event | 5,1 | |
| assistant_event | 追加 assistant/message | 模型输出仍先回到日志，再判断是否需要工具。 | decide | 6,1 | |
| decide | 有工具调用吗？ | 没有就结束；有则执行并继续追加事件。 | tool[有], done[没有] | 7,1 | decision |
| done | 返回最终答复 | 日志保留完整过程，当前循环结束。 | - | 8,1 | terminal |
| tool | 追加 call 并执行 | 写入 tool/call 后执行对应工具。 | result | 7,3 | |
| result | 追加 tool/result | 工具观察写回日志，下一轮重新派生 messages。 | session[写回真源] | 3,3 | |
<!-- /dsh:flow -->

### 执行透视：日志如何取代可变 messages

<!-- dsh:trace id=l04-runtime-xray title="每个可观察事实都先落入唯一真源" -->
| 步骤 | 执行位置 | 发生什么 | 事件日志 | 模型视图 | 继续条件 |
|---|---|---|---|---|---|
| 记录输入 | `session.append("user/message")` | 用户输入先成为 seq=0 的不可变事实。 | `#0 user/message` | `naive_derive → [user]` | 模型尚未作出决策。 |
| 请求模型 | `llm.complete(naive_derive(session))` | 模型只读取临时投影，不持有日志。 | `#0 user/message` | `[user]` | 返回了 tool call。 |
| 记录回答 | `session.append("assistant/message")` | 模型文本先写日志。 | `#0 user; #1 assistant` | `[user, assistant]` | `turn.wants_tools == True`。 |
| 记录调用 | `session.append("tool/call")` | 在执行外部动作前，先留下调用事实和 callId。 | `#0…#2 tool/call(c1)` | `[user, assistant]` | 工具尚未产生结果。 |
| 记录结果 | `session.append("tool/result")` | shell 观察作为 seq=3 追加，旧事件完全不动。 | `#0…#3 tool/result(c1)` | `[user, assistant, tool]` | 新观察需要交给模型。 |
| 记录收尾 | `session.append("assistant/message")` | 第二次模型调用给出最终文本。 | `#0…#4 assistant` | `[user, assistant, tool, assistant]` | 无工具调用，循环退出；日志可重新投影。 |
<!-- /dsh:trace -->

## 6. 代码拆解

- `SessionEvent` 用 `frozen=True`：事件不可变，写入即定。
- `Session.append(type, data)`：`seq = len(events)`，保证连续且单调。**只有 append，没有 update/delete。**
- `run()`：把 L01 的"追加消息"全换成"追加事件"——`user/message`、
  `assistant/message`、`tool/call`、`tool/result`（本课故意不含 turn/step，见 L06）。
- `naive_derive()`：本课临时的粗糙投影，L05 升级为正规 `deriveMessages`。

### 动手验证不变量

尝试给 `Session` 增加一个 `update(seq, data)`，然后问自己：回放时还能否证明“当时模型看到的
就是现在重建出的内容”？答案是否定的。这正是仅追加约束保护的东西：**历史事实不能被事后改写。**

## 7. 代码解读：可变历史如何被单一事件流取代

<!-- dsh:code-walkthrough id=l04-code-reading title="一次事实从 append 到重新回放" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| 用类型冻结一条历史事实 | 32-35 | `SessionEvent` 同时保存顺序、类型和完整数据，`frozen=True` 禁止字段重新赋值。 | 回放必须面对“当时发生的事实”，而不是后来被修改过的对象；不可变是可审计的前提。 |
| 只暴露 append 和快照读取 | 38-56 | `seq` 由当前长度生成，事件只追加到尾部；`events()` 返回副本而不是内部列表。 | 连续 seq 给事件稳定身份，复制列表防止调用方绕过 API 删除或重排权威历史。 |
| 投影是读侧临时计算 | 63-73 | `naive_derive` 遍历事件，挑出模型需要的三类内容，既不修改事件也不缓存第二份长期状态。 | messages 可以随时丢弃重算；只要事件日志还在，模型视图就能恢复。L05 会把这些规则正规化。 |
| 所有外部变化先落日志 | 76-93 | 用户、assistant、tool call 与 result 都通过 `session.append` 记录；每轮模型调用前重新 derive。 | 单一写路径消除了“messages 已更新但审计日志没写成”的双写窗口，模型可见内容也都有来源。 |
| 用同一份日志证明可回放 | 108-120 | 任务结束后不复用旧 messages，而是再次调用 `naive_derive(session)` 打印历史。 | 可回放不是备份功能，而是投影函数对权威日志的自然结果；进程内临时视图不再重要。 |
<!-- /dsh:code-walkthrough -->

## 8. 相对上一课新增了什么

L01-L03 的状态是可变 `messages` 列表。本课把它替换成**仅追加的 `SessionEvent` 日志**，
并证明"同一份日志可重复回放出相同历史"。这是全套课程最有辨识度的转折点。

## 9. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| 内存 list，进程退出就没了 | `ctx.sessions` + 持久化 seam（JSONL/后端），崩溃可恢复 | 会话要跨进程存活、可恢复（见附录 X） |
| 事件类型 5~6 种 | `SessionEventMap`，可用**声明合并**扩展（compaction、hook 等各自加事件） | 新的模型可见输入必须先加事件类型，不能塞临时变量 |
| `data` 是任意 dict | 每条事件是 lossless JSON，`append` 运行时校验 `isJsonValue` | 日志要能逐字节存储与回放，非法数据在源头被拒 |
| `naive_derive` 内联 | `deriveMessages()` 独立纯函数（L05） | 投影逻辑要被回放、fork、遥测复用 |
| 无 surface/记账区分 | 事件分 surface（进模型）与 log-only（记账），`assistant/chunk` 保留 token 级回放 | UI 保真、usage 记账、compaction 的 shadow 都靠这个区分 |

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `Session` | `ctx.sessions` 里的 `Session`（`core/session`） |
| `SessionEvent` | `SessionEvent` / `SessionEventMap` |
| `append` | `Session.append`（仅追加不变式） |
| `naive_derive` | `deriveMessages()`（见 L05） |

---
[← 返回总览](../../README.md) · [下一课 L05 →](../L05_derive_messages/README.zh.md)
