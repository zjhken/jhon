/**
 * Comprehensive unit tests for JHON parser and serializer
 * Matching test coverage from the Rust implementation
 */

import { describe, test, expect } from 'bun:test';
import { parse, serialize, serializePretty, JhonParseError, type JhonObject } from './index';

describe('parse', () => {
  test('empty input', () => {
    const result = parse('');
    expect(result).toEqual({});
  });

  test('basic key value', () => {
    const result = parse('a="hello", b=123.45');
    expect(result).toEqual({
      a: 'hello',
      b: 123.45,
    });
  });

  test('string types', () => {
    const result = parse('"quoted key"="value", unquoted_key="another"');
    expect(result).toEqual({
      'quoted key': 'value',
      unquoted_key: 'another',
    });
  });

  test('string values', () => {
    const result = parse('text="simple string", empty="", spaces="  with  spaces  "');
    expect(result).toEqual({
      text: 'simple string',
      empty: '',
      spaces: '  with  spaces  ',
    });
  });

  test('string escaping', () => {
    const result = parse(`
            newline="hello\\nworld",
            tab="tab\\there",
            backslash="path\\\\to\\\\file",
            quote="say \\"hello\\"",
            carriage_return="line1\\rline2"
        `);
    expect(result).toEqual({
      newline: 'hello\nworld',
      tab: 'tab\there',
      backslash: 'path\\to\\file',
      quote: 'say "hello"',
      carriage_return: 'line1\rline2',
    });
  });

  test('unicode escape', () => {
    const result = parse('unicode="Hello\\u00A9World", emoji="\\u2764\\ufe0f"');
    expect(result).toEqual({
      unicode: 'Hello©World',
      emoji: '❤️',
    });
  });

  test('numbers', () => {
    const result = parse('int=42, float=3.14, negative=-123, negative_float=-45.67');
    expect(result).toEqual({
      int: 42,
      float: 3.14,
      negative: -123,
      negative_float: -45.67,
    });
  });

  test('numbers with underscores', () => {
    const result = parse(
      'large=100_000, million=1_000_000, decimal=1_234.567_890, neg_large=-50_000, mixed=1_000_000.000_001'
    );
    expect(result).toEqual({
      large: 100_000,
      million: 1_000_000,
      decimal: 1_234.567_89,
      neg_large: -50_000,
      mixed: 1_000_000.000_001,
    });
  });

  test('booleans', () => {
    const result = parse('truth=true, falsehood=false');
    expect(result).toEqual({
      truth: true,
      falsehood: false,
    });
  });

  test('null value', () => {
    const result = parse('empty=null');
    expect(result).toEqual({ empty: null });
  });

  test('empty arrays', () => {
    const result = parse('empty=[]');
    expect(result).toEqual({ empty: [] });
  });

  test('arrays with strings', () => {
    const result = parse('strings=["hello", "world", "test"]');
    expect(result).toEqual({
      strings: ['hello', 'world', 'test'],
    });
  });

  test('arrays with numbers', () => {
    const result = parse('numbers=[1, 2.5, -3, 4.0]');
    expect(result).toEqual({
      numbers: [1, 2.5, -3, 4.0],
    });
  });

  test('arrays with mixed types', () => {
    const result = parse('mixed=["hello", 123, true, null, 45.6]');
    expect(result).toEqual({
      mixed: ['hello', 123, true, null, 45.6],
    });
  });

  test('arrays with whitespace', () => {
    const result = parse('arr=["a",1,true,null]');
    expect(result).toEqual({
      arr: ['a', 1, true, null],
    });
  });

  test('multiline', () => {
    const result = parse(`
            name = "test",
            age = 25,
            active = true,
            tags = ["tag1", "tag2"],
            score = 98.5
        `);
    expect(result).toEqual({
      name: 'test',
      age: 25,
      active: true,
      tags: ['tag1', 'tag2'],
      score: 98.5,
    });
  });

  test('single line comments', () => {
    const result = parse(`
            // This is a comment
            name = "test"  // inline comment
            age = 25
            // Another comment
            active = true
        `);
    expect(result).toEqual({
      name: 'test',
      age: 25,
      active: true,
    });
  });

  test('multiline comments', () => {
    const result = parse(`
            /* This is a
               multiline comment */
            name = "test"
            /* Another comment */
            age = 25
        `);
    expect(result).toEqual({
      name: 'test',
      age: 25,
    });
  });

  test('inline multiline comments', () => {
    const result = parse('name="test"/* inline comment */,age=25');
    expect(result).toEqual({
      name: 'test',
      age: 25,
    });
  });

  test('trailing commas', () => {
    const result = parse('name="test", age=25, ');
    expect(result).toEqual({
      name: 'test',
      age: 25,
    });

    const result2 = parse('name="only", ');
    expect(result2).toEqual({ name: 'only' });
  });

  test('array trailing commas', () => {
    const result = parse('items=["apple", "banana", "cherry", ]');
    expect(result).toEqual({
      items: ['apple', 'banana', 'cherry'],
    });
  });

  test('special characters in strings', () => {
    const result = parse('text="Hello, World! @#$%^&*()_+-={}[]|\\\\:;\\"\'<>?,./"');
    expect(result).toEqual({
      text: 'Hello, World! @#$%^&*()_+-={}[]|\\:;"\'<>?,./',
    });
  });

  test('key with underscores and numbers', () => {
    const result = parse(
      'key_1="value1", key_2_test="value2", _private="secret", key123="numbered"'
    );
    expect(result).toEqual({
      key_1: 'value1',
      key_2_test: 'value2',
      _private: 'secret',
      key123: 'numbered',
    });
  });

  test('complex example', () => {
    const jhonInput = `
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
        `;

    const result = parse(jhonInput);
    expect(result.app_name).toBe('ocean-note');
    expect(result.version).toBe('1.0.0');
    expect(result.features).toEqual(['markdown', 'collaboration', 'real-time']);
    expect(result.max_file_size).toBe(1048576);
    expect(result.timeout).toBe(30.5);
    expect(result.debug).toBe(true);
    expect(result.log_level).toBe('info');
  });

  test('nested objects', () => {
    const result = parse('server={host="localhost",port=8080}');
    expect(result).toEqual({
      server: {
        host: 'localhost',
        port: 8080,
      },
    });

    const result2 = parse('config={name="test",value=123}');
    expect(result2).toEqual({
      config: {
        name: 'test',
        value: 123,
      },
    });

    const result3 = parse('data={items=[1,2,3],active=true}');
    expect(result3).toEqual({
      data: {
        items: [1, 2, 3],
        active: true,
      },
    });

    const result4 = parse('outer={inner={deep="value"},number=42}');
    expect(result4).toEqual({
      outer: {
        inner: {
          deep: 'value',
        },
        number: 42,
      },
    });
  });

  test('raw strings', () => {
    const result = parse('path=r"C:\\Windows\\System32"');
    expect(result).toEqual({
      path: 'C:\\Windows\\System32',
    });

    const result2 = parse('quote=r#"He said "hello" to me"#');
    expect(result2.quote).toBe('He said "hello" to me');

    const result3 = parse('regex=r"\\d+\\w*\\s*"');
    expect(result3.regex).toBe('\\d+\\w*\\s*');

    const result4 = parse('empty=r""');
    expect(result4).toEqual({ empty: '' });

    const result5 = parse('uppercase=R"C:\\Program Files\\"');
    expect(result5.uppercase).toBe('C:\\Program Files\\');
  });

  test('raw strings with hashes', () => {
    const result = parse('contains_hash=r#"This has a " quote in it"#');
    expect(result.contains_hash).toBe('This has a " quote in it');

    const result2 = parse('double_hash=r##"This has "quotes" and # hashes"##');
    expect(result2.double_hash).toBe('This has "quotes" and # hashes');
  });

  test('comma and newline separators in objects', () => {
    // Comma-separated
    const result = parse('a="hello",b="world"');
    expect(result).toEqual({
      a: 'hello',
      b: 'world',
    });

    // Newline-separated
    const result2 = parse('name="test"\nage=25');
    expect(result2).toEqual({
      name: 'test',
      age: 25,
    });

    // Mixed commas and newlines
    const result3 = parse('a=1,b=2\nc=3');
    expect(result3).toEqual({
      a: 1,
      b: 2,
      c: 3,
    });
  });

  test('comma and newline separators in arrays', () => {
    // Comma-separated
    const result = parse('arr=[1,2,3]');
    expect(result).toEqual({ arr: [1, 2, 3] });

    // Newline-separated
    const result2 = parse('items=[\n"a"\n"b"\n"c"]');
    expect(result2).toEqual({ items: ['a', 'b', 'c'] });

    // Mixed
    const result3 = parse('nums=[1,2\n3]');
    expect(result3).toEqual({ nums: [1, 2, 3] });
  });

  test('space-only separators are rejected', () => {
    // Objects with space separators should fail
    expect(() => parse('a="hello" b="world"')).toThrow('Expected comma or newline between properties');
    expect(() => parse('obj={a=1 b=2}')).toThrow('Expected comma or newline between object properties');

    // Arrays with space separators should fail
    expect(() => parse('arr=[1 2 3]')).toThrow('Expected comma or newline between array elements');
  });

  test('single quoted strings', () => {
    const result = parse("name='John', greeting='Hello'");
    expect(result).toEqual({
      name: 'John',
      greeting: 'Hello',
    });
  });

  test('mixed quote styles', () => {
    const result = parse('double="value1", single=\'value2\'');
    expect(result).toEqual({
      double: 'value1',
      single: 'value2',
    });
  });

  test('single quoted keys', () => {
    const result = parse('my-key=\'value\', another-key=\'test\'');
    expect(result).toEqual({
      'my-key': 'value',
      'another-key': 'test',
    });
  });

  test('quotes inside strings', () => {
    const result = parse('text=\'He said "hello" to me\'');
    expect(result.text).toBe('He said "hello" to me');

    const result2 = parse('text="It\'s a beautiful day"');
    expect(result2.text).toBe("It's a beautiful day");
  });

  test('single quote escape sequences', () => {
    const result = parse('text=\'hello\\nworld\\t!\'');
    expect(result.text).toBe('hello\nworld\t!');

    const result2 = parse('text=\'It\\\'s great\'');
    expect(result2.text).toBe("It's great");

    const result3 = parse('text=\'Say \\"hello\\"\'');
    expect(result3.text).toBe('Say "hello"');
  });

  test('single quoted arrays', () => {
    const result = parse('items=[\'apple\', \'banana\', \'cherry\']');
    expect(result).toEqual({
      items: ['apple', 'banana', 'cherry'],
    });

    const result2 = parse('mixed=[\'a\', "b", \'c\']');
    expect(result2).toEqual({ mixed: ['a', 'b', 'c'] });
  });

  test('single quoted nested objects', () => {
    const result = parse('server={host=\'localhost\', port=8080}');
    expect(result).toEqual({
      server: {
        host: 'localhost',
        port: 8080,
      },
    });
  });

  test('empty single quoted strings', () => {
    const result = parse('empty=\'\'');
    expect(result).toEqual({ empty: '' });
  });

  test('single quote unicode escape', () => {
    const result = parse('text=\'Hello\\u00A9World\'');
    expect(result.text).toBe('Hello©World');
  });

  test('quoted keys with spaces', () => {
    const result = parse('"my key"="value", "another key"="test"');
    expect(result).toEqual({
      'my key': 'value',
      'another key': 'test',
    });

    const result2 = parse('\'my key\'=\'value\', \'another key\'=\'test\'');
    expect(result2).toEqual({
      'my key': 'value',
      'another key': 'test',
    });
  });

  test('quoted keys with special characters', () => {
    const result = parse('"key:with:special"="value1", "key@symbol"="value2"');
    expect(result).toEqual({
      'key:with:special': 'value1',
      'key@symbol': 'value2',
    });

    const result2 = parse('\'key.with.dots\'=\'test\', \'key/with/slash\'=\'path\'');
    expect(result2).toEqual({
      'key.with.dots': 'test',
      'key/with/slash': 'path',
    });
  });

  test('mixed quoted and unquoted keys', () => {
    const result = parse('name=\'John\', \'user id\'=123, age=25, \'is-active\'=true');
    expect(result).toEqual({
      name: 'John',
      'user id': 123,
      age: 25,
      'is-active': true,
    });
  });

  test('unquoted keys no special chars', () => {
    const result = parse('name="value"\nuser_name="test"\nage=25');
    expect(result).toEqual({
      name: 'value',
      user_name: 'test',
      age: 25,
    });

    const result2 = parse('my-key="value",another-key="test"');
    expect(result2).toEqual({
      'my-key': 'value',
      'another-key': 'test',
    });
  });

  test('quoted keys escape sequences', () => {
    const result = parse('"key\\nwith\\nnewlines"="value"');
    expect(result['key\nwith\nnewlines']).toBe('value');

    const result2 = parse('\'key\\\'s value\'="test"');
    expect(result2["key's value"]).toBe('test');
  });

  test('complex quoted keys', () => {
    const result = parse(`
            "user name"="John Doe",
            email="john@example.com",
            'home address'="123 Main St",
            phone-number="555-1234"
        `);
    expect(result['user name']).toBe('John Doe');
    expect(result.email).toBe('john@example.com');
    expect(result['home address']).toBe('123 Main St');
    expect(result['phone-number']).toBe('555-1234');
  });

  test('error unterminated string', () => {
    expect(() => parse('name="unclosed string')).toThrow(JhonParseError);
    expect(() => parse('name="unclosed string')).toThrow('Unterminated string');
  });

  test('error expected equals', () => {
    expect(() => parse('name "value"')).toThrow(JhonParseError);
    expect(() => parse('name "value"')).toThrow("Expected '='");
  });

  test('error unterminated raw string', () => {
    expect(() => parse('text=r"unterminated')).toThrow(JhonParseError);
  });
});

