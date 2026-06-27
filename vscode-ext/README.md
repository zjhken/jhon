# JHON Language Support

> JHON === **JinHui's Object Notation** — a configuration language with `key=value` syntax, comments, raw strings, and flexible separators.

## Overview

This VSCode extension provides syntax highlighting, formatting, and live diagnostics for JHON files (`.jhon`). The parser is the canonical TypeScript implementation at `@zjhken/jhon`, mirrored from the Rust reference — see `../SPEC.md` for the language spec.

## Features

- **Syntax highlighting** for JHON: comments, strings (including raw strings), numbers (decimal, hex, octal, binary, exponents), booleans, null, nested objects and arrays
- **Document and range formatting** (Shift+Alt+F) that preserves your comments through round-trips
- **Live diagnostics** — red squiggles under spec violations as you type, with entries in the Problems panel
- **"Format to One Line"** command that collapses the document to compact JHON
- **Strict spec compliance** — every rule in SPEC §8 is enforced, so malformed input is reported immediately

## JHON syntax example

```jhon
// Application configuration
app_name = "ocean-note"
version = "1.0.0"

// Feature flags
features = ["markdown", "collaboration", "real-time"]

// Database configuration
database = {
  host = "localhost"
  port = 5432
  name = "mydb"
  credentials = [
    { user = "admin", role = "owner" }
    { user = "reader", role = "readonly" }
  ]
}

max_file_size = 1_048_576
timeout = 30.5
debug = true
log_level = "info"
```

### Key rules (per SPEC.md)

1. **Separators are commas OR newlines** — two items on the **same line** require a comma (SPEC §5.3). Spaces alone between items are an error.
2. **Comments** — `//` line comments and `/* */` block comments (non-nesting). May appear anywhere whitespace is allowed.
3. **Strings** — double or single quoted, with escapes `\n \t \r \b \f \" \' \\ \/ \uXXXX \xXX`. Unknown escapes are errors. Literal control characters are forbidden.
4. **Raw strings** — Rust-style `r"..."` / `R"..."` with optional `#` delimiters (`r#"..."#`, `r##"..."##`). No escape processing. May span multiple lines.
5. **Numbers** — decimal (`42`, `1_000_000`), hex (`0xff`), octal (`0o777`), binary (`0b1010`), floats (`3.14`, `1.5e-3`). Underscores allowed between digits only. Radix prefixes are lowercase only.
6. **Keys** — bare identifiers may contain any character except whitespace, `=`, `,`, `{ } [ ]`, `/`, `" '`, and `#`. Unicode letters, digits, hyphens, dots, and emoji are all valid in any position.
7. **Top-level** — objects (braces optional) or arrays. Scalars at top level are errors.
8. **Duplicate keys** in the same object are an error.

## Raw string examples

```jhon
// Simple raw string
simple = r"Hello, World!"

// Raw string containing quotes
with_quotes = r#"He said "Hello" to me"#

// Multi-line raw string
multiline = r#"This is a
multi-line
string without escaping"#

// Raw string with special characters
path = r"C:\Users\name\file.txt"
regex = r"\d+\w+\s+"
```

## Installation

### From VSCode Marketplace

Search for "JHON Language Support" in the VSCode extensions panel.

### Manual installation

1. Download the latest `.vsix` from the [Releases](https://github.com/zjhken/jhon/releases) page
2. Open VSCode → Extensions panel → "..." menu → "Install from VSIX..."
3. Select the downloaded file

## Usage

Create a file with the `.jhon` extension. The extension automatically activates and provides highlighting, formatting, and diagnostics.

## Formatter

The formatter wraps the canonical `@zjhken/jhon` parser/serializer. It produces **pretty** output per SPEC §7.1: multi-line, spaces around `=`, **newline-only separators (no commas)**, no trailing commas.

### Formatting features

- **Document formatting**: Format Document (`Shift+Alt+F` on Windows/Linux, `Shift+Option+F` on Mac)
- **Range formatting**: Format Selection on the highlighted region
- **Format on save**: enable via VSCode's `editor.formatOnSave` setting

### Compact format command

The **"JHON: Format to One Line"** command (Command Palette) collapses the entire document into compact JHON — single line, no spaces around `=`, no spaces after commas, no trailing commas.

### Configuration

Customize the formatter in `settings.json`:

```jsonc
{
  // Enable/disable the JHON formatter (default: true)
  "jhon.format.enable": true,

  // Use spaces for indentation vs. tabs (default: false → tabs)
  "jhon.format.insertSpaces": false,

  // Number of spaces per indent level when insertSpaces is true,
  // or visual size of one tab (default: 2)
  "jhon.format.tabSize": 2,

  // Sort object keys alphabetically on serialize.
  // Default false — SPEC §5.4 mandates insertion order.
  "jhon.format.sortKeys": false,

  // Enable live parse-error diagnostics (default: true)
  "jhon.diagnostics.enable": true,

  // Debounce window (ms) after a keystroke before re-parsing (default: 300)
  "jhon.diagnostics.debounceMs": 300
}
```

### Formatter example

**Input** (compact, key order scrambled):

```jhon
debug=true,version="1.0.0",app_name="ocean-note",database={name="mydb",port=5432,host="localhost"},features=["markdown","collaboration","real-time"]
```

**After "Format Document"** (default settings — preserves insertion order, no commas):

```jhon
debug = true
version = "1.0.0"
app_name = "ocean-note"
database = {
  name = "mydb"
  port = 5432
  host = "localhost"
}
features = [
  "markdown"
  "collaboration"
  "real-time"
]
```

**After "JHON: Format to One Line"**:

```jhon
debug=true,version="1.0.0",app_name="ocean-note",database={name="mydb",port=5432,host="localhost"},features=["markdown","collaboration","real-time"]
```

## Diagnostics

When `jhon.diagnostics.enable` is true, the extension parses the document live (debounced by `jhon.diagnostics.debounceMs` ms after the last keystroke, and on save). Any SPEC.md violation produces a red squiggle and an entry in the Problems panel:

- Top-level scalars (`42`, `"foo"`, `true`, `null` alone)
- Same-line items without a comma (`a=1 b=2`)
- Malformed numbers (`+5`, `0Xff`, `5u8`, `5_`, `_5`, `5__5`)
- Duplicate keys
- Unknown escapes (`"foo\q"`)
- Literal control chars in strings
- Unterminated strings, raw strings, comments, arrays, objects
- Unbalanced braces/brackets
- Empty keys
- Top-level array followed by other content

The diagnostic source is labeled `jhon`, and the range reflects the offending token's source position.

## File association

`.jhon` files are automatically associated with the JHON language.

## License

MIT. See [LICENSE](LICENSE) for the full text.

## Contributing

Contributions are welcome — please open a Pull Request at [github.com/zjhken/jhon](https://github.com/zjhken/jhon).

## Author

**Jinhui ZHANG** — [GitHub](https://github.com/zjhken)
