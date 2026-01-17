"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const parser_1 = require("./parser");
const jhonFormatter_1 = require("./jhonFormatter");
function activate(context) {
    console.log('JHON Language Extension is now active!');
    // Register the document formatting provider
    const formatter = vscode.languages.registerDocumentFormattingEditProvider('jhon', {
        provideDocumentFormattingEdits(document) {
            const config = vscode.workspace.getConfiguration('jhon.format');
            const enabled = config.get('enable', true);
            if (!enabled) {
                return [];
            }
            const options = {
                insertSpaces: config.get('insertSpaces', false),
                tabSize: config.get('tabSize', 2),
                sortKeys: config.get('sortKeys', true),
                trailingCommas: config.get('trailingCommas', false),
                alignEquals: config.get('alignEquals', false),
                quoteStyle: config.get('quoteStyle', 'auto')
            };
            const parser = new parser_1.JhonParser();
            const parseResult = parser.parse(document.getText());
            if (!parseResult.success || !parseResult.value) {
                return [];
            }
            const jhonFormatter = new jhonFormatter_1.JhonFormatter(options);
            const formattedText = jhonFormatter.format(parseResult.value, parseResult.comments);
            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
            return [vscode.TextEdit.replace(fullRange, formattedText)];
        }
    });
    // Register the range formatting provider
    const rangeFormatter = vscode.languages.registerDocumentRangeFormattingEditProvider('jhon', {
        provideDocumentRangeFormattingEdits(document, range) {
            const config = vscode.workspace.getConfiguration('jhon.format');
            const enabled = config.get('enable', true);
            if (!enabled) {
                return [];
            }
            const options = {
                insertSpaces: config.get('insertSpaces', false),
                tabSize: config.get('tabSize', 2),
                sortKeys: config.get('sortKeys', true),
                trailingCommas: config.get('trailingCommas', false),
                alignEquals: config.get('alignEquals', false),
                quoteStyle: config.get('quoteStyle', 'auto')
            };
            const parser = new parser_1.JhonParser();
            const parseResult = parser.parse(document.getText(range));
            if (!parseResult.success || !parseResult.value) {
                return [];
            }
            const jhonFormatter = new jhonFormatter_1.JhonFormatter(options);
            const formattedText = jhonFormatter.format(parseResult.value, parseResult.comments);
            return [vscode.TextEdit.replace(range, formattedText)];
        }
    });
    context.subscriptions.push(formatter);
    context.subscriptions.push(rangeFormatter);
}
function deactivate() {
    console.log('JHON Language Extension is now deactivated!');
}
//# sourceMappingURL=extension.js.map