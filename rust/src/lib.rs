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

    parse_jhon_object(input)
}

fn remove_comments(input: &str) -> String {
    let mut result = String::new();
    let mut chars = input.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            '/' => {
                if let Some(&next_char) = chars.peek() {
                    match next_char {
                        '/' => {
                            // Single line comment: consume until newline
                            chars.next(); // consume the second '/'
                            while let Some(&ch) = chars.peek() {
                                if ch == '\n' {
                                    break;
                                }
                                chars.next();
                            }
                        }
                        '*' => {
                            // Multi-line comment: consume until */
                            chars.next(); // consume the '*'
                            let mut found_end = false;
                            while let Some(&ch) = chars.peek() {
                                if ch == '*' {
                                    chars.next(); // consume '*'
                                    if let Some(&next_ch) = chars.peek()
                                        && next_ch == '/'
                                    {
                                        chars.next(); // consume '/'
                                        found_end = true;
                                        break;
                                    }
                                } else {
                                    chars.next();
                                }
                            }
                            if !found_end {
                                // Unterminated multi-line comment, treat as literal
                                result.push_str("/*");
                            }
                        }
                        _ => {
                            result.push(c);
                        }
                    }
                } else {
                    result.push(c);
                }
            }
            _ => result.push(c),
        }
    }
    result
}

fn parse_jhon_object(input: &str) -> Result<Value> {
    let mut map = Map::new();
    let mut i = 0;
    let chars: Vec<char> = input.chars().collect();
    let len = chars.len();

    while i < len {
        // Skip whitespace and commas (flexible separators)
        while i < len && (chars[i].is_whitespace() || chars[i] == ',') {
            i += 1;
        }

        if i >= len {
            break;
        }

        // Parse key
        let (key, new_i) = parse_key(&chars, i)?;
        i = new_i;

        // Skip whitespace before =
        while i < len && chars[i].is_whitespace() {
            i += 1;
        }

        // Expect =
        if i >= len || chars[i] != '=' {
            return Err(anyhow!("Expected '=' after key"));
        }
        i += 1;

        // Skip whitespace before value
        while i < len && chars[i].is_whitespace() {
            i += 1;
        }

        // Parse value
        let (value, new_i) = parse_value(&chars, i)?;
        i = new_i;

        // Insert into map
        map.insert(key, value);

        // Skip whitespace and commas after value (flexible separators)
        // Don't advance here - let the loop handle it
    }

    Ok(Value::Object(map))
}

fn parse_key(chars: &[char], mut i: usize) -> Result<(String, usize)> {
    // Skip whitespace
    while i < chars.len() && chars[i].is_whitespace() {
        i += 1;
    }

    if i >= chars.len() {
        return Err(anyhow!("Expected key"));
    }

    let start = i;

    if chars[i] == '"' || chars[i] == '\'' {
        // Quoted key (single or double quotes)
        let quote_char = chars[i];
        i += 1;
        let mut key = String::new();
        while i < chars.len() {
            if chars[i] == quote_char {
                i += 1;
                return Ok((key, i));
            } else if chars[i] == '\\' {
                i += 1;
                if i < chars.len() {
                    // Process escape sequences in keys
                    match chars[i] {
                        'n' => key.push('\n'),
                        'r' => key.push('\r'),
                        't' => key.push('\t'),
                        'b' => key.push('\u{08}'),
                        'f' => key.push('\u{0c}'),
                        '\\' => key.push('\\'),
                        '"' | '\'' => key.push(chars[i]),
                        'u' => {
                            // Unicode escape sequence
                            i += 1;
                            if i + 3 >= chars.len() {
                                return Err(anyhow!("Incomplete Unicode escape sequence"));
                            }
                            let unicode_str: String = chars[i..i + 4].iter().collect();
                            if let Ok(code_point) = u16::from_str_radix(&unicode_str, 16) {
                                if let Some(unicode_char) = char::from_u32(code_point as u32) {
                                    key.push(unicode_char);
                                } else {
                                    return Err(anyhow!("Invalid Unicode code point"));
                                }
                            } else {
                                return Err(anyhow!("Invalid Unicode escape sequence"));
                            }
                            i += 3;
                        }
                        _ => {
                            // Unknown escape, treat as literal
                            key.push('\\');
                            key.push(chars[i]);
                        }
                    }
                    i += 1;
                }
            } else {
                key.push(chars[i]);
                i += 1;
            }
        }
        return Err(anyhow!("Unterminated string in key"));
    } else {
        // Unquoted key
        while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_' || chars[i] == '-')
        {
            i += 1;
        }
    }

    let key: String = chars[start..i].iter().collect();
    if key.is_empty() {
        return Err(anyhow!("Empty key"));
    }

    Ok((key, i))
}

