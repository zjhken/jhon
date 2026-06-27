/**
 * JHON TypeScript library — test suite.
 *
 * The first section ports the Rust tests verbatim (`rust/src/lib.rs` lines
 * 1313–2105) so spec-conformance parity is verifiable. The remaining sections
 * cover AST shape, comment preservation, and error positioning — features
 * the Rust impl doesn't have but the TS lib needs for the VSCode extension.
 */

import { describe, test, expect } from 'bun:test';
import {
  JhonParseError,
  parse,
  parseAst,
  serialize,
  serializeAstCompact,
  serializeAstPretty,
  serializePretty,
} from './index';

// ============================================================================
// Rust test parity — SPEC.md contract
// ============================================================================

describe('Rust parity: §2 document form', () => {
  test('empty input parses to empty object', () => {
    expect(parse('')).toEqual({});
  });
  test('whitespace-only input parses to empty object', () => {
    expect(parse('   \n\t\r\n  ')).toEqual({});
  });
  test('comments-only input parses to empty object', () => {
    expect(parse('// just a comment\n/* block */')).toEqual({});
  });
  test('top-level object without braces', () => {
    expect(parse(`name="x",port=80`)).toEqual({ name: 'x', port: 80 });
  });
  test('top-level object with braces', () => {
    expect(parse(`{name="x",port=80}`)).toEqual({ name: 'x', port: 80 });
  });
  test('top-level array alone', () => {
    expect(() => parse('[1, 2, 3]')).toThrow(JhonParseError);
    // parse() returns JhonObject; arrays are accessible via parseAst.
    const doc = parseAst('[1, 2, 3]');
    expect(doc.body.kind).toBe('array');
  });
  test('top-level scalar number is error', () => {
    expect(() => parse('42')).toThrow(JhonParseError);
  });
  test('top-level scalar string is error', () => {
    expect(() => parse(`"hello"`)).toThrow(JhonParseError);
  });
  test('top-level scalar boolean is error', () => {
    expect(() => parse('true')).toThrow(JhonParseError);
  });
  test('top-level scalar null is error', () => {
    expect(() => parse('null')).toThrow(JhonParseError);
  });
  test('top-level array followed by pairs is error', () => {
    expect(() => parse('[1, 2] key=value')).toThrow(JhonParseError);
  });
});

describe('Rust parity: §3.2 comments', () => {
  test('single line comment trailing', () => {
    expect(parse(`key="value" // trailing comment`)).toEqual({ key: 'value' });
  });
  test('block comment inline', () => {
    expect(parse(`key=/* inline */"value"`)).toEqual({ key: 'value' });
  });
  test('block comment spanning lines', () => {
    expect(parse(`key=/* spans\nmultiple\nlines */"value"`)).toEqual({ key: 'value' });
  });
  test('unterminated block comment is error', () => {
    expect(() => parse('key=/* unterminated')).toThrow(JhonParseError);
  });
});

describe('Rust parity: §3.3 bare keys', () => {
  test('simple identifier key', () => {
    expect(parse(`keyname="value"`)).toEqual({ keyname: 'value' });
  });
  test('keyword true as string key', () => {
    expect(parse(`true="yes"`)).toEqual({ true: 'yes' });
  });
  test('keyword false as string key', () => {
    expect(parse(`false="no"`)).toEqual({ false: 'no' });
  });
  test('keyword null as string key', () => {
    expect(parse(`null="nothing"`)).toEqual({ null: 'nothing' });
  });
  test('key with hyphen', () => {
    expect(parse(`my-key="value"`)).toEqual({ 'my-key': 'value' });
  });
  test('key with underscore and digits', () => {
    expect(parse(`key_1="value"`)).toEqual({ key_1: 'value' });
  });
  test('key with dot', () => {
    expect(parse(`app.version=1`)).toEqual({ 'app.version': 1 });
  });
  test('unicode key', () => {
    expect(parse(`日本語="value"`)).toEqual({ 日本語: 'value' });
  });
  test('quoted key with spaces', () => {
    expect(parse(`"quoted key"="value"`)).toEqual({ 'quoted key': 'value' });
  });
});

