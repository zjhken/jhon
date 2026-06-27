/**
 * JHON - JinHui's Object Notation
 *
 * A configuration language parser and serializer. Spec: SPEC.md in the
 * repository root. The Rust impl is the canonical reference; this package
 * mirrors its behavior.
 */
import { JhonParseError } from './errors';
import { Parser, parseAst } from './parser';
import { serialize, serializeAstCompact, serializeAstPretty, serializePretty, } from './serializer';
import { astToValue, synthesizeAst } from './serializer.helpers';
// Re-export the simple-API parse function (operates on plain JS objects).
function parse(input, options) {
    const doc = parseAst(input, options);
    const value = astToValue(doc);
    // Top-level arrays are allowed per SPEC §2 but `parse()` is typed to return
    // an object. Callers who need the array case should use `parseAst`.
    if (Array.isArray(value)) {
        throw new JhonParseError({
            message: 'top-level array cannot be returned by parse(); use parseAst()',
            kind: 'syntax',
            line: 1,
            column: 1,
            position: 0,
        });
    }
    return value;
}
export { JhonParseError, Parser, astToValue, parse, parseAst, serialize, serializeAstCompact, serializeAstPretty, serializePretty, synthesizeAst, };
export default {
    JhonParseError,
    parse,
    parseAst,
    serialize,
    serializeAstCompact,
    serializeAstPretty,
    serializePretty,
};
//# sourceMappingURL=index.js.map