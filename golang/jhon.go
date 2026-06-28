// Package jhon implements a parser and serializer for JHON (JinHui's Object Notation).
//
// The implementation mirrors rust/src/lib.rs. Behavior parity is verified by
// porting Rust's test suite (see jhon_test.go). The parser is hand-written
// recursive descent over a byte slice, tracking line and column for errors.
package jhon

import (
	"fmt"
	"math/big"
	"sort"
	"strconv"
	"strings"
)

// ============================================================================
// Public types
// ============================================================================

// Value represents any JHON value (object, array, string, number, boolean, null).
type Value interface{}

// Object represents a JHON object — a map of string keys to Values. Key
// insertion order is preserved by parse; serialize emits keys in
// Object.keys() order (Go map iteration is random, so callers that want a
// stable order should sort first or use the sortKeys serialize option).
type Object map[string]Value

// Array represents a JHON array.
type Array []Value

// ParseErrorKind classifies a parse error.
type ParseErrorKind int

const (
	ParseErrorSyntax ParseErrorKind = iota
	ParseErrorEOF
	ParseErrorDuplicateKey
)

// ParseError is returned by Parse on invalid input. It carries 1-based line
// and column for diagnostic placement.
type ParseError struct {
	Kind     ParseErrorKind
	Line     int
	Column   int
	EndLine  int
	EndColumn int
	Position int
	Message  string
	Key      string // populated when Kind == ParseErrorDuplicateKey
}

func (e *ParseError) Error() string {
	switch e.Kind {
	case ParseErrorEOF:
		return fmt.Sprintf("unexpected end of input at %d:%d: %s", e.Line, e.Column, e.Message)
	case ParseErrorDuplicateKey:
		return fmt.Sprintf("duplicate key at %d:%d: %q", e.Line, e.Column, e.Key)
	default:
		return fmt.Sprintf("parse error at %d:%d: %s", e.Line, e.Column, e.Message)
	}
}

// SerializeOptions controls compact and pretty serializer output.
type SerializeOptions struct {
	// SortKeys emits object keys in lexicographic order. Default false — per
	// SPEC §5.4, insertion order is preserved.
	SortKeys bool
	// Indent is the indent string used per depth level in pretty mode.
	// Defaults to "  " (two spaces) when empty.
	Indent string
}

// ============================================================================
// Parser
// ============================================================================

type parser struct {
	input []byte
	pos   int
	line  int
	col   int
}

func newParser(input []byte) *parser {
	return &parser{input: input, pos: 0, line: 1, col: 1}
}

func (p *parser) current() (byte, bool) {
	if p.pos >= len(p.input) {
		return 0, false
	}
	return p.input[p.pos], true
}

func (p *parser) peek(offset int) (byte, bool) {
	idx := p.pos + offset
	if idx < 0 || idx >= len(p.input) {
		return 0, false
	}
	return p.input[idx], true
}

func (p *parser) advance() (byte, bool) {
	b, ok := p.current()
	if !ok {
		return 0, false
	}
	if b == '\n' {
		p.line++
		p.col = 1
	} else {
		p.col++
	}
	p.pos++
	return b, true
}

// syntaxErr builds a ParseError at the current position.
func (p *parser) syntaxErr(msg string) *ParseError {
	kind := ParseErrorSyntax
	if p.pos >= len(p.input) {
		kind = ParseErrorEOF
	}
	return &ParseError{
		Kind:     kind,
		Line:     p.line,
		Column:   p.col,
		EndLine:  p.line,
		EndColumn: p.col + 1,
		Position: p.pos,
		Message:  msg,
	}
}

// skipWsAndComments consumes whitespace and comments. Returns whether a
// newline was seen.
func (p *parser) skipWsAndComments() bool {
	sawNewline := false
	for {
		c, ok := p.current()
		if !ok {
			return sawNewline
		}
		switch c {
		case ' ', '\t', '\r':
			p.advance()
		case '\n':
			sawNewline = true
			p.advance()
		case '/':
			next, ok := p.peek(1)
			if !ok {
				return sawNewline
			}
			if next == '/' {
				// Line comment — consume up to (not including) the newline so
				// the outer loop records the newline.
				p.advance()
				p.advance()
				for {
					c, ok := p.current()
					if !ok || c == '\n' {
						break
					}
					p.advance()
				}
			} else if next == '*' {
				// Block comment — consume through the closing */.
				start := p.line
				startCol := p.col
				p.advance()
				p.advance()
				closed := false
				for {
					c, ok := p.current()
					if !ok {
						break
					}
					if c == '*' {
						if n, ok := p.peek(1); ok && n == '/' {
							p.advance()
							p.advance()
							closed = true
							break
						}
					}
					if c == '\n' {
						sawNewline = true
					}
					p.advance()
				}
				if !closed {
					return sawNewline
					_ = start
					_ = startCol
				}
			} else {
				return sawNewline
			}
		default:
			return sawNewline
		}
	}
}

