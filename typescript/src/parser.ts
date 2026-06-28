import { JhonParseError } from './errors';
import type {
  AstArray,
  AstBoolean,
  AstDocument,
  AstKey,
  AstNull,
  AstNumber,
  AstObject,
  AstProperty,
  AstString,
  AstValue,
  CommentToken,
  ParseOptions,
  SourcePos,
  SourceRange,
} from './types';

const KEY_DELIMITERS = new Set<string>([
  ' ',
  '\t',
  '\n',
  '\r',
  '=',
  ',',
  '{',
  '}',
  '[',
  ']',
  '/',
  '"',
  "'",
  '#',
]);

function isKeyDelimiter(c: string): boolean {
  return KEY_DELIMITERS.has(c);
}

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9';
}

function isHexDigit(c: string): boolean {
  return (
    (c >= '0' && c <= '9') ||
    (c >= 'a' && c <= 'f') ||
    (c >= 'A' && c <= 'F')
  );
}

function hexValue(c: string): number {
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - '0'.charCodeAt(0);
  if (c >= 'a' && c <= 'f') return c.charCodeAt(0) - 'a'.charCodeAt(0) + 10;
  return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
}

function isAsciiAlphanumeric(c: string): boolean {
  return (
    (c >= '0' && c <= '9') ||
    (c >= 'a' && c <= 'z') ||
    (c >= 'A' && c <= 'Z')
  );
}

interface ParserState {
  pos: number;
  line: number;
  column: number;
}

export class Parser {
  private input: string;
  private length: number;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private comments: CommentToken[] = [];
  private readonly options: ParseOptions;

  constructor(input: string, options: ParseOptions = {}) {
    this.input = input;
    this.length = input.length;
    this.options = options;
  }

  parse(): AstDocument {
    // Handle empty / whitespace-only / comments-only input.
    this.skipWsAndComments();
    if (this.pos >= this.length) {
      const doc = this.buildEmptyDocument();
      attachComments(doc, this.comments);
      return doc;
    }

    const first = this.input[this.pos];

    // Mode detection (SPEC §2): the first top-level element decides whether
    // the document is parsed as an object (key=value pairs) or as an implicit
    // array (bare values). `{...}` and `[...]` always begin array mode.
    let objectMode = false;
    if (first !== '{' && first !== '[') {
      const savedPos = this.pos;
      const savedLine = this.line;
      const savedColumn = this.column;
      try {
        this.parseKey();
        this.skipWsAndComments();
        if (this.current() === '=') objectMode = true;
      } catch {
        // Not a valid key — fall through to array mode.
      }
      this.pos = savedPos;
      this.line = savedLine;
      this.column = savedColumn;
    }

    const body = objectMode ? this.parseJhonObject() : this.parseJhonArray();
    const doc = this.finalizeDocument(body);
    attachComments(doc, this.comments);
    return doc;
  }

  getComments(): CommentToken[] {
    return this.comments;
  }

  // ------------------------------------------------------------------------
  // Cursor primitives
  // ------------------------------------------------------------------------

  private current(): string | undefined {
    return this.pos < this.length ? this.input[this.pos] : undefined;
  }

  private peek(offset: number): string | undefined {
    const idx = this.pos + offset;
    return idx < this.length ? this.input[idx] : undefined;
  }

