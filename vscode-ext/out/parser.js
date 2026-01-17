"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JhonParser = void 0;
const commentExtractor_1 = require("./commentExtractor");
class JhonParser {
    constructor() {
        this.commentExtractor = new commentExtractor_1.CommentExtractor();
    }
    parse(text) {
        const { text: textWithoutComments, comments } = this.commentExtractor.extractComments(text);
        const trimmed = textWithoutComments.trim();
        if (trimmed.startsWith('[')) {
            const arrayResult = this.parseArray(trimmed, 0);
            if (arrayResult.endPos !== trimmed.length) {
                return { success: false, error: 'Unexpected trailing characters' };
            }
            return { success: true, value: this.cleanArray(arrayResult.value), comments };
        }
        const objectResult = this.parseObject(trimmed, 0);
        if (objectResult.endPos !== trimmed.length) {
            return { success: false, error: 'Unexpected trailing characters' };
        }
        return { success: true, value: this.cleanObject(objectResult.value), comments };
    }
    cleanObject(obj) {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj.value)) {
            cleaned[key] = this.cleanValue(value);
        }
        return { type: 'object', value: cleaned };
    }
    cleanArray(arr) {
        return { type: 'array', value: arr.value.map(v => this.cleanValue(v)) };
    }
    cleanValue(value) {
        const { endPos, raw, ...cleanValue } = value;
        if (cleanValue.type === 'object') {
            return this.cleanObject(cleanValue);
        }
        if (cleanValue.type === 'array') {
            return this.cleanArray(cleanValue);
        }
        if (cleanValue.type === 'string' && raw !== undefined && (raw.startsWith('r') || raw.startsWith('R'))) {
            return { type: 'string', value: cleanValue.value, raw };
        }
        if (cleanValue.type === 'string') {
            return { type: 'string', value: cleanValue.value };
        }
        return cleanValue;
    }
    removeComments(text) {
        let result = '';
        let i = 0;
        while (i < text.length) {
            if (text[i] === '/') {
                if (i + 1 < text.length) {
                    if (text[i + 1] === '/') {
                        i += 2;
                        while (i < text.length && text[i] !== '\n') {
                            i++;
                        }
                        continue;
                    }
                    else if (text[i + 1] === '*') {
                        i += 2;
                        while (i < text.length) {
                            if (text[i] === '*' && i + 1 < text.length && text[i + 1] === '/') {
                                i += 2;
                                break;
                            }
                            i++;
                        }
                        continue;
                    }
                }
            }
            result += text[i];
            i++;
        }
        return result;
    }
    parseObject(text, startPos) {
        let pos = startPos;
        while (pos < text.length && /\s/.test(text[pos])) {
            pos++;
        }
        let isWrapped = false;
        if (text[pos] === '{') {
            isWrapped = true;
            pos++;
        }
        const value = {};
        while (pos < text.length) {
            this.skipSeparators(text, pos);
            pos = this.skipSeparators(text, pos);
            if (pos >= text.length || text[pos] === '}') {
                if (isWrapped) {
                    pos++;
                }
                break;
            }
            const keyResult = this.parseKey(text, pos);
            pos = keyResult.endPos;
            pos = this.skipWhitespace(text, pos);
            if (pos < text.length && text[pos] === '=') {
                pos++;
            }
            pos = this.skipWhitespace(text, pos);
            const valueResult = this.parseValue(text, pos);
            pos = valueResult.endPos;
            value[keyResult.value] = valueResult;
        }
        return { value: { type: 'object', value }, endPos: pos };
    }
    parseKey(text, startPos) {
        let pos = this.skipWhitespace(text, startPos);
        const start = pos;
        if (text[pos] === '"' || text[pos] === "'") {
            return this.parseQuotedKey(text, pos);
        }
        while (pos < text.length && /[\w-]/.test(text[pos])) {
            pos++;
        }
        return { value: text.slice(start, pos), endPos: pos };
    }
    parseQuotedKey(text, startPos) {
        const quote = text[startPos];
        let pos = startPos + 1;
        let key = '';
        while (pos < text.length && text[pos] !== quote) {
            if (text[pos] === '\\' && pos + 1 < text.length) {
                pos++;
                if (text[pos] === 'u' && pos + 4 < text.length) {
                    // Unicode escape sequence
                    const hex = text.slice(pos + 1, pos + 5);
                    const codePoint = parseInt(hex, 16);
                    key += String.fromCharCode(codePoint);
                    pos += 4;
                }
                else {
                    key += this.processEscapeCharacter(text[pos]);
                }
            }
            else {
                key += text[pos];
            }
            pos++;
        }
        pos++;
        return { value: key, endPos: pos };
    }
    parseValue(text, startPos) {
        let pos = this.skipWhitespace(text, startPos);
        if (pos >= text.length) {
            return { type: 'null', value: null, endPos: pos };
        }
        const char = text[pos];
        if (char === '"' || char === "'") {
            return this.parseString(text, pos);
        }
        if (char === 'r' || char === 'R') {
            return this.parseRawString(text, pos);
        }
        if (char === '[') {
            const result = this.parseArray(text, pos);
            return { ...result.value, endPos: result.endPos };
        }
        if (char === '{') {
            const result = this.parseObject(text, pos);
            return { ...result.value, endPos: result.endPos };
        }
        if (char === '-' || /\d/.test(char)) {
            return this.parseNumber(text, pos);
        }
        if (char === 't' || char === 'f') {
            return this.parseBoolean(text, pos);
        }
        if (char === 'n') {
            return this.parseNull(text, pos);
        }
        return { type: 'null', value: null, endPos: pos };
    }
    parseString(text, startPos) {
        const quote = text[startPos];
        let pos = startPos + 1;
        let value = '';
        let raw = text[startPos] + '';
        while (pos < text.length && text[pos] !== quote) {
            if (text[pos] === '\\' && pos + 1 < text.length) {
                raw += text[pos];
                pos++;
                raw += text[pos];
                if (text[pos] === 'u' && pos + 4 < text.length) {
                    // Unicode escape sequence
                    const hex = text.slice(pos + 1, pos + 5);
                    const codePoint = parseInt(hex, 16);
                    value += String.fromCharCode(codePoint);
                    raw += hex;
                    pos += 4;
                }
                else {
                    value += this.processEscapeCharacter(text[pos]);
                }
            }
            else {
                value += text[pos];
                raw += text[pos];
            }
            pos++;
        }
        pos++;
        raw += quote;
        return { type: 'string', value, endPos: pos, raw };
    }
    parseRawString(text, startPos) {
        if (text[startPos] !== 'r' && text[startPos] !== 'R') {
            return { type: 'string', value: '', endPos: startPos };
        }
        let pos = startPos + 1;
        let hashCount = 0;
        while (pos < text.length && text[pos] === '#') {
            hashCount++;
            pos++;
        }
        if (pos >= text.length || text[pos] !== '"') {
            return { type: 'string', value: '', endPos: startPos };
        }
        pos++;
        const start = pos;
        while (pos < text.length) {
            if (text[pos] === '"') {
                let foundEnd = true;
                for (let i = 1; i <= hashCount; i++) {
                    if (pos + i >= text.length || text[pos + i] !== '#') {
                        foundEnd = false;
                        break;
                    }
                }
                if (foundEnd) {
                    const value = text.slice(start, pos);
                    const raw = text.slice(startPos, pos + hashCount + 1);
                    return { type: 'string', value, endPos: pos + hashCount + 1, raw };
                }
            }
            pos++;
        }
        return { type: 'string', value: '', endPos: startPos };
    }
    parseArray(text, startPos) {
        let pos = startPos + 1;
        const elements = [];
        while (pos < text.length) {
            pos = this.skipSeparators(text, pos);
            if (pos >= text.length || text[pos] === ']') {
                pos++;
                break;
            }
            const element = this.parseValue(text, pos);
            elements.push(element);
            pos = element.endPos;
        }
        return { value: { type: 'array', value: elements }, endPos: pos };
    }
    parseNumber(text, startPos) {
        let pos = startPos;
        if (text[pos] === '-') {
            pos++;
        }
        // Parse digits (allowing underscores as digit separators)
        let hasDigits = false;
        while (pos < text.length && (/\d/.test(text[pos]) || text[pos] === '_')) {
            if (/\d/.test(text[pos])) {
                hasDigits = true;
            }
            pos++;
        }
        if (!hasDigits) {
            return { type: 'number', value: 0, endPos: startPos };
        }
        // Parse decimal part
        if (pos < text.length && text[pos] === '.') {
            pos++;
            let hasDecimalDigits = false;
            while (pos < text.length && (/\d/.test(text[pos]) || text[pos] === '_')) {
                if (/\d/.test(text[pos])) {
                    hasDecimalDigits = true;
                }
                pos++;
            }
            if (!hasDecimalDigits) {
                return { type: 'number', value: 0, endPos: startPos };
            }
        }
        // Remove underscores before parsing
        const numStr = text.slice(startPos, pos).replace(/_/g, '');
        const value = parseFloat(numStr);
        return { type: 'number', value, endPos: pos };
    }
    parseBoolean(text, startPos) {
        if (text.slice(startPos, startPos + 4) === 'true') {
            return { type: 'boolean', value: true, endPos: startPos + 4 };
        }
        if (text.slice(startPos, startPos + 5) === 'false') {
            return { type: 'boolean', value: false, endPos: startPos + 5 };
        }
        return { type: 'boolean', value: false, endPos: startPos };
    }
    parseNull(text, startPos) {
        if (text.slice(startPos, startPos + 4) === 'null') {
            return { type: 'null', value: null, endPos: startPos + 4 };
        }
        return { type: 'null', value: null, endPos: startPos };
    }
    skipWhitespace(text, pos) {
        while (pos < text.length && /\s/.test(text[pos])) {
            pos++;
        }
        return pos;
    }
    skipSeparators(text, pos) {
        while (pos < text.length && (text[pos] === '\n' || text[pos] === ',' || text[pos] === ' ' || text[pos] === '\t' || text[pos] === '\r')) {
            pos++;
        }
        return pos;
    }
    processEscapeCharacter(char) {
        switch (char) {
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
            default:
                return char;
        }
    }
}
exports.JhonParser = JhonParser;
//# sourceMappingURL=parser.js.map