describe('serialize', () => {
  test('basic object', () => {
    const value = { name: 'John', age: 30 };
    const result = serialize(value);
    expect(result).toBe('age=30,name="John"');
  });

  test('empty object', () => {
    const value = {};
    const result = serialize(value);
    expect(result).toBe('');
  });

  test('string', () => {
    const value = 'hello world';
    const result = serialize(value);
    expect(result).toBe('"hello world"');
  });

  test('string with escapes', () => {
    const value = 'line1\nline2\ttab';
    const result = serialize(value);
    expect(result).toBe('"line1\\nline2\\ttab"');
  });

  test('string with quotes', () => {
    const value = 'He said "hello"';
    const result = serialize(value);
    expect(result).toBe('"He said \\"hello\\""');
  });

  test('numbers', () => {
    const value = { int: 42, float: 3.14, negative: -123 };
    const result = serialize(value);
    expect(result).toBe('float=3.14,int=42,negative=-123');
  });

  test('boolean', () => {
    const value = { active: true, inactive: false };
    const result = serialize(value);
    expect(result).toBe('active=true,inactive=false');
  });

  test('null', () => {
    const value = { empty: null };
    const result = serialize(value);
    expect(result).toBe('empty=null');
  });

  test('array', () => {
    const value = [1, 2, 3, 'hello', true];
    const result = serialize(value);
    expect(result).toBe('[1,2,3,"hello",true]');
  });

  test('empty array', () => {
    const value: any[] = [];
    const result = serialize(value);
    expect(result).toBe('[]');
  });

  test('nested object', () => {
    const value = {
      server: { host: 'localhost', port: 8080 },
    };
    const result = serialize(value);
    expect(result).toBe('server={host="localhost",port=8080}');
  });

  test('array with objects', () => {
    const value = [
      { name: 'John', age: 30 },
      { name: 'Jane', age: 25 },
    ];
    const result = serialize(value);
    expect(result).toBe('[{age=30,name="John"},{age=25,name="Jane"}]');
  });

  test('keys with special chars', () => {
    const value = { 'my key': 'value1', 'key@symbol': 'value2' };
    const result = serialize(value);
    expect(result).toBe('"key@symbol"="value2","my key"="value1"');
  });

  test('keys with hyphens', () => {
    const value = { 'my-key': 'value', another_key: 'test' };
    const result = serialize(value);
    expect(result).toBe('another_key="test",my-key="value"');
  });

  test('round trip simple', () => {
    const original = { name: 'John', age: 30, active: true };
    const serialized = serialize(original);
    const parsed = parse(serialized);
    expect(parsed).toEqual(original);
  });

  test('round trip array', () => {
    const value = [1, 2, 3, 'test', true, null];
    const serialized = serialize(value);
    expect(serialized).toBe('[1,2,3,"test",true,null]');
  });

  test('complex nested structure', () => {
    const original = {
      app_name: 'ocean-note',
      version: '2.0.0',
      database: {
        host: 'localhost',
        port: 5432,
        name: 'mydb',
        credentials: [
          { user: 'admin', role: 'owner' },
          { user: 'reader', role: 'readonly' },
          { user: 'writer', role: 'readwrite' },
        ],
        pool_size: 10,
        timeout: 30.5,
        ssl_enabled: true,
        ssl_cert: null,
      },
      server: {
        host: '0.0.0.0',
        port: 3000,
        middleware: [
          { name: 'logger', enabled: true, config: { level: 'info' } },
          { name: 'cors', enabled: false, config: {} },
          { name: 'auth', enabled: true, config: { strategy: 'jwt' } },
        ],
      },
      features: [
        { name: 'markdown', active: true, settings: { preview: true } },
        { name: 'collaboration', active: true, settings: { realtime: true, max_users: 100 } },
        { name: 'export', active: false, settings: null },
      ],
      metadata: {
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-20T15:45:30Z',
        tags: ['production', 'web', 'api'],
        maintainers: ['team-a', 'team-b'],
      },
      limits: {
        max_file_size: 1048576,
        max_files_per_user: 100,
        storage_quota: 1073741824,
        rate_limits: {
          requests_per_minute: 60,
          burst_allowed: true,
        },
      },
      debug_mode: false,
      log_level: 'info',
      description: 'A complex configuration with deeply nested objects, arrays of objects, mixed data types, and special characters\nin\tstrings',
    };

    const serialized = serialize(original);
    const parsed = parse(serialized);
    expect(parsed).toEqual(original);
  });

  test('mixed types in array', () => {
    const value = [null, true, 42, 'hello', 3.14, [1, 2], { key: 'value' }];
    const serialized = serialize(value);
    expect(serialized).toBe('[null,true,42,"hello",3.14,[1,2],{key="value"}]');
  });

  test('empty and nested empty', () => {
    const value = {
      empty_obj: {},
      empty_array: [],
      nested: {
        also_empty: {},
        with_array: [],
      },
    };
    const serialized = serialize(value);
    const parsed = parse(serialized);
    expect(parsed).toEqual(value);
  });

  test('unicode in string', () => {
    const value = { text: 'Hello©World❤️' };
    const serialized = serialize(value);
    const parsed = parse(serialized);
    expect(parsed).toEqual(value);
  });

  test('backslash paths', () => {
    const value = { windows_path: 'C:\\Users\\name\\file.txt' };
    const serialized = serialize(value);
    const parsed = parse(serialized);
    expect(parsed).toEqual(value);
  });
});