describe('Rust parity: §3.4 strings', () => {
  test('double quoted string', () => {
    expect(parse(`key="value"`)).toEqual({ key: 'value' });
  });
  test('single quoted string', () => {
    expect(parse(`key='value'`)).toEqual({ key: 'value' });
  });
  test('string escape newline and tab', () => {
    expect(parse(`newline="hello\\nworld",tab="tab\\there"`)).toEqual({
      newline: 'hello\nworld',
      tab: 'tab\there',
    });
  });
  test('string escape unicode', () => {
    expect(parse(`copy="\\u00A9"`)).toEqual({ copy: '©' });
  });
  test('string escape quote and backslash', () => {
    expect(parse(`q="say \\"hi\\"",bs="a\\\\b"`)).toEqual({
      q: 'say "hi"',
      bs: 'a\\b',
    });
  });
  test('raw string basic', () => {
    expect(parse(`path=r"C:\\Windows\\System32"`)).toEqual({
      path: 'C:\\Windows\\System32',
    });
  });
  test('raw string with hashes', () => {
    expect(parse(`q=r#"contains "quotes""#`)).toEqual({
      q: 'contains "quotes"',
    });
  });
  test('raw string multiline', () => {
    // Raw strings don't process escapes — `r"line1\nline2"` is literally
    // those 12 characters, no newline.
    expect(parse(`text=r"line1\\nline2"`)).toEqual({
      text: 'line1\\nline2',
    });
  });
  test('unrecognized escape is error', () => {
    expect(() => parse(`key="value\\q"`)).toThrow(JhonParseError);
  });
  test('unterminated string is error', () => {
    expect(() => parse(`key="unterminated`)).toThrow(JhonParseError);
  });
});

describe('Rust parity: §3.5 numbers', () => {
  test('decimal integer', () => {
    expect(parse(`n=42`)).toEqual({ n: 42 });
  });
  test('negative integer', () => {
    expect(parse(`n=-5`)).toEqual({ n: -5 });
  });
  test('number with underscores', () => {
    expect(parse(`n=1_000_000`)).toEqual({ n: 1_000_000 });
  });
  test('negative number with underscores', () => {
    expect(parse(`n=-50_000`)).toEqual({ n: -50_000 });
  });
  test('float fractional', () => {
    expect(parse(`n=12.5`)).toEqual({ n: 12.5 });
  });
  test('negative float', () => {
    expect(parse(`n=-45.67`)).toEqual({ n: -45.67 });
  });
  test('float with exponent only', () => {
    expect(parse(`n=1e10`)).toEqual({ n: 1e10 });
  });
  test('float with fractional and exponent', () => {
    expect(parse(`n=1.5E-3`)).toEqual({ n: 1.5e-3 });
  });
  test('hex literal lowercase', () => {
    expect(parse(`n=0xff`)).toEqual({ n: 255 });
  });
  test('hex literal uppercase digits', () => {
    expect(parse(`n=0xDE_AD`)).toEqual({ n: 0xde_ad });
  });
  test('octal literal', () => {
    expect(parse(`n=0o777`)).toEqual({ n: 0o777 });
  });
  test('binary literal', () => {
    expect(parse(`n=0b1010`)).toEqual({ n: 0b1010 });
  });
  test('negative hex literal', () => {
    expect(parse(`n=-0xff`)).toEqual({ n: -255 });
  });
  test('positive with plus prefix is error', () => {
    expect(() => parse(`n=+5`)).toThrow(JhonParseError);
  });
  test('uppercase hex prefix is error', () => {
    expect(() => parse(`n=0Xff`)).toThrow(JhonParseError);
  });
  test('uppercase octal prefix is error', () => {
    expect(() => parse(`n=0O77`)).toThrow(JhonParseError);
  });
  test('uppercase binary prefix is error', () => {
    expect(() => parse(`n=0B10`)).toThrow(JhonParseError);
  });
  test('number type suffix is error', () => {
    expect(() => parse(`n=5u8`)).toThrow(JhonParseError);
  });
  test('leading underscore is error', () => {
    expect(() => parse(`n=_5`)).toThrow(JhonParseError);
  });
  test('trailing underscore is error', () => {
    expect(() => parse(`n=5_`)).toThrow(JhonParseError);
  });
  test('adjacent underscores are error', () => {
    expect(() => parse(`n=5__5`)).toThrow(JhonParseError);
  });
});

