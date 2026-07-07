use serde::{
    de::{self, Deserialize, Deserializer},
    ser::{Serialize, Serializer},
};
use serde_json::Value;
use serde_json::{Map, Number};
use std::fmt::Write as _;

// =============================================================================
// Error Type
// =============================================================================

/// Errors returned by JHON parsing and (de)serialization.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JhonError {
    /// A syntax error at a specific source position (1-based line, 1-based column).
    Syntax {
        line: usize,
        col: usize,
        msg: String,
    },
    /// The input ended unexpectedly.
    Eof {
        line: usize,
        col: usize,
        msg: String,
    },
    /// An object declared the same key more than once.
    DuplicateKey {
        line: usize,
        col: usize,
        key: String,
    },
    /// A serde (de)serialization error wrapping the underlying message.
    Serde(String),
}

impl std::fmt::Display for JhonError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JhonError::Syntax { line, col, msg } => {
                write!(f, "parse error at {}:{}: {}", line, col, msg)
            }
            JhonError::Eof { line, col, msg } => {
                write!(f, "unexpected end of input at {}:{}: {}", line, col, msg)
            }
            JhonError::DuplicateKey { line, col, key } => {
                write!(f, "duplicate key at {}:{}: {:?}", line, col, key)
            }
            JhonError::Serde(msg) => write!(f, "deserialization error: {}", msg),
        }
    }
}

impl std::error::Error for JhonError {}

impl From<serde_json::Error> for JhonError {
    fn from(e: serde_json::Error) -> Self {
        JhonError::Serde(e.to_string())
    }
}

/// Convenience alias used throughout the crate.
pub type Result<T> = std::result::Result<T, JhonError>;

/// Build a [`JhonError::Syntax`] at the current (placeholder) position.
/// Real line/column tracking is wired up in step 9 of the rewrite.
macro_rules! syntax_err {
    ($($arg:tt)*) => {
        $crate::JhonError::Syntax { line: 0, col: 0, msg: format!($($arg)*) }
    };
}

/// Parse a Jhon config string into a JSON Value
///
/// # Examples
///
/// ```
/// use jhon::parse;
///
/// let result = parse(r#"name="John",age=30"#).unwrap();
/// ```
#[inline]
pub fn parse(text: &str) -> Result<Value> {
    // Empty input (including whitespace-only and comments-only) → JSON null.
    // Per SPEC.md §2, this is the "Empty" form. The document has no elements,
    // so it cannot be object mode or array mode.
    {
        let mut probe = Parser::new(text.as_bytes());
        probe.skip_ws_and_comments();
        if probe.current().is_none() {
            return Ok(Value::Null);
        }
    }

    let input = text.trim();

    // Mode detection (SPEC.md §2): the first top-level element decides whether
    // the document is parsed as an object (key=value pairs) or as an implicit
    // array (bare values). `{...}` and `[...]` always begin array mode since
    // they cannot start a `key=` pair. For anything else, attempt to parse a
    // key and look ahead for `=`.
    let mut detector = Parser::new(input.as_bytes());
    detector.skip_ws_and_comments();
    let first_byte = detector.current();
    let object_mode = match first_byte {
        None | Some(b'{') | Some(b'[') => false,
        Some(_) => {
            let mut probe = detector;
            match probe.parse_key() {
                Ok(_) => {
                    probe.skip_ws_and_comments();
                    probe.current() == Some(b'=')
                }
                Err(_) => false,
            }
        }
    };

    if object_mode {
        parse_jhon_object(input)
    } else {
        parse_jhon_array(input)
    }
}

/// Serialize a JSON Value into a compact JHON string
///
/// # Examples
///
/// ```
/// use jhon::serialize;
/// use serde_json::json;
///
/// let value = json!({"name": "John", "age": 30});
/// let jhon_string = serialize(&value);
/// assert_eq!(jhon_string, r#"name="John",age=30"#);
/// ```
#[inline]
pub fn serialize(value: &Value) -> String {
    let mut result = String::new();
    serialize_top_compact(value, &mut result);
    result
}

/// Top-level dispatch. Per SPEC.md §2: empty containers and `null` serialize
/// to empty string (the "Empty" form); top-level arrays emit bare (no `[]`).
/// Nested values fall through to `serialize_compact` which preserves `[]` for
/// nested arrays and `null` text for nested nulls.
#[inline(always)]
fn serialize_top_compact(value: &Value, result: &mut String) {
    match value {
        Value::Array(arr) if arr.is_empty() => {}
        Value::Array(arr) => serialize_array_contents_compact(arr, result),
        Value::Object(map) if map.is_empty() => {}
        Value::Null => {}
        _ => serialize_compact(value, result),
    }
}

/// Serialize a JSON Value into a pretty-printed JHON string with custom indentation
///
/// # Examples
///
/// ```
/// use jhon::serialize_pretty;
/// use serde_json::json;
///
/// let value = json!({"name": "John", "age": 30});
/// let jhon_string = serialize_pretty(&value, "  "); // 2-space indent
/// assert_eq!(jhon_string, "name = \"John\"\nage = 30");
/// ```
pub fn serialize_pretty(value: &Value, indent: &str) -> String {
    serialize_pretty_with_options(
        value,
        &PrettyOptions {
            indent: indent.to_string(),
            max_inline_width: 0,
        },
    )
}

/// Options for [``serialize_pretty_with_options``].
///
/// `max_inline_width` controls short-container inlining:
/// - `0` (default): every non-empty container renders multi-line (legacy behavior).
/// - `>0`: a container whose single-line form fits within this many characters
///   is emitted inline as `{ k = v, ... }` / `[ a, b, ... ]`. Containers that
///   don't fit as a whole but whose joined children do fit use a 3-line
///   wrapper (`[` / `    a, b, c` / `]`). Otherwise the container expands
///   multi-line with one child per line.
#[derive(Debug, Clone)]
pub struct PrettyOptions {
    pub indent: String,
    pub max_inline_width: usize,
}

impl Default for PrettyOptions {
    fn default() -> Self {
        Self {
            indent: "  ".to_string(),
            max_inline_width: 0,
        }
    }
}

/// Pretty-print with the full [``PrettyOptions``]. See its docs for the
/// `max_inline_width` mode.
pub fn serialize_pretty_with_options(value: &Value, opts: &PrettyOptions) -> String {
    let mut result = String::new();
    if opts.max_inline_width > 0 {
        serialize_pretty_inline_top(value, &opts.indent, opts.max_inline_width, &mut result);
    } else {
        serialize_top_pretty(value, &opts.indent, &mut result);
    }
    result
}

/// Top-level pretty dispatch. Mirrors `serialize_top_compact`: empty
/// containers and `null` emit empty string; top-level arrays emit bare.
#[inline(always)]
fn serialize_top_pretty(value: &Value, indent: &str, result: &mut String) {
    match value {
        Value::Array(arr) if arr.is_empty() => {}
        Value::Array(arr) => serialize_top_array_pretty(arr, indent, result),
        Value::Object(map) if map.is_empty() => {}
        Value::Null => {}
        _ => serialize_pretty_with_depth(value, indent, 0, false, result),
    }
}

/// Emit a top-level implicit array (no surrounding `[]`). Each element appears
/// on its own line at column 0. Object and array literals as elements keep
/// their braces/brackets since they're array elements, not the implicit
/// top-level form.
fn serialize_top_array_pretty(arr: &[Value], indent: &str, result: &mut String) {
    let mut first = true;
    for value in arr {
        if !first {
            result.push('\n');
        }
        first = false;
        match value {
            Value::Object(map) if map.is_empty() => result.push_str("{}"),
            Value::Object(map) => {
                // Object element: emit with braces, body at indent 1, no
                // leading indent on the opening brace (column 0).
                result.push_str("{\n");
                let mut first_pair = true;
                for (k, v) in map {
                    if !first_pair {
                        result.push('\n');
                    }
                    first_pair = false;
                    result.push_str(indent);
                    serialize_key(k, result);
                    result.push_str(" = ");
                    serialize_pretty_with_depth(v, indent, 1, false, result);
                }
                result.push('\n');
                result.push('}');
            }
            _ => serialize_pretty_with_depth(value, indent, 0, false, result),
        }
    }
}

// =============================================================================
// Serde Support
// =============================================================================

/// Wrapper type for serializing/deserializing arbitrary types with JHON format.
///
/// # Example
///
/// ```
/// use jhon::Jhon;
/// use serde::{Deserialize, Serialize};
///
/// #[derive(Debug, Serialize, Deserialize, PartialEq)]
/// struct Config {
///     name: String,
///     age: u32,
///     active: bool,
/// }
///
/// let config = Config {
///     name: "John".to_string(),
///     age: 30,
///     active: true,
/// };
///
/// // Serialize to JHON
/// let jhon_string = Jhon::to_string(&config).unwrap();
///
/// // Deserialize from JHON
/// let decoded: Config = Jhon::from_str(&jhon_string).unwrap();
/// assert_eq!(config, decoded);
/// ```
pub struct Jhon;

impl Jhon {
    /// Serialize a type `T` to a JHON string.
    ///
    /// # Errors
    ///
    /// Returns an error if serialization fails.
    pub fn to_string<T: Serialize>(value: &T) -> Result<String> {
        let value = serde_json::to_value(value)?;
        Ok(serialize(&value))
    }