fn parse_value(chars: &[char], mut i: usize) -> Result<(Value, usize)> {
    // Skip whitespace
    while i < chars.len() && chars[i].is_whitespace() {
        i += 1;
    }

    if i >= chars.len() {
        return Err(anyhow!("Expected value"));
    }

    if chars[i] == '"' || chars[i] == '\'' {
        // Regular string (single or double quotes)
        parse_string_value(chars, i)
    } else if chars[i] == 'r' || chars[i] == 'R' {
        // Raw string (r"..." or r#"..."# or r##"..."##, etc.)
        parse_raw_string_value(chars, i)
    } else if chars[i] == '[' {
        // Array
        parse_array(chars, i)
    } else if chars[i] == '{' {
        // Nested object
        parse_nested_object(chars, i)
    } else if chars[i].is_ascii_digit() || chars[i] == '-' {
        // Number
        parse_number(chars, i)
    } else if chars[i] == 't' || chars[i] == 'f' {
        // Boolean
        parse_boolean(chars, i)
    } else if chars[i] == 'n' {
        // Null
        parse_null(chars, i)
    } else {
        Err(anyhow!("Unexpected character in value: {}", chars[i]))
    }
}

fn parse_string_value(chars: &[char], mut i: usize) -> Result<(Value, usize)> {
    assert!(chars[i] == '"' || chars[i] == '\'');
    let quote_char = chars[i];
    i += 1; // skip opening quote

    let mut result = String::new();
    while i < chars.len() {
        if chars[i] == quote_char {
            i += 1; // skip closing quote
            return Ok((Value::String(result), i));
        } else if chars[i] == '\\' {
            i += 1;
            if i < chars.len() {
                match chars[i] {
                    'n' => result.push('\n'),
                    'r' => result.push('\r'),
                    't' => result.push('\t'),
                    'b' => result.push('\u{08}'),
                    'f' => result.push('\u{0c}'),
                    '\\' => result.push('\\'),
                    '"' | '\'' => result.push(chars[i]),
                    'u' => {
                        // Unicode escape sequence
                        i += 1;
                        if i + 3 >= chars.len() {
                            return Err(anyhow!("Incomplete Unicode escape sequence"));
                        }
                        let unicode_str: String = chars[i..i + 4].iter().collect();
                        if let Ok(code_point) = u16::from_str_radix(&unicode_str, 16) {
                            if let Some(unicode_char) = char::from_u32(code_point as u32) {
                                result.push(unicode_char);
                            } else {
                                return Err(anyhow!("Invalid Unicode code point"));
                            }
                        } else {
                            return Err(anyhow!("Invalid Unicode escape sequence"));
                        }
                        i += 3;
                    }
                    _ => {
                        // Unknown escape, treat as literal
                        result.push('\\');
                        result.push(chars[i]);
                    }
                }
                i += 1;
            }
        } else {
            result.push(chars[i]);
            i += 1;
        }
    }
    Err(anyhow!("Unterminated string"))
}

