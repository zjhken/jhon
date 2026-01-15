/**
 * JHON - JSON-like Human Optimized Notation
 * A configuration language parser and serializer
 */
export type JhonValue = string | number | boolean | null | JhonObject | JhonArray;
export interface JhonObject {
    [key: string]: JhonValue;
}
export type JhonArray = JhonValue[];
export interface ParseOptions {
    /**
     * Allow trailing commas in arrays and objects
     * @default true
     */
    allowTrailingCommas?: boolean;
}
export interface SerializeOptions {
    /**
     * Sort object keys alphabetically
     * @default true
     */
    sortKeys?: boolean;
}
export interface SerializePrettyOptions extends SerializeOptions {
    /**
     * Indentation string (e.g., "  ", "\t", "    ")
     * @default "  "
     */
    indent?: string;
}
export declare class JhonParseError extends Error {
    position?: number | undefined;
    constructor(message: string, position?: number | undefined);
}
/**
 * Parse a JHON config string into a JavaScript object
 *
 * @example
 * ```ts
 * const result = parse('name="John" age=30');
 * // { name: "John", age: 30 }
 * ```
 */
export declare function parse(input: string, options?: ParseOptions): JhonObject;
/**
 * Serialize a JavaScript object into a compact JHON string
 *
 * @example
 * ```ts
 * const value = { name: "John", age: 30 };
 * const jhonString = serialize(value);
 * // 'age=30,name="John"'
 * ```
 */
export declare function serialize(value: JhonValue, options?: SerializeOptions): string;
/**
 * Serialize a JavaScript object into a pretty-printed JHON string
 *
 * @example
 * ```ts
 * const value = { name: "John", age: 30 };
 * const jhonString = serializePretty(value, '  ');
 * // 'age = 30,\nname = "John"'
 * ```
 */
export declare function serializePretty(value: JhonValue, options?: SerializePrettyOptions): string;
declare const _default: {
    parse: typeof parse;
    serialize: typeof serialize;
    serializePretty: typeof serializePretty;
    JhonParseError: typeof JhonParseError;
};
export default _default;
//# sourceMappingURL=index.d.ts.map