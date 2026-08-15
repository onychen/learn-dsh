"""把 learn-dsh 的讲义与代码编译成一个纯静态站点数据文件。

产物：site/data.js  （window.DSH_DATA = {...}）
运行：python site/build_site.py
无第三方依赖。
"""

from __future__ import annotations

import json
import os
import re
import shlex

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LESSONS = os.path.join(ROOT, "lessons")
OUT = os.path.join(ROOT, "site", "data.js")

# ---------------------------------------------------------------------------
# 阶段（层）定义 —— 对应 README 的七阶段地图，颜色仿 learn-claude-code 的 layer legend
# ---------------------------------------------------------------------------
LAYERS = [
    {"id": "kernel", "name": "内核骨架", "color": "blue",
     "desc": "Cordis 插件 / 事件 / 可逆注册"},
    {"id": "session", "name": "会话即真源", "color": "emerald",
     "desc": "仅追加事件日志与投影"},
    {"id": "turn", "name": "轮次与模型边界", "color": "purple",
     "desc": "turn/step 生命周期与 llm seam"},
    {"id": "tools", "name": "作用域与工具", "color": "amber",
     "desc": "scope / 注册表 / 管线 / seam"},
    {"id": "context", "name": "上下文可持续", "color": "rose",
     "desc": "skills 与 compaction"},
    {"id": "concurrency", "name": "委派与并发", "color": "cyan",
     "desc": "subagent / jobs / goal"},
    {"id": "product", "name": "组装成产品", "color": "red",
     "desc": "profile / capstone / trace"},
]

LESSON_LAYER = {
    "L01": "kernel", "L02": "kernel", "L03": "kernel",
    "L04": "session", "L05": "session",
    "L06": "turn", "L07": "turn", "L08": "turn",
    "L09": "tools", "L10": "tools", "L11": "tools", "L12": "tools", "L13": "tools",
    "L14": "context", "L15": "context",
    "L16": "concurrency", "L17": "concurrency", "L18": "concurrency", "L19": "concurrency",
    "L20": "product", "L21": "product", "L22": "product", "X": "product",
}

# 一句话副标题（卡片顶部的灰色小字），概括该课的机制
SUBTITLE = {
    "L01": "最小 while 循环 + 一个工具",
    "L02": "ctx 服务与可逆 effect",
    "L03": "emit / waterfall / parallel / serial",
    "L04": "append-only SessionEvent",
    "L05": "deriveMessages 纯函数投影",
    "L06": "turn/step 驱动器",
    "L07": "agent/pre-step waterfall",
    "L08": "ctx.llm 适配器与流式",
    "L09": "作用域链与 shadowing",
    "L10": "schema + handler 注册表",
    "L11": "pre/guard/execute/post 管线",
    "L12": "interface / impl / consumer",
    "L13": "提示词片段协作组装",
    "L14": "两段式按需注入",
    "L15": "surfaceOp:replace 遮蔽",
    "L16": "子会话上下文隔离",
    "L17": "后台任务与交付控制器",
    "L18": "目标是状态不是调度器",
    "L19": "turn-stopping + steer 续跑",
    "L20": "配置行层叠与 patch",
    "L21": "八层机制合成 mini-dsh",
    "L22": "read / search / trace 读侧",
    "X": "flush / 崩溃恢复（仅讲义）",
}


def parse_motto(lines: list[str]) -> str:
    for ln in lines:
        if "Motto" in ln:
            m = re.sub(r"^>\s*", "", ln).strip()
            m = m.replace("**", "")
            m = re.sub(r"^Motto[：:]\s*", "", m)
            return m.strip().rstrip("。") + "。"
    return ""


def parse_title(lines: list[str]) -> str:
    for ln in lines:
        if ln.startswith("# "):
            return ln[2:].strip()
    return ""


COMPONENT_START = re.compile(r"^<!--\s*dsh:(stepper|flow|structure|compare|code-focus|trace)\s*([^>]*)-->\s*$")
COMPONENT_END = re.compile(r"^<!--\s*/dsh:(stepper|flow|structure|compare|code-focus|trace)\s*-->\s*$")


def parse_attrs(raw: str, source: str) -> dict[str, str]:
    attrs: dict[str, str] = {}
    try:
        tokens = shlex.split(raw.strip())
    except ValueError as exc:
        raise ValueError(f"{source}: 组件属性无法解析：{exc}") from exc
    for token in tokens:
        if "=" not in token:
            raise ValueError(f"{source}: 组件属性必须写成 key=value，收到 {token!r}")
        key, value = token.split("=", 1)
        attrs[key] = value
    return attrs


