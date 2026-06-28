import {
  escapeString,
  serializeKey,
  serializeNumber,
  synthesizeAst,
} from './serializer.helpers';
import type {
  AstArray,
  AstDocument,
  AstNode,
  AstObject,
  AstProperty,
  AstString,
  AstValue,
  CommentToken,
  JhonValue,
  SerializeOptions,
  SerializePrettyOptions,
} from './types';

// ============================================================================
// Public entry points
// ============================================================================

export function serialize(value: JhonValue, options?: SerializeOptions): string {
  return serializeAstCompact(synthesizeAst(value), options);
}

export function serializePretty(
  value: JhonValue,
  options?: SerializePrettyOptions
): string {
  return serializeAstPretty(synthesizeAst(value), options);
}

export function serializeAstCompact(
  doc: AstDocument,
  options?: SerializeOptions
): string {
  const ctx: CompactCtx = { sortKeys: options?.sortKeys ?? false, out: '' };
  emitCompactDocument(doc, ctx);
  return ctx.out;
}

export function serializeAstPretty(
  doc: AstDocument,
  options?: SerializePrettyOptions
): string {
  const indent = options?.indent ?? '  ';
  const ctx: PrettyCtx = {
    indent,
    sortKeys: options?.sortKeys ?? false,
    out: '',
  };
  emitPrettyDocument(doc, ctx);
  return ctx.out;
}

// ============================================================================
// Compact serializer
// ============================================================================

interface CompactCtx {
  sortKeys: boolean;
  out: string;
}

function emitCompactDocument(doc: AstDocument, ctx: CompactCtx): void {
  // Leading doc comments → emitted as block comments before content.
  for (const c of doc.leadingComments) emitCompactLeadingComment(c, ctx);
  emitCompactValue(doc.body, ctx, { isTopLevel: true, inArray: false });
  // Trailing doc comments → after content with separator.
  for (const c of doc.trailingComments) {
    ctx.out += ' ';
    emitCompactInlineComment(c, ctx);
  }
}

interface CompactPos {
  isTopLevel: boolean;
  inArray: boolean;
}

function emitCompactValue(
  node: AstValue | AstObject | AstArray,
  ctx: CompactCtx,
  pos: CompactPos
): void {
  // Leading comments emitted inline as block comments.
  for (const c of node.leadingComments) {
    emitCompactInlineComment(c, ctx);
    ctx.out += ' ';
  }

  switch (node.kind) {
    case 'object':
      emitCompactObject(node, ctx, pos);
      break;
    case 'array':
      emitCompactArray(node, ctx, pos);
      break;
    case 'string':
      emitCompactString(node, ctx);
      break;
    case 'number':
      ctx.out += serializeNumber(node.value);
      break;
    case 'boolean':
      ctx.out += node.value ? 'true' : 'false';
      break;
    case 'null':
      // Top-level null (the "Empty" form) emits nothing. Nested nulls emit
      // "null" text.
      if (!pos.isTopLevel) ctx.out += 'null';
      break;
  }

  // Trailing comments inline.
  for (const c of node.trailingComments) {
    ctx.out += ' ';
    emitCompactInlineComment(c, ctx);
  }
}

function emitCompactObject(
  obj: AstObject,
  ctx: CompactCtx,
  pos: CompactPos
): void {
  const props = ctx.sortKeys
    ? [...obj.properties].sort((a, b) => a.key.value.localeCompare(b.key.value))
    : obj.properties;

  if (props.length === 0) {
    // Empty object: nothing at top level (bare form), `{}` when nested/in array.
    if (pos.isTopLevel && !pos.inArray) {
      // emit nothing
    } else {
      ctx.out += '{}';
    }
    return;
  }

  const needsBraces = !pos.isTopLevel || pos.inArray;
  if (needsBraces) ctx.out += '{';

  let first = true;
  for (const prop of props) {
    if (!first) ctx.out += ',';
    first = false;
    emitCompactProperty(prop, ctx);
  }

  if (needsBraces) ctx.out += '}';
}

function emitCompactProperty(prop: AstProperty, ctx: CompactCtx): void {
  ctx.out += serializeKey(prop.key.value);
  ctx.out += '=';
  emitCompactValue(prop.value, ctx, { isTopLevel: false, inArray: false });
  for (const c of prop.trailingComments) {
    ctx.out += ' ';
    emitCompactInlineComment(c, ctx);
  }
}

