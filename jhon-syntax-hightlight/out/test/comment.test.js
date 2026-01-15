"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const parser_1 = require("../parser");
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
(0, bun_test_1.describe)('Comment Preservation', () => {
    (0, bun_test_1.describe)('Parser Comment Extraction', () => {
        (0, bun_test_1.it)('should extract single-line comments', () => {
            const parser = new parser_1.JhonParser();
            const result = parser.parse('// This is a comment\nname="John"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.comments).toBeDefined();
            (0, bun_test_1.expect)(result.comments?.length).toBe(1);
            (0, bun_test_1.expect)(result.comments?.[0].type).toBe('line');
            (0, bun_test_1.expect)(result.comments?.[0].value).toBe('This is a comment');
        });
        (0, bun_test_1.it)('should extract multiple single-line comments', () => {
            const parser = new parser_1.JhonParser();
            const result = parser.parse('// First comment\n// Second comment\nname="John"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.comments?.length).toBe(2);
            (0, bun_test_1.expect)(result.comments?.[0].value).toBe('First comment');
            (0, bun_test_1.expect)(result.comments?.[1].value).toBe('Second comment');
        });
        (0, bun_test_1.it)('should extract block comments', () => {
            const parser = new parser_1.JhonParser();
            const result = parser.parse('/* This is a block comment */\nname="John"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.comments?.length).toBe(1);
            (0, bun_test_1.expect)(result.comments?.[0].type).toBe('block');
            (0, bun_test_1.expect)(result.comments?.[0].value).toBe('This is a block comment');
        });
        (0, bun_test_1.it)('should extract multi-line block comments', () => {
            const parser = new parser_1.JhonParser();
            const result = parser.parse('/* Line 1\nLine 2\nLine 3 */\nname="John"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.comments?.length).toBe(1);
            (0, bun_test_1.expect)(result.comments?.[0].type).toBe('block');
            (0, bun_test_1.expect)(result.comments?.[0].value).toContain('Line 1');
            (0, bun_test_1.expect)(result.comments?.[0].value).toContain('Line 2');
            (0, bun_test_1.expect)(result.comments?.[0].value).toContain('Line 3');
        });
        (0, bun_test_1.it)('should extract inline comments', () => {
            const parser = new parser_1.JhonParser();
            const result = parser.parse('name="John" // inline comment');
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.comments?.length).toBe(1);
            (0, bun_test_1.expect)(result.comments?.[0].type).toBe('line');
            (0, bun_test_1.expect)(result.comments?.[0].value).toBe('inline comment');
            (0, bun_test_1.expect)(result.comments?.[0].inline).toBe(true);
        });
    });
    (0, bun_test_1.describe)('Formatter Comment Output', () => {
        (0, bun_test_1.it)('should format with single-line comments at the top', () => {
            const parser = new parser_1.JhonParser();
            const formatter = createFormatter();
            const result = parser.parse('// Configuration\nname="John"\nage=30');
            (0, bun_test_1.expect)(result.success).toBe(true);
            const formatted = formatter.format(result.value, result.comments);
            (0, bun_test_1.expect)(formatted).toContain('// Configuration');
            (0, bun_test_1.expect)(formatted).toContain('age = 30');
            (0, bun_test_1.expect)(formatted).toContain('name = "John"');
        });
        (0, bun_test_1.it)('should format with block comments at the top', () => {
            const parser = new parser_1.JhonParser();
            const formatter = createFormatter();
            const result = parser.parse('/* User settings */\nname="John"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            const formatted = formatter.format(result.value, result.comments);
            (0, bun_test_1.expect)(formatted).toContain('/* User settings */');
            (0, bun_test_1.expect)(formatted).toContain('name = "John"');
        });
        (0, bun_test_1.it)('should format with multiple comments', () => {
            const parser = new parser_1.JhonParser();
            const formatter = createFormatter();
            const result = parser.parse('// Author: John\n// Date: 2024\nname="John"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            const formatted = formatter.format(result.value, result.comments);
            (0, bun_test_1.expect)(formatted).toContain('// Author: John');
            (0, bun_test_1.expect)(formatted).toContain('// Date: 2024');
            (0, bun_test_1.expect)(formatted).toContain('name = "John"');
        });
        (0, bun_test_1.it)('should handle input with no comments', () => {
            const parser = new parser_1.JhonParser();
            const formatter = createFormatter();
            const result = parser.parse('name="John"');
            (0, bun_test_1.expect)(result.success).toBe(true);
            const formatted = formatter.format(result.value, result.comments);
            (0, bun_test_1.expect)(formatted).toBe('name = "John"\n');
        });
        (0, bun_test_1.it)('should preserve formatted structure with comments', () => {
            const parser = new parser_1.JhonParser();
            const formatter = createFormatter({ sortKeys: true });
            const result = parser.parse('// User info\nname="John"\nage=30\nactive=true');
            (0, bun_test_1.expect)(result.success).toBe(true);
            const formatted = formatter.format(result.value, result.comments);
            const lines = formatted.split('\n');
            // First line should be the comment
            (0, bun_test_1.expect)(lines[0]).toBe('// User info');
            // Keys should be sorted
            const nameLine = lines.find(l => l.includes('name'));
            const ageLine = lines.find(l => l.includes('age'));
            const activeLine = lines.find(l => l.includes('active'));
            (0, bun_test_1.expect)(nameLine).toBeDefined();
            (0, bun_test_1.expect)(ageLine).toBeDefined();
            (0, bun_test_1.expect)(activeLine).toBeDefined();
        });
    });
    (0, bun_test_1.describe)('Integration Tests', () => {
        (0, bun_test_1.it)('should preserve and format comments in complex object', () => {
            const parser = new parser_1.JhonParser();
            const formatter = createFormatter();
            const input = `// Server configuration
host="localhost"
port=8080
// SSL settings
ssl=true`;
            const result = parser.parse(input);
            (0, bun_test_1.expect)(result.success).toBe(true);
            const formatted = formatter.format(result.value, result.comments);
            (0, bun_test_1.expect)(formatted).toContain('// Server configuration');
            (0, bun_test_1.expect)(formatted).toContain('// SSL settings');
            (0, bun_test_1.expect)(formatted).toContain('host = "localhost"');
            (0, bun_test_1.expect)(formatted).toContain('port = 8080');
            (0, bun_test_1.expect)(formatted).toContain('ssl = true');
        });
        (0, bun_test_1.it)('should handle mixed comment types', () => {
            const parser = new parser_1.JhonParser();
            const formatter = createFormatter();
            const input = `/* Header comment */
// Line comment 1
// Line comment 2
name="John"`;
            const result = parser.parse(input);
            (0, bun_test_1.expect)(result.success).toBe(true);
            const formatted = formatter.format(result.value, result.comments);
            (0, bun_test_1.expect)(formatted).toContain('/* Header comment */');
            (0, bun_test_1.expect)(formatted).toContain('// Line comment 1');
            (0, bun_test_1.expect)(formatted).toContain('// Line comment 2');
        });
    });
});
//# sourceMappingURL=comment.test.js.map