import subprocess
import fcntl
from pathlib import Path

from config import ANSIBLE_INVENTORY, ALLOWED_PLAYBOOKS


def run_playbook(action: str) -> dict:
    if action not in ALLOWED_PLAYBOOKS:
        raise ValueError("Unsupported deployment action")

    playbook = ALLOWED_PLAYBOOKS[action]

    command = [
        "/usr/bin/ansible-playbook",
        "-i",
        str(ANSIBLE_INVENTORY),
        str(playbook),
    ]

    lock_path = Path("/home/ubuntu/codigoflow/backend/.deployment.lock")

    with lock_path.open("a+") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("Another deployment is already running")

        return execute_command(command, action)



def execute_command(command: list[str], action: str) -> dict:
    import os
    import signal

    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
    )

    try:
        stdout, stderr = process.communicate(timeout=180)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGTERM)

        try:
            process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.communicate()

        return {
            "action": action,
            "success": False,
            "return_code": None,
            "stdout": "",
            "stderr": "Ansible execution exceeded the 180-second timeout",
        }

    return {
        "action": action,
        "success": process.returncode == 0,
        "return_code": process.returncode,
        "stdout": stdout[-10000:],
        "stderr": stderr[-10000:],
    }
