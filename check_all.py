"""check_all.py —— learn-dsh 冒烟测试 + 关键不变量断言
======================================================
用途：一条命令验证所有课能跑，并断言几条最容易回归的架构语义。
这些断言正是为了防止"能跑但教错"——审查发现的那类问题。

运行：  python check_all.py
"""

from __future__ import annotations

import importlib.util
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
LESSONS = os.path.join(ROOT, "lessons")


def _load(rel_path: str):
    """按路径加载一个课程模块（不执行 __main__）。"""
    path = os.path.join(ROOT, rel_path)
    mod_name = "lesson_" + os.path.basename(os.path.dirname(rel_path))
    spec = importlib.util.spec_from_file_location(mod_name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = mod          # dataclass 需要能从 sys.modules 找到本模块
    spec.loader.exec_module(mod)
    return mod


def smoke_test_all() -> int:
    """跑每课 main.py，返回失败数。"""
    fails = 0
    for name in sorted(os.listdir(LESSONS)):
        main_py = os.path.join(LESSONS, name, "main.py")
        if not os.path.exists(main_py):
            continue
        child_env = os.environ.copy()
        child_env["PYTHONIOENCODING"] = "utf-8"
        r = subprocess.run(
            [sys.executable, main_py], capture_output=True, text=True,
            encoding="utf-8", errors="replace", env=child_env,
        )
        if r.returncode == 0:
            print(f"  OK   {name}")
        else:
            print(f"  FAIL {name}\n{r.stderr}")
            fails += 1
    return fails


def invariant_tests():
    """关键架构不变量断言。任一失败即抛 AssertionError。"""
    import asyncio

    # ---- 1) serial 遇到第一个 bail 值即停止后续监听者 ----
    l03 = _load("lessons/L03_event_dispatch/main.py")
    bus = l03.EventBus()
    calls = []

    async def _la(x):
        calls.append("a")
        return None                # 不 bail

    async def _lb(x):
        calls.append("b")
        return {"win": 1}          # bail

    async def _lc(x):
        calls.append("c")          # 不应执行
        return {"never": 1}

    bus.on("e", _la)
    bus.on("e", _lb)
    bus.on("e", _lc)

    async def _s():
        return await bus.serial("e", None)
    got = asyncio.run(_s())
    assert got == {"win": 1}, f"serial 应返回第一个 bail 值，得到 {got}"
    assert calls == ["a", "b"], f"serial bail 后不应执行后续监听者，实际执行了 {calls}"

    # ---- 2) compaction 后旧事件仍在日志，但不进派生消息；surfaceOp 在顶层 ----
    l15 = _load("lessons/L15_compaction/main.py")
    s = l15.Session()
    for i in range(5):
        s.append("user/message", {"content": f"u{i}", "source": "human"})
        s.append("assistant/message", {"content": f"a{i}"})
    n_before = len(s.events())
    l15.compact(s, keep_last=2)
    assert len(s.events()) > n_before, "compaction 应追加事件（日志更长，不删旧的）"
    # 普通消息顶层 surface_op 必为 append
    normal = next(e for e in s.events() if e.type == "assistant/message")
    assert normal.surface_op == {"op": "append"}, "普通 surface 事件顶层 surface_op 应为 append"
    # 存在一条顶层 replace
    assert any(e.surface_op and e.surface_op["op"] == "replace" for e in s.events()), "应有一条 replace 摘要"
    msgs = l15.derive_messages(s.events())
    assert len(msgs) < n_before, "派生消息应因遮蔽而变短"

    # ---- 3) L22 trace：surfaceOp/sourceEventSeqs 在顶层，配对正确 ----
    l22 = _load("lessons/L22_session_trace/main.py")
    sess = l22.build_session()
    q = l22.SessionQuery(sess)
    t4 = q.trace(4)
    assert t4["sourceEventSeqs"] == [2, 3], f"assistant/message 应引用 chunk 2,3，得到 {t4['sourceEventSeqs']}"
    t6 = q.trace(6)
    assert t6["replacedBy"] == 9, f"被遮蔽事件应指向替换者 #9，得到 {t6['replacedBy']}"
    # 非 surface 事件不得带 surfaceOp（append 会 assert）
    try:
        sess.append("turn/start", {"turn": 1}, surface_op={"op": "append"})
        raise SystemExit("非 surface 事件带 surfaceOp 应被拒绝")
    except AssertionError:
        pass

    # ---- 4) L21 派生历史保留 tool_calls 且 tool 结果带 tool_call_id ----
    l21 = _load("lessons/L21_capstone/main.py")
    evs = [
        l21.SessionEvent(0, "user/message", {"content": "hi"}),
        l21.SessionEvent(1, "assistant/message", {"text": "call", "tool_calls": [{"id": "c1", "name": "shell", "arguments": {}}]}),
        l21.SessionEvent(2, "tool/result", {"callId": "c1", "result": "ok"}),
    ]
    dm = l21.derive_messages(evs)
    asst = next(m for m in dm if m["role"] == "assistant")
    assert asst.get("tool_calls"), "assistant 消息应保留完整 tool_calls"
    tool = next(m for m in dm if m["role"] == "tool")
    assert tool.get("tool_call_id") == "c1", "tool 结果应带 tool_call_id 与 call 配对"

    # ---- 5) L06 Driver 连续两个 turn，step 从 0 重新开始 ----
    l06 = _load("lessons/L06_turn_step/main.py")
    assert not hasattr(l06.Driver, "step_no"), "Driver 不应有跨 turn 的 step_no 字段"

    # ---- 6) L04 只讲仅追加日志，不应提前引入 turn/step 事件 ----
    l04 = _load("lessons/L04_session_log/main.py")
    s4 = l04.Session()
    l04.run(s4, l04.make_llm(script=l04.build_script()), "x")
    types = {ev.type for ev in s4.events()}
    assert not (types & {"turn/start", "turn/end", "step/start", "step/end"}), \
        f"L04 不应含 turn/step 事件（那是 L06 的主题），实际含 {types}"

    # ---- 7) L05 tool/result 按 callId 配对：有对应 call 的不标孤儿，无对应的标孤儿 ----
    l05 = _load("lessons/L05_derive_messages/main.py")
    evs5 = [
        l05.SessionEvent(0, "assistant/message", {"text": "call", "tool_calls": [{"id": "c1", "name": "shell"}]}),
        l05.SessionEvent(1, "tool/call", {"callId": "c1", "name": "shell", "arguments": {}}),
        l05.SessionEvent(2, "tool/result", {"callId": "c1", "result": "ok"}),      # 有对应 call
        l05.SessionEvent(3, "tool/result", {"callId": "ghost", "result": "orphan"}),  # 无对应 call
    ]
    dm5 = l05.derive_messages(evs5)
    paired = next(m for m in dm5 if m.get("tool_call_id") == "c1")
    orphan = next(m for m in dm5 if m.get("tool_call_id") == "ghost")
    assert "_orphan" not in paired, "有对应 tool/call 的结果不应标记孤儿"
    assert orphan.get("_orphan") is True, "无对应 tool/call 的结果应标记孤儿"

    print("  所有关键不变量断言通过 [OK]")


def site_component_tests():
    """交互课程组件必须可从 README 稳定编译，且全部课程不再依赖 ASCII 概念图。"""
    builder = _load("site/build_site.py")
    expected = {
        "L01_agent_loop": {"flow", "trace", "code-walkthrough"},
        "L02_cordis_plugins": {"structure", "flow"},
        "L03_event_dispatch": {"compare", "flow"},
        "L04_session_log": {"compare", "flow", "trace"},
        "L05_derive_messages": {"compare", "trace"},
        "L06_turn_step": {"structure", "flow", "trace"},
        "L07_pre_step": {"stepper", "flow"},
        "L08_llm_seam": {"structure", "flow"},
        "L09_scope": {"structure", "stepper"},
        "L10_tool_registry": {"compare", "flow"},
        "L11_tool_pipeline": {"stepper", "flow", "code-focus"},
        "L12_capability_seam": {"structure", "flow"},
        "L13_system_prompt": {"stepper", "flow"},
        "L14_skills": {"compare", "flow"},
        "L15_compaction": {"compare", "stepper"},
        "L16_subagent": {"structure", "flow"},
        "L17_jobs": {"stepper", "flow"},
        "L18_goal": {"compare", "flow"},
        "L19_goal_driver": {"flow"},
        "L20_profile_bundle": {"compare", "stepper"},
        "L21_capstone": {"flow", "stepper"},
        "L22_session_trace": {"compare", "flow"},
        "X_persistence": {"stepper"},
    }
    box_chars = set("┌┐└┘│─▼▲├┬┤┴")
    map_components = {
        "L02_cordis_plugins": "plugin-lifecycle",
        "L04_session_log": "session-log-flow",
        "L08_llm_seam": "llm-stream-flow",
        "L10_tool_registry": "tool-registry-flow",
        "L11_tool_pipeline": "tool-pipeline-flow",
        "L12_capability_seam": "seam-roles",
        "L13_system_prompt": "prompt-magazine",
        "L14_skills": "skill-two-stage",
        "L18_goal": "goal-domain-flow",
        "L19_goal_driver": "turn-stopping-loop",
        "L21_capstone": "capstone-layers",
        "L22_session_trace": "trace-analysis",
    }
    required_edges = {
        "plugin-lifecycle": {"running": {"unload"}, "dispose": {"clean"}},
        "session-log-flow": {"decide": {"tool", "done"}, "result": {"session"}},
        "llm-stream-flow": {"stream": {"chunk", "message", "error"},
                            "retry": {"start", "failed"}},
        "tool-registry-flow": {"definition": {"schema", "handler"},
                               "call": {"dispatch"}},
        "tool-pipeline-flow": {"pre": {"guard", "result"},
                               "guard": {"execute", "result"}},
        "seam-roles": {"interface": {"service"}, "service": {"consumer"}},
        "prompt-magazine": {"scope": {"filter", "tools"}, "render": {"tools"}},
        "skill-two-stage": {"model": {"load", "continue"}, "body": {"messages"}},
        "goal-domain-flow": {"active": {"block", "complete"}, "blocked": {"set"}},
        "turn-stopping-loop": {"inspect": {"step", "close"}},
        "capstone-layers": {"decide": {"dispatch", "done"},
                            "result": {"session"}, "child_result": {"result"}},
        "trace-analysis": {"target": {"sources", "derived", "replaced", "replacer"}},
    }

    for lesson, required in expected.items():
        path = os.path.join(LESSONS, lesson, "README.zh.md")
        with open(path, encoding="utf-8") as f:
            markdown = f.read()
        sections = builder.split_sections(markdown, path)
        kinds = {
            block["type"]
            for section in sections
            for block in section["blocks"]
            if block["type"] != "markdown"
        }
        assert required.issubset(kinds), f"{lesson} 缺少教学组件：{required - kinds}"
        if lesson in map_components:
            component_id = map_components[lesson]
            map_block = next(
                block
                for section in sections
                for block in section["blocks"]
                if block.get("id") == component_id
            )
            assert map_block.get("variant") == "map", \
                f"{lesson} 的 {component_id} 必须使用真实连线图"
            positions = {
                (node["position"]["column"], node["position"]["row"])
                for node in map_block["nodes"]
            }
            assert len(positions) == len(map_block["nodes"]), \
                f"{lesson} 的 map 节点位置不能重叠"
            edges = {
                node["id"]: {edge["target"] for edge in node["edges"]}
                for node in map_block["nodes"]
            }
            for source, targets in required_edges[component_id].items():
                assert edges[source] == targets, \
                    f"{lesson} 的 {source} 链路应为 {targets}，实际为 {edges[source]}"
        if lesson == "L13_system_prompt":
            assert [section["name"] for section in sections] == [
                "1. 30 秒运行",
                "2. 观察输出",
                "3. 为什么需要这一层",
                "4. 心智模型",
                "5. 方案与图",
                "6. 代码拆解",
                "7. 相对上一课新增了什么",
                "8. 简化了什么 vs 真实 DeepSeek Harness",
            ], "L13 代码围栏中的 ## 文本不能被解析成课程章节"
        if lesson == "L01_agent_loop":
            agent_loop = next(
                block
                for section in sections
                for block in section["blocks"]
                if block.get("id") == "agent-conversation"
            )
            assert agent_loop.get("variant") == "agent-loop", \
                "L01 心智模型必须使用专门的 Agent Loop 布局"
            edges = {
                node["id"]: {edge["target"] for edge in node["edges"]}
                for node in agent_loop["nodes"]
            }
            assert edges["decide"] == {"tool", "done"}, \
                "L01 必须明确展示调用工具与直接结束的分岔"
            assert edges["observe"] == {"model"}, \
                "L01 写回观察后必须带着新消息历史进入下一轮"

        teaching_sections = 0
        for section in sections:
            if not (section["name"].startswith("4.") or section["name"].startswith("5.")):
                continue
            teaching_sections += 1
            assert any(block["type"] != "markdown" for block in section["blocks"]), \
                f"{lesson} 的 {section['name']} 必须使用语义教学组件"
            for block in section["blocks"]:
                if block["type"] == "markdown":
                    assert not (set(block["markdown"]) & box_chars), \
                        f"{lesson} 的心智模型/方案仍含 ASCII 框图"
        if lesson != "X_persistence":
            assert teaching_sections == 2, f"{lesson} 应同时包含心智模型和方案章节"

    duplicate = """## 1. A
<!-- dsh:stepper id=same -->
1. **A** — a
<!-- /dsh:stepper -->
## 2. B
<!-- dsh:stepper id=same -->
1. **B** — b
<!-- /dsh:stepper -->"""
    try:
        builder.split_sections(duplicate, "duplicate-test")
        raise AssertionError("重复组件 id 应在构建阶段失败")
    except ValueError:
        pass

    print("  教学组件解析与全课程内容断言通过 [OK]")


if __name__ == "__main__":
    print("== 冒烟测试：运行全部课程 ==")
    fails = smoke_test_all()
    print(f"\n冒烟测试失败数: {fails}")

    print("\n== 关键不变量断言 ==")
    invariant_tests()

    print("\n== 交互课程组件断言 ==")
    site_component_tests()

    if fails:
        sys.exit(1)
    print("\n全部通过。")