  private advance(): string | undefined {
    if (this.pos >= this.length) return undefined;
    const c = this.input[this.pos];
    if (c === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    this.pos++;
    return c;
  }

  private here(): SourcePos {
    return { offset: this.pos, line: this.line, column: this.column };
  }

  private rangeFrom(start: SourcePos): SourceRange {
    return { start, end: this.here() };
  }

  private syntaxErr(message: string): JhonParseError {
    return new JhonParseError({
      message,
      kind: this.pos >= this.length ? 'eof' : 'syntax',
      line: this.line,
      column: this.column,
      position: this.pos,
    });
  }

  private syntaxErrAt(start: SourcePos, message: string): JhonParseError {
    return new JhonParseError({
      message,
      kind: 'syntax',
      line: start.line,
      column: start.column,
      endLine: this.line,
      endColumn: this.column,
      position: start.offset,
      endPosition: this.pos,
    });
  }

  // ------------------------------------------------------------------------
  // Whitespace and comments
  // ------------------------------------------------------------------------

  /** Skip whitespace and comments. Returns true if a newline was consumed. */
  private skipWsAndComments(): boolean {
    let sawNewline = false;
    for (;;) {
      const c = this.current();
      if (c === ' ' || c === '\t' || c === '\r') {
        this.advance();
        continue;
      }
      if (c === '\n') {
        sawNewline = true;
        this.advance();
        continue;
      }
      if (c === '/' && this.peek(1) === '/') {
        this.consumeLineComment();
        continue;
      }
      if (c === '/' && this.peek(1) === '*') {
        this.consumeBlockComment();
        continue;
      }
      break;
    }
    return sawNewline;
  }

  private consumeLineComment(): void {
    const start = this.here();
    // Skip the leading `//`.
    this.advance();
    this.advance();
    const bodyStart = this.pos;
    while (this.pos < this.length && this.input[this.pos] !== '\n') {
      this.advance();
    }
    const text = this.input.slice(bodyStart, this.pos);
    this.comments.push({
      kind: 'line',
      text,
      range: { start, end: this.here() },
      inline: false,
    });
  }

  private consumeBlockComment(): void {
    const start = this.here();
    this.advance(); // /
    this.advance(); // *
    const bodyStart = this.pos;
    while (this.pos < this.length) {
      const c = this.input[this.pos];
      if (c === '*' && this.peek(1) === '/') {
        const text = this.input.slice(bodyStart, this.pos);
        this.advance(); // *
        this.advance(); // /
        this.comments.push({
          kind: 'block',
          text,
          range: { start, end: this.here() },
          inline: false,
        });
        return;
      }
      this.advance();
    }
    // Ran off the end without a closing `*/`.
    throw this.syntaxErrAt(start, 'unterminated block comment');
  }

  /**
   * Skip the separator between two items. Returns `{ sawNewline, sawComma }`.
   * Per SPEC §5.3, an item following another on the same physical line must
   * be preceded by a comma.
   */
  private skipInterItemSeparator(): { sawNewline: boolean; sawComma: boolean } {
    let sawNewline = this.skipWsAndComments();
    let sawComma = false;
    if (this.current() === ',') {
      sawComma = true;
      this.advance();
      if (this.skipWsAndComments()) {
        sawNewline = true;
      }
    }
    return { sawNewline, sawComma };
  }

  // ------------------------------------------------------------------------
  // Strings
  // ------------------------------------------------------------------------

  private parseString(quote: string): { value: string; rawKind: 'double' | 'single' } {
    const openQuote = this.current();
    if (openQuote !== quote) {
      throw this.syntaxErr(`expected ${quote}`);
    }
    this.advance(); // skip opening quote

    const chars: string[] = [];

    for (;;) {
      const c = this.current();
      if (c === undefined) {
        throw this.syntaxErr('unterminated string');
      }
      const code = c.charCodeAt(0);
      if (code < 0x20 || code === 0x7f) {
        throw this.syntaxErr(
          `literal control character 0x${code.toString(16).padStart(2, '0')} in string; use an escape or a raw string`
        );
      }
      if (c === quote) {
        this.advance();
        return { value: chars.join(''), rawKind: quote === '"' ? 'double' : 'single' };
      }
      if (c === '\\') {
        this.advance();
        const escaped = this.current();
        if (escaped === undefined) {
          throw this.syntaxErr('incomplete escape sequence');
        }
        this.advance();
        switch (escaped) {
          case 'n': chars.push('\n'); break;
          case 'r': chars.push('\r'); break;
          case 't': chars.push('\t'); break;
          case 'b': chars.push('\b'); break;
          case 'f': chars.push('\f'); break;
          case '\\': chars.push('\\'); break;
          case '"': chars.push('"'); break;
          case "'": chars.push("'"); break;
          case '/': chars.push('/'); break;
          case 'x': {
            const v = this.parseHexDigits(2, '\\x');
            chars.push(String.fromCharCode(v));
            break;
          }
          case 'u': {
            const codePoint = this.parseHexDigits(4, '\\u');
            if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
              throw this.syntaxErr(
                `surrogate code point U+${codePoint.toString(16).padStart(4, '0').toUpperCase()} requires a pair; surrogate handling is not yet implemented`
              );
            }
            chars.push(String.fromCodePoint(codePoint));
            break;
          }
          default:
            throw this.syntaxErr(`unknown escape \\${escaped}`);
        }
        continue;
      }
      chars.push(c);
      this.advance();
    }
  }

