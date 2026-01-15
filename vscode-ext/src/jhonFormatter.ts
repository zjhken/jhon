import { JhonValue, JhonObject, JhonArray } from './parser';
import { Comment } from './commentExtractor';

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

	format(value: JhonObject | JhonArray, comments?: Comment[]): string {
		let result = '';

		// Add comments at the beginning
		if (comments && comments.length > 0) {
			result += this.formatComments(comments) + '\n';
		}

		result += this.formatValue(value, 0, false);
		return result;
	}

	private formatComments(comments: Comment[]): string {
		return comments.map(comment => {
			if (comment.type === 'line') {
				return `// ${comment.value}`;
			} else {
				return `/* ${comment.value} */`;
			}
		}).join('\n');
	}

	formatValue(value: JhonValue, depth: number, inArray: boolean): string {
		switch (value.type) {
			case 'object':
				return this.formatObject(value, depth, inArray);
			case 'array':
				return this.formatArray(value, depth);
			case 'string':
				return this.formatString(value.value, value.raw);
			case 'number':
				return this.formatNumber(value.value);
			case 'boolean':
				return value.value ? 'true' : 'false';
			case 'null':
				return 'null';
		}
	}

	formatObject(obj: JhonObject, depth: number, inArray: boolean): string {
		const keys = Object.keys(obj.value);

		if (keys.length === 0) {
			return inArray || depth > 0 ? '{}' : '';
		}

		const sortedKeys = this.options.sortKeys ? [...keys].sort() : keys;

		const indent = this.getIndent(depth);
		const innerIndent = this.getIndent(depth + 1);

		let result = '';

		let maxKeyLength = 0;
		if (this.options.alignEquals && depth === 0 && !inArray) {
			sortedKeys.forEach(key => {
				const formattedKey = this.formatKey(key);
				if (formattedKey.length > maxKeyLength) {
					maxKeyLength = formattedKey.length;
				}
			});
		}

		sortedKeys.forEach((key, index) => {
			const formattedKey = this.formatKey(key);
			const value = obj.value[key];
			const formattedValue = this.formatValue(value, depth + 1, false);
			let trailingComma = this.getTrailingComma(index, sortedKeys.length);

			// Don't add trailing comma or extra newline after values that end with ] or }
			const endsWithBracket = formattedValue.endsWith(']\n') || formattedValue.endsWith('}\n');
			if (endsWithBracket) {
				trailingComma = '';
			}

			if (inArray) {
				// Objects inside arrays get extra indentation for their keys
				const keyIndent = this.getIndent(depth + 1);
				if (endsWithBracket) {
					result += `${keyIndent}${formattedKey} = ${formattedValue}${trailingComma}`;
				} else {
					result += `${keyIndent}${formattedKey} = ${formattedValue}${trailingComma}\n`;
				}
			} else if (depth === 0 && !inArray) {
				if (this.options.alignEquals && maxKeyLength > 0) {
					const padding = ' '.repeat(maxKeyLength - formattedKey.length);
					if (endsWithBracket) {
						result += `${formattedKey}${padding} = ${formattedValue}${trailingComma}`;
					} else {
						result += `${formattedKey}${padding} = ${formattedValue}${trailingComma}\n`;
					}
				} else {
					if (endsWithBracket) {
						result += `${formattedKey} = ${formattedValue}${trailingComma}`;
					} else {
						result += `${formattedKey} = ${formattedValue}${trailingComma}\n`;
					}
				}
			} else {
				if (endsWithBracket) {
					result += `${indent}${formattedKey} = ${formattedValue}${trailingComma}`;
				} else {
					result += `${indent}${formattedKey} = ${formattedValue}${trailingComma}\n`;
				}
			}
		});

		if (inArray || depth > 0) {
			// Objects in arrays get indent for the braces
			// Nested objects (not in arrays) get no indent for opening brace, but get indent for closing brace
			const outerIndent = inArray ? this.getIndent(depth) : '';
			const closingIndent = inArray ? this.getIndent(depth) : this.getIndent(depth - 1);
			return `${outerIndent}{\n${result}${closingIndent}}`;
		}

		return result;
	}

	formatArray(arr: JhonArray, depth: number): string {
		if (arr.value.length === 0) {
			return '[]';
		}

		// Arrays at depth 0 or 1 (as top-level values) get no outer indentation
		// Only deeper arrays get indented
		const outerIndent = depth >= 2 ? this.getIndent(depth - 1) : '';
		const innerIndent = this.getIndent(depth);

		let result = `${outerIndent}[\n`;

		arr.value.forEach((element, index) => {
			const formattedValue = this.formatValue(element, depth, true);
			const trailingComma = this.getTrailingComma(index, arr.value.length);

			if (element.type === 'object') {
				result += `${formattedValue}${trailingComma}\n`;
			} else {
				result += `${innerIndent}${formattedValue}${trailingComma}\n`;
			}
		});

		result += `${outerIndent}]\n`;

		return result;
	}

	formatKey(key: string): string {
		if (this.needsQuoting(key)) {
			return this.quoteString(key);
		}
		return key;
	}

	formatString(value: string, raw?: string): string {
		if (raw && (raw.startsWith('r') || raw.startsWith('R'))) {
			return raw;
		}
		return this.quoteString(value);
	}

	formatNumber(value: number): string {
		if (Number.isInteger(value)) {
			return value.toString();
		}
		return value.toString();
	}

	quoteString(value: string): string {
		const quote = this.getQuoteStyle();
		return `${quote}${this.escapeString(value, quote)}${quote}`;
	}

	escapeString(value: string, quote: '"' | "'"): string {
		return value
			.replace(/\\/g, '\\\\')
			.replace(new RegExp(quote, 'g'), `\\${quote}`)
			.replace(/\n/g, '\\n')
			.replace(/\r/g, '\\r')
			.replace(/\t/g, '\\t')
			.replace(/\x08/g, '\\b')  // backspace
			.replace(/\x0C/g, '\\f');  // form feed
	}

	needsQuoting(s: string): boolean {
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

	private getQuoteStyle(): '"' | "'" {
		if (this.options.quoteStyle === 'double') {
			return '"';
		}
		if (this.options.quoteStyle === 'single') {
			return "'";
		}
		return '"';
	}

	private getTrailingComma(index: number, length: number): string {
		// Add comma between elements
		if (index < length - 1) {
			return ',';
		}
		// Only add trailing comma after last element if enabled
		return this.options.trailingCommas ? ',' : '';
	}

	private getIndent(depth: number): string {
		if (this.options.insertSpaces) {
			return ' '.repeat(this.options.tabSize * depth);
		}
		return '\t'.repeat(depth);
	}
}
