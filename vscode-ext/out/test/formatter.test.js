"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const jhonFormatter_1 = require("../jhonFormatter");
function createFormatter(options = {}) {
    const defaultOptions = {
        insertSpaces: true,
        tabSize: 2,
        sortKeys: true,
        trailingCommas: false,
        alignEquals: false,
        quoteStyle: 'auto',
        ...options
    };
    return new jhonFormatter_1.JhonFormatter(defaultOptions);
}
(0, bun_test_1.describe)('JhonFormatter', () => {
    (0, bun_test_1.describe)('Basic Object Formatting', () => {
        (0, bun_test_1.it)('should format empty object', () => {
            const formatter = createFormatter();
            const input = { type: 'object', value: {} };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('');
        });
        (0, bun_test_1.it)('should format single key-value pair', () => {
            const formatter = createFormatter();
            const input = {
                type: 'object',
                value: {
                    name: { type: 'string', value: 'John' }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('name = "John"\n');
        });
        (0, bun_test_1.it)('should format multiple key-value pairs with sorted keys', () => {
            const formatter = createFormatter({ sortKeys: true });
            const input = {
                type: 'object',
                value: {
                    zebra: { type: 'string', value: 'last' },
                    apple: { type: 'string', value: 'first' },
                    banana: { type: 'string', value: 'middle' }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('apple = "first",\nbanana = "middle",\nzebra = "last"\n');
        });
        (0, bun_test_1.it)('should format multiple key-value pairs without sorting', () => {
            const formatter = createFormatter({ sortKeys: false });
            const input = {
                type: 'object',
                value: {
                    zebra: { type: 'string', value: 'last' },
                    apple: { type: 'string', value: 'first' },
                    banana: { type: 'string', value: 'middle' }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('zebra = "last",\napple = "first",\nbanana = "middle"\n');
        });
    });
    (0, bun_test_1.describe)('Different Value Types', () => {
        (0, bun_test_1.it)('should format string values', () => {
            const formatter = createFormatter();
            const input = {
                type: 'object',
                value: {
                    text: { type: 'string', value: 'hello' },
                    empty: { type: 'string', value: '' }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('empty = "",\ntext = "hello"\n');
        });
        (0, bun_test_1.it)('should format numeric values', () => {
            const formatter = createFormatter();
            const input = {
                type: 'object',
                value: {
                    integer: { type: 'number', value: 42 },
                    float: { type: 'number', value: 3.14 },
                    negative: { type: 'number', value: -123 }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('float = 3.14,\ninteger = 42,\nnegative = -123\n');
        });
        (0, bun_test_1.it)('should format boolean values', () => {
            const formatter = createFormatter();
            const input = {
                type: 'object',
                value: {
                    active: { type: 'boolean', value: true },
                    inactive: { type: 'boolean', value: false }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('active = true,\ninactive = false\n');
        });
        (0, bun_test_1.it)('should format null value', () => {
            const formatter = createFormatter();
            const input = {
                type: 'object',
                value: {
                    empty: { type: 'null', value: null }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('empty = null\n');
        });
    });
    (0, bun_test_1.describe)('Array Formatting', () => {
        (0, bun_test_1.it)('should format empty array', () => {
            const formatter = createFormatter();
            const input = {
                type: 'object',
                value: {
                    items: { type: 'array', value: [] }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('items = []\n');
        });
        (0, bun_test_1.it)('should format array with strings', () => {
            const formatter = createFormatter();
            const input = {
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
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('items = [\n  "apple",\n  "banana",\n  "cherry"\n]\n');
        });
        (0, bun_test_1.it)('should format array with mixed types', () => {
            const formatter = createFormatter();
            const input = {
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
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('mixed = [\n  "hello",\n  123,\n  true,\n  null\n]\n');
        });
        (0, bun_test_1.it)('should format array with objects', () => {
            const formatter = createFormatter();
            const input = {
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
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('users = [\n  {\n    age = 30,\n    name = "John"\n  },\n  {\n    age = 25,\n    name = "Jane"\n  }\n]\n');
        });
    });
    (0, bun_test_1.describe)('Nested Object Formatting', () => {
        (0, bun_test_1.it)('should format simple nested object', () => {
            const formatter = createFormatter();
            const input = {
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
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('server = {\n  host = "localhost",\n  port = 8080\n}\n');
        });
        (0, bun_test_1.it)('should format empty nested object', () => {
            const formatter = createFormatter();
            const input = {
                type: 'object',
                value: {
                    config: { type: 'object', value: {} }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('config = {}\n');
        });
        (0, bun_test_1.it)('should format deeply nested objects', () => {
            const formatter = createFormatter();
            const input = {
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
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('outer = {\n  inner = {\n    deep = "value"\n  },\n  number = 42\n}\n');
        });
    });
    (0, bun_test_1.describe)('Indentation Options', () => {
        (0, bun_test_1.it)('should format with 2 spaces', () => {
            const formatter = createFormatter({ insertSpaces: true, tabSize: 2 });
            const input = {
                type: 'object',
                value: {
                    nested: {
                        type: 'object',
                        value: {
                            key: { type: 'string', value: 'value' }
                        }
                    }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('nested = {\n  key = "value"\n}\n');
        });
        (0, bun_test_1.it)('should format with 4 spaces', () => {
            const formatter = createFormatter({ insertSpaces: true, tabSize: 4 });
            const input = {
                type: 'object',
                value: {
                    nested: {
                        type: 'object',
                        value: {
                            key: { type: 'string', value: 'value' }
                        }
                    }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('nested = {\n    key = "value"\n}\n');
        });
        (0, bun_test_1.it)('should format with tabs', () => {
            const formatter = createFormatter({ insertSpaces: false, tabSize: 1 });
            const input = {
                type: 'object',
                value: {
                    nested: {
                        type: 'object',
                        value: {
                            key: { type: 'string', value: 'value' }
                        }
                    }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('nested = {\n\tkey = "value"\n}\n');
        });
    });
    (0, bun_test_1.describe)('Trailing Commas', () => {
        (0, bun_test_1.it)('should format with trailing commas', () => {
            const formatter = createFormatter({ trailingCommas: true });
            const input = {
                type: 'object',
                value: {
                    name: { type: 'string', value: 'John' },
                    age: { type: 'number', value: 30 }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('age = 30,\nname = "John",\n');
        });
        (0, bun_test_1.it)('should format without trailing commas', () => {
            const formatter = createFormatter({ trailingCommas: false });
            const input = {
                type: 'object',
                value: {
                    name: { type: 'string', value: 'John' },
                    age: { type: 'number', value: 30 }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('age = 30,\nname = "John"\n');
        });
        (0, bun_test_1.it)('should format array with trailing commas', () => {
            const formatter = createFormatter({ trailingCommas: true });
            const input = {
                type: 'object',
                value: {
                    items: {
                        type: 'array',
                        value: [
                            { type: 'string', value: 'a' },
                            { type: 'string', value: 'b' }
                        ]
                    }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('items = [\n  "a",\n  "b",\n]\n');
        });
    });
    (0, bun_test_1.describe)('Align Equals', () => {
        (0, bun_test_1.it)('should align equals at top level', () => {
            const formatter = createFormatter({ alignEquals: true, sortKeys: false });
            const input = {
                type: 'object',
                value: {
                    short: { type: 'string', value: 'value' },
                    very_long_key_name: { type: 'string', value: 'value' },
                    medium_key: { type: 'string', value: 'value' }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('short              = "value",\nvery_long_key_name = "value",\nmedium_key         = "value"\n');
        });
        (0, bun_test_1.it)('should align equals with nested objects', () => {
            const formatter = createFormatter({ alignEquals: true, sortKeys: false });
            const input = {
                type: 'object',
                value: {
                    name: { type: 'string', value: 'test' },
                    config: {
                        type: 'object',
                        value: {
                            key: { type: 'string', value: 'value' }
                        }
                    },
                    debug: { type: 'boolean', value: true }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('name   = "test",\nconfig = {\n  key = "value"\n},\ndebug  = true\n');
        });
    });
    (0, bun_test_1.describe)('Quote Styles', () => {
        (0, bun_test_1.it)('should format with double quotes', () => {
            const formatter = createFormatter({ quoteStyle: 'double' });
            const input = {
                type: 'object',
                value: {
                    key: { type: 'string', value: 'value' }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('key = "value"\n');
        });
        (0, bun_test_1.it)('should format with single quotes', () => {
            const formatter = createFormatter({ quoteStyle: 'single' });
            const input = {
                type: 'object',
                value: {
                    key: { type: 'string', value: 'value' }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe("key = 'value'\n");
        });
        (0, bun_test_1.it)('should preserve raw string', () => {
            const formatter = createFormatter();
            const input = {
                type: 'object',
                value: {
                    path: { type: 'string', value: 'C:\\Windows\\System32', raw: 'r"C:\\Windows\\System32"' }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('path = r"C:\\Windows\\System32"\n');
        });
    });
    (0, bun_test_1.describe)('Special Keys', () => {
        (0, bun_test_1.it)('should format keys with hyphens (no quotes)', () => {
            const formatter = createFormatter();
            const input = {
                type: 'object',
                value: {
                    'my-key': { type: 'string', value: 'value' },
                    'another-key': { type: 'string', value: 'value' }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('another-key = "value",\nmy-key = "value"\n');
        });
        (0, bun_test_1.it)('should format keys with special characters (quoted)', () => {
            const formatter = createFormatter();
            const input = {
                type: 'object',
                value: {
                    'my key': { type: 'string', value: 'value' },
                    'key@symbol': { type: 'string', value: 'value' }
                }
            };
            const result = formatter.format(input);
            (0, bun_test_1.expect)(result).toBe('"key@symbol" = "value",\n"my key" = "value"\n');
        });
    });
});
//# sourceMappingURL=formatter.test.js.map