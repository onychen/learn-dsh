# L10 工具注册表：schema + handler + 分派

> **Motto：加一个工具，只加一个定义，循环不用动。**

## 1. 30 秒运行

运行前先猜：同一份 `ToolDefinition` 中既有 JSON schema 又有可执行函数，`schemas()` 为什么
不能直接把 dataclass 转成字典？模型返回未知工具名时，注册表应该抛异常还是返回受控错误？

```powershell
python lessons/L10_tool_registry/main.py
```

预期输出（节选）：

```text
===== 发给模型的 schema（注意：没有 execute / timeout_ms）=====
[ { "name": "shell", "description": "...", "parameters": {...} }, ... ]

===== 循环通过注册表分派调用（loop 不认识具体工具）=====
  add({'a': 2, 'b': 3}) → 5
  echo({'text': 'hello'}) → 'hello'
  shell({'command': 'echo via registry'}) → 'via\nregistry'
  nope({}) → '[未知工具] nope'
```

## 2. 观察输出

三个工具注册进一张表。发给模型的 schema **只有** name/description/parameters——
`execute` 和 `timeout_ms` 这些宿主字段没泄漏。循环用 `dispatch(name, args)`
统一分派，它根本不认识 `add`/`echo`/`shell` 具体是什么。

## 3. 为什么需要这一层

L01 的 `call_tool` 是一堆 `if name == ...`。每加一个工具就得改这个函数、改循环。
这违背了 dsh"不改核心"的原则。

**工具注册表把"工具"变成数据（一条 `ToolDefinition`）。** 加工具 = 往表里加一条，
循环通过表分派，永远不用改。而且注册表守着一条边界：**只有面向模型的字段能进
模型请求**，handler/超时等宿主元数据严禁泄漏给模型。

## 4. 心智模型

注册表就是**餐厅菜单 vs 后厨**：

<!-- dsh:compare id=menu-vs-kitchen title="模型看到菜单，宿主掌握后厨" -->
- **菜单 schemas()** — 给模型看工具名、描述和参数要求，不暴露执行能力。
- **后厨 execute** — 宿主持有真实实现、超时和资源控制，模型看不到。
- **点单 dispatch** — 按工具名查表，把合法参数交给后厨，再统一返回结果。
<!-- /dsh:compare -->

## 5. 方案与图

<!-- dsh:flow id=tool-registry-flow title="同一份 ToolDefinition 跨过模型与宿主边界" variant=map -->
| ID | 节点 | 说明 | 下一步 | 位置 | 类型 |
|---|---|---|---|---|---|
| definition | ToolDefinition | 同时保存公开 schema 和宿主私有 handler/timeout。 | schema[公开字段], handler[私有字段] | 1,2 | state |
| schema | schemas() 投影 | 只取 name、description、parameters。 | model | 2,1 | boundary |
| model | 模型可见菜单 | 模型只能看到 schema，不能接触 execute。 | call | 3,1 | |
| call | tool call | 模型返回工具名和参数，控制权回到宿主。 | dispatch | 4,1 | boundary |
| dispatch | dispatch(name,args) | 宿主按名称查找完整定义。 | handler | 4,3 | |
| handler | 私有 execute | 真实实现和 timeout 始终留在宿主侧。 | result | 2,3 | |
| result | 工具结果 | 执行结果由宿主统一返回，handler 从未泄漏给模型。 | - | 1,3 | terminal |
<!-- /dsh:flow -->

### 执行透视：同一工具在模型侧与宿主侧的两种视图

<!-- dsh:trace id=l10-runtime-xray title="ToolDefinition 跨边界时发生了什么" -->
| 步骤 | 执行位置 | 发生什么 | Registry 权威记录 | 模型可见字段 | 宿主执行能力 |
|---|---|---|---|---|---|
| 注册 shell | `register(ToolDefinition)` | 完整定义按 name 存入表。 | schema + execute + timeout | 尚未投影。 | handler 保存在宿主内存。 |
| 生成菜单 | `schemas()` | 白名单复制 name、description、parameters。 | 完整记录不变。 | 只有三个 JSON 字段。 | execute 与 timeout 未跨边界。 |
| 模型点单 | `tool call: add` | 模型只返回 name 与 arguments。 | 通过 name 定位完整定义。 | `{name:add,args:{a,b}}` | 控制权回到宿主。 |
| 分派执行 | `dispatch(name,args)` | 注册表查表后调用私有 execute。 | add 定义命中。 | 模型接触不到函数对象。 | `lambda → 5` |
| 未知工具 | `dispatch("nope",{})` | 查表失败，生成稳定错误结果。 | Registry 不变。 | 可作为 tool result 返回。 | 没有任意函数被调用。 |
<!-- /dsh:trace -->