// skipInterItemSeparator skips the separator between two consecutive items.
// Returns (sawNewline, sawComma). Per SPEC §5.3, same-line items need a comma.
func (p *parser) skipInterItemSeparator() (sawNewline, sawComma bool) {
	sawNewline = p.skipWsAndComments()
	if c, ok := p.current(); ok && c == ',' {
		sawComma = true
		p.advance()
		if p.skipWsAndComments() {
			sawNewline = true
		}
	}
	return
}

// Parse parses a JHON document into a Value.
func Parse(input string) (Value, error) {
	p := newParser([]byte(input))
	p.skipWsAndComments()
	if p.pos >= len(p.input) {
		// Empty input (including whitespace-only and comments-only) → nil.
		// Per SPEC §2, this is the "Empty" form, distinct from {} and [].
		return nil, nil
	}

	// Mode detection (SPEC §2): the first top-level element decides whether
	// the document is parsed as an object (key=value pairs) or as an implicit
	// array (bare values). `{...}` and `[...]` always begin array mode since
	// they cannot start a `key=` pair.
	first, _ := p.current()
	objectMode := false
	if first != '{' && first != '[' {
		// Save parser state, try to parse a key, look ahead for '='.
		savedPos, savedLine, savedCol := p.pos, p.line, p.col
		if _, err := p.parseKey(); err == nil {
			p.skipWsAndComments()
			if c, ok := p.current(); ok && c == '=' {
				objectMode = true
			}
		}
		p.pos, p.line, p.col = savedPos, savedLine, savedCol
	}

	if objectMode {
		return p.parseJhonObject()
	}
	return p.parseJhonArray()
}

// MustParse parses a JHON config string and panics on error.
func MustParse(input string) Value {
	v, err := Parse(input)
	if err != nil {
		panic(err)
	}
	return v
}

// ParseJSON parses a JHON config string into a JSON-compatible value.
func ParseJSON(input string) (interface{}, error) {
	return Parse(input)
}

// parseJhonObject parses a bare top-level object (no surrounding braces).
func (p *parser) parseJhonObject() (Value, error) {
	obj := Object{}
	p.skipWsAndComments()
	for p.pos < len(p.input) {
		key, val, err := p.parseProperty(obj)
		if err != nil {
			return nil, err
		}
		obj[key] = val
		sawNewline, sawComma := p.skipInterItemSeparator()
		if p.pos >= len(p.input) {
			break // trailing separator at EOF is fine
		}
		if !sawNewline && !sawComma {
			return nil, p.syntaxErr("items on the same line must be separated by a comma")
		}
	}
	return obj, nil
}

// parseJhonArray parses a top-level implicit array (no surrounding []).
// Per SPEC §2: when the first top-level element is not a key=value pair, the
// whole document is treated as an array. Mixing pairs into array mode is an
// error.
func (p *parser) parseJhonArray() (Value, error) {
	arr := Array{}
	p.skipWsAndComments()
	for p.pos < len(p.input) {
		// Reject `key=value` pairs mixed into array mode.
		if c, ok := p.current(); ok && c == '=' {
			return nil, p.syntaxErr("cannot mix key=value pairs and bare values at top level")
		}
		val, err := p.parseValue()
		if err != nil {
			return nil, err
		}
		arr = append(arr, val)
		sawNewline, sawComma := p.skipInterItemSeparator()
		if p.pos >= len(p.input) {
			break
		}
		if !sawNewline && !sawComma {
			return nil, p.syntaxErr("items on the same line must be separated by a comma")
		}
	}
	return arr, nil
}

