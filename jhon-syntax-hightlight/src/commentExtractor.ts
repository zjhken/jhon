export interface Comment {
	type: 'line' | 'block';
	value: string;
	line: number;
	column: number;
	inline: boolean; // true if comment is on same line as code
}

export interface CommentMap {
	before: Comment[];  // comments before a position
	after: Comment[];   // comments after a position
}

export class CommentExtractor {
	extractComments(text: string): { text: string; comments: Comment[] } {
		const comments: Comment[] = [];
		let result = '';
		let i = 0;
		let line = 1;
		let column = 1;
		let resultLine = 1;
		let resultColumn = 1;

		while (i < text.length) {
			if (text[i] === '\n') {
				line++;
				column = 1;
				resultLine++;
				resultColumn = 1;
				result += text[i];
				i++;
				continue;
			}

			if (text[i] === '\r') {
				column = 1;
				i++;
				if (i < text.length && text[i] === '\n') {
					line++;
					resultLine++;
					i++;
				}
				result += '\n';
				resultColumn = 1;
				continue;
			}

			if (text[i] === '/' && i + 1 < text.length) {
				const startLine = line;
				const startColumn = column;

				if (text[i + 1] === '/') {
					// Single-line comment
					i += 2;
					column += 2;
					let commentValue = '';

					while (i < text.length && text[i] !== '\n') {
						commentValue += text[i];
						i++;
						column++;
					}

					comments.push({
						type: 'line',
						value: commentValue.trim(),
						line: startLine,
						column: startColumn,
						inline: resultColumn > 1
					});

					continue;
				} else if (text[i + 1] === '*') {
					// Multi-line comment
					i += 2;
					column += 2;
					let commentValue = '';
					let commentLine = startLine;

					while (i < text.length) {
						if (text[i] === '\n') {
							commentLine++;
							column = 1;
							i++;
							commentValue += '\n';
							continue;
						}

						if (text[i] === '\r') {
							column = 1;
							i++;
							if (i < text.length && text[i] === '\n') {
								commentLine++;
								i++;
							}
							commentValue += '\n';
							continue;
						}

						if (text[i] === '*' && i + 1 < text.length && text[i + 1] === '/') {
							i += 2;
							column += 2;
							break;
						}

						commentValue += text[i];
						i++;
						column++;
					}

					comments.push({
						type: 'block',
						value: commentValue.trim(),
						line: startLine,
						column: startColumn,
						inline: resultColumn > 1 && !commentValue.includes('\n')
					});

					continue;
				}
			}

			result += text[i];
			i++;
			column++;
			resultColumn++;
		}

		return { text: result, comments };
	}
}
