# L17 Jobs：慢操作丢后台，agent 继续想

> **Motto：Jobs 管生命周期，控制器负责把完成事实重新交回 Agent。**

## 1. 30 秒运行

运行前先判断：后台线程完成后，是 JobRegistry 直接写 agent.inbox，还是只发完成通知？agent
仍在运行与已经空闲时，结果应走同一种交付方式吗？

```powershell
python lessons/L17_jobs/main.py
```

预期输出（节选）：

```text
===== agent 把慢操作丢后台，立刻继续 =====
  agent 拿到 bash-1，不等它，继续想下一步...
  [agent] 我先去分析别的文件（后台任务并行跑着）

===== agent 忙完停下，变为空闲 =====
    [控制器→followup] 唤醒 agent 新一轮处理: '[后台任务 bash-1 完成] npm run build → 构建成功，0 error'

===== agent 的 inbox（完成事实已由控制器交回）=====
  [后台任务 bash-1 完成] npm run build → 构建成功，0 error
```

## 2. 观察输出

agent 把 `npm run build` 丢后台，立刻拿到 `bash-1` 继续干别的（不傻等）。
后台任务完成后，**控制器**（不是 jobs 注册表自己）根据 agent 当时的状态，
选择 `followup` 唤醒它处理这个完成事实。

## 3. 为什么需要这一层

编译、跑测试、下载都很慢。agent 傻等就浪费了"继续想下一步"的时间。

**Jobs 把慢操作丢后台**：agent 立刻拿 job id 继续，任务完成后再把结果送回。
但这里有个常见误解要纠正——**不是 jobs 注册表自己把结果写回会话**。
职责是分离的：Jobs 管生命周期与身份；**控制器（consumer）** 监听完成事件，
再根据 owner agent 的状态决定用 `inject`（塞下一次请求）还是 `followup`（唤醒新一轮）。

## 4. 心智模型

Jobs 就像**餐厅的取餐器**：

<!-- dsh:stepper id=job-pager title="后台任务像餐厅取餐器" -->
1. **点餐** — `start job` 创建后台工作并立即返回 job id。
2. **拿取餐器** — agent 保存 job id，不必停在原地等待，可以继续当前思考。
3. **后厨完成** — JobRegistry 更新生命周期并触发 onJobDone。
4. **服务员判断** — 控制器查看 agent 当前忙闲状态。
5. **完成交付** — 空闲就 followup 唤醒；忙碌就 inject，等下一轮自然带入。
<!-- /dsh:stepper -->

后厨（jobs）不管你坐哪桌；服务员（控制器）才负责把餐送到对的人。

## 5. 方案与图

<!-- dsh:flow id=job-delivery-flow title="生命周期与交付控制分离" -->
| ID | 节点 | 说明 | 下一步 |
|---|---|---|---|
| start | JobRegistry.start | 创建身份并让 work 在后台运行；注册表不碰会话 | work |
| work | 后台工作 | 完成后通知所有 on_done 订阅者 | controller |
| controller | 交付控制器 | 根据 agent 是否空闲选择交付方式 | followup[空闲], inject[忙碌] |
| followup | followup | 立即唤醒 agent，开启新一轮处理结果 | - |
| inject | inject | 将结果排入上下文，等待下一轮消费 | - |
<!-- /dsh:flow -->

### 执行透视：生命周期事实怎样被控制器路由回 owner

<!-- dsh:trace id=l17-runtime-xray title="JobRegistry 与 Agent 之间没有直接写入" -->
| 步骤 | 执行位置 | 发生什么 | Job 状态 | Agent 状态 / inbox | 交付责任方 |
|---|---|---|---|---|---|
| 启动任务 | `registry.start` | 创建 bash-1 并启动线程。 | `running; result=None` | `idle=False; inbox=[]` | Registry 只返回 id。 |
| agent 继续 | `start` 立即返回 | 主线程分析其他文件。 | 后台 running。 | agent 忙碌。 | 无交付。 |
| agent 停下 | `idle=True` | owner 在完成前进入空闲。 | 仍可能 running。 | idle=True。 | Controller 等通知。 |
| worker 完成 | `runner()` | 写 result，status 变 completed。 | `completed; 构建成功` | 尚未写 inbox。 | Registry 调 on_done。 |
| 控制器判路由 | `on_job_done` | 读取 owner 当前状态。 | 不变。 | idle=True。 | Controller 选择 followup。 |
| 唤醒新一轮 | `agent.followup` | 完成事实入 inbox，并置 idle=False。 | 生命周期结束。 | inbox=[完成事实] | Agent 被唤醒。 |
<!-- /dsh:trace -->

