# JHON

**JHON (JinHui's Object Notation)** is a configuration language that uses a clean `key=value` syntax with full JSON data-model compatibility, plus comments, raw strings, and flexible separators. See [`SPEC.md`](./SPEC.md) for the canonical language specification.

The Rust impl at [`rust/`](./rust/) is the spec reference; the other four implementations (Go, Java, Python, TypeScript) mirror its behavior.

## Features

- **Human-friendly syntax**: `key=value` instead of `"key": value`
- **Comments**: `//` line and `/* */` block comments
- **Raw strings**: Rust-style `r"..."` / `r#"..."#` for paths, regexes, and other backslash-heavy content
- **Flexible separators**: commas or newlines between items
- **Radix literals**: hex (`0xff`), octal (`0o777`), binary (`0b1010`), exponents (`1.5e-3`), underscore digit separators (`1_000_000`)
- **Strict spec compliance**: every malformed input is rejected with a positioned error
- **IDE support**: VSCode extension with syntax highlighting, comment-preserving formatter, live diagnostics, and a "Format to One Line" command
- **Five reference implementations**: Rust, Go, Java, Python, TypeScript — all spec-compliant and benchmarked

## Implementations

| Directory | Language | Package |
|-----------|----------|---------|
| [`rust/`](./rust/) | Rust 2024 | `jhon` on crates.io (v2.1.0) |
| [`golang/`](./golang/) | Go 1.21 | `github.com/zjhken/jhon/golang/v2` (v2.1.1) |
| [`java/`](./java/) | Java 21 | `dev.jhon:jhon` (Maven) |
| [`python/`](./python/) | Python 3.12 | `jhon` on PyPI |
| [`typescript/`](./typescript/) | TypeScript 5 / ES2022 | `@zjhken/jhon` on npm (v2.1.0) |
| [`vscode-ext/`](./vscode-ext/) | TypeScript | `JHON Language Support` on the VSCode Marketplace |

## Quick start (TypeScript)

```bash
npm install @zjhken/jhon
# or: bun add @zjhken/jhon
```

```typescript
import { parse, serialize, serializePretty } from '@zjhken/jhon';

const config = parse(`
  // Server configuration
  name = "my-app"
  port = 3000
  debug = true
  database = { host = "localhost", port = 5432 }
  features = ["auth", "api", "logging"]
`);

// Compact single-line JHON (no spaces around =, no spaces after commas)
serialize(config);
// → 'name="my-app",port=3000,debug=true,database={host="localhost",port=5432},features=["auth","api","logging"]'

// Pretty multi-line JHON (spaces around =, newline-only separators, no trailing commas)
serializePretty(config);
```

For the Rust, Go, Java, and Python equivalents, see each impl's directory.

## Syntax

### Basic values

```jhon
// Strings: double-quoted, single-quoted, or raw
name = "John"
nickname = 'Johnny'
path = r"C:\path\to\file"

// Numbers: decimal, hex, octal, binary, with underscores
count = 42
temperature = -5.3
large = 1_000_000
hex_color = 0xFF00FF
mask = 0o777
flags = 0b1010_0011

// Booleans and null
active = true
deleted = false
placeholder = null
```

**Same-line items need a comma.** Spaces or tabs alone between items on the same line are an error per SPEC §5.3 — use a comma or a newline.

### Arrays and objects

```jhon
tags = ["typescript", "config", "json"]
numbers = [1, 2, 3, 4, 5]

database = {
  host = "localhost"
  port = 5432
  credentials = {
    user = "admin"
    password = r"raw\password"
  }
}
```

### Top-level values and the implicit array

A JHON document doesn't have to be an object. If the first top-level element is anything other than a `key=value` pair, the whole document is treated as an array (with the surrounding `[]` omitted):

```jhon
// All of these are array-mode documents:

42                                    // → [42]
"haha"                                // → ["haha"]

1
2
"haha"
{a=4}                                 // → [1, 2, "haha", {"a": 4}]
```

Top-level `{...}` and `[...]` are always single elements of the implicit array (never document wrappers):

```jhon
{a=1}                                 // → [{"a": 1}]    (NOT {"a": 1})
[1, 2, 3]                             // → [[1, 2, 3]]   (NOT [1, 2, 3])
```

An empty document (empty string, whitespace-only, or comments-only) parses to `null` — distinct from `{}` and `[]`, and the canonical "no data" marker.

Mixing `key=value` pairs with bare values at the top level is a syntax error (`a=1\n2`); the first element decides the mode for the whole document.



### Comments

```jhon
// Single-line comment
setting = "value"  /* inline block comment */

/*
  Multi-line block comment
  for longer explanations
*/
complex_setting = {
  nested = true  // comments inside objects work too
}
```

### Raw strings

```jhon
simple = r"Hello, World!"
with_quotes = r#"He said "Hello" to me"#
multiline = r#"This is a
multi-line string without escaping"#
regex = r"\d+\w+\s+"
```

## Cross-implementation API

| Language | Parse | Serialize (compact) | Serialize (pretty) |
|----------|-------|---------------------|--------------------|
| Rust | `jhon::parse(s) -> Result<Value, JhonError>` | `jhon::serialize(&v) -> String` | `jhon::serialize_pretty(&v, "  ") -> String` |
| Go | `jhon.Parse(s) (Value, error)` | `jhon.Serialize(v) string` | `jhon.SerializePretty(v, "  ") string` |
| Java | `Jhon.parse(s) throws JhonParseException` | `Jhon.serialize(o) String` | `Jhon.serializePretty(o, "  ") String` |
| Python | `jhon.parse(s) -> Any` | `jhon.serialize(v) -> str` | `jhon.serialize_pretty(v, "  ") -> str` |
| TypeScript | `parse(s): JhonValue` | `serialize(v): string` | `serializePretty(v): string` |

All five raise a typed error (with 1-based line/column) when the input violates SPEC §8.

### Rust (serde integration)

The Rust crate additionally supports serde's `Serialize`/`Deserialize` derive macros via the `Jhon` wrapper:

```rust
use jhon::{Jhon, from_str, to_string};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq)]
struct Config {
    name: String,
    port: u16,
    debug: bool,
}

let config = Config { name: "myapp".into(), port: 8080, debug: true };
let jhon = to_string(&config)?;
// → 'name="myapp",port=8080,debug=true'

let decoded: Config = from_str(r#"name="myapp",port=8080,debug=true"#)?;
```

**Cargo.toml:**

```toml
[dependencies]
jhon = "2"
serde = { version = "1", features = ["derive"] }
```

## Comparison with JSON

| Feature | JSON | JHON |
|---------|------|------|
| Key syntax | `"key": value` | `key=value` |
| Comments | No | Yes (`//` and `/* */`) |
| Trailing commas | No | Yes (in input) |
| Raw strings | No | Yes (`r"..."`, `r#"..."#`) |
| Radix literals (`0x`, `0o`, `0b`) | No | Yes |
| Underscore digit separators | No | Yes |
| Multi-line strings | No | Yes (raw strings) |
| Duplicate keys | Allowed | **Error** |
| Top-level scalar | Allowed | Allowed (parses to a single-element array) |
| Empty document | n/a | Parses to `null` |

## Performance

Benchmark results across multiple implementations (nanoseconds per operation). All numbers were re-measured fresh on the same Apple M5 machine for cross-language comparability after the v2.0 rewrites of the TypeScript, Go, Java, and Python implementations.

### Parse Performance

| Language | Parse Small | Parse Medium | vs JSON (Small) | vs JSON (Medium) |
|----------|-------------|--------------|------------------|------------------|
| **Rust** | 391 ns | 1,601 ns | 1.21x slower | 1.23x slower |
| **Go** | 291 ns | 1,385 ns | **2.13x faster** | **1.66x faster** |
| **Java** | 138 ns | 1,014 ns | **3.15x faster** | **1.07x faster** |
| **Python** | 7,520 ns | 38,948 ns | 14.60x slower | 30.65x slower |
| **TypeScript** | 870 ns | 4,050 ns | 9.67x slower | 9.31x slower |

### Serialize Performance

| Language | Serialize Small | Serialize Medium | vs JSON (Small) | vs JSON (Medium) |
|----------|-----------------|------------------|-----------------|------------------|
| **Rust** | 136 ns | 348 ns | 2.27x slower | 1.22x slower |
| **Go** | 195 ns | 807 ns | **1.83x faster** | **1.93x faster** |
| **Java** | 115 ns | 386 ns | **11.97x faster** | **6.34x faster** |
| **Python** | 2,377 ns | 11,986 ns | 3.80x slower | 9.41x slower |
| **TypeScript** | 335 ns | 1,560 ns | 4.79x slower | 6.78x slower |

### Key Takeaways

- **Java** is now faster than Gson on both parse and serialize — the v2.0 rewrite cut serialize times ~5x
- **Go** is consistently 1.6–2.1x faster than `encoding/json` on both operations
- **Rust** remains within 1.2–2.3x of `serde_json` (itself highly optimized)
- **Python** v2.0 is slower than v1.x because it now tracks 1-based line/column on every character for error diagnostics (v1.x only tracked byte offset). Absolute numbers are still sub-millisecond for typical config files
- **TypeScript** is within an order of magnitude of native JSON (`JSON.parse` is itself highly optimized C++); the v2.0 rewrite dropped absolute parse times ~30x versus v1.x

**Benchmark Details:**
- Small: `name="John Doe",age=30,active=true,score=95.5`
- Medium: Nested objects with arrays (server/database/pool/features), ~300 characters — see `rust/benches/benchmark.rs`
- Hardware: Apple M5 (criterion for Rust; JMH fork=1 wi=2 i=3 for Java; `go test -bench=.` for Go; `bun run benchmark` for TypeScript; `uv run python benchmark_jhon.py` for Python)
- JSON libraries: `serde_json` (Rust), `encoding/json` (Go), Gson (Java), stdlib (Python), native (TypeScript)

For configuration files (typically <10 KB), parse latency is well under a millisecond across every implementation — well below file I/O and editor paint time.

## IDE Support

The VSCode extension ([`vscode-ext/`](./vscode-ext/)) provides:

- **Syntax highlighting** for `.jhon` files (TextMate grammar covering comments, strings, raw strings, numbers, keywords, and structural punctuation)
- **Comment-preserving formatter** — Format Document (`Shift+Alt+F`) and Format Selection rewrite the document to pretty-printed JHON while keeping `//` and `/* */` comments attached to their owning nodes
- **Live diagnostics** — red squiggles under SPEC §8 violations as you type, plus entries in the Problems panel
- **"JHON: Format to One Line"** command — collapses the document to compact single-line JHON

Install from the VSCode Marketplace by searching for "JHON Language Support", or via the command line:

```bash
code --install-extension Jinhui-ZHANG.jhon-syntax-highlight
```

## License

MIT. See [LICENSE](./LICENSE).
