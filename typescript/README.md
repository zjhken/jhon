# JHON - JinHui's Object Notation

A configuration language parser and serializer for TypeScript/JavaScript. JHON uses a clean `key=value` syntax with full JSON data-model compatibility, plus comments, raw strings, and flexible separators.

This is the canonical TypeScript implementation. The Rust impl at `../rust/` is the spec reference; behavior here mirrors it. See `../SPEC.md` for the language specification.

## Installation

```bash
bun add @zjhken/jhon
# or
npm install @zjhken/jhon
```

## Quick start

```typescript
import { parse, serialize, serializePretty } from '@zjhken/jhon';

const config = parse(`
  // Server configuration
  name = "my-app"
  port = 3000
  debug = true

  database = {
    host = "localhost"
    port = 5432
  }

  features = ["auth", "api", "logging"]
`);

// Serialize back to compact JHON (single line)
serialize(config);
// → 'database={host="localhost",port=5432},debug=true,features=["auth","api","logging"],name="my-app",port=3000'

// Serialize pretty (multi-line, spaces around =, no trailing commas)
serializePretty(config);
// → database = {
//     host = "localhost"
//     port = 5432
//   }
//   debug = true
//   ...
```

## API

### Simple API (plain JS objects)

```typescript
function parse(input: string): JhonObject;
function serialize(value: JhonValue, options?: SerializeOptions): string;
function serializePretty(value: JhonValue, options?: SerializePrettyOptions): string;
```

- `parse` returns a plain JS object. Throws `JhonParseError` on syntax errors.
- `serialize` produces compact single-line output. No spaces around `=` or after `,`. No trailing commas.
- `serializePretty` produces multi-line output with one pair per line. Spaces around `=`. **No trailing commas, no commas between properties** (newline-only separators — see SPEC §7.1).

```typescript
interface SerializeOptions {
  sortKeys?: boolean;  // default false — SPEC §5.4 mandates insertion order
}
interface SerializePrettyOptions extends SerializeOptions {
  indent?: string;     // default "  "
}
```

### Rich API (AST with comments and positions)

For tooling that needs to preserve comments or report error positions:

```typescript
function parseAst(input: string): AstDocument;
function serializeAstCompact(doc: AstDocument, options?: SerializeOptions): string;
function serializeAstPretty(doc: AstDocument, options?: SerializePrettyOptions): string;
function astToValue(doc: AstDocument): JhonValue;
```

`parseAst` returns a typed AST with source positions on every node and comment tokens attached to their owning nodes (leading / trailing / inner). The AST serializers preserve comments through round-trips. This is what the VSCode extension uses for format-on-save.

### Error type

```typescript
class JhonParseError extends Error {
  kind: 'syntax' | 'eof' | 'duplicate-key';
  line: number;       // 1-based
  column: number;     // 1-based
  endLine: number;
  endColumn: number;
  position: number;   // 0-based byte offset
  duplicateKey?: string;
}
```

## Syntax reference

JHON documents are `key=value` pairs. Top-level braces are optional. Separators between items are either commas or newlines (but two items on the same line must use a comma).

```
name = "John"
age = 30
server = { host = "localhost", port = 5432 }
features = [
  "auth"
  "api"
]
```

### Strings

- Double or single quoted: `"..."` / `'...'` — same escape rules.
- Escapes: `\n \t \r \b \f \" \' \\ \/ \uXXXX \xXX`. Unknown escapes are errors.
- Literal control characters (raw newline/tab) are forbidden inside regular strings — use escapes or a raw string.
- Raw strings: `r"..."`, `R"..."`, with optional `#` delimiters: `r#"..."#`, `r##"..."##`. No escape processing inside. May span multiple lines.

### Numbers

JHON adopts Rust's numeric literal syntax:

| Form | Example |
|------|---------|
| Decimal integer | `42`, `-5`, `1_000_000` |
| Hex | `0xff`, `0xDE_AD` |
| Octal | `0o777` |
| Binary | `0b1010_0011` |
| Float (fractional) | `3.14`, `-1_000.5` |
| Float (exponent) | `1e10`, `1.5E-3` |

- Underscores are digit separators. Leading, trailing, or adjacent underscores are errors.
- Radix prefixes are lowercase only (`0x`, `0o`, `0b`). Uppercase variants error.
- `+` prefix is not allowed. Type suffixes (`u8`, `i32`, etc.) are not allowed.
- All numbers serialize as decimal (per SPEC §3.5).

### Keys

Bare keys may contain any character except whitespace, `=`, `,`, `{ } [ ]`, `/`, `" '`, and `#`. This includes digits, hyphens, dots, Unicode letters, and emoji in any position. Keywords (`true`, `false`, `null`) used as keys are treated as the strings `"true"` / `"false"` / `"null"`. Keys containing an excluded character must be quoted.

### Comments

`//` to end of line. `/* ... */` block (non-nesting, may span multiple lines). Comments may appear anywhere whitespace is allowed.

### Other rules

- Top-level scalars are not valid documents.
- Top-level arrays are valid but must be the entire document.
- Duplicate keys in the same object are an error.
- Empty input parses to `{}`.
- Trailing commas are allowed everywhere.

## v2 migration

v2.0.0 is a clean rewrite. Notable changes from v1.x:

- **Strict spec compliance.** v1 silently accepted many malformed inputs (`+5`, `0Xff`, `5u8`, duplicate keys, etc.) and produced wrong values. v2 throws `JhonParseError` per SPEC §8.
- **`sortKeys` default flipped to `false`.** SPEC §5.4 mandates insertion order; v1 sorted alphabetically by default. Pass `{ sortKeys: true }` to opt into sorting.
- **Pretty mode no longer emits commas.** SPEC §7.1 mandates newline-only separators with no trailing commas. v1 emitted commas.
- **New rich API:** `parseAst`, `serializeAstCompact`, `serializeAstPretty`, `astToValue` for tooling that needs positions or comment preservation.
- **`JhonParseError` now carries line/column/endLine/endColumn** for IDE diagnostics.
- **Removed runtime dependency on `toml`** (it was only used by the benchmark).

## License

MIT