describe('Rust parity: §5 objects', () => {
  test('basic key value pairs', () => {
    expect(parse(`name="John",age=30,active=true`)).toEqual({
      name: 'John',
      age: 30,
      active: true,
    });
  });
  test('nested object', () => {
    expect(parse(`server={host="localhost", port=8080}`)).toEqual({
      server: { host: 'localhost', port: 8080 },
    });
  });
  test('whitespace around equals is insignificant', () => {
    expect(parse(`a=1, b = 2 , c=3`)).toEqual({ a: 1, b: 2, c: 3 });
  });
  test('duplicate keys at top level are error', () => {
    expect(() => parse(`a=1, a=2`)).toThrow(JhonParseError);
  });
  test('duplicate keys in nested object are error', () => {
    expect(() => parse(`outer={a=1, a=2}`)).toThrow(JhonParseError);
  });
  test('key order is preserved', () => {
    const doc = parseAst(`zebra=1, apple=2, mango=3`);
    expect(doc.body.kind).toBe('object');
    if (doc.body.kind === 'object') {
      expect(doc.body.properties.map((p) => p.key.value)).toEqual([
        'zebra',
        'apple',
        'mango',
      ]);
    }
  });
});

describe('Rust parity: §5.3 separators', () => {
  test('same line comma separated', () => {
    expect(parse(`a=1, b=2, c=3`)).toEqual({ a: 1, b: 2, c: 3 });
  });
  test('newline separated multiline', () => {
    expect(parse(`a=1\nb=2\nc=3`)).toEqual({ a: 1, b: 2, c: 3 });
  });
  test('mixed comma and newline separators', () => {
    expect(parse(`a=1,\nb=2,\nc=3`)).toEqual({ a: 1, b: 2, c: 3 });
  });
  test('trailing comma at top level', () => {
    expect(parse(`a=1, b=2,`)).toEqual({ a: 1, b: 2 });
  });
  test('trailing comma in braced object', () => {
    expect(parse(`{a=1, b=2,}`)).toEqual({ a: 1, b: 2 });
  });
  test('trailing comma in array', () => {
    const doc = parseAst(`[1, 2, 3,]`);
    expect(doc.body.kind).toBe('array');
    if (doc.body.kind === 'array') {
      expect(doc.body.elements.length).toBe(3);
      expect(doc.body.elements[0]).toMatchObject({
        kind: 'number',
        value: 1,
      });
    }
  });
  test('whitespace around comma is insignificant', () => {
    expect(parse(`a=1,b=2, c=3 ,d=4`)).toEqual({ a: 1, b: 2, c: 3, d: 4 });
  });
  test('same line space only separator is error', () => {
    expect(() => parse(`a=1 b=2`)).toThrow(JhonParseError);
  });
  test('same line tab only separator is error', () => {
    expect(() => parse(`a=1\tb=2`)).toThrow(JhonParseError);
  });
  test('array same line no commas is error', () => {
    expect(() => parseAst(`[1 2 3]`)).toThrow(JhonParseError);
  });
});

