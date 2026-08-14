# L04 仅追加的 SessionEvent 日志

> **Motto：不存消息历史，只存事件；一切皆可回放。**

## 1. 30 秒运行

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

<!-- dsh:stepper id=session-log-flow title="事件先记账，模型历史再派生" -->
1. **接收输入** — `run(session, ...)` 开始处理一次请求。
2. **追加用户事件** — 写入 `user/message`，从不覆盖旧事件。
3. **追加执行事件** — assistant、tool/call 和 tool/result 依次进入同一日志。
4. **派生消息** — `naive_derive(session)` 从事件拼出模型需要的 messages。
5. **请求模型** — `llm.complete(messages)` 只读取派生结果。
<!-- /dsh:stepper -->

## 6. 代码拆解

- `SessionEvent` 用 `frozen=True`：事件不可变，写入即定。
- `Session.append(type, data)`：`seq = len(events)`，保证连续且单调。**只有 append，没有 update/delete。**
- `run()`：把 L01 的"追加消息"全换成"追加事件"——`user/message`、
  `assistant/message`、`tool/call`、`tool/result`（本课故意不含 turn/step，见 L06）。
- `naive_derive()`：本课临时的粗糙投影，L05 升级为正规 `deriveMessages`。

## 7. 相对上一课新增了什么

L01-L03 的状态是可变 `messages` 列表。本课把它替换成**仅追加的 `SessionEvent` 日志**，
并证明"同一份日志可重复回放出相同历史"。这是全套课程最有辨识度的转折点。

## 8. 简化了什么 vs 真实 DeepSeek Harness

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