def parse_table(body: str, source: str) -> list[dict[str, str]]:
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    if len(lines) < 3 or not all(line.startswith("|") for line in lines):
        raise ValueError(f"{source}: flow 组件必须包含 Markdown 表格")
    headers = [cell.strip() for cell in lines[0].strip("|").split("|")]
    rows = []
    for line in lines[2:]:
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if len(cells) != len(headers):
            raise ValueError(f"{source}: flow 表格列数不一致：{line}")
        rows.append(dict(zip(headers, cells)))
    return rows


def parse_stepper(body: str, attrs: dict[str, str], source: str) -> dict:
    steps = []
    for line in body.splitlines():
        if not line.strip():
            continue
        match = re.match(r"^\s*\d+\.\s+\*\*(.+?)\*\*\s*[—-]\s*(.+?)\s*$", line)
        if not match:
            raise ValueError(f"{source}: stepper 步骤格式应为 `1. **标题** — 说明`：{line}")
        steps.append({"title": match.group(1), "detail": match.group(2)})
    if not steps:
        raise ValueError(f"{source}: stepper 至少需要一个步骤")
    result = {"type": "stepper", "id": attrs.get("id", ""),
              "title": attrs.get("title", ""), "steps": steps}
    loop_from = attrs.get("loop-from")
    loop_to = attrs.get("loop-to")
    if loop_from or loop_to:
        if not loop_from or not loop_to:
            raise ValueError(f"{source}: stepper loop-from 与 loop-to 必须同时提供")
        try:
            start, end = int(loop_from), int(loop_to)
        except ValueError as exc:
            raise ValueError(f"{source}: stepper loop 行号必须是整数") from exc
        if start < 1 or start > len(steps) or end < 1 or end > len(steps) or start <= end:
            raise ValueError(f"{source}: stepper loop 必须从后面的步骤指回前面的步骤")
        result["loop"] = {"from": start, "to": end,
                          "label": attrs.get("loop-label", "进入下一轮")}
    return result


def parse_flow(body: str, attrs: dict[str, str], source: str) -> dict:
    rows = parse_table(body, source)
    if not rows:
        raise ValueError(f"{source}: flow 至少需要一个节点")
    required = {"ID", "节点", "说明", "下一步"}
    if rows and not required.issubset(rows[0]):
        raise ValueError(f"{source}: flow 表头必须包含 {' / '.join(required)}")
    node_ids = {row["ID"] for row in rows}
    if "" in node_ids or len(node_ids) != len(rows):
        raise ValueError(f"{source}: flow 节点 ID 不得为空或重复")
    nodes = []
    edge_pattern = re.compile(r"^([^\[]+?)(?:\[([^\]]+)\])?$")
    for row in rows:
        edges = []
        raw_next = row["下一步"].strip()
        if raw_next and raw_next != "-":
            for item in raw_next.split(","):
                match = edge_pattern.match(item.strip())
                if not match:
                    raise ValueError(f"{source}: 无法解析下一步 {item!r}")
                target = match.group(1).strip()
                if target not in node_ids:
                    raise ValueError(f"{source}: 节点 {row['ID']} 指向不存在的 {target}")
                edges.append({"target": target, "label": (match.group(2) or "").strip()})
        nodes.append({"id": row["ID"], "title": row["节点"],
                      "detail": row["说明"], "edges": edges})
    result = {"type": "flow", "id": attrs.get("id", ""),
              "title": attrs.get("title", ""), "nodes": nodes}
    variant = attrs.get("variant", "")
    if variant:
        if variant == "agent-loop":
            required_ids = {"input", "model", "decide", "tool", "observe", "done"}
            if not required_ids.issubset(node_ids):
                missing = required_ids - node_ids
                raise ValueError(f"{source}: agent-loop 缺少节点：{', '.join(sorted(missing))}")
        elif variant == "map":
            occupied: set[tuple[int, int]] = set()
            for node, row in zip(nodes, rows):
                raw_position = row.get("位置", "")
                match = re.match(r"^(\d+)\s*,\s*(\d+)$", raw_position)
                if not match:
                    raise ValueError(
                        f"{source}: map 节点 {node['id']} 的位置应写成 `列,行`"
                    )
                position = {"column": int(match.group(1)), "row": int(match.group(2))}
                key = (position["column"], position["row"])
                if key in occupied:
                    raise ValueError(f"{source}: map 位置 {raw_position} 被重复占用")
                occupied.add(key)
                node["position"] = position
                node["kind"] = row.get("类型", "").strip()
        result["variant"] = variant
    return result