function emitCompactArray(arr: AstArray, ctx: CompactCtx, pos: CompactPos): void {
  if (arr.elements.length === 0) {
    // Top-level empty array → empty string (the "Empty" form).
    // Nested empty array → "[]".
    if (!pos.isTopLevel) ctx.out += '[]';
    return;
  }
  // Top-level non-empty array → bare (no surrounding []).
  if (!pos.isTopLevel) ctx.out += '[';
  let first = true;
  for (const el of arr.elements) {
    if (!first) ctx.out += ',';
    first = false;
    emitCompactValue(el, ctx, { isTopLevel: false, inArray: true });
  }
  if (!pos.isTopLevel) ctx.out += ']';
}

function emitCompactString(s: AstString, ctx: CompactCtx): void {
  if (s.rawKind === 'raw') {
    ctx.out += 'r' + '#'.repeat(s.rawHashCount ?? 0);
    ctx.out += '"' + s.value + '"';
    ctx.out += '#'.repeat(s.rawHashCount ?? 0);
    return;
  }
  ctx.out += '"' + escapeString(s.value) + '"';
}

function emitCompactLeadingComment(c: CommentToken, ctx: CompactCtx): void {
  // In compact mode, line comments become block comments so output stays on
  // one line.
  emitCompactInlineComment(c, ctx);
}