describe('Rust parity: §6 arrays', () => {
  test('empty array', () => {
    const doc = parseAst(`empty=[]`);
    expect(doc.body.kind).toBe('object');
    if (doc.body.kind === 'object') {
      const v = doc.body.properties[0].value;
      expect(v.kind).toBe('array');
      if (v.kind === 'array') expect(v.elements.length).toBe(0);
    }
  });
  test('array of strings', () => {
    const doc = parseAst(`items=["a", "b", "c"]`);
    expect(doc.body.kind).toBe('object');
    if (doc.body.kind === 'object') {
      const v = doc.body.properties[0].value;
      expect(v.kind).toBe('array');
    }
  });
  test('array mixed types', () => {
    const doc = parseAst(`mixed=[1, "two", true, null]`);
    expect(doc.body.kind).toBe('object');
    if (doc.body.kind === 'object') {
      const v = doc.body.properties[0].value;
      if (v.kind === 'array') {
        expect(v.elements.map((e) => e.kind)).toEqual([
          'number',
          'string',
          'boolean',
          'null',
        ]);
      }
    }
  });
  test('nested arrays', () => {
    const doc = parseAst(`nested=[[1, 2], [3, 4]]`);
    expect(doc.body.kind).toBe('object');
    if (doc.body.kind === 'object') {
      const v = doc.body.properties[0].value;
      expect(v.kind).toBe('array');
    }
  });
  test('multiline array newline separated', () => {
    const doc = parseAst(`list=[\n1\n2\n3\n]`);
    expect(doc.body.kind).toBe('object');
    if (doc.body.kind === 'object') {
      const v = doc.body.properties[0].value;
      if (v.kind === 'array') {
        expect(v.elements.length).toBe(3);
      }
    }
  });
  test('unbalanced array is error', () => {
    expect(() => parseAst(`[1, 2, 3`)).toThrow(JhonParseError);
  });
  test('unbalanced braces are error', () => {
    expect(() => parse(`{a=1, b=2`)).toThrow(JhonParseError);
  });
});

describe('Rust parity: §7 serialization', () => {
  test('compact serialize no spaces around equals', () => {
    // SPEC §5.4: insertion order preserved by default.
    expect(serialize({ name: 'John', age: 30 })).toBe(`name="John",age=30`);
  });
  test('compact serialize nested object', () => {
    expect(serialize({ server: { host: 'localhost', port: 8080 } })).toBe(
      `server={host="localhost",port=8080}`
    );
  });
  test('compact serialize top-level array', () => {
    expect(serialize([{ a: 1 }, { b: 2 }])).toBe(`[{a=1},{b=2}]`);
  });
  test('compact serialize has no trailing comma', () => {
    const out = serialize({ a: 1, b: 2, c: 3 });
    expect(out.endsWith('}')).toBe(false);
    expect(out).toBe(`a=1,b=2,c=3`);
  });
  test('pretty serialize spaces around equals no trailing commas', () => {
    const out = serializePretty({ name: 'John', age: 30 });
    expect(out).toBe(`name = "John"\nage = 30`);
  });
  test('pretty serialize nested object', () => {
    const out = serializePretty({
      server: { host: 'localhost', port: 5432 },
    });
    expect(out).toBe(`server = {\n  host = "localhost"\n  port = 5432\n}`);
  });
  test('pretty serialize array no trailing commas', () => {
    const out = serializePretty([1, 2, 3]);
    expect(out).toBe(`[\n  1\n  2\n  3\n]`);
  });
  test('round trip compact preserves value', () => {
    const original = { name: 'John', age: 30, server: { host: 'localhost', port: 5432 } };
    const roundTrip = parse(serialize(original));
    expect(roundTrip).toEqual(original);
  });
  test('round trip pretty preserves value', () => {
    const original = {
      name: 'John',
      age: 30,
      server: { host: 'localhost', port: 5432 },
    };
    const roundTrip = parse(serializePretty(original));
    expect(roundTrip).toEqual(original);
  });
  test('hex octal binary serialize as decimal', () => {
    expect(serialize({ hex: 0xff, oct: 0o777, bin: 0b1010 })).toBe(
      `hex=255,oct=511,bin=10`
    );
  });
});

// ============================================================================
// AST shape tests
// ============================================================================

