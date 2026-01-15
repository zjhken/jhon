/**
 * JHON - JinHui's Object Notation
 * OPTIMIZED VERSION - Performance improvements for parsing
 */
// ============================================================================
// Error Classes
// ============================================================================
export class JhonParseError extends Error {
    position;
    constructor(message, position) {
        super(message);
        this.position = position;
        this.name = 'JhonParseError';
    }
}
// ============================================================================
// Optimized Parser Implementation
// ============================================================================
// Pre-compile regex patterns for better performance
const REGEX_WHITESPACE = /\s/;
const REGEX_UNQUOTED_KEY = /[a-zA-Z0-9_-]/;
const REGEX_DIGIT = /[0-9]/;
class OptimizedParser {
    input;
    pos;
    length;
    constructor(input) {
        this.input = input;
        this.pos = 0;
        this.length = input.length;
    }
    /**
     * Optimized: Remove comments using string operations instead of array conversion
     */
    static removeComments(input) {
        const result = [];
        let i = 0;
        const len = input.length;
        while (i < len) {
            const c = input[i];
            if (c === '/' && i + 1 < len) {
                const nextChar = input[i + 1];
                if (nextChar === '/') {
                    // Single line comment: consume until newline
                    i += 2;
                    while (i < len && input[i] !== '\n') {
                        i++;
                    }
                    continue;
                }
                else if (nextChar === '*') {
                    // Multi-line comment: consume until */
                    i += 2;
                    let foundEnd = false;
                    while (i < len) {
                        if (input[i] === '*' && i + 1 < len && input[i + 1] === '/') {
                            i += 2;
                            foundEnd = true;
                            break;
                        }
                        i++;
                    }
                    if (!foundEnd) {
                        // Unterminated multi-line comment, treat as literal
                        result.push('/*');
                    }
                    continue;
                }
            }
            result.push(c);
            i++;
        }
        return result.join('');
    }
    /**
     * Optimized: Skip separator characters using string indexing
     */
    skipSeparators() {
        while (this.pos < this.length) {
            const c = this.input[this.pos];
            if (c === '\n' || c === ',') {
                this.pos++;
            }
            else {
                break;
            }
        }
    }
    /**
     * Optimized: Skip whitespace using pre-compiled regex and string indexing
     */
    skipWhitespace() {
        while (this.pos < this.length && REGEX_WHITESPACE.test(this.input[this.pos])) {
            this.pos++;
        }
    }
    /**
     * Optimized: Skip spaces and tabs using direct character comparison
     */
    skipSpacesAndTabs() {
        while (this.pos < this.length) {
            const c = this.input[this.pos];
            if (c === ' ' || c === '\t') {
                this.pos++;
            }
            else {
                break;
            }
        }
    }
    /**
     * Optimized: Parse a key using string substring instead of slice/join
     */
    parseKey() {
        this.skipWhitespace();
        if (this.pos >= this.length) {
            throw new JhonParseError('Expected key', this.pos);
        }
        const quoteChar = this.input[this.pos];
        if (quoteChar === '"' || quoteChar === "'") {
            // Quoted key
            this.pos++; // skip opening quote
            const parts = [];
            while (this.pos < this.length) {
                const c = this.input[this.pos];
                if (c === quoteChar) {
                    this.pos++; // skip closing quote
                    return parts.join('');
                }
                else if (c === '\\') {
                    this.pos++;
                    if (this.pos < this.length) {
                        parts.push(this.parseEscapeSequence(quoteChar));
                    }
                }
                else {
                    parts.push(c);
                    this.pos++;
                }
            }
            throw new JhonParseError('Unterminated string in key', this.pos);
        }
        else {
            // Unquoted key - use substring for better performance
            const start = this.pos;
            while (this.pos < this.length &&
                REGEX_UNQUOTED_KEY.test(this.input[this.pos])) {
                this.pos++;
            }
            const key = this.input.substring(start, this.pos);
            if (key === '') {
                throw new JhonParseError('Empty key', this.pos);
            }
            return key;
        }
    }
    /**
     * Parse an escape sequence (unchanged - already efficient)
     */
    parseEscapeSequence(quoteChar) {
        const c = this.input[this.pos];
        this.pos++;
        switch (c) {
            case 'n':
                return '\n';
            case 'r':
                return '\r';
            case 't':
                return '\t';
            case 'b':
                return '\b';
            case 'f':
                return '\f';
            case '\\':
                return '\\';
            case '"':
            case "'":
                return c;
            case 'u': {
                // Unicode escape sequence
                if (this.pos + 3 >= this.length) {
                    throw new JhonParseError('Incomplete Unicode escape sequence', this.pos);
                }
                const hex = this.input.substring(this.pos, this.pos + 4);
                this.pos += 4;
                const codePoint = parseInt(hex, 16);
                if (isNaN(codePoint)) {
                    throw new JhonParseError('Invalid Unicode escape sequence', this.pos);
                }
                return String.fromCharCode(codePoint);
            }
            default:
                // Unknown escape, treat as literal
                return '\\' + c;
        }
    }
    /**
     * Parse a value (unchanged structure, but uses optimized methods)
     */
    parseValue() {
        this.skipWhitespace();
        if (this.pos >= this.length) {
            throw new JhonParseError('Expected value', this.pos);
        }
        const c = this.input[this.pos];
        if (c === '"' || c === "'") {
            return this.parseStringValue();
        }
        else if (c === 'r' || c === 'R') {
            return this.parseRawStringValue();
        }
        else if (c === '[') {
            return this.parseArray();
        }
        else if (c === '{') {
            return this.parseNestedObject();
        }
        else if (/[0-9-]/.test(c)) {
            return this.parseNumber();
        }
        else if (c === 't' || c === 'f') {
            return this.parseBoolean();
        }
        else if (c === 'n') {
            return this.parseNull();
        }
        else {
            throw new JhonParseError(`Unexpected character in value: ${c}`, this.pos);
        }
    }
    /**
     * Optimized: Parse string value using array join instead of concatenation
     */
    parseStringValue() {
        const quoteChar = this.input[this.pos];
        this.pos++; // skip opening quote
        const parts = [];
        while (this.pos < this.length) {
            const c = this.input[this.pos];
            if (c === quoteChar) {
                this.pos++; // skip closing quote
                return parts.join('');
            }
            else if (c === '\\') {
                this.pos++;
                if (this.pos < this.length) {
                    parts.push(this.parseEscapeSequence(quoteChar));
                }
            }
            else {
                parts.push(c);
                this.pos++;
            }
        }
        throw new JhonParseError('Unterminated string', this.pos);
    }
    /**
     * Optimized: Parse raw string using string operations
     */
    parseRawStringValue() {
        if (this.input[this.pos] !== 'r' && this.input[this.pos] !== 'R') {
            throw new JhonParseError('Expected raw string', this.pos);
        }
        this.pos++; // skip 'r' or 'R'
        if (this.pos >= this.length) {
            throw new JhonParseError('Unexpected end of input in raw string', this.pos);
        }
        // Count the number of # symbols
        let hashCount = 0;
        while (this.pos < this.length && this.input[this.pos] === '#') {
            hashCount++;
            this.pos++;
        }
        if (this.pos >= this.length || this.input[this.pos] !== '"') {
            throw new JhonParseError('Expected opening quote after r and # symbols in raw string', this.pos);
        }
        this.pos++; // skip opening quote
        const start = this.pos;
        // Look for the closing sequence: " followed by hashCount # symbols
        while (this.pos < this.length) {
            if (this.input[this.pos] === '"') {
                // Check if there are enough # symbols after the quote
                if (this.pos + hashCount < this.length) {
                    let isClosing = true;
                    for (let j = 1; j <= hashCount; j++) {
                        if (this.input[this.pos + j] !== '#') {
                            isClosing = false;
                            break;
                        }
                    }
                    if (isClosing) {
                        const content = this.input.substring(start, this.pos);
                        this.pos += hashCount + 1;
                        return content;
                    }
                }
            }
            this.pos++;
        }
        throw new JhonParseError(`Unterminated raw string (expected closing: "${'#'.repeat(hashCount)}")`, this.pos);
    }
    /**
     * Parse an array (unchanged - uses optimized methods internally)
     */
    parseArray() {
        if (this.input[this.pos] !== '[') {
            throw new JhonParseError('Expected [', this.pos);
        }
        this.pos++; // skip opening bracket
        const elements = [];
        while (this.pos < this.length) {
            // Skip separators (only newlines and commas)
            this.skipSeparators();
            // Skip leading spaces and tabs before parsing value
            this.skipSpacesAndTabs();
            if (this.pos >= this.length) {
                throw new JhonParseError('Unterminated array', this.pos);
            }
            if (this.input[this.pos] === ']') {
                this.pos++;
                return elements;
            }
            // Parse element
            const element = this.parseValue();
            elements.push(element);
        }
        throw new JhonParseError('Unterminated array', this.pos);
    }
    /**
     * Parse nested object (unchanged - uses optimized methods internally)
     */
    parseNestedObject() {
        if (this.input[this.pos] !== '{') {
            throw new JhonParseError('Expected {', this.pos);
        }
        this.pos++; // skip opening brace
        const obj = {};
        while (this.pos < this.length) {
            // Skip separators (only newlines and commas)
            this.skipSeparators();
            // Skip leading spaces and tabs before parsing key
            this.skipSpacesAndTabs();
            if (this.pos >= this.length) {
                throw new JhonParseError('Unterminated nested object', this.pos);
            }
            if (this.input[this.pos] === '}') {
                this.pos++;
                return obj;
            }
            // Parse key
            const key = this.parseKey();
            // Skip whitespace before =
            this.skipWhitespace();
            // Expect =
            if (this.pos >= this.length || this.input[this.pos] !== '=') {
                throw new JhonParseError("Expected '=' after key in nested object", this.pos);
            }
            this.pos++;
            // Skip whitespace before value
            this.skipWhitespace();
            // Parse value
            const value = this.parseValue();
            // Insert into object
            obj[key] = value;
        }
        throw new JhonParseError('Unterminated nested object', this.pos);
    }
    /**
     * Optimized: Parse number using string substring instead of slice/join
     */
    parseNumber() {
        const start = this.pos;
        // Optional minus sign
        if (this.pos < this.length && this.input[this.pos] === '-') {
            this.pos++;
        }
        // Digits before decimal point (underscores allowed as digit separators)
        let hasDigits = false;
        while (this.pos < this.length && (REGEX_DIGIT.test(this.input[this.pos]) || this.input[this.pos] === '_')) {
            if (this.input[this.pos] !== '_') {
                hasDigits = true;
            }
            this.pos++;
        }
        if (!hasDigits) {
            throw new JhonParseError('Invalid number', this.pos);
        }
        // Optional decimal part
        if (this.pos < this.length && this.input[this.pos] === '.') {
            this.pos++;
            let hasDecimalDigits = false;
            while (this.pos < this.length && (REGEX_DIGIT.test(this.input[this.pos]) || this.input[this.pos] === '_')) {
                if (this.input[this.pos] !== '_') {
                    hasDecimalDigits = true;
                }
                this.pos++;
            }
            if (!hasDecimalDigits) {
                throw new JhonParseError('Invalid decimal number', this.pos);
            }
        }
        // Build number string without underscores using replace instead of filter/join
        const numStr = this.input.substring(start, this.pos).replace(/_/g, '');
        const num = parseFloat(numStr);
        if (isNaN(num)) {
            throw new JhonParseError('Could not parse number', this.pos);
        }
        return num;
    }
    /**
     * Parse boolean (unchanged - already efficient)
     */
    parseBoolean() {
        if (this.pos + 3 < this.length &&
            this.input[this.pos] === 't' &&
            this.input[this.pos + 1] === 'r' &&
            this.input[this.pos + 2] === 'u' &&
            this.input[this.pos + 3] === 'e') {
            this.pos += 4;
            return true;
        }
        else if (this.pos + 4 < this.length &&
            this.input[this.pos] === 'f' &&
            this.input[this.pos + 1] === 'a' &&
            this.input[this.pos + 2] === 'l' &&
            this.input[this.pos + 3] === 's' &&
            this.input[this.pos + 4] === 'e') {
            this.pos += 5;
            return false;
        }
        else {
            throw new JhonParseError('Invalid boolean value', this.pos);
        }
    }
    /**
     * Parse null (unchanged - already efficient)
     */
    parseNull() {
        if (this.pos + 3 < this.length &&
            this.input[this.pos] === 'n' &&
            this.input[this.pos + 1] === 'u' &&
            this.input[this.pos + 2] === 'l' &&
            this.input[this.pos + 3] === 'l') {
            this.pos += 4;
            return null;
        }
        else {
            throw new JhonParseError('Invalid null value', this.pos);
        }
    }
    /**
     * Parse a JHON object (unchanged - uses optimized methods internally)
     */
    parseJhonObject() {
        const obj = {};
        while (this.pos < this.length) {
            // Skip separators (only newlines and commas)
            this.skipSeparators();
            // Skip all remaining spaces and tabs before parsing key
            this.skipSpacesAndTabs();
            if (this.pos >= this.length) {
                break;
            }
            // Parse key
            const key = this.parseKey();
            // Skip whitespace before =
            this.skipWhitespace();
            // Expect =
            if (this.pos >= this.length || this.input[this.pos] !== '=') {
                throw new JhonParseError("Expected '=' after key", this.pos);
            }
            this.pos++;
            // Skip whitespace before value
            this.skipWhitespace();
            // Parse value
            const value = this.parseValue();
            // Insert into object
            obj[key] = value;
            // Skip separators after value (only newlines and commas)
            // Don't advance here - let the loop handle it
        }
        return obj;
    }
}
/**
 * Parse a JHON config string into a JavaScript object (OPTIMIZED VERSION)
 */
