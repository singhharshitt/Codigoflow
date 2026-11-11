#!/usr/bin/env python3
"""Nagios plugin: CódigoFlow HTTP availability and latency."""
from __future__ import annotations

import argparse
import sys
import time
import urllib.error
import urllib.request


OK, WARNING, CRITICAL, UNKNOWN = 0, 1, 2, 3


def main() -> int:
    parser = argparse.ArgumentParser(description="Check CódigoFlow HTTP health")
    parser.add_argument("-H", "--host", default="127.0.0.1")
    parser.add_argument("-p", "--port", type=int, default=8080)
    parser.add_argument("-u", "--path", default="/")
    parser.add_argument("-w", "--warning", type=float, default=5.0, help="Warning threshold seconds")
    parser.add_argument("-c", "--critical", type=float, default=10.0, help="Critical threshold seconds")
    args = parser.parse_args()

    url = f"http://{args.host}:{args.port}{args.path}"
    started = time.time()
    try:
        with urllib.request.urlopen(url, timeout=max(args.critical, 1.0)) as resp:
            code = resp.getcode()
            _ = resp.read(256)
        elapsed = time.time() - started
    except urllib.error.HTTPError as exc:
        print(f"CRITICAL - HTTP {exc.code} for {url}")
        return CRITICAL
    except Exception as exc:  # noqa: BLE001 - plugin must map all failures
        print(f"CRITICAL - {exc}")
        return CRITICAL

    if code >= 500:
        print(f"CRITICAL - HTTP {code} - {elapsed*1000:.0f}ms | time={elapsed:.3f}s")
        return CRITICAL
    if code >= 400:
        print(f"WARNING - HTTP {code} - {elapsed*1000:.0f}ms | time={elapsed:.3f}s")
        return WARNING
    if elapsed >= args.critical:
        print(f"CRITICAL - HTTP {code} slow {elapsed*1000:.0f}ms | time={elapsed:.3f}s")
        return CRITICAL
    if elapsed >= args.warning:
        print(f"WARNING - HTTP {code} slow {elapsed*1000:.0f}ms | time={elapsed:.3f}s")
        return WARNING

    print(f"OK - HTTP {code} - {elapsed*1000:.0f}ms | time={elapsed:.3f}s")
    return OK


if __name__ == "__main__":
    sys.exit(main())