  private parseHexDigits(count: number, label: string): number {
    let value = 0;
    for (let i = 0; i < count; i++) {
      const c = this.current();
      if (c === undefined || !isHexDigit(c)) {
        throw this.syntaxErr(`incomplete ${label} escape`);
      }
      value = (value << 4) | hexValue(c);
      this.advance();
    }
    return value;
  }

  private parseRawString(): { value: string; hashCount: number } {
    // current() is 'r' or 'R'
    this.advance();
    let hashCount = 0;
    while (this.current() === '#') {
      hashCount++;
      this.advance();
    }
    if (this.current() !== '"') {
      throw this.syntaxErr('expected opening quote after r and # symbols in raw string');
    }
    this.advance();

    const start = this.pos;
    const closing = '"' + '#'.repeat(hashCount);
    const idx = this.input.indexOf(closing, this.pos);
    if (idx === -1) {
      // Move to end for the error position.
      while (this.pos < this.length) this.advance();
      throw this.syntaxErr(`unterminated raw string (expected closing ${closing})`);
    }
    const value = this.input.slice(start, idx);
    // Advance through the closing pattern, keeping line/col correct.
    const targetPos = idx + closing.length;
    while (this.pos < targetPos) {
      this.advance();
    }
    return { value, hashCount };
  }

  // ------------------------------------------------------------------------
  // Numbers
  // ------------------------------------------------------------------------

  private parseNumber(): number {
    const negative = this.current() === '-';
    if (negative) {
      this.advance();
    }

    // Radix detection (lowercase only; uppercase variants error).
    let radix: 16 | 8 | 2 | null = null;
    if (this.current() === '0') {
      const next = this.peek(1);
      if (next === 'x') radix = 16;
      else if (next === 'o') radix = 8;
      else if (next === 'b') radix = 2;
      else if (next === 'X' || next === 'O' || next === 'B') {
        throw this.syntaxErr(`uppercase radix prefix 0${next} not allowed; use lowercase`);
      }
    }

    let literal: string;
    let isFloat = false;

    if (radix !== null) {
      this.advance(); // 0
      this.advance(); // x/o/b
      literal = this.scanRadixDigits(radix);
    } else {
      const intPart = this.scanDecDigits();
      literal = intPart;
      if (this.current() === '.') {
        isFloat = true;
        literal += '.';
        this.advance();
        literal += this.scanDecDigits();
      }
      const c = this.current();
      if (c === 'e' || c === 'E') {
        isFloat = true;
        literal += 'e';
        this.advance();
        const sign = this.current();
        if (sign === '+' || sign === '-') {
          literal += sign;
          this.advance();
        }
        literal += this.scanDecDigits();
      }
    }

    // Reject type suffixes (u8/i32/f64 ...) — letter immediately followed by
    // alphanumeric.
    const cur = this.current();
    const next = this.peek(1);
    if (
      (cur === 'u' || cur === 'i' || cur === 'f') &&
      next !== undefined &&
      isAsciiAlphanumeric(next)
    ) {
      throw this.syntaxErr(`number type suffix not allowed (saw '${cur}${next}')`);
    }

    const signed = negative ? '-' + literal : literal;

    if (radix !== null) {
      return parseRadixLiteral(signed, radix);
    }

    if (!isFloat) {
      if (Number.isSafeInteger(Number(signed))) {
        return Number(signed);
      }
      // Fall through to float for unsafe-large integers (matches Rust's
      // i128/u128 → f64 fallback — precision loss past 2^53).
    }
    const f = Number(signed);
    if (Number.isNaN(f)) {
      throw this.syntaxErr(`could not parse number: ${signed}`);
    }
    return f;
  }