    /// Serialize a type `T` to a pretty-printed JHON string.
    ///
    /// # Errors
    ///
    /// Returns an error if serialization fails.
    pub fn to_string_pretty<T: Serialize>(value: &T, indent: &str) -> Result<String> {
        let value = serde_json::to_value(value)?;
        Ok(serialize_pretty(&value, indent))
    }

    /// Deserialize a type `T` from a JHON string.
    ///
    /// # Errors
    ///
    /// Returns an error if parsing or deserialization fails.
    #[allow(clippy::should_implement_trait)]
    pub fn from_str<'de, T: Deserialize<'de>>(s: &'de str) -> Result<T> {
        let value = parse(s)?;
        T::deserialize(value).map_err(|e| JhonError::Serde(e.to_string()))
    }

    /// Deserialize a type `T` from a JHON string with a custom deserializer.
    ///
    /// This allows for more control over the deserialization process.
    pub fn from_str_with_deserializer<'de, T: Deserialize<'de>, D: Deserializer<'de>>(
        deserializer: D,
    ) -> Result<T> {
        T::deserialize(deserializer).map_err(|e| JhonError::Serde(e.to_string()))
    }
}

/// A wrapper that can be used with `#[serde(with = "jhon")]` to serialize/deserialize
/// fields using JHON format.
///
/// # Example
///
/// ```
/// use jhon::jhon;
/// use serde::{Deserialize, Serialize};
///
/// #[derive(Debug, Serialize, Deserialize)]
/// struct ConfigData {
///     name: String,
///     value: i32,
/// }
///
/// #[derive(Debug, Serialize, Deserialize)]
/// struct MyStruct {
///     #[serde(with = "jhon")]
///     config: ConfigData,
/// }
/// ```
pub mod jhon {
    use super::*;

    pub fn serialize<T: Serialize, S: Serializer>(
        value: &T,
        serializer: S,
    ) -> std::result::Result<S::Ok, S::Error> {
        let jhon_string = Jhon::to_string(value).map_err(serde::ser::Error::custom)?;
        jhon_string.serialize(serializer)
    }

    pub fn deserialize<'de, T: Deserialize<'de>, D: Deserializer<'de>>(
        deserializer: D,
    ) -> std::result::Result<T, D::Error> {
        // First deserialize to a Value (serde_json::Value), then convert to target type
        let json_value = serde_json::Value::deserialize(deserializer)?;
        // Convert the JSON Value to our target type
        T::deserialize(json_value).map_err(de::Error::custom)
    }
}

/// Deserialize a JHON string into any type that implements `Deserialize`.
///
/// This is a convenience function that uses the `Jhon` wrapper internally.
///
/// # Example
///
/// ```
/// use jhon::from_str;
/// use serde::{Deserialize, Serialize};
///
/// #[derive(Debug, Deserialize, PartialEq)]
/// struct Config {
///     name: String,
///     age: u32,
/// }
///
/// let jhon_str = r#"name="John",age=30"#;
/// let config: Config = from_str(jhon_str).unwrap();
/// assert_eq!(config.name, "John");
/// assert_eq!(config.age, 30);
/// ```
pub fn from_str<'de, T: Deserialize<'de>>(s: &'de str) -> Result<T> {
    Jhon::from_str(s)
}

/// Serialize any type that implements `Serialize` into a JHON string.
///
/// This is a convenience function that uses the `Jhon` wrapper internally.
///
/// # Example
///
/// ```
/// use jhon::to_string;
/// use serde::{Deserialize, Serialize};
///
/// #[derive(Debug, Serialize, Deserialize, PartialEq)]
/// struct Config {
///     name: String,
///     age: u32,
/// }
///
/// let config = Config { name: "John".to_string(), age: 30 };
/// let jhon_str = to_string(&config).unwrap();
/// ```
pub fn to_string<T: Serialize>(value: &T) -> Result<String> {
    Jhon::to_string(value)
}

/// Serialize any type that implements `Serialize` into a pretty-printed JHON string.
///
/// This is a convenience function that uses the `Jhon` wrapper internally.
pub fn to_string_pretty<T: Serialize>(value: &T, indent: &str) -> Result<String> {
    Jhon::to_string_pretty(value, indent)
}

// =============================================================================
// Static Tables (from serde_json)
// =============================================================================

const BB: u8 = b'b'; // \\x08
const TT: u8 = b't'; // \\x09
const NN: u8 = b'n'; // \\x0A
const FF: u8 = b'f'; // \\x0C
const RR: u8 = b'r'; // \\x0D
const QU: u8 = b'"'; // \\x22
const BS: u8 = b'\\'; // \\x5C
const UU: u8 = b'u'; // \\x00...\\x1F except the ones above
const __: u8 = 0; // No escape needed

// Lookup table of escape sequences. A value of b'x' at index i means that byte
// i is escaped as "\x" in JSON. A value of 0 means that byte i is not escaped.
static ESCAPE: [u8; 256] = [
    //   1   2   3   4   5   6   7   8   9   A   B   C   D   E   F
    UU, UU, UU, UU, UU, UU, UU, UU, BB, TT, NN, UU, FF, RR, UU, UU, // 0
    UU, UU, UU, UU, UU, UU, UU, UU, UU, UU, UU, UU, UU, UU, UU, UU, // 1
    __, __, QU, __, __, __, __, __, __, __, __, __, __, __, __, __, // 2
    __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, // 3
    __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, // 4
    __, __, __, __, __, __, __, __, __, __, __, __, BS, __, __, __, // 5
    __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, // 6
    __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, // 7
    __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, // 8
    __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, // 9
    __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, // A
    __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, // B
    __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, // C
    __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, // D
    __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, // E
    __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, // F
];

// Classification table for fast character checking
// (removed during 2.0 rewrite — correctness over micro-optimization)

// =============================================================================
// Optimized Parser
// =============================================================================

#[derive(Clone, Copy)]
struct Parser<'a> {
    input: &'a [u8],
    pos: usize,
    line: usize, // 1-based
    col: usize,  // 1-based
}

impl<'a> Parser<'a> {
    fn new(input: &'a [u8]) -> Self {
        Self {
            input,
            pos: 0,
            line: 1,
            col: 1,
        }
    }

    fn current(&self) -> Option<u8> {
        self.input.get(self.pos).copied()
    }

    fn advance(&mut self) -> Option<u8> {
        let c = self.current()?;
        if c == b'\n' {
            self.line += 1;
            self.col = 1;
        } else {
            self.col += 1;
        }
        self.pos += 1;
        Some(c)
    }

    /// Skip whitespace and comments. Returns whether a newline was consumed.
    /// Comments are stripped inline so that line information survives for
    /// separator-rule enforcement (SPEC.md §5.3).
    fn skip_ws_and_comments(&mut self) -> bool {
        let mut saw_newline = false;
        loop {
            match self.current() {
                Some(b' ') | Some(b'\t') | Some(b'\r') => {
                    self.advance();
                }
                Some(b'\n') => {
                    saw_newline = true;
                    self.advance();
                }
                Some(b'/') if self.input.get(self.pos + 1) == Some(&b'/') => {
                    // Line comment — skip to but not past '\n' so the outer
                    // loop records the newline.
                    self.advance();
                    self.advance();
                    while let Some(c) = self.current() {
                        if c == b'\n' {
                            break;
                        }
                        self.advance();
                    }
                }
                Some(b'/') if self.input.get(self.pos + 1) == Some(&b'*') => {
                    // Block comment — skip to matching '*/'. Newlines inside
                    // count toward the separator rule.
                    self.advance();
                    self.advance();
                    loop {
                        match self.current() {
                            None => return saw_newline,
                            Some(b'*') if self.input.get(self.pos + 1) == Some(&b'/') => {
                                self.advance();
                                self.advance();
                                break;
                            }
                            Some(b'\n') => {
                                saw_newline = true;
                                self.advance();
                            }
                            Some(_) => {
                                self.advance();
                            }
                        }
                    }
                }
                _ => break,
            }
        }
        saw_newline
    }

    /// Skip the separator between two consecutive items in a container.
    /// Returns `(saw_newline, saw_comma)`. Per SPEC.md §5.3, an item following
    /// another on the same physical line must be preceded by a comma; a
    /// newline is also a valid separator.
    fn skip_inter_item_separator(&mut self) -> (bool, bool) {
        let mut saw_newline = self.skip_ws_and_comments();
        let mut saw_comma = false;
        if self.current() == Some(b',') {
            saw_comma = true;
            self.advance();
            if self.skip_ws_and_comments() {
                saw_newline = true;
            }
        }
        (saw_newline, saw_comma)
    }

