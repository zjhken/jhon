import type {
  AstArray,
  AstBoolean,
  AstDocument,
  AstNull,
  AstNumber,
  AstObject,
  AstProperty,
  AstString,
  AstValue,
  JhonArray,
  JhonObject,
  JhonValue,
  SourcePos,
} from './types';

const SYNTHETIC_POS: SourcePos = { offset: -1, line: 0, column: 0 };
const SYNTHETIC_RANGE = { start: SYNTHETIC_POS, end: SYNTHETIC_POS };

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

/** Quote iff the key contains any byte that would terminate a bare key. */
export function needsQuoting(s: string): boolean {
  if (s === '') return true;
  for (const c of s) {
    if (KEY_DELIMITERS.has(c)) return true;
  }
  return false;
}

const HEX_DIGITS = '0123456789abcdef';

/** Escape a string for emission as a double-quoted JHON string body. */
export function escapeString(s: string): string {
  let out = '';
  for (const c of s) {
    const code = c.charCodeAt(0);
    switch (c) {
      case '\\': out += '\\\\'; break;
      case '"': out += '\\"'; break;
      case '\n': out += '\\n'; break;
      case '\r': out += '\\r'; break;
      case '\t': out += '\\t'; break;
      case '\b': out += '\\b'; break;
      case '\f': out += '\\f'; break;
      default:
        if (code < 0x20) {
          out += '\\u00' + HEX_DIGITS[(code >> 4) & 0xf] + HEX_DIGITS[code & 0xf];
        } else {
          out += c;
        }
    }
  }
  return out;
}

/** Serialize a number per Rust's behavior — integers as integers, no exponent form. */
export function serializeNumber(n: number): string {
  if (Number.isFinite(n) && Math.trunc(n) === n && Math.abs(n) < Number.MAX_SAFE_INTEGER + 1) {
    // Integer-valued and within safe range: emit without decimal point.
    return n.toString();
  }
  return n.toString();
}

/** Quote a key, applying quoting rules. */
export function serializeKey(key: string): string {
  return needsQuoting(key) ? '"' + escapeString(key) + '"' : key;
}

/** Build a synthetic AST from a plain JS value (no source positions). */
export function synthesizeAst(value: JhonValue): AstDocument {
  let body: AstValue;
  if (value === null) {
    // Top-level null → Empty form (serializes to empty string).
    body = {
      kind: 'null',
      range: SYNTHETIC_RANGE,
      leadingComments: [],
      trailingComments: [],
    };
  } else if (Array.isArray(value)) {
    body = {
      kind: 'array',
      elements: value.map(synthesizeValue),
      innerComments: [],
      range: SYNTHETIC_RANGE,
      leadingComments: [],
      trailingComments: [],
    };
  } else if (typeof value === 'object') {
    body = synthesizeObject(value, true);
  } else {
    // Scalar top-level — emit directly (round-trips through array mode).
    body = synthesizeValue(value);
  }
  return {
    kind: 'document',
    body,
    range: SYNTHETIC_RANGE,
    leadingComments: [],
    trailingComments: [],
  };
}

/** Project an AST back to a plain JS value. */
export function astToValue(doc: AstDocument): JhonValue {
  return nodeToValue(doc.body);
}

function nodeToValue(node: AstObject | AstArray | AstValue): JhonValue {
  switch (node.kind) {
    case 'string': return node.value;
    case 'number': return node.value;
    case 'boolean': return node.value;
    case 'null': return null;
    case 'array': return node.elements.map(nodeToValue);
    case 'object': {
      const obj: JhonObject = {};
      for (const prop of node.properties) {
        obj[prop.key.value] = nodeToValue(prop.value);
      }
      return obj;
    }
  }
}

function synthesizeObject(value: JhonValue, isTop: boolean): AstObject {
  const obj: JhonObject = value as JhonObject;
  const keys = Object.keys(obj);
  const properties: AstProperty[] = keys.map((k) => {
    const keyNode = {
      kind: 'key' as const,
      quoted: false,
      value: k,
      range: SYNTHETIC_RANGE,
      leadingComments: [],
      trailingComments: [],
    };
    return {
      kind: 'property' as const,
      key: keyNode,
      equalsRange: SYNTHETIC_RANGE,
      value: synthesizeValue(obj[k]),
      range: SYNTHETIC_RANGE,
      leadingComments: [],
      trailingComments: [],
    };
  });
  return {
    kind: 'object',
    properties,
    wrapped: false,
    innerComments: [],
    range: SYNTHETIC_RANGE,
    leadingComments: [],
    trailingComments: [],
  };
}

function synthesizeValue(value: JhonValue): AstValue {
  if (value === null) {
    return { kind: 'null', range: SYNTHETIC_RANGE, leadingComments: [], trailingComments: [] };
  }
  if (typeof value === 'boolean') {
    return { kind: 'boolean', value, range: SYNTHETIC_RANGE, leadingComments: [], trailingComments: [] };
  }
  if (typeof value === 'number') {
    return { kind: 'number', value, range: SYNTHETIC_RANGE, leadingComments: [], trailingComments: [] };
  }
  if (typeof value === 'string') {
    return {
      kind: 'string',
      value,
      rawKind: 'double',
      range: SYNTHETIC_RANGE,
      leadingComments: [],
      trailingComments: [],
    };
  }
  if (Array.isArray(value)) {
    return {
      kind: 'array',
      elements: (value as JhonArray).map(synthesizeValue),
      innerComments: [],
      range: SYNTHETIC_RANGE,
      leadingComments: [],
      trailingComments: [],
    };
  }
  // Object
  return synthesizeObject(value, false);
}