def parse_structure(body: str, attrs: dict[str, str], source: str) -> dict:
    roots: list[dict] = []
    stack: list[tuple[int, dict]] = []
    for line in body.splitlines():
        if not line.strip():
            continue
        match = re.match(r"^(\s*)[-*+]\s+\*\*(.+?)\*\*\s*(?:[—-]\s*(.+))?$", line)
        if not match:
            raise ValueError(f"{source}: structure 节点格式应为 `- **标题** — 说明`：{line}")
        indent = len(match.group(1).replace("\t", "  "))
        if indent % 2:
            raise ValueError(f"{source}: structure 每层必须缩进两个空格")
        depth = indent // 2
        node = {"title": match.group(2), "detail": match.group(3) or "", "children": []}
        if depth == 0:
            roots.append(node)
        else:
            if depth > len(stack):
                raise ValueError(f"{source}: structure 节点跳过了父级：{line}")
            stack[depth - 1][1]["children"].append(node)
        stack = stack[:depth]
        stack.append((depth, node))
    if not roots:
        raise ValueError(f"{source}: structure 至少需要一个根节点")
    return {"type": "structure", "id": attrs.get("id", ""),
            "title": attrs.get("title", ""), "nodes": roots}


def parse_compare(body: str, attrs: dict[str, str], source: str) -> dict:
    cards = []
    for line in body.splitlines():
        if not line.strip():
            continue
        match = re.match(r"^\s*[-*+]\s+\*\*(.+?)\*\*\s*[—-]\s*(.+?)\s*$", line)
        if not match:
            raise ValueError(f"{source}: compare 项格式应为 `- **标题** — 说明`：{line}")
        cards.append({"title": match.group(1), "detail": match.group(2)})
    if len(cards) < 2:
        raise ValueError(f"{source}: compare 至少需要两个对照项")
    return {"type": "compare", "id": attrs.get("id", ""),
            "title": attrs.get("title", ""), "items": cards}


def parse_code_focus(body: str, attrs: dict[str, str], source: str) -> dict:
    match = re.search(r"```([^\n]*)\n(.*?)\n```", body, re.S)
    if not match:
        raise ValueError(f"{source}: code-focus 必须包含一个代码块")
    code = match.group(2)
    notes_raw = body[match.end():].strip()
    notes = []
    max_line = len(code.splitlines())
    for line in notes_raw.splitlines():
        if not line.strip():
            continue
        note = re.match(r"^\s*\d+\.\s+\*\*(.+?)\*\*\s+`(\d+)(?:-(\d+))?`\s*[—-]\s*(.+)$", line)
        if not note:
            raise ValueError(f"{source}: code-focus 说明格式无效：{line}")
        start = int(note.group(2))
        end = int(note.group(3) or start)
        if start < 1 or end < start or end > max_line:
            raise ValueError(f"{source}: code-focus 行号 {start}-{end} 超出 1-{max_line}")
        notes.append({"title": note.group(1), "start": start,
                      "end": end, "detail": note.group(4)})
    if not notes:
        raise ValueError(f"{source}: code-focus 至少需要一条代码说明")
    return {"type": "code-focus", "id": attrs.get("id", ""),
            "title": attrs.get("title", ""), "language": match.group(1).strip(),
            "code": code, "notes": notes}


def parse_trace(body: str, attrs: dict[str, str], source: str) -> dict:
    """把一次真实执行展开成可单步查看的代码、日志、视图和继续条件。"""
    rows = parse_table(body, source)
    required = {"步骤", "执行位置", "发生什么", "事件日志", "模型视图", "继续条件"}
    if not rows or not required.issubset(rows[0]):
        raise ValueError(f"{source}: trace 表头必须包含 {' / '.join(required)}")
    steps = []
    for row in rows:
        if not row["步骤"].strip():
            raise ValueError(f"{source}: trace 步骤名称不得为空")
        steps.append({
            "title": row["步骤"].strip(),
            "location": row["执行位置"].strip(),
            "action": row["发生什么"].strip(),
            "events": row["事件日志"].strip(),
            "messages": row["模型视图"].strip(),
            "decision": row["继续条件"].strip(),
        })
    return {"type": "trace", "id": attrs.get("id", ""),
            "title": attrs.get("title", ""), "steps": steps}


