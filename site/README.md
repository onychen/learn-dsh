# learn-dsh 网页版

把 22 课讲义 + 源码编译成一个**纯静态**学习站点，形式仿
[learn.shareai.run](https://learn.shareai.run/en/timeline/)：左侧按阶段分组的粘性导航，
右侧是带节点连线的课程时间线，点卡片进入讲义 / 源码双标签页。

## 怎么看

最简单：直接双击 `index.html`（纯静态，`file://` 也能跑）。

或者起一个本地服务器：

```powershell
python -m http.server 8000 --directory site
# 然后打开 http://localhost:8000
```

## 讲义改了怎么办

站点数据是从 `lessons/*/README.zh.md` 和 `main.py` 编译出来的。
改完讲义或代码后重新生成一次即可：

```powershell
python site/build_site.py
```

它会重新写出 `site/data.js`（课程元数据 + 全文讲义 + 全部源码）。

## 文件说明

| 文件 | 作用 |
|---|---|
| `index.html` | 入口，只有一个 `#app` 容器 |
| `style.css` | 全部样式，含深浅色主题与七个阶段配色 |
| `app.js` | hash 路由 + 轻量 Markdown 渲染 + 搜索 |
| `data.js` | **自动生成**，请勿手改 |
| `build_site.py` | 编译脚本 |

## 功能

- **学习路径**：22 课 + 附录 X 的时间线，卡片显示编号、机制小结、代码行数、motto。
- **阶段总览**：按七个阶段（内核骨架 → 组装成产品）分组浏览。
- **课程页**：八段式教学页面，带本课目录、阅读进度、完成状态和讲义 / 源码双标签。
- **教学组件**：步骤演示、流程节点、结构树和概念代码联动均由 README 中的语义标记生成。
- **搜索**：按课号、标题、motto、机制关键词实时过滤。
- **深浅色**：跟随系统，可手动切换，选择记在 `localStorage`。
- **零依赖**：不需要 Node、不需要 npm、不需要联网。

## 教学组件怎么写

README 仍是唯一内容源。用隐藏的 `dsh:*` HTML 注释包住普通 Markdown 列表、表格或代码块；
GitHub 上仍显示可读的原始内容，站点构建时会把它编译成交互组件。目前支持：

- `stepper`：有序列表形式的逐步讲解；可用 `loop-from / loop-to / loop-label` 画出循环回边。
- `flow`：包含 `ID / 节点 / 说明 / 下一步` 四列的流程表格。
- `structure`：使用两空格缩进的嵌套列表。
- `compare`：把两个或多个概念并排对照，窄屏自动改为纵向。
- `code-focus`：一个代码块加带行号范围的有序说明。
- `trace`：用表格描述一次真实执行；前三列固定为步骤/位置/动作，后面 2–4 个观察面板由每课按自己的状态模型定义。
- `code-walkthrough`：按行号从同课 `main.py` 提取真实源码，组合“怎么读”和“为什么这样写”。

构建器会拒绝重复组件 ID、断裂流程连线、错误缩进和越界代码行，避免生成残缺页面。

## 与参考站的差异

原版 learn-claude-code 的 web 是 Next.js 14 + TypeScript + Tailwind + Framer Motion，
带交互式 agent loop 模拟器和版本 diff 对比。本站刻意做成**零构建的单页静态站**——
课程本身就强调"离线可跑、无依赖"，站点保持同样的调性，也省掉一整条前端工具链。
动效改用 CSS transition + IntersectionObserver 实现卡片入场，视觉效果接近。