  /** Scan decimal digits with Rust-style underscore separators. */
  private scanDecDigits(): string {
    let s = '';
    let lastWasUnder = false;
    let hasDigit = false;
    while (this.pos < this.length) {
      const c = this.input[this.pos];
      if (isDigit(c)) {
        s += c;
        lastWasUnder = false;
        hasDigit = true;
        this.advance();
      } else if (c === '_') {
        if (!hasDigit || lastWasUnder) {
          throw this.syntaxErr('invalid underscore placement in number');
        }
        lastWasUnder = true;
        this.advance();
      } else {
        break;
      }
    }
    if (!hasDigit) {
      throw this.syntaxErr('number requires at least one digit');
    }
    if (lastWasUnder) {
      throw this.syntaxErr('number cannot end with underscore');
    }
    return s;
  }

  private scanRadixDigits(radix: 16 | 8 | 2): string {
    let s = '';
    let lastWasUnder = false;
    let hasDigit = false;
    while (this.pos < this.length) {
      const c = this.input[this.pos];
      const ok =
        radix === 16 ? isHexDigit(c)
        : radix === 8 ? (c >= '0' && c <= '7')
        : (c === '0' || c === '1');
      if (ok) {
        s += c;
        lastWasUnder = false;
        hasDigit = true;
        this.advance();
      } else if (c === '_') {
        if (!hasDigit || lastWasUnder) {
          throw this.syntaxErr('invalid underscore placement in number');
        }
        lastWasUnder = true;
        this.advance();
      } else {
        break;
      }
    }
    if (!hasDigit) {
      throw this.syntaxErr('number requires at least one digit after radix prefix');
    }
    if (lastWasUnder) {
      throw this.syntaxErr('number cannot end with underscore');
    }
    return s;
  }

  // ------------------------------------------------------------------------
  // Booleans / null
  // ------------------------------------------------------------------------

  private parseBoolean(): boolean {
    if (this.input.substr(this.pos, 4) === 'true') {
      for (let i = 0; i < 4; i++) this.advance();
      return true;
    }
    if (this.input.substr(this.pos, 5) === 'false') {
      for (let i = 0; i < 5; i++) this.advance();
      return false;
    }
    throw this.syntaxErr('invalid boolean value');
  }

  private parseNull(): null {
    if (this.input.substr(this.pos, 4) === 'null') {
      for (let i = 0; i < 4; i++) this.advance();
      return null;
    }
    throw this.syntaxErr('invalid null value');
  }

  // ------------------------------------------------------------------------
  // Keys
  // ------------------------------------------------------------------------

  private parseKey(): { key: AstKey; end: SourcePos } {
    this.skipWsAndComments();
    const start = this.here();
    const c = this.current();
    if (c === '"' || c === "'") {
      const { value, rawKind } = this.parseString(c);
      const end = this.here();
      return {
        key: {
          kind: 'key',
          quoted: true,
          quoteChar: c as '"' | "'",
          value,
          range: { start, end },
          leadingComments: [],
          trailingComments: [],
        },
        end,
      };
    }
    // Bare key — scan until a delimiter byte. UTF-16 surrogates pass through.
    const bodyStart = this.pos;
    while (this.pos < this.length) {
      const ch = this.input[this.pos];
      if (isKeyDelimiter(ch)) break;
      this.advance();
    }
    if (this.pos === bodyStart) {
      throw this.syntaxErr('empty key');
    }
    const value = this.input.slice(bodyStart, this.pos);
    const end = this.here();
    return {
      key: {
        kind: 'key',
        quoted: false,
        value,
        range: { start, end },
        leadingComments: [],
        trailingComments: [],
      },
      end,
    };
  }

  // ------------------------------------------------------------------------
  // Values
  // ------------------------------------------------------------------------

