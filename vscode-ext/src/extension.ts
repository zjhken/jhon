import * as vscode from 'vscode';
import {
  JhonParseError,
  parseAst,
  serializeAstCompact,
  serializeAstPretty,
  type SerializeOptions,
  type SerializePrettyOptions,
} from '@zjhken/jhon';

const DEFAULT_DEBOUNCE_MS = 300;

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection('jhon');
  context.subscriptions.push(diagnostics);

  // ---- Live diagnostics (debounced re-parse on text change) ----
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scheduleReparse = (doc: vscode.TextDocument): void => {
    const cfg = vscode.workspace.getConfiguration('jhon.diagnostics');
    if (!cfg.get<boolean>('enable', true)) {
      diagnostics.set(doc.uri, []);
      return;
    }
    const delay = cfg.get<number>('debounceMs', DEFAULT_DEBOUNCE_MS);
    clearTimeout(timer);
    timer = setTimeout(() => updateDiagnostics(diagnostics, doc), delay);
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId !== 'jhon') return;
      scheduleReparse(e.document);
    }),
    vscode.workspace.onDidOpenTextDocument((d) => {
      if (d.languageId === 'jhon') updateDiagnostics(diagnostics, d);
    }),
    vscode.workspace.onDidSaveTextDocument((d) => {
      if (d.languageId === 'jhon') updateDiagnostics(diagnostics, d);
    }),
    vscode.workspace.onDidCloseTextDocument((d) => {
      if (d.languageId === 'jhon') diagnostics.set(d.uri, []);
    })
  );

  // Initial pass for already-open documents.
  for (const doc of vscode.workspace.textDocuments) {
    if (doc.languageId === 'jhon') updateDiagnostics(diagnostics, doc);
  }

  // ---- Format providers ----
  //
  // Both document- and range-format go through `formatWholeDocument`. Earlier
  // the range provider did `formatted.split('\n').slice(startLine, endLine+1)`
  // — assuming formatted line N maps to original line N. It doesn't (formatting
  // changes line counts), so pasting compact JHON truncated the output (only
  // the first few formatted lines survived, leaving unclosed brackets that
  // also looked like indent corruption). Whole-doc format is correct for both
  // entry points; JHON files are typically small configs that don't benefit
  // from sub-document formatting.
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('jhon', {
      provideDocumentFormattingEdits(doc) {
        return formatWholeDocument(doc);
      },
    }),
    vscode.languages.registerDocumentRangeFormattingEditProvider('jhon', {
      provideDocumentRangeFormattingEdits(doc, _range) {
        return formatWholeDocument(doc);
      },
    })
  );

  // ---- Compact format command ----
  context.subscriptions.push(
    vscode.commands.registerCommand('jhon.formatCompact', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'jhon') return;
      try {
        const ast = parseAst(editor.document.getText());
        const compact = serializeAstCompact(ast, readCompactOptions());
        const full = new vscode.Range(
          editor.document.positionAt(0),
          editor.document.positionAt(editor.document.getText().length)
        );
        void editor.edit((b) => b.replace(full, compact));
      } catch {
        // Diagnostics surfaces the error; command is silent on failure.
      }
    })
  );
}

export function deactivate(): void {
  // Subscriptions auto-dispose.
}

function updateDiagnostics(
  collection: vscode.DiagnosticCollection,
  doc: vscode.TextDocument
): void {
  let err: unknown;
  try {
    parseAst(doc.getText());
    collection.set(doc.uri, []);
    return;
  } catch (e) {
    err = e;
  }
  if (!(err instanceof JhonParseError)) {
    collection.set(doc.uri, []);
    return;
  }
  const start = new vscode.Position(
    Math.max(0, err.line - 1),
    Math.max(0, err.column - 1)
  );
  const end = new vscode.Position(
    Math.max(0, err.endLine - 1),
    Math.max(0, err.endColumn - 1)
  );
  const range = new vscode.Range(start, end);
  const diag = new vscode.Diagnostic(
    range,
    err.message,
    vscode.DiagnosticSeverity.Error
  );
  diag.source = 'jhon';
  if (err.kind === 'duplicate-key') {
    diag.code = 'duplicate-key';
  }
  collection.set(doc.uri, [diag]);
}

function readPrettyOptions(): SerializePrettyOptions {
  const cfg = vscode.workspace.getConfiguration('jhon.format');
  const insertSpaces = cfg.get<boolean>('insertSpaces', false);
  const tabSize = cfg.get<number>('tabSize', 2);
  const maxInlineWidth = cfg.get<number>('maxInlineWidth', 44);
  return {
    indent: insertSpaces ? ' '.repeat(tabSize) : '\t',
    sortKeys: cfg.get<boolean>('sortKeys', false),
    maxInlineWidth,
  };
}

/**
 * Parse + pretty-format the whole document, returning a single TextEdit that
 * replaces the full document range with the formatted output. Returns `[]`
 * when formatting is disabled or the document doesn't parse (diagnostics
 * surface the parse error separately).
 *
 * Both the document- and range-format providers call this. Whole-document
 * formatting is correct for both because pretty-printing changes line
 * counts; a slice-based range replacement truncates the output (see comment
 * on the provider registrations above).
 */
function formatWholeDocument(doc: vscode.TextDocument): vscode.TextEdit[] {
  const cfg = vscode.workspace.getConfiguration('jhon.format');
  if (!cfg.get<boolean>('enable', true)) return [];
  try {
    const ast = parseAst(doc.getText());
    const out = serializeAstPretty(ast, readPrettyOptions());
    const full = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(doc.getText().length)
    );
    return [vscode.TextEdit.replace(full, out)];
  } catch {
    return [];
  }
}

function readCompactOptions(): SerializeOptions {
  const cfg = vscode.workspace.getConfiguration('jhon.format');
  return { sortKeys: cfg.get<boolean>('sortKeys', false) };
}
