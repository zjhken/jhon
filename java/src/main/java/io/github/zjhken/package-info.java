/**
 * Java implementation of JHON (JinHui's Object Notation).
 *
 * <p>Provides parsing and serialization for JHON, a {@code key=value} configuration
 * format. The top level is a flat sequence of key-value pairs (optionally wrapped
 * in {@code { }}), separated by commas or newlines, with {@code //} and
 * {@code /* &#42;/} comments, Rust-style raw strings, and underscore digit
 * separators.
 *
 * <p>Typical usage:
 * <pre>{@code
 * Map<String, Object> doc =
 *     (Map<String, Object>) Jhon.parse("name = \"jhon\"\nversion = 2");
 * String compact = Jhon.serialize(doc);
 * String pretty  = Jhon.serializePretty(doc, "  ", 80);
 * }</pre>
 *
 * <p>The parser is strict per the JHON specification: every error case raises a
 * {@link io.github.zjhken.Jhon.JhonParseException JhonParseException} with 1-based
 * line and column information for precise diagnostics.
 *
 * @see io.github.zjhken.Jhon
 * @since 2.1.1
 */
package io.github.zjhken;
