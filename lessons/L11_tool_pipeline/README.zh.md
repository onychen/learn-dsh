# L11 工具执行管线与策略

> **Motto：pre → guard → execute → post → result，策略挂在管线上而非工具里。**

## 1. 30 秒运行

```powershell
python lessons/L11_tool_pipeline/main.py
```

预期输出（节选）：

```text
### 单个工具穿过管线
    tool/call echo({'text': 'the secret is 42'})
    tool/result echo → 'the *** is 42'          ← post 改写脱敏
    tool/call shell({'command': 'rm -rf /'})
      pre-execute: 拒绝 shell                     ← pre 权限拒绝
    tool/call sleep(...)  execute: sleep 超时       ← 超时策略

### 一批工具：并发安全的用 parallel 同时执行
  [并发批] 2 个并发安全工具用 parallel 同时执行
    tool/result fetchB → 'fetched:B'             ← B 更快先完成
    tool/result fetchA → 'fetched:A'
  [顺序] write 非并发安全，单独执行
```

## 2. 观察输出

同一条管线处理了四种情况：结果被 post 钩子**脱敏**、危险命令被 pre **拒绝**、
慢工具**超时**、两个并发安全工具用 **parallel 同时执行**（B 比 A 先完成）而
非并发安全的 write 单独跑。工具本身对这些策略**一无所知**。

## 3. 为什么需要这一层

L10 的 `dispatch` 是裸执行。但真实世界里，一次工具调用要经过权限审批、
沙箱包裹、超时控制、结果脱敏……如果把这些塞进每个工具，工具会变得又长又耦合，
而且每个工具都得重复实现一遍。

**dsh 把策略从工具里剥离，挂到执行管线上。** 工具只管"做事"，管线管"能不能做、
做多久、结果怎么处理"。这就是 pre/guard/execute/post 四段的意义。

## 4. 心智模型

管线就是**机场安检 + 登机 + 行李处理**：

<!-- dsh:stepper id=tool-airport title="一次工具调用怎样穿过管线" -->
1. **值机** — 记录 `tool/call`，为这次调用建立可追踪身份。
2. **安检** — `tools/pre-execute` 检查权限和沙箱策略，决定放行、拒绝或询问。
3. **过闸机** — 单调 guard 做最后检查，已经收紧的限制不能被后续环节放宽。
4. **登机执行** — `tools/execute` 负责真实执行、超时与重试；安全调用可以并行。
5. **行李分拣** — `tools/post-execute` 可以改写、拦截或补充工具结果。
6. **领取结果** — 记录并冻结权威 `tool/result`，后续只读取、不再修改。
<!-- /dsh:stepper -->

## 5. 方案与图

<!-- dsh:flow id=tool-pipeline-flow title="每个工具都穿过同一条策略管线" variant=map -->
| ID | 节点 | 说明 | 下一步 | 位置 | 类型 |
|---|---|---|---|---|---|
| batch | 一批 tool calls | 调度器先按 concurrency_safe 把调用分组。 | parallel[安全调用], serial[有副作用] | 1,2 | decision |
| parallel | 并发分组 | 并发安全的调用可以同时进入各自管线。 | call | 2,1 | |
| serial | 顺序分组 | 有副作用的调用按顺序进入同一管线。 | call | 2,3 | |
| call | 记录 tool/call | 先建立可追踪身份，失败路径也不能丢。 | pre | 3,2 | |
| pre | pre-execute | 权限、审批和沙箱策略可以提前拒绝。 | guard[继续], result[拒绝] | 4,2 | |
| guard | 单调 guard | 已收紧的限制只能保持或继续收紧，不能被后续放宽。 | execute[放行], result[阻止] | 5,2 | decision |
| execute | execute | 执行真实工具，并由 around 层处理超时与重试。 | post[成功], result[超时或异常] | 6,2 | |
| post | post-execute | 对成功 outcome 做拦截、替换或补充。 | result | 7,1 | |
| result | 冻结 tool/result | 所有成功、拒绝、异常路径汇入同一个权威结果。 | - | 8,2 | terminal |
<!-- /dsh:flow -->

## 6. 代码拆解

- `Pipeline.execute_one()`：把一次调用穿过 pre → execute(+timeout) → post → result。
- `permission_policy`：pre 阶段，`rm` 命令返回 `"deny"` 短路。
- `redact_post`：post 阶段，把 `secret` 替换成 `***`。
- `execute_batch()`：`concurrency_safe=True` 的工具用 `asyncio.gather` **并发**（呼应 L03 的 parallel），其余顺序执行。
- 超时用 `asyncio.wait_for` 包裹（around-dispatch 关注点）。

<!-- dsh:code-focus id=pipeline-sketch title="把控制流翻译成代码" -->
```python
record_call(call)
decision = run_pre_policies(tool, call)
if decision == "deny":
    return freeze_error(call)
constraints = run_monotonic_guards(tool, call)
if constraints.blocked:
    return freeze_error(call)
outcome = await execute_with_timeout(tool, call)
outcome = run_post_hooks(call, outcome)
return freeze_result(call, outcome)
```
1. **先记录** `1` — 调用一进入管线就留下事件，失败路径同样可追踪。
2. **前置策略** `2-4` — pre policy 可以在真实执行前拒绝，并从统一错误出口返回。
3. **单调守卫** `5-7` — guard 只允许保持或收紧约束，不能推翻前面已经形成的限制。
4. **执行与收口** `8-10` — 执行、post 改写和冻结结果保持固定顺序。
<!-- /dsh:code-focus -->

## 7. 相对上一课新增了什么

L10 只有裸 `dispatch`。本课在它外面套上 **pre/guard/execute/post 四段管线**，
让权限、超时、脱敏等策略挂到管线上；并用 `execute_batch` 补讲 **parallel**
（真实的 `ordered pre → concurrent execute → ordered post`）。

## 8. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| pre 返回字符串 | `tools/pre-execute` waterfall + `ctx.approval` 一次性询问 + 单调 guard | 权限有 allow/deny/ask 三态，guard 不可重排 |
| post 改 dict | `tools/post-execute` waterfall（accept/block/replace/补充上下文） | 钩子可跨工具族，结果可注入后续上下文 |
| 简单 timeout | `tools/execute` around 包裹 + 协作式取消信号 | 超时要能让工具优雅退出，不能硬杀进程 |
| concurrency_safe 布尔 | `isConcurrencySafe` + barrier + 有界滚动池，执行前重分类 | 并发要保证不改父状态、共享状态可交换 |
| 无 finalize/归一化 | `finalizeContent` + 注册表无损归一化 + `tool/result` 冻结 | 内容不变式、失败也走同一出口、结果不可变 |

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `pre` | `tools/pre-execute` waterfall + guard + `ctx.approval` |
| `execute`(+timeout) | `tools/execute` around 分发 |
| `post` | `tools/post-execute` waterfall |
| `execute_batch` 并发 | 并发安全工具的 concurrent execute（parallel） |
| `tool/result` | 冻结的权威 `tool/result` 事件 |

---
[← 上一课 L10](../L10_tool_registry/README.zh.md) · [返回总览](../../README.md) · [下一课 L12 →](../L12_capability_seam/README.zh.md)