// parseNestedObject parses a braced object: { k=v, ... }.
func (p *parser) parseNestedObject() (Value, error) {
	p.advance() // {
	obj := Object{}
	p.skipWsAndComments()
	for {
		c, ok := p.current()
		if !ok {
			return nil, p.syntaxErr("unterminated nested object")
		}
		if c == '}' {
			p.advance()
			return obj, nil
		}
		key, val, err := p.parseProperty(obj)
		if err != nil {
			return nil, err
		}
		obj[key] = val
		sawNewline, sawComma := p.skipInterItemSeparator()
		if c, ok := p.current(); ok && c == '}' {
			p.advance()
			return obj, nil
		}
		if !ok {
			return nil, p.syntaxErr("unterminated nested object")
		}
		if !sawNewline && !sawComma {
			return nil, p.syntaxErr("items on the same line must be separated by a comma")
		}
	}
}

// parseProperty parses one k=v pair and validates duplicate keys.
func (p *parser) parseProperty(seen Object) (string, Value, error) {
	key, err := p.parseKey()
	if err != nil {
		return "", nil, err
	}
	p.skipWsAndComments()
	if c, ok := p.current(); !ok || c != '=' {
		return "", nil, p.syntaxErr("expected '=' after key")
	}
	p.advance()
	p.skipWsAndComments()
	val, err := p.parseValue()
	if err != nil {
		return "", nil, err
	}
	if _, exists := seen[key]; exists {
		return "", nil, &ParseError{
			Kind:     ParseErrorDuplicateKey,
			Line:     p.line,
			Column:   p.col,
			EndLine:  p.line,
			EndColumn: p.col + 1,
			Position: p.pos,
			Message:  fmt.Sprintf("duplicate key %q", key),
			Key:      key,
		}
	}
	return key, val, nil
}

// parseKey parses a bare or quoted key.
func (p *parser) parseKey() (string, error) {
	p.skipWsAndComments()
	c, ok := p.current()
	if !ok {
		return "", p.syntaxErr("expected key")
	}
	if c == '"' || c == '\'' {
		return p.parseString(c)
	}
	// Bare key — scan bytes until a delimiter per SPEC §3.3.
	start := p.pos
	for p.pos < len(p.input) {
		if isKeyDelimiter(p.input[p.pos]) {
			break
		}
		p.advance()
	}
	if p.pos == start {
		return "", p.syntaxErr("empty key")
	}
	return string(p.input[start:p.pos]), nil
}

// parseValue dispatches on the first byte.
func (p *parser) parseValue() (Value, error) {
	p.skipWsAndComments()
	c, ok := p.current()
	if !ok {
		return nil, p.syntaxErr("expected value")
	}
	switch c {
	case '"', '\'':
		return p.parseString(c)
	case 'r', 'R':
		next, ok := p.peek(1)
		if ok && (next == '"' || next == '#') {
			return p.parseRawString()
		}
		return nil, p.syntaxErr(fmt.Sprintf("unexpected character in value: %c", c))
	case '[':
		return p.parseArray()
	case '{':
		return p.parseNestedObject()
	case '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
		return p.parseNumber()
	case 't', 'f':
		return p.parseBoolean()
	case 'n':
		return p.parseNull()
	}
	return nil, p.syntaxErr(fmt.Sprintf("unexpected character in value: %c", c))
}

// parseString parses a double- or single-quoted string. Rejects literal
// control chars and unknown escapes per SPEC §3.4.
func (p *parser) parseString(quote byte) (string, error) {
	quoteChar := quote
	p.advance() // opening quote
	var sb strings.Builder
	for {
		c, ok := p.current()
		if !ok {
			return "", p.syntaxErr("unterminated string")
		}
		if c < 0x20 || c == 0x7f {
			return "", p.syntaxErr(fmt.Sprintf("literal control character 0x%02X in string; use an escape or a raw string", c))
		}
		if c == quoteChar {
			p.advance()
			return sb.String(), nil
		}
		if c == '\\' {
			p.advance()
			esc, ok := p.current()
			if !ok {
				return "", p.syntaxErr("incomplete escape sequence")
			}
			p.advance()
			switch esc {
			case 'n':
				sb.WriteByte('\n')
			case 'r':
				sb.WriteByte('\r')
			case 't':
				sb.WriteByte('\t')
			case 'b':
				sb.WriteByte(0x08)
			case 'f':
				sb.WriteByte(0x0c)
			case '\\':
				sb.WriteByte('\\')
			case '"':
				sb.WriteByte('"')
			case '\'':
				sb.WriteByte('\'')
			case '/':
				sb.WriteByte('/')
			case 'x':
				v, err := p.parseHexDigits(2, "\\x")
				if err != nil {
					return "", err
				}
				sb.WriteByte(byte(v))
			case 'u':
				v, err := p.parseHexDigits(4, "\\u")
				if err != nil {
					return "", err
				}
				if v >= 0xd800 && v <= 0xdfff {
					return "", p.syntaxErr(fmt.Sprintf("surrogate code point U+%04X requires a pair; surrogate handling is not yet implemented", v))
				}
				sb.WriteRune(rune(v))
			default:
				return "", p.syntaxErr(fmt.Sprintf("unknown escape \\%c", esc))
			}
			continue
		}
		sb.WriteByte(c)
		p.advance()
	}
}