    // String parsing. Phase 1 scans byte-by-byte for the closing quote while
    // rejecting literal C0/DEL control chars; if no escape is seen the slice
    // is returned directly. Phase 2 processes escapes, accumulating into a
    // Vec<u8> so non-ASCII content after an escape stays UTF-8-correct.
    fn parse_string(&mut self, quote: u8) -> Result<String> {
        self.advance(); // skip opening quote

        let start = self.pos;

        // Phase 1: scan for closing quote, backslash, or forbidden control byte.
        while self.pos < self.input.len() {
            let b = self.input[self.pos];
            if b < 0x20 || b == 0x7F {
                return Err(syntax_err!(
                    "literal control character 0x{:02X} in string; use an escape or a raw string",
                    b
                ));
            }
            if b == quote {
                let s = std::str::from_utf8(&self.input[start..self.pos])
                    .map_err(|_| syntax_err!("Invalid UTF-8 in string"))?;
                self.pos += 1;
                return Ok(s.to_string());
            }
            if b == b'\\' {
                break;
            }
            self.pos += 1;
        }

        if self.pos >= self.input.len() {
            return Err(syntax_err!("Unterminated string"));
        }

        // Phase 2: process escapes.
        let mut bytes: Vec<u8> = self.input[start..self.pos].to_vec();

        while self.pos < self.input.len() {
            let b = self
                .advance()
                .ok_or_else(|| syntax_err!("Unterminated string"))?;
            if b == quote {
                return String::from_utf8(bytes)
                    .map_err(|_| syntax_err!("Invalid UTF-8 in string"));
            }
            if b == b'\\' {
                let escaped = self
                    .advance()
                    .ok_or_else(|| syntax_err!("Incomplete escape sequence"))?;
                match escaped {
                    b'n' => bytes.push(b'\n'),
                    b'r' => bytes.push(b'\r'),
                    b't' => bytes.push(b'\t'),
                    b'b' => bytes.push(0x08),
                    b'f' => bytes.push(0x0C),
                    b'\\' => bytes.push(b'\\'),
                    b'"' => bytes.push(b'"'),
                    b'\'' => bytes.push(b'\''),
                    b'/' => bytes.push(b'/'),
                    b'x' => {
                        let v = self.parse_hex_digits(2, "\\x")?;
                        bytes.push(v as u8);
                    }
                    b'u' => {
                        let code = self.parse_hex_digits(4, "\\u")?;
                        if (0xD800..=0xDFFF).contains(&code) {
                            return Err(syntax_err!(
                                "surrogate code point U+{:04X} requires a pair; \
                                 surrogate handling is not yet implemented",
                                code
                            ));
                        }
                        let c = char::from_u32(code).ok_or_else(|| {
                            syntax_err!("Invalid Unicode code point U+{:04X}", code)
                        })?;
                        let mut buf = [0u8; 4];
                        bytes.extend_from_slice(c.encode_utf8(&mut buf).as_bytes());
                    }
                    other => {
                        return Err(syntax_err!("Unknown escape \\{}", other as char));
                    }
                }
            } else {
                bytes.push(b);
            }
        }
        Err(syntax_err!("Unterminated string"))
    }

    /// Parse `count` hex digits and return the assembled value.
    fn parse_hex_digits(&mut self, count: usize, label: &str) -> Result<u32> {
        let mut value = 0u32;
        for _ in 0..count {
            let h = self
                .advance()
                .ok_or_else(|| syntax_err!("Incomplete {} escape", label))?;
            let d = (h as char)
                .to_digit(16)
                .ok_or_else(|| syntax_err!("Invalid hex digit in {} escape", label))?;
            value = (value << 4) | d;
        }
        Ok(value)
    }

    fn parse_raw_string(&mut self) -> Result<String> {
        self.advance(); // skip 'r'

        let mut hash_count = 0;
        while self.current() == Some(b'#') {
            hash_count += 1;
            self.advance();
        }

        if self.current() != Some(b'"') {
            return Err(syntax_err!(
                "Expected opening quote after r and # symbols in raw string"
            ));
        }
        self.advance(); // skip opening quote

        let start = self.pos;

        while self.pos < self.input.len() {
            if self.input[self.pos] == b'"' && self.pos + hash_count < self.input.len() {
                let is_closing =
                    (1..=hash_count).all(|j| self.input.get(self.pos + j) == Some(&b'#'));

                if is_closing {
                    let s = std::str::from_utf8(&self.input[start..self.pos])
                        .map_err(|_| syntax_err!("Invalid UTF-8 in raw string"))?
                        .to_string();
                    self.pos += hash_count + 1;
                    return Ok(s);
                }
            }
            self.pos += 1;
        }

        Err(syntax_err!("Unterminated raw string"))
    }

    // Number parser — handles decimal, hex, octal, binary, floats, and
    // underscores per SPEC.md §3.5.
    fn parse_number(&mut self) -> Result<Value> {
        let negative = self.current() == Some(b'-');
        if negative {
            self.advance();
        }

        // Radix prefix detection. Lowercase only — uppercase variants error.
        let radix = if self.pos + 1 < self.input.len() && self.input[self.pos] == b'0' {
            match self.input[self.pos + 1] {
                b'x' => Some(16u32),
                b'o' => Some(8u32),
                b'b' => Some(2u32),
                b'X' | b'O' | b'B' => {
                    return Err(syntax_err!(
                        "uppercase radix prefix 0{} not allowed; use lowercase",
                        self.input[self.pos + 1] as char
                    ));
                }
                _ => None,
            }
        } else {
            None
        };

        // Scan the literal.
        let literal: String;
        let mut is_float = false;

        if let Some(rdx) = radix {
            self.advance(); // '0'
            self.advance(); // 'x' / 'o' / 'b'
            literal = self.scan_radix_digits(rdx)?;
        } else {
            let int_part = self.scan_dec_digits()?;
            let mut s = int_part;
            if self.current() == Some(b'.') {
                is_float = true;
                s.push('.');
                self.advance();
                s.push_str(&self.scan_dec_digits()?);
            }
            if matches!(self.current(), Some(b'e') | Some(b'E')) {
                is_float = true;
                s.push('e');
                self.advance();
                if matches!(self.current(), Some(b'+') | Some(b'-')) {
                    s.push(self.current().unwrap() as char);
                    self.advance();
                }
                s.push_str(&self.scan_dec_digits()?);
            }
            literal = s;
        }

        // Reject type suffixes (u8, i32, f64, ...) — next byte looks like u/i/f
        // followed by alphanumeric.
        if let Some(b) = self.current()
            && matches!(b, b'u' | b'i' | b'f')
            && self
                .input
                .get(self.pos + 1)
                .copied()
                .filter(|c| c.is_ascii_alphanumeric())
                .is_some()
        {
            return Err(syntax_err!(
                "number type suffix not allowed (saw '{}{}')",
                b as char,
                self.input[self.pos + 1] as char
            ));
        }

        // Assemble signed form for parsing.
        let signed = if negative {
            format!("-{}", literal)
        } else {
            literal
        };

        if let Some(rdx) = radix {
            return parse_radix_literal(&signed, rdx);
        }

        if !is_float {
            if let Ok(i) = signed.parse::<i64>() {
                return Ok(Value::Number(Number::from(i)));
            }
            if let Ok(u) = signed.parse::<u64>() {
                return Ok(Value::Number(Number::from(u)));
            }
            if let Ok(i) = signed.parse::<i128>()
                && let Some(n) = Number::from_f64(i as f64)
            {
                return Ok(Value::Number(n));
            }
            if let Ok(u) = signed.parse::<u128>()
                && let Some(n) = Number::from_f64(u as f64)
            {
                return Ok(Value::Number(n));
            }
        }

        let f = signed
            .parse::<f64>()
            .map_err(|_| syntax_err!("could not parse number: {}", signed))?;
        Number::from_f64(f)
            .map(Value::Number)
            .ok_or_else(|| syntax_err!("invalid number value: {}", signed))
    }

    /// Scan a run of decimal digits with Rust-style underscore separators.
    /// Validates that underscores occur only between two digits.
    fn scan_dec_digits(&mut self) -> Result<String> {
        let mut s = String::new();
        let mut last_was_under = false;
        let mut has_digit = false;
        while self.pos < self.input.len() {
            let b = self.input[self.pos];
            if b.is_ascii_digit() {
                s.push(b as char);
                last_was_under = false;
                has_digit = true;
                self.pos += 1;
            } else if b == b'_' {
                if !has_digit || last_was_under {
                    return Err(syntax_err!("invalid underscore placement in number"));
                }
                last_was_under = true;
                self.pos += 1;
            } else {
                break;
            }
        }
        if !has_digit {
            return Err(syntax_err!("number requires at least one digit"));
        }
        if last_was_under {
            return Err(syntax_err!("number cannot end with underscore"));
        }
        Ok(s)
    }

    /// Scan a run of digits in the given radix with underscore separators.
    fn scan_radix_digits(&mut self, radix: u32) -> Result<String> {
        let mut s = String::new();
        let mut last_was_under = false;
        let mut has_digit = false;
        while self.pos < self.input.len() {
            let b = self.input[self.pos];
            if (b as char).is_digit(radix) {
                s.push(b as char);
                last_was_under = false;
                has_digit = true;
                self.pos += 1;
            } else if b == b'_' {
                if !has_digit || last_was_under {
                    return Err(syntax_err!("invalid underscore placement in number"));
                }
                last_was_under = true;
                self.pos += 1;
            } else {
                break;
            }
        }
        if !has_digit {
            return Err(syntax_err!(
                "number requires at least one digit after radix prefix"
            ));
        }
        if last_was_under {
            return Err(syntax_err!("number cannot end with underscore"));
        }
        Ok(s)
    }

    fn parse_array(&mut self) -> Result<(Value, usize)> {
        self.advance(); // skip '['

        let mut elements = Vec::new();

        self.skip_ws_and_comments();

        while self.current() != Some(b']') {
            if self.current().is_none() {
                return Err(syntax_err!("Unterminated array"));
            }

            if let Some(value) = self.parse_value()? {
                elements.push(value);
            }

            // Skip separator between items. Per §5.3, an item that follows
            // another on the same physical line must be preceded by a comma.
            let (saw_newline, saw_comma) = self.skip_inter_item_separator();

            if self.current() == Some(b']') {
                break;
            }
            if self.current().is_none() {
                return Err(syntax_err!("Unterminated array"));
            }
            if !saw_newline && !saw_comma {
                return Err(syntax_err!(
                    "items on the same line must be separated by a comma"
                ));
            }
        }

        self.advance(); // skip ']'
        Ok((Value::Array(elements), self.pos))
    }

