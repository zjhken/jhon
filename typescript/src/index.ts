/**
 * JHON - JinHui's Object Notation
 *
 * A configuration language parser and serializer. Spec: SPEC.md in the
 * repository root. The Rust impl is the canonical reference; this package
 * mirrors its behavior.
 */

import { JhonParseError } from './errors';
import { Parser, parseAst } from './parser';
import {
  serialize,
  serializeAstCompact,
  serializeAstPretty,
  serializePretty,
} from './serializer';
import { astToValue, synthesizeAst } from './serializer.helpers';
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
  JhonArray,
  JhonObject,
  JhonValue,
  ParseOptions,
  SerializeOptions,
  SerializePrettyOptions,
  SourcePos,
  SourceRange,
} from './types';

// Re-export the simple-API parse function (operates on plain JS values).
// Per SPEC §2, the result can be an object, an array (top-level bare values),
// or null (empty/whitespace-only/comments-only input).
function parse(input: string, options?: ParseOptions): JhonValue {
  const doc = parseAst(input, options);
  return astToValue(doc);
}

export {
  JhonParseError,
  Parser,
  astToValue,
  parse,
  parseAst,
  serialize,
  serializeAstCompact,
  serializeAstPretty,
  serializePretty,
  synthesizeAst,
};

export type {
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
  JhonArray,
  JhonObject,
  JhonValue,
  ParseOptions,
  SerializeOptions,
  SerializePrettyOptions,
  SourcePos,
  SourceRange,
};

export default {
  JhonParseError,
  parse,
  parseAst,
  serialize,
  serializeAstCompact,
  serializeAstPretty,
  serializePretty,
};