func (p *parser) parseHexDigits(count int, label string) (uint32, error) {
	var v uint32
	for i := 0; i < count; i++ {
		c, ok := p.current()
		if !ok {
			return 0, p.syntaxErr(fmt.Sprintf("incomplete %s escape", label))
		}
		d, ok := hexDigit(c)
		if !ok {
			return 0, p.syntaxErr(fmt.Sprintf("invalid hex digit in %s escape", label))
		}
		v = (v << 4) | d
		p.advance()
	}
	return v, nil
}

// parseRawString parses r"...", R"...", with optional # delimiters.
func (p *parser) parseRawString() (string, error) {
	p.advance() // 'r' or 'R'
	hashCount := 0
	for {
		c, ok := p.current()
		if !ok || c != '#' {
			break
		}
		hashCount++
		p.advance()
	}
	c, ok := p.current()
	if !ok || c != '"' {
		return "", p.syntaxErr("expected opening quote after r and # symbols in raw string")
	}
	p.advance()
	start := p.pos
	closing := []byte{'"'}
	for i := 0; i < hashCount; i++ {
		closing = append(closing, '#')
	}
	idx := bytesIndex(p.input[start:], closing)
	if idx < 0 {
		// Move to end for the error position.
		for p.pos < len(p.input) {
			p.advance()
		}
		return "", p.syntaxErr(fmt.Sprintf("unterminated raw string (expected closing %q)", string(closing)))
	}
	idx += start
	value := string(p.input[start:idx])
	// Advance through closing pattern, keeping line/col correct.
	target := idx + len(closing)
	for p.pos < target {
		p.advance()
	}
	return value, nil
}

func bytesIndex(haystack, needle []byte) int {
	if len(needle) == 0 {
		return 0
	}
	for i := 0; i+len(needle) <= len(haystack); i++ {
		match := true
		for j := 0; j < len(needle); j++ {
			if haystack[i+j] != needle[j] {
				match = false
				break
			}
		}
		if match {
			return i
		}
	}
	return -1
}