describe('serializePretty', () => {
  test('basic object', () => {
    const value = { name: 'John', age: 30 };
    const result = serializePretty(value);
    expect(result).toBe('age = 30,\nname = "John"');
  });

  test('empty object', () => {
    const value = {};
    const result = serializePretty(value);
    expect(result).toBe('');
  });

  test('nested objects', () => {
    const value = {
      server: { host: 'localhost', port: 8080 },
    };
    const result = serializePretty(value);
    expect(result).toBe('server = {\n  host = "localhost",\n  port = 8080\n}');
  });

  test('array', () => {
    const value = [1, 2, 3, 'hello'];
    const result = serializePretty(value);
    expect(result).toBe('[\n  1,\n  2,\n  3,\n  "hello"\n]');
  });

  test('empty array', () => {
    const value: any[] = [];
    const result = serializePretty(value);
    expect(result).toBe('[]');
  });

  test('array with objects', () => {
    const value = [
      { name: 'John', age: 30 },
      { name: 'Jane', age: 25 },
    ];
    const result = serializePretty(value);
    expect(result).toBe('[\n  {\n    age = 30,\n    name = "John"\n  },\n  {\n    age = 25,\n    name = "Jane"\n  }\n]');
  });

  test('deeply nested', () => {
    const value = {
      database: {
        credentials: [
          { user: 'admin', role: 'owner' },
          { user: 'reader', role: 'readonly' },
        ],
      },
    };
    const result = serializePretty(value);
    expect(result).toBe(
      'database = {\n  credentials = [\n    {\n      role = "owner",\n      user = "admin"\n    },\n    {\n      role = "readonly",\n      user = "reader"\n    }\n  ]\n}'
    );
  });

  test('tabs', () => {
    const value = { name: 'John', age: 30 };
    const result = serializePretty(value, { indent: '\t' });
    expect(result).toBe('age = 30,\nname = "John"');
  });

  test('four spaces', () => {
    const value = { name: 'John', age: 30 };
    const result = serializePretty(value, { indent: '    ' });
    expect(result).toBe('age = 30,\nname = "John"');
  });

  test('mixed content', () => {
    const value = {
      string: 'hello',
      number: 42,
      boolean: true,
      null_value: null,
      array: [1, 2, 3],
      nested: { key: 'value' },
    };
    const result = serializePretty(value);
    expect(result).toBe(
      'array = [\n  1,\n  2,\n  3\n],\nboolean = true,\nnested = {\n  key = "value"\n},\nnull_value = null,\nnumber = 42,\nstring = "hello"'
    );
  });

  test('round trip', () => {
    const original = {
      name: 'John',
      age: 30,
      active: true,
      tags: ['developer', 'rust'],
    };
    const serialized = serializePretty(original);
    const parsed = parse(serialized);
    expect(parsed).toEqual(original);
  });

  test('special keys', () => {
    const value = { 'my key': 'value1', 'key@symbol': 'value2' };
    const result = serializePretty(value);
    expect(result).toBe('"key@symbol" = "value2",\n"my key" = "value1"');
  });

  test('empty indent', () => {
    const value = { name: 'John', age: 30 };
    const result = serializePretty(value, { indent: '' });
    expect(result).toBe('age = 30,\nname = "John"');
  });

  test('large config', () => {
    const value = {
      app: {
        name: 'test-app',
        version: '1.0.0',
        features: ['auth', 'logging', 'api'],
        settings: {
          debug: true,
          port: 3000,
          hosts: ['localhost', '0.0.0.0'],
        },
      },
    };
    const result = serializePretty(value);
    const expected =
      'app = {\n  features = [\n    "auth",\n    "logging",\n    "api"\n  ],\n  name = "test-app",\n  settings = {\n    debug = true,\n    hosts = [\n      "localhost",\n      "0.0.0.0"\n    ],\n    port = 3000\n  },\n  version = "1.0.0"\n}';
    expect(result).toBe(expected);

    // Verify round-trip works
    const parsed = parse(result);
    expect(parsed).toEqual(value);
  });
});

describe('edge cases and complex scenarios', () => {
  test('very deep nesting', () => {
    const value = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: { deep: 'value' },
            },
          },
        },
      },
    };
    const serialized = serialize(value);
    const parsed = parse(serialized);
    expect(parsed).toEqual(value);
  });

  test('large array of objects', () => {
    const value = {
      items: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `item${i}`,
        active: i % 2 === 0,
      })),
    };
    const serialized = serialize(value);
    const parsed = parse(serialized);
    expect(parsed).toEqual(value);
  });

  test('special unicode characters', () => {
    const value = {
      emoji: '😀🎉🚀',
      chinese: '你好世界',
      arabic: 'مرحبا',
      russian: 'Привет',
      symbols: '©®™€£¥§¶',
    };
    const serialized = serialize(value);
    const parsed = parse(serialized);
    expect(parsed).toEqual(value);
  });

  test('numbers with different formats', () => {
    const value = {
      zero: 0,
      negative_zero: -0,
      very_large: 9007199254740991,
      very_small: 0.0001,
      scientific: 1.23e-4,
    };
    const serialized = serialize(value);
    const parsed = parse(serialized);
    // Note: -0 becomes 0 after round-trip due to JavaScript behavior
    // In JS, -0 === 0 is true
    expect(parsed.zero).toBe(0);
    expect(parsed.negative_zero).toBe(0); // -0 normalizes to 0
    expect(parsed.very_large).toBe(value.very_large);
    expect(parsed.very_small).toBe(value.very_small);
    expect(parsed.scientific).toBe(0.000123); // 1.23e-4 = 0.000123
  });

  test('mixed array nesting', () => {
    const value = {
      mixed: [
        1,
        'string',
        true,
        null,
        { nested: 'object' },
        [1, 2, 3],
        [{ deep: 'nesting' }],
      ],
    };
    const serialized = serialize(value);
    const parsed = parse(serialized);
    expect(parsed).toEqual(value);
  });

  test('empty values handling', () => {
    const value = {
      empty_string: '',
      empty_array: [],
      empty_object: {},
      null_value: null,
    };
    const serialized = serialize(value);
    const parsed = parse(serialized);
    expect(parsed).toEqual(value);
  });

  test('keys with all valid unquoted characters', () => {
    const value = {
      abc: 'letters',
      ABC: 'uppercase',
      '123': 'numbers',
      _: 'underscore',
      a_b_c: 'mixed',
      'a-b-c': 'hyphens',
      aBc_123: 'complex',
    };
    const serialized = serialize(value);
    const parsed = parse(serialized);
    expect(parsed).toEqual(value);
  });

  test('whitespace in values', () => {
    const value = {
      spaces: '   spaces   ',
      tabs: '\t\ttabs\t\t',
      newlines: 'line1\nline2\nline3',
      mixed: '  \t\nmixed whitespace\t\n  ',
    };
    const serialized = serialize(value);
    const parsed = parse(serialized);
    expect(parsed).toEqual(value);
  });

  test('boolean and null in different contexts', () => {
    const value = {
      bool_array: [true, false, true],
      null_array: [null, null, null],
      nested: {
        bool: true,
        nil: null,
        arr: [false, null, true],
      },
    };
    const serialized = serialize(value);
    const parsed = parse(serialized);
    expect(parsed).toEqual(value);
  });

  test('serialize with sortKeys: false', () => {
    const value = { z: 1, a: 2, m: 3 };
    const serialized = serialize(value, { sortKeys: false });
    expect(serialized).toBe('z=1,a=2,m=3');
  });
});
