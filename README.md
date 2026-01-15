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

### `parse(jhonString: string): object`

Parses a JHON string and returns the corresponding JavaScript object.

```javascript
const result = parse('name="John" age=30');
// { name: "John", age: 30 }
```

### `stringify(value: object, options?: StringifyOptions): string`

Converts a JavaScript object to a JHON string.

```javascript
const jhon = stringify({ name: "John", age: 30 }, { pretty: true });
```

Options:
- `pretty`: Enable pretty-printing (default: `false`)
- `indent`: Indentation string (default: `"  "`)

### `format(jhonString: string, options?: FormatOptions): string`

Formats an existing JHON string.

```javascript
const formatted = format(rawJhon, {
  indent: "  ",
  sortKeys: true,
  alignEquals: true
});
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