export function parse(input, options) {
    const text = OptimizedParser.removeComments(input).trim();
    if (text === '') {
        return {};
    }
    // Handle top-level objects wrapped in braces (from serialize)
    if (text.startsWith('{') && text.endsWith('}')) {
        const parser = new OptimizedParser(text);
        return parser.parseNestedObject();
    }
    const parser = new OptimizedParser(text);
    return parser.parseJhonObject();
}
// ============================================================================
// Serializer (unchanged - not the bottleneck)
// ============================================================================
class Serializer {
    sortKeys;
    constructor(options = {}) {
        this.sortKeys = options.sortKeys ?? true;
    }
    needsQuoting(s) {
        if (s === '') {
            return true;
        }
        for (const c of s) {
            if (!/[a-zA-Z0-9_-]/.test(c)) {
                return true;
            }
        }
        return false;
    }
    serializeKey(key) {
        if (this.needsQuoting(key)) {
            return this.serializeString(key);
        }
        return key;
    }
    serializeString(s) {
        let result = '"';
        for (const c of s) {
            switch (c) {
                case '\\':
                    result += '\\\\';
                    break;
                case '"':
                    result += '\\"';
                    break;
                case '\n':
                    result += '\\n';
                    break;
                case '\r':
                    result += '\\r';
                    break;
                case '\t':
                    result += '\\t';
                    break;
                case '\b':
                    result += '\\b';
                    break;
                case '\f':
                    result += '\\f';
                    break;
                default:
                    if (c < ' ') {
                        result += '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
                    }
                    else {
                        result += c;
                    }
            }
        }
        result += '"';
        return result;
    }
    serializeNumber(n) {
        if (Number.isInteger(n)) {
            return n.toString();
        }
        return n.toString();
    }
    serializeArray(arr) {
        const elements = arr.map((v) => {
            if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                const inner = this.serializeObject(v);
                return inner === '' ? '{}' : `{${inner}}`;
            }
            return this.serialize(v);
        });
        return '[' + elements.join(',') + ']';
    }
    serializeObject(obj) {
        const keys = Object.keys(obj);
        if (this.sortKeys) {
            keys.sort();
        }
        const parts = [];
        for (const key of keys) {
            const serializedKey = this.serializeKey(key);
            const value = obj[key];
            let serializedValue;
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                const inner = this.serializeObject(value);
                serializedValue = inner === '' ? '{}' : `{${inner}}`;
            }
            else {
                serializedValue = this.serialize(value);
            }
            parts.push(`${serializedKey}=${serializedValue}`);
        }
        return parts.join(',');
    }
    serialize(value) {
        if (value === null) {
            return 'null';
        }
        else if (typeof value === 'string') {
            return this.serializeString(value);
        }
        else if (typeof value === 'number') {
            return this.serializeNumber(value);
        }
        else if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        else if (Array.isArray(value)) {
            return this.serializeArray(value);
        }
        else if (typeof value === 'object') {
            return this.serializeObject(value);
        }
        else {
            throw new Error(`Cannot serialize value: ${value}`);
        }
    }
}
export function serialize(value, options) {
    const serializer = new Serializer(options);
    return serializer.serialize(value);
}
// ============================================================================
// Pretty Serializer (unchanged)
// ============================================================================
class PrettySerializer extends Serializer {
    indent;
    constructor(options = {}) {
        super(options);
        this.indent = options.indent ?? '  ';
    }
    getIndent(depth) {
        return this.indent.repeat(depth);
    }
    serializeArrayPretty(arr, depth) {
        if (arr.length === 0) {
            return '[]';
        }
        const outerIndent = depth > 0 ? this.getIndent(depth - 1) : '';
        const elements = [];
        for (const v of arr) {
            if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                const objectDepth = depth > 0 ? depth - 1 : 0;
                elements.push(this.serializePretty(v, objectDepth, true));
            }
            else {
                const elementIndent = depth === 0 ? this.indent : this.getIndent(depth);
                const serialized = this.serializePretty(v, depth + 1, false);
                elements.push(elementIndent + serialized);
            }
        }
        return '[\n' + elements.join(',\n') + '\n' + outerIndent + ']';
    }
    serializeObjectPretty(obj, depth, inArray) {
        const keys = Object.keys(obj);
        if (this.sortKeys) {
            keys.sort();
        }
        const parts = [];
        for (const key of keys) {
            const serializedKey = this.serializeKey(key);
            const value = obj[key];
            const serializedValue = this.serializePretty(value, depth + 1, false);
            if (inArray) {
                const innerIndent = this.getIndent(depth + 2);
                parts.push(`${innerIndent}${serializedKey} = ${serializedValue}`);
            }
            else if (depth === 0) {
                parts.push(`${serializedKey} = ${serializedValue}`);
            }
            else {
                const innerIndent = this.getIndent(depth);
                parts.push(`${innerIndent}${serializedKey} = ${serializedValue}`);
            }
        }
        if (parts.length === 0) {
            return '';
        }
        else if (inArray) {
            const braceIndent = this.getIndent(depth + 1);
            return `${braceIndent}{\n${parts.join(',\n')}\n${braceIndent}}`;
        }
        else if (depth === 0) {
            return parts.join(',\n');
        }
        else {
            const outerIndent = this.getIndent(depth - 1);
            return '{\n' + parts.join(',\n') + '\n' + outerIndent + '}';
        }
    }
    serializePretty(value, depth = 0, inArray = false) {
        if (value === null) {
            return 'null';
        }
        else if (typeof value === 'string') {
            return this.serializeString(value);
        }
        else if (typeof value === 'number') {
            return this.serializeNumber(value);
        }
        else if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        else if (Array.isArray(value)) {
            return this.serializeArrayPretty(value, depth);
        }
        else if (typeof value === 'object') {
            return this.serializeObjectPretty(value, depth, inArray);
        }
        else {
            throw new Error(`Cannot serialize value: ${value}`);
        }
    }
}
export function serializePretty(value, options) {
    const serializer = new PrettySerializer(options);
    return serializer.serializePretty(value, 0, false);
}
export default {
    parse,
    serialize,
    serializePretty,
    JhonParseError,
};
//# sourceMappingURL=index-optimized.js.map