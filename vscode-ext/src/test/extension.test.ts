/**
 * Smoke tests for the VSCode extension's integration with @zjhken/jhon.
 *
 * These tests exercise the same code paths the extension uses (parseAst →
 * serializeAstPretty / serializeAstCompact) without spinning up the VSCode
 * extension host. End-to-end behavior in a real editor is verified manually
 * via F5 (see the plan's verification §5).
 */

import { describe, test, expect } from 'bun:test';
import {
  JhonParseError,
  parseAst,
  serializeAstCompact,
  serializeAstPretty,
} from '@zjhken/jhon';

describe('extension integration: pretty format', () => {
  test('pretty round-trip preserves values and comments', () => {
    const input = `// header
name = "x"  // inline
port = 80`;
    const out = serializeAstPretty(parseAst(input));
    expect(out).toContain('// header');
    expect(out).toContain('name = "x" // inline');
    expect(out).toContain('port = 80');
  });

  test('pretty format respects 2-space indent default', () => {
    const input = `server={host="localhost",port=8080}`;
    const out = serializeAstPretty(parseAst(input), { indent: '  ' });
    expect(out).toBe('server = {\n  host = "localhost"\n  port = 8080\n}');
  });

  test('pretty format respects tab indent', () => {
    const input = `server={host="localhost"}`;
    const out = serializeAstPretty(parseAst(input), { indent: '\t' });
    expect(out).toBe('server = {\n\thost = "localhost"\n}');
  });

  test('pretty format on malformed input throws', () => {
    expect(() => serializeAstPretty(parseAst(`a=1 b=2`))).toThrow(JhonParseError);
  });
});

describe('extension integration: compact format', () => {
  test('compact collapses to one line', () => {
    const input = `server = {
  host = "localhost"
  port = 8080
}`;
    const out = serializeAstCompact(parseAst(input));
    expect(out).toBe('server={host="localhost",port=8080}');
    expect(out.includes('\n')).toBe(false);
  });

  test('compact preserves comments as inline block comments', () => {
    const input = `// header
a = 1`;
    const out = serializeAstCompact(parseAst(input));
    expect(out.includes('\n')).toBe(false);
    expect(out).toContain('/*');
    expect(out).toContain('header');
  });
});

describe('extension integration: diagnostics', () => {
  test('error carries line/column for diagnostic placement', () => {
    try {
      parseAst(`a=1\nb=+5`);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(JhonParseError);
      const err = e as JhonParseError;
      expect(err.line).toBe(2);
      expect(err.column).toBe(3);
      // VSCode uses 0-based positions; the extension subtracts 1.
      expect(err.message).toMatch(/\+/);
    }
  });

  test('duplicate-key error has kind and duplicateKey fields', () => {
    try {
      parseAst(`a=1, a=2`);
    } catch (e) {
      const err = e as JhonParseError;
      expect(err.kind).toBe('duplicate-key');
      expect(err.duplicateKey).toBe('a');
    }
  });

  test('error positions cover the offending token', () => {
    try {
      parseAst(`n=0Xff`);
    } catch (e) {
      const err = e as JhonParseError;
      expect(err.endLine).toBeGreaterThanOrEqual(err.line);
      expect(err.endColumn).toBeGreaterThan(err.column);
    }
  });

  test('valid input produces no error', () => {
    expect(() => parseAst(`name="x",port=80`)).not.toThrow();
  });
});