  private parseValue(): AstValue {
    this.skipWsAndComments();
    const start = this.here();
    const c = this.current();
    if (c === undefined) {
      throw this.syntaxErr('expected value');
    }

    if (c === '"' || c === "'") {
      const { value, rawKind } = this.parseString(c);
      return {
        kind: 'string',
        value,
        rawKind,
        range: this.rangeFrom(start),
        leadingComments: [],
        trailingComments: [],
      };
    }
    if (c === 'r' || c === 'R') {
      // Peek ahead — if this isn't actually a raw string (e.g. `route=xyz`),
      // we have a bareword value which is invalid. The Rust impl dispatches
      // purely on the leading r/R; we match that.
      const next = this.peek(1);
      if (next === '"' || next === '#') {
        const { value, hashCount } = this.parseRawString();
        return {
          kind: 'string',
          value,
          rawKind: 'raw',
          rawHashCount: hashCount,
          range: this.rangeFrom(start),
          leadingComments: [],
          trailingComments: [],
        };
      }
      throw this.syntaxErr(`unexpected character in value: ${c}`);
    }
    if (c === '[') {
      return this.parseArray();
    }
    if (c === '{') {
      return this.parseNestedObject();
    }
    if (isDigit(c) || c === '-') {
      const value = this.parseNumber();
      return {
        kind: 'number',
        value,
        range: this.rangeFrom(start),
        leadingComments: [],
        trailingComments: [],
      };
    }
    if (c === 't' || c === 'f') {
      const value = this.parseBoolean();
      return {
        kind: 'boolean',
        value,
        range: this.rangeFrom(start),
        leadingComments: [],
        trailingComments: [],
      };
    }
    if (c === 'n') {
      this.parseNull();
      return {
        kind: 'null',
        range: this.rangeFrom(start),
        leadingComments: [],
        trailingComments: [],
      };
    }
    throw this.syntaxErr(`unexpected character in value: ${c}`);
  }

  private parseArray(): AstArray {
    const start = this.here();
    this.advance(); // [
    const elements: AstValue[] = [];

    this.skipWsAndComments();

    for (;;) {
      const c = this.current();
      if (c === ']') {
        this.advance();
        return {
          kind: 'array',
          elements,
          innerComments: [],
          range: this.rangeFrom(start),
          leadingComments: [],
          trailingComments: [],
        };
      }
      if (c === undefined) {
        throw this.syntaxErr('unterminated array');
      }
      elements.push(this.parseValue());

      const { sawNewline, sawComma } = this.skipInterItemSeparator();

      if (this.current() === ']') {
        this.advance();
        return {
          kind: 'array',
          elements,
          innerComments: [],
          range: this.rangeFrom(start),
          leadingComments: [],
          trailingComments: [],
        };
      }
      if (this.current() === undefined) {
        throw this.syntaxErr('unterminated array');
      }
      if (!sawNewline && !sawComma) {
        throw this.syntaxErr('items on the same line must be separated by a comma');
      }
    }
  }

  private parseNestedObject(): AstObject {
    const start = this.here();
    this.advance(); // {
    const properties: AstProperty[] = [];
    const seenKeys = new Set<string>();

    this.skipWsAndComments();

    for (;;) {
      const c = this.current();
      if (c === '}') {
        this.advance();
        return {
          kind: 'object',
          properties,
          wrapped: true,
          innerComments: [],
          range: this.rangeFrom(start),
          leadingComments: [],
          trailingComments: [],
        };
      }
      if (c === undefined) {
        throw this.syntaxErr('unterminated nested object');
      }

      const property = this.parseProperty(seenKeys);
      properties.push(property);

      const { sawNewline, sawComma } = this.skipInterItemSeparator();

      if (this.current() === '}') {
        this.advance();
        return {
          kind: 'object',
          properties,
          wrapped: true,
          innerComments: [],
          range: this.rangeFrom(start),
          leadingComments: [],
          trailingComments: [],
        };
      }
      if (this.current() === undefined) {
        throw this.syntaxErr('unterminated nested object');
      }
      if (!sawNewline && !sawComma) {
        throw this.syntaxErr('items on the same line must be separated by a comma');
      }
    }
  }

