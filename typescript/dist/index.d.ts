/**
 * JHON - JinHui's Object Notation
 *
 * A configuration language parser and serializer. Spec: SPEC.md in the
 * repository root. The Rust impl is the canonical reference; this package
 * mirrors its behavior.
 */
import { JhonParseError } from './errors';
import { Parser, parseAst } from './parser';
import { serialize, serializeAstCompact, serializeAstPretty, serializePretty } from './serializer';
import { astToValue, synthesizeAst } from './serializer.helpers';
import type { AstArray, AstBoolean, AstDocument, AstKey, AstNull, AstNumber, AstObject, AstProperty, AstString, AstValue, CommentToken, JhonArray, JhonObject, JhonValue, ParseOptions, SerializeOptions, SerializePrettyOptions, SourcePos, SourceRange } from './types';
declare function parse(input: string, options?: ParseOptions): JhonObject;
export { JhonParseError, Parser, astToValue, parse, parseAst, serialize, serializeAstCompact, serializeAstPretty, serializePretty, synthesizeAst, };
export type { AstArray, AstBoolean, AstDocument, AstKey, AstNull, AstNumber, AstObject, AstProperty, AstString, AstValue, CommentToken, JhonArray, JhonObject, JhonValue, ParseOptions, SerializeOptions, SerializePrettyOptions, SourcePos, SourceRange, };
declare const _default: {
    JhonParseError: typeof JhonParseError;
    parse: typeof parse;
    parseAst: typeof parseAst;
    serialize: typeof serialize;
    serializeAstCompact: typeof serializeAstCompact;
    serializeAstPretty: typeof serializeAstPretty;
    serializePretty: typeof serializePretty;
};
export default _default;
//# sourceMappingURL=index.d.ts.map