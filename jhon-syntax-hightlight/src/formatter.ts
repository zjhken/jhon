export interface JhonValue {
	type: 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object';
	value: any;
	raw?: string;
}

export interface JhonObject {
	[key: string]: JhonValue;
}

export type JhonArray = JhonValue[];

export interface FormatOptions {
	insertSpaces: boolean;
	tabSize: number;
	sortKeys: boolean;
	trailingCommas: boolean;
	alignEquals: boolean;
	quoteStyle: 'double' | 'single' | 'auto';
}

export class JhonFormatter {
	private options: FormatOptions;

	constructor(options: FormatOptions) {
		this.options = options;
	}

	format(text: string): string {
		// Remove comments for parsing
		const textWithoutComments = this.removeComments(text);

		// Parse the JHON text
		const parsed = this.parse(textWithoutComments);

		// Format the parsed value
		return this.formatValue(parsed, 0, false);
	}

	private removeComments(text: string): string {
		let result = '';
		let i = 0;

		while (i < text.length) {
			if (text[i] === '/') {
				if (i + 1 < text.length) {
					if (text[i + 1] === '/') {
						// Single line comment
						i += 2;
						while (i < text.length && text[i] !== '\n') {
							i++;
						}
						continue;
					} else if (text[i + 1] === '*') {
						// Multi-line comment
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

	private parse(text: string): any {
		const trimmed = text.trim();

		if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
			return this.parseObject(trimmed);
		}

		return this.parseObject(trimmed);
	}

	private parseObject(text: string): JhonObject {
		const result: JhonObject = {};
		let pos = 0;

		text = text.trim();

		// Handle wrapped objects
		if (text.startsWith('{') && text.endsWith('}')) {
			text = text.slice(1, -1);
		}

		while (pos < text.length) {
			// Skip separators (newlines and commas)
			while (pos < text.length && (text[pos] === '\n' || text[pos] === ',' || text[pos] === ' ' || text[pos] === '\t' || text[pos] === '\r')) {
				pos++;
			}

			if (pos >= text.length) {
				break;
			}

			// Parse key
			const key = this.parseKey(text, pos);
			pos = key.endPos;

			// Skip whitespace before =
			while (pos < text.length && /\s/.test(text[pos])) {
				pos++;
			}

			// Expect =
			if (pos < text.length && text[pos] === '=') {
				pos++;
			}

			// Skip whitespace after =
			while (pos < text.length && /\s/.test(text[pos])) {
				pos++;
			}

			// Parse value
			const value = this.parseValue(text, pos);
			pos = value.endPos;

			result[key.value] = value;
		}

		return result;
	}

	private parseKey(text: string, startPos: number): { value: string; endPos: number } {
		let pos = startPos;

		// Skip whitespace
		while (pos < text.length && /\s/.test(text[pos])) {
			pos++;
		}

		const start = pos;

		if (text[pos] === '"' || text[pos] === "'") {
			const quote = text[pos];
			pos++;
			let key = '';
			while (pos < text.length && text[pos] !== quote) {
				if (text[pos] === '\\' && pos + 1 < text.length) {
					pos++;
					key += text[pos];
				} else {
					key += text[pos];
				}
				pos++;
			}
			pos++; // Skip closing quote
			return { value: key, endPos: pos };
		} else {
			// Unquoted key
			while (pos < text.length && /[\w-]/.test(text[pos])) {
				pos++;
			}
			return { value: text.slice(start, pos), endPos: pos };
		}
	}

	private parseValue(text: string, startPos: number): JhonValue & { endPos: number } {
		let pos = startPos;

		// Skip whitespace
		while (pos < text.length && /\s/.test(text[pos])) {
			pos++;
		}

		if (pos >= text.length) {
			return { type: 'null', value: null, endPos: pos };
		}

		const char = text[pos];

		if (char === '"' || char === "'") {
			return this.parseString(text, pos);
		} else if (char === 'r' || char === 'R') {
			return this.parseRawString(text, pos);
		} else if (char === '[') {
			return this.parseArray(text, pos);
		} else if (char === '{') {
			return this.parseNestedObject(text, pos);
		} else if (char === '-' || /\d/.test(char)) {
			return this.parseNumber(text, pos);
		} else if (char === 't' || char === 'f') {
			return this.parseBoolean(text, pos);
		} else if (char === 'n') {
			return this.parseNull(text, pos);
		}

		return { type: 'null', value: null, endPos: pos };
	}

	private parseString(text: string, startPos: number): JhonValue & { endPos: number } {
		const quote = text[startPos];
		let pos = startPos + 1;
		let value = '';

		while (pos < text.length && text[pos] !== quote) {
			if (text[pos] === '\\' && pos + 1 < text.length) {
				pos++;
				const escapeChar = text[pos];
				switch (escapeChar) {
					case 'n':
						value += '\n';
						break;
					case 'r':
						value += '\r';
						break;
					case 't':
						value += '\t';
						break;
					case 'b':
						value += '\b';
						break;
					case 'f':
						value += '\f';
						break;
					case 'u':
						if (pos + 4 < text.length) {
							const hex = text.slice(pos + 1, pos + 5);
							value += String.fromCharCode(parseInt(hex, 16));
							pos += 4;
						}
						break;
					default:
						value += escapeChar;
				}
			} else {
				value += text[pos];
			}
			pos++;
		}

		pos++; // Skip closing quote

		return { type: 'string', value, endPos: pos, raw: text.slice(startPos, pos) };
	}

	private parseRawString(text: string, startPos: number): JhonValue & { endPos: number } {
		if (text[startPos] !== 'r' && text[startPos] !== 'R') {
			return { type: 'null', value: null, endPos: startPos };
		}

		let pos = startPos + 1;
		let hashCount = 0;

		while (pos < text.length && text[pos] === '#') {
			hashCount++;
			pos++;
		}

		if (pos >= text.length || text[pos] !== '"') {
			return { type: 'null', value: null, endPos: startPos };
		}

		pos++; // Skip opening quote
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
					return { type: 'string', value, endPos: pos + hashCount + 1, raw: text.slice(startPos, pos + hashCount + 1) };
				}
			}
			pos++;
		}

		return { type: 'null', value: null, endPos: startPos };
	}

	private parseArray(text: string, startPos: number): JhonValue & { endPos: number } {
		let pos = startPos + 1; // Skip opening [
		const elements: JhonValue[] = [];

		while (pos < text.length) {
			// Skip separators
			while (pos < text.length && (text[pos] === '\n' || text[pos] === ',' || text[pos] === ' ' || text[pos] === '\t' || text[pos] === '\r')) {
				pos++;
			}

			if (pos >= text.length || text[pos] === ']') {
				pos++;
				break;
			}

			const element = this.parseValue(text, pos);
			elements.push(element);
			pos = element.endPos;
		}

		return { type: 'array', value: elements, endPos: pos };
	}

	private parseNestedObject(text: string, startPos: number): JhonValue & { endPos: number } {
		let pos = startPos + 1; // Skip opening {
		const result: JhonObject = {};

		while (pos < text.length) {
			// Skip separators
			while (pos < text.length && (text[pos] === '\n' || text[pos] === ',' || text[pos] === ' ' || text[pos] === '\t' || text[pos] === '\r')) {
				pos++;
			}

			if (pos >= text.length || text[pos] === '}') {
				pos++;
				break;
			}

			// Parse key
			const key = this.parseKey(text, pos);
			pos = key.endPos;

			// Skip whitespace before =
			while (pos < text.length && /\s/.test(text[pos])) {
				pos++;
			}

			// Expect =
			if (pos < text.length && text[pos] === '=') {
				pos++;
			}

			// Skip whitespace after =
			while (pos < text.length && /\s/.test(text[pos])) {
				pos++;
			}

			// Parse value
			const value = this.parseValue(text, pos);
			pos = value.endPos;

			result[key.value] = value;
		}

		return { type: 'object', value: result, endPos: pos };
	}

	private parseNumber(text: string, startPos: number): JhonValue & { endPos: number } {
		let pos = startPos;

		if (text[pos] === '-') {
			pos++;
		}

		while (pos < text.length && /\d/.test(text[pos])) {
			pos++;
		}

		if (pos < text.length && text[pos] === '.') {
			pos++;
			while (pos < text.length && /\d/.test(text[pos])) {
				pos++;
			}
		}

		const numStr = text.slice(startPos, pos);
		const value = parseFloat(numStr);

		return { type: 'number', value, endPos: pos };
	}

	private parseBoolean(text: string, startPos: number): JhonValue & { endPos: number } {
		if (text.slice(startPos, startPos + 4) === 'true') {
			return { type: 'boolean', value: true, endPos: startPos + 4 };
		} else if (text.slice(startPos, startPos + 5) === 'false') {
			return { type: 'boolean', value: false, endPos: startPos + 5 };
		}

		return { type: 'null', value: null, endPos: startPos };
	}

	private parseNull(text: string, startPos: number): JhonValue & { endPos: number } {
		if (text.slice(startPos, startPos + 4) === 'null') {
			return { type: 'null', value: null, endPos: startPos + 4 };
		}

		return { type: 'null', value: null, endPos: startPos };
	}

	private formatValue(value: any, depth: number, inArray: boolean): string {
		if (value.type === 'object') {
			return this.formatObject(value.value, depth, inArray);
		} else if (value.type === 'array') {
			return this.formatArray(value.value, depth);
		} else if (value.type === 'string') {
			return this.formatString(value.value, value.raw);
		} else if (value.type === 'number') {
			return this.formatNumber(value.value);
		} else if (value.type === 'boolean') {
			return value.value ? 'true' : 'false';
		} else if (value.type === 'null') {
			return 'null';
		}

		return '';
	}

	private formatObject(obj: JhonObject, depth: number, inArray: boolean): string {
		const keys = Object.keys(obj);

		if (keys.length === 0) {
			return inArray ? '{}' : '';
		}

		if (this.options.sortKeys) {
			keys.sort();
		}

		const indent = this.getIndent(depth);
		const innerIndent = this.getIndent(depth + 1);

		let result = '';

		// Calculate max key length for alignment if enabled
		let maxKeyLength = 0;
		if (this.options.alignEquals && !inArray && depth === 0) {
			keys.forEach(key => {
				const formattedKey = this.formatKey(key);
				if (formattedKey.length > maxKeyLength) {
					maxKeyLength = formattedKey.length;
				}
			});
		}

		keys.forEach((key, index) => {
			const formattedKey = this.formatKey(key);
			const value = obj[key];
			const formattedValue = this.formatValue(value, depth + 1, false);
			const trailingComma = this.options.trailingCommas || index < keys.length - 1 ? ',' : '';

			if (inArray) {
				result += `${innerIndent}${formattedKey} = ${formattedValue}${trailingComma}\n`;
			} else if (depth === 0) {
				if (this.options.alignEquals && maxKeyLength > 0) {
					const padding = ' '.repeat(maxKeyLength - formattedKey.length);
					result += `${formattedKey}${padding} = ${formattedValue}${trailingComma}\n`;
				} else {
					result += `${formattedKey} = ${formattedValue}${trailingComma}\n`;
				}
			} else {
				result += `${indent}${formattedKey} = ${formattedValue}${trailingComma}\n`;
			}
		});

		if (inArray) {
			const outerIndent = this.getIndent(depth);
			return `${outerIndent}{\n${result}${outerIndent}}`;
		}

		return result.trimEnd();
	}

	private formatArray(arr: JhonArray, depth: number): string {
		if (arr.length === 0) {
			return '[]';
		}

		const indent = this.getIndent(depth);
		const innerIndent = this.getIndent(depth + 1);
		const outerIndent = depth > 0 ? this.getIndent(depth - 1) : '';

		let result = `[\n`;

		arr.forEach((element, index) => {
			const formattedValue = this.formatValue(element, depth + 1, true);
			const trailingComma = this.options.trailingCommas || index < arr.length - 1 ? ',' : '';

			if (element.type === 'object') {
				result += `${formattedValue}${trailingComma}\n`;
			} else {
				result += `${innerIndent}${formattedValue}${trailingComma}\n`;
			}
		});

		result += `${outerIndent}]`;

		return result;
	}

	private formatKey(key: string): string {
		// Check if key needs quoting
		if (this.needsQuoting(key)) {
			return this.quoteString(key);
		}

		return key;
	}

	private formatString(value: string, raw?: string): string {
		if (raw && (raw.startsWith('r') || raw.startsWith('R'))) {
			return raw; // Preserve raw strings
		}

		return this.quoteString(value);
	}

	private quoteString(value: string): string {
		const quote = this.getQuoteStyle();

		return `${quote}${this.escapeString(value, quote)}${quote}`;
	}

	private getQuoteStyle(): '"' | "'" {
		if (this.options.quoteStyle === 'double') {
			return '"';
		} else if (this.options.quoteStyle === 'single') {
			return "'";
		}

		return '"'; // Default to double quotes for auto
	}

	private escapeString(value: string, quote: '"' | "'"): string {
		return value
			.replace(/\\/g, '\\\\')
			.replace(new RegExp(quote, 'g'), `\\${quote}`)
			.replace(/\n/g, '\\n')
			.replace(/\r/g, '\\r')
			.replace(/\t/g, '\\t')
			.replace(/\b/g, '\\b')
			.replace(/\f/g, '\\f');
	}

	private formatNumber(value: number): string {
		if (Number.isInteger(value)) {
			return value.toString();
		}

		return value.toString();
	}

	private needsQuoting(s: string): boolean {
		if (s.length === 0) {
			return true;
		}

		for (const char of s) {
			if (!/[a-zA-Z0-9_-]/.test(char)) {
				return true;
			}
		}

		return false;
	}

	private getIndent(depth: number): string {
		if (this.options.insertSpaces) {
			return ' '.repeat(this.options.tabSize * depth);
		}

		return '\t'.repeat(depth);
	}
}
