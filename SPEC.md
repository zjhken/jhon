# JHON Language Specification

**Version:** 2.1
**Status:** Canonical reference for all implementations (Rust, Go, Java, Python, TypeScript, VSCode extension).

When this document and an implementation diverge, **this spec wins**. Bugs in implementations should be fixed to match the spec, not the other way around.

---

## 1. Goals

JHON (JinHui's Object Notation) is a human-readable configuration format. It is a strict superset of JSON's data model (objects, arrays, strings, numbers, booleans, null) with a cleaner `key=value` surface, comments, raw strings, and flexible separators.

A JHON document always parses to exactly one JSON-compatible value.

---

## 2. Document Form

A JHON document is parsed in one of two modes, decided by the **first** top-level element:

### 2.1 Object mode

The document begins with a `key=value` pair. Every top-level element must be a `key=value` pair. The result is a JSON object.

```
name="x",port=80                    →  {"name": "x", "port": 80}
name="x"
port=80                              →  {"name": "x", "port": 80}
```

### 2.2 Array mode

The document begins with any value that is **not** a `key=value` pair — a scalar, an object literal (`{...}`), or an array literal (`[...]`). The whole document is treated as an array, with the surrounding `[]` omitted. Every top-level element must be a value; any `key=value` pair is a syntax error.

```
42                                  →  [42]
"haha"                              →  ["haha"]
1
2
"haha"
{a=4}                               →  [1, 2, "haha", {"a": 4}]
{a=1}
{b=2}                               →  [{"a": 1}, {"b": 2}]
```

**Top-level `{...}` and `[...]` are always single elements** of the implicit top-level array. They are never document wrappers:

```
{a=1}                               →  [{"a": 1}]            (NOT {"a": 1})
[1, 2, 3]                           →  [[1, 2, 3]]           (NOT [1, 2, 3])
```

### 2.3 Empty

An empty string, whitespace-only input, or comments-only input parses to a JSON `null`. This is the "Empty" form — distinct from `{}` and `[]`, and the canonical representation of "no data."

```
""                                  →  null
"   \n\t  "                         →  null
"// just a comment"                 →  null
```

### 2.4 Mixing modes is an error

A document that mixes `key=value` pairs with bare values at the top level is a syntax error:

```
a=1
2                                   →  ERROR (pair followed by scalar)
1
a=2                                 →  ERROR (scalar followed by pair)
```

The first element decides the mode; subsequent elements must match.

---

## 3. Lexical Structure

### 3.1 Whitespace
- Spaces (`U+0020`), tabs (`U+0009`), carriage returns (`U+000D`), newlines (`U+000A`) are whitespace.
- Whitespace is significant for separator rules (see §5.3).

### 3.2 Comments
- `//` — comment to end of line.
- `/* ... */` — block comment, may span multiple lines, **not** nested.
- Comments may appear anywhere whitespace is allowed.
- Comments are removed during parsing and are **not** preserved across round-trips. (The VSCode formatter is comment-preserving as a tooling feature; that is orthogonal to this spec.)

### 3.3 Bare Identifiers (Bare Keys)

A bare key is the longest run of characters that does **not** contain any of the following:

- Whitespace (space, tab, newline, carriage return)
- `=` (key/value delimiter)
- `,` (item separator)
- `{` `}` `[` `]` (object/array delimiters)
- `/` (comment starter)
- `"` `'` (string quotes)
- `#` (raw-string hash delimiter)

There is no constraint on the first character beyond this exclusion list. Digits, hyphens, dots, Unicode letters, and emoji are all valid in any position.

A keyword (`true`, `false`, `null`) used in key position is treated as the **string** `"true"` / `"false"` / `"null"`. It is not interpreted as the literal.

Any key containing an excluded character must be quoted.

### 3.4 Strings

**Regular strings** — double or single quoted:
- `"..."` or `'...'`
- Single and double quotes use the same escape rules.
- Recognized escapes: `\n \t \r \b \f \" \' \\ \/ \uXXXX \xXX`
- An unrecognized escape is a parse error.
- Literal control characters (raw newline, tab, or other C0 controls) are **not** permitted inside regular strings — use the escape form (e.g. `\n`). Use a raw string if you need literal control characters.

**Raw strings** — Rust-style:
- `r"..."` or `R"..."` — basic raw string. No escape processing. May span multiple lines.
- `r#"..."#`, `r##"..."##`, etc. — hash-delimited. The opening and closing hash counts must match. Allows the raw string to contain `"` and even `"#` sequences.

### 3.5 Numbers

JHON adopts **Rust's numeric literal syntax** with these adjustments:

- **Type suffixes excluded** (`u8`, `i32`, `f64`, `usize`, etc.) — JHON maps to the JSON number model. Integer vs. float is inferred from the literal form.
- **Negative sign `-` is part of the grammar.** Positive numbers do **not** take a `+` prefix; `+5` is a parse error.
- **Radix prefixes are lowercase only**: `0x`, `0o`, `0b`. Uppercase variants (`0X`, `0O`, `0B`) are errors. Hex digits and the exponent marker may be either case.

| Form | Grammar | Example |
|------|---------|---------|
| Decimal integer | `-?[0-9][0-9_]*` | `42`, `-5`, `1_000_000` |
| Hex | `-?0x[0-9a-fA-F_]+` | `0xff`, `0xDE_AD` |
| Octal | `-?0o[0-7_]+` | `0o777`, `-0o17` |
| Binary | `-?0b[01_]+` | `0b1010_0011` |
| Float (fractional) | `-?[0-9][0-9_]*\.[0-9][0-9_]*` | `3.14`, `-1_000.5` |
| Float (exponent) | `-?[0-9][0-9_]*(\.[0-9][0-9_]*)?([eE][+-]?[0-9][0-9_]*)` | `1e10`, `1.5E-3`, `-2.0e+5` |

Rules:
- Underscores are digit separators and may appear between any two digits. Leading, trailing, or adjacent underscores (`_1`, `1_`, `1__2`) are **errors**.
- Hex/octal/binary literals are integer-valued.
- On serialize, all numbers (including hex/octal/binary and negatives) are emitted in canonical decimal form (JSON has no radix literals).

### 3.6 Literals
- `true` → boolean
- `false` → boolean
- `null` → null
- Meaningful only in value position. In key position they are bare identifiers per §3.3.

---

## 4. Values

A value is one of:
- string (§3.4)
- number (§3.5)
- `true` | `false` | `null`
- array (§6)
- object (§5)

---

## 5. Objects

### 5.1 Syntax
A sequence of `key=value` pairs. Braces are optional at the top level, **required** when the object is nested inside another object or array. Whitespace around `=` is optional and insignificant: `name = "x"`, `name= "x"`, `name ="x"`, and `name="x"` are all equivalent.

```
name="myapp"                    // top-level, no braces
{ name="myapp", port=80 }       // top-level, braced
server={ host="x", port=80 }    // nested — braces required
```

### 5.2 Keys
- A key is **always** a string.
- It may be a bare identifier (§3.3) or a quoted string (§3.4).
- `true=1`, `false=1`, `null=1` declare string keys `"true"`, `"false"`, `"null"`.

### 5.3 Separators

A separator is required between two consecutive items (key-value pairs in an object, or elements in an array).

**Valid separators** between two items:
- A comma (optionally surrounded by whitespace).
- A newline (optionally surrounded by whitespace).

Two items on the **same physical line** must be separated by a comma. Spaces or tabs alone on the same line do **not** separate items — this applies everywhere, regardless of whether the surrounding container or document is multiline.

```
// OK — same line, comma-separated
{ a=1, b=2, c=3 }
[1, 2, 3]

// OK — separate lines, newline-separated
a=1
b=2

features=[
  "a"
  "b"
  "c"
]

// OK — commas and newlines mix freely
a=1,
b=2,
c=3

// ERROR — same line, only whitespace between items
{ a=1 b=2 }
[1 2 3]
features=["a" "b" "c"]
a=1	b=2
```

Trailing separators — a final comma before `}`, `]`, or end of input — are **allowed** everywhere: inside objects, inside arrays, and at the top level of a document.

Whitespace adjacent to a comma is insignificant: `a=1,b=2`, `a=1, b=2`, `a=1 ,b=2`, and `a=1 , b=2` are all equivalent.

### 5.4 Duplicate Keys

An object **MUST NOT** contain the same key twice. Duplicate keys are a parse error.

Object key order is **preserved**. Parsers and serializers must not reorder keys (unless the user explicitly opts into `sortKeys` formatting).

---

## 6. Arrays

- Form: `[ item item item ]`, with separators per §5.3.
- Items may be of mixed types.
- Empty array `[]` is valid.
- Trailing separator before `]` is allowed.
- May be nested inside objects or other arrays.
- May appear at the top level per §2.2 — the array brackets become the implicit top-level container when the document is in array mode. Inside an array-mode document, an explicit `[...]` literal is **one element** (a nested array), not the wrapper.

---

## 7. Round-Trip Behavior

- Parse removes comments; serialize does not preserve them.
- Parse preserves key order; serialize emits keys in stored order.
- Numbers parsed from hex/octal/binary serialize as decimal.
- Strings parsed from single/double/raw quotes all become a single canonical string value; the original quoting is lost on parse. (Formatters may re-emit a chosen quote style.)
- Round-trip `serialize(parse(x))` is value-preserving but not text-preserving.
- **Empty containers do not round-trip** (per §2.3 and §7.1): `serialize({})`, `serialize([])`, and `serialize(null)` all emit the empty string, which re-parses to `null`. Likewise, a top-level scalar like `serialize(42)` emits `42`, which re-parses to `[42]`. This is accepted: the "Empty" form unifies all representations of "no data."

### 7.1 Canonical Serialize Forms

Implementations MUST provide two serialize modes:

- **Compact (default)** — single-line, no spaces around `=`, no space after `,`, no trailing commas. Example: `age=30,name="John"`.
- **Pretty** — multi-line with one pair per line, **spaces around `=`**, **no trailing commas**, nested structures indented by a configurable indent string (default two spaces). Example:

  ```
  age = 30
  database = {
    host = "localhost"
    port = 5432
  }
  name = "John"
  ```

For an **array-mode document** (top-level array), the surrounding `[]` is omitted:

- Compact: elements comma-separated, no brackets. Example: `1,2,"haha"`.
- Pretty: one element per line, no brackets. Example:
  ```
  1
  2
  "haha"
  ```

Empty containers (`{}`, `[]`) and `null` at the top level all serialize to the empty string — the "Empty" form. Nested empty containers preserve their literal form (`{}`, `[]`) as today.

Pretty-mode specifics that remain implementation-defined: indent string, key sorting, quote style, equals alignment. Trailing-comma removal, spaces around `=`, and bare top-level array emission are required by this spec, not optional.

---

## 8. Required Parse Errors

Implementations MUST raise a parse error for:

1. Empty key: `=value`
2. Missing value: `key=` followed by `}`, `]`, comma, or end of input
3. Duplicate key in the same object
4. Mixed top-level form: a `key=value` pair followed by a non-pair value, or a non-pair value followed by a `key=value` pair (see §2.4)
5. Top-level array literal followed by any other content (text or pairs after the closing `]` of the literal — the literal is one element of the implicit array, and what follows must be a separator or EOF)
6. Malformed number — bad underscore placement, invalid digit for radix, `+` prefix, uppercase radix prefix (`0X`/`0O`/`0B`), type suffix
7. Unterminated string, raw string, or comment
8. Unrecognized escape sequence in a regular string
9. Literal control character inside a regular string
10. Two items on the same physical line separated only by whitespace (no comma)
11. Unbalanced braces/brackets

---

## 9. Resolved Design Decisions

These were open calls during spec drafting; recorded here so future changes are deliberate, not accidental.

1. **Number radix literals** — hex (`0x`), octal (`0o`), binary (`0b`) are **included** per "Rust syntax". Prefixes are lowercase only.
2. **Number type suffixes** — `u8`/`i64`/`f64`/etc. are **excluded** because they don't map to JSON's number model.
3. **Number sign** — `-` is part of the grammar; `+` prefix is **not** allowed.
4. **Bare-key character set** — permissive: any character not in the exclusion list (§3.3). Unicode letters, digits, emoji all allowed.
5. **String escape set** — JSON escapes plus `\xXX` byte escape. `\uXXXX` and surrogate pairs follow JSON. Unknown escapes are errors.
6. **Control characters in regular strings** — disallowed; use escapes or raw strings.
7. **Separator rule** — two items on the same physical line require a comma between them; newlines also act as separators. No per-container mode distinction (§5.3).
8. **Serialize forms** — compact (no spaces around `=`/after `,`, no trailing commas) is the default canonical output; pretty mode is multi-line with spaces around `=` and no trailing commas, per §7.1.
9. **Top-level scalars and array mode** (added in v2.0) — the top level is no longer restricted to `key=value` pairs. Any document whose first top-level element is not a `key=value` pair is parsed as an implicit array (`[]` omitted). Rationale: humans naturally write lists of values; forcing them to wrap in `{}` or use explicit `[...]` was unnecessary friction. Mixing `key=value` pairs with bare values at the top level remains an error — the first element decides the mode.
10. **Empty input → `null`** (added in v2.0) — empty/whitespace-only/comments-only input parses to JSON `null` rather than `{}`. Rationale: now that the top level can legitimately be either an object or an array, defaulting empty input to `{}` arbitrarily picks one. `null` is the canonical "no data" marker and avoids the bias. As a consequence, empty containers (`{}`, `[]`) and `null` all serialize to the empty string and re-parse to `null` — round-trip for these is intentionally broken.
11. **Top-level `{...}` and `[...]` are array elements, not wrappers** (added in v2.0) — under the new spec, braces and brackets at the top level always represent one element of the implicit top-level array. They are never silently stripped as document wrappers. This means `{a=1}` now parses to `[{"a": 1}]` and `[1,2,3]` now parses to `[[1, 2, 3]]`. Rationale: removes special-case parsing rules and makes the top-level grammar uniform.
