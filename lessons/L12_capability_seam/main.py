"""L12 能力 seam：interface / implementation / consumer
======================================================
Motto：换一个 provider，就换掉产品的一整块能力。

前面几课其实一直在用 seam，只是没点破：ctx.llm（L08）就是一个 seam。这一课
正式讲清 seam 的三角色，并做一个能真正切换的 demo：

  interface（Service Definition）：定义能力接口 + ctx.<key>，如 ShellExecutor。
  implementation（Service Provider）：一个或多个实现，如 本地执行 / 假沙箱。
  consumer：使用该能力的一方，通常是面向模型的工具，如 shell 工具。

关键威力：consumer 只依赖 interface。换一个 implementation，consumer 一行不改，
整块能力的行为就变了——本课把"本地执行"换成"假远程沙箱"，shell 工具无感。
真实 dsh 里，把 fs + subprocess 一起换成远程沙箱，Bash/PTY/LSP 全跟着搬。

运行：  python lessons/L12_capability_seam/main.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.shell import run_shell  # noqa: E402


# ==========================================================================
# ① interface（Service Definition）
# ==========================================================================
class ShellExecutor:
    """能力接口：给一条命令，返回输出。谁实现都行。"""

    name = "abstract"

    def run(self, command: str) -> str:
        raise NotImplementedError


# ==========================================================================
# ② implementations（Service Providers）—— 两个可互换实现
# ==========================================================================
class LocalShellExecutor(ShellExecutor):
    """本地实现：真的在本机执行（复用 L01 的 shared.shell）。"""

    name = "local"

    def run(self, command: str) -> str:
        return run_shell(command)


class FakeSandboxExecutor(ShellExecutor):
    """假沙箱实现：不真执行，只记录并返回模拟输出。

    真实 dsh 里这会是 E2B 远程沙箱之类——命令送到远端隔离环境执行，
    宿主机不受影响。这里用假的证明"consumer 不用改，行为就变了"。
    """

    name = "sandbox"

    def __init__(self):
        self.audit_log: list[str] = []

    def run(self, command: str) -> str:
        self.audit_log.append(command)
        return f"[sandbox] 已在远程隔离环境模拟执行: {command!r}（宿主机未受影响）"


# ==========================================================================
# ③ consumer —— 面向模型的 shell 工具，只依赖 interface
# ==========================================================================
class ShellTool:
    """consumer：注入一个 ShellExecutor，自己不关心它是哪种实现。"""

    def __init__(self, executor: ShellExecutor):
        self._executor = executor  # 只认接口

    def call(self, command: str) -> str:
        return self._executor.run(command)


if __name__ == "__main__":
    command = "echo capability seam demo"

    print("### 同一个 consumer（ShellTool），换不同 provider")

    print(f"\n--- provider = local（真执行）---")
    tool_local = ShellTool(LocalShellExecutor())
    print(f"  结果: {tool_local.call(command)!r}")

    print(f"\n--- provider = sandbox（假远程沙箱，consumer 一行没改）---")
    sandbox = FakeSandboxExecutor()
    tool_sandbox = ShellTool(sandbox)
    print(f"  结果: {tool_sandbox.call(command)!r}")
    print(f"  沙箱审计日志: {sandbox.audit_log}")

    print("\n→ 换 provider 就换掉了整块 shell 能力，ShellTool 代码完全没动。")
    print("  真实 dsh 里，fs + subprocess 共享一个执行世界，")
    print("  把它们一起指向远程沙箱，Bash / PTY / LSP 全都跟着搬。")
