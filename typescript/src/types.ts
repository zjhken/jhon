// ============================================================================
// Plain JS value types (for parse() / serialize() convenience API)
// ============================================================================

export type JhonValue =
  | string
  | number
  | boolean
  | null
  | JhonObject
  | JhonArray;

export interface JhonObject {
  [key: string]: JhonValue;
}

export type JhonArray = JhonValue[];

// ============================================================================
// Options
// ============================================================================

export interface ParseOptions {
  /**
   * When true (the default and currently the only supported value), the parser
   * enforces all SPEC.md rules. Reserved for future leniency modes.
   * @default true
   */
  strict?: boolean;
}

export interface SerializeOptions {
  /**
   * Sort object keys alphabetically. Default is false (preserve insertion
   * order) per SPEC.md §5.4.
   * @default false
   */
  sortKeys?: boolean;
}

export interface SerializePrettyOptions extends SerializeOptions {
  /**
   * Indentation string used per depth level.
   * @default "  "
   */
  indent?: string;
}

// ============================================================================
// AST types (rich API: parseAst, serializeAstPretty, etc.)
// ============================================================================

export interface SourcePos {
  /** 0-based byte offset into the source. -1 for synthesized nodes. */
  offset: number;
  /** 1-based line number. */
  line: number;
  /** 1-based column number (counts UTF-16 code units). */
  column: number;
}

export interface SourceRange {
  start: SourcePos;
  end: SourcePos;
}

export type CommentKind = 'line' | 'block';

export interface CommentToken {
  kind: CommentKind;
  /** Comment body without the delimiters (line-comment prefix, block-comment open/close markers). */
  text: string;
  range: SourceRange;
  /** True if the comment's first line is the same as some code's last line. */
  inline: boolean;
}

interface AstBase {
  range: SourceRange;
  leadingComments: CommentToken[];
  trailingComments: CommentToken[];
}

export interface AstDocument extends AstBase {
  kind: 'document';
  /**
   * The document body. Per SPEC §2 this can be:
   *   - AstObject: object-mode document (top-level key=value pairs).
   *   - AstArray: array-mode document (bare top-level values).
   *   - AstNull: empty input (the "Empty" form, parses to JSON null).
   *   - Other AstValue variants: a top-level scalar (rare; round-trips
   *     through array mode, e.g. serialize(42) → "42" → parse → [42]).
   */
  body: AstValue;
}

export interface AstObject extends AstBase {
  kind: 'object';
  properties: AstProperty[];
  /** True if the source wrapped the object in `{ ... }`. Informational only. */
  wrapped: boolean;
  /** Comments inside the braces that didn't attach to any property. */
  innerComments: CommentToken[];
}

export interface AstArray extends AstBase {
  kind: 'array';
  elements: AstValue[];
  innerComments: CommentToken[];
}

export interface AstProperty extends AstBase {
  kind: 'property';
  key: AstKey;
  equalsRange: SourceRange;
  value: AstValue;
}

export interface AstKey extends AstBase {
  kind: 'key';
  quoted: boolean;
  quoteChar?: '"' | "'";
  /** Decoded key value (escape sequences resolved for quoted keys). */
  value: string;
}

export type AstValue =
  | AstString
  | AstNumber
  | AstBoolean
  | AstNull
  | AstObject
  | AstArray;

export interface AstString extends AstBase {
  kind: 'string';
  value: string;
  rawKind: 'double' | 'single' | 'raw';
  /** For raw strings: number of `#` delimiters. */
  rawHashCount?: number;
}

export interface AstNumber extends AstBase {
  kind: 'number';
  value: number;
}

export interface AstBoolean extends AstBase {
  kind: 'boolean';
  value: boolean;
}

export interface AstNull extends AstBase {
  kind: 'null';
}

export type AstNode =
  | AstDocument
  | AstObject
  | AstArray
  | AstProperty
  | AstKey
  | AstString
  | AstNumber
  | AstBoolean
  | AstNull;