function emitCompactInlineComment(c: CommentToken, ctx: CompactCtx): void {
  if (c.kind === 'line') {
    // Convert to block to preserve on a single line.
    const body = c.text.replace(/\*/g, '* /');
    ctx.out += `/*${body}*/`;
  } else {
    const body = c.text.replace(/\*\//g, '* /');
    ctx.out += `/*${body}*/`;
  }
}

// ============================================================================
// Pretty serializer (mirrors Rust's serialize_pretty_with_depth)
// ============================================================================

interface PrettyCtx {
  indent: string;
  sortKeys: boolean;
  out: string;
}

function indentStr(ctx: PrettyCtx, depth: number): string {
  return ctx.indent.repeat(depth);
}

function emitPrettyDocument(doc: AstDocument, ctx: PrettyCtx): void {
  emitLeadingComments(doc.leadingComments, ctx, 0);
  // File-leading comments may also land on the body node (e.g. before any
  // property in a top-level object). Emit those too.
  emitLeadingComments(doc.body.leadingComments, ctx, 0);

  const body = doc.body;
  switch (body.kind) {
    case 'object':
      emitPrettyObject(body, ctx, 0, false);
      break;
    case 'array':
      // Top-level array: empty → nothing; non-empty → bare (no surrounding []).
      if (body.elements.length === 0) {
        // emit nothing (the "Empty" form)
      } else {
        emitPrettyTopArray(body, ctx);
      }
      break;
    case 'null':
      // Top-level null (empty input) → emit nothing.
      break;
    default:
      // Top-level scalar: emit the scalar directly.
      emitPrettyValue(body, ctx, 0, false);
      break;
  }

  // Body trailing + doc trailing.
  if (doc.body.trailingComments.length > 0) {
    ctx.out += '\n';
    for (const c of doc.body.trailingComments) {
      ctx.out += prettyCommentLine(c) + '\n';
    }
  }
  if (doc.trailingComments.length > 0) {
    if (!ctx.out.endsWith('\n')) ctx.out += '\n';
    for (const c of doc.trailingComments) {
      ctx.out += prettyCommentLine(c) + '\n';
    }
    ctx.out = ctx.out.slice(0, -1);
  }
}

/**
 * Emit a top-level implicit array (no surrounding []). Each element on its
 * own line at column 0; object literals keep braces since they are array
 * elements, not the implicit top-level form.
 */
function emitPrettyTopArray(arr: AstArray, ctx: PrettyCtx): void {
  let first = true;
  for (const el of arr.elements) {
    if (!first) ctx.out += '\n';
    first = false;

    emitLeadingComments(el.leadingComments, ctx, 0);

    if (el.kind === 'object') {
      // Object element: braces required, body at indent 1, no leading indent.
      // Reuse emitPrettyObject with inArray=true at depth=-1 conceptually;
      // emit inline to control indentation precisely.
      emitPrettyTopArrayObject(el, ctx);
    } else {
      emitPrettyValue(el, ctx, 0, false);
    }

    emitInlineTrailingComments(el.trailingComments, ctx);
  }
}

/** Helper for emitPrettyTopArray: emit an object element at column 0. */
function emitPrettyTopArrayObject(obj: AstObject, ctx: PrettyCtx): void {
  const props = ctx.sortKeys
    ? [...obj.properties].sort((a, b) => a.key.value.localeCompare(b.key.value))
    : obj.properties;

  if (props.length === 0) {
    ctx.out += '{}';
    return;
  }

  ctx.out += '{\n';
  let first = true;
  for (const prop of props) {
    if (!first) ctx.out += '\n';
    first = false;
    ctx.out += indentStr(ctx, 1);
    ctx.out += serializeKey(prop.key.value) + ' = ';
    emitPrettyValue(prop.value, ctx, 1, false);
  }
  ctx.out += '\n}';
}

function emitPrettyValue(
  node: AstValue | AstObject | AstArray,
  ctx: PrettyCtx,
  depth: number,
  inArray: boolean
): void {
  switch (node.kind) {
    case 'object':
      emitPrettyObject(node, ctx, depth, inArray);
      break;
    case 'array':
      emitPrettyArray(node, ctx, depth);
      break;
    case 'string':
      ctx.out += prettyString(node);
      break;
    case 'number':
      ctx.out += serializeNumber(node.value);
      break;
    case 'boolean':
      ctx.out += node.value ? 'true' : 'false';
      break;
    case 'null':
      ctx.out += 'null';
      break;
  }
}

function emitPrettyObject(
  obj: AstObject,
  ctx: PrettyCtx,
  depth: number,
  inArray: boolean
): void {
  const props = ctx.sortKeys
    ? [...obj.properties].sort((a, b) => a.key.value.localeCompare(b.key.value))
    : obj.properties;

  // Empty object handling matches Rust:
  // - top-level/in-object bare: emit nothing
  // - nested in array: emit "{}"
  // - nested elsewhere: emit "{}"
  if (props.length === 0) {
    if (depth === 0 && !inArray) {
      // bare empty top-level — nothing to emit
      return;
    }
    if (obj.innerComments.length > 0) {
      // Emit `{}` with inner comments inside (multi-line).
      if (inArray) {
        ctx.out += indentStr(ctx, depth + 1);
      } else {
        ctx.out += '{';
      }
      if (inArray) ctx.out += '{';
      ctx.out += '\n';
      for (const c of obj.innerComments) {
        ctx.out += indentStr(ctx, depth + (inArray ? 2 : 1));
        emitPrettyLineComment(c, ctx);
        ctx.out += '\n';
      }
      ctx.out += indentStr(ctx, depth + (inArray ? 1 : 0));
      ctx.out += '}';
    } else {
      ctx.out += '{}';
    }
    return;
  }

  // Opening brace for nested objects.
  if (inArray) {
    ctx.out += indentStr(ctx, depth + 1) + '{\n';
  } else if (depth > 0) {
    ctx.out += '{\n';
  }

  let first = true;
  for (const prop of props) {
    if (!first) ctx.out += '\n';
    first = false;

    const innerDepth = inArray ? depth + 2 : depth === 0 ? 0 : depth;
    ctx.out += indentStr(ctx, innerDepth);

    // Leading comments for the property go above it.
    emitLeadingComments(prop.leadingComments, ctx, innerDepth);
    // Leading comments for the key specifically.
    emitLeadingComments(prop.key.leadingComments, ctx, innerDepth);

    ctx.out += serializeKey(prop.key.value);

    // Trailing comments on the key (e.g. `key /* hi */ = 1`) go inline.
    emitInlineTrailingComments(prop.key.trailingComments, ctx);

    ctx.out += ' = ';

    // Leading comments for the value (block only — line comments can't be inline before value safely).
    if (prop.value.leadingComments.length > 0) {
      // Place each on its own line above (rare in practice).
      ctx.out = ctx.out.slice(0, -3); // remove ' = '
      ctx.out += '= ';
      emitInlineLeadingBeforeValue(prop.value.leadingComments, ctx);
    }

    emitPrettyValue(prop.value, ctx, depth + 1, false);

    // Trailing comment for the property (inline).
    emitInlineTrailingComments(prop.value.trailingComments, ctx);
    emitInlineTrailingComments(prop.trailingComments, ctx);
  }

  // Inner comments (after last child) — emit at innerDepth on their own lines.
  for (const c of obj.innerComments) {
    ctx.out += '\n';
    const innerDepth = inArray ? depth + 2 : depth === 0 ? 0 : depth;
    ctx.out += indentStr(ctx, innerDepth);
    emitPrettyLineComment(c, ctx);
  }

  // Closing brace.
  if (inArray) {
    ctx.out += '\n' + indentStr(ctx, depth + 1) + '}';
  } else if (depth > 0) {
    ctx.out += '\n' + indentStr(ctx, depth - 1) + '}';
  }
}

function emitPrettyArray(arr: AstArray, ctx: PrettyCtx, depth: number): void {
  if (arr.elements.length === 0) {
    if (arr.innerComments.length > 0) {
      ctx.out += '[\n';
      for (const c of arr.innerComments) {
        ctx.out += indentStr(ctx, depth + 1);
        emitPrettyLineComment(c, ctx);
        ctx.out += '\n';
      }
      ctx.out += indentStr(ctx, depth) + ']';
    } else {
      ctx.out += '[]';
    }
    return;
  }

  ctx.out += '[\n';

  let first = true;
  for (const el of arr.elements) {
    if (!first) ctx.out += '\n';
    first = false;

    emitLeadingComments(el.leadingComments, ctx, depth + 1);

    if (el.kind === 'object') {
      emitPrettyObject(el, ctx, depth, true);
    } else {
      ctx.out += indentStr(ctx, depth + 1);
      emitPrettyValue(el, ctx, depth + 1, false);
    }

    emitInlineTrailingComments(el.trailingComments, ctx);
  }

  for (const c of arr.innerComments) {
    ctx.out += '\n';
    ctx.out += indentStr(ctx, depth + 1);
    emitPrettyLineComment(c, ctx);
  }

  ctx.out += '\n' + indentStr(ctx, depth) + ']';
}

function prettyString(s: AstString): string {
  if (s.rawKind === 'raw') {
    return 'r' + '#'.repeat(s.rawHashCount ?? 0) + '"' + s.value + '"' + '#'.repeat(s.rawHashCount ?? 0);
  }
  return '"' + escapeString(s.value) + '"';
}

// ============================================================================
// Comment emission helpers
// ============================================================================

function emitLeadingComments(
  comments: CommentToken[],
  ctx: PrettyCtx,
  depth: number
): void {
  if (comments.length === 0) return;
  for (const c of comments) {
    ctx.out += prettyCommentLine(c);
    ctx.out += '\n' + indentStr(ctx, depth);
  }
}

function emitTrailingComments(
  comments: CommentToken[],
  ctx: PrettyCtx,
  _depth: number
): void {
  if (comments.length === 0) return;
  ctx.out += '\n';
  for (const c of comments) {
    ctx.out += prettyCommentLine(c);
    ctx.out += '\n';
  }
  // Trim trailing newline so the result ends with the comment line.
  ctx.out = ctx.out.slice(0, -1);
}

function emitInlineTrailingComments(
  comments: CommentToken[],
  ctx: PrettyCtx
): void {
  for (const c of comments) {
    ctx.out += ' ';
    ctx.out += prettyCommentLine(c);
  }
}

function emitInlineLeadingBeforeValue(
  comments: CommentToken[],
  ctx: PrettyCtx
): void {
  // Rare case: block comment between `=` and value, on same line.
  for (const c of comments) {
    if (c.kind === 'block') {
      ctx.out += '/* ' + c.text.trim() + ' */ ';
    }
  }
}

function emitPrettyLineComment(c: CommentToken, ctx: PrettyCtx): void {
  ctx.out += prettyCommentLine(c);
}

function prettyCommentLine(c: CommentToken): string {
  if (c.kind === 'line') {
    return '//' + c.text;
  }
  return '/*' + c.text + '*/';
}
