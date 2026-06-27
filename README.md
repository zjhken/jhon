# JHON

**JHON (JinHui's Object Notation)** is a configuration language that provides a cleaner, more readable alternative to JSON while maintaining full compatibility with JSON data structures.

## Features

- **Human-Friendly Syntax**: Simple `key=value` format instead of JSON's `"key": "value"`
- **Comments**: Native support for single-line (`//`) and multi-line (`/* */`) comments
- **Rich Data Types**: Strings, numbers, booleans, null, arrays, and objects
- **Raw Strings**: Rust-inspired raw strings for paths and patterns (e.g., `r"C:\path"`)
- **Clean Formatting**: Simple syntax with commas or newlines as separators
- **Zero Dependencies**: Lightweight TypeScript implementation with no external dependencies
- **IDE Support**: VSCode extension with syntax highlighting and formatting

## Installation

### npm

```bash
npm install jhon
```

### CDN

```html
<script src="https://unpkg.com/jhon/dist/jhon.min.js"></script>
```

## Quick Start

```javascript
import { parse, stringify } from 'jhon';

// Parse JHON to JSON
const config = parse(`
  app_name="ocean-note"
  version="1.0.0"
  debug=true
  database={host="localhost",port=5432}
`);

// Serialize JSON to JHON
const jhon = stringify({ app_name: "myapp", features: ["a", "b"] });
```

## Syntax Examples

### Basic Values

```jhon
// Strings with different quote styles
name="John" nickname='Johnny' raw=r"C:\path\to\file"

// Numbers with optional underscores
count=42 temperature=-5.3 large=1_000_000

// Booleans and null
active=true deleted=false placeholder=null
```

### Arrays and Objects

```jhon
// Arrays
tags=["typescript", "config", "json"]
numbers=[1, 2, 3, 4, 5]

// Nested objects
database={
  host="localhost"
  port=5432
  credentials={
    user="admin"
    password=r"raw\password"
  }
}
```

### Comments

```jhon
// This is a single-line comment
setting="value"  /* inline comment */

/*
  Multi-line comment
  for longer explanations
*/
complex_setting={
  // Nested comments work too
  key=value
}
```

## API Reference

### JavaScript/TypeScript

#### `parse(jhonString: string): object`

Parses a JHON string and returns the corresponding JavaScript object.

```javascript
const result = parse('name="John" age=30');
// { name: "John", age: 30 }
```

#### `stringify(value: object, options?: StringifyOptions): string`

Converts a JavaScript object to a JHON string.

```javascript
const jhon = stringify({ name: "John", age: 30 }, { pretty: true });
```

Options:
- `pretty`: Enable pretty-printing (default: `false`)
- `indent`: Indentation string (default: `"  "`)

#### `format(jhonString: string, options?: FormatOptions): string`

Formats an existing JHON string.

```javascript
const formatted = format(rawJhon, {
  indent: "  ",
  sortKeys: true,
  alignEquals: true
});
```

### Rust

The Rust crate supports serde's `Serialize`/`Deserialize` derive macros:

```rust
use jhon::{Jhon, from_str, to_string};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq)]
struct Config {
    name: String,
    port: u16,
    debug: bool,
}

// Serialize
let config = Config { name: "myapp".into(), port: 8080, debug: true };
let jhon = to_string(&config)?;
// Result: "debug=true,name=\"myapp\",port=8080"

// Deserialize
let decoded: Config = from_str("name=\"myapp\",port=8080,debug=true")?;
```

**Cargo.toml:**
```toml
[dependencies]
jhon = "0.1"
serde = { version = "1", features = ["derive"] }
```

## Comparison with JSON

| Feature | JSON | JHON |
|---------|------|------|
| Key syntax | `"key": value` | `key=value` |
| Comments | No | Yes (`//` and `/* */`) |
| Trailing commas | No | Yes |
| Raw strings | No | Yes (`r"..."`) |
| Multi-line strings | Limited | Flexible |
| Readability | Verbose | Clean |

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

JHON trades some raw performance in certain implementations for developer-friendly features (comments, raw strings, flexible syntax). For configuration files (typically <10KB), this performance difference is negligible.

## IDE Support

### VSCode Extension

Install the JHON extension for VSCode to get:
- Syntax highlighting for `.jhon` files
- Code formatting with customizable options
- Auto-completion support

```bash
code --install-extension jhon-vscode
```

## License

MIT