    fn parse_nested_object(&mut self) -> Result<(Value, usize)> {
        self.advance(); // skip '{'

        let mut map = Map::new();

        self.skip_ws_and_comments();

        while self.current() != Some(b'}') {
            if self.current().is_none() {
                return Err(syntax_err!("Unterminated nested object"));
            }

            // Parse key
            let key = self.parse_key()?;

            // Skip whitespace/comments before '='
            self.skip_ws_and_comments();

            // Expect '='
            if self.current() != Some(b'=') {
                return Err(syntax_err!("Expected '=' after key in nested object"));
            }
            self.advance();

            // Skip whitespace/comments before value
            self.skip_ws_and_comments();

            // Parse value
            if let Some(value) = self.parse_value()? {
                if map.contains_key(&key) {
                    return Err(JhonError::DuplicateKey {
                        line: self.line,
                        col: self.col,
                        key,
                    });
                }
                map.insert(key, value);
            }

            // Skip separator between pairs.
            let (saw_newline, saw_comma) = self.skip_inter_item_separator();

            if self.current() == Some(b'}') {
                break;
            }
            if self.current().is_none() {
                return Err(syntax_err!("Unterminated nested object"));
            }
            if !saw_newline && !saw_comma {
                return Err(syntax_err!(
                    "items on the same line must be separated by a comma"
                ));
            }
        }

        self.advance(); // skip '}'
        Ok((Value::Object(map), self.pos))
    }

    fn parse_key(&mut self) -> Result<String> {
        self.skip_ws_and_comments();

        let quote = self.current();

        if quote == Some(b'"') || quote == Some(b'\'') {
            self.parse_string(quote.unwrap())
        } else {
            // Bare key — permissive: scan bytes until we hit one in the
            // exclusion list (per SPEC.md §3.3). All excluded bytes are ASCII,
            // so UTF-8 multi-byte sequences pass through untouched.
            let start = self.pos;
            while self.pos < self.input.len() {
                let b = self.input[self.pos];
                if is_key_delimiter(b) {
                    break;
                }
                self.pos += 1;
            }

            if start == self.pos {
                return Err(syntax_err!("Empty key"));
            }

            let s = std::str::from_utf8(&self.input[start..self.pos])
                .map_err(|_| syntax_err!("Invalid UTF-8 in bare key"))?;
            Ok(s.to_string())
        }
    }

    fn parse_value(&mut self) -> Result<Option<Value>> {
        self.skip_ws_and_comments();

        let c = self
            .current()
            .ok_or_else(|| syntax_err!("Expected value"))?;

        let result = match c {
            b'"' | b'\'' => Some(Value::String(self.parse_string(c)?)),
            b'r' | b'R' => Some(Value::String(self.parse_raw_string()?)),
            b'[' => Some(self.parse_array()?.0),
            b'{' => Some(self.parse_nested_object()?.0),
            b'0'..=b'9' | b'-' => Some(self.parse_number()?),
            b't' | b'f' => Some(self.parse_boolean()?),
            b'n' => Some(self.parse_null()?),
            _ => return Err(syntax_err!("Unexpected character in value: {}", c as char)),
        };

        Ok(result)
    }

    fn parse_boolean(&mut self) -> Result<Value> {
        if self.input.len() >= self.pos + 4 && &self.input[self.pos..self.pos + 4] == b"true" {
            self.pos += 4;
            return Ok(Value::Bool(true));
        } else if self.input.len() >= self.pos + 5
            && &self.input[self.pos..self.pos + 5] == b"false"
        {
            self.pos += 5;
            return Ok(Value::Bool(false));
        }
        Err(syntax_err!("Invalid boolean value"))
    }

    fn parse_null(&mut self) -> Result<Value> {
        if self.input.len() >= self.pos + 4 && &self.input[self.pos..self.pos + 4] == b"null" {
            self.pos += 4;
            return Ok(Value::Null);
        }
        Err(syntax_err!("Invalid null value"))
    }
}

#[inline]
/// Parse a signed radix literal into a JSON number. Tries i64 → u64 → i128 →
/// u128 → falls back to f64 (the i128/u128 intermediates lose precision past
/// 2^53 when stored in serde_json::Number).
fn parse_radix_literal(signed: &str, radix: u32) -> Result<Value> {
    if let Ok(i) = i64::from_str_radix(signed, radix) {
        return Ok(Value::Number(Number::from(i)));
    }
    if let Ok(u) = u64::from_str_radix(signed, radix) {
        return Ok(Value::Number(Number::from(u)));
    }
    if let Ok(i) = i128::from_str_radix(signed, radix)
        && let Some(n) = Number::from_f64(i as f64)
    {
        return Ok(Value::Number(n));
    }
    if let Ok(u) = u128::from_str_radix(signed, radix)
        && let Some(n) = Number::from_f64(u as f64)
    {
        return Ok(Value::Number(n));
    }
    Err(syntax_err!("could not parse number: {}", signed))
}

fn parse_jhon_object(input: &str) -> Result<Value> {
    let mut parser = Parser::new(input.as_bytes());
    let mut map = Map::new();

    parser.skip_ws_and_comments();

    while parser.pos < parser.input.len() {
        // Parse key
        let key = parser.parse_key()?;

        // Skip whitespace/comments before '='
        parser.skip_ws_and_comments();

        // Expect '='
        if parser.current() != Some(b'=') {
            return Err(syntax_err!("Expected '=' after key"));
        }
        parser.advance();

        // Skip whitespace/comments before value
        parser.skip_ws_and_comments();

        // Parse value
        if let Some(value) = parser.parse_value()? {
            if map.contains_key(&key) {
                return Err(JhonError::DuplicateKey {
                    line: parser.line,
                    col: parser.col,
                    key,
                });
            }
            map.insert(key, value);
        }

        // Skip separator between pairs.
        let (saw_newline, saw_comma) = parser.skip_inter_item_separator();

        if parser.pos >= parser.input.len() {
            break; // trailing separator at EOF is OK
        }
        if !saw_newline && !saw_comma {
            return Err(syntax_err!(
                "items on the same line must be separated by a comma"
            ));
        }
    }

    Ok(Value::Object(map))
}

fn parse_jhon_array(input: &str) -> Result<Value> {
    let mut parser = Parser::new(input.as_bytes());
    let mut elements = Vec::new();

    parser.skip_ws_and_comments();

    while parser.pos < parser.input.len() {
        // Reject `key=value` pairs mixed into array mode. After a value is
        // parsed, an immediately following `=` means the user wrote a pair
        // after a bare value — that's a syntax error per SPEC.md §2.
        if parser.current() == Some(b'=') {
            return Err(syntax_err!(
                "Cannot mix key=value pairs and bare values at top level"
            ));
        }

        if let Some(value) = parser.parse_value()? {
            elements.push(value);
        }

        // Reject mix at the value-position level too: parse_value rejects bare
        // identifiers, so `1\na=2` errors with "Unexpected character" at `a`.
        // The dedicated `=` check above catches `[1]=2`-style mix attempts.

        let (saw_newline, saw_comma) = parser.skip_inter_item_separator();

        if parser.pos >= parser.input.len() {
            break;
        }
        if !saw_newline && !saw_comma {
            return Err(syntax_err!(
                "items on the same line must be separated by a comma"
            ));
        }
    }

    Ok(Value::Array(elements))
}

// =============================================================================
// Optimized Serializer
// =============================================================================

#[inline(always)]
fn serialize_compact(value: &Value, result: &mut String) {
    match value {
        Value::Object(map) if map.is_empty() => {}
        Value::Object(map) => serialize_object_compact(map, result),
        Value::Array(arr) if arr.is_empty() => result.push_str("[]"),
        Value::Array(arr) => serialize_array_compact(arr, result),
        Value::String(s) => serialize_string(s, result),
        Value::Number(n) => serialize_number(n, result),
        Value::Bool(b) => result.push_str(if *b { "true" } else { "false" }),
        Value::Null => result.push_str("null"),
    }
}

#[inline(always)]
fn serialize_object_compact(map: &Map<String, Value>, result: &mut String) {
    let mut first = true;
    for (key, value) in map {
        if !first {
            result.push(',');
        }
        first = false;

        serialize_key(key, result);
        result.push('=');

        match value {
            Value::Object(inner) if inner.is_empty() => result.push_str("{}"),
            Value::Object(inner) => {
                result.push('{');
                serialize_object_compact(inner, result);
                result.push('}');
            }
            _ => serialize_compact(value, result),
        }
    }
}

#[inline(always)]
fn serialize_array_compact(arr: &[Value], result: &mut String) {
    result.push('[');
    serialize_array_contents_compact(arr, result);
    result.push(']');
}

#[inline(always)]
fn serialize_array_contents_compact(arr: &[Value], result: &mut String) {
    let mut first = true;
    for value in arr {
        if !first {
            result.push(',');
        }
        first = false;

        match value {
            Value::Object(map) if map.is_empty() => result.push_str("{}"),
            Value::Object(map) => {
                result.push('{');
                serialize_object_compact(map, result);
                result.push('}');
            }
            _ => serialize_compact(value, result),
        }
    }
}

#[inline(always)]
fn serialize_key(key: &str, result: &mut String) {
    if needs_quoting(key) {
        serialize_string(key, result);
    } else {
        result.push_str(key);
    }
}

