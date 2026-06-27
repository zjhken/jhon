"""
JHON vs JSON benchmark for Python.

Mirrors the Rust criterion bench inputs (small + medium) so cross-language
comparisons are apples-to-apples. Run with `uv run python benchmark_jhon.py`.
"""

import json
import time

from jhon import parse, serialize


# =============================================================================
# Benchmark inputs — same as rust/benches/benchmark.rs
# =============================================================================

SMALL_JHON = 'name="John Doe",age=30,active=true,score=95.5'
SMALL_JSON = '{"name":"John Doe","age":30,"active":true,"score":95.5}'

MEDIUM_JHON = """
server={host="localhost",port=8080,ssl={enabled=true,cert_path="/etc/ssl/cert.pem"}},
database={host="db.example.com",port=5432,name="myapp",pool={min_size=5,max_size=100,timeout=30_000}},
features=["auth","logging","caching"],
debug=false,
version=1_000_000
"""

MEDIUM_JSON = """{
    "server": {"host": "localhost", "port": 8080, "ssl": {"enabled": true, "cert_path": "/etc/ssl/cert.pem"}},
    "database": {"host": "db.example.com", "port": 5432, "name": "myapp", "pool": {"min_size": 5, "max_size": 100, "timeout": 30000}},
    "features": ["auth", "logging", "caching"],
    "debug": false,
    "version": 1000000
}"""


def bench(label: str, fn, iters: int = 100_000) -> float:
    # warmup
    for _ in range(1000):
        fn()
    start = time.perf_counter()
    for _ in range(iters):
        fn()
    elapsed = time.perf_counter() - start
    ns_per_op = (elapsed * 1_000_000_000) / iters
    print(f"  {label:32s} {ns_per_op:>10.0f} ns/op")
    return ns_per_op


def main() -> None:
    print("=== Parse ===")
    j_small = bench("parse small jhon", lambda: parse(SMALL_JHON))
    n_small = bench("parse small json", lambda: json.loads(SMALL_JSON))
    j_med = bench("parse medium jhon", lambda: parse(MEDIUM_JHON))
    n_med = bench("parse medium json", lambda: json.loads(MEDIUM_JSON))
    print(f"  small  jhon/json ratio: {j_small / n_small:.2f}x slower")
    print(f"  medium jhon/json ratio: {j_med / n_med:.2f}x slower")

    print("\n=== Serialize ===")
    small_val = json.loads(SMALL_JSON)
    med_val = json.loads(MEDIUM_JSON)
    js_small = bench("ser small jhon", lambda: serialize(small_val))
    ns_small = bench("ser small json", lambda: json.dumps(small_val))
    js_med = bench("ser medium jhon", lambda: serialize(med_val))
    ns_med = bench("ser medium json", lambda: json.dumps(med_val))
    print(f"  small  jhon/json ratio: {js_small / ns_small:.2f}x slower")
    print(f"  medium jhon/json ratio: {js_med / ns_med:.2f}x slower")


if __name__ == "__main__":
    main()
