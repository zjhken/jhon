"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));

// ../typescript/dist/errors.js
var JhonParseError = class extends Error {
  position;
  line;
  column;
  endLine;
  endColumn;
  kind;
  duplicateKey;
  constructor(args) {
    super(args.message);
    this.name = "JhonParseError";
    this.kind = args.kind;
    this.line = args.line;
    this.column = args.column;
    this.endLine = args.endLine ?? args.line;
    this.endColumn = args.endColumn ?? args.column + 1;
    this.position = args.position ?? -1;
    this.duplicateKey = args.duplicateKey;
  }
  toString() {
    const where = this.kind === "eof" ? `unexpected end of input at ${this.line}:${this.column}` : `parse error at ${this.line}:${this.column}`;
    return `${where}: ${this.message}`;
  }
};

// ../typescript/dist/parser.js
var KEY_DELIMITERS = /* @__PURE__ */ new Set([
  " ",
  "	",
  "\n",
  "\r",
  "=",
  ",",
  "{",
  "}",
  "[",
  "]",
  "/",
  '"',
  "'",
  "#"
]);
function isKeyDelimiter(c) {
  return KEY_DELIMITERS.has(c);
}
function isDigit(c) {
  return c >= "0" && c <= "9";
}
function isHexDigit(c) {
  return c >= "0" && c <= "9" || c >= "a" && c <= "f" || c >= "A" && c <= "F";
}
function hexValue(c) {
  if (c >= "0" && c <= "9")
    return c.charCodeAt(0) - "0".charCodeAt(0);
  if (c >= "a" && c <= "f")
    return c.charCodeAt(0) - "a".charCodeAt(0) + 10;
  return c.charCodeAt(0) - "A".charCodeAt(0) + 10;
}
function isAsciiAlphanumeric(c) {
  return c >= "0" && c <= "9" || c >= "a" && c <= "z" || c >= "A" && c <= "Z";
}
var Parser = class {
  input;
  length;
  pos = 0;
  line = 1;
  column = 1;
  comments = [];
  options;
  constructor(input, options = {}) {
    this.input = input;
    this.length = input.length;
    this.options = options;
  }
  parse() {
    this.skipWsAndComments();
    if (this.pos >= this.length) {
      const doc2 = this.buildEmptyDocument();
      attachComments(doc2, this.comments);
      return doc2;
    }
    const first = this.input[this.pos];
    if (first === "{") {
      const body2 = this.parseNestedObject();
      const doc2 = this.finalizeDocument(body2);
      attachComments(doc2, this.comments);
      return doc2;
    }
    if (first === "[") {
      const body2 = this.parseArray();
      this.skipWsAndComments();
      if (this.pos < this.length) {
        throw this.syntaxErr("unexpected content after top-level array");
      }
      const doc2 = this.finalizeDocument(body2);
      attachComments(doc2, this.comments);
      return doc2;
    }
    const body = this.parseJhonObject();
    const doc = this.finalizeDocument(body);
    attachComments(doc, this.comments);
    return doc;
  }
  getComments() {
    return this.comments;
  }
  // ------------------------------------------------------------------------
  // Cursor primitives
  // ------------------------------------------------------------------------
  current() {
    return this.pos < this.length ? this.input[this.pos] : void 0;
  }
  peek(offset) {
    const idx = this.pos + offset;
    return idx < this.length ? this.input[idx] : void 0;
  }
  advance() {
    if (this.pos >= this.length)
      return void 0;
    const c = this.input[this.pos];
    if (c === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    this.pos++;
    return c;
  }
  here() {
    return { offset: this.pos, line: this.line, column: this.column };
  }
  rangeFrom(start) {
    return { start, end: this.here() };
  }
  syntaxErr(message) {
    return new JhonParseError({
      message,
      kind: this.pos >= this.length ? "eof" : "syntax",
      line: this.line,
      column: this.column,
      position: this.pos
    });
  }
  syntaxErrAt(start, message) {
    return new JhonParseError({
      message,
      kind: "syntax",
      line: start.line,
      column: start.column,
      endLine: this.line,
      endColumn: this.column,
      position: start.offset,
      endPosition: this.pos
    });
  }
  // ------------------------------------------------------------------------
  // Whitespace and comments
  // ------------------------------------------------------------------------
  /** Skip whitespace and comments. Returns true if a newline was consumed. */
  skipWsAndComments() {
    let sawNewline = false;
    for (; ; ) {
      const c = this.current();
      if (c === " " || c === "	" || c === "\r") {
        this.advance();
        continue;
      }
      if (c === "\n") {
        sawNewline = true;
        this.advance();
        continue;
      }
      if (c === "/" && this.peek(1) === "/") {
        this.consumeLineComment();
        continue;
      }
      if (c === "/" && this.peek(1) === "*") {
        this.consumeBlockComment();
        continue;
      }
      break;
    }
    return sawNewline;
  }
  consumeLineComment() {
    const start = this.here();
    this.advance();
    this.advance();
    const bodyStart = this.pos;
    while (this.pos < this.length && this.input[this.pos] !== "\n") {
      this.advance();
    }
    const text = this.input.slice(bodyStart, this.pos);
    this.comments.push({
      kind: "line",
      text,
      range: { start, end: this.here() },
      inline: false
    });
  }
  consumeBlockComment() {
    const start = this.here();
    this.advance();
    this.advance();
    const bodyStart = this.pos;
    while (this.pos < this.length) {
      const c = this.input[this.pos];
      if (c === "*" && this.peek(1) === "/") {
        const text = this.input.slice(bodyStart, this.pos);
        this.advance();
        this.advance();
        this.comments.push({
          kind: "block",
          text,
          range: { start, end: this.here() },
          inline: false
        });
        return;
      }
      this.advance();
    }
    throw this.syntaxErrAt(start, "unterminated block comment");
  }
  /**
   * Skip the separator between two items. Returns `{ sawNewline, sawComma }`.
   * Per SPEC §5.3, an item following another on the same physical line must
   * be preceded by a comma.
   */
  skipInterItemSeparator() {
    let sawNewline = this.skipWsAndComments();
    let sawComma = false;
    if (this.current() === ",") {
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
  parseString(quote) {
    const openQuote = this.current();
    if (openQuote !== quote) {
      throw this.syntaxErr(`expected ${quote}`);
    }
    this.advance();
    const chars = [];
    for (; ; ) {
      const c = this.current();
      if (c === void 0) {
        throw this.syntaxErr("unterminated string");
      }
      const code = c.charCodeAt(0);
      if (code < 32 || code === 127) {
        throw this.syntaxErr(`literal control character 0x${code.toString(16).padStart(2, "0")} in string; use an escape or a raw string`);
      }
      if (c === quote) {
        this.advance();
        return { value: chars.join(""), rawKind: quote === '"' ? "double" : "single" };
      }
      if (c === "\\") {
        this.advance();
        const escaped = this.current();
        if (escaped === void 0) {
          throw this.syntaxErr("incomplete escape sequence");
        }
        this.advance();
        switch (escaped) {
          case "n":
            chars.push("\n");
            break;
          case "r":
            chars.push("\r");
            break;
          case "t":
            chars.push("	");
            break;
          case "b":
            chars.push("\b");
            break;
          case "f":
            chars.push("\f");
            break;
          case "\\":
            chars.push("\\");
            break;
          case '"':
            chars.push('"');
            break;
          case "'":
            chars.push("'");
            break;
          case "/":
            chars.push("/");
            break;
          case "x": {
            const v = this.parseHexDigits(2, "\\x");
            chars.push(String.fromCharCode(v));
            break;
          }
          case "u": {
            const codePoint = this.parseHexDigits(4, "\\u");
            if (codePoint >= 55296 && codePoint <= 57343) {
              throw this.syntaxErr(`surrogate code point U+${codePoint.toString(16).padStart(4, "0").toUpperCase()} requires a pair; surrogate handling is not yet implemented`);
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
  parseHexDigits(count, label) {
    let value = 0;
    for (let i = 0; i < count; i++) {
      const c = this.current();
      if (c === void 0 || !isHexDigit(c)) {
        throw this.syntaxErr(`incomplete ${label} escape`);
      }
      value = value << 4 | hexValue(c);
      this.advance();
    }
    return value;
  }
  parseRawString() {
    this.advance();
    let hashCount = 0;
    while (this.current() === "#") {
      hashCount++;
      this.advance();
    }
    if (this.current() !== '"') {
      throw this.syntaxErr("expected opening quote after r and # symbols in raw string");
    }
    this.advance();
    const start = this.pos;
    const closing = '"' + "#".repeat(hashCount);
    const idx = this.input.indexOf(closing, this.pos);
    if (idx === -1) {
      while (this.pos < this.length)
        this.advance();
      throw this.syntaxErr(`unterminated raw string (expected closing ${closing})`);
    }
    const value = this.input.slice(start, idx);
    const targetPos = idx + closing.length;
    while (this.pos < targetPos) {
      this.advance();
    }
    return { value, hashCount };
  }
  // ------------------------------------------------------------------------
  // Numbers
  // ------------------------------------------------------------------------
  parseNumber() {
    const negative = this.current() === "-";
    if (negative) {
      this.advance();
    }
    let radix = null;
    if (this.current() === "0") {
      const next2 = this.peek(1);
      if (next2 === "x")
        radix = 16;
      else if (next2 === "o")
        radix = 8;
      else if (next2 === "b")
        radix = 2;
      else if (next2 === "X" || next2 === "O" || next2 === "B") {
        throw this.syntaxErr(`uppercase radix prefix 0${next2} not allowed; use lowercase`);
      }
    }
    let literal;
    let isFloat = false;
    if (radix !== null) {
      this.advance();
      this.advance();
      literal = this.scanRadixDigits(radix);
    } else {
      const intPart = this.scanDecDigits();
      literal = intPart;
      if (this.current() === ".") {
        isFloat = true;
        literal += ".";
        this.advance();
        literal += this.scanDecDigits();
      }
      const c = this.current();
      if (c === "e" || c === "E") {
        isFloat = true;
        literal += "e";
        this.advance();
        const sign = this.current();
        if (sign === "+" || sign === "-") {
          literal += sign;
          this.advance();
        }
        literal += this.scanDecDigits();
      }
    }
    const cur = this.current();
    const next = this.peek(1);
    if ((cur === "u" || cur === "i" || cur === "f") && next !== void 0 && isAsciiAlphanumeric(next)) {
      throw this.syntaxErr(`number type suffix not allowed (saw '${cur}${next}')`);
    }
    const signed = negative ? "-" + literal : literal;
    if (radix !== null) {
      return parseRadixLiteral(signed, radix);
    }
    if (!isFloat) {
      if (Number.isSafeInteger(Number(signed))) {
        return Number(signed);
      }
    }
    const f = Number(signed);
    if (Number.isNaN(f)) {
      throw this.syntaxErr(`could not parse number: ${signed}`);
    }
    return f;
  }
  /** Scan decimal digits with Rust-style underscore separators. */
  scanDecDigits() {
    let s = "";
    let lastWasUnder = false;
    let hasDigit = false;
    while (this.pos < this.length) {
      const c = this.input[this.pos];
      if (isDigit(c)) {
        s += c;
        lastWasUnder = false;
        hasDigit = true;
        this.advance();
      } else if (c === "_") {
        if (!hasDigit || lastWasUnder) {
          throw this.syntaxErr("invalid underscore placement in number");
        }
        lastWasUnder = true;
        this.advance();
      } else {
        break;
      }
    }
    if (!hasDigit) {
      throw this.syntaxErr("number requires at least one digit");
    }
    if (lastWasUnder) {
      throw this.syntaxErr("number cannot end with underscore");
    }
    return s;
  }
  scanRadixDigits(radix) {
    let s = "";
    let lastWasUnder = false;
    let hasDigit = false;
    while (this.pos < this.length) {
      const c = this.input[this.pos];
      const ok = radix === 16 ? isHexDigit(c) : radix === 8 ? c >= "0" && c <= "7" : c === "0" || c === "1";
      if (ok) {
        s += c;
        lastWasUnder = false;
        hasDigit = true;
        this.advance();
      } else if (c === "_") {
        if (!hasDigit || lastWasUnder) {
          throw this.syntaxErr("invalid underscore placement in number");
        }
        lastWasUnder = true;
        this.advance();
      } else {
        break;
      }
    }
    if (!hasDigit) {
      throw this.syntaxErr("number requires at least one digit after radix prefix");
    }
    if (lastWasUnder) {
      throw this.syntaxErr("number cannot end with underscore");
    }
    return s;
  }
  // ------------------------------------------------------------------------
  // Booleans / null
  // ------------------------------------------------------------------------
  parseBoolean() {
    if (this.input.substr(this.pos, 4) === "true") {
      for (let i = 0; i < 4; i++)
        this.advance();
      return true;
    }
    if (this.input.substr(this.pos, 5) === "false") {
      for (let i = 0; i < 5; i++)
        this.advance();
      return false;
    }
    throw this.syntaxErr("invalid boolean value");
  }
  parseNull() {
    if (this.input.substr(this.pos, 4) === "null") {
      for (let i = 0; i < 4; i++)
        this.advance();
      return null;
    }
    throw this.syntaxErr("invalid null value");
  }
  // ------------------------------------------------------------------------
  // Keys
  // ------------------------------------------------------------------------
  parseKey() {
    this.skipWsAndComments();
    const start = this.here();
    const c = this.current();
    if (c === '"' || c === "'") {
      const { value: value2, rawKind } = this.parseString(c);
      const end2 = this.here();
      return {
        key: {
          kind: "key",
          quoted: true,
          quoteChar: c,
          value: value2,
          range: { start, end: end2 },
          leadingComments: [],
          trailingComments: []
        },
        end: end2
      };
    }
    const bodyStart = this.pos;
    while (this.pos < this.length) {
      const ch = this.input[this.pos];
      if (isKeyDelimiter(ch))
        break;
      this.advance();
    }
    if (this.pos === bodyStart) {
      throw this.syntaxErr("empty key");
    }
    const value = this.input.slice(bodyStart, this.pos);
    const end = this.here();
    return {
      key: {
        kind: "key",
        quoted: false,
        value,
        range: { start, end },
        leadingComments: [],
        trailingComments: []
      },
      end
    };
  }
  // ------------------------------------------------------------------------
  // Values
  // ------------------------------------------------------------------------
  parseValue() {
    this.skipWsAndComments();
    const start = this.here();
    const c = this.current();
    if (c === void 0) {
      throw this.syntaxErr("expected value");
    }
    if (c === '"' || c === "'") {
      const { value, rawKind } = this.parseString(c);
      return {
        kind: "string",
        value,
        rawKind,
        range: this.rangeFrom(start),
        leadingComments: [],
        trailingComments: []
      };
    }
    if (c === "r" || c === "R") {
      const next = this.peek(1);
      if (next === '"' || next === "#") {
        const { value, hashCount } = this.parseRawString();
        return {
          kind: "string",
          value,
          rawKind: "raw",
          rawHashCount: hashCount,
          range: this.rangeFrom(start),
          leadingComments: [],
          trailingComments: []
        };
      }
      throw this.syntaxErr(`unexpected character in value: ${c}`);
    }
    if (c === "[") {
      return this.parseArray();
    }
    if (c === "{") {
      return this.parseNestedObject();
    }
    if (isDigit(c) || c === "-") {
      const value = this.parseNumber();
      return {
        kind: "number",
        value,
        range: this.rangeFrom(start),
        leadingComments: [],
        trailingComments: []
      };
    }
    if (c === "t" || c === "f") {
      const value = this.parseBoolean();
      return {
        kind: "boolean",
        value,
        range: this.rangeFrom(start),
        leadingComments: [],
        trailingComments: []
      };
    }
    if (c === "n") {
      this.parseNull();
      return {
        kind: "null",
        range: this.rangeFrom(start),
        leadingComments: [],
        trailingComments: []
      };
    }
    throw this.syntaxErr(`unexpected character in value: ${c}`);
  }
  parseArray() {
    const start = this.here();
    this.advance();
    const elements = [];
    this.skipWsAndComments();
    for (; ; ) {
      const c = this.current();
      if (c === "]") {
        this.advance();
        return {
          kind: "array",
          elements,
          innerComments: [],
          range: this.rangeFrom(start),
          leadingComments: [],
          trailingComments: []
        };
      }
      if (c === void 0) {
        throw this.syntaxErr("unterminated array");
      }
      elements.push(this.parseValue());
      const { sawNewline, sawComma } = this.skipInterItemSeparator();
      if (this.current() === "]") {
        this.advance();
        return {
          kind: "array",
          elements,
          innerComments: [],
          range: this.rangeFrom(start),
          leadingComments: [],
          trailingComments: []
        };
      }
      if (this.current() === void 0) {
        throw this.syntaxErr("unterminated array");
      }
      if (!sawNewline && !sawComma) {
        throw this.syntaxErr("items on the same line must be separated by a comma");
      }
    }
  }
  parseNestedObject() {
    const start = this.here();
    this.advance();
    const properties = [];
    const seenKeys = /* @__PURE__ */ new Set();
    this.skipWsAndComments();
    for (; ; ) {
      const c = this.current();
      if (c === "}") {
        this.advance();
        return {
          kind: "object",
          properties,
          wrapped: true,
          innerComments: [],
          range: this.rangeFrom(start),
          leadingComments: [],
          trailingComments: []
        };
      }
      if (c === void 0) {
        throw this.syntaxErr("unterminated nested object");
      }
      const property = this.parseProperty(seenKeys);
      properties.push(property);
      const { sawNewline, sawComma } = this.skipInterItemSeparator();
      if (this.current() === "}") {
        this.advance();
        return {
          kind: "object",
          properties,
          wrapped: true,
          innerComments: [],
          range: this.rangeFrom(start),
          leadingComments: [],
          trailingComments: []
        };
      }
      if (this.current() === void 0) {
        throw this.syntaxErr("unterminated nested object");
      }
      if (!sawNewline && !sawComma) {
        throw this.syntaxErr("items on the same line must be separated by a comma");
      }
    }
  }
  parseProperty(seenKeys) {
    const start = this.here();
    const { key } = this.parseKey();
    this.skipWsAndComments();
    if (this.current() !== "=") {
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
        kind: "duplicate-key",
        line: this.line,
        column: this.column,
        position: this.pos,
        duplicateKey: key.value
      });
    }
    seenKeys.add(key.value);
    return {
      kind: "property",
      key,
      equalsRange,
      value,
      range: this.rangeFrom(start),
      leadingComments: [],
      trailingComments: []
    };
  }
  /** Bare top-level object form (no surrounding braces). */
  parseJhonObject() {
    const start = this.here();
    const properties = [];
    const seenKeys = /* @__PURE__ */ new Set();
    this.skipWsAndComments();
    while (this.pos < this.length) {
      const property = this.parseProperty(seenKeys);
      properties.push(property);
      const { sawNewline, sawComma } = this.skipInterItemSeparator();
      if (this.pos >= this.length) {
        break;
      }
      if (!sawNewline && !sawComma) {
        throw this.syntaxErr("items on the same line must be separated by a comma");
      }
    }
    return {
      kind: "object",
      properties,
      wrapped: false,
      innerComments: [],
      range: this.rangeFrom(start),
      leadingComments: [],
      trailingComments: []
    };
  }
  // ------------------------------------------------------------------------
  // Document finalization
  // ------------------------------------------------------------------------
  buildEmptyDocument() {
    const start = this.here();
    const empty = {
      kind: "object",
      properties: [],
      wrapped: false,
      innerComments: [],
      range: { start, end: start },
      leadingComments: [],
      trailingComments: []
    };
    return {
      kind: "document",
      body: empty,
      range: { start, end: this.here() },
      leadingComments: [],
      trailingComments: []
    };
  }
  finalizeDocument(body) {
    return {
      kind: "document",
      body,
      range: { start: { offset: 0, line: 1, column: 1 }, end: this.here() },
      leadingComments: [],
      trailingComments: []
    };
  }
};
function parseRadixLiteral(signed, radix) {
  const negative = signed.startsWith("-");
  const digits = negative ? signed.slice(1) : signed;
  const value = parseInt(digits, radix);
  if (Number.isNaN(value)) {
    throw new JhonParseError({
      message: `could not parse number: ${signed}`,
      kind: "syntax",
      line: 0,
      column: 0,
      position: -1
    });
  }
  return negative ? -value : value;
}
function parseAst(input, options) {
  const parser = new Parser(input, options);
  return parser.parse();
}
function attachComments(doc, rawComments) {
  if (rawComments.length === 0)
    return;
  const comments = [...rawComments].sort((a, b) => a.range.start.offset - b.range.start.offset);
  let idx = 0;
  let lastCodeEnd = null;
  let lastCodeTrailingTarget = null;
  const getLastEnd = () => lastCodeEnd;
  const getLastTarget = () => lastCodeTrailingTarget;
  function takeLeadingFor(target, rangeStart) {
    while (idx < comments.length) {
      const c = comments[idx];
      if (c.range.end.offset > rangeStart.offset)
        break;
      if (lastCodeEnd !== null && lastCodeTrailingTarget !== null && c.range.start.line === lastCodeEnd.line) {
        lastCodeTrailingTarget.trailingComments.push(c);
      } else {
        target.leadingComments.push(c);
      }
      idx++;
    }
  }
  function takeInnerFor(container, containerEnd) {
    while (idx < comments.length) {
      const c = comments[idx];
      if (c.range.start.offset >= containerEnd.offset)
        break;
      if (lastCodeEnd !== null && lastCodeTrailingTarget !== null && c.range.start.line === lastCodeEnd.line) {
        lastCodeTrailingTarget.trailingComments.push(c);
      } else if (container.innerComments) {
        container.innerComments.push(c);
      }
      idx++;
    }
  }
  function visit(node) {
    takeLeadingFor(node, node.range.start);
    if (node.kind !== "document") {
      lastCodeEnd = node.range.start;
      lastCodeTrailingTarget = null;
    }
    switch (node.kind) {
      case "document": {
        const doc2 = node;
        visit(doc2.body);
        break;
      }
      case "object": {
        const obj = node;
        for (const child of obj.properties) {
          visit(child);
        }
        takeInnerFor(obj, obj.range.end);
        break;
      }
      case "array": {
        const arr = node;
        for (const child of arr.elements) {
          visit(child);
        }
        takeInnerFor(arr, arr.range.end);
        break;
      }
      case "property": {
        const prop = node;
        visit(prop.key);
        visit(prop.value);
        break;
      }
    }
    lastCodeEnd = node.range.end;
    lastCodeTrailingTarget = node;
  }
  visit(doc);
  while (idx < comments.length) {
    const c = comments[idx];
    const end = getLastEnd();
    const target = getLastTarget();
    if (end !== null && target !== null && c.range.start.line === end.line) {
      target.trailingComments.push(c);
    } else {
      doc.trailingComments.push(c);
    }
    idx++;
  }
}

// ../typescript/dist/serializer.helpers.js
var KEY_DELIMITERS2 = /* @__PURE__ */ new Set([
  " ",
  "	",
  "\n",
  "\r",
  "=",
  ",",
  "{",
  "}",
  "[",
  "]",
  "/",
  '"',
  "'",
  "#"
]);
function needsQuoting(s) {
  if (s === "")
    return true;
  for (const c of s) {
    if (KEY_DELIMITERS2.has(c))
      return true;
  }
  return false;
}
var HEX_DIGITS = "0123456789abcdef";
function escapeString(s) {
  let out = "";
  for (const c of s) {
    const code = c.charCodeAt(0);
    switch (c) {
      case "\\":
        out += "\\\\";
        break;
      case '"':
        out += '\\"';
        break;
      case "\n":
        out += "\\n";
        break;
      case "\r":
        out += "\\r";
        break;
      case "	":
        out += "\\t";
        break;
      case "\b":
        out += "\\b";
        break;
      case "\f":
        out += "\\f";
        break;
      default:
        if (code < 32) {
          out += "\\u00" + HEX_DIGITS[code >> 4 & 15] + HEX_DIGITS[code & 15];
        } else {
          out += c;
        }
    }
  }
  return out;
}
function serializeNumber(n) {
  if (Number.isFinite(n) && Math.trunc(n) === n && Math.abs(n) < Number.MAX_SAFE_INTEGER + 1) {
    return n.toString();
  }
  return n.toString();
}
function serializeKey(key) {
  return needsQuoting(key) ? '"' + escapeString(key) + '"' : key;
}

// ../typescript/dist/serializer.js
function serializeAstCompact(doc, options) {
  const ctx = { sortKeys: options?.sortKeys ?? false, out: "" };
  emitCompactDocument(doc, ctx);
  return ctx.out;
}
function serializeAstPretty(doc, options) {
  const indent = options?.indent ?? "  ";
  const ctx = {
    indent,
    sortKeys: options?.sortKeys ?? false,
    out: ""
  };
  emitPrettyDocument(doc, ctx);
  return ctx.out;
}
function emitCompactDocument(doc, ctx) {
  for (const c of doc.leadingComments)
    emitCompactLeadingComment(c, ctx);
  emitCompactValue(doc.body, ctx, { isTopLevel: true, inArray: false });
  for (const c of doc.trailingComments) {
    ctx.out += " ";
    emitCompactInlineComment(c, ctx);
  }
}
function emitCompactValue(node, ctx, pos) {
  for (const c of node.leadingComments) {
    emitCompactInlineComment(c, ctx);
    ctx.out += " ";
  }
  switch (node.kind) {
    case "object":
      emitCompactObject(node, ctx, pos);
      break;
    case "array":
      emitCompactArray(node, ctx);
      break;
    case "string":
      emitCompactString(node, ctx);
      break;
    case "number":
      ctx.out += serializeNumber(node.value);
      break;
    case "boolean":
      ctx.out += node.value ? "true" : "false";
      break;
    case "null":
      ctx.out += "null";
      break;
  }
  for (const c of node.trailingComments) {
    ctx.out += " ";
    emitCompactInlineComment(c, ctx);
  }
}
function emitCompactObject(obj, ctx, pos) {
  const props = ctx.sortKeys ? [...obj.properties].sort((a, b) => a.key.value.localeCompare(b.key.value)) : obj.properties;
  if (props.length === 0) {
    if (pos.isTopLevel && !pos.inArray) {
    } else {
      ctx.out += "{}";
    }
    return;
  }
  const needsBraces = !pos.isTopLevel || pos.inArray;
  if (needsBraces)
    ctx.out += "{";
  let first = true;
  for (const prop of props) {
    if (!first)
      ctx.out += ",";
    first = false;
    emitCompactProperty(prop, ctx);
  }
  if (needsBraces)
    ctx.out += "}";
}
function emitCompactProperty(prop, ctx) {
  ctx.out += serializeKey(prop.key.value);
  ctx.out += "=";
  emitCompactValue(prop.value, ctx, { isTopLevel: false, inArray: false });
  for (const c of prop.trailingComments) {
    ctx.out += " ";
    emitCompactInlineComment(c, ctx);
  }
}
function emitCompactArray(arr, ctx) {
  if (arr.elements.length === 0) {
    ctx.out += "[]";
    return;
  }
  ctx.out += "[";
  let first = true;
  for (const el of arr.elements) {
    if (!first)
      ctx.out += ",";
    first = false;
    emitCompactValue(el, ctx, { isTopLevel: false, inArray: true });
  }
  ctx.out += "]";
}
function emitCompactString(s, ctx) {
  if (s.rawKind === "raw") {
    ctx.out += "r" + "#".repeat(s.rawHashCount ?? 0);
    ctx.out += '"' + s.value + '"';
    ctx.out += "#".repeat(s.rawHashCount ?? 0);
    return;
  }
  ctx.out += '"' + escapeString(s.value) + '"';
}
function emitCompactLeadingComment(c, ctx) {
  emitCompactInlineComment(c, ctx);
}
function emitCompactInlineComment(c, ctx) {
  if (c.kind === "line") {
    const body = c.text.replace(/\*/g, "* /");
    ctx.out += `/*${body}*/`;
  } else {
    const body = c.text.replace(/\*\//g, "* /");
    ctx.out += `/*${body}*/`;
  }
}
function indentStr(ctx, depth) {
  return ctx.indent.repeat(depth);
}
function emitPrettyDocument(doc, ctx) {
  emitLeadingComments(doc.leadingComments, ctx, 0);
  emitLeadingComments(doc.body.leadingComments, ctx, 0);
  const body = doc.body;
  if (body.kind === "object") {
    emitPrettyObject(body, ctx, 0, false);
  } else {
    emitPrettyArray(body, ctx, 0);
  }
  if (doc.body.trailingComments.length > 0) {
    ctx.out += "\n";
    for (const c of doc.body.trailingComments) {
      ctx.out += prettyCommentLine(c) + "\n";
    }
  }
  if (doc.trailingComments.length > 0) {
    if (!ctx.out.endsWith("\n"))
      ctx.out += "\n";
    for (const c of doc.trailingComments) {
      ctx.out += prettyCommentLine(c) + "\n";
    }
    ctx.out = ctx.out.slice(0, -1);
  }
}
function emitPrettyValue(node, ctx, depth, inArray) {
  switch (node.kind) {
    case "object":
      emitPrettyObject(node, ctx, depth, inArray);
      break;
    case "array":
      emitPrettyArray(node, ctx, depth);
      break;
    case "string":
      ctx.out += prettyString(node);
      break;
    case "number":
      ctx.out += serializeNumber(node.value);
      break;
    case "boolean":
      ctx.out += node.value ? "true" : "false";
      break;
    case "null":
      ctx.out += "null";
      break;
  }
}
function emitPrettyObject(obj, ctx, depth, inArray) {
  const props = ctx.sortKeys ? [...obj.properties].sort((a, b) => a.key.value.localeCompare(b.key.value)) : obj.properties;
  if (props.length === 0) {
    if (depth === 0 && !inArray) {
      return;
    }
    if (obj.innerComments.length > 0) {
      if (inArray) {
        ctx.out += indentStr(ctx, depth + 1);
      } else {
        ctx.out += "{";
      }
      if (inArray)
        ctx.out += "{";
      ctx.out += "\n";
      for (const c of obj.innerComments) {
        ctx.out += indentStr(ctx, depth + (inArray ? 2 : 1));
        emitPrettyLineComment(c, ctx);
        ctx.out += "\n";
      }
      ctx.out += indentStr(ctx, depth + (inArray ? 1 : 0));
      ctx.out += "}";
    } else {
      ctx.out += "{}";
    }
    return;
  }
  if (inArray) {
    ctx.out += indentStr(ctx, depth + 1) + "{\n";
  } else if (depth > 0) {
    ctx.out += "{\n";
  }
  let first = true;
  for (const prop of props) {
    if (!first)
      ctx.out += "\n";
    first = false;
    const innerDepth = inArray ? depth + 2 : depth === 0 ? 0 : depth;
    ctx.out += indentStr(ctx, innerDepth);
    emitLeadingComments(prop.leadingComments, ctx, innerDepth);
    emitLeadingComments(prop.key.leadingComments, ctx, innerDepth);
    ctx.out += serializeKey(prop.key.value);
    emitInlineTrailingComments(prop.key.trailingComments, ctx);
    ctx.out += " = ";
    if (prop.value.leadingComments.length > 0) {
      ctx.out = ctx.out.slice(0, -3);
      ctx.out += "= ";
      emitInlineLeadingBeforeValue(prop.value.leadingComments, ctx);
    }
    emitPrettyValue(prop.value, ctx, depth + 1, false);
    emitInlineTrailingComments(prop.value.trailingComments, ctx);
    emitInlineTrailingComments(prop.trailingComments, ctx);
  }
  for (const c of obj.innerComments) {
    ctx.out += "\n";
    const innerDepth = inArray ? depth + 2 : depth === 0 ? 0 : depth;
    ctx.out += indentStr(ctx, innerDepth);
    emitPrettyLineComment(c, ctx);
  }
  if (inArray) {
    ctx.out += "\n" + indentStr(ctx, depth + 1) + "}";
  } else if (depth > 0) {
    ctx.out += "\n" + indentStr(ctx, depth - 1) + "}";
  }
}
function emitPrettyArray(arr, ctx, depth) {
  if (arr.elements.length === 0) {
    if (arr.innerComments.length > 0) {
      ctx.out += "[\n";
      for (const c of arr.innerComments) {
        ctx.out += indentStr(ctx, depth + 1);
        emitPrettyLineComment(c, ctx);
        ctx.out += "\n";
      }
      ctx.out += indentStr(ctx, depth) + "]";
    } else {
      ctx.out += "[]";
    }
    return;
  }
  ctx.out += "[\n";
  let first = true;
  for (const el of arr.elements) {
    if (!first)
      ctx.out += "\n";
    first = false;
    emitLeadingComments(el.leadingComments, ctx, depth + 1);
    if (el.kind === "object") {
      emitPrettyObject(el, ctx, depth, true);
    } else {
      ctx.out += indentStr(ctx, depth + 1);
      emitPrettyValue(el, ctx, depth + 1, false);
    }
    emitInlineTrailingComments(el.trailingComments, ctx);
  }
  for (const c of arr.innerComments) {
    ctx.out += "\n";
    ctx.out += indentStr(ctx, depth + 1);
    emitPrettyLineComment(c, ctx);
  }
  ctx.out += "\n" + indentStr(ctx, depth) + "]";
}
function prettyString(s) {
  if (s.rawKind === "raw") {
    return "r" + "#".repeat(s.rawHashCount ?? 0) + '"' + s.value + '"' + "#".repeat(s.rawHashCount ?? 0);
  }
  return '"' + escapeString(s.value) + '"';
}
function emitLeadingComments(comments, ctx, depth) {
  if (comments.length === 0)
    return;
  for (const c of comments) {
    ctx.out += prettyCommentLine(c);
    ctx.out += "\n" + indentStr(ctx, depth);
  }
}
function emitInlineTrailingComments(comments, ctx) {
  for (const c of comments) {
    ctx.out += " ";
    ctx.out += prettyCommentLine(c);
  }
}
function emitInlineLeadingBeforeValue(comments, ctx) {
  for (const c of comments) {
    if (c.kind === "block") {
      ctx.out += "/* " + c.text.trim() + " */ ";
    }
  }
}
function emitPrettyLineComment(c, ctx) {
  ctx.out += prettyCommentLine(c);
}
function prettyCommentLine(c) {
  if (c.kind === "line") {
    return "//" + c.text;
  }
  return "/*" + c.text + "*/";
}

// src/extension.ts
var DEFAULT_DEBOUNCE_MS = 300;
function activate(context) {
  const diagnostics = vscode.languages.createDiagnosticCollection("jhon");
  context.subscriptions.push(diagnostics);
  let timer;
  const scheduleReparse = (doc) => {
    const cfg = vscode.workspace.getConfiguration("jhon.diagnostics");
    if (!cfg.get("enable", true)) {
      diagnostics.set(doc.uri, []);
      return;
    }
    const delay = cfg.get("debounceMs", DEFAULT_DEBOUNCE_MS);
    clearTimeout(timer);
    timer = setTimeout(() => updateDiagnostics(diagnostics, doc), delay);
  };
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId !== "jhon") return;
      scheduleReparse(e.document);
    }),
    vscode.workspace.onDidOpenTextDocument((d) => {
      if (d.languageId === "jhon") updateDiagnostics(diagnostics, d);
    }),
    vscode.workspace.onDidSaveTextDocument((d) => {
      if (d.languageId === "jhon") updateDiagnostics(diagnostics, d);
    }),
    vscode.workspace.onDidCloseTextDocument((d) => {
      if (d.languageId === "jhon") diagnostics.set(d.uri, []);
    })
  );
  for (const doc of vscode.workspace.textDocuments) {
    if (doc.languageId === "jhon") updateDiagnostics(diagnostics, doc);
  }
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider("jhon", {
      provideDocumentFormattingEdits(doc) {
        const cfg = vscode.workspace.getConfiguration("jhon.format");
        if (!cfg.get("enable", true)) return [];
        try {
          const ast = parseAst(doc.getText());
          const out = serializeAstPretty(ast, readPrettyOptions());
          const full = new vscode.Range(
            doc.positionAt(0),
            doc.positionAt(doc.getText().length)
          );
          return [vscode.TextEdit.replace(full, out)];
        } catch {
          return [];
        }
      }
    }),
    vscode.languages.registerDocumentRangeFormattingEditProvider("jhon", {
      provideDocumentRangeFormattingEdits(doc, range) {
        const cfg = vscode.workspace.getConfiguration("jhon.format");
        if (!cfg.get("enable", true)) return [];
        try {
          const ast = parseAst(doc.getText());
          const formatted = serializeAstPretty(ast, readPrettyOptions());
          const lines = formatted.split("\n");
          const startLine = range.start.line;
          const endLine = range.end.line;
          const replaceRange = new vscode.Range(
            startLine,
            0,
            endLine,
            doc.lineAt(endLine).text.length
          );
          return [
            vscode.TextEdit.replace(
              replaceRange,
              lines.slice(startLine, endLine + 1).join("\n")
            )
          ];
        } catch {
          return [];
        }
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("jhon.formatCompact", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "jhon") return;
      try {
        const ast = parseAst(editor.document.getText());
        const compact = serializeAstCompact(ast, readCompactOptions());
        const full = new vscode.Range(
          editor.document.positionAt(0),
          editor.document.positionAt(editor.document.getText().length)
        );
        void editor.edit((b) => b.replace(full, compact));
      } catch {
      }
    })
  );
}
function deactivate() {
}
function updateDiagnostics(collection, doc) {
  let err;
  try {
    parseAst(doc.getText());
    collection.set(doc.uri, []);
    return;
  } catch (e) {
    err = e;
  }
  if (!(err instanceof JhonParseError)) {
    collection.set(doc.uri, []);
    return;
  }
  const start = new vscode.Position(
    Math.max(0, err.line - 1),
    Math.max(0, err.column - 1)
  );
  const end = new vscode.Position(
    Math.max(0, err.endLine - 1),
    Math.max(0, err.endColumn - 1)
  );
  const range = new vscode.Range(start, end);
  const diag = new vscode.Diagnostic(
    range,
    err.message,
    vscode.DiagnosticSeverity.Error
  );
  diag.source = "jhon";
  if (err.kind === "duplicate-key") {
    diag.code = "duplicate-key";
  }
  collection.set(doc.uri, [diag]);
}
function readPrettyOptions() {
  const cfg = vscode.workspace.getConfiguration("jhon.format");
  const insertSpaces = cfg.get("insertSpaces", false);
  const tabSize = cfg.get("tabSize", 2);
  return {
    indent: insertSpaces ? " ".repeat(tabSize) : "	",
    sortKeys: cfg.get("sortKeys", false)
  };
}
function readCompactOptions() {
  const cfg = vscode.workspace.getConfiguration("jhon.format");
  return { sortKeys: cfg.get("sortKeys", false) };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