// Optimized string serialization using static escape table with SIMD-like scanning
#[inline(always)]
fn serialize_string(s: &str, result: &mut String) {
    result.push('"');

    let bytes = s.as_bytes();
    let mut i = 0;

    // Fast path: process 8 bytes at a time
    while i + 8 <= bytes.len() {
        // Check if any byte in the next 8 needs escaping
        let mut needs_escape = false;
        for j in 0..8 {
            if ESCAPE[bytes[i + j] as usize] != 0 {
                needs_escape = true;
                // Write up to the escape char
                if j > 0 {
                    let safe_part = unsafe { std::str::from_utf8_unchecked(&bytes[i..i + j]) };
                    result.push_str(safe_part);
                }
                // Handle the escape
                let byte = bytes[i + j];
                serialize_escape_byte(byte, result);
                i += j + 1;
                break;
            }
        }
        if !needs_escape {
            // No escapes in this chunk, write all 8 bytes
            let safe_part = unsafe { std::str::from_utf8_unchecked(&bytes[i..i + 8]) };
            result.push_str(safe_part);
            i += 8;
        }
    }

    // Handle remaining bytes
    while i < bytes.len() {
        let escape = ESCAPE[bytes[i] as usize];
        if escape != 0 {
            serialize_escape_byte(bytes[i], result);
        } else {
            result.push(unsafe { char::from_u32_unchecked(bytes[i] as u32) });
        }
        i += 1;
    }

    result.push('"');
}

// Serialize a single escaped byte
#[inline(always)]
fn serialize_escape_byte(byte: u8, result: &mut String) {
    match ESCAPE[byte as usize] {
        BB => result.push_str("\\b"),
        TT => result.push_str("\\t"),
        NN => result.push_str("\\n"),
        FF => result.push_str("\\f"),
        RR => result.push_str("\\r"),
        QU => result.push_str("\\\""),
        BS => result.push_str("\\\\"),
        UU => {
            // Unicode escape for control characters (0x00-0x1F)
            // Manual formatting: \u00XX
            const HEX: &[u8; 16] = b"0123456789abcdef";
            result.push_str("\\u00");
            result.push(HEX[(byte >> 4) as usize] as char);
            result.push(HEX[(byte & 0x0F) as usize] as char);
        }
        _ => {
            // Safety: ESCAPE table only has the above values
            // This should never be reached
            result.push(byte as char);
        }
    }
}

// Number serialization — uses std formatting (itoa/ryu dropped for simplicity).
#[inline(always)]
fn serialize_number(n: &Number, result: &mut String) {
    if let Some(i) = n.as_i64() {
        let _ = write!(result, "{}", i);
    } else if let Some(u) = n.as_u64() {
        let _ = write!(result, "{}", u);
    } else if let Some(f) = n.as_f64() {
        if f.fract() == 0.0 {
            let _ = write!(result, "{}", f as i64);
        } else {
            let _ = write!(result, "{}", f);
        }
    } else {
        result.push('0');
    }
}

fn serialize_pretty_with_depth(
    value: &Value,
    indent: &str,
    depth: usize,
    in_array: bool,
    result: &mut String,
) {
    match value {
        Value::Object(map) if map.is_empty() => {
            if in_array {
                result.push_str("{}");
            }
        }
        Value::Object(map) => serialize_object_pretty(map, indent, depth, in_array, result),
        Value::Array(arr) if arr.is_empty() => result.push_str("[]"),
        Value::Array(arr) => serialize_array_pretty(arr, indent, depth, result),
        Value::String(s) => serialize_string(s, result),
        Value::Number(n) => serialize_number(n, result),
        Value::Bool(b) => result.push_str(if *b { "true" } else { "false" }),
        Value::Null => result.push_str("null"),
    }
}

fn serialize_object_pretty(
    map: &Map<String, Value>,
    indent: &str,
    depth: usize,
    in_array: bool,
    result: &mut String,
) {
    // Add opening brace if nested
    if in_array {
        for _ in 0..depth + 1 {
            result.push_str(indent);
        }
        result.push_str("{\n");
    } else if depth > 0 {
        result.push_str("{\n");
    }

    let mut first = true;
    for (key, value) in map {
        if !first {
            result.push('\n');
        }
        first = false;

        let inner_indent = if in_array {
            depth + 2
        } else if depth == 0 {
            0
        } else {
            depth
        };

        for _ in 0..inner_indent {
            result.push_str(indent);
        }

        serialize_key(key, result);
        result.push_str(" = ");

        serialize_pretty_with_depth(value, indent, depth + 1, false, result);
    }

    // Add closing brace if nested
    if in_array {
        result.push('\n');
        for _ in 0..depth + 1 {
            result.push_str(indent);
        }
        result.push('}');
    } else if depth > 0 {
        result.push('\n');
        for _ in 0..depth - 1 {
            result.push_str(indent);
        }
        result.push('}');
    }
}

fn serialize_array_pretty(arr: &[Value], indent: &str, depth: usize, result: &mut String) {
    result.push_str("[\n");
    serialize_array_contents_pretty(arr, indent, depth, result);
    result.push('\n');
    for _ in 0..depth {
        result.push_str(indent);
    }
    result.push(']');
}

/// Emit the contents of an array without the surrounding `[]`. Used for
/// top-level implicit arrays per SPEC.md §2 (array mode).
fn serialize_array_contents_pretty(arr: &[Value], indent: &str, depth: usize, result: &mut String) {
    let mut first = true;
    for value in arr {
        if !first {
            result.push('\n');
        }
        first = false;

        if matches!(value, Value::Object(_)) {
            serialize_pretty_with_depth(value, indent, depth, true, result);
        } else {
            for _ in 0..depth + 1 {
                result.push_str(indent);
            }
            serialize_pretty_with_depth(value, indent, depth + 1, false, result);
        }
    }
}

// =============================================================================
// Inline-aware pretty printer (`max_inline_width > 0` mode).
//
// Older `serialize_pretty_with_depth` always multi-lines non-empty containers.
// This separate path short-circuits to a single-line `{ k = v, ... }` /
// `[ a, b, ... ]` form when the result fits within `max_inline_width` chars,
// and falls back to a 3-line "wrapper_compact" form when only the joined
// children fit, and finally to one-child-per-line otherwise. Existing
// `serialize_pretty` is unchanged because it routes through the legacy path
// (`max_inline_width == 0`).
// =============================================================================

/// Top-level dispatch for inline-aware mode. Mirrors `serialize_top_pretty`:
/// empty containers and `null` collapse to empty string (SPEC §2); top-level
/// arrays emit bare (no surrounding `[]`).
fn serialize_pretty_inline_top(value: &Value, indent: &str, max_inline_width: usize, result: &mut String) {
    match value {
        Value::Array(arr) if arr.is_empty() => {}
        Value::Array(arr) => {
            let mut first = true;
            for v in arr {
                if !first {
                    result.push('\n');
                }
                first = false;
                render_pretty_inline(v, indent, 0, max_inline_width, result);
            }
        }
        Value::Object(map) if map.is_empty() => {}
        Value::Object(map) => {
            // Top-level object: keys at column 0, no surrounding braces
            // (mirrors `serialize_object_pretty` at depth=0, in_array=false).
            let mut first = true;
            for (k, v) in map.iter() {
                if !first {
                    result.push('\n');
                }
                first = false;
                serialize_key(k, result);
                result.push_str(" = ");
                render_pretty_inline(v, indent, 0, max_inline_width, result);
            }
        }
        Value::Null => {}
        _ => render_pretty_inline(value, indent, 0, max_inline_width, result),
    }
}

/// Render a single value at `depth`. Caller is responsible for any leading
/// indent (e.g. after `key = ` or inside an array's child loop).
fn render_pretty_inline(value: &Value, indent: &str, depth: usize, max_inline_width: usize, result: &mut String) {
    match value {
        Value::String(s) => { serialize_string(s, result); return; }
        Value::Number(n) => { serialize_number(n, result); return; }
        Value::Bool(b) => { result.push_str(if *b { "true" } else { "false" }); return; }
        Value::Null => { result.push_str("null"); return; }
        Value::Object(map) if map.is_empty() => { result.push_str("{}"); return; }
        Value::Array(arr) if arr.is_empty() => { result.push_str("[]"); return; }
        _ => {}
    }

    // Try fully-inline form first.
    let mut inline_buf = String::new();
    push_inline(value, &mut inline_buf);
    if inline_buf.len() <= max_inline_width {
        result.push_str(&inline_buf);
        return;
    }

    // Try wrapper_compact: brackets on their own lines, joined children on one line.
    let mut joined_buf = String::new();
    push_joined_children(value, &mut joined_buf);
    if !joined_buf.is_empty() && joined_buf.len() <= max_inline_width {
        let (open, close) = if matches!(value, Value::Object(_)) { ('{', '}') } else { ('[', ']') };
        result.push(open);
        result.push('\n');
        push_indent(result, indent, depth + 1);
        result.push_str(&joined_buf);
        result.push('\n');
        push_indent(result, indent, depth);
        result.push(close);
        return;
    }

    // wrapper_multi: open bracket inline, one child per line, close at parent indent.
    match value {
        Value::Object(map) => {
            result.push('{');
            for (k, v) in map.iter() {
                result.push('\n');
                push_indent(result, indent, depth + 1);
                serialize_key(k, result);
                result.push_str(" = ");
                render_pretty_inline(v, indent, depth + 1, max_inline_width, result);
            }
            result.push('\n');
            push_indent(result, indent, depth);
            result.push('}');
        }
        Value::Array(arr) => {
            result.push('[');
            for v in arr.iter() {
                result.push('\n');
                push_indent(result, indent, depth + 1);
                render_pretty_inline(v, indent, depth + 1, max_inline_width, result);
            }
            result.push('\n');
            push_indent(result, indent, depth);
            result.push(']');
        }
        _ => unreachable!(),
    }
}

/// Append `indent × n` to `result`.
fn push_indent(result: &mut String, indent: &str, n: usize) {
    for _ in 0..n {
        result.push_str(indent);
    }
}

/// Single-line rendering of a value with `{ k = v, ... }` / `[ a, b, ... ]`
/// spacing — including outer brackets/braces. Used both for the inline-mode
/// emission and for measuring length via the buffer's `len()`.
fn push_inline(value: &Value, out: &mut String) {
    match value {
        Value::Object(map) if map.is_empty() => out.push_str("{}"),
        Value::Object(map) => {
            out.push_str("{ ");
            let mut first = true;
            for (k, v) in map.iter() {
                if !first { out.push_str(", "); }
                first = false;
                serialize_key(k, out);
                out.push_str(" = ");
                push_inline(v, out);
            }
            out.push_str(" }");
        }
        Value::Array(arr) if arr.is_empty() => out.push_str("[]"),
        Value::Array(arr) => {
            out.push_str("[ ");
            let mut first = true;
            for v in arr.iter() {
                if !first { out.push_str(", "); }
                first = false;
                push_inline(v, out);
            }
            out.push_str(" ]");
        }
        Value::String(s) => serialize_string(s, out),
        Value::Number(n) => serialize_number(n, out),
        Value::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Value::Null => out.push_str("null"),
    }
}

/// Like [``push_inline``] but without the outer brackets/braces — just the
/// joined children. Returns empty string for scalars and empty containers.
fn push_joined_children(value: &Value, out: &mut String) {
    match value {
        Value::Object(map) => {
            let mut first = true;
            for (k, v) in map.iter() {
                if !first { out.push_str(", "); }
                first = false;
                serialize_key(k, out);
                out.push_str(" = ");
                push_inline(v, out);
            }
        }
        Value::Array(arr) => {
            let mut first = true;
            for v in arr.iter() {
                if !first { out.push_str(", "); }
                first = false;
                push_inline(v, out);
            }
        }
        _ => {}
    }
}

fn needs_quoting(s: &str) -> bool {
    if s.is_empty() {
        return true;
    }
    // Quote iff the key contains a byte that would terminate a bare key.
    s.bytes().any(is_key_delimiter)
}

