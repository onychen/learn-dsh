"""learn-dsh 共享基础设施：跨平台 Shell 工具。

为什么不是"Bash 工具"
---------------------
learn-claude-code 的 L01 直接用 Bash。但我们的运行环境是 Windows，而且
真实 dsh 的 shell 是一个 **seam**（`ctx.shell`），本地 provider（dsh-bash-local）
只是其中一个实现——换一个 provider 就能把命令送去远程沙箱执行。

所以我们从第一课就把它叫 **Shell 工具**，并按平台自动选择解释器
（Windows → PowerShell，其他 → /bin/sh）。这为 L12"能力 seam"埋下伏笔：
到那一课，我们会把"本地执行"和"假沙箱执行"做成同一个 shell seam 的两个 provider。
"""

from __future__ import annotations

import platform
import subprocess


def default_shell() -> list[str]:
    """按平台返回解释器 argv 前缀。"""
    if platform.system() == "Windows":
        return ["powershell", "-NoProfile", "-Command"]
    return ["/bin/sh", "-c"]


def run_shell(command: str, timeout: float = 30.0) -> str:
    """执行一条 shell 命令，返回合并后的文本输出。

    教学版故意简单：合并 stdout+stderr、截断长输出、不做任何沙箱隔离。
    真实 dsh 的执行管线要经过 approval、sandbox 包裹 argv、超时策略、
    tool_result 结构化等一整套（见 L11、L12）。
    """
    argv = default_shell() + [command]
    try:
        proc = subprocess.run(
            argv,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return f"[shell] 命令超时（>{timeout}s）：{command}"
    except FileNotFoundError:
        return f"[shell] 找不到解释器：{argv[0]}"

    out = (proc.stdout or "") + (proc.stderr or "")
    out = out.strip()
    if len(out) > 2000:
        out = out[:2000] + "\n...[输出已截断]"
    return out or f"[shell] （无输出，退出码 {proc.returncode}）"