fn parse_raw_string_value(chars: &[char], mut i: usize) -> Result<(Value, usize)> {
    // Raw strings follow Rust syntax: r"..." or r#"..."# or r##"..."##, etc.
    assert!(chars[i] == 'r' || chars[i] == 'R');
    i += 1; // skip 'r' or 'R'

    if i >= chars.len() {
        return Err(anyhow!("Unexpected end of input in raw string"));
    }

    // Count the number of # symbols
    let mut hash_count = 0;
    while i < chars.len() && chars[i] == '#' {
        hash_count += 1;
        i += 1;
    }

    if i >= chars.len() || chars[i] != '"' {
        return Err(anyhow!(
            "Expected opening quote after r and # symbols in raw string"
        ));
    }

    i += 1; // skip opening quote

    let start = i;

    // Look for the closing sequence: " followed by hash_count # symbols
    while i < chars.len() {
        // Check if we're at a closing quote
        if chars[i] == '"' {
            // Check if there are enough # symbols after the quote
            if i + hash_count < chars.len() {
                let mut is_closing = true;
                for j in 1..=hash_count {
                    if chars[i + j] != '#' {
                        is_closing = false;
                        break;
                    }
                }

                if is_closing {
                    // Found the closing marker: " followed by hash_count # symbols
                    let content: String = chars[start..i].iter().collect();
                    return Ok((Value::String(content), i + hash_count + 1));
                }
            }
        }

        i += 1;
    }

    Err(anyhow!(
        "Unterminated raw string (expected closing: \"{}{})",
        "#".repeat(hash_count),
        "\""
    ))
}

fn parse_array(chars: &[char], mut i: usize) -> Result<(Value, usize)> {
    assert!(chars[i] == '[');
    i += 1; // skip opening bracket

    let mut elements = Vec::new();

    while i < chars.len() {
        // Skip whitespace and commas (flexible separators)
        while i < chars.len() && (chars[i].is_whitespace() || chars[i] == ',') {
            i += 1;
        }

        if i >= chars.len() {
            return Err(anyhow!("Unterminated array"));
        }

        if chars[i] == ']' {
            i += 1;
            return Ok((Value::Array(elements), i));
        }

        // Parse element
        let (element, new_i) = parse_value(chars, i)?;
        elements.push(element);
        i = new_i;
    }

    Err(anyhow!("Unterminated array"))
}

fn parse_nested_object(chars: &[char], mut i: usize) -> Result<(Value, usize)> {
    assert!(chars[i] == '{');
    i += 1; // skip opening brace

    let mut map = Map::new();

    while i < chars.len() {
        // Skip whitespace and commas (flexible separators)
        while i < chars.len() && (chars[i].is_whitespace() || chars[i] == ',') {
            i += 1;
        }

        if i >= chars.len() {
            return Err(anyhow!("Unterminated nested object"));
        }

        if chars[i] == '}' {
            i += 1;
            return Ok((Value::Object(map), i));
        }

        // Parse key
        let (key, new_i) = parse_key(chars, i)?;
        i = new_i;

        // Skip whitespace before =
        while i < chars.len() && chars[i].is_whitespace() {
            i += 1;
        }

        // Expect =
        if i >= chars.len() || chars[i] != '=' {
            return Err(anyhow!("Expected '=' after key in nested object"));
        }
        i += 1;

        // Skip whitespace before value
        while i < chars.len() && chars[i].is_whitespace() {
            i += 1;
        }

        // Parse value
        let (value, new_i) = parse_value(chars, i)?;
        i = new_i;

        // Insert into map
        map.insert(key, value);

        // Skip whitespace and commas after value (flexible separators)
        // Don't advance here - let the loop handle it
    }

    Err(anyhow!("Unterminated nested object"))
}

fn parse_number(chars: &[char], mut i: usize) -> Result<(Value, usize)> {
    let start = i;

    // Optional minus sign
    if i < chars.len() && chars[i] == '-' {
        i += 1;
    }

    // Digits before decimal point
    let mut has_digits = false;
    while i < chars.len() && chars[i].is_ascii_digit() {
        has_digits = true;
        i += 1;
    }

    if !has_digits {
        return Err(anyhow!("Invalid number"));
    }

    // Optional decimal part
    if i < chars.len() && chars[i] == '.' {
        i += 1;
        let mut has_decimal_digits = false;
        while i < chars.len() && chars[i].is_ascii_digit() {
            has_decimal_digits = true;
            i += 1;
        }
        if !has_decimal_digits {
            return Err(anyhow!("Invalid decimal number"));
        }
    }

    let num_str: String = chars[start..i].iter().collect();
    match num_str.parse::<f64>() {
        Ok(num) => {
            if let Some(number) = Number::from_f64(num) {
                Ok((Value::Number(number), i))
            } else {
                Err(anyhow!("Invalid number value"))
            }
        }
        Err(_) => Err(anyhow!("Could not parse number")),
    }
}