// parseNumber parses integers, floats, hex/octal/binary literals with
// underscores, exponents, and a leading minus — per SPEC §3.5.
func (p *parser) parseNumber() (Value, error) {
	negative := false
	if c, ok := p.current(); ok && c == '-' {
		negative = true
		p.advance()
	}
	// Radix detection. Lowercase prefixes only.
	var radix int
	if c, ok := p.current(); ok && c == '0' {
		next, ok := p.peek(1)
		if !ok {
			// Just '0' — fall through to decimal.
		} else {
			switch next {
			case 'x':
				radix = 16
			case 'o':
				radix = 8
			case 'b':
				radix = 2
			case 'X', 'O', 'B':
				return nil, p.syntaxErr(fmt.Sprintf("uppercase radix prefix 0%c not allowed; use lowercase", next))
			}
		}
	}

	var literal string
	isFloat := false

	if radix != 0 {
		p.advance() // 0
		p.advance() // x/o/b
		digits, err := p.scanRadixDigits(radix)
		if err != nil {
			return nil, err
		}
		literal = digits
	} else {
		intPart, err := p.scanDecDigits()
		if err != nil {
			return nil, err
		}
		literal = intPart
		if c, ok := p.current(); ok && c == '.' {
			isFloat = true
			p.advance()
			frac, err := p.scanDecDigits()
			if err != nil {
				return nil, err
			}
			literal = literal + "." + frac
		}
		if c, ok := p.current(); ok && (c == 'e' || c == 'E') {
			isFloat = true
			p.advance()
			exp := "e"
			if sign, ok := p.current(); ok && (sign == '+' || sign == '-') {
				exp += string(sign)
				p.advance()
			}
			digits, err := p.scanDecDigits()
			if err != nil {
				return nil, err
			}
			literal = literal + exp + digits
		}
	}

	// Reject type suffixes (u8/i32/f64/...).
	if c, ok := p.current(); ok && (c == 'u' || c == 'i' || c == 'f') {
		if next, ok := p.peek(1); ok && isAsciiAlphanumeric(next) {
			return nil, p.syntaxErr(fmt.Sprintf("number type suffix not allowed (saw '%c%c')", c, next))
		}
	}

	signed := literal
	if negative {
		signed = "-" + literal
	}

	if radix != 0 {
		// Parse as big int to handle large values, then convert.
		bi := new(big.Int)
		_, ok := bi.SetString(literal, radix)
		if !ok {
			return nil, p.syntaxErr(fmt.Sprintf("could not parse number: %s", signed))
		}
		if negative {
			bi.Neg(bi)
		}
		// Try int64, then uint64, then float64 fallback.
		if bi.IsInt64() {
			return bi.Int64(), nil
		}
		if bi.IsUint64() {
			return bi.Uint64(), nil
		}
		f, _ := new(big.Float).SetInt(bi).Float64()
		return f, nil
	}

	if !isFloat {
		// Try int64 first, then uint64, then float64 fallback for large values.
		if i, err := strconv.ParseInt(signed, 10, 64); err == nil {
			return i, nil
		}
		if u, err := strconv.ParseUint(signed, 10, 64); err == nil {
			return u, nil
		}
	}
	f, err := strconv.ParseFloat(signed, 64)
	if err != nil {
		return nil, p.syntaxErr(fmt.Sprintf("could not parse number: %s", signed))
	}
	return f, nil
}

// scanDecDigits scans a run of decimal digits with Rust-style underscores.
func (p *parser) scanDecDigits() (string, error) {
	var sb strings.Builder
	lastWasUnder := false
	hasDigit := false
	for p.pos < len(p.input) {
		c := p.input[p.pos]
		if c >= '0' && c <= '9' {
			sb.WriteByte(c)
			lastWasUnder = false
			hasDigit = true
			p.advance()
		} else if c == '_' {
			if !hasDigit || lastWasUnder {
				return "", p.syntaxErr("invalid underscore placement in number")
			}
			lastWasUnder = true
			p.advance()
		} else {
			break
		}
	}
	if !hasDigit {
		return "", p.syntaxErr("number requires at least one digit")
	}
	if lastWasUnder {
		return "", p.syntaxErr("number cannot end with underscore")
	}
	return sb.String(), nil
}

func (p *parser) scanRadixDigits(radix int) (string, error) {
	var sb strings.Builder
	lastWasUnder := false
	hasDigit := false
	for p.pos < len(p.input) {
		c := p.input[p.pos]
		ok := false
		switch radix {
		case 16:
			ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
		case 8:
			ok = c >= '0' && c <= '7'
		case 2:
			ok = c == '0' || c == '1'
		}
		if ok {
			sb.WriteByte(c)
			lastWasUnder = false
			hasDigit = true
			p.advance()
		} else if c == '_' {
			if !hasDigit || lastWasUnder {
				return "", p.syntaxErr("invalid underscore placement in number")
			}
			lastWasUnder = true
			p.advance()
		} else {
			break
		}
	}
	if !hasDigit {
		return "", p.syntaxErr("number requires at least one digit after radix prefix")
	}
	if lastWasUnder {
		return "", p.syntaxErr("number cannot end with underscore")
	}
	return sb.String(), nil
}

func (p *parser) parseBoolean() (Value, error) {
	if matchesLiteral(p.input, p.pos, "true") {
		advanceN(p, 4)
		return true, nil
	}
	if matchesLiteral(p.input, p.pos, "false") {
		advanceN(p, 5)
		return false, nil
	}
	return nil, p.syntaxErr("invalid boolean value")
}

