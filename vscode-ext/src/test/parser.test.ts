import { describe, it, expect } from 'bun:test';
import { JhonParser } from '../parser';

describe('JhonParser', () => {
	const parser = new JhonParser();

	describe('Basic Key-Value Pairs', () => {
		it('should parse single key-value pair', () => {
			const result = parser.parse('name="John"');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					name: { type: 'string', value: 'John' }
				}
			});
		});

		it('should parse multiple key-value pairs with commas', () => {
			const result = parser.parse('name="John", age=30');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					name: { type: 'string', value: 'John' },
					age: { type: 'number', value: 30 }
				}
			});
		});

		it('should parse multiple key-value pairs with newlines', () => {
			const result = parser.parse('name="John"\nage=30');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					name: { type: 'string', value: 'John' },
					age: { type: 'number', value: 30 }
				}
			});
		});

		it('should parse key with hyphens', () => {
			const result = parser.parse('my-key="value"');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					'my-key': { type: 'string', value: 'value' }
				}
			});
		});

		it('should parse key with underscores', () => {
			const result = parser.parse('my_key="value"');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					my_key: { type: 'string', value: 'value' }
				}
			});
		});
	});

	describe('String Values', () => {
		it('should parse double-quoted string', () => {
			const result = parser.parse('text="hello"');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					text: { type: 'string', value: 'hello' }
				}
			});
		});

		it('should parse single-quoted string', () => {
			const result = parser.parse("text='world'");
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					text: { type: 'string', value: 'world' }
				}
			});
		});

		it('should parse string with escape sequences', () => {
			const result = parser.parse('text="hello\\nworld\\t!"');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					text: { type: 'string', value: 'hello\nworld\t!' }
				}
			});
		});

		it('should parse raw string', () => {
			const result = parser.parse('path=r"C:\\Windows\\System32"');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					path: { type: 'string', value: 'C:\\Windows\\System32', raw: 'r"C:\\Windows\\System32"' }
				}
			});
		});

		it('should parse raw string with uppercase R', () => {
			const result = parser.parse('path=R"C:\\Windows\\System32"');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					path: { type: 'string', value: 'C:\\Windows\\System32', raw: 'R"C:\\Windows\\System32"' }
				}
			});
		});

		it('should parse raw string with hashes', () => {
			const result = parser.parse('text=r#"has "quotes" inside"#');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					text: { type: 'string', value: 'has "quotes" inside', raw: 'r#"has "quotes" inside"#' }
				}
			});
		});

		it('should parse empty string', () => {
			const result = parser.parse('empty=""');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					empty: { type: 'string', value: '' }
				}
			});
		});
	});

	describe('Key Types', () => {
		it('should parse double-quoted key', () => {
			const result = parser.parse('"my key"="value"');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					'my key': { type: 'string', value: 'value' }
				}
			});
		});

		it('should parse single-quoted key', () => {
			const result = parser.parse("'my key'='value'");
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					'my key': { type: 'string', value: 'value' }
				}
			});
		});

		it('should parse key with special characters', () => {
			const result = parser.parse('"key@symbol"="value"');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					'key@symbol': { type: 'string', value: 'value' }
				}
			});
		});

		it('should parse mixed quoted and unquoted keys', () => {
			const result = parser.parse('name="John" \'user id\'=123 age=25');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					name: { type: 'string', value: 'John' },
					'user id': { type: 'number', value: 123 },
					age: { type: 'number', value: 25 }
				}
			});
		});
	});

	describe('Numeric Values', () => {
		it('should parse integer', () => {
			const result = parser.parse('value=42');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					value: { type: 'number', value: 42 }
				}
			});
		});

		it('should parse negative integer', () => {
			const result = parser.parse('value=-123');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					value: { type: 'number', value: -123 }
				}
			});
		});

		it('should parse float', () => {
			const result = parser.parse('value=3.14');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					value: { type: 'number', value: 3.14 }
				}
			});
		});

		it('should parse negative float', () => {
			const result = parser.parse('value=-45.67');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					value: { type: 'number', value: -45.67 }
				}
			});
		});

		it('should parse zero', () => {
			const result = parser.parse('value=0');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					value: { type: 'number', value: 0 }
				}
			});
		});

		it('should parse numbers with underscores', () => {
			const result = parser.parse('large=100_000, million=1_000_000, decimal=1_234.567_890, neg_large=-50_000');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
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

	describe('Boolean and Null Values', () => {
		it('should parse true', () => {
			const result = parser.parse('active=true');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					active: { type: 'boolean', value: true }
				}
			});
		});

		it('should parse false', () => {
			const result = parser.parse('active=false');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					active: { type: 'boolean', value: false }
				}
			});
		});

		it('should parse null', () => {
			const result = parser.parse('value=null');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					value: { type: 'null', value: null }
				}
			});
		});
	});

	describe('Arrays', () => {
		it('should parse empty array', () => {
			const result = parser.parse('items=[]');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					items: { type: 'array', value: [] }
				}
			});
		});

		it('should parse array with strings', () => {
			const result = parser.parse('items=["apple", "banana", "cherry"]');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
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

		it('should parse array with numbers', () => {
			const result = parser.parse('numbers=[1, 2.5, -3]');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
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

		it('should parse array with mixed types', () => {
			const result = parser.parse('mixed=["hello", 123, true, null]');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
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

		it('should parse array with newlines (no commas)', () => {
			const result = parser.parse('arr=["a"\n"b"\n"c"]');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
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

	describe('Nested Objects', () => {
		it('should parse simple nested object', () => {
			const result = parser.parse('server={host="localhost" port=8080}');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
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

		it('should parse empty nested object', () => {
			const result = parser.parse('config={}');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					config: { type: 'object', value: {} }
				}
			});
		});

		it('should parse deeply nested objects', () => {
			const result = parser.parse('outer={inner={deep="value"} number=42}');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
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

		it('should parse array of objects', () => {
			const result = parser.parse('users=[{name="John" age=30}, {name="Jane" age=25}]');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
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

	describe('Comments', () => {
		it('should parse single-line comment', () => {
			const result = parser.parse('// This is a comment\nname="John"');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					name: { type: 'string', value: 'John' }
				}
			});
		});

		it('should parse inline comment', () => {
			const result = parser.parse('name="John" // inline comment');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					name: { type: 'string', value: 'John' }
				}
			});
		});

		it('should parse multi-line comment', () => {
			const result = parser.parse('/* This is a\nmulti-line comment */\nname="John"');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					name: { type: 'string', value: 'John' }
				}
			});
		});

		it('should parse inline multi-line comment', () => {
			const result = parser.parse('name="John" /* inline */ age=30');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					name: { type: 'string', value: 'John' },
					age: { type: 'number', value: 30 }
				}
			});
		});
	});

	describe('Complex Real-World Examples', () => {
		it('should parse database configuration', () => {
			const result = parser.parse('database={host="localhost" port=5432 name="mydb" credentials=[{user="admin" role="owner"} {user="reader" role="readonly"}]}');
			expect(result.success).toBe(true);
			expect(result.value?.type).toBe('object');
		});

		it('should parse complex nested structure', () => {
			const result = parser.parse('server={host="0.0.0.0" port=3000 middleware=[{name="logger" enabled=true config={level="info"}} {name="cors" enabled=false}]}');
			expect(result.success).toBe(true);
			expect(result.value?.type).toBe('object');
		});
	});

	describe('Edge Cases', () => {
		it('should parse empty input', () => {
			const result = parser.parse('');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {}
			});
		});

		it('should parse only whitespace', () => {
			const result = parser.parse('   \n\t  ');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {}
			});
		});

		it('should parse only comments', () => {
			const result = parser.parse('// This is a comment\n/* And another */');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {}
			});
		});

		it('should parse Unicode escape sequences', () => {
			const result = parser.parse('unicode="Hello\\u00A9World"');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					unicode: { type: 'string', value: 'Hello©World' }
				}
			});
		});

		it('should parse trailing commas', () => {
			const result = parser.parse('name="John", age=30,');
			expect(result.success).toBe(true);
			expect(result.value).toEqual({
				type: 'object',
				value: {
					name: { type: 'string', value: 'John' },
					age: { type: 'number', value: 30 }
				}
			});
		});
	});
});
