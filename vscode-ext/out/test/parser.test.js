"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const parser_1 = require("../parser");
(0, bun_test_1.describe)('JhonParser', () => {
    const parser = new parser_1.JhonParser();
    (0, bun_test_1.describe)('Basic Key-Value Pairs', () => {
        (0, bun_test_1.it)('should parse single key-value pair', () => {
            const result = parser.parse('name="John"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    name: { type: 'string', value: 'John' }
                }
            });
        });
        (0, bun_test_1.it)('should parse multiple key-value pairs with commas', () => {
            const result = parser.parse('name="John", age=30');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    name: { type: 'string', value: 'John' },
                    age: { type: 'number', value: 30 }
                }
            });
        });
        (0, bun_test_1.it)('should parse multiple key-value pairs with newlines', () => {
            const result = parser.parse('name="John"\nage=30');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    name: { type: 'string', value: 'John' },
                    age: { type: 'number', value: 30 }
                }
            });
        });
        (0, bun_test_1.it)('should parse key with hyphens', () => {
            const result = parser.parse('my-key="value"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    'my-key': { type: 'string', value: 'value' }
                }
            });
        });
        (0, bun_test_1.it)('should parse key with underscores', () => {
            const result = parser.parse('my_key="value"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    my_key: { type: 'string', value: 'value' }
                }
            });
        });
    });
    (0, bun_test_1.describe)('String Values', () => {
        (0, bun_test_1.it)('should parse double-quoted string', () => {
            const result = parser.parse('text="hello"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    text: { type: 'string', value: 'hello' }
                }
            });
        });
        (0, bun_test_1.it)('should parse single-quoted string', () => {
            const result = parser.parse("text='world'");
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    text: { type: 'string', value: 'world' }
                }
            });
        });
        (0, bun_test_1.it)('should parse string with escape sequences', () => {
            const result = parser.parse('text="hello\\nworld\\t!"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    text: { type: 'string', value: 'hello\nworld\t!' }
                }
            });
        });
        (0, bun_test_1.it)('should parse raw string', () => {
            const result = parser.parse('path=r"C:\\Windows\\System32"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    path: { type: 'string', value: 'C:\\Windows\\System32', raw: 'r"C:\\Windows\\System32"' }
                }
            });
        });
        (0, bun_test_1.it)('should parse raw string with uppercase R', () => {
            const result = parser.parse('path=R"C:\\Windows\\System32"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    path: { type: 'string', value: 'C:\\Windows\\System32', raw: 'R"C:\\Windows\\System32"' }
                }
            });
        });
        (0, bun_test_1.it)('should parse raw string with hashes', () => {
            const result = parser.parse('text=r#"has "quotes" inside"#');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    text: { type: 'string', value: 'has "quotes" inside', raw: 'r#"has "quotes" inside"#' }
                }
            });
        });
        (0, bun_test_1.it)('should parse empty string', () => {
            const result = parser.parse('empty=""');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    empty: { type: 'string', value: '' }
                }
            });
        });
    });
    (0, bun_test_1.describe)('Key Types', () => {
        (0, bun_test_1.it)('should parse double-quoted key', () => {
            const result = parser.parse('"my key"="value"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    'my key': { type: 'string', value: 'value' }
                }
            });
        });
        (0, bun_test_1.it)('should parse single-quoted key', () => {
            const result = parser.parse("'my key'='value'");
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    'my key': { type: 'string', value: 'value' }
                }
            });
        });
        (0, bun_test_1.it)('should parse key with special characters', () => {
            const result = parser.parse('"key@symbol"="value"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    'key@symbol': { type: 'string', value: 'value' }
                }
            });
        });
        (0, bun_test_1.it)('should parse mixed quoted and unquoted keys', () => {
            const result = parser.parse('name="John" \'user id\'=123 age=25');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    name: { type: 'string', value: 'John' },
                    'user id': { type: 'number', value: 123 },
                    age: { type: 'number', value: 25 }
                }
            });
        });
    });
    (0, bun_test_1.describe)('Numeric Values', () => {
        (0, bun_test_1.it)('should parse integer', () => {
            const result = parser.parse('value=42');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    value: { type: 'number', value: 42 }
                }
            });
        });
        (0, bun_test_1.it)('should parse negative integer', () => {
            const result = parser.parse('value=-123');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    value: { type: 'number', value: -123 }
                }
            });
        });
        (0, bun_test_1.it)('should parse float', () => {
            const result = parser.parse('value=3.14');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    value: { type: 'number', value: 3.14 }
                }
            });
        });
        (0, bun_test_1.it)('should parse negative float', () => {
            const result = parser.parse('value=-45.67');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    value: { type: 'number', value: -45.67 }
                }
            });
        });
        (0, bun_test_1.it)('should parse zero', () => {
            const result = parser.parse('value=0');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    value: { type: 'number', value: 0 }
                }
            });
        });
        (0, bun_test_1.it)('should parse numbers with underscores', () => {
            const result = parser.parse('large=100_000, million=1_000_000, decimal=1_234.567_890, neg_large=-50_000');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    large: { type: 'number', value: 100000 },
                    million: { type: 'number', value: 1000000 },
                    decimal: { type: 'number', value: 1234.56789 },
                    neg_large: { type: 'number', value: -50000 }
                }
            });
        });
    });
    (0, bun_test_1.describe)('Boolean and Null Values', () => {
        (0, bun_test_1.it)('should parse true', () => {
            const result = parser.parse('active=true');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    active: { type: 'boolean', value: true }
                }
            });
        });
        (0, bun_test_1.it)('should parse false', () => {
            const result = parser.parse('active=false');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    active: { type: 'boolean', value: false }
                }
            });
        });
        (0, bun_test_1.it)('should parse null', () => {
            const result = parser.parse('value=null');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    value: { type: 'null', value: null }
                }
            });
        });
    });
    (0, bun_test_1.describe)('Arrays', () => {
        (0, bun_test_1.it)('should parse empty array', () => {
            const result = parser.parse('items=[]');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    items: { type: 'array', value: [] }
                }
            });
        });
        (0, bun_test_1.it)('should parse array with strings', () => {
            const result = parser.parse('items=["apple", "banana", "cherry"]');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    items: {
                        type: 'array',
                        value: [
                            { type: 'string', value: 'apple' },
                            { type: 'string', value: 'banana' },
                            { type: 'string', value: 'cherry' }
                        ]
                    }
                }
            });
        });
        (0, bun_test_1.it)('should parse array with numbers', () => {
            const result = parser.parse('numbers=[1, 2.5, -3]');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    numbers: {
                        type: 'array',
                        value: [
                            { type: 'number', value: 1 },
                            { type: 'number', value: 2.5 },
                            { type: 'number', value: -3 }
                        ]
                    }
                }
            });
        });
        (0, bun_test_1.it)('should parse array with mixed types', () => {
            const result = parser.parse('mixed=["hello", 123, true, null]');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    mixed: {
                        type: 'array',
                        value: [
                            { type: 'string', value: 'hello' },
                            { type: 'number', value: 123 },
                            { type: 'boolean', value: true },
                            { type: 'null', value: null }
                        ]
                    }
                }
            });
        });
        (0, bun_test_1.it)('should parse array with newlines (no commas)', () => {
            const result = parser.parse('arr=["a"\n"b"\n"c"]');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    arr: {
                        type: 'array',
                        value: [
                            { type: 'string', value: 'a' },
                            { type: 'string', value: 'b' },
                            { type: 'string', value: 'c' }
                        ]
                    }
                }
            });
        });
    });
    (0, bun_test_1.describe)('Nested Objects', () => {
        (0, bun_test_1.it)('should parse simple nested object', () => {
            const result = parser.parse('server={host="localhost" port=8080}');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    server: {
                        type: 'object',
                        value: {
                            host: { type: 'string', value: 'localhost' },
                            port: { type: 'number', value: 8080 }
                        }
                    }
                }
            });
        });
        (0, bun_test_1.it)('should parse empty nested object', () => {
            const result = parser.parse('config={}');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    config: { type: 'object', value: {} }
                }
            });
        });
        (0, bun_test_1.it)('should parse deeply nested objects', () => {
            const result = parser.parse('outer={inner={deep="value"} number=42}');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    outer: {
                        type: 'object',
                        value: {
                            inner: {
                                type: 'object',
                                value: {
                                    deep: { type: 'string', value: 'value' }
                                }
                            },
                            number: { type: 'number', value: 42 }
                        }
                    }
                }
            });
        });
        (0, bun_test_1.it)('should parse array of objects', () => {
            const result = parser.parse('users=[{name="John" age=30}, {name="Jane" age=25}]');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    users: {
                        type: 'array',
                        value: [
                            {
                                type: 'object',
                                value: {
                                    name: { type: 'string', value: 'John' },
                                    age: { type: 'number', value: 30 }
                                }
                            },
                            {
                                type: 'object',
                                value: {
                                    name: { type: 'string', value: 'Jane' },
                                    age: { type: 'number', value: 25 }
                                }
                            }
                        ]
                    }
                }
            });
        });
    });
    (0, bun_test_1.describe)('Comments', () => {
        (0, bun_test_1.it)('should parse single-line comment', () => {
            const result = parser.parse('// This is a comment\nname="John"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    name: { type: 'string', value: 'John' }
                }
            });
        });
        (0, bun_test_1.it)('should parse inline comment', () => {
            const result = parser.parse('name="John" // inline comment');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    name: { type: 'string', value: 'John' }
                }
            });
        });
        (0, bun_test_1.it)('should parse multi-line comment', () => {
            const result = parser.parse('/* This is a\nmulti-line comment */\nname="John"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    name: { type: 'string', value: 'John' }
                }
            });
        });
        (0, bun_test_1.it)('should parse inline multi-line comment', () => {
            const result = parser.parse('name="John" /* inline */ age=30');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    name: { type: 'string', value: 'John' },
                    age: { type: 'number', value: 30 }
                }
            });
        });
    });
    (0, bun_test_1.describe)('Complex Real-World Examples', () => {
        (0, bun_test_1.it)('should parse database configuration', () => {
            const result = parser.parse('database={host="localhost" port=5432 name="mydb" credentials=[{user="admin" role="owner"} {user="reader" role="readonly"}]}');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value?.type).toBe('object');
        });
        (0, bun_test_1.it)('should parse complex nested structure', () => {
            const result = parser.parse('server={host="0.0.0.0" port=3000 middleware=[{name="logger" enabled=true config={level="info"}} {name="cors" enabled=false}]}');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value?.type).toBe('object');
        });
    });
    (0, bun_test_1.describe)('Edge Cases', () => {
        (0, bun_test_1.it)('should parse empty input', () => {
            const result = parser.parse('');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {}
            });
        });
        (0, bun_test_1.it)('should parse only whitespace', () => {
            const result = parser.parse('   \n\t  ');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {}
            });
        });
        (0, bun_test_1.it)('should parse only comments', () => {
            const result = parser.parse('// This is a comment\n/* And another */');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {}
            });
        });
        (0, bun_test_1.it)('should parse Unicode escape sequences', () => {
            const result = parser.parse('unicode="Hello\\u00A9World"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    unicode: { type: 'string', value: 'Hello©World' }
                }
            });
        });
        (0, bun_test_1.it)('should parse trailing commas', () => {
            const result = parser.parse('name="John", age=30,');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.value).toEqual({
                type: 'object',
                value: {
                    name: { type: 'string', value: 'John' },
                    age: { type: 'number', value: 30 }
                }
            });
        });
    });
});
//# sourceMappingURL=parser.test.js.map