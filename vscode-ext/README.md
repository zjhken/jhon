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

A JHON document doesn't have to be an object. If the first top-level element is anything other than a `key=value` pair, the whole document is treated as an array (with the surrounding `[]` omitted):

```jhon
// Array-mode document
1
2
"haha"
{a=4}
// → [1, 2, "haha", {"a": 4}]
```

An empty document (empty string, whitespace-only, or comments-only) parses to `null`.

### Key rules (per SPEC.md)

1. **Separators are commas OR newlines** — two items on the **same line** require a comma (SPEC §5.3). Spaces alone between items are an error.
2. **Comments** — `//` line comments and `/* */` block comments (non-nesting). May appear anywhere whitespace is allowed.
3. **Strings** — double or single quoted, with escapes `\n \t \r \b \f \" \' \\ \/ \uXXXX \xXX`. Unknown escapes are errors. Literal control characters are forbidden.
4. **Raw strings** — Rust-style `r"..."` / `R"..."` with optional `#` delimiters (`r#"..."#`, `r##"..."##`). No escape processing. May span multiple lines.
5. **Numbers** — decimal (`42`, `1_000_000`), hex (`0xff`), octal (`0o777`), binary (`0b1010`), floats (`3.14`, `1.5e-3`). Underscores allowed between digits only. Radix prefixes are lowercase only.
6. **Keys** — bare identifiers may contain any character except whitespace, `=`, `,`, `{ } [ ]`, `/`, `" '`, and `#`. Unicode letters, digits, hyphens, dots, and emoji are all valid in any position.
7. **Top-level** — object mode (a sequence of `key=value` pairs, braces optional) **or** array mode (any sequence of bare values; the surrounding `[]` is implicit). The first top-level element decides the mode; mixing pairs and bare values is an error. Top-level `{...}` and `[...]` are always single elements of the implicit array, never document wrappers. Empty input parses to `null`.
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

The formatter wraps the canonical `@zjhken/jhon` parser/serializer. It produces **pretty** output per SPEC §7.1: multi-line, spaces around `=`, **newline-only separators (no commas)**, no trailing commas. The formatter handles both object-mode and array-mode documents (per SPEC §2) — array-mode documents format as one element per line with no surrounding `[]`.

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

## Publishing

This section is for maintainers releasing a new version to the VS Code Marketplace.
Publishing is driven by the [`vsce`](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
CLI; the `vscode:prepublish` hook in `package.json` already compiles the extension before
each release, so the steps below are only the account and CLI workflow.

### Prerequisites

- **Node.js** installed.
- **`vsce`** — install globally with `npm install -g @vscode/vsce`, or run ad-hoc via
  `npx @vscode/vsce` / `bunx vsce`.

### One-time setup

1. **Create a publisher** at <https://marketplace.visualstudio.com/manage> — the ID must be
   `JinhuiZhang` to match `package.json`. Sign in with the Microsoft account that owns the
   extension.
2. **Generate a Personal Access Token (PAT)** from Azure DevOps
   (<https://dev.azure.com> → User settings → *Personal access tokens* → *New Token*) with:
   - **Organization**: *All accessible organizations*
   - **Scopes**: *Custom defined* → show all scopes → **Marketplace → Manage**

   Copy the token immediately — it is shown only once.
3. **Log in locally**:

   ```shell
   vsce login JinhuiZhang
   ```

   Paste the PAT when prompted. The login is cached for future publishes.

### Package for local testing

```shell
vsce package
```

Produces `JHON-lang-support-<version>.vsix` in the extension root. Install it from VS Code
via the Extensions view → "..." → *Install from VSIX…*, or:

```shell
code --install-extension JHON-lang-support-<version>.vsix
```

### Publish

```shell
vsce publish                # publishes the version currently in package.json
vsce publish patch          # bumps 2.1.1 → 2.1.2, commits, tags, and publishes
vsce publish minor          # 2.1.1 → 2.2.0
vsce publish major          # 2.1.1 → 3.0.0
```

The `vscode:prepublish` hook runs `bun run compile` automatically before packaging, so no
manual build step is needed. The new version appears within a few minutes on the
[publisher management page](https://marketplace.visualstudio.com/manage/publishers/JinhuiZhang)
and at the extension's Marketplace URL.

### Unpublish or remove a version

Both actions live on the [publisher management page](https://marketplace.visualstudio.com/manage)
under *More Actions*:

- **Unpublish** — hides the extension from search/install but keeps stats; reversible.
- **Remove** — irreversible; the extension id is permanently reserved and cannot be reused.
- **Delete a specific version** — *More Actions → Reports → Manage → Delete this version*.
  The latest version cannot be deleted, and a deleted version number cannot be republished.

### Common pitfalls

- **PAT rejected at login/publish** — the two usual causes are picking a specific
  organization instead of *All accessible organizations*, or a scope other than
  *Marketplace → Manage*.
- **"The extension already exists in the Marketplace"** — both `name` and `displayName`
  must be globally unique; bumping the version is not enough if either collides with
  another extension.
- **SVG assets rejected** — `icon.png` and any images referenced from this README must be
  PNG (not SVG), and image URLs in the README must be HTTPS.

## Author

**Jinhui ZHANG** — [GitHub](https://github.com/zjhken)