fn parse_boolean(chars: &[char], i: usize) -> Result<(Value, usize)> {
    if i + 3 < chars.len()
        && chars[i] == 't'
        && chars[i + 1] == 'r'
        && chars[i + 2] == 'u'
        && chars[i + 3] == 'e'
    {
        Ok((Value::Bool(true), i + 4))
    } else if i + 4 < chars.len()
        && chars[i] == 'f'
        && chars[i + 1] == 'a'
        && chars[i + 2] == 'l'
        && chars[i + 3] == 's'
        && chars[i + 4] == 'e'
    {
        Ok((Value::Bool(false), i + 5))
    } else {
        Err(anyhow!("Invalid boolean value"))
    }
}

fn parse_null(chars: &[char], i: usize) -> Result<(Value, usize)> {
    if i + 3 < chars.len()
        && chars[i] == 'n'
        && chars[i + 1] == 'u'
        && chars[i + 2] == 'l'
        && chars[i + 3] == 'l'
    {
        Ok((Value::Null, i + 4))
    } else {
        Err(anyhow!("Invalid null value"))
    }
}

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
    fn test_string_values() {
        let result = parse(r#"text="simple string", empty="", spaces="  with  spaces  ""#).unwrap();
        assert_eq!(
            result,
            json!({
                "text": "simple string",
                "empty": "",
                "spaces": "  with  spaces  "
            })
        );
    }

    #[test]
    fn test_string_escaping() {
        let result = parse(
            r#"
            newline="hello\nworld",
            tab="tab\there",
            backslash="path\\to\\file",
            quote="say \"hello\"",
            carriage_return="line1\rline2"
        "#,
        )
        .unwrap();
        assert_eq!(
            result,
            json!({
                "newline": "hello\nworld",
                "tab": "tab\there",
                "backslash": "path\\to\\file",
                "quote": "say \"hello\"",
                "carriage_return": "line1\rline2"
            })
        );
    }

    #[test]
    fn test_unicode_escape() {
        let result = parse(r#"unicode="Hello\u00A9World", emoji="\u2764\ufe0f""#).unwrap();
        assert_eq!(
            result,
            json!({
                "unicode": "Hello©World",
                "emoji": "❤️"
            })
        );
    }

    #[test]
    fn test_numbers() {
        let result = parse(r#"int=42, float=3.14, negative=-123, negative_float=-45.67"#).unwrap();
        assert_eq!(
            result,
            json!({
                "int": 42.0,
                "float": 3.14,
                "negative": -123.0,
                "negative_float": -45.67
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
    fn test_empty_arrays() {
        let result = parse(r#"empty=[]"#).unwrap();
        assert_eq!(result, json!({"empty": []}));
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
                "numbers": [1.0, 2.5, -3.0, 4.0]
            })
        );
    }

    #[test]
    fn test_arrays_with_mixed_types() {
        let result = parse(r#"mixed=["hello", 123, true, null, 45.6]"#).unwrap();
        assert_eq!(
            result,
            json!({
                "mixed": ["hello", 123.0, true, null, 45.6]
            })
        );
    }

    #[test]
    fn test_arrays_with_whitespace() {
        let result = parse(r#"arr = [ "a" , 1 , true , null ]"#).unwrap();
        assert_eq!(
            result,
            json!({
                "arr": ["a", 1.0, true, null]
            })
        );
    }

    #[test]
    fn test_multiline() {
        let result = parse(
            r#"
            name = "test",
            age = 25,
            active = true,
            tags = ["tag1", "tag2"],
            score = 98.5
        "#,
        )
        .unwrap();
        assert_eq!(
            result,
            json!({
                "name": "test",
                "age": 25.0,
                "active": true,
                "tags": ["tag1", "tag2"],
                "score": 98.5
            })
        );
    }

    #[test]
    fn test_single_line_comments() {
        let result = parse(
            r#"
            // This is a comment
            name = "test"  // inline comment
            age = 25
            // Another comment
            active = true
        "#,
        )
        .unwrap();
        assert_eq!(
            result,
            json!({
                "name": "test",
                "age": 25.0,
                "active": true
            })
        );
    }

    #[test]
    fn test_multiline_comments() {
        let result = parse(
            r#"
            /* This is a
               multiline comment */
            name = "test"
            /* Another comment */
            age = 25
        "#,
        )
        .unwrap();
        assert_eq!(
            result,
            json!({
                "name": "test",
                "age": 25.0
            })
        );
    }

    #[test]
    fn test_inline_multiline_comments() {
        let result = parse(r#"name="test" /* inline comment */, age=25"#).unwrap();
        assert_eq!(
            result,
            json!({
                "name": "test",
                "age": 25.0
            })
        );
    }

    #[test]
    fn test_trailing_commas() {
        let result = parse(r#"name="test", age=25, "#).unwrap();
        assert_eq!(
            result,
            json!({
                "name": "test",
                "age": 25.0
            })
        );

        let result2 = parse(r#"name="only", "#).unwrap();
        assert_eq!(result2, json!({"name": "only"}));
    }

    #[test]
    fn test_array_trailing_commas() {
        let result = parse(r#"items=["apple", "banana", "cherry", ]"#).unwrap();
        assert_eq!(
            result,
            json!({
                "items": ["apple", "banana", "cherry"]
            })
        );
    }

    #[test]
    fn test_special_characters_in_strings() {
        let result = parse(r#"text="Hello, World! @#$%^&*()_+-={}[]|\\:;\"'<>?,./""#).unwrap();
        assert_eq!(
            result,
            json!({"text": "Hello, World! @#$%^&*()_+-={}[]|\\:;\"'<>?,./"})
        );
    }

    #[test]
    fn test_key_with_underscores_and_numbers() {
        let result =
            parse(r#"key_1="value1", key_2_test="value2", _private="secret", key123="numbered""#)
                .unwrap();
        assert_eq!(
            result,
            json!({
                "key_1": "value1",
                "key_2_test": "value2",
                "_private": "secret",
                "key123": "numbered"
            })
        );
    }

    #[test]
    fn test_complex_example() {
        let jhon_input = r#"
            // Application configuration
            app_name = "ocean-note",
            version = "1.0.0",

            // Feature flags
            features = ["markdown", "collaboration", "real-time"],

            // Numeric settings
            max_file_size = 1048576,  // 1MB in bytes
            timeout = 30.5,

            debug = true,
            log_level = "info"
        "#;

        let result = parse(jhon_input).unwrap();
        assert_eq!(result["app_name"], "ocean-note");
        assert_eq!(result["version"], "1.0.0");
        assert_eq!(
            result["features"],
            json!(["markdown", "collaboration", "real-time"])
        );
        assert_eq!(result["max_file_size"], 1048576.0);
        assert_eq!(result["timeout"], 30.5);
        assert_eq!(result["debug"], true);
        assert_eq!(result["log_level"], "info");
    }

    #[test]
    fn test_nested_objects() {
        let result = parse(r#"server={host="localhost", port=8080}"#).unwrap();
        assert_eq!(
            result,
            json!({
                "server": {
                    "host": "localhost",
                    "port": 8080.0
                }
            })
        );

        let result2 = parse(r#"config={name="test" value=123}"#).unwrap();
        assert_eq!(
            result2,
            json!({
                "config": {
                    "name": "test",
                    "value": 123.0
                }
            })
        );

        let result3 = parse(r#"data={items=[1 2 3] active=true}"#).unwrap();
        assert_eq!(
            result3,
            json!({
                "data": {
                    "items": [1.0, 2.0, 3.0],
                    "active": true
                }
            })
        );

        let result4 = parse(r#"outer={inner={deep="value"} number=42}"#).unwrap();
        assert_eq!(
            result4,
            json!({
                "outer": {
                    "inner": {
                        "deep": "value"
                    },
                    "number": 42.0
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

        let result3 = parse(r###"regex=r"\d+\w*\s*""###).unwrap();
        assert_eq!(result3["regex"], r"\d+\w*\s*");

        let result4 = parse(r###"empty=r"""###).unwrap();
        assert_eq!(result4, json!({"empty": ""}));

        let result5 = parse(r#"uppercase=R"C:\Program Files\""#).unwrap();
        assert_eq!(result5["uppercase"], r"C:\Program Files\");
    }

    #[test]
    fn test_raw_strings_with_hashes() {
        let result = parse(r###"contains_hash=r#"This has a " quote in it"#"###).unwrap();
        assert_eq!(result["contains_hash"], r#"This has a " quote in it"#);

        let result2 = parse(r####"double_hash=r##"This has "quotes" and # hashes"##"####).unwrap();
        assert_eq!(result2["double_hash"], r#"This has "quotes" and # hashes"#);
    }

    #[test]
    fn test_flexible_separators_in_objects() {
        let result = parse(r#"a="hello" b="world""#).unwrap();
        assert_eq!(
            result,
            json!({
                "a": "hello",
                "b": "world"
            })
        );

        let result2 = parse(
            r#"name="test"
age=25"#,
        )
        .unwrap();
        assert_eq!(
            result2,
            json!({
                "name": "test",
                "age": 25.0
            })
        );
    }

    #[test]
    fn test_flexible_separators_in_arrays() {
        let result = parse(r#"arr=[1 2 3]"#).unwrap();
        assert_eq!(result, json!({"arr": [1.0, 2.0, 3.0]}));

        let result2 = parse(
            r#"items=[
"a"
"b"
"c"]"#,
        )
        .unwrap();
        assert_eq!(result2, json!({"items": ["a", "b", "c"]}));
    }

    #[test]
    fn test_single_quoted_strings() {
        // Test single quoted strings
        let result = parse(r#"name='John', greeting='Hello'"#).unwrap();
        assert_eq!(
            result,
            json!({
                "name": "John",
                "greeting": "Hello"
            })
        );
    }

    #[test]
    fn test_mixed_quote_styles() {
        // Test mixing single and double quotes
        let result = parse(r#"double="value1", single='value2'"#).unwrap();
        assert_eq!(
            result,
            json!({
                "double": "value1",
                "single": "value2"
            })
        );
    }

    #[test]
    fn test_single_quoted_keys() {
        // Test single quoted keys
        let result = parse(r#"my-key='value', another-key='test'"#).unwrap();
        assert_eq!(
            result,
            json!({
                "my-key": "value",
                "another-key": "test"
            })
        );
    }

    #[test]
    fn test_quotes_inside_strings() {
        // Test double quotes inside single quotes
        let result = parse(r#"text='He said "hello" to me'"#).unwrap();
        assert_eq!(result["text"], r#"He said "hello" to me"#);

        // Test single quotes inside double quotes
        let result2 = parse(r#"text="It's a beautiful day""#).unwrap();
        assert_eq!(result2["text"], "It's a beautiful day");
    }

    #[test]
    fn test_single_quote_escape_sequences() {
        // Test escape sequences in single quoted strings
        let result = parse(r#"text='hello\nworld\t!'"#).unwrap();
        assert_eq!(result["text"], "hello\nworld\t!");

        // Test escaped single quote
        let result2 = parse(r#"text='It\'s great'"#).unwrap();
        assert_eq!(result2["text"], "It's great");

        // Test escaped double quote in single quoted string
        let result3 = parse(r#"text='Say \"hello\"'"#).unwrap();
        assert_eq!(result3["text"], r#"Say "hello""#);
    }

    #[test]
    fn test_single_quoted_arrays() {
        // Test arrays with single quoted strings
        let result = parse(r#"items=['apple', 'banana', 'cherry']"#).unwrap();
        assert_eq!(
            result,
            json!({
                "items": ["apple", "banana", "cherry"]
            })
        );

        // Test mixed quote styles in arrays
        let result2 = parse(r#"mixed=['a', "b", 'c']"#).unwrap();
        assert_eq!(result2, json!({"mixed": ["a", "b", "c"]}));
    }

    #[test]
    fn test_single_quoted_nested_objects() {
        // Test nested objects with single quotes
        let result = parse(r#"server={host='localhost', port=8080}"#).unwrap();
        assert_eq!(
            result,
            json!({
                "server": {
                    "host": "localhost",
                    "port": 8080.0
                }
            })
        );
    }

    #[test]
    fn test_empty_single_quoted_strings() {
        // Test empty single quoted strings
        let result = parse(r#"empty=''"#).unwrap();
        assert_eq!(result, json!({"empty": ""}));
    }

    #[test]
    fn test_single_quote_unicode_escape() {
        // Test Unicode escape in single quoted strings
        let result = parse(r#"text='Hello\u00A9World'"#).unwrap();
        assert_eq!(result["text"], "Hello©World");
    }

    #[test]
    fn test_quoted_keys_with_spaces() {
        // Test double quoted keys with spaces
        let result = parse(r#""my key"="value", "another key"="test""#).unwrap();
        assert_eq!(
            result,
            json!({
                "my key": "value",
                "another key": "test"
            })
        );

        // Test single quoted keys with spaces
        let result2 = parse(r#"'my key'='value', 'another key'='test'"#).unwrap();
        assert_eq!(
            result2,
            json!({
                "my key": "value",
                "another key": "test"
            })
        );
    }

    #[test]
    fn test_quoted_keys_with_special_characters() {
        // Test keys with various special characters
        let result = parse(r#""key:with:special"="value1", "key@symbol"="value2""#).unwrap();
        assert_eq!(
            result,
            json!({
                "key:with:special": "value1",
                "key@symbol": "value2"
            })
        );

        // Test keys with dots and slashes
        let result2 = parse(r#"'key.with.dots'='test', 'key/with/slash'='path'"#).unwrap();
        assert_eq!(
            result2,
            json!({
                "key.with.dots": "test",
                "key/with/slash": "path"
            })
        );
    }

    #[test]
    fn test_mixed_quoted_and_unquoted_keys() {
        // Test mixing quoted and unquoted keys
        let result = parse(r#"name='John', 'user id'=123, age=25, 'is-active'=true"#).unwrap();
        assert_eq!(
            result,
            json!({
                "name": "John",
                "user id": 123.0,
                "age": 25.0,
                "is-active": true
            })
        );
    }

    #[test]
    fn test_unquoted_keys_no_special_chars() {
        // Test that unquoted keys work without special characters
        let result = parse(r#"name="value" user_name="test" age=25"#).unwrap();
        assert_eq!(
            result,
            json!({
                "name": "value",
                "user_name": "test",
                "age": 25.0
            })
        );

        // Test unquoted keys with hyphens
        let result2 = parse(r#"my-key="value" another-key="test""#).unwrap();
        assert_eq!(
            result2,
            json!({
                "my-key": "value",
                "another-key": "test"
            })
        );
    }

    #[test]
    fn test_quoted_keys_escape_sequences() {
        // Test escape sequences in quoted keys
        let result = parse(r#""key\nwith\nnewlines"="value""#).unwrap();
        assert_eq!(result.get("key\nwith\nnewlines"), Some(&json!("value")));

        // Test quotes in quoted keys
        let result2 = parse(r#"'key\'s value'="test""#).unwrap();
        assert_eq!(result2.get("key's value"), Some(&json!("test")));
    }

    #[test]
    fn test_complex_quoted_keys() {
        // Test complex scenarios with quoted keys
        let result = parse(
            r#"
            "user name"="John Doe",
            email="john@example.com",
            'home address'="123 Main St",
            phone-number="555-1234"
        "#,
        )
        .unwrap();
        assert_eq!(result["user name"], "John Doe");
        assert_eq!(result["email"], "john@example.com");
        assert_eq!(result["home address"], "123 Main St");
        assert_eq!(result["phone-number"], "555-1234");
    }

    #[test]
    fn test_error_unterminated_string() {
        let result = parse(r#"name="unclosed string"#);
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("Unterminated string")
        );
    }

    #[test]
    fn test_error_expected_equals() {
        let result = parse(r#"name "value""#);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Expected '='"));
    }

    #[test]
    fn test_error_unterminated_raw_string() {
        let result = parse(r#"text=r"unterminated"#);
        assert!(result.is_err());
    }
}