## 6. 代码拆解

- `JobRegistry.start()`：登记 job，起后台线程跑 `work`，完成后**只通知订阅者**——它不碰会话。
- `JobRegistry.on_done()`：控制器在这里订阅。
- `Agent.inject()` / `followup()`：两种把完成事实交回 agent 的方式。
- `make_controller()`：**控制器**——按 `agent.idle` 选择 `followup`（已停下）或 `inject`（还在忙）。

### 动手破坏一次

让 `JobRegistry.runner` 直接引用 agent 并写 inbox。再把同一 registry 给两个 owner 共用，生命周期
层将不得不理解会话路由。这验证：**Jobs 管身份和状态，consumer 才知道结果属于谁。**

## 7. 代码解读：后台执行与结果交付为何拆成两层

<!-- dsh:code-walkthrough id=l17-code-reading title="Job 完成不等于 Agent 已经看到" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| Job 只描述生命周期事实 | 28-32 | id、label、status 与 result 构成记录。 | Job 不保存 agent/session 引用，才能被查询、持久化并在不同 consumer 间复用。 |
| Registry 收敛成功与失败 | 35-64 | start 分配 id，线程更新状态，最后只遍历 on_done callbacks。 | 无论 work 成功或抛错都形成终态通知；Registry 不决定错误如何呈现给用户。 |
| Agent 明确两种输入动作 | 71-82 | inject 只排队；followup 还把 idle 改为 False。 | “下一 step 看见”与“另开一轮处理”调度语义不同，不能都简化成 append inbox。 |
| Controller 理解 job 与 owner | 85-93 | 回调格式化 Job，再按 agent.idle 选择交付方式。 | 只有 consumer 同时拥有两个领域上下文，因此路由放这里不会污染底层服务。 |
| 示例制造完成时序差 | 96-118 | agent 先忙、后 idle，job 更晚完成，稳定触发 followup。 | 后台 bug 多来自时间关系；显式序列让“完成时 owner 状态”成为可观察条件。 |
<!-- /dsh:code-walkthrough -->

## 8. 相对上一课新增了什么

前面的工具都是同步跑完才返回。本课引入 **Jobs 后台运行时**：慢操作丢后台、
agent 不阻塞，并明确 **Jobs（生命周期）与控制器（交付）的职责分离**。

## 9. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| Python 线程 | `ctx.jobs` 运行时，生产方拥有执行资源 | bash/subagent 等多种 job kind 统一管理 |
| `on_done` 回调 | consumer 监听 `onJobDone`，按 owner 状态 inject/followup | 交付方式取决于 agent 实时状态 |
| 无访问控制 | job 访问按 owner session id 围栏，agent 释放时取消并 await | 一个 agent 不能碰别人的 job |
| status 三态 | running/stopping/completed/killed/failed + `detail` | 精细的生命周期与停止语义 |
| 无 job 工具 | `job_*` 工具收集/停止后台任务 | 模型能主动查询和终止后台任务 |

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `JobRegistry` | `ctx.jobs`（`jobs/jobs`） |
| `make_controller` | `tool-jobs` consumer / 控制器 |
| `inject` / `followup` | `agent.inject()` / `agent.followup()` |
| `Job.id` = `kind-N` | `JobId`（`<kind>-N` 品牌化 id） |

---
[← 上一课 L16](../L16_subagent/README.zh.md) · [返回总览](../../README.md) · [下一课 L18 →](../L18_goal/README.zh.md)
