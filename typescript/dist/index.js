/**
 * JHON - JinHui's Object Notation
 * A configuration language parser and serializer
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
// Parser Implementation
// ============================================================================
// Pre-compile regex patterns for better performance
const REGEX_WHITESPACE = /\s/;
const REGEX_UNQUOTED_KEY = /[a-zA-Z0-9_-]/;
const REGEX_DIGIT = /[0-9]/;
class Parser {
    input;
    pos;
    length;
    constructor(input) {
        this.input = input;
        this.pos = 0;
        this.length = input.length;
    }
    /**
     * Remove comments (// and slash-star star-slash)
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
     * Skip separator characters (only newlines and commas)
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
     * Check if there's a separator (comma or newline) at current position
     * Skips spaces and tabs while looking, but doesn't consume them
     * Returns false if at closing character (] or })
     */
    peekSeparator(closingChar) {
        let tempPos = this.pos;
        while (tempPos < this.length) {
            const c = this.input[tempPos];
            if (c === ' ' || c === '\t') {
                // Skip spaces/tabs when looking for separator
                tempPos++;
            }
            else if (c === '\n' || c === ',') {
                return true;
            }
            else if (c === closingChar) {
                // At closing character, no separator needed
                return true;
            }
            else {
                return false;
            }
        }
        return false;
    }
    /**
     * Skip all whitespace
     */
    skipWhitespace() {
        while (this.pos < this.length && REGEX_WHITESPACE.test(this.input[this.pos])) {
            this.pos++;
        }
    }
    /**
     * Skip spaces and tabs (but not newlines)
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
     * Parse a key (quoted or unquoted)
     */
    parseKey() {
        this.skipWhitespace();
        if (this.pos >= this.length) {
            throw new JhonParseError('Expected key', this.pos);
        }
        const quoteChar = this.input[this.pos];
        if (quoteChar === '"' || quoteChar === "'") {
            // Quoted key - optimized with substring for non-escape sequences
            this.pos++; // skip opening quote
            const parts = [];
            let lastPartStart = this.pos;
            while (this.pos < this.length) {
                const c = this.input[this.pos];
                if (c === quoteChar) {
                    // Add any remaining characters before the quote
                    if (lastPartStart < this.pos) {
                        parts.push(this.input.substring(lastPartStart, this.pos));
                    }
                    this.pos++; // skip closing quote
                    return parts.join('');
                }
                else if (c === '\\') {
                    // Add characters before the escape
                    if (lastPartStart < this.pos) {
                        parts.push(this.input.substring(lastPartStart, this.pos));
                    }
                    this.pos++;
                    if (this.pos < this.length) {
                        parts.push(this.parseEscapeSequence(quoteChar));
                    }
                    lastPartStart = this.pos;
                }
                else {
                    this.pos++;
                }
            }
            throw new JhonParseError('Unterminated string in key', this.pos);
        }
        else {
            // Unquoted key
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
     * Parse an escape sequence
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
     * Parse a value
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
     * Parse a string value - optimized with substring for non-escape sequences
     */
    parseStringValue() {
        const quoteChar = this.input[this.pos];
        this.pos++; // skip opening quote
        const parts = [];
        let lastPartStart = this.pos;
        while (this.pos < this.length) {
            const c = this.input[this.pos];
            if (c === quoteChar) {
                // Add any remaining characters before the quote
                if (lastPartStart < this.pos) {
                    parts.push(this.input.substring(lastPartStart, this.pos));
                }
                this.pos++; // skip closing quote
                return parts.join('');
            }
            else if (c === '\\') {
                // Add characters before the escape
                if (lastPartStart < this.pos) {
                    parts.push(this.input.substring(lastPartStart, this.pos));
                }
                this.pos++;
                if (this.pos < this.length) {
                    parts.push(this.parseEscapeSequence(quoteChar));
                }
                lastPartStart = this.pos;
            }
            else {
                this.pos++;
            }
        }
        throw new JhonParseError('Unterminated string', this.pos);
    }
    /**
     * Parse a raw string value (r"..." or r#"..."# or r##"..."##, etc.) - optimized with indexOf
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
        const closingPattern = '"' + '#'.repeat(hashCount);
        // Use indexOf to find the closing pattern efficiently
        while (this.pos < this.length) {
            const foundIndex = this.input.indexOf(closingPattern, this.pos);
            if (foundIndex === -1) {
                this.pos = this.length;
                break;
            }
            this.pos = foundIndex;
            const content = this.input.substring(start, this.pos);
            this.pos += closingPattern.length;
            return content;
        }
        throw new JhonParseError(`Unterminated raw string (expected closing: "${closingPattern}")`, this.pos);
    }
    /**
     * Parse an array
     */
    parseArray() {
        if (this.input[this.pos] !== '[') {
            throw new JhonParseError('Expected [', this.pos);
        }
        this.pos++; // skip opening bracket
        const elements = [];
        let isFirst = true;
        while (this.pos < this.length) {
            // For elements after the first, require a separator (comma or newline)
            if (!isFirst) {
                const hasSeparator = this.peekSeparator(']');
                if (!hasSeparator) {
                    throw new JhonParseError('Expected comma or newline between array elements', this.pos);
                }
                this.skipSeparators();
            }
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
            isFirst = false;
        }
        throw new JhonParseError('Unterminated array', this.pos);
    }
    /**
     * Parse a nested object
     */
    parseNestedObject() {
        if (this.input[this.pos] !== '{') {
            throw new JhonParseError('Expected {', this.pos);
        }
        this.pos++; // skip opening brace
        const obj = {};
        let isFirst = true;
        while (this.pos < this.length) {
            // For properties after the first, require a separator (comma or newline)
            if (!isFirst) {
                const hasSeparator = this.peekSeparator('}');
                if (!hasSeparator) {
                    throw new JhonParseError('Expected comma or newline between object properties', this.pos);
                }
                this.skipSeparators();
            }
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
            isFirst = false;
        }
        throw new JhonParseError('Unterminated nested object', this.pos);
    }
    /**
     * Parse a number - optimized to build string without underscores during parsing
     */
    parseNumber() {
        // Build the number string directly without underscores using array for efficiency
        const numParts = [];
        // Optional minus sign
        if (this.pos < this.length && this.input[this.pos] === '-') {
            numParts.push('-');
            this.pos++;
        }
        let hasDigits = false;
        // Digits before decimal point (underscores allowed as digit separators)
        const start = this.pos;
        while (this.pos < this.length && (REGEX_DIGIT.test(this.input[this.pos]) || this.input[this.pos] === '_')) {
            if (this.input[this.pos] !== '_') {
                hasDigits = true;
            }
            this.pos++;
        }
        // Add digits before decimal (substring is faster than loop with push)
        if (start < this.pos) {
            const digits = this.input.substring(start, this.pos).replace(/_/g, '');
            numParts.push(digits);
        }
        if (!hasDigits) {
            throw new JhonParseError('Invalid number', this.pos);
        }
        // Optional decimal part
        if (this.pos < this.length && this.input[this.pos] === '.') {
            this.pos++;
            const decimalStart = this.pos;
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
            // Add decimal part
            numParts.push('.');
            if (decimalStart < this.pos) {
                const decimalDigits = this.input.substring(decimalStart, this.pos).replace(/_/g, '');
                numParts.push(decimalDigits);
            }
        }
        const num = parseFloat(numParts.join(''));
        if (isNaN(num)) {
            throw new JhonParseError('Could not parse number', this.pos);
        }
        return num;
    }
    /**
     * Parse a boolean
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
     * Parse null
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
     * Parse a JHON object
     */
    parseJhonObject() {
        const obj = {};
        let isFirst = true;
        while (this.pos < this.length) {
            // For properties after the first, require a separator (comma or newline)
            if (!isFirst) {
                const hasSeparator = this.peekSeparator('');
                if (!hasSeparator) {
                    throw new JhonParseError('Expected comma or newline between properties', this.pos);
                }
                this.skipSeparators();
            }
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
            isFirst = false;
            // Skip separators after value (only newlines and commas)
            // Don't advance here - let the loop handle it
        }
        return obj;
    }
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
export function parse(input, options) {
    const text = Parser.removeComments(input).trim();
    if (text === '') {
        return {};
    }
    // Handle top-level objects wrapped in braces (from serialize)
    if (text.startsWith('{') && text.endsWith('}')) {
        const parser = new Parser(text);
        return parser.parseNestedObject();
    }
    const parser = new Parser(text);
    return parser.parseJhonObject();
}
// ============================================================================
// Serializer Implementation
// ============================================================================
class Serializer {
    sortKeys;
    constructor(options = {}) {
        this.sortKeys = options.sortKeys ?? true;
    }
    /**
     * Check if a key needs quoting - optimized with single regex
     */
    needsQuoting(s) {
        if (s === '') {
            return true;
        }
        // Use a single anchored regex test instead of character-by-character
        return !/^[a-zA-Z0-9_-]+$/.test(s);
    }
    /**
     * Serialize a key
     */
    serializeKey(key) {
        if (this.needsQuoting(key)) {
            return this.serializeString(key);
        }
        return key;
    }
    /**
     * Serialize a string value - optimized with array+join
     */
    serializeString(s) {
        const parts = ['"'];
        for (const c of s) {
            switch (c) {
                case '\\':
                    parts.push('\\\\');
                    break;
                case '"':
                    parts.push('\\"');
                    break;
                case '\n':
                    parts.push('\\n');
                    break;
                case '\r':
                    parts.push('\\r');
                    break;
                case '\t':
                    parts.push('\\t');
                    break;
                case '\b':
                    parts.push('\\b');
                    break;
                case '\f':
                    parts.push('\\f');
                    break;
                default:
                    // Check if we need to escape as Unicode
                    if (c < ' ') {
                        parts.push('\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
                    }
                    else {
                        parts.push(c);
                    }
            }
        }
        parts.push('"');
        return parts.join('');
    }
    /**
     * Serialize a number
     */
    serializeNumber(n) {
        if (Number.isInteger(n)) {
            return n.toString();
        }
        return n.toString();
    }
    /**
     * Serialize an array
     */
    serializeArray(arr) {
        const elements = arr.map((v) => {
            if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                // Objects in arrays need to be wrapped in braces
                const inner = this.serializeObject(v);
                return inner === '' ? '{}' : `{${inner}}`;
            }
            return this.serialize(v);
        });
        return '[' + elements.join(',') + ']';
    }
    /**
     * Serialize an object (returns content without braces)
     */
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
                // Nested object - recursively serialize and wrap in braces
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
    /**
     * Serialize any JHON value
     */
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
export function serialize(value, options) {
    const serializer = new Serializer(options);
    return serializer.serialize(value);
}
// ============================================================================
// Pretty Serializer Implementation
// ============================================================================
class PrettySerializer extends Serializer {
    indent;
    indentCache;
    constructor(options = {}) {
        super(options);
        this.indent = options.indent ?? '  ';
        this.indentCache = new Map();
        // Pre-cache common indents (0-10 levels)
        for (let i = 0; i <= 10; i++) {
            this.indentCache.set(i, this.indent.repeat(i));
        }
    }
    getIndent(depth) {
        const cached = this.indentCache.get(depth);
        if (cached !== undefined) {
            return cached;
        }
        // Cache miss - compute and store
        const indentStr = this.indent.repeat(depth);
        this.indentCache.set(depth, indentStr);
        return indentStr;
    }
    /**
     * Serialize an array with pretty formatting
     */
    serializeArrayPretty(arr, depth) {
        if (arr.length === 0) {
            return '[]';
        }
        const outerIndent = depth > 0 ? this.getIndent(depth - 1) : '';
        const elements = [];
        for (const v of arr) {
            if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                // For objects in arrays, adjust depth
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
    /**
     * Serialize an object with pretty formatting
     */
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
            // Determine indentation based on context
            if (inArray) {
                // Object is inside an array
                const innerIndent = this.getIndent(depth + 2);
                parts.push(`${innerIndent}${serializedKey} = ${serializedValue}`);
            }
            else if (depth === 0) {
                // Top-level object, no indentation
                parts.push(`${serializedKey} = ${serializedValue}`);
            }
            else {
                // Nested object, use depth for indentation
                const innerIndent = this.getIndent(depth);
                parts.push(`${innerIndent}${serializedKey} = ${serializedValue}`);
            }
        }
        if (parts.length === 0) {
            return '';
        }
        else if (inArray) {
            // Object inside array, add braces with proper indentation
            const braceIndent = this.getIndent(depth + 1);
            return `${braceIndent}{\n${parts.join(',\n')}\n${braceIndent}}`;
        }
        else if (depth === 0) {
            // Top-level object, no outer braces
            return parts.join(',\n');
        }
        else {
            // Nested object, add braces
            const outerIndent = this.getIndent(depth - 1);
            return '{\n' + parts.join(',\n') + '\n' + outerIndent + '}';
        }
    }
    /**
     * Serialize any JHON value with pretty formatting
     */
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
export function serializePretty(value, options) {
    const serializer = new PrettySerializer(options);
    return serializer.serializePretty(value, 0, false);
}
// ============================================================================
// Default export
// ============================================================================
export default {
    parse,
    serialize,
    serializePretty,
    JhonParseError,
};
//# sourceMappingURL=index.js.map