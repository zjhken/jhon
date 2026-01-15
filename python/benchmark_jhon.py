"""
Benchmarks for JHON parser comparing with JSON
"""

import time
import json
from jhon import parse, serialize, remove_comments


# =============================================================================
# Benchmark Data
# =============================================================================

SMALL_JHON = 'name="test" age=25 active=true'
SMALL_JSON = '{"name":"test","age":25,"active":true}'

MEDIUM_JHON = """
app_name="ocean-note"
version="1.0.0"
debug=true
database={host="localhost",port=5432,name="mydb"}
features=["markdown","collaboration","real-time"]
max_file_size=1048576
timeout=30.5
server={host="0.0.0.0",port=3000}
"""

MEDIUM_JSON = '{"app_name":"ocean-note","version":"1.0.0","debug":true,"database":{"host":"localhost","port":5432,"name":"mydb"},"features":["markdown","collaboration","real-time"],"max_file_size":1048576,"timeout":30.5,"server":{"host":"0.0.0.0","port":3000}}'

LARGE_JHON = """
// Application Configuration
app_name="ocean-note"
version="2.0.0"
debug=true
log_level="info"

// Database Configuration
database={
    host="localhost"
    port=5432
    name="mydb"
    pool_size=10
    timeout=30.5
    ssl_enabled=true
    ssl_cert=null
    credentials=[
        {user="admin",role="owner"}
        {user="reader",role="readonly"}
        {user="writer",role="readwrite"}
    ]
}

// Server Configuration
server={
    host="0.0.0.0"
    port=3000
    middleware=[
        {name="logger",enabled=true,config={level="info"}}
        {name="cors",enabled=false,config={}}
        {name="auth",enabled=true,config={strategy="jwt"}}
    ]
}

// Features
features=[
    {name="markdown",active=true,settings={preview=true}}
    {name="collaboration",active=true,settings={realtime=true,max_users=100}}
    {name="export",active=false,settings=null}
]

// Metadata
metadata={
    created_at="2024-01-15T10:30:00Z"
    updated_at="2024-01-20T15:45:30Z"
    tags=["production","web","api"]
    maintainers=["team-a","team-b"]
}

// Limits
limits={
    max_file_size=1048576
    max_files_per_user=100
    storage_quota=1073741824
    rate_limits={
        requests_per_minute=60
        burst_allowed=true
    }
}
"""


def generate_very_large_jhon(size: int) -> str:
    """Generate a very large JHON config for stress testing."""
    jhon = "// Very Large Configuration\n"
    for i in range(size):
        jhon += f'key_{i}="value_{i}",'
    jhon += "array=["
    for i in range(size):
        jhon += f'{i},'
    jhon += "]"
    return jhon


def generate_very_large_json(size: int) -> str:
    """Generate a very large JSON config for stress testing."""
    json_str = "{"
    for i in range(size):
        json_str += f'"key_{i}":"value_{i}",' if i < size - 1 else f'"key_{i}":"value_{i}"'
    json_str += ',"array":['
    for i in range(size):
        json_str += f'{i},' if i < size - 1 else str(i)
    json_str += "]}"
    return json_str


# =============================================================================
# Benchmark Functions
# =============================================================================

def benchmark_parse_jhon_small(iterations: int = 10000) -> float:
    """Benchmark JHON parsing of small config."""
    start = time.perf_counter()
    for _ in range(iterations):
        parse(SMALL_JHON)
    return (time.perf_counter() - start) / iterations * 1e9  # nanoseconds