  private parseProperty(seenKeys: Set<string>): AstProperty {
    const start = this.here();
    const { key } = this.parseKey();

    this.skipWsAndComments();

    if (this.current() !== '=') {
      throw this.syntaxErr("expected '=' after key");
    }
    const equalsStart = this.here();
    this.advance();
    const equalsRange = this.rangeFrom(equalsStart);

    this.skipWsAndComments();

    const value = this.parseValue();

    if (seenKeys.has(key.value)) {
      throw new JhonParseError({
        message: `duplicate key '${key.value}'`,
        kind: 'duplicate-key',
        line: this.line,
        column: this.column,
        position: this.pos,
        duplicateKey: key.value,
      });
    }
    seenKeys.add(key.value);

    return {
      kind: 'property',
      key,
      equalsRange,
      value,
      range: this.rangeFrom(start),
      leadingComments: [],
      trailingComments: [],
    };
  }

  /** Bare top-level object form (no surrounding braces). */
  private parseJhonObject(): AstObject {
    const start = this.here();
    const properties: AstProperty[] = [];
    const seenKeys = new Set<string>();

    this.skipWsAndComments();

    while (this.pos < this.length) {
      const property = this.parseProperty(seenKeys);
      properties.push(property);

      const { sawNewline, sawComma } = this.skipInterItemSeparator();

      if (this.pos >= this.length) {
        break; // trailing separator at EOF is OK
      }
      if (!sawNewline && !sawComma) {
        throw this.syntaxErr('items on the same line must be separated by a comma');
      }
    }

    return {
      kind: 'object',
      properties,
      wrapped: false,
      innerComments: [],
      range: this.rangeFrom(start),
      leadingComments: [],
      trailingComments: [],
    };
  }

  /**
   * Top-level implicit array form (no surrounding []). Per SPEC §2: when the
   * first top-level element is not a key=value pair, the whole document is
   * treated as an array. Mixing pairs into array mode is an error.
   */
  private parseJhonArray(): AstArray {
    const start = this.here();
    const elements: AstValue[] = [];

    this.skipWsAndComments();

    while (this.pos < this.length) {
      if (this.current() === '=') {
        throw this.syntaxErr(
          'cannot mix key=value pairs and bare values at top level'
        );
      }
      elements.push(this.parseValue());

      const { sawNewline, sawComma } = this.skipInterItemSeparator();

      if (this.pos >= this.length) {
        break;
      }
      if (!sawNewline && !sawComma) {
        throw this.syntaxErr('items on the same line must be separated by a comma');
      }
    }

    return {
      kind: 'array',
      elements,
      innerComments: [],
      range: this.rangeFrom(start),
      leadingComments: [],
      trailingComments: [],
    };
  }

  // ------------------------------------------------------------------------
  // Document finalization
  // ------------------------------------------------------------------------

  private buildEmptyDocument(): AstDocument {
    // Per SPEC §2: empty/whitespace-only/comments-only input parses to a
    // JSON null (the "Empty" form), distinct from {} and [].
    const start = this.here();
    const empty: AstNull = {
      kind: 'null',
      range: { start, end: start },
      leadingComments: [],
      trailingComments: [],
    };
    return {
      kind: 'document',
      body: empty,
      range: { start, end: this.here() },
      leadingComments: [],
      trailingComments: [],
    };
  }

  private finalizeDocument(body: AstValue): AstDocument {
    return {
      kind: 'document',
      body,
      range: { start: { offset: 0, line: 1, column: 1 }, end: this.here() },
      leadingComments: [],
      trailingComments: [],
    };
  }
}

function parseRadixLiteral(signed: string, radix: 16 | 8 | 2): number {
  // Strip leading '-' for parseInt, reapply sign.
  const negative = signed.startsWith('-');
  const digits = negative ? signed.slice(1) : signed;
  const value = parseInt(digits, radix);
  if (Number.isNaN(value)) {
    throw new JhonParseError({
      message: `could not parse number: ${signed}`,
      kind: 'syntax',
      line: 0,
      column: 0,
      position: -1,
    });
  }
  return negative ? -value : value;
}

export function parseAst(input: string, options?: ParseOptions): AstDocument {
  const parser = new Parser(input, options);
  return parser.parse();
}

// ============================================================================
// Comment attachment post-pass
// ============================================================================
//
// Walks the AST in source order and assigns each CommentToken to a node's
// leadingComments / trailingComments / innerComments based on position:
//
//   - Same line as the previous node's end → previous.trailingComments
//   - Inside an empty/non-empty container with no adjacent sibling → innerComments
//   - Otherwise → next node's leadingComments
//   - Trailing at EOF with a blank line before → document.trailingComments