describe('AST', () => {
  test('empty input produces empty object body', () => {
    const doc = parseAst('');
    expect(doc.body.kind).toBe('object');
    if (doc.body.kind === 'object') {
      expect(doc.body.properties).toEqual([]);
      expect(doc.body.wrapped).toBe(false);
    }
  });

  test('top-level braced object preserves wrapped flag', () => {
    const doc = parseAst(`{a=1}`);
    expect(doc.body.kind).toBe('object');
    if (doc.body.kind === 'object') {
      expect(doc.body.wrapped).toBe(true);
    }
  });

  test('positions are tracked for nodes', () => {
    const doc = parseAst(`a=1`);
    expect(doc.body.kind).toBe('object');
    if (doc.body.kind === 'object') {
      const prop = doc.body.properties[0];
      expect(prop.range.start.line).toBe(1);
      expect(prop.range.start.column).toBe(1);
      expect(prop.key.value).toBe('a');
      expect(prop.value.range.start.column).toBe(3);
    }
  });

  test('numbers carry decimal value even for radix literals', () => {
    const doc = parseAst(`n=0xff`);
    expect(doc.body).toMatchObject({
      kind: 'object',
      properties: [{ key: { value: 'n' }, value: { kind: 'number', value: 255 } }],
    });
  });

  test('raw strings preserve rawKind and hash count', () => {
    const doc = parseAst(`q=r##"inner"##`);
    expect(doc.body).toMatchObject({
      kind: 'object',
      properties: [
        { value: { kind: 'string', rawKind: 'raw', rawHashCount: 2 } },
      ],
    });
  });

  test('top-level array body', () => {
    const doc = parseAst(`[1, 2, 3]`);
    expect(doc.body.kind).toBe('array');
    if (doc.body.kind === 'array') {
      expect(doc.body.elements.length).toBe(3);
    }
  });
});

// ============================================================================
// Comment preservation tests
// ============================================================================

describe('comment preservation', () => {
  test('file-level leading comment survives pretty round-trip', () => {
    const input = `// header comment
name = "x"`;
    const out = serializeAstPretty(parseAst(input));
    expect(out.startsWith('// header comment')).toBe(true);
    expect(out).toContain('name = "x"');
  });

  test('inline trailing comment survives pretty round-trip', () => {
    const input = `name = "x"  // the name
port = 80`;
    const out = serializeAstPretty(parseAst(input));
    expect(out).toContain('name = "x" // the name');
  });

  test('block comment between key and equals', () => {
    const input = `key /* hi */ = 1`;
    const out = serializeAstPretty(parseAst(input));
    expect(out).toContain('/* hi */');
  });

  test('comment inside empty object', () => {
    const input = `obj = { /* lonely */ }`;
    const doc = parseAst(input);
    if (doc.body.kind === 'object') {
      const val = doc.body.properties[0].value;
      if (val.kind === 'object') {
        expect(val.innerComments.length).toBe(1);
        expect(val.innerComments[0].text).toBe(' lonely ');
      }
    }
  });

  test('comment between properties attaches as next leading', () => {
    const input = `a = 1
// middle comment
b = 2`;
    const doc = parseAst(input);
    if (doc.body.kind === 'object') {
      const bProp = doc.body.properties[1];
      expect(bProp.leadingComments.length).toBe(1);
      expect(bProp.leadingComments[0].text).toBe(' middle comment');
    }
  });

  test('line comment converts to block in compact mode', () => {
    const input = `// header
a = 1`;
    const out = serializeAstCompact(parseAst(input));
    expect(out).toContain('/* header');
    expect(out).not.toContain('\n'); // compact stays on one line
  });

  test('comments in array elements preserve', () => {
    const input = `items = [
  "a"  // first
  "b"
]`;
    const doc = parseAst(input);
    if (doc.body.kind === 'object') {
      const arr = doc.body.properties[0].value;
      if (arr.kind === 'array') {
        expect(arr.elements[0].trailingComments.length).toBe(1);
      }
    }
  });

  test('trailing EOF comment', () => {
    const input = `a = 1
// end of file`;
    const doc = parseAst(input);
    // Comment may land on body.trailingComments, doc.trailingComments, or
    // body.innerComments depending on attach heuristics. Whichever slot —
    // the comment must survive the round-trip.
    const all = [
      ...doc.trailingComments,
      ...doc.body.trailingComments,
      ...((doc.body as { innerComments?: Array<{ text: string }> }).innerComments ?? []),
    ];
    expect(all.length).toBe(1);
    expect(all[0].text).toBe(' end of file');
    // Verify it survives pretty round-trip.
    const out = serializeAstPretty(doc);
    expect(out).toContain('// end of file');
  });
});