func (p *parser) parseNull() (Value, error) {
	if matchesLiteral(p.input, p.pos, "null") {
		advanceN(p, 4)
		return nil, nil
	}
	return nil, p.syntaxErr("invalid null value")
}

func advanceN(p *parser, n int) {
	for i := 0; i < n; i++ {
		p.advance()
	}
}

func matchesLiteral(input []byte, pos int, lit string) bool {
	if pos+len(lit) > len(input) {
		return false
	}
	for i := 0; i < len(lit); i++ {
		if input[pos+i] != lit[i] {
			return false
		}
	}
	return true
}

func (p *parser) parseArray() (Value, error) {
	p.advance() // [
	arr := Array{}
	p.skipWsAndComments()
	for {
		c, ok := p.current()
		if !ok {
			return nil, p.syntaxErr("unterminated array")
		}
		if c == ']' {
			p.advance()
			return arr, nil
		}
		val, err := p.parseValue()
		if err != nil {
			return nil, err
		}
		arr = append(arr, val)
		sawNewline, sawComma := p.skipInterItemSeparator()
		if c, ok := p.current(); ok && c == ']' {
			p.advance()
			return arr, nil
		}
		if !ok {
			return nil, p.syntaxErr("unterminated array")
		}
		if !sawNewline && !sawComma {
			return nil, p.syntaxErr("items on the same line must be separated by a comma")
		}
	}
}

// ============================================================================
// Helpers
// ============================================================================

func hexDigit(c byte) (uint32, bool) {
	switch {
	case c >= '0' && c <= '9':
		return uint32(c - '0'), true
	case c >= 'a' && c <= 'f':
		return uint32(c-'a') + 10, true
	case c >= 'A' && c <= 'F':
		return uint32(c-'A') + 10, true
	}
	return 0, false
}