interface Attachable {
  leadingComments: CommentToken[];
  trailingComments: CommentToken[];
  innerComments?: CommentToken[];
  range: SourceRange;
}

function attachComments(doc: AstDocument, rawComments: CommentToken[]): void {
  if (rawComments.length === 0) return;
  const comments = [...rawComments].sort(
    (a, b) => a.range.start.offset - b.range.start.offset
  );
  let idx = 0;

  let lastCodeEnd: SourcePos | null = null;
  let lastCodeTrailingTarget: Attachable | null = null;
  // Re-bind to defeat TypeScript's control-flow narrowing across the closure
  // boundary (the inner visit() function). Without this, TS infers the
  // variables never get reassigned outside their initial null and narrows
  // them to `null` (and hence `never` after the null check) in the trailing
  // loop below.
  const getLastEnd = (): SourcePos | null => lastCodeEnd;
  const getLastTarget = (): Attachable | null => lastCodeTrailingTarget;

  function takeLeadingFor(target: Attachable, rangeStart: SourcePos): void {
    while (idx < comments.length) {
      const c = comments[idx];
      if (c.range.end.offset > rangeStart.offset) break;
      // Comment ends at or before this node starts.
      if (
        lastCodeEnd !== null &&
        lastCodeTrailingTarget !== null &&
        c.range.start.line === lastCodeEnd.line
      ) {
        // Same line as previous code → trailing of previous node.
        lastCodeTrailingTarget.trailingComments.push(c);
      } else {
        target.leadingComments.push(c);
      }
      idx++;
    }
  }

  function takeInnerFor(container: Attachable, containerEnd: SourcePos): void {
    while (idx < comments.length) {
      const c = comments[idx];
      if (c.range.start.offset >= containerEnd.offset) break;
      if (
        lastCodeEnd !== null &&
        lastCodeTrailingTarget !== null &&
        c.range.start.line === lastCodeEnd.line
      ) {
        lastCodeTrailingTarget.trailingComments.push(c);
      } else if (container.innerComments) {
        container.innerComments.push(c);
      }
      idx++;
    }
  }

  function visit(node: Attachable & { kind: string }): void {
    takeLeadingFor(node, node.range.start);
    // The document node's range.start is offset 0, but there's no "code" at
    // that position — the first real code is inside body. Don't treat doc
    // as a valid trailing-attachment target for file-leading comments.
    if (node.kind !== 'document') {
      lastCodeEnd = node.range.start;
      lastCodeTrailingTarget = null;
    }

    switch (node.kind) {
      case 'document': {
        const doc = node as unknown as AstDocument;
        visit(doc.body as unknown as Attachable & { kind: string });
        break;
      }
      case 'object': {
        const obj = node as unknown as AstObject;
        for (const child of obj.properties) {
          visit(child as unknown as Attachable & { kind: string });
        }
        takeInnerFor(obj, obj.range.end);
        break;
      }
      case 'array': {
        const arr = node as unknown as AstArray;
        for (const child of arr.elements) {
          visit(child as unknown as Attachable & { kind: string });
        }
        takeInnerFor(arr, arr.range.end);
        break;
      }
      case 'property': {
        const prop = node as unknown as AstProperty;
        visit(prop.key as unknown as Attachable & { kind: string });
        visit(prop.value as unknown as Attachable & { kind: string });
        break;
      }
      // Leaf nodes (key, string, number, boolean, null) have no children.
    }

    lastCodeEnd = node.range.end;
    lastCodeTrailingTarget = node;
  }

  visit(doc as unknown as Attachable & { kind: string });

  // Any remaining comments belong to the document.
  while (idx < comments.length) {
    const c = comments[idx];
    const end = getLastEnd();
    const target = getLastTarget();
    if (
      end !== null &&
      target !== null &&
      c.range.start.line === end.line
    ) {
      target.trailingComments.push(c);
    } else {
      doc.trailingComments.push(c);
    }
    idx++;
  }
}