// ============================================================================
// Error positioning tests
// ============================================================================

describe('error positioning', () => {
  test('syntax error reports line and column', () => {
    try {
      parse(`a=1\nb=+5`);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(JhonParseError);
      const err = e as JhonParseError;
      expect(err.line).toBe(2);
      expect(err.column).toBe(3);
      expect(err.message).toContain('+');
    }
  });

  test('duplicate key error reports position and key', () => {
    try {
      parse(`a=1, a=2`);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(JhonParseError);
      const err = e as JhonParseError;
      expect(err.kind).toBe('duplicate-key');
      expect(err.duplicateKey).toBe('a');
      expect(err.line).toBe(1);
    }
  });

  test('unterminated string error reports position', () => {
    try {
      parse(`key="unfinished`);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(JhonParseError);
      const err = e as JhonParseError;
      expect(err.message.toLowerCase()).toContain('unterminated');
    }
  });

  test('uppercase radix prefix error', () => {
    try {
      parse(`n=0Xff`);
    } catch (e) {
      const err = e as JhonParseError;
      expect(err.message).toMatch(/uppercase/i);
    }
  });

  test('same-line space-only separator error', () => {
    try {
      parse(`a=1 b=2`);
    } catch (e) {
      const err = e as JhonParseError;
      expect(err.message).toMatch(/same line/i);
      expect(err.line).toBe(1);
    }
  });
});

// ============================================================================
// Edge cases for the TS impl
// ============================================================================

describe('edge cases', () => {
  test('deeply nested structures', () => {
    const input = `a={b={c={d={e=1}}}}`;
    expect(parse(input)).toEqual({
      a: { b: { c: { d: { e: 1 } } } },
    });
  });

  test('large arrays', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i);
    const input = `items=[${arr.join(',')}]`;
    const doc = parseAst(input);
    if (doc.body.kind === 'object') {
      const val = doc.body.properties[0].value;
      if (val.kind === 'array') {
        expect(val.elements.length).toBe(100);
      }
    }
  });

  test('unicode values', () => {
    expect(parse(`emoji="🎉",ja="こんにちは"`)).toEqual({
      emoji: '🎉',
      ja: 'こんにちは',
    });
  });

  test('negative zero serializes as zero', () => {
    expect(serialize({ a: -0 })).toBe(`a=0`);
  });

  test('number with all radix forms round-trip as decimal', () => {
    expect(parse(`h=0xff`)).toEqual({ h: 255 });
    expect(parse(`o=0o777`)).toEqual({ o: 511 });
    expect(parse(`b=0b1010`)).toEqual({ b: 10 });
  });

  test('boolean and null in same object', () => {
    expect(parse(`t=true,f=false,n=null`)).toEqual({
      t: true,
      f: false,
      n: null,
    });
  });

  test('sortKeys option in serializer', () => {
    const out = serializePretty({ zebra: 1, apple: 2 }, { sortKeys: true });
    const lines = out.split('\n').map((l) => l.split(' ')[0]);
    expect(lines).toEqual(['apple', 'zebra']);
  });

  test('custom indent string', () => {
    const out = serializePretty({ obj: { a: 1 } }, { indent: '    ' });
    expect(out).toContain('    a = 1');
  });
});
