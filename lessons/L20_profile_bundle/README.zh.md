# L20 Profile / Bundle：把插件树叠出来

> **Motto：产品 = 有序层叠的插件树，任意一行都能被 patch 替换。**

## 1. 30 秒运行

```powershell
python lessons/L20_profile_bundle/main.py
```

预期输出（节选）：

```text
===== 组合 profile: headless =====
  [dsh-base] 插入 行 id=llm → dsh-llm-deepseek
  [headless] 插入 行 id=subagent → dsh-subagent-spawn-in-process
  ...

===== 用 --patch 覆盖 llm 行（换成 replay，用于测试）=====
  [--patch] 替换 行 id=llm → dsh-llm-replay
  ---- 最终插件树 ----
    llm          dsh-llm-replay {'script': 'fixtures/demo.json'}
    ...
```

## 2. 观察输出

同一份 `dsh-base`，`headless` 和 `web` 两个 profile 叠出两个不同的插件树（产品）。
最后用 `--patch` 把 `llm` 那一行**整行替换**成 replay——`dsh-base` 其余行一个没动。

## 3. 为什么需要这一层

前 19 课我们都手写启动代码（`ctx.provide(...)`）。但真实产品不能靠手写启动，
需要**声明式、可组合、可覆盖**：同一套核心，headless 版和 web 版只是叠的东西不同；
测试时想把真模型换成 replay，不该改代码。

**dsh 的答案：profile 列出要叠哪些 bundle，bundle 贡献配置行，按序层叠成插件树，
`--patch` 可覆盖任意一行。** 这让"同一内核组合出不同产品"成为配置问题而非编码问题。

## 4. 心智模型

profile/bundle 就像**装修房子**：

<!-- dsh:compare id=profile-house title="同一套基础能力可以装修成不同产品" -->
- **dsh-base · 毛坯** — 提供水电和承重墙般的通用核心，每个 profile 都从这里开始。
- **headless bundle · 简装** — 加入一次性运行器、subagent 与 goal 等无界面能力。
- **web bundle · 精装** — 加入浏览器界面和服务器，形成交互式产品。
- **patch · 局部换装** — 最后按 id 替换某一项能力，不扰动其他配置。
<!-- /dsh:compare -->

## 5. 方案与图

<!-- dsh:stepper id=profile-layering title="配置树按层叠加，越后越具体" -->
1. **空树** — 从没有任何实现选择的配置开始。
2. **叠加 dsh-base** — 放入 llm、tool-shell、persistence 等共同基础。
3. **叠加 bundle** — 根据 headless 或 web profile 加入产品能力组。
4. **叠加 profile patch** — 覆盖该产品形态的局部默认值。
5. **叠加 home patch** — 应用用户机器上的长期个性化配置。
6. **叠加命令行 patch** — 最后一次、最具体的覆盖；同 id 替换，否则插入。
<!-- /dsh:stepper -->

## 6. 代码拆解

- `ConfigRow`：一行配置 = id + plugin + config + disabled。
- `apply_layer()`：按 `id` 定位——存在就**整行替换**，否则插入。这就是 patch 的核心机制。
- `dsh_base` / `headless_bundle` / `web_bundle`：三个层，各贡献若干行。
- `build_profile()`：按顺序叠 base → profile bundle →（可选）`--patch`。
- main：headless、web 两个 profile，再演示 `--patch` 把 llm 换成 replay。

## 7. 相对上一课新增了什么

前 19 课都是手动 new 插件。本课引入 **profile/bundle 声明式层叠 + patch 覆盖**，
把"手写启动"变成"配置组合"，让同一内核叠出不同产品、任意一行可被替换。

## 8. 简化了什么 vs 真实 DeepSeek Harness

| 教学版（本课） | 真实 dsh | 为什么真实工程需要那层复杂度 |
|---|---|---|
| dict 存 config rows | Cordis loader + `cordis.patch.yml`，插件树真实挂载 | 配置驱动真实的插件生命周期 |
| 手写三个 bundle | bundle 是分发格式，`package.json` 的 `dsh` 字段声明 | 可打包分发、跨仓库复用 |
| 单一 patch | profile patch → home patch → `--patch` 多层覆盖 | 不同层级（团队/机器/命令行）各自覆盖 |
| 整行替换 | patch 按 id 替换整个 config，或插入新行 | 精确定位、可组合 |
| 无 dump | `dsh --profile web --dump-config` 打印真实树 | 可检查机器实际启动的树 |

### 教学类名 → 真实 dsh 映射

| 本课 | 真实 dsh |
|---|---|
| `ConfigRow` | Cordis config row |
| `dsh_base()` | `dsh-base` bundle |
| `headless_bundle` / `web_bundle` | `dsh-headless` / `dsh-web-app` |
| `--patch` 覆盖 | `--patch` overlay / `cordis.patch.yml` |

---
[← 上一课 L19](../L19_goal_driver/README.zh.md) · [返回总览](../../README.md) · [下一课 L21 →](../L21_capstone/README.zh.md)
