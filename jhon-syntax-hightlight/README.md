# JHON Syntax Highlight

> JHON === **JinHui's Object Notation** - A flexible configuration format

## Overview

JHON is a JSON-like configuration format with flexible syntax and enhanced readability. This VSCode extension provides syntax highlighting support for JHON files (`.jhon`).

## Features

- ✅ Full syntax highlighting for JHON files
- ✅ Support for single-line (`//`) and multi-line (`/* */`) comments
- ✅ Flexible separators (spaces, tabs, newlines, commas)
- ✅ Support for nested objects and arrays
- ✅ String literals (including raw strings with `r"..."` syntax)
- ✅ All JSON data types: strings, numbers, booleans, null
- ✅ Escape sequences and Unicode support

## JHON Syntax Example

```jhon
// Application configuration
app_name="ocean-note"
version="1.0.0"

// Feature flags
features=["markdown" "collaboration" "real-time"]

// Database configuration
database={
  host="localhost"
  port=5432
  name="mydb"
  credentials=[
    {user="admin" role="owner"}
    {user="reader" role="readonly"}
  ]
}

// Numeric settings
max_file_size=1048576	timeout=30.5

debug=true
log_level="info"
```

## Key Features of JHON

1. **Flexible Separators**: Use spaces, tabs, newlines, or commas to separate properties
2. **Optional Quotes**: Keys can be quoted or unquoted
3. **Comments**: Both single-line and multi-line comments supported
4. **Nested Structures**: Support for objects and arrays with unlimited nesting depth
5. **Raw Strings**: Use Rust-style `r"..."` syntax for strings without escape sequences
   - `r"text"` - basic raw string
   - `r#"text with "quotes" "#` - raw string with quotes
   - `r##"text with ## hashes"##` - add more `#` as needed
6. **JSON-compatible**: Can be converted to/from JSON

## Raw String Examples

```jhon
// Simple raw string
simple=r"Hello, World!"

// Raw string containing quotes
with_quotes=r#"He said "Hello" to me"#

// Multi-line raw string
multiline=r#"This is a
multi-line
string without escaping"#

// Raw string with special characters
path=r"C:\Users\name\file.txt"
regex=r#\d+\w+\s+#
```

## Installation

### From VSCode Marketplace

Search for "JHON Language Support" in the VSCode extensions panel.

### Manual Installation

1. Download the latest `.vsix` file from the [Releases](https://github.com/zjhken/jhon-syntax-highlight/releases) page
2. Open VSCode
3. Go to Extensions → Click the "..." menu → Install from VSIX...
4. Select the downloaded file

## Usage

Create a file with the `.jhon` extension and start writing JHON configuration. The extension will automatically provide syntax highlighting.

## File Association

The extension automatically associates `.jhon` files with the JHON language.

## License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

This means:
- ✅ Free to use, modify, and distribute
- ✅ All modifications must also be open source under GPL-3.0
- ❌ Cannot be used in proprietary/closed-source software
- ❌ Cannot be sublicensed with different terms

See the [LICENSE](LICENSE) file for the full text.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you find any bugs or have feature requests, please open an issue on [GitHub Issues](https://github.com/zjhken/jhon-syntax-highlight/issues).

## Author

**Jinhui ZHANG** - [GitHub](https://github.com/zjhken)

## Acknowledgments

- VSCode Extension API
- TextMate grammar system
