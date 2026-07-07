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

  test('pretty format deeply nested structure with inline-short mode', () => {
    // Compact one-liner input exercises the parser; expected output pinned
    // cross-impl in rust/src/lib.rs pretty_serialize_deeply_nested. Uses the
    // new opt-in `maxInlineWidth` mode (short containers inline as
    // `{ k = v }` / `[ a, b ]`, longer ones expand multi-line).
    const input = `a1=[{b1=["c1"]},{b1=["c1",{d1=4}]},{b1=["c1"]},{b1=["c1"]},{b1=["c1"]},{b1=["c1"]}],a2={b2={c2={d2="hahaha"},c3={d3="hohohoh"}}},a3=[["b4","b5","b6",{c4=["d1","d3"]}]]`;
    const out = serializeAstPretty(parseAst(input), { indent: '\t', maxInlineWidth: 44 });
    expect(out).toBe(
      [
        'a1 = [',
        '\t{ b1 = [ "c1" ] }',
        '\t{ b1 = [ "c1", { d1 = 4 } ] }',
        '\t{ b1 = [ "c1" ] }',
        '\t{ b1 = [ "c1" ] }',
        '\t{ b1 = [ "c1" ] }',
        '\t{ b1 = [ "c1" ] }',
        ']',
        'a2 = {',
        '\tb2 = {',
        '\t\tc2 = { d2 = "hahaha" }',
        '\t\tc3 = { d3 = "hohohoh" }',
        '\t}',
        '}',
        'a3 = [',
        '\t[',
        '\t\t"b4", "b5", "b6", { c4 = [ "d1", "d3" ] }',
        '\t]',
        ']',
      ].join('\n')
    );
  });

  test('deeply nested format is idempotent in inline-short mode', () => {
    // Format(format(x)) === format(x) is a key formatter invariant: running
    // the formatter on its own output must be a no-op. Catches indent drift,
    // comment migration, and key reordering regressions.
    const input = `a1=[{b1=["c1"]},{b1=["c1",{d1=4}]},{b1=["c1"]}],a2={b2={c2={d2="hahaha"}}},a3=[["b4",{c4=["d1","d3"]}]]`;
    const opts = { indent: '\t', maxInlineWidth: 44 };
    const once = serializeAstPretty(parseAst(input), opts);
    const twice = serializeAstPretty(parseAst(once), opts);
    expect(twice).toBe(once);
  });

  test('pretty format preserves comments at multiple nesting depths', () => {
    // The vscode-ext formatter's headline feature is comment preservation.
    // Place comments at four positions: top-level leading, inline after a
    // nested array, leading a sibling array element, and inline on a deep
    // scalar value.
    const input = [
      '// top-level header',
      'a1 = [',
      '  {',
      '    b1 = ["c1"]  // first array element',
      '  }',
      '  // lead before second object',
      '  {',
      '    b1 = [',
      '      "c1"',
      '      {',
      '        d1 = 4  /* deep inline block */',
      '      }',
      '    ]',
      '  }',
      ']',
      'a2 = {',
      '  b2 = {',
      '    c2 = { d2 = "hahaha" }',
      '  }',
      '}',
    ].join('\n');
    const out = serializeAstPretty(parseAst(input), { indent: '  ' });
    // Every comment survives the round-trip.
    expect(out).toContain('// top-level header');
    expect(out).toContain('// first array element');
    expect(out).toContain('// lead before second object');
    expect(out).toContain('/* deep inline block */');
    // Inline comment on a deeply nested value stays on the same line.
    expect(out).toContain('d1 = 4 /* deep inline block */');
    // Format must be stable: re-formatting the output is a no-op, even
    // with comments at awkward positions between array elements.
    const reformatted = serializeAstPretty(parseAst(out), { indent: '  ' });
    expect(reformatted).toBe(out);
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
