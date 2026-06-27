export type JhonErrorKind = 'syntax' | 'eof' | 'duplicate-key';

export class JhonParseError extends Error {
  readonly position: number;
  readonly line: number;
  readonly column: number;
  readonly endLine: number;
  readonly endColumn: number;
  readonly kind: JhonErrorKind;
  readonly duplicateKey?: string;

  constructor(args: {
    message: string;
    kind: JhonErrorKind;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    position?: number;
    endPosition?: number;
    duplicateKey?: string;
  }) {
    super(args.message);
    this.name = 'JhonParseError';
    this.kind = args.kind;
    this.line = args.line;
    this.column = args.column;
    this.endLine = args.endLine ?? args.line;
    this.endColumn = args.endColumn ?? args.column + 1;
    this.position = args.position ?? -1;
    this.duplicateKey = args.duplicateKey;
  }

  override toString(): string {
    const where =
      this.kind === 'eof'
        ? `unexpected end of input at ${this.line}:${this.column}`
        : `parse error at ${this.line}:${this.column}`;
    return `${where}: ${this.message}`;
  }
}