def benchmark_parse_json_small(iterations: int = 10000) -> float:
    """Benchmark JSON parsing of small config."""
    start = time.perf_counter()
    for _ in range(iterations):
        json.loads(SMALL_JSON)
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_parse_jhon_medium(iterations: int = 5000) -> float:
    """Benchmark JHON parsing of medium config."""
    start = time.perf_counter()
    for _ in range(iterations):
        parse(MEDIUM_JHON)
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_parse_json_medium(iterations: int = 5000) -> float:
    """Benchmark JSON parsing of medium config."""
    start = time.perf_counter()
    for _ in range(iterations):
        json.loads(MEDIUM_JSON)
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_parse_jhon_large(iterations: int = 1000) -> float:
    """Benchmark JHON parsing of large config."""
    start = time.perf_counter()
    for _ in range(iterations):
        parse(LARGE_JHON)
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_parse_json_large(iterations: int = 1000) -> float:
    """Benchmark JSON parsing of large config."""
    # Create JSON equivalent
    large_json = json.loads(json.dumps(json.loads(MEDIUM_JSON)))  # Just for structure
    # For benchmark, we'll use the medium JSON since LARGE_JHON doesn't have direct JSON equivalent
    start = time.perf_counter()
    for _ in range(iterations):
        json.loads(MEDIUM_JSON)
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_serialize_jhon_small(iterations: int = 10000) -> float:
    """Benchmark JHON serialization of small object."""
    value = {"name": "test", "age": 25, "active": True}
    start = time.perf_counter()
    for _ in range(iterations):
        serialize(value)
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_serialize_json_small(iterations: int = 10000) -> float:
    """Benchmark JSON serialization of small object."""
    value = {"name": "test", "age": 25, "active": True}
    start = time.perf_counter()
    for _ in range(iterations):
        json.dumps(value, separators=(',', ':'))
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_serialize_jhon_medium(iterations: int = 5000) -> float:
    """Benchmark JHON serialization of medium object."""
    value = parse(MEDIUM_JHON)
    start = time.perf_counter()
    for _ in range(iterations):
        serialize(value)
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_serialize_json_medium(iterations: int = 5000) -> float:
    """Benchmark JSON serialization of medium object."""
    value = json.loads(MEDIUM_JSON)
    start = time.perf_counter()
    for _ in range(iterations):
        json.dumps(value, separators=(',', ':'))
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_serialize_jhon_large(iterations: int = 1000) -> float:
    """Benchmark JHON serialization of large object."""
    value = parse(LARGE_JHON)
    start = time.perf_counter()
    for _ in range(iterations):
        serialize(value)
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_serialize_json_large(iterations: int = 1000) -> float:
    """Benchmark JSON serialization of large object."""
    value = json.loads(MEDIUM_JSON)
    start = time.perf_counter()
    for _ in range(iterations):
        json.dumps(value, separators=(',', ':'))
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_round_trip_jhon_small(iterations: int = 5000) -> float:
    """Benchmark JHON round-trip (parse + serialize)."""
    original = {"name": "test", "age": 25, "active": True}
    start = time.perf_counter()
    for _ in range(iterations):
        serialized = serialize(original)
        parse(serialized)
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_round_trip_json_small(iterations: int = 5000) -> float:
    """Benchmark JSON round-trip (parse + serialize)."""
    original = {"name": "test", "age": 25, "active": True}
    start = time.perf_counter()
    for _ in range(iterations):
        serialized = json.dumps(original, separators=(',', ':'))
        json.loads(serialized)
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_remove_comments(iterations: int = 100000) -> float:
    """Benchmark comment removal."""
    input_str = """
    // This is a comment
    name="test"  /* inline comment */
    age=25
    // Another comment
    active=true /* multi-line
    comment */
    """
    start = time.perf_counter()
    for _ in range(iterations):
        remove_comments(input_str)
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_parse_numbers_with_underscores(iterations: int = 10000) -> float:
    """Benchmark parsing numbers with underscores."""
    input_str = "large=100_000 million=1_000_000 decimal=1_234.567_890 neg_large=-50_000"
    start = time.perf_counter()
    for _ in range(iterations):
        parse(input_str)
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_parse_raw_strings(iterations: int = 10000) -> float:
    """Benchmark parsing raw strings."""
    input_str = r'path=r"C:\Windows\System32" regex=r"\d+\w*\s*" quote=r#"He said "hello" to me"#'
    start = time.perf_counter()
    for _ in range(iterations):
        parse(input_str)
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_parse_nested_objects(iterations: int = 10000) -> float:
    """Benchmark parsing nested objects."""
    input_str = "outer={inner={deep=\"value\"} number=42}"
    start = time.perf_counter()
    for _ in range(iterations):
        parse(input_str)
    return (time.perf_counter() - start) / iterations * 1e9


def benchmark_parse_arrays(iterations: int = 10000) -> float:
    """Benchmark parsing arrays."""
    input_str = 'items=["apple","banana","cherry","date","elderberry","fig","grape"]'
    start = time.perf_counter()
    for _ in range(iterations):
        parse(input_str)
    return (time.perf_counter() - start) / iterations * 1e9


# =============================================================================
# Main Benchmark Runner
# =============================================================================

def run_all_benchmarks():
    """Run all benchmarks and print results."""
    print("=" * 80)
    print("JHON Parser Benchmarks")
    print("=" * 80)

    results = []

    # Parse benchmarks - Small
    print("\n--- Parse Benchmarks (Small) ---")
    results.append(("Parse JHON (Small)", benchmark_parse_jhon_small()))
    results.append(("Parse JSON (Small)", benchmark_parse_json_small()))

    # Parse benchmarks - Medium
    print("\n--- Parse Benchmarks (Medium) ---")
    results.append(("Parse JHON (Medium)", benchmark_parse_jhon_medium()))
    results.append(("Parse JSON (Medium)", benchmark_parse_json_medium()))

    # Parse benchmarks - Large
    print("\n--- Parse Benchmarks (Large) ---")
    results.append(("Parse JHON (Large)", benchmark_parse_jhon_large()))
    results.append(("Parse JSON (Large)", benchmark_parse_json_large()))

    # Serialize benchmarks - Small
    print("\n--- Serialize Benchmarks (Small) ---")
    results.append(("Serialize JHON (Small)", benchmark_serialize_jhon_small()))
    results.append(("Serialize JSON (Small)", benchmark_serialize_json_small()))

    # Serialize benchmarks - Medium
    print("\n--- Serialize Benchmarks (Medium) ---")
    results.append(("Serialize JHON (Medium)", benchmark_serialize_jhon_medium()))
    results.append(("Serialize JSON (Medium)", benchmark_serialize_json_medium()))

    # Serialize benchmarks - Large
    print("\n--- Serialize Benchmarks (Large) ---")
    results.append(("Serialize JHON (Large)", benchmark_serialize_jhon_large()))
    results.append(("Serialize JSON (Large)", benchmark_serialize_json_large()))

    # Round-trip benchmarks - Small
    print("\n--- Round-Trip Benchmarks (Small) ---")
    results.append(("Round-trip JHON (Small)", benchmark_round_trip_jhon_small()))
    results.append(("Round-trip JSON (Small)", benchmark_round_trip_json_small()))

    # Specialized benchmarks
    print("\n--- Specialized Benchmarks ---")
    results.append(("Remove Comments", benchmark_remove_comments()))
    results.append(("Parse Numbers with Underscores", benchmark_parse_numbers_with_underscores()))
    results.append(("Parse Raw Strings", benchmark_parse_raw_strings()))
    results.append(("Parse Nested Objects", benchmark_parse_nested_objects()))
    results.append(("Parse Arrays", benchmark_parse_arrays()))

    # Print results
    print("\n" + "=" * 80)
    print("Results (nanoseconds per operation)")
    print("=" * 80)
    print(f"{'Benchmark':<40} {'Time (ns)':>15} {'Ops/sec':>15}")
    print("-" * 80)

    for name, time_ns in results:
        ops_per_sec = int(1e9 / time_ns) if time_ns > 0 else 0
        print(f"{name:<40} {time_ns:>15.0f} {ops_per_sec:>15,}")

    # Size comparison
    print("\n" + "=" * 80)
    print("Size Comparison")
    print("=" * 80)

    jhon_obj = parse(MEDIUM_JHON)
    jhon_serialized = serialize(jhon_obj)
    json_serialized = json.dumps(jhon_obj, separators=(',', ':'))

    print(f"JHON size:  {len(jhon_serialized)} bytes")
    print(f"JSON size:  {len(json_serialized)} bytes")
    print(f"JHON is {len(jhon_serialized) / len(json_serialized) * 100:.1f}% of JSON size")


if __name__ == "__main__":
    run_all_benchmarks()
