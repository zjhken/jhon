# JHON - JinHui's Object Notation

A lightweight configuration language parser and serializer for TypeScript/JavaScript. JHON provides a clean, readable syntax for configuration files while maintaining full compatibility with JSON data structures.

## Features

- **Clean Syntax**: Simple `key=value` format that's easy to read and write
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Comments**: Support for both `//` single-line and `/* */` multi-line comments
- **String Flexibility**: Single quotes, double quotes, and raw strings (r"...")
- **Nested Structures**: Full support for objects and arrays with nesting
- **Serialization**: Convert objects to compact or pretty-printed JHON format
- **Round-Trip Safe**: Parse and serialize without losing data
- **Zero Dependencies**: Lightweight implementation with no external dependencies

## Installation

```bash
bun add jhon
# or
npm install jhon
# or
yarn add jhon
# or
pnpm add jhon
```

## Quick Start

```typescript
import { parse, serialize, serializePretty } from 'jhon';

// Parse JHON config
const config = parse(`
  // Server configuration
  name = "my-app"
  port = 3000
  debug = true

  // Database settings
  database = {
    host = "localhost"
    port = 5432
    name = "mydb"
  }

  // Feature flags
  features = ["auth", "api", "logging"]
`);

console.log(config);
// {
//   name: 'my-app',
//   port: 3000,
//   debug: true,
//   database: { host: 'localhost', port: 5432, name: 'mydb' },
//   features: [ 'auth', 'api', 'logging' ]
// }

// Serialize to compact JHON
const compact = serialize(config);
// "database={host="localhost",name="mydb",port=5432},debug=true,features=[auth,api,logging],name=my-app,port=3000"

// Serialize with pretty formatting
const pretty = serializePretty(config, { indent: '  ' });
```

## Syntax Guide

### Basic Key-Value Pairs

```typescript
// Simple values
parse('name="John"');
// { name: 'John' }

parse('age=30');
// { age: 30 }

parse('active=true');
// { active: true }

parse('data=null');
// { data: null }
```

### Data Types

- **Strings**: Double-quoted (`"hello"`), single-quoted (`'world'`), or raw strings (`r"C:\path"`)
- **Numbers**: Integers (`42`) and floats (`3.14`)
- **Booleans**: `true` or `false`
- **Null**: `null`
- **Arrays**: `[1, 2, 3]` or `["a", "b", "c"]`
- **Objects**: Nested with braces `{key=value, another=value}`

### Keys

```typescript
// Unquoted keys (alphanumeric, underscore, hyphen)
parse('name="value" user_name="test" my-key="data"');
// { name: 'value', user_name: 'test', 'my-key': 'data' }

// Quoted keys (any characters)
parse('"my key"="value" "key@symbol"="data"');
// { 'my key': 'value', 'key@symbol': 'data' }

// Single-quoted keys
parse('\'my-key\'="value"');
// { 'my-key': 'value' }
```

### Escape Sequences

```typescript
parse('text="hello\\nworld\\t!"');
// { text: 'hello\nworld\t!' }

parse('unicode="Hello\\u00A9World"');
// { unicode: 'Hello©World' }

parse('quote="say \\"hello\\""');
// { quote: 'say "hello"' }
```

### Raw Strings

Raw strings (inspired by Rust) don't process escape sequences:

```typescript
parse('path=r"C:\\Windows\\System32"');
// { path: 'C:\\Windows\\System32' }

parse('regex=r"\\d+\\w*"');
// { regex: '\\d+\\w*' }

// For strings with quotes, use hash marks
parse('text=r#"He said "hello""#');
// { text: 'He said "hello"' }
```

### Comments

```typescript
parse(`
  // Single-line comment
  name="test"

  /* Multi-line
     comment */
  age=25

  key="value"  // Inline comment
`);
```

### Arrays

```typescript
// Array elements separated by commas or newlines
parse('items=[1, 2, 3]');
parse('items=[1 2 3]');

// Mixed types
parse('mixed=["hello", 42, true, null]');

// Arrays of objects
parse('users=[{name="John" age=30} {name="Jane" age=25}]');
```

### Nested Objects

```typescript
parse('config={name="test" value=123}');
// { config: { name: 'test', value: 123 } }

parse('server={host="localhost" port=8080}');
// { server: { host: 'localhost', port: 8080 } }

// Deep nesting
parse('outer={inner={deep="value"} number=42}');
// { outer: { inner: { deep: 'value' }, number: 42 } }
```

## API Reference

### `parse(input: string, options?: ParseOptions): JhonObject`

Parse a JHON string into a JavaScript object.

**Options:**
- `allowTrailingCommas?: boolean` - Allow trailing commas (default: `true`)

**Throws:**
- `JhonParseError` - When the input contains invalid syntax

```typescript
import { parse, JhonParseError } from 'jhon';

try {
  const config = parse('name="test"');
} catch (error) {
  if (error instanceof JhonParseError) {
    console.error('Parse error:', error.message, 'at position', error.position);
  }
}
```

### `serialize(value: JhonValue, options?: SerializeOptions): string`

Serialize a JavaScript value to compact JHON format.

**Options:**
- `sortKeys?: boolean` - Sort object keys alphabetically (default: `true`)

```typescript
serialize({ name: 'John', age: 30 });
// "age=30,name=John"

serialize({ name: 'John', age: 30 }, { sortKeys: false });
// "name=John,age=30"
```

### `serializePretty(value: JhonValue, options?: SerializePrettyOptions): string`

Serialize a JavaScript value to pretty-printed JHON format.

**Options:**
- `sortKeys?: boolean` - Sort object keys alphabetically (default: `true`)
- `indent?: string` - Indentation string (default: `"  "`)

```typescript
const config = {
  app: { name: 'test', port: 3000 },
  features: ['auth', 'api']
};

console.log(serializePretty(config, { indent: '  ' }));
```

Output:
```
app = {
  name = test,
  port = 3000
},
features = [
  auth,
  api
]
```

### `JhonParseError`

Error class thrown when parsing fails.

```typescript
class JhonParseError extends Error {
  message: string;
  position?: number;
}
```

## Type Definitions

```typescript
type JhonValue =
  | string
  | number
  | boolean
  | null
  | JhonObject
  | JhonArray;

interface JhonObject {
  [key: string]: JhonValue;
}

type JhonArray = JhonValue[];
```

## Examples

### Configuration File Example

```typescript
// config.jhon
import { readFileSync } from 'fs';
import { parse } from 'jhon';

const configContent = readFileSync('config.jhon', 'utf-8');
const config = parse(configContent);

console.log(config);
```

### Round-Trip Conversion

```typescript
import { parse, serialize } from 'jhon';

const original = {
  name: 'my-app',
  version: '1.0.0',
  features: ['auth', 'logging'],
  database: {
    host: 'localhost',
    port: 5432,
  },
};

// Serialize and parse back
const jhonString = serialize(original);
const parsed = parse(jhonString);

console.log(parsed); // Same as original
```

### Dynamic Configuration

```typescript
import { serializePretty } from 'jhon';

function buildConfig(options: {
  name: string;
  port: number;
  debug: boolean;
}) {
  return serializePretty({
    app: {
      name: options.name,
      port: options.port,
      debug: options.debug,
    },
    timestamp: new Date().toISOString(),
  });
}

console.log(buildConfig({ name: 'my-app', port: 3000, debug: true }));
```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build
bun run build

# Watch mode
bun run test:watch
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
