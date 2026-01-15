/**
 * JHON - JinHui's Object Notation
 * OPTIMIZED VERSION - Performance improvements for parsing
 */
export type JhonValue = string | number | boolean | null | JhonObject | JhonArray;
export interface JhonObject {
    [key: string]: JhonValue;
}
export type JhonArray = JhonValue[];
export interface ParseOptions {
    allowTrailingCommas?: boolean;
}
export interface SerializeOptions {
    sortKeys?: boolean;
}
export interface SerializePrettyOptions extends SerializeOptions {
    indent?: string;
}
export declare class JhonParseError extends Error {
    position?: number | undefined;
    constructor(message: string, position?: number | undefined);
}
/**
 * Parse a JHON config string into a JavaScript object (OPTIMIZED VERSION)
 */
export declare function parse(input: string, options?: ParseOptions): JhonObject;
export declare function serialize(value: JhonValue, options?: SerializeOptions): string;
export declare function serializePretty(value: JhonValue, options?: SerializePrettyOptions): string;
declare const _default: {
    parse: typeof parse;
    serialize: typeof serialize;
    serializePretty: typeof serializePretty;
    JhonParseError: typeof JhonParseError;
};
export default _default;
//# sourceMappingURL=index-optimized.d.ts.map