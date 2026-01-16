use anyhow::{Result, anyhow};
use serde_json::Value;
use serde_json::{Map, Number};

/// Parse a Jhon config string into a JSON Value
///
/// # Examples
///
/// ```
/// use jhon::parse;
///
/// let result = parse(r#"name="John" age=30"#).unwrap();
/// ```
pub fn parse(text: &str) -> Result<Value> {
    let input = remove_comments(text);
    let input = input.trim();

    if input.is_empty() {
        return Ok(Value::Object(Map::new()));
    }

    // Handle top-level objects wrapped in braces (from serialize)
    let input = input.trim();
    if input.starts_with('{') && input.ends_with('}') {
        // Parse as nested object
        let (value, _) = parse_nested_object(input, 0)?;
        return Ok(value);
    }

    parse_jhon_object(input)
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
/// assert_eq!(jhon_string, r#"age=30,name="John""#);
/// ```
pub fn serialize(value: &Value) -> String {
    let mut result = String::new();
    serialize_compact(value, &mut result);
    result
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
/// assert_eq!(jhon_string, "age = 30,\nname = \"John\"");
/// ```
pub fn serialize_pretty(value: &Value, indent: &str) -> String {
    let mut result = String::new();
    serialize_pretty_with_depth(value, indent, 0, false, &mut result);
    result
}

// =============================================================================
// Static Tables (from serde_json)
// =============================================================================

const BB: u8 = b'b';   // \\x08
const TT: u8 = b't';   // \\x09
const NN: u8 = b'n';   // \\x0A
const FF: u8 = b'f';   // \\x0C
const RR: u8 = b'r';   // \\x0D
const QU: u8 = b'"';   // \\x22
const BS: u8 = b'\\';  // \\x5C
const UU: u8 = b'u';   // \\x00...\\x1F except the ones above
const __: u8 = 0;      // No escape needed

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
// Bits: 0x01 = whitespace, 0x02 = digit, 0x04 = identifier char, 0x08 = structural
static CLASSIFICATION: [u8; 256] = {
    const C: u8 = 0; // normal character
    const W: u8 = 0x01; // whitespace
    const D: u8 = 0x02; // digit
    const I: u8 = 0x04; // identifier (alphanumeric, underscore, hyphen)
    const S: u8 = 0x08; // structural (=, {, }, [, ], ", ', ',')
    let mut table = [C; 256];
    // Whitespace
    table[b'\t' as usize] = W;
    table[b'\n' as usize] = W;
    table[b'\r' as usize] = W;
    table[b' ' as usize] = W;
    // Digits
    let mut i = b'0';
    while i <= b'9' {
        table[i as usize] = D | I;
        i += 1;
    }
    // Letters (identifier)
    let mut i = b'a';
    while i <= b'z' {
        table[i as usize] = I;
        table[(i - 32) as usize] = I; // uppercase
        i += 1;
    }
    // Identifier chars
    table[b'_' as usize] = I;
    table[b'-' as usize] = I;
    // Structural
    table[b'=' as usize] = S;
    table[b'{' as usize] = S;
    table[b'}' as usize] = S;
    table[b'[' as usize] = S;
    table[b']' as usize] = S;
    table[b'"' as usize] = S;
    table[b'\'' as usize] = S;
    table[b',' as usize] = S;
    table[b'#' as usize] = S;
    table
};

// Inline hints for hot paths
#[inline(always)]
fn is_whitespace(b: u8) -> bool {
    CLASSIFICATION[b as usize] & 0x01 != 0
}

#[inline(always)]
fn is_digit(b: u8) -> bool {
    CLASSIFICATION[b as usize] & 0x02 != 0
}

#[inline(always)]
fn is_identifier_char(b: u8) -> bool {
    CLASSIFICATION[b as usize] & 0x04 != 0
}

#[inline(always)]
fn is_structural(b: u8) -> bool {
    CLASSIFICATION[b as usize] & 0x08 != 0
}

// =============================================================================
// Optimized Parser
// =============================================================================

#[derive(Clone, Copy)]
struct Parser<'a> {
    input: &'a [u8],
    pos: usize,
}

impl<'a> Parser<'a> {
    fn new(input: &'a [u8]) -> Self {
        Self { input, pos: 0 }
    }

    fn current(&self) -> Option<u8> {
        self.input.get(self.pos).copied()
    }

    fn advance(&mut self) -> Option<u8> {
        let c = self.current()?;
        self.pos += 1;
        Some(c)
    }

    fn skip_byte(&mut self, byte: u8) {
        while self.current() == Some(byte) {
            self.pos += 1;
        }
    }

    // Skip all whitespace using SIMD-like byte scanning
    fn skip_whitespace(&mut self) {
        // Process 8 bytes at a time
        while self.pos + 8 <= self.input.len() {
            let chunk = u64::from_le_bytes([
                self.input[self.pos],
                self.input[self.pos + 1],
                self.input[self.pos + 2],
                self.input[self.pos + 3],
                self.input[self.pos + 4],
                self.input[self.pos + 5],
                self.input[self.pos + 6],
                self.input[self.pos + 7],
            ]);

            // Check if any byte is NOT whitespace
            // Whitespace: space (0x20), tab (0x09), newline (0x0A), carriage return (0x0D)
            // We use a trick: subtract 1 and check overflow to detect ranges
            let has_non_ws = {
                // For space (0x20): subtract 0x20, values < 0xE0 for whitespace
                // For tab/newline/CR (0x09-0x0D): subtract 1, values < 0x0D for range 0x01-0x0D
                // This is a simplified version - we check each byte
                let bytes = chunk.to_le_bytes();
                !bytes.iter().all(|&b| is_whitespace(b))
            };

            if has_non_ws {
                break;
            }
            self.pos += 8;
        }

        // Handle remaining bytes
        while self.pos < self.input.len() && is_whitespace(self.input[self.pos]) {
            self.pos += 1;
        }
    }

    fn skip_spaces_and_tabs(&mut self) {
        while self.pos < self.input.len() {
            let b = self.input[self.pos];
            if b == b' ' || b == b'\t' {
                self.pos += 1;
            } else {
                break;
            }
        }
    }

    // Optimized string parsing with fast byte scanning
    fn parse_string(&mut self, quote: u8) -> Result<String> {
        self.advance(); // skip opening quote

        let start = self.pos;

        // Fast path: scan for quote or escape using byte chunks
        while self.pos + 8 <= self.input.len() {
            let chunk = u64::from_le_bytes([
                self.input[self.pos],
                self.input[self.pos + 1],
                self.input[self.pos + 2],
                self.input[self.pos + 3],
                self.input[self.pos + 4],
                self.input[self.pos + 5],
                self.input[self.pos + 6],
                self.input[self.pos + 7],
            ]);

            // Check for quote or backslash in chunk
            // We use XOR to find bytes matching quote or backslash
            let diff_quote = chunk ^ u64::from_le_bytes([quote; 8]);
            let diff_bs = chunk ^ u64::from_le_bytes([b'\\'; 8]);

            // If either has a zero byte, we found a match
            if (diff_quote.wrapping_sub(0x0101010101010101) & !diff_quote & 0x8080808080808080) != 0
                || (diff_bs.wrapping_sub(0x0101010101010101) & !diff_bs & 0x8080808080808080) != 0
            {
                // Found quote or escape, check byte by byte
                let end = self.pos + 8;
                while self.pos < end {
                    let b = self.input[self.pos];
                    if b == quote {
                        let s = unsafe {
                            std::str::from_utf8_unchecked(&self.input[start..self.pos])
                        };
                        self.pos += 1;
                        return Ok(s.to_string());
                    }
                    if b == b'\\' {
                        break;
                    }
                    self.pos += 1;
                }
                if self.input[self.pos] == b'\\' {
                    break;
                }
            }
            self.pos += 8;
        }

        // Handle remaining bytes byte-by-byte
        let mut has_escape = false;
        while self.pos < self.input.len() {
            let b = self.input[self.pos];
            if b == quote {
                let s = std::str::from_utf8(&self.input[start..self.pos])
                    .map_err(|_| anyhow!("Invalid UTF-8 in string"))?;
                self.pos += 1;
                return Ok(s.to_string());
            }
            if b == b'\\' {
                has_escape = true;
                break;
            }
            self.pos += 1;
        }

        if !has_escape {
            return Err(anyhow!("Unterminated string"));
        }

        // Slow path: handle escapes
        let mut result = String::from_utf8_lossy(&self.input[start..self.pos]).into_owned();
        while self.pos < self.input.len() {
            let b = self.advance().ok_or_else(|| anyhow!("Unterminated string"))?;
            if b == quote {
                return Ok(result);
            }
            if b == b'\\' {
                let escaped = self.advance().ok_or_else(|| anyhow!("Incomplete escape sequence"))?;
                result.push(match escaped {
                    b'n' => '\n',
                    b'r' => '\r',
                    b't' => '\t',
                    b'b' => '\u{08}',
                    b'f' => '\u{0c}',
                    b'\\' => '\\',
                    b'"' | b'\'' => escaped as char,
                    b'u' => {
                        // Parse 4 hex digits - optimized hex parsing
                        let mut code = 0u16;
                        for _ in 0..4 {
                            let h = self.advance().ok_or_else(|| anyhow!("Incomplete Unicode escape"))?;
                            let digit = h.wrapping_sub(b'0');
                            let digit = if digit <= 9 {
                                digit
                            } else {
                                let h = h.wrapping_sub(b'a');
                                if h <= 5 {
                                    h + 10
                                } else {
                                    let h = h.wrapping_sub(b'A');
                                    if h <= 5 {
                                        h + 10
                                    } else {
                                        return Err(anyhow!("Invalid Unicode escape"));
                                    }
                                }
                            };
                            code = (code << 4) | digit as u16;
                        }
                        char::from_u32(code as u32).ok_or_else(|| anyhow!("Invalid Unicode code point"))?
                    }
                    _ => escaped as char,
                });
            } else {
                result.push(b as char);
            }
        }
        Err(anyhow!("Unterminated string"))
    }

    fn parse_raw_string(&mut self) -> Result<String> {
        self.advance(); // skip 'r'

        let mut hash_count = 0;
        while self.current() == Some(b'#') {
            hash_count += 1;
            self.advance();
        }

        if self.current() != Some(b'"') {
            return Err(anyhow!("Expected opening quote after r and # symbols in raw string"));
        }
        self.advance(); // skip opening quote

        let start = self.pos;

        while self.pos < self.input.len() {
            if self.input[self.pos] == b'"' {
                if self.pos + hash_count < self.input.len() {
                    let is_closing = (1..=hash_count).all(|j| {
                        self.input.get(self.pos + j) == Some(&b'#')
                    });

                    if is_closing {
                        let s = std::str::from_utf8(&self.input[start..self.pos])
                            .map_err(|_| anyhow!("Invalid UTF-8 in raw string"))?
                            .to_string();
                        self.pos += hash_count + 1;
                        return Ok(s);
                    }
                }
            }
            self.pos += 1;
        }

        Err(anyhow!("Unterminated raw string"))
    }

    // Optimized number parsing - avoids intermediate string allocation
    fn parse_number(&mut self) -> Result<Value> {
        let start = self.pos;
        let sign = if self.current() == Some(b'-') {
            self.advance();
            -1i64
        } else {
            1i64
        };

        // Parse integer part directly
        let mut value: u64 = 0;
        let mut has_digits = false;
        let mut has_underscore = false;

        while self.pos < self.input.len() {
            let b = self.input[self.pos];
            if is_digit(b) {
                // Check for overflow
                if value > (u64::MAX / 10) {
                    // Too large, fall back to string parsing
                    return self.parse_number_slow(start);
                }
                value = value.wrapping_mul(10).wrapping_add((b - b'0') as u64);
                self.pos += 1;
                has_digits = true;
            } else if b == b'_' {
                self.pos += 1;
                has_underscore = true;
            } else {
                break;
            }
        }

        if !has_digits {
            return Err(anyhow!("Invalid number"));
        }

        // Check for decimal point
        if self.current() == Some(b'.') {
            // Need to parse as float - use string parsing for accuracy
            return self.parse_number_slow(start);
        }

        // Apply sign
        let value = if sign < 0 {
            value.wrapping_neg()
        } else {
            value
        } as i64;

        Ok(Value::Number(Number::from(value)))
    }

    // Fallback: parse number using string (for floats or overflow cases)
    fn parse_number_slow(&mut self, start: usize) -> Result<Value> {
        // Continue parsing to end of number
        let mut has_digits = false;

        while self.pos < self.input.len() {
            let b = self.input[self.pos];
            if is_digit(b) {
                has_digits = true;
                self.pos += 1;
            } else if b == b'_' || b == b'.' || b == b'e' || b == b'E' || b == b'+' || b == b'-' {
                self.pos += 1;
            } else {
                break;
            }
        }

        if !has_digits {
            return Err(anyhow!("Invalid number"));
        }

        // Parse the number without underscores
        let num_str: String = self.input[start..self.pos]
            .iter()
            .filter(|&&b| b != b'_')
            .map(|&b| b as char)
            .collect();

        // Try parsing as integer first
        if let Ok(i) = num_str.parse::<i64>() {
            return Ok(Value::Number(Number::from(i)));
        }

        // Try as float
        let f = num_str.parse::<f64>()
            .map_err(|_| anyhow!("Could not parse number"))?;
        Number::from_f64(f).map(Value::Number).ok_or_else(|| anyhow!("Invalid number value"))
    }

    fn parse_array(&mut self) -> Result<(Value, usize)> {
        self.advance(); // skip '['
        let mut elements = Vec::new();

        self.skip_spaces_and_tabs();

        while self.current() != Some(b']') {
            if let Some(value) = self.parse_value()? {
                elements.push(value);
            }

            // Skip separators
            self.skip_byte(b'\n');
            self.skip_byte(b',');

            self.skip_spaces_and_tabs();

            if self.pos >= self.input.len() {
                return Err(anyhow!("Unterminated array"));
            }
        }

        self.pos += 1; // skip ']'
        Ok((Value::Array(elements), self.pos))
    }

    fn parse_nested_object(&mut self) -> Result<(Value, usize)> {
        self.advance(); // skip '{'
        let mut map = Map::new();

        self.skip_spaces_and_tabs();

        while self.current() != Some(b'}') {
            // Parse key
            let key = self.parse_key()?;

            // Skip whitespace before =
            self.skip_whitespace();

            // Expect =
            if self.current() != Some(b'=') {
                return Err(anyhow!("Expected '=' after key in nested object"));
            }
            self.pos += 1;

            // Skip whitespace before value
            self.skip_whitespace();

            // Parse value
            if let Some(value) = self.parse_value()? {
                map.insert(key, value);
            }

            // Skip separators
            self.skip_byte(b'\n');
            self.skip_byte(b',');

            self.skip_spaces_and_tabs();

            if self.pos >= self.input.len() {
                return Err(anyhow!("Unterminated nested object"));
            }
        }

        self.pos += 1; // skip '}'
        Ok((Value::Object(map), self.pos))
    }

    fn parse_key(&mut self) -> Result<String> {
        self.skip_whitespace();

        let quote = self.current();

        if quote == Some(b'"') || quote == Some(b'\'') {
            self.parse_string(quote.unwrap())
        } else {
            // Unquoted key - use optimized identifier char check
            let start = self.pos;
            while self.pos < self.input.len() && is_identifier_char(self.input[self.pos]) {
                self.pos += 1;
            }

            if start == self.pos {
                return Err(anyhow!("Empty key"));
            }

            unsafe {
                // Safety: we verified all characters are ASCII alphanumeric/underscore/hyphen
                Ok(std::str::from_utf8_unchecked(&self.input[start..self.pos]).to_string())
            }
        }
    }

    fn parse_value(&mut self) -> Result<Option<Value>> {
        self.skip_whitespace();

        let c = self.current().ok_or_else(|| anyhow!("Expected value"))?;

        let result = match c {
            b'"' | b'\'' => Some(Value::String(self.parse_string(c)?)),
            b'r' | b'R' => Some(Value::String(self.parse_raw_string()?)),
            b'[' => Some(self.parse_array()?.0),
            b'{' => Some(self.parse_nested_object()?.0),
            b'0'..=b'9' | b'-' => Some(self.parse_number()?),
            b't' | b'f' => Some(self.parse_boolean()?),
            b'n' => Some(self.parse_null()?),
            _ => return Err(anyhow!("Unexpected character in value: {}", c as char)),
        };

        Ok(result)
    }

    fn parse_boolean(&mut self) -> Result<Value> {
        if self.input.len() >= self.pos + 4
            && &self.input[self.pos..self.pos + 4] == b"true" {
            self.pos += 4;
            return Ok(Value::Bool(true));
        } else if self.input.len() >= self.pos + 5
            && &self.input[self.pos..self.pos + 5] == b"false" {
            self.pos += 5;
            return Ok(Value::Bool(false));
        }
        Err(anyhow!("Invalid boolean value"))
    }

    fn parse_null(&mut self) -> Result<Value> {
        if self.input.len() >= self.pos + 4
            && &self.input[self.pos..self.pos + 4] == b"null" {
            self.pos += 4;
            return Ok(Value::Null);
        }
        Err(anyhow!("Invalid null value"))
    }
}

fn remove_comments(input: &str) -> String {
    let mut result = Vec::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    let len = bytes.len();

    while i < len {
        if bytes[i] == b'/' && i + 1 < len {
            if bytes[i + 1] == b'/' {
                // Single line comment: skip to newline
                i += 2;
                while i < len && bytes[i] != b'\n' {
                    i += 1;
                }
                continue;
            } else if bytes[i + 1] == b'*' {
                // Multi-line comment: skip to */
                i += 2;
                while i < len {
                    if bytes[i] == b'*' && i + 1 < len && bytes[i + 1] == b'/' {
                        i += 2;
                        break;
                    }
                    i += 1;
                }
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }

    String::from_utf8(result).unwrap_or_default()
}

fn parse_jhon_object(input: &str) -> Result<Value> {
    let mut parser = Parser::new(input.as_bytes());
    let mut map = Map::new();

    parser.skip_spaces_and_tabs();

    while parser.pos < parser.input.len() {
        // Parse key
        let key = parser.parse_key()?;

        // Skip whitespace before =
        parser.skip_whitespace();

        // Expect =
        if parser.current() != Some(b'=') {
            return Err(anyhow!("Expected '=' after key"));
        }
        parser.pos += 1;

        // Skip whitespace before value
        parser.skip_whitespace();

        // Parse value
        if let Some(value) = parser.parse_value()? {
            map.insert(key, value);
        }

        // Skip separators after value
        parser.skip_byte(b'\n');
        parser.skip_byte(b',');

        parser.skip_spaces_and_tabs();
    }

    Ok(Value::Object(map))
}

fn parse_nested_object(input: &str, start_pos: usize) -> Result<(Value, usize)> {
    let mut parser = Parser::new(input.as_bytes());
    parser.pos = start_pos;

    let (value, end) = parser.parse_nested_object()?;
    Ok((value, end))
}

// =============================================================================
// Optimized Serializer
// =============================================================================

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

fn serialize_object_compact(map: &Map<String, Value>, result: &mut String) {
    // Collect and sort keys
    let mut keys: Vec<&String> = map.keys().collect();
    keys.sort();

    let mut first = true;
    for key in keys {
        if !first {
            result.push(',');
        }
        first = false;

        serialize_key(key, result);
        result.push('=');

        let value = &map[key];
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

fn serialize_array_compact(arr: &[Value], result: &mut String) {
    result.push('[');
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
    result.push(']');
}

fn serialize_key(key: &str, result: &mut String) {
    if needs_quoting(key) {
        serialize_string(key, result);
    } else {
        result.push_str(key);
    }
}

// Optimized string serialization using static escape table
fn serialize_string(s: &str, result: &mut String) {
    result.push('"');

    let bytes = s.as_bytes();
    let mut i = 0;

    while i < bytes.len() {
        // Find the next escape character
        let start = i;
        while i < bytes.len() {
            let escape = ESCAPE[bytes[i] as usize];
            if escape != 0 {
                break;
            }
            i += 1;
        }

        // Write the non-escaped portion directly
        if i > start {
            // Safety: we know this is valid UTF-8 since it's a substring of &str
            let safe_part = unsafe { std::str::from_utf8_unchecked(&bytes[start..i]) };
            result.push_str(safe_part);
        }

        if i < bytes.len() {
            let byte = bytes[i];
            i += 1;

            // Write the escape sequence
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
                    // Manual formatting: \uXXXX
                    const HEX: &[u8; 16] = b"0123456789abcdef";
                    result.push_str("\\u00");
                    result.push(HEX[(byte >> 4) as usize] as char);
                    result.push(HEX[(byte & 0x0F) as usize] as char);
                }
                _ => unsafe {
                    // Safety: ESCAPE table only has the above values
                    // This should never be reached
                    result.push(byte as char);
                }
            }
        }
    }

    result.push('"');
}

// Optimized number serialization using itoa and ryu
fn serialize_number(n: &Number, result: &mut String) {
    if let Some(i) = n.as_i64() {
        let mut buffer = itoa::Buffer::new();
        result.push_str(buffer.format(i));
    } else if let Some(u) = n.as_u64() {
        let mut buffer = itoa::Buffer::new();
        result.push_str(buffer.format(u));
    } else if let Some(f) = n.as_f64() {
        if f.fract() == 0.0 {
            let mut buffer = itoa::Buffer::new();
            result.push_str(buffer.format(f as i64));
        } else {
            let mut buffer = ryu::Buffer::new();
            result.push_str(buffer.format_finite(f));
        }
    } else {
        result.push_str("0");
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
    // Collect and sort keys
    let mut keys: Vec<&String> = map.keys().collect();
    keys.sort();

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
    for key in keys {
        if !first {
            result.push_str(",\n");
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

        let value = &map[key];
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

    let mut first = true;
    for value in arr {
        if !first {
            result.push_str(",\n");
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

    result.push('\n');
    for _ in 0..depth {
        result.push_str(indent);
    }
    result.push(']');
}

fn needs_quoting(s: &str) -> bool {
    if s.is_empty() {
        return true;
    }
    // Return true if key NEEDS quoting (has special chars)
    // Return false if key is simple (alphanumeric, underscore, hyphen)
    !s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_empty_input() {
        let result = parse("").unwrap();
        assert_eq!(result, json!({}));
    }

    #[test]
    fn test_basic_key_value() {
        let result = parse(r#"a="hello", b=123.45"#).unwrap();
        assert_eq!(
            result,
            json!({
                "a": "hello",
                "b": 123.45
            })
        );
    }

    #[test]
    fn test_string_types() {
        let result = parse(r#""quoted key"="value", unquoted_key="another""#).unwrap();
        assert_eq!(
            result,
            json!({
                "quoted key": "value",
                "unquoted_key": "another"
            })
        );
    }

    #[test]
    fn test_numbers() {
        let result = parse(r#"int=42, float=3.14, negative=-123, negative_float=-45.67"#).unwrap();
        assert_eq!(
            result,
            json!({
                "int": 42,
                "float": 3.14,
                "negative": -123,
                "negative_float": -45.67
            })
        );
    }

    #[test]
    fn test_numbers_with_underscores() {
        let result = parse(
            r#"large=100_000, million=1_000_000, decimal=1_234.567_890, neg_large=-50_000"#,
        )
        .unwrap();
        assert_eq!(
            result,
            json!({
                "large": 100_000,
                "million": 1_000_000,
                "decimal": 1_234.567_890,
                "neg_large": -50_000
            })
        );
    }

    #[test]
    fn test_booleans() {
        let result = parse(r#"truth=true, falsehood=false"#).unwrap();
        assert_eq!(
            result,
            json!({
                "truth": true,
                "falsehood": false
            })
        );
    }

    #[test]
    fn test_null_value() {
        let result = parse(r#"empty=null"#).unwrap();
        assert_eq!(result, json!({"empty": null}));
    }

    #[test]
    fn test_arrays_with_strings() {
        let result = parse(r#"strings=["hello", "world", "test"]"#).unwrap();
        assert_eq!(
            result,
            json!({
                "strings": ["hello", "world", "test"]
            })
        );
    }

    #[test]
    fn test_arrays_with_numbers() {
        let result = parse(r#"numbers=[1, 2.5, -3, 4.0]"#).unwrap();
        assert_eq!(
            result,
            json!({
                "numbers": [1, 2.5, -3, 4.0]
            })
        );
    }

    #[test]
    fn test_nested_objects() {
        let result = parse(r#"server={host="localhost", port=8080}"#).unwrap();
        assert_eq!(
            result,
            json!({
                "server": {
                    "host": "localhost",
                    "port": 8080
                }
            })
        );
    }

    #[test]
    fn test_raw_strings() {
        let result = parse(r###"path=r"C:\Windows\System32""###).unwrap();
        assert_eq!(result, json!({"path": r"C:\Windows\System32"}));

        let result2 = parse(r###"quote=r#"He said "hello" to me"#"###).unwrap();
        assert_eq!(result2["quote"], r#"He said "hello" to me"#);
    }

    #[test]
    fn test_serialize_basic_object() {
        let value = json!({"name": "John", "age": 30});
        let result = serialize(&value);
        assert_eq!(result, r#"age=30,name="John""#);
    }

    #[test]
    fn test_serialize_nested_object() {
        let value = json!({"server": {"host": "localhost", "port": 8080.0}});
        let result = serialize(&value);
        assert_eq!(result, r#"server={host="localhost",port=8080}"#);
    }

    #[test]
    fn test_serialize_array_with_objects() {
        let value = json!([{"name": "John", "age": 30}, {"name": "Jane", "age": 25}]);
        let result = serialize(&value);
        assert_eq!(result, r#"[{age=30,name="John"},{age=25,name="Jane"}]"#);
    }

    #[test]
    fn test_serialize_round_trip_simple() {
        let original = json!({"name": "John", "age": 30, "active": true});
        let serialized = serialize(&original);
        let parsed = parse(&serialized).unwrap();
        assert_eq!(original, parsed);
    }

    #[test]
    fn test_serialize_pretty_basic_object() {
        let value = json!({"name": "John", "age": 30});
        let result = serialize_pretty(&value, "  ");
        assert_eq!(result, "age = 30,\nname = \"John\"");
    }

    #[test]
    fn test_serialize_pretty_nested_objects() {
        let value = json!({"server": {"host": "localhost", "port": 8080}});
        let result = serialize_pretty(&value, "  ");
        assert_eq!(
            result,
            "server = {\n  host = \"localhost\",\n  port = 8080\n}"
        );
    }

    #[test]
    fn test_serialize_pretty_array() {
        let value = json!([1, 2, 3, "hello"]);
        let result = serialize_pretty(&value, "  ");
        assert_eq!(result, "[\n  1,\n  2,\n  3,\n  \"hello\"\n]");
    }

    #[test]
    fn test_serialize_pretty_array_with_objects() {
        let value = json!([{"name": "John", "age": 30}, {"name": "Jane", "age": 25}]);
        let result = serialize_pretty(&value, "  ");
        assert_eq!(
            result,
            "[\n  {\n    age = 30,\n    name = \"John\"\n  },\n  {\n    age = 25,\n    name = \"Jane\"\n  }\n]"
        );
    }

    #[test]
    fn test_serialize_pretty_round_trip() {
        let original = json!({
            "name": "John",
            "age": 30,
            "active": true,
            "tags": ["developer", "rust"]
        });
        let serialized = serialize_pretty(&original, "  ");
        let parsed = parse(&serialized).unwrap();
        assert_eq!(original, parsed);
    }
}
