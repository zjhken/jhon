import { describe, it, expect } from 'bun:test';
import { JhonParser } from '../parser';
import { JhonFormatter } from '../jhonFormatter';
import type { JhonObject } from '../parser';

function createFormatter(options: Partial<{insertSpaces: boolean, tabSize: number, sortKeys: boolean, trailingCommas: boolean, alignEquals: boolean, quoteStyle: 'double' | 'single' | 'auto'}> = {}) {
	const defaultOptions = {
		insertSpaces: true as const,
		tabSize: 2,
		sortKeys: true,
		trailingCommas: false,
		alignEquals: false,
		quoteStyle: 'auto' as const,
		...options
	};
	return new JhonFormatter(defaultOptions);
}

describe('Comment Preservation', () => {
	describe('Parser Comment Extraction', () => {
		it('should extract single-line comments', () => {
			const parser = new JhonParser();
			const result = parser.parse('// This is a comment\nname="John"');

			expect(result.success).toBe(true);
			expect(result.comments).toBeDefined();
			expect(result.comments?.length).toBe(1);
			expect(result.comments?.[0].type).toBe('line');
			expect(result.comments?.[0].value).toBe('This is a comment');
		});

		it('should extract multiple single-line comments', () => {
			const parser = new JhonParser();
			const result = parser.parse('// First comment\n// Second comment\nname="John"');

			expect(result.success).toBe(true);
			expect(result.comments?.length).toBe(2);
			expect(result.comments?.[0].value).toBe('First comment');
			expect(result.comments?.[1].value).toBe('Second comment');
		});

		it('should extract block comments', () => {
			const parser = new JhonParser();
			const result = parser.parse('/* This is a block comment */\nname="John"');

			expect(result.success).toBe(true);
			expect(result.comments?.length).toBe(1);
			expect(result.comments?.[0].type).toBe('block');
			expect(result.comments?.[0].value).toBe('This is a block comment');
		});

		it('should extract multi-line block comments', () => {
			const parser = new JhonParser();
			const result = parser.parse('/* Line 1\nLine 2\nLine 3 */\nname="John"');

			expect(result.success).toBe(true);
			expect(result.comments?.length).toBe(1);
			expect(result.comments?.[0].type).toBe('block');
			expect(result.comments?.[0].value).toContain('Line 1');
			expect(result.comments?.[0].value).toContain('Line 2');
			expect(result.comments?.[0].value).toContain('Line 3');
		});

		it('should extract inline comments', () => {
			const parser = new JhonParser();
			const result = parser.parse('name="John" // inline comment');

			expect(result.success).toBe(true);
			expect(result.comments?.length).toBe(1);
			expect(result.comments?.[0].type).toBe('line');
			expect(result.comments?.[0].value).toBe('inline comment');
			expect(result.comments?.[0].inline).toBe(true);
		});
	});

	describe('Formatter Comment Output', () => {
		it('should format with single-line comments at the top', () => {
			const parser = new JhonParser();
			const formatter = createFormatter();

			const result = parser.parse('// Configuration\nname="John"\nage=30');
			expect(result.success).toBe(true);

			const formatted = formatter.format(result.value as JhonObject, result.comments);
			expect(formatted).toContain('// Configuration');
			expect(formatted).toContain('age = 30');
			expect(formatted).toContain('name = "John"');
		});

		it('should format with block comments at the top', () => {
			const parser = new JhonParser();
			const formatter = createFormatter();

			const result = parser.parse('/* User settings */\nname="John"');
			expect(result.success).toBe(true);

			const formatted = formatter.format(result.value as JhonObject, result.comments);
			expect(formatted).toContain('/* User settings */');
			expect(formatted).toContain('name = "John"');
		});

		it('should format with multiple comments', () => {
			const parser = new JhonParser();
			const formatter = createFormatter();

			const result = parser.parse('// Author: John\n// Date: 2024\nname="John"');
			expect(result.success).toBe(true);

			const formatted = formatter.format(result.value as JhonObject, result.comments);
			expect(formatted).toContain('// Author: John');
			expect(formatted).toContain('// Date: 2024');
			expect(formatted).toContain('name = "John"');
		});

		it('should handle input with no comments', () => {
			const parser = new JhonParser();
			const formatter = createFormatter();

			const result = parser.parse('name="John"');
			expect(result.success).toBe(true);

			const formatted = formatter.format(result.value as JhonObject, result.comments);
			expect(formatted).toBe('name = "John"\n');
		});

		it('should preserve formatted structure with comments', () => {
			const parser = new JhonParser();
			const formatter = createFormatter({ sortKeys: true });

			const result = parser.parse('// User info\nname="John"\nage=30\nactive=true');
			expect(result.success).toBe(true);

			const formatted = formatter.format(result.value as JhonObject, result.comments);
			const lines = formatted.split('\n');

			// First line should be the comment
			expect(lines[0]).toBe('// User info');

			// Keys should be sorted
			const nameLine = lines.find(l => l.includes('name'));
			const ageLine = lines.find(l => l.includes('age'));
			const activeLine = lines.find(l => l.includes('active'));

			expect(nameLine).toBeDefined();
			expect(ageLine).toBeDefined();
			expect(activeLine).toBeDefined();
		});
	});

	describe('Integration Tests', () => {
		it('should preserve and format comments in complex object', () => {
			const parser = new JhonParser();
			const formatter = createFormatter();

			const input = `// Server configuration
host="localhost"
port=8080
// SSL settings
ssl=true`;

			const result = parser.parse(input);
			expect(result.success).toBe(true);

			const formatted = formatter.format(result.value as JhonObject, result.comments);
			expect(formatted).toContain('// Server configuration');
			expect(formatted).toContain('// SSL settings');
			expect(formatted).toContain('host = "localhost"');
			expect(formatted).toContain('port = 8080');
			expect(formatted).toContain('ssl = true');
		});

		it('should handle mixed comment types', () => {
			const parser = new JhonParser();
			const formatter = createFormatter();

			const input = `/* Header comment */
// Line comment 1
// Line comment 2
name="John"`;

			const result = parser.parse(input);
			expect(result.success).toBe(true);

			const formatted = formatter.format(result.value as JhonObject, result.comments);
			expect(formatted).toContain('/* Header comment */');
			expect(formatted).toContain('// Line comment 1');
			expect(formatted).toContain('// Line comment 2');
		});
	});
});
