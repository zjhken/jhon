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

Benchmark results across multiple implementations (nanoseconds per operation):

### Parse Performance

| Language | Parse Small | Parse Medium | vs JSON (Small) | vs JSON (Medium) |
|----------|-------------|--------------|------------------|------------------|
| **Rust** | 238 ns | 1,133 ns | 1.29x slower | 1.38x slower |
| **Go** | 223 ns | 1,234 ns | **2.19x faster** | **1.56x faster** |
| **Java** | 181 ns | 1,560 ns | **2.60x faster** | **1.38x faster** |
| **Python** | 4,488 ns | 25,565 ns | 7.98x slower | 21.02x slower |
| **TypeScript** | 24,900 ns | ~70,000 ns | 9.19x slower | ~8x slower |

### Serialize Performance

| Language | Serialize Small | Serialize Medium | vs JSON (Small) | vs JSON (Medium) |
|----------|-----------------|------------------|-----------------|------------------|
| **Rust** | 130 ns | 468 ns | 2.38x slower | 1.55x slower |
| **Go** | 134 ns | 845 ns | **2.13x faster** | **1.42x faster** |
| **Java** | 519 ns | 2,078 ns | **2.50x faster** | **1.15x faster** |
| **Python** | 1,248 ns | 8,818 ns | 1.51x slower | 5.77x slower |

### Key Takeaways

- **Go and Java** implementations are **faster than standard JSON** libraries for both parsing and serialization
- **Rust** implementation is competitive within 1.3-2.4x of highly optimized serde_json
- **Python/TypeScript** trade some performance for developer convenience (typical for config files)

**Benchmark Details:**
- Small: `name="John",age=30,active=true,score=95.5`
- Medium: Nested objects with arrays, ~300 characters
- Hardware: Apple M2/M4 Pro
- JSON libraries: serde_json (Rust), stdlib (Go), Gson (Java), stdlib (Python), native (TS)

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