## 6. 代码拆解

- `ToolDefinition`：一个工具的全部。前三个字段面向模型，后两个（`execute`/`timeout_ms`）宿主私有。
- `register()`：存入表，返回 disposer（可逆注册，呼应 L02）。
- `schemas()`：**只**投影 name/description/parameters。这是防泄漏的关键。
- `dispatch()`：查表、调 handler，未知工具返回错误。

### 动手破坏一次

把 `schemas()` 改成返回 `t.__dict__`。JSON 序列化会遇到函数对象，即使转成字符串也会泄漏
宿主实现细节。这验证：**模型 schema 必须用字段白名单投影，不能序列化权威记录。**

## 7. 代码解读：注册表如何同时守住开放扩展与执行边界

<!-- dsh:code-walkthrough id=l10-code-reading title="定义、投影与分派三条路径" source=main.py -->
| 阶段 | 行号 | 读代码 | 设计原因 |
|---|---|---|---|
| 一个定义同时容纳公私字段 | 31-36 | ToolDefinition 把模型 schema、handler 与 timeout 放在同一权威对象里。 | 注册与执行共享同一身份，避免 schema 表和 handler 表分别维护后发生名称漂移；边界由投影函数负责。 |
| 注册返回 disposer | 39-45 | registry 按 name 保存定义，并返回删除同名项的闭包。 | 工具属于插件生命周期；可逆注册让卸载后 schema 与执行能力同时消失。 |
| schemas 使用显式白名单 | 47-52 | 列表推导只重建三个公开字段，不复制 dataclass 的其余属性。 | 新增宿主字段时默认不会泄漏；安全边界采用 opt-in，而不是要求开发者记得排除敏感字段。 |
| dispatch 重新取得完整定义 | 54-58 | name 查表后只在宿主侧调用 execute；未知名称走受控返回。 | 模型输出只是请求，不是函数引用。宿主始终保留最终分派权和错误规范。 |
| 新工具只新增数据定义 | 62-87 | shell、add、echo 以相同结构注册，dispatch 没有新增分支。 | 扩展点从修改中央 if 变成追加定义，降低回归范围，也允许不同插件独立贡献工具。 |
<!-- /dsh:code-walkthrough -->

## 8. 相对上一课新增了什么

L01 的工具是 if 分支。本课把工具变成注册表里的 **`ToolDefinition` 数据**，
让"加工具不用改循环"成立，并明确"模型可见字段 vs 宿主私有字段"的边界。

## 9. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| `dispatch` 直接调 execute | 一整条 pre/guard/execute/post 管线（见 L11） | 权限、超时、沙箱、结果改写都要能介入 |
| `parameters` 手写 dict | `defineTool` + 类型化 schema DSL，自动校验/收窄 | 编译期类型安全，运行时校验模型输入 |
| 返回值随意 | 强制 `output.schema` + `render()` 规范输出 | 结果必须是 lossless JSON，可回放 |
| 无 UI 投影 | `presentCall` / `presentResult` 纯投影 | UI 在流式和回放时都能渲染卡片 |
| 全局注册 | 注册落到 scope 层（见 L09） | per-agent 工具集差异化 |

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `ToolDefinition` | `ToolDefinition`（`core/tools`） |
| `schemas()` | 注册表 `schemas()`（只白名单模型字段） |
| `dispatch` | 执行管线的入口（见 L11） |
| `execute` | `ToolDefinition.execute(args, exec)` |

---
[← 上一课 L09](../L09_scope/README.zh.md) · [返回总览](../../README.md) · [下一课 L11 →](../L11_tool_pipeline/README.zh.md)
