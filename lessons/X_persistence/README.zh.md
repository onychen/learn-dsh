# 附录 X：持久化 / flush / 崩溃恢复

> 这是**进阶附录**，不属于最小主线。前 21 课的会话日志都活在内存里，进程退出就没了。
> 真实产品需要让会话**跨进程存活、崩溃可恢复**。本附录只做概念对照，不含可运行代码
> （它的复杂度更适合读官方文档，而非教学玩具）。

## 为什么主线里没有它

L04 确立了"仅追加事件日志是唯一真源"。持久化回答的是一个**正交问题**：
这份日志**如何落盘、何时落盘、崩溃后如何恢复**。把它塞进主线会分散对"事件溯源"
本身的注意力，所以我们把它单独拎出来。

好消息是：正因为 L04 把"真源"设计成一份仅追加日志，持久化才变得简单——
**只要把这份日志逐字节存下来，恢复时重新加载 + `deriveMessages`（L05）即可。**
持久化不需要理解业务语义，它只搬运事件。

## 三个核心问题

**① 存什么**

存那份仅追加的 `SessionEvent` 日志本身，逐字节、无损。因为每条事件都是 lossless JSON、
`seq` 连续，所以可以直接序列化成 JSONL（一行一个事件），无需额外结构。

```text
session-abc.jsonl
  {"seq":0,"type":"turn/start","data":{"turn":0}}
  {"seq":1,"type":"user/message","data":{"content":"..."}}
  {"seq":2,"type":"assistant/message","data":{...}}
  ...
```

**② 何时 flush**

不是每条事件都立刻落盘（太慢），也不能攒太久（崩溃丢太多）。真实 dsh 由
`dsh-session-checkpoint-policy` 拥有"每请求的持久化检查点"——在合适的边界
（如一次模型请求完成）把新事件刷盘。agent loop **不**在 turn 边界等待 flush；
需要读存储的消费方在 `whenIdle()` 后自己 flush。

**③ 崩溃后如何恢复**

重新加载 JSONL → 得到事件列表 → `deriveMessages`（L05）投影出模型历史 → 继续。
因为日志是唯一真源且仅追加，恢复不需要"重放业务逻辑"，只需重新加载事件。

```text
崩溃 → 重启 → 读 session-abc.jsonl → 事件列表 → deriveMessages → 继续对话
              （seq 连续性校验：确保没缺页）
```

## 与主线各课的关系

| 主线机制 | 持久化如何依赖它 |
|---|---|
| L04 仅追加日志 | 持久化只需搬运这份日志；仅追加保证可逐字节存储 |
| L05 deriveMessages | 恢复时用它从加载的事件重建模型历史 |
| L15 compaction | 压缩是"追加 replace 事件"，持久化照样存；恢复后 shadow 仍生效 |
| L02 可逆注册 | 持久化后端是一个 provider，可换（本地 JSONL / 数据库 / 远程） |

## 简化了什么 vs 真实 DeepSeek Harness

| 概念对照 | 真实 dsh | 为什么需要 |
|---|---|---|
| 逐字节存日志 | 持久化 seam + 多后端（JSONL / 其他） | 后端可换，测试用内存、生产用磁盘 |
| 每请求 checkpoint | `dsh-session-checkpoint-policy` | 平衡"落盘频率"与"崩溃丢失量" |
| seq 连续性 | 运行时不变式断言 + `session/end-seed` 标记 | 区分 seed 历史（resume/fork）与本次 live 事件 |
| 简单重载 | fork / resume 从存储重建，冷恢复子 agent | 会话可分叉、可跨会话恢复 |

## 想深入？

阅读官方文档（以源码为准）：

- `deepseek-harness/docs/subsystems/persistence.md` — 持久化 seam 与后端
- `deepseek-harness/docs/subsystems/session.md` — 日志与 `firstLiveSeq`/`session/end-seed`
- `deepseek-harness/docs/subsystems/storage.md` — 存储抽象

---
[← 上一课 L21](../L21_capstone/README.zh.md) · [返回总览](../../README.md)
