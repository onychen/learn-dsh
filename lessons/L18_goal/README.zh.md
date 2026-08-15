# L18 持久 Goal 领域

> **Motto：给会话挂一个持久目标，它是状态不是调度器。**

## 1. 30 秒运行

```powershell
python lessons/L18_goal/main.py
```

预期输出（节选）：

```text
===== 挂一个目标 =====
  当前: {'phase': 'active', 'text': '把仓库里所有失败的测试修绿', 'revision': 1, ...}

===== 中途遇到障碍 → blocked（带机器可路由的 code）=====
  当前: {'phase': 'blocked', ..., 'block': {'code': 'needs-approval', ...}}

===== 目标的真源是事件日志（折叠得到状态）=====
  #0 goal/change {'phase': 'active', ...}
  #1 goal/change {'phase': 'blocked', ...}
  #3 goal/change {'phase': 'complete', ...}
  → revision=4：每次变更 +1，用于 compare-and-set
```

## 2. 观察输出

一个目标经历 active → blocked → active → complete。每次变更都追加一条 `goal/change`
事件，当前状态由这些事件**折叠**得到；`revision` 每次变更 +1。阻塞时带一个
机器可路由的 `code`。

## 3. 为什么需要这一层

有些会话有一个跨多轮的大目标（"把测试全修绿"）。需要一个地方记录：目标是什么、
现在什么阶段、改了几次、为什么阻塞。

**但要害是：Goal 只是状态，不是调度器、不是另一条对话线。** 它复用 L04 的事件溯源——
真源仍是日志，状态靠折叠。这一课只讲"状态怎么记"；"谁来驱动续跑"是下一课 L19 的事。
把这两层分开，是理解 goal 的关键。

## 4. 心智模型

Goal 就像项目的**里程碑状态牌**，不是**催办的人**：

<!-- dsh:compare id=goal-vs-driver title="状态与调度是两种职责" -->
- **Goal 领域：里程碑状态牌** — 记录目标文本、active/blocked/complete 阶段和 revision，只回答“现在是什么状态”。
- **Round Driver：催办的人** — 读取状态；发现目标仍 active 时才安排“再干一轮”，它属于下一课。
<!-- /dsh:compare -->

状态牌只记录，不催办。两者分工。

## 5. 方案与图

<!-- dsh:flow id=goal-domain-flow title="命令只追加事件，当前 Goal 由日志折叠得到" variant=map -->
| ID | 节点 | 说明 | 下一步 | 位置 | 类型 |
|---|---|---|---|---|---|
| set | set_goal(text) | 创建目标或解除阻塞，写入 phase=active。 | change[追加事件] | 1,1 | |
| block | block(code,msg) | active 遇到外部阻碍时写入 phase=blocked 和原因。 | change[追加事件] | 1,2 | |
| complete | complete() | active 达成后写入 phase=complete。 | change[追加事件] | 1,3 | |
| change | goal/change | 每次状态变化都只追加事件，不原地修改 Goal 对象。 | log | 2,2 | |
| log | Goal 事件日志 | 它才是目标状态的持久真源。 | fold | 3,2 | state |
| fold | 按 seq 折叠 | 依次合并所有 change，并让 revision 每次加一。 | snapshot | 4,2 | |
| snapshot | 当前 snapshot | 读取 phase、text、block 和 revision；它本身不驱动续跑。 | active[active], blocked[blocked], completed[complete] | 5,2 | decision |
| active | 可继续推进 | 之后可以 block 或 complete。 | block[遇到阻碍], complete[目标达成] | 6,1 | |
| blocked | 等待外部解除 | 只能由新的 set_goal 重新激活。 | set[重新激活] | 6,2 | |
| completed | 已完成 | 终态；Goal 只记录这个事实。 | - | 6,3 | terminal |
<!-- /dsh:flow -->

## 6. 代码拆解

- `GoalDomain._append()`：每次变更追加一条 `goal/change` 事件（仅追加，同 L04）。
- `set_goal` / `block` / `complete`：三种变更，写入不同 phase。
- `snapshot()`：把所有事件**折叠**成当前状态，`revision = seq + 1`。
- `block` 带 `code`（机器可路由）+ `message`（给人看）。

## 7. 相对上一课新增了什么

前面的会话没有"跨多轮的显式目标"。本课引入 **持久 Goal 领域**：用事件溯源记录
目标状态（active/blocked/complete）与 revision，并强调它是"状态而非调度器"，
为 L19 的续跑驱动打基础。

## 8. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| active/blocked/complete | 还有 **paused** 阶段 | 目标可被人工暂停而非阻塞 |
| revision 简单 +1 | `GoalRef` compare-and-set，每次持久变更递增 | 并发变更要靠 revision 防冲突 |
| 折叠成一个 dict | `GoalSnapshot` 完整字段 + goal-round 上限 | 续跑要有轮次上限防失控 |
| 无激活状态 | 持久 phase 与**进程本地激活**分离 | resume/fork 后需人工重新授权才自动续跑 |
| domain 独立 | goal 领域 + goal-round-driver 拆开（见 L19） | 状态与驱动是两层机制 |

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `GoalDomain` | `ctx.goals`（`goal/goal`，core service） |
| `goal/change` | 同名事件 |
| `snapshot()` | `GoalSnapshot` |
| `block(code,message)` | `GoalBlockReason` |

---
[← 上一课 L17](../L17_jobs/README.zh.md) · [返回总览](../../README.md) · [下一课 L19 →](../L19_goal_driver/README.zh.md)
