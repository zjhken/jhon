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

### Simple API (plain JS values)

```typescript
function parse(input: string): JhonValue;
function serialize(value: JhonValue, options?: SerializeOptions): string;
function serializePretty(value: JhonValue, options?: SerializePrettyOptions): string;
```

- `parse` returns a plain JS value. The result is usually an object (for a `key=value` document), but per SPEC §2 it can also be an array (top-level bare values), or `null` (empty / whitespace-only / comments-only input). Throws `JhonParseError` on syntax errors.
- `serialize` produces compact single-line output. No spaces around `=` or after `,`. No trailing commas. Top-level arrays emit bare (no surrounding `[]`); empty containers and `null` emit the empty string.
- `serializePretty` produces multi-line output with one pair per line. Spaces around `=`. **No trailing commas, no commas between properties** (newline-only separators — see SPEC §7.1). Top-level arrays emit one element per line with no `[]`.

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

JHON documents are usually `key=value` pairs (an object), but the top level can also be an **implicit array** of bare values. The first top-level element decides: if it's a `key=value` pair, the document is an object; if it's anything else (scalar, `{...}`, `[...]`), the document is an array with the surrounding `[]` omitted. Top-level braces/brackets are always single elements, never document wrappers.

```
// Object mode (default)
name = "John"
age = 30
server = { host = "localhost", port = 5432 }
features = [
  "auth"
  "api"
]

// Array mode — top-level scalars or literals
42                                    // → [42]
1
2
"haha"
{a=4}                                 // → [1, 2, "haha", {"a": 4}]

// Empty input → null
""                                    // → null
```

Separators between items are either commas or newlines (but two items on the same line must use a comma). Mixing `key=value` pairs with bare values at the top level is an error.

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

- Top-level scalars are valid — they parse to a single-element array.
- Top-level `{...}` parses to a single-element array containing the object (e.g. `{a=1}` → `[{"a": 1}]`). Top-level `[...]` does the same for arrays.
- Mixing `key=value` pairs with bare values at the top level is an error (e.g. `a=1\n2`).
- Duplicate keys in the same object are an error.
- Empty input (empty string, whitespace-only, or comments-only) parses to `null`.
- Empty containers (`{}`, `[]`) and `null` all serialize to the empty string at the top level and re-parse to `null` — round-trip for these is intentionally broken.
- Trailing commas are allowed everywhere.

## Performance

Benchmarked against `JSON.parse` / `JSON.stringify` (V8 native) on Apple Silicon, 100,000 iterations each, with the same Small and Medium inputs the Rust criterion bench uses.

| Operation | JHON | JSON (native) | vs JSON |
|-----------|------|---------------|---------|
| Parse Small | ~870 ns | ~90 ns | 9.5x slower |
| Parse Medium | ~4,050 ns | ~435 ns | 9.2x slower |
| Serialize Small | ~335 ns | ~70 ns | 4.8x slower |
| Serialize Medium | ~1,560 ns | ~230 ns | 6.8x slower |

The absolute numbers are ~30x faster than v1.x (which measured 24,900 ns for parse-small) thanks to the rewrite — the parser is now byte-by-byte (no regex, no string concatenation in hot loops), the serializer uses cached indent strings, and comments are attached in a single post-pass rather than tokenized separately.

For configuration files (typically <10 KB), JHON parse latency is well under a millisecond — well below file I/O and editor paint time. The 9x gap to native JSON is the cost of JHON's extra features (comments, raw strings, radix literals, flexible separators, position tracking for diagnostics).

Reproduce: `bun run benchmark` (parse-only) or see the script in commit history for the Small/Medium comparison.

## Publishing

The package is published to npm as `@zjhken/jhon` (scoped). One-time setup for a maintainer account:

1. Create a granular access token at <https://www.npmjs.com/settings/~/tokens>. Pick "Granular Access Token", scope it to the `@zjhken/jhon` package, and select **Publishing** permission. Set **Require 2FA** to "off" for this token only (the publish step uses the token directly, not a TOTP prompt).
2. Authenticate the local CLI — either via browser flow (`pnpm login` and follow the prompt) or by saving the token from step 1 to your global npm config:
   ```bash
   npm config set //registry.npmjs.org/:_authToken=YOUR_ACCESS_TOKEN
   ```
3. From this directory, build and publish:
   ```bash
   cd typescript
   bun run build         # emits dist/ (prepublishOnly also runs this)
   npm publish --access public
   ```

`--access public` is required because scoped packages default to restricted (private) on npm. The `prepublishOnly` script runs `tsc` before publish so the `dist/` is always fresh.

## v2 migration

v2.0.0 is a clean rewrite. Notable changes from v1.x:

- **Strict spec compliance.** v1 silently accepted many malformed inputs (`+5`, `0Xff`, `5u8`, duplicate keys, etc.) and produced wrong values. v2 throws `JhonParseError` per SPEC §8.
- **`sortKeys` default flipped to `false`.** SPEC §5.4 mandates insertion order; v1 sorted alphabetically by default. Pass `{ sortKeys: true }` to opt into sorting.
- **Pretty mode no longer emits commas.** SPEC §7.1 mandates newline-only separators with no trailing commas. v1 emitted commas.
- **New rich API:** `parseAst`, `serializeAstCompact`, `serializeAstPretty`, `astToValue` for tooling that needs positions or comment preservation.
- **`JhonParseError` now carries line/column/endLine/endColumn** for IDE diagnostics.
- **Removed runtime dependency on `toml`** (it was only used by the benchmark).

## v2.1 migration (SPEC v2.1)

v2.1.0 updates the package to SPEC v2.1. Breaking changes:

- **`parse()` return type widened from `JhonObject` to `JhonValue`.** Documents in array mode now return an array, and empty/whitespace/comments-only input returns `null`. Code that assumed `parse(s)` was always an object needs to handle the array and null cases (or use `parseAst` for explicit AST access).
- **Top-level scalars are now valid.** A bare `42`, `"haha"`, `true`, or `null` parses to a single-element array. Previously these were parse errors.
- **Top-level `{...}` and `[...]` are no longer document wrappers.** `{a=1}` now parses to `[{"a": 1}]` (was `{"a": 1}`), and `[1,2,3]` now parses to `[[1,2,3]]` (was `[1,2,3]`). The braces/brackets are always treated as a single element of the implicit top-level array.
- **Empty input parses to `null`** instead of `{}`. This includes whitespace-only and comments-only input.
- **Empty containers and `null` serialize to the empty string.** `serialize({})`, `serialize([])`, and `serialize(null)` all emit `""`. They re-parse to `null`, so round-trip is intentionally broken for these.
- **Top-level arrays serialize bare (no surrounding `[]`).** `serialize([1, 2, 3])` returns `"1,2,3"`. Nested arrays preserve their brackets.

## License

MIT