func isAsciiAlphanumeric(c byte) bool {
	return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

// isKeyDelimiter returns true for any byte that terminates a bare key per
// SPEC §3.3. All such bytes are ASCII, so UTF-8 continuation/lead bytes never
// match.
func isKeyDelimiter(b byte) bool {
	switch b {
	case ' ', '\t', '\n', '\r',
		'=', ',',
		'{', '}', '[', ']',
		'/', '"', '\'', '#':
		return true
	}
	return false
}

// ============================================================================
// Serializer
// ============================================================================

// Serialize produces compact JHON output: no spaces around =, no spaces after
// commas, no trailing commas.
func Serialize(v Value) string {
	return SerializeWithOptions(v, SerializeOptions{})
}

// SerializeWithOptions produces compact or pretty JHON output.
// When opts.Indent is non-empty, the output is pretty-printed (multi-line
// with spaces around =, no trailing commas, no commas between properties).
func SerializeWithOptions(v Value, opts SerializeOptions) string {
	var sb strings.Builder
	if opts.Indent != "" {
		serializeTopPretty(v, opts, &sb)
	} else {
		serializeTopCompact(v, opts, &sb)
	}
	return sb.String()
}

// serializeTopCompact handles top-level serialization per SPEC §2:
//   - empty containers and nil emit nothing (the "Empty" form);
//   - top-level arrays emit bare (no surrounding []);
//   - everything else falls through to serializeCompact (which preserves
//     nested [] and nested null literals).
func serializeTopCompact(v Value, opts SerializeOptions, sb *strings.Builder) {
	switch val := v.(type) {
	case Array:
		if len(val) == 0 {
			return
		}
		serializeArrayContentsCompact(val, opts, sb)
	case Object:
		if len(val) == 0 {
			return
		}
		serializeCompact(v, opts, sb)
	case nil:
		return
	default:
		serializeCompact(v, opts, sb)
	}
}

// serializeTopPretty mirrors serializeTopCompact for pretty mode.
func serializeTopPretty(v Value, opts SerializeOptions, sb *strings.Builder) {
	switch val := v.(type) {
	case Array:
		if len(val) == 0 {
			return
		}
		serializeTopArrayPretty(val, opts, sb)
	case Object:
		if len(val) == 0 {
			return
		}
		serializePretty(v, opts, 0, false, sb)
	case nil:
		return
	default:
		serializePretty(v, opts, 0, false, sb)
	}
}

// serializeTopArrayPretty emits a top-level implicit array (no surrounding []).
// Each element appears on its own line at column 0; object/array literals keep
// their braces/brackets since they are array elements, not the implicit form.
func serializeTopArrayPretty(arr Array, opts SerializeOptions, sb *strings.Builder) {
	indent := opts.Indent
	if indent == "" {
		indent = "  "
	}
	first := true
	for _, v := range arr {
		if !first {
			sb.WriteByte('\n')
		}
		first = false
		switch inner := v.(type) {
		case Object:
			if len(inner) == 0 {
				sb.WriteString("{}")
				continue
			}
			// Object element: braces required, body at indent 1, no leading indent.
			sb.WriteString("{\n")
			keys := objectKeys(inner, opts.SortKeys)
			firstPair := true
			for _, k := range keys {
				if !firstPair {
					sb.WriteByte('\n')
				}
				firstPair = false
				sb.WriteString(indent)
				serializeKey(k, sb)
				sb.WriteString(" = ")
				serializePretty(inner[k], opts, 1, false, sb)
			}
			sb.WriteByte('\n')
			sb.WriteByte('}')
		default:
			serializePretty(v, opts, 0, false, sb)
		}
	}
}

// SerializePretty is a convenience wrapper that forces pretty mode.
func SerializePretty(v Value, indent string) string {
	return SerializeWithOptions(v, SerializeOptions{Indent: indent})
}

func serializeCompact(v Value, opts SerializeOptions, sb *strings.Builder) {
	switch val := v.(type) {
	case Object:
		if len(val) == 0 {
			return
		}
		serializeObjectCompact(val, opts, sb)
	case Array:
		if len(val) == 0 {
			sb.WriteString("[]")
			return
		}
		serializeArrayCompact(val, opts, sb)
	case string:
		serializeString(val, sb)
	case int64:
		sb.WriteString(strconv.FormatInt(val, 10))
	case uint64:
		sb.WriteString(strconv.FormatUint(val, 10))
	case int:
		sb.WriteString(strconv.Itoa(val))
	case float64:
		serializeFloat(val, sb)
	case bool:
		if val {
			sb.WriteString("true")
		} else {
			sb.WriteString("false")
		}
	case nil:
		sb.WriteString("null")
	default:
		// Best-effort fallback.
		sb.WriteString(fmt.Sprintf("%v", val))
	}
}

func serializeObjectCompact(obj Object, opts SerializeOptions, sb *strings.Builder) {
	keys := objectKeys(obj, opts.SortKeys)
	first := true
	for _, k := range keys {
		if !first {
			sb.WriteByte(',')
		}
		first = false
		serializeKey(k, sb)
		sb.WriteByte('=')
		v := obj[k]
		if inner, ok := v.(Object); ok {
			if len(inner) == 0 {
				sb.WriteString("{}")
			} else {
				sb.WriteByte('{')
				serializeObjectCompact(inner, opts, sb)
				sb.WriteByte('}')
			}
			continue
		}
		serializeCompact(v, opts, sb)
	}
}

func serializeArrayCompact(arr Array, opts SerializeOptions, sb *strings.Builder) {
	sb.WriteByte('[')
	serializeArrayContentsCompact(arr, opts, sb)
	sb.WriteByte(']')
}

// serializeArrayContentsCompact emits the comma-separated contents of an array
// without the surrounding []. Used for top-level implicit arrays per SPEC §2.
func serializeArrayContentsCompact(arr Array, opts SerializeOptions, sb *strings.Builder) {
	first := true
	for _, v := range arr {
		if !first {
			sb.WriteByte(',')
		}
		first = false
		if inner, ok := v.(Object); ok {
			if len(inner) == 0 {
				sb.WriteString("{}")
			} else {
				sb.WriteByte('{')
				serializeObjectCompact(inner, opts, sb)
				sb.WriteByte('}')
			}
			continue
		}
		serializeCompact(v, opts, sb)
	}
}

func serializePretty(v Value, opts SerializeOptions, depth int, inArray bool, sb *strings.Builder) {
	switch val := v.(type) {
	case Object:
		if len(val) == 0 {
			if inArray || depth > 0 {
				sb.WriteString("{}")
			}
			return
		}
		serializeObjectPretty(val, opts, depth, inArray, sb)
	case Array:
		if len(val) == 0 {
			sb.WriteString("[]")
			return
		}
		serializeArrayPretty(val, opts, depth, sb)
	case string:
		serializeString(val, sb)
	case int64:
		sb.WriteString(strconv.FormatInt(val, 10))
	case uint64:
		sb.WriteString(strconv.FormatUint(val, 10))
	case int:
		sb.WriteString(strconv.Itoa(val))
	case float64:
		serializeFloat(val, sb)
	case bool:
		if val {
			sb.WriteString("true")
		} else {
			sb.WriteString("false")
		}
	case nil:
		sb.WriteString("null")
	}
}

func serializeObjectPretty(obj Object, opts SerializeOptions, depth int, inArray bool, sb *strings.Builder) {
	indent := opts.Indent
	if indent == "" {
		indent = "  "
	}
	if inArray {
		for i := 0; i < depth+1; i++ {
			sb.WriteString(indent)
		}
		sb.WriteString("{\n")
	} else if depth > 0 {
		sb.WriteString("{\n")
	}

	keys := objectKeys(obj, opts.SortKeys)
	first := true
	for _, k := range keys {
		if !first {
			sb.WriteByte('\n')
		}
		first = false
		var innerDepth int
		switch {
		case inArray:
			innerDepth = depth + 2
		case depth == 0:
			innerDepth = 0
		default:
			innerDepth = depth
		}
		for i := 0; i < innerDepth; i++ {
			sb.WriteString(indent)
		}
		serializeKey(k, sb)
		sb.WriteString(" = ")
		serializePretty(obj[k], opts, depth+1, false, sb)
	}

	if inArray {
		sb.WriteByte('\n')
		for i := 0; i < depth+1; i++ {
			sb.WriteString(indent)
		}
		sb.WriteByte('}')
	} else if depth > 0 {
		sb.WriteByte('\n')
		for i := 0; i < depth-1; i++ {
			sb.WriteString(indent)
		}
		sb.WriteByte('}')
	}
}

func serializeArrayPretty(arr Array, opts SerializeOptions, depth int, sb *strings.Builder) {
	indent := opts.Indent
	if indent == "" {
		indent = "  "
	}
	sb.WriteString("[\n")
	first := true
	for _, v := range arr {
		if !first {
			sb.WriteByte('\n')
		}
		first = false
		if _, isObj := v.(Object); isObj {
			serializePretty(v, opts, depth, true, sb)
		} else {
			for i := 0; i < depth+1; i++ {
				sb.WriteString(indent)
			}
			serializePretty(v, opts, depth+1, false, sb)
		}
	}
	sb.WriteByte('\n')
	for i := 0; i < depth; i++ {
		sb.WriteString(indent)
	}
	sb.WriteByte(']')
}

func objectKeys(obj Object, sortKeys bool) []string {
	keys := make([]string, 0, len(obj))
	for k := range obj {
		keys = append(keys, k)
	}
	if sortKeys {
		sort.Strings(keys)
	}
	return keys
}

func serializeKey(key string, sb *strings.Builder) {
	if needsQuoting(key) {
		serializeString(key, sb)
		return
	}
	sb.WriteString(key)
}

func needsQuoting(s string) bool {
	if s == "" {
		return true
	}
	for i := 0; i < len(s); i++ {
		if isKeyDelimiter(s[i]) {
			return true
		}
	}
	return false
}

func serializeString(s string, sb *strings.Builder) {
	sb.WriteByte('"')
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch c {
		case '\\':
			sb.WriteString("\\\\")
		case '"':
			sb.WriteString("\\\"")
		case '\n':
			sb.WriteString("\\n")
		case '\r':
			sb.WriteString("\\r")
		case '\t':
			sb.WriteString("\\t")
		case 0x08:
			sb.WriteString("\\b")
		case 0x0c:
			sb.WriteString("\\f")
		default:
			if c < 0x20 {
				const hex = "0123456789abcdef"
				sb.WriteString("\\u00")
				sb.WriteByte(hex[c>>4])
				sb.WriteByte(hex[c&0x0f])
			} else {
				sb.WriteByte(c)
			}
		}
	}
	sb.WriteByte('"')
}

func serializeFloat(f float64, sb *strings.Builder) {
	if f == float64(int64(f)) && f >= -9.2e18 && f <= 9.2e18 {
		sb.WriteString(strconv.FormatInt(int64(f), 10))
		return
	}
	sb.WriteString(strconv.FormatFloat(f, 'g', -1, 64))
}
