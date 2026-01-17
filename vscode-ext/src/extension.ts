import * as vscode from 'vscode';
import { JhonParser } from './parser';
import { JhonFormatter, FormatOptions } from './jhonFormatter';

export function activate(context: vscode.ExtensionContext) {
	console.log('JHON Language Extension is now active!');

	// Register the document formatting provider
	const formatter = vscode.languages.registerDocumentFormattingEditProvider('jhon', {
		provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
			const config = vscode.workspace.getConfiguration('jhon.format');

			const enabled = config.get<boolean>('enable', true);
			if (!enabled) {
				return [];
			}

			const options: FormatOptions = {
				insertSpaces: config.get<boolean>('insertSpaces', false),
				tabSize: config.get<number>('tabSize', 2),
				sortKeys: config.get<boolean>('sortKeys', true),
				trailingCommas: config.get<boolean>('trailingCommas', false),
				alignEquals: config.get<boolean>('alignEquals', false),
				quoteStyle: config.get<string>('quoteStyle', 'auto') as 'double' | 'single' | 'auto'
			};

			const parser = new JhonParser();
			const parseResult = parser.parse(document.getText());

			if (!parseResult.success || !parseResult.value) {
				return [];
			}

			const jhonFormatter = new JhonFormatter(options);
			const formattedText = jhonFormatter.format(parseResult.value, parseResult.comments);

			const fullRange = new vscode.Range(
				document.positionAt(0),
				document.positionAt(document.getText().length)
			);

			return [vscode.TextEdit.replace(fullRange, formattedText)];
		}
	});

	// Register the range formatting provider
	const rangeFormatter = vscode.languages.registerDocumentRangeFormattingEditProvider('jhon', {
		provideDocumentRangeFormattingEdits(
			document: vscode.TextDocument,
			range: vscode.Range
		): vscode.TextEdit[] {
			const config = vscode.workspace.getConfiguration('jhon.format');

			const enabled = config.get<boolean>('enable', true);
			if (!enabled) {
				return [];
			}

			const options: FormatOptions = {
				insertSpaces: config.get<boolean>('insertSpaces', false),
				tabSize: config.get<number>('tabSize', 2),
				sortKeys: config.get<boolean>('sortKeys', true),
				trailingCommas: config.get<boolean>('trailingCommas', false),
				alignEquals: config.get<boolean>('alignEquals', false),
				quoteStyle: config.get<string>('quoteStyle', 'auto') as 'double' | 'single' | 'auto'
			};

			const parser = new JhonParser();
			const parseResult = parser.parse(document.getText(range));

			if (!parseResult.success || !parseResult.value) {
				return [];
			}

			const jhonFormatter = new JhonFormatter(options);
			const formattedText = jhonFormatter.format(parseResult.value, parseResult.comments);

			return [vscode.TextEdit.replace(range, formattedText)];
		}
	});

	context.subscriptions.push(formatter);
	context.subscriptions.push(rangeFormatter);
}

export function deactivate() {
	console.log('JHON Language Extension is now deactivated!');
}