def split_blocks(body: str, source: str, seen_ids: set[str] | None = None) -> list[dict]:
    lines = body.splitlines()
    blocks: list[dict] = []
    markdown: list[str] = []
    seen_ids = seen_ids if seen_ids is not None else set()

    def flush_markdown() -> None:
        text = "\n".join(markdown).strip()
        if text:
            blocks.append({"type": "markdown", "markdown": text})
        markdown.clear()

    i = 0
    while i < len(lines):
        start = COMPONENT_START.match(lines[i])
        if not start:
            markdown.append(lines[i])
            i += 1
            continue
        flush_markdown()
        kind, raw_attrs = start.groups()
        attrs = parse_attrs(raw_attrs, source)
        component_id = attrs.get("id", "")
        if not component_id or component_id in seen_ids:
            raise ValueError(f"{source}: 组件 id 必须存在且在本课唯一：{component_id!r}")
        seen_ids.add(component_id)
        content = []
        i += 1
        while i < len(lines) and not COMPONENT_END.match(lines[i]):
            content.append(lines[i])
            i += 1
        if i >= len(lines):
            raise ValueError(f"{source}: 组件 {component_id} 缺少结束标记")
        end_kind = COMPONENT_END.match(lines[i]).group(1)
        if end_kind != kind:
            raise ValueError(f"{source}: 组件 {component_id} 起止类型不一致")
        raw = "\n".join(content).strip()
        parser = {"stepper": parse_stepper, "flow": parse_flow,
                  "structure": parse_structure, "compare": parse_compare,
                  "code-focus": parse_code_focus, "trace": parse_trace}[kind]
        blocks.append(parser(raw, attrs, source))
        i += 1
    flush_markdown()
    return blocks


def split_sections(md: str, source: str) -> list[dict]:
    """按 '## N. xxx' 切成章节，并把教学组件编译成结构化 block。"""
    parts: list[tuple[str, str]] = []
    current_name: str | None = None
    current_body: list[str] = []
    fence_char: str | None = None
    fence_length = 0

    for line in md.splitlines():
        if fence_char is None:
            heading = re.match(r"^##\s+(.+?)\s*$", line)
            if heading:
                if current_name is not None:
                    parts.append((current_name, "\n".join(current_body).strip()))
                current_name = heading.group(1)
                current_body = []
                continue

            opening_fence = re.match(r"^\s{0,3}(`{3,}|~{3,})", line)
            if opening_fence:
                marker = opening_fence.group(1)
                fence_char = marker[0]
                fence_length = len(marker)
        else:
            closing_fence = re.match(
                rf"^\s{{0,3}}{re.escape(fence_char)}{{{fence_length},}}\s*$", line
            )
            if closing_fence:
                fence_char = None
                fence_length = 0

        if current_name is not None:
            current_body.append(line)

    if current_name is not None:
        parts.append((current_name, "\n".join(current_body).strip()))

    out = []
    seen_ids: set[str] = set()
    for name, body in parts:
        out.append({"name": name,
                    "blocks": split_blocks(body, source, seen_ids)})
    return out


def main() -> None:
    lessons = []
    for entry in sorted(os.listdir(LESSONS)):
        d = os.path.join(LESSONS, entry)
        if not os.path.isdir(d):
            continue
        code_id = entry.split("_")[0]
        readme = os.path.join(d, "README.zh.md")
        mainpy = os.path.join(d, "main.py")

        md = ""
        if os.path.exists(readme):
            with open(readme, encoding="utf-8") as f:
                md = f.read()
        lines = md.splitlines()

        code = ""
        if os.path.exists(mainpy):
            with open(mainpy, encoding="utf-8") as f:
                code = f.read()

        title = parse_title(lines)
        # 去掉标题里的 "L01 " 前缀，卡片上单独用 badge 显示编号
        short = re.sub(r"^(L\d+|附录\s*X)[：:\s]*", "", title).strip()

        lessons.append({
            "id": code_id,
            "dir": entry,
            "num": code_id.replace("L", "").replace("X", "X"),
            "title": short or title,
            "fullTitle": title,
            "subtitle": SUBTITLE.get(code_id, ""),
            "motto": parse_motto(lines),
            "layer": LESSON_LAYER.get(code_id, "product"),
            "loc": len(code.splitlines()),
            "hasCode": bool(code),
            "sections": split_sections(md, readme),
            "code": code,
        })

    max_loc = max((l["loc"] for l in lessons), default=1) or 1
    for l in lessons:
        l["locPct"] = round(l["loc"] / max_loc * 100)

    readme_top = ""
    p = os.path.join(ROOT, "README.md")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            readme_top = f.read()

    data = {
        "title": "learn-dsh",
        "subtitle": "拆解 DeepSeek Harness：22 课 + 1 附录",
        "tagline": "先立 Cordis 插件 / 事件 / seam 骨架，再逐层把能力挂上去",
        "layers": LAYERS,
        "lessons": lessons,
        "readme": readme_top,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// 由 build_site.py 自动生成，请勿手工编辑\n")
        f.write("window.DSH_DATA = ")
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write(";\n")

    print(f"已生成 {OUT}")
    print(f"课程数 {len(lessons)}，最大代码行数 {max_loc}")


if __name__ == "__main__":
    main()