/// Returns true for any byte that terminates a bare key (SPEC.md §3.3).
/// All such bytes are ASCII, so UTF-8 continuation/lead bytes never match.
fn is_key_delimiter(b: u8) -> bool {
    matches!(
        b,
        b' ' | b'\t'
            | b'\n'
            | b'\r'
            | b'='
            | b','
            | b'{'
            | b'}'
            | b'['
            | b']'
            | b'/'
            | b'"'
            | b'\''
            | b'#'
    )
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // =========================================================================
    // §2 — Document Form
    // =========================================================================

    #[test]
    fn empty_input_parses_to_null() {
        assert_eq!(parse("").unwrap(), json!(null));
    }

    #[test]
    fn whitespace_only_input_parses_to_null() {
        assert_eq!(parse("   \n\t\r\n  ").unwrap(), json!(null));
    }

    #[test]
    fn comments_only_input_parses_to_null() {
        assert_eq!(
            parse("// just a comment\n/* block */").unwrap(),
            json!(null)
        );
    }

    #[test]
    fn top_level_object_without_braces() {
        assert_eq!(
            parse(r#"name="x",port=80"#).unwrap(),
            json!({"name": "x", "port": 80})
        );
    }

    #[test]
    fn top_level_object_with_braces_is_single_element_array() {
        // Per SPEC.md §2: top-level `{...}` is always one element of the
        // implicit top-level array, never a document wrapper.
        assert_eq!(
            parse(r#"{name="x",port=80}"#).unwrap(),
            json!([{"name": "x", "port": 80}])
        );
    }

    #[test]
    fn top_level_explicit_array_is_single_element_array() {
        // Per SPEC.md §2: top-level `[...]` is always one element of the
        // implicit top-level array, never a document wrapper.
        assert_eq!(parse("[1, 2, 3]").unwrap(), json!([[1, 2, 3]]));
    }

    #[test]
    fn top_level_scalar_number() {
        assert_eq!(parse("42").unwrap(), json!([42]));
    }

    #[test]
    fn top_level_scalar_string() {
        assert_eq!(parse(r#""hello""#).unwrap(), json!(["hello"]));
    }

    #[test]
    fn top_level_scalar_boolean() {
        assert_eq!(parse("true").unwrap(), json!([true]));
        assert_eq!(parse("false").unwrap(), json!([false]));
    }

    #[test]
    fn top_level_scalar_null() {
        assert_eq!(parse("null").unwrap(), json!([null]));
    }

    #[test]
    fn top_level_multiple_scalars_newline_separated() {
        assert_eq!(parse("1\n2\n3").unwrap(), json!([1, 2, 3]));
    }

    #[test]
    fn top_level_multiple_scalars_comma_separated() {
        assert_eq!(parse(r#"1,2,"haha""#).unwrap(), json!([1, 2, "haha"]));
    }

    #[test]
    fn top_level_mixed_scalars_and_object() {
        // The example from the spec change request.
        assert_eq!(
            parse("1\n2\n\"haha\"\n{a=4}").unwrap(),
            json!([1, 2, "haha", {"a": 4}])
        );
    }

    #[test]
    fn top_level_multiple_objects() {
        assert_eq!(parse("{a=1}\n{b=2}").unwrap(), json!([{"a": 1}, {"b": 2}]));
    }

    #[test]
    fn top_level_keyword_as_key_is_object_mode() {
        // `true`, `false`, `null` in key position are strings, so `true=1`
        // is object mode, not array mode.
        assert_eq!(parse("true=1").unwrap(), json!({"true": 1}));
    }

    #[test]
    fn top_level_numeric_key_is_object_mode() {
        // Bare identifiers can contain digits, so `42="x"` is object mode.
        assert_eq!(parse("42=\"x\"").unwrap(), json!({"42": "x"}));
    }

    #[test]
    fn top_level_quoted_string_key_is_object_mode() {
        assert_eq!(parse(r#""key"="value""#).unwrap(), json!({"key": "value"}));
    }

    #[test]
    fn top_level_mixed_pair_then_scalar_is_error() {
        assert!(parse("a=1\n2").is_err());
    }

    #[test]
    fn top_level_mixed_scalar_then_pair_is_error() {
        assert!(parse("1\na=2").is_err());
    }

    #[test]
    fn top_level_array_then_pair_is_error() {
        assert!(parse("[1, 2] key=value").is_err());
    }

    #[test]
    fn serialize_top_level_array_compact() {
        assert_eq!(serialize(&json!([1, 2, "haha"])), r#"1,2,"haha""#);
    }

    #[test]
    fn serialize_top_level_array_pretty() {
        assert_eq!(
            serialize_pretty(&json!([1, 2, "haha"]), "  "),
            "1\n2\n\"haha\""
        );
    }

    #[test]
    fn serialize_top_level_array_with_object() {
        assert_eq!(serialize(&json!([1, {"a": 2}])), "1,{a=2}");
    }

    #[test]
    fn serialize_empty_object_to_empty_string() {
        assert_eq!(serialize(&json!({})), "");
    }

    #[test]
    fn serialize_empty_array_to_empty_string() {
        assert_eq!(serialize(&json!([])), "");
    }

    #[test]
    fn serialize_top_level_null_to_empty_string() {
        assert_eq!(serialize(&json!(null)), "");
    }

    #[test]
    fn serialize_nested_null_preserved() {
        assert_eq!(serialize(&json!({"a": null})), "a=null");
    }

    #[test]
    fn serialize_nested_array_preserved() {
        assert_eq!(serialize(&json!({"a": [1, 2, 3]})), "a=[1,2,3]");
    }

    // =========================================================================
    // §3.2 — Comments
    // =========================================================================

    #[test]
    fn single_line_comment_trailing() {
        assert_eq!(
            parse(r#"key="value" // trailing comment"#).unwrap(),
            json!({"key": "value"})
        );
    }

    #[test]
    fn block_comment_inline() {
        assert_eq!(
            parse(r#"key=/* inline */"value""#).unwrap(),
            json!({"key": "value"})
        );
    }

    #[test]
    fn block_comment_spanning_lines() {
        assert_eq!(
            parse("key=/* multi\nline\ncomment */\"value\"").unwrap(),
            json!({"key": "value"})
        );
    }

    #[test]
    fn unterminated_block_comment_is_error() {
        assert!(parse("key=/* unterminated").is_err());
    }

    // =========================================================================
    // §3.3 — Bare Keys
    // =========================================================================

    #[test]
    fn simple_identifier_key() {
        assert_eq!(
            parse(r#"keyname="value""#).unwrap(),
            json!({"keyname": "value"})
        );
    }

    #[test]
    fn keyword_true_as_string_key() {
        assert_eq!(parse(r#"true="yes""#).unwrap(), json!({"true": "yes"}));
    }

    #[test]
    fn keyword_false_as_string_key() {
        assert_eq!(parse(r#"false="no""#).unwrap(), json!({"false": "no"}));
    }

    #[test]
    fn keyword_null_as_string_key() {
        assert_eq!(
            parse(r#"null="nothing""#).unwrap(),
            json!({"null": "nothing"})
        );
    }

    #[test]
    fn key_with_hyphen() {
        assert_eq!(
            parse(r#"my-key="value""#).unwrap(),
            json!({"my-key": "value"})
        );
    }

    #[test]
    fn key_with_underscore_and_digits() {
        assert_eq!(
            parse(r#"key_1="value""#).unwrap(),
            json!({"key_1": "value"})
        );
    }

    #[test]
    fn key_with_dot() {
        assert_eq!(parse("app.version=1").unwrap(), json!({"app.version": 1}));
    }

    #[test]
    fn unicode_key() {
        assert_eq!(
            parse(r#"名前="テスト""#).unwrap(),
            json!({"名前": "テスト"})
        );
    }

    #[test]
    fn quoted_key_with_spaces() {
        assert_eq!(
            parse(r#""quoted key"="value""#).unwrap(),
            json!({"quoted key": "value"})
        );
    }

    #[test]
    fn empty_key_is_error() {
        assert!(parse("=value").is_err());
    }

    // =========================================================================
    // §3.4 — Strings
    // =========================================================================

    #[test]
    fn double_quoted_string() {
        assert_eq!(parse(r#"key="hello""#).unwrap(), json!({"key": "hello"}));
    }

    #[test]
    fn single_quoted_string() {
        assert_eq!(parse(r#"key='hello'"#).unwrap(), json!({"key": "hello"}));
    }

    #[test]
    fn string_escape_newline_and_tab() {
        assert_eq!(
            parse(r#"key="line1\nline2\tindented""#).unwrap(),
            json!({"key": "line1\nline2\tindented"})
        );
    }

    #[test]
    fn string_escape_unicode() {
        assert_eq!(parse(r#"key="é""#).unwrap(), json!({"key": "é"}));
    }

    #[test]
    fn string_escape_quote_and_backslash() {
        assert_eq!(
            parse(r#"key="a\"b\\c""#).unwrap(),
            json!({"key": "a\"b\\c"})
        );
    }

    #[test]
    fn raw_string_basic() {
        assert_eq!(
            parse(r###"key=r"C:\path""###).unwrap(),
            json!({"key": r"C:\path"})
        );
    }

    #[test]
    fn raw_string_with_hashes() {
        let result = parse(r###"key=r#"contains "quotes""#"###).unwrap();
        assert_eq!(result["key"], r#"contains "quotes""#);
    }

    #[test]
    fn raw_string_multiline() {
        let result = parse("key=r\"line1\nline2\"").unwrap();
        assert_eq!(result["key"], "line1\nline2");
    }

    #[test]
    fn unrecognized_escape_is_error() {
        assert!(parse(r#"key="\q""#).is_err());
    }

    #[test]
    fn literal_newline_in_regular_string_is_error() {
        assert!(parse("key=\"line1\nline2\"").is_err());
    }

    #[test]
    fn unterminated_string_is_error() {
        assert!(parse(r#"key="unterminated"#).is_err());
    }

    // =========================================================================
    // §3.5 — Numbers
    // =========================================================================

    #[test]
    fn decimal_integer() {
        assert_eq!(parse("n=42").unwrap(), json!({"n": 42}));
    }

    #[test]
    fn negative_integer() {
        assert_eq!(parse("n=-5").unwrap(), json!({"n": -5}));
    }

    #[test]
    fn number_with_underscores() {
        assert_eq!(parse("n=1_000_000").unwrap(), json!({"n": 1000000}));
    }

    #[test]
    fn negative_number_with_underscores() {
        assert_eq!(parse("n=-50_000").unwrap(), json!({"n": -50000}));
    }

    #[test]
    fn float_fractional() {
        assert_eq!(parse("n=12.5").unwrap(), json!({"n": 12.5}));
    }

    #[test]
    fn negative_float() {
        assert_eq!(parse("n=-45.67").unwrap(), json!({"n": -45.67}));
    }

    #[test]
    fn float_with_exponent_only() {
        assert_eq!(parse("n=1e10").unwrap(), json!({"n": 1e10}));
    }

    #[test]
    fn float_with_fractional_and_exponent() {
        assert_eq!(parse("n=1.5E-3").unwrap(), json!({"n": 1.5e-3}));
    }

    #[test]
    fn hex_literal_lowercase() {
        assert_eq!(parse("n=0xff").unwrap(), json!({"n": 255}));
    }

    #[test]
    fn hex_literal_uppercase_digits() {
        assert_eq!(parse("n=0xDE_AD").unwrap(), json!({"n": 0xDE_AD}));
    }

    #[test]
    fn octal_literal() {
        assert_eq!(parse("n=0o777").unwrap(), json!({"n": 511}));
    }

    #[test]
    fn binary_literal() {
        assert_eq!(parse("n=0b1010").unwrap(), json!({"n": 10}));
    }

    #[test]
    fn negative_hex_literal() {
        assert_eq!(parse("n=-0xff").unwrap(), json!({"n": -255}));
    }

    #[test]
    fn positive_with_plus_prefix_is_error() {
        assert!(parse("n=+5").is_err());
    }

    #[test]
    fn uppercase_hex_prefix_is_error() {
        assert!(parse("n=0Xff").is_err());
    }

    #[test]
    fn uppercase_octal_prefix_is_error() {
        assert!(parse("n=0O77").is_err());
    }

    #[test]
    fn uppercase_binary_prefix_is_error() {
        assert!(parse("n=0B10").is_err());
    }

    #[test]
    fn number_type_suffix_is_error() {
        assert!(parse("n=5u8").is_err());
    }

    #[test]
    fn leading_underscore_is_error() {
        assert!(parse("n=_5").is_err());
    }

    #[test]
    fn trailing_underscore_is_error() {
        assert!(parse("n=5_").is_err());
    }

    #[test]
    fn adjacent_underscores_are_error() {
        assert!(parse("n=5__5").is_err());
    }

    // =========================================================================
    // §5 — Objects
    // =========================================================================

    #[test]
    fn basic_key_value_pairs() {
        assert_eq!(
            parse(r#"a="hello", b=123.45"#).unwrap(),
            json!({"a": "hello", "b": 123.45})
        );
    }

    #[test]
    fn nested_object() {
        assert_eq!(
            parse(r#"server={host="localhost", port=8080}"#).unwrap(),
            json!({"server": {"host": "localhost", "port": 8080}})
        );
    }

    #[test]
    fn whitespace_around_equals_is_insignificant() {
        let a = parse(r#"name = "x""#).unwrap();
        let b = parse(r#"name="x""#).unwrap();
        let c = parse(r#"name ="x""#).unwrap();
        let d = parse(r#"name= "x""#).unwrap();
        assert_eq!(a, b);
        assert_eq!(b, c);
        assert_eq!(c, d);
    }

    #[test]
    fn duplicate_keys_at_top_level_are_error() {
        assert!(parse("a=1, a=2").is_err());
    }

    #[test]
    fn duplicate_keys_in_nested_object_are_error() {
        assert!(parse(r#"outer={a=1, a=2}"#).is_err());
    }

    #[test]
    fn key_order_is_preserved() {
        let result = parse(r#"z=1, a=2, m=3"#).unwrap();
        let keys: Vec<&String> = result.as_object().unwrap().keys().collect();
        assert_eq!(keys, vec!["z", "a", "m"]);
    }

    // =========================================================================
    // §5.3 — Separators
    // =========================================================================

    #[test]
    fn same_line_comma_separated() {
        assert_eq!(
            parse("a=1, b=2, c=3").unwrap(),
            json!({"a": 1, "b": 2, "c": 3})
        );
    }

    #[test]
    fn newline_separated_multiline() {
        assert_eq!(
            parse("a=1\nb=2\nc=3").unwrap(),
            json!({"a": 1, "b": 2, "c": 3})
        );
    }

    #[test]
    fn mixed_comma_and_newline_separators() {
        assert_eq!(
            parse("a=1,\nb=2,\nc=3").unwrap(),
            json!({"a": 1, "b": 2, "c": 3})
        );
    }

    #[test]
    fn trailing_comma_at_top_level() {
        assert_eq!(parse("a=1, b=2,").unwrap(), json!({"a": 1, "b": 2}));
    }

    #[test]
    fn trailing_comma_in_braced_object() {
        // Per SPEC.md §2: top-level `{...}` is a single-element array.
        assert_eq!(parse("{a=1, b=2,}").unwrap(), json!([{"a": 1, "b": 2}]));
    }

    #[test]
    fn trailing_comma_in_array() {
        assert_eq!(parse("k=[1, 2, 3,]").unwrap()["k"], json!([1, 2, 3]));
    }

    #[test]
    fn whitespace_around_comma_is_insignificant() {
        let a = parse("a=1,b=2").unwrap();
        let b = parse("a=1, b=2").unwrap();
        let c = parse("a=1 ,b=2").unwrap();
        let d = parse("a=1 , b=2").unwrap();
        assert_eq!(a, b);
        assert_eq!(b, c);
        assert_eq!(c, d);
    }

    #[test]
    fn same_line_space_only_separator_is_error() {
        assert!(parse("a=1 b=2").is_err());
    }

    #[test]
    fn same_line_tab_only_separator_is_error() {
        assert!(parse("a=1\tb=2").is_err());
    }

    #[test]
    fn array_same_line_no_commas_is_error() {
        assert!(parse("k=[1 2 3]").is_err());
    }

    // =========================================================================
    // §6 — Arrays
    // =========================================================================

    #[test]
    fn empty_array() {
        assert_eq!(parse("k=[]").unwrap()["k"], json!([]));
    }

    #[test]
    fn array_of_strings() {
        assert_eq!(
            parse(r#"k=["a", "b", "c"]"#).unwrap()["k"],
            json!(["a", "b", "c"])
        );
    }

    #[test]
    fn array_mixed_types() {
        assert_eq!(
            parse(r#"k=[1, "two", true, null]"#).unwrap()["k"],
            json!([1, "two", true, null])
        );
    }

    #[test]
    fn nested_arrays() {
        assert_eq!(
            parse("k=[[1, 2], [3, 4]]").unwrap()["k"],
            json!([[1, 2], [3, 4]])
        );
    }

    #[test]
    fn multiline_array_newline_separated() {
        assert_eq!(parse("k=[\n1\n2\n3\n]").unwrap()["k"], json!([1, 2, 3]));
    }

    #[test]
    fn unbalanced_array_is_error() {
        assert!(parse("k=[1, 2").is_err());
    }

    // =========================================================================
    // §7 — Serialization
    // =========================================================================

    #[test]
    fn compact_serialize_no_spaces_around_equals() {
        let value = json!({"name": "John", "age": 30});
        assert_eq!(serialize(&value), r#"name="John",age=30"#);
    }

    #[test]
    fn compact_serialize_nested_object() {
        let value = json!({"server": {"host": "localhost", "port": 8080}});
        assert_eq!(serialize(&value), r#"server={host="localhost",port=8080}"#);
    }

    #[test]
    fn compact_serialize_top_level_array() {
        // Top-level arrays serialize bare (no surrounding []).
        let value = json!([{"a": 1}, {"b": 2}]);
        assert_eq!(serialize(&value), r#"{a=1},{b=2}"#);
    }

    #[test]
    fn compact_serialize_has_no_trailing_comma() {
        let value = json!({"a": 1, "b": 2});
        let s = serialize(&value);
        assert!(!s.ends_with(','));
    }

    #[test]
    fn pretty_serialize_spaces_around_equals_no_trailing_commas() {
        let value = json!({"name": "John", "age": 30});
        assert_eq!(serialize_pretty(&value, "  "), "name = \"John\"\nage = 30");
    }

    #[test]
    fn pretty_serialize_nested_object() {
        let value = json!({"server": {"host": "localhost", "port": 8080}});
        assert_eq!(
            serialize_pretty(&value, "  "),
            "server = {\n  host = \"localhost\"\n  port = 8080\n}"
        );
    }

    #[test]
    fn pretty_serialize_deeply_nested() {
        // Mixed nesting stress test: arrays of objects containing arrays,
        // some with nested objects; deep object chains; arrays of arrays
        // containing objects. Verifies byte-level output across impls.
        let value = json!({
            "a1": [
                {"b1": ["c1"]},
                {"b1": ["c1", {"d1": 4}]},
                {"b1": ["c1"]},
                {"b1": ["c1"]},
                {"b1": ["c1"]},
                {"b1": ["c1"]}
            ],
            "a2": {
                "b2": {
                    "c2": {"d2": "hahaha"},
                    "c3": {"d3": "hohohoh"}
                }
            },
            "a3": [
                ["b4", "b5", "b6", {"c4": ["d1", "d3"]}]
            ]
        });
        let expected = r#"a1 = [
	{ b1 = [ "c1" ] }
	{ b1 = [ "c1", { d1 = 4 } ] }
	{ b1 = [ "c1" ] }
	{ b1 = [ "c1" ] }
	{ b1 = [ "c1" ] }
	{ b1 = [ "c1" ] }
]
a2 = {
	b2 = {
		c2 = { d2 = "hahaha" }
		c3 = { d3 = "hohohoh" }
	}
}
a3 = [
	[
		"b4", "b5", "b6", { c4 = [ "d1", "d3" ] }
	]
]"#;
        assert_eq!(
            serialize_pretty_with_options(
                &value,
                &PrettyOptions {
                    indent: "\t".to_string(),
                    max_inline_width: 44,
                }
            ),
            expected
        );
    }

    #[test]
    fn pretty_serialize_array_no_trailing_commas() {
        // Top-level arrays serialize bare: one element per line, no [].
        let value = json!([1, 2, 3, "hello"]);
        assert_eq!(serialize_pretty(&value, "  "), "1\n2\n3\n\"hello\"");
    }

    #[test]
    fn round_trip_compact_preserves_value() {
        let original = json!({"name": "John", "age": 30, "active": true});
        let parsed = parse(&serialize(&original)).unwrap();
        assert_eq!(original, parsed);
    }

    #[test]
    fn round_trip_pretty_preserves_value() {
        let original = json!({"name": "John", "tags": ["a", "b"]});
        let parsed = parse(&serialize_pretty(&original, "  ")).unwrap();
        assert_eq!(original, parsed);
    }

    #[test]
    fn hex_octal_binary_serialize_as_decimal() {
        assert_eq!(serialize(&json!({"n": 255})), "n=255");
        assert_eq!(serialize(&json!({"n": 511})), "n=511");
        assert_eq!(serialize(&json!({"n": 10})), "n=10");
    }

    // =========================================================================
    // §8 — Required Parse Errors (cross-cutting)
    // =========================================================================

    #[test]
    fn missing_value_is_error() {
        assert!(parse("key=").is_err());
        assert!(parse("key=,").is_err());
        assert!(parse("a=1, key=, b=2").is_err());
    }

    #[test]
    fn unbalanced_braces_are_error() {
        assert!(parse("{a=1").is_err());
        assert!(parse("a=1}").is_err());
    }

    // =========================================================================
    // Serde Integration (orthogonal to syntax spec)
    // =========================================================================

    #[test]
    fn serde_round_trip_struct() {
        use serde::{Deserialize, Serialize};

        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        struct Person {
            name: String,
            age: u32,
            email: String,
        }

        let original = Person {
            name: "Alice".to_string(),
            age: 25,
            email: "alice@example.com".to_string(),
        };

        let serialized = to_string(&original).unwrap();
        let deserialized: Person = from_str(&serialized).unwrap();
        assert_eq!(original, deserialized);
    }

    #[test]
    fn serde_nested_struct_round_trip() {
        use serde::{Deserialize, Serialize};

        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        struct ServerConfig {
            host: String,
            port: u16,
        }

        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        struct AppConfig {
            name: String,
            server: ServerConfig,
        }

        let config = AppConfig {
            name: "MyApp".to_string(),
            server: ServerConfig {
                host: "localhost".to_string(),
                port: 8080,
            },
        };

        let jhon_string = to_string(&config).unwrap();
        assert_eq!(
            jhon_string,
            r#"name="MyApp",server={host="localhost",port=8080}"#
        );
        let decoded: AppConfig = from_str(&jhon_string).unwrap();
        assert_eq!(config, decoded);
    }

    #[test]
    fn serde_struct_with_arrays_round_trip() {
        use serde::{Deserialize, Serialize};

        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        struct Config {
            tags: Vec<String>,
            scores: Vec<i32>,
        }

        let config = Config {
            tags: vec!["rust".to_string(), "web".to_string()],
            scores: vec![100, 95, 88],
        };

        let jhon_string = to_string(&config).unwrap();
        assert_eq!(jhon_string, r#"tags=["rust","web"],scores=[100,95,88]"#);
        let decoded: Config = from_str(&jhon_string).unwrap();
        assert_eq!(config, decoded);
    }

    #[test]
    fn serde_option_some_and_none() {
        use serde::{Deserialize, Serialize};

        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        struct Config {
            name: String,
            description: Option<String>,
        }

        let with_some = Config {
            name: "Test".to_string(),
            description: Some("A test config".to_string()),
        };
        assert_eq!(
            to_string(&with_some).unwrap(),
            r#"name="Test",description="A test config""#
        );

        let decoded: Config = from_str(r#"name="Test""#).unwrap();
        assert_eq!(decoded.name, "Test");
        assert_eq!(decoded.description, None);
    }

    #[test]
    fn serde_jhon_wrapper_round_trip() {
        use serde::{Deserialize, Serialize};

        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        struct Point {
            x: i32,
            y: i32,
        }

        let point = Point { x: 10, y: 20 };
        let jhon_string = Jhon::to_string(&point).unwrap();
        assert_eq!(jhon_string, "x=10,y=20");
        let decoded: Point = Jhon::from_str(&jhon_string).unwrap();
        assert_eq!(point, decoded);
    }

    #[test]
    fn serde_enum_representation() {
        use serde::{Deserialize, Serialize};

        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        enum Status {
            Active,
            Inactive,
            Pending,
        }

        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        struct Task {
            name: String,
            status: Status,
        }

        let task = Task {
            name: "Task1".to_string(),
            status: Status::Active,
        };

        let jhon_string = to_string(&task).unwrap();
        assert_eq!(jhon_string, r#"name="Task1",status="Active""#);
        let decoded: Task = from_str(&jhon_string).unwrap();
        assert_eq!(decoded, task);
    }

    #[test]
    fn serde_pretty_print_no_trailing_commas() {
        use serde::{Deserialize, Serialize};

        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        struct Config {
            name: String,
            age: u32,
        }

        let config = Config {
            name: "John".to_string(),
            age: 30,
        };

        assert_eq!(
            to_string_pretty(&config, "  ").unwrap(),
            "name = \"John\"\nage = 30"
        );
    }
}
