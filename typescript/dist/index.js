/**
 * JHON - JSON-like Human Optimized Notation
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
class Parser {
    input;
    pos;
    chars;
    length;
    constructor(input) {
        this.input = input;
        this.pos = 0;
        this.chars = Array.from(input);
        this.length = this.chars.length;
    }
    /**
     * Remove comments (// and slash-star star-slash)
     */
    static removeComments(input) {
        let result = '';
        let i = 0;
        const chars = Array.from(input);
        while (i < chars.length) {
            const c = chars[i];
            if (c === '/' && i + 1 < chars.length) {
                const nextChar = chars[i + 1];
                if (nextChar === '/') {
                    // Single line comment: consume until newline
                    i += 2;
                    while (i < chars.length && chars[i] !== '\n') {
                        i++;
                    }
                    continue;
                }
                else if (nextChar === '*') {
                    // Multi-line comment: consume until */
                    i += 2;
                    let foundEnd = false;
                    while (i < chars.length) {
                        if (chars[i] === '*' && i + 1 < chars.length && chars[i + 1] === '/') {
                            i += 2;
                            foundEnd = true;
                            break;
                        }
                        i++;
                    }
                    if (!foundEnd) {
                        // Unterminated multi-line comment, treat as literal
                        result += '/*';
                    }
                    continue;
                }
            }
            result += c;
            i++;
        }
        return result;
    }
    /**
     * Skip separator characters (only newlines and commas)
     */
    skipSeparators() {
        while (this.pos < this.length) {
            const c = this.chars[this.pos];
            if (c === '\n' || c === ',') {
                this.pos++;
            }
            else {
                break;
            }
        }
    }
    /**
     * Skip all whitespace
     */
    skipWhitespace() {
        while (this.pos < this.length && /\s/.test(this.chars[this.pos])) {
            this.pos++;
        }
    }
    /**
     * Skip spaces and tabs (but not newlines)
     */
    skipSpacesAndTabs() {
        while (this.pos < this.length && (this.chars[this.pos] === ' ' || this.chars[this.pos] === '\t')) {
            this.pos++;
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
        const quoteChar = this.chars[this.pos];
        if (quoteChar === '"' || quoteChar === "'") {
            // Quoted key
            this.pos++; // skip opening quote
            let key = '';
            while (this.pos < this.length) {
                if (this.chars[this.pos] === quoteChar) {
                    this.pos++; // skip closing quote
                    return key;
                }
                else if (this.chars[this.pos] === '\\') {
                    this.pos++;
                    if (this.pos < this.length) {
                        key += this.parseEscapeSequence(quoteChar);
                    }
                }
                else {
                    key += this.chars[this.pos];
                    this.pos++;
                }
            }
            throw new JhonParseError('Unterminated string in key', this.pos);
        }
        else {
            // Unquoted key
            const start = this.pos;
            while (this.pos < this.length &&
                (/[a-zA-Z0-9_-]/.test(this.chars[this.pos]))) {
                this.pos++;
            }
            const key = this.chars.slice(start, this.pos).join('');
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
        const c = this.chars[this.pos];
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
                const hex = this.chars.slice(this.pos, this.pos + 4).join('');
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
        const c = this.chars[this.pos];
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
     * Parse a string value
     */
    parseStringValue() {
        const quoteChar = this.chars[this.pos];
        this.pos++; // skip opening quote
        let result = '';
        while (this.pos < this.length) {
            if (this.chars[this.pos] === quoteChar) {
                this.pos++; // skip closing quote
                return result;
            }
            else if (this.chars[this.pos] === '\\') {
                this.pos++;
                if (this.pos < this.length) {
                    result += this.parseEscapeSequence(quoteChar);
                }
            }
            else {
                result += this.chars[this.pos];
                this.pos++;
            }
        }
        throw new JhonParseError('Unterminated string', this.pos);
    }
    /**
     * Parse a raw string value (r"..." or r#"..."# or r##"..."##, etc.)
     */
    parseRawStringValue() {
        if (this.chars[this.pos] !== 'r' && this.chars[this.pos] !== 'R') {
            throw new JhonParseError('Expected raw string', this.pos);
        }
        this.pos++; // skip 'r' or 'R'
        if (this.pos >= this.length) {
            throw new JhonParseError('Unexpected end of input in raw string', this.pos);
        }
        // Count the number of # symbols
        let hashCount = 0;
        while (this.pos < this.length && this.chars[this.pos] === '#') {
            hashCount++;
            this.pos++;
        }
        if (this.pos >= this.length || this.chars[this.pos] !== '"') {
            throw new JhonParseError('Expected opening quote after r and # symbols in raw string', this.pos);
        }
        this.pos++; // skip opening quote
        const start = this.pos;
        // Look for the closing sequence: " followed by hashCount # symbols
        while (this.pos < this.length) {
            if (this.chars[this.pos] === '"') {
                // Check if there are enough # symbols after the quote
                if (this.pos + hashCount < this.length) {
                    let isClosing = true;
                    for (let j = 1; j <= hashCount; j++) {
                        if (this.chars[this.pos + j] !== '#') {
                            isClosing = false;
                            break;
                        }
                    }
                    if (isClosing) {
                        const content = this.chars.slice(start, this.pos).join('');
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
     * Parse an array
     */
    parseArray() {
        if (this.chars[this.pos] !== '[') {
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
            if (this.chars[this.pos] === ']') {
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
     * Parse a nested object
     */
    parseNestedObject() {
        if (this.chars[this.pos] !== '{') {
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
            if (this.chars[this.pos] === '}') {
                this.pos++;
                return obj;
            }
            // Parse key
            const key = this.parseKey();
            // Skip whitespace before =
            this.skipWhitespace();
            // Expect =
            if (this.pos >= this.length || this.chars[this.pos] !== '=') {
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
     * Parse a number
     */
    parseNumber() {
        const start = this.pos;
        // Optional minus sign
        if (this.pos < this.length && this.chars[this.pos] === '-') {
            this.pos++;
        }
        // Digits before decimal point
        let hasDigits = false;
        while (this.pos < this.length && /[0-9]/.test(this.chars[this.pos])) {
            hasDigits = true;
            this.pos++;
        }
        if (!hasDigits) {
            throw new JhonParseError('Invalid number', this.pos);
        }
        // Optional decimal part
        if (this.pos < this.length && this.chars[this.pos] === '.') {
            this.pos++;
            let hasDecimalDigits = false;
            while (this.pos < this.length && /[0-9]/.test(this.chars[this.pos])) {
                hasDecimalDigits = true;
                this.pos++;
            }
            if (!hasDecimalDigits) {
                throw new JhonParseError('Invalid decimal number', this.pos);
            }
        }
        const numStr = this.chars.slice(start, this.pos).join('');
        const num = parseFloat(numStr);
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
            this.chars[this.pos] === 't' &&
            this.chars[this.pos + 1] === 'r' &&
            this.chars[this.pos + 2] === 'u' &&
            this.chars[this.pos + 3] === 'e') {
            this.pos += 4;
            return true;
        }
        else if (this.pos + 4 < this.length &&
            this.chars[this.pos] === 'f' &&
            this.chars[this.pos + 1] === 'a' &&
            this.chars[this.pos + 2] === 'l' &&
            this.chars[this.pos + 3] === 's' &&
            this.chars[this.pos + 4] === 'e') {
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
            this.chars[this.pos] === 'n' &&
            this.chars[this.pos + 1] === 'u' &&
            this.chars[this.pos + 2] === 'l' &&
            this.chars[this.pos + 3] === 'l') {
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
            if (this.pos >= this.length || this.chars[this.pos] !== '=') {
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
     * Check if a key needs quoting
     */
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
     * Serialize a string value
     */
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
                    // Check if we need to escape as Unicode
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
    constructor(options = {}) {
        super(options);
        this.indent = options.indent ?? '  ';
    }
    getIndent(depth) {
        return this.indent.repeat(depth);
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