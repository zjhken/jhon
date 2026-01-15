// Package jhon implements a parser and serializer for JHON (JinHui's Object Notation).
// JHON is a human-readable configuration format as an alternative to JSON.
package jhon

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

// =============================================================================
// Types
// =============================================================================

// Value represents any JHON value (object, array, string, number, boolean, null)
type Value interface{}

// Object represents a JHON object (map of string keys to Values)
type Object map[string]Value

// Array represents a JHON array (slice of Values)
type Array []Value

// ParseError represents an error that occurred during parsing
type ParseError struct {
	Message  string
	Position int
}

func (e *ParseError) Error() string {
	if e.Position >= 0 {
		return fmt.Sprintf("parse error at position %d: %s", e.Position, e.Message)
	}
	return fmt.Sprintf("parse error: %s", e.Message)
}

// =============================================================================
// Parser
// =============================================================================

// parser represents the JHON parser state
type parser struct {
	input string
	pos   int
	len   int
}

// Parse parses a JHON config string into a generic Value
func Parse(input string) (Value, error) {
	input = removeComments(input)
	input = strings.TrimSpace(input)

	if input == "" {
		return Object{}, nil
	}

	p := &parser{input: input, pos: 0, len: len(input)}

	// Handle top-level objects wrapped in braces (from serialize)
	if strings.HasPrefix(input, "{") && strings.HasSuffix(input, "}") {
		return p.parseNestedObject()
	}

	return p.parseJhonObject()
}

// MustParse parses a JHON config string and panics on error
func MustParse(input string) Value {
	v, err := Parse(input)
	if err != nil {
		panic(err)
	}
	return v
}

// ParseJSON parses a JHON config string into a JSON-compatible value
// The result can be marshaled to JSON using encoding/json
func ParseJSON(input string) (interface{}, error) {
	return Parse(input)
}

// removeComments removes // and /* */ style comments from input
func removeComments(input string) string {
	var result strings.Builder
	i := 0
	lenInput := len(input)

	for i < lenInput {
		c := input[i]

		if c == '/' && i+1 < lenInput {
			nextChar := input[i+1]

			if nextChar == '/' {
				// Single line comment: consume until newline
				i += 2
				for i < lenInput && input[i] != '\n' {
					i++
				}
				continue
			} else if nextChar == '*' {
				// Multi-line comment: consume until */
				i += 2
				foundEnd := false
				for i < lenInput {
					if input[i] == '*' && i+1 < lenInput && input[i+1] == '/' {
						i += 2
						foundEnd = true
						break
					}
					i++
				}
				if !foundEnd {
					// Unterminated multi-line comment, treat as literal
					result.WriteString("/*")
				}
				continue
			}
		}

		result.WriteByte(c)
		i++
	}

	return result.String()
}

// skipSeparators skips commas and newlines
func (p *parser) skipSeparators() {
	for p.pos < p.len {
		c := p.input[p.pos]
		if c == '\n' || c == ',' {
			p.pos++
		} else {
			break
		}
	}
}

// peekSeparator checks if there's a separator (comma, newline, or spaces) ahead
func (p *parser) peekSeparator(closingChar byte) bool {
	tempPos := p.pos
	foundSpace := false
	for tempPos < p.len {
		c := p.input[tempPos]
		if c == ' ' || c == '\t' {
			tempPos++
			foundSpace = true
		} else if c == '\n' || c == ',' {
			return true
		} else if c == closingChar && closingChar != 0 {
			return true
		} else if foundSpace {
			// Found spaces before a non-separator character, spaces count as separator
			return true
		} else {
			return false
		}
	}
	return foundSpace || closingChar == 0
}

// skipWhitespace skips all whitespace characters
func (p *parser) skipWhitespace() {
	for p.pos < p.len && isWhitespace(p.input[p.pos]) {
		p.pos++
	}
}

// skipSpacesAndTabs skips only spaces and tabs (not newlines)
func (p *parser) skipSpacesAndTabs() {
	for p.pos < p.len {
		c := p.input[p.pos]
		if c == ' ' || c == '\t' {
			p.pos++
		} else {
			break
		}
	}
}

// parseJhonObject parses a top-level JHON object
func (p *parser) parseJhonObject() (Value, error) {
	obj := make(Object)
	isFirst := true

	for p.pos < p.len {
		if !isFirst {
			if !p.peekSeparator(0) {
				return nil, &ParseError{Message: "expected comma or newline between properties", Position: p.pos}
			}
			p.skipSeparators()
		}

		p.skipSpacesAndTabs()

		if p.pos >= p.len {
			break
		}

		key, err := p.parseKey()
		if err != nil {
			return nil, err
		}

		p.skipWhitespace()

		if p.pos >= p.len || p.input[p.pos] != '=' {
			return nil, &ParseError{Message: "expected '=' after key", Position: p.pos}
		}
		p.pos++

		p.skipWhitespace()

		value, err := p.parseValue()
		if err != nil {
			return nil, err
		}

		obj[key] = value
		isFirst = false
	}

	return obj, nil
}

// parseNestedObject parses a nested JHON object {key=value, ...}
func (p *parser) parseNestedObject() (Value, error) {
	if p.pos >= p.len || p.input[p.pos] != '{' {
		return nil, &ParseError{Message: "expected '{'", Position: p.pos}
	}
	p.pos++

	obj := make(Object)
	isFirst := true

	for p.pos < p.len {
		if !isFirst {
			if !p.peekSeparator('}') {
				return nil, &ParseError{Message: "expected comma or newline between object properties", Position: p.pos}
			}
			p.skipSeparators()
		}

		p.skipSpacesAndTabs()

		if p.pos >= p.len {
			return nil, &ParseError{Message: "unterminated nested object", Position: p.pos}
		}

		if p.input[p.pos] == '}' {
			p.pos++
			return obj, nil
		}

		key, err := p.parseKey()
		if err != nil {
			return nil, err
		}

		p.skipWhitespace()

		if p.pos >= p.len || p.input[p.pos] != '=' {
			return nil, &ParseError{Message: "expected '=' after key in nested object", Position: p.pos}
		}
		p.pos++

		p.skipWhitespace()

		value, err := p.parseValue()
		if err != nil {
			return nil, err
		}

		obj[key] = value
		isFirst = false
	}

	return nil, &ParseError{Message: "unterminated nested object", Position: p.pos}
}

// parseKey parses a JHON key (quoted or unquoted)
func (p *parser) parseKey() (string, error) {
	p.skipWhitespace()

	if p.pos >= p.len {
		return "", &ParseError{Message: "expected key", Position: p.pos}
	}

	c := p.input[p.pos]

	if c == '"' || c == '\'' {
		// Quoted key
		quoteChar := c
		p.pos++

		var result strings.Builder
		for p.pos < p.len {
			if p.input[p.pos] == quoteChar {
				p.pos++
				return result.String(), nil
			} else if p.input[p.pos] == '\\' {
				p.pos++
				if p.pos < p.len {
					char, err := p.parseEscapeSequence(quoteChar)
					if err != nil {
						return "", err
					}
					result.WriteRune(char)
				}
			} else {
				result.WriteByte(p.input[p.pos])
				p.pos++
			}
		}
		return "", &ParseError{Message: "unterminated string in key", Position: p.pos}
	}

	// Unquoted key
	start := p.pos
	for p.pos < p.len && isUnquotedKeyChar(p.input[p.pos]) {
		p.pos++
	}

	key := p.input[start:p.pos]
	if key == "" {
		return "", &ParseError{Message: "empty key", Position: p.pos}
	}

	return key, nil
}

// parseValue parses a JHON value
func (p *parser) parseValue() (Value, error) {
	p.skipWhitespace()

	if p.pos >= p.len {
		return nil, &ParseError{Message: "expected value", Position: p.pos}
	}

	c := p.input[p.pos]

	if c == '"' || c == '\'' {
		return p.parseStringValue()
	} else if c == 'r' || c == 'R' {
		return p.parseRawStringValue()
	} else if c == '[' {
		return p.parseArray()
	} else if c == '{' {
		return p.parseNestedObject()
	} else if unicode.IsDigit(rune(c)) || c == '-' {
		return p.parseNumber()
	} else if c == 't' || c == 'f' {
		return p.parseBoolean()
	} else if c == 'n' {
		return p.parseNull()
	}

	return nil, &ParseError{Message: fmt.Sprintf("unexpected character in value: %c", c), Position: p.pos}
}

// parseStringValue parses a quoted string value
func (p *parser) parseStringValue() (string, error) {
	quoteChar := p.input[p.pos]
	p.pos++

	var result strings.Builder
	for p.pos < p.len {
		if p.input[p.pos] == quoteChar {
			p.pos++
			return result.String(), nil
		} else if p.input[p.pos] == '\\' {
			p.pos++
			if p.pos < p.len {
				char, err := p.parseEscapeSequence(quoteChar)
				if err != nil {
					return "", err
				}
				result.WriteRune(char)
			}
		} else {
			result.WriteByte(p.input[p.pos])
			p.pos++
		}
	}

	return "", &ParseError{Message: "unterminated string", Position: p.pos}
}

// parseRawStringValue parses a raw string value (r"..." or r#"..."#)
func (p *parser) parseRawStringValue() (string, error) {
	if p.pos >= p.len || (p.input[p.pos] != 'r' && p.input[p.pos] != 'R') {
		return "", &ParseError{Message: "expected raw string", Position: p.pos}
	}
	p.pos++

	if p.pos >= p.len {
		return "", &ParseError{Message: "unexpected end of input in raw string", Position: p.pos}
	}

	// Count the number of # symbols
	hashCount := 0
	for p.pos < p.len && p.input[p.pos] == '#' {
		hashCount++
		p.pos++
	}

	if p.pos >= p.len || p.input[p.pos] != '"' {
		return "", &ParseError{Message: "expected opening quote after r and # symbols in raw string", Position: p.pos}
	}
	p.pos++

	start := p.pos

	// Look for the closing sequence: " followed by hashCount # symbols
	for p.pos < p.len {
		if p.input[p.pos] == '"' {
			if p.pos+hashCount < p.len {
				isClosing := true
				for j := 1; j <= hashCount; j++ {
					if p.input[p.pos+j] != '#' {
						isClosing = false
						break
					}
				}

				if isClosing {
					content := p.input[start:p.pos]
					p.pos += hashCount + 1
					return content, nil
				}
			}
		}

		p.pos++
	}

	return "", &ParseError{Message: fmt.Sprintf("unterminated raw string (expected closing: \"%s\")", strings.Repeat("#", hashCount)+"\""), Position: p.pos}
}

// parseEscapeSequence parses an escape sequence
func (p *parser) parseEscapeSequence(quoteChar byte) (rune, error) {
	if p.pos >= p.len {
		return 0, &ParseError{Message: "incomplete escape sequence", Position: p.pos}
	}

	c := p.input[p.pos]
	p.pos++

	switch c {
	case 'n':
		return '\n', nil
	case 'r':
		return '\r', nil
	case 't':
		return '\t', nil
	case 'b':
		return '\b', nil
	case 'f':
		return '\f', nil
	case '\\':
		return '\\', nil
	case '"', '\'':
		return rune(c), nil
	case 'u':
		// Unicode escape sequence
		if p.pos+3 >= p.len {
			return 0, &ParseError{Message: "incomplete Unicode escape sequence", Position: p.pos}
		}
		hexStr := p.input[p.pos : p.pos+4]
		p.pos += 4
		codePoint, err := strconv.ParseUint(hexStr, 16, 16)
		if err != nil {
			return 0, &ParseError{Message: "invalid Unicode escape sequence", Position: p.pos - 4}
		}
		return rune(codePoint), nil
	default:
		// Unknown escape, return as literal
		return rune(c), nil
	}
}

// parseNumber parses a number value
func (p *parser) parseNumber() (Value, error) {
	start := p.pos

	// Optional minus sign
	if p.pos < p.len && p.input[p.pos] == '-' {
		p.pos++
	}

	// Digits before decimal point (underscores allowed)
	hasDigits := false
	for p.pos < p.len && (unicode.IsDigit(rune(p.input[p.pos])) || p.input[p.pos] == '_') {
		if p.input[p.pos] != '_' {
			hasDigits = true
		}
		p.pos++
	}

	if !hasDigits {
		return nil, &ParseError{Message: "invalid number", Position: p.pos}
	}

	// Optional decimal part
	if p.pos < p.len && p.input[p.pos] == '.' {
		p.pos++
		hasDecimalDigits := false
		for p.pos < p.len && (unicode.IsDigit(rune(p.input[p.pos])) || p.input[p.pos] == '_') {
			if p.input[p.pos] != '_' {
				hasDecimalDigits = true
			}
			p.pos++
		}
		if !hasDecimalDigits {
			return nil, &ParseError{Message: "invalid decimal number", Position: p.pos}
		}
	}

	// Build number string without underscores
	numStr := strings.ReplaceAll(p.input[start:p.pos], "_", "")

	// Try parsing as float
	num, err := strconv.ParseFloat(numStr, 64)
	if err != nil {
		return nil, &ParseError{Message: "could not parse number", Position: p.pos}
	}

	return num, nil
}

// parseBoolean parses a boolean value
func (p *parser) parseBoolean() (Value, error) {
	if p.pos+3 < p.len &&
		p.input[p.pos] == 't' &&
		p.input[p.pos+1] == 'r' &&
		p.input[p.pos+2] == 'u' &&
		p.input[p.pos+3] == 'e' {
		p.pos += 4
		return true, nil
	} else if p.pos+4 < p.len &&
		p.input[p.pos] == 'f' &&
		p.input[p.pos+1] == 'a' &&
		p.input[p.pos+2] == 'l' &&
		p.input[p.pos+3] == 's' &&
		p.input[p.pos+4] == 'e' {
		p.pos += 5
		return false, nil
	}

	return nil, &ParseError{Message: "invalid boolean value", Position: p.pos}
}

// parseNull parses a null value
func (p *parser) parseNull() (Value, error) {
	if p.pos+3 < p.len &&
		p.input[p.pos] == 'n' &&
		p.input[p.pos+1] == 'u' &&
		p.input[p.pos+2] == 'l' &&
		p.input[p.pos+3] == 'l' {
		p.pos += 4
		return nil, nil
	}

	return nil, &ParseError{Message: "invalid null value", Position: p.pos}
}

// parseArray parses an array value
func (p *parser) parseArray() (Value, error) {
	if p.pos >= p.len || p.input[p.pos] != '[' {
		return nil, &ParseError{Message: "expected '['", Position: p.pos}
	}
	p.pos++

	elements := make(Array, 0)
	isFirst := true

	for p.pos < p.len {
		if !isFirst {
			if !p.peekSeparator(']') {
				return nil, &ParseError{Message: "expected comma or newline between array elements", Position: p.pos}
			}
			p.skipSeparators()
		}

		p.skipSpacesAndTabs()

		if p.pos >= p.len {
			return nil, &ParseError{Message: "unterminated array", Position: p.pos}
		}

		if p.input[p.pos] == ']' {
			p.pos++
			return elements, nil
		}

		element, err := p.parseValue()
		if err != nil {
			return nil, err
		}

		elements = append(elements, element)
		isFirst = false
	}

	return nil, &ParseError{Message: "unterminated array", Position: p.pos}
}

// =============================================================================
// Serializer
// =============================================================================

// SerializeOptions controls serialization behavior
type SerializeOptions struct {
	SortKeys bool
	Pretty   bool
	Indent   string
}

// Serialize converts a Value to JHON format
func Serialize(v Value) string {
	return SerializeWithOptions(v, SerializeOptions{})
}

// SerializeWithOptions converts a Value to JHON format with options
func SerializeWithOptions(v Value, opts SerializeOptions) string {
	if opts.Pretty {
		return serializePretty(v, opts.Indent, 0, false)
	}
	return serializeCompact(v)
}

// serializeCompact serializes a value in compact format
func serializeCompact(v Value) string {
	switch val := v.(type) {
	case Object:
		return serializeObjectCompact(val)
	case Array:
		return serializeArrayCompact(val)
	case string:
		return serializeString(val)
	case float64:
		return serializeFloat(val)
	case bool:
		if val {
			return "true"
		}
		return "false"
	case nil:
		return "null"
	default:
		// For other numeric types
		return fmt.Sprintf("%v", val)
	}
}

// serializeObjectCompact serializes an object in compact format
func serializeObjectCompact(obj Object) string {
	if len(obj) == 0 {
		return ""
	}

	keys := make([]string, 0, len(obj))
	for k := range obj {
		keys = append(keys, k)
	}
	sortStrings(keys)

	var parts []string
	for _, key := range keys {
		serializedKey := serializeKey(key)
		value := obj[key]
		var serializedValue string
		if nestedObj, ok := value.(Object); ok {
			if len(nestedObj) == 0 {
				serializedValue = "{}"
			} else {
				serializedValue = "{" + serializeObjectCompact(nestedObj) + "}"
			}
		} else {
			serializedValue = serializeCompact(value)
		}
		parts = append(parts, fmt.Sprintf("%s=%s", serializedKey, serializedValue))
	}

	return strings.Join(parts, ",")
}

// serializeArrayCompact serializes an array in compact format
func serializeArrayCompact(arr Array) string {
	if len(arr) == 0 {
		return "[]"
	}

	var elements []string
	for _, v := range arr {
		if obj, ok := v.(Object); ok {
			if len(obj) == 0 {
				elements = append(elements, "{}")
			} else {
				elements = append(elements, "{"+serializeObjectCompact(obj)+"}")
			}
		} else {
			elements = append(elements, serializeCompact(v))
		}
	}

	return "[" + strings.Join(elements, ",") + "]"
}

// serializeKey serializes a key (quotes if necessary)
func serializeKey(key string) string {
	if needsQuoting(key) {
		return serializeString(key)
	}
	return key
}

// serializeString serializes a string value
func serializeString(s string) string {
	var result strings.Builder
	result.WriteByte('"')

	for _, c := range s {
		switch c {
		case '\\':
			result.WriteString("\\\\")
		case '"':
			result.WriteString("\\\"")
		case '\n':
			result.WriteString("\\n")
		case '\r':
			result.WriteString("\\r")
		case '\t':
			result.WriteString("\\t")
		case '\b':
			result.WriteString("\\b")
		case '\f':
			result.WriteString("\\f")
		default:
			if c < ' ' {
				result.WriteString(fmt.Sprintf("\\u%04x", c))
			} else {
				result.WriteRune(c)
			}
		}
	}

	result.WriteByte('"')
	return result.String()
}

// serializeFloat serializes a float number
func serializeFloat(f float64) string {
	// Check if it's a whole number
	if f == float64(int64(f)) {
		return fmt.Sprintf("%.0f", f)
	}
	return fmt.Sprintf("%g", f)
}

// serializePretty serializes a value with pretty formatting
func serializePretty(v Value, indent string, depth int, inArray bool) string {
	switch val := v.(type) {
	case Object:
		return serializeObjectPretty(val, indent, depth, inArray)
	case Array:
		return serializeArrayPretty(val, indent, depth)
	case string:
		return serializeString(val)
	case float64:
		return serializeFloat(val)
	case bool:
		if val {
			return "true"
		}
		return "false"
	case nil:
		return "null"
	default:
		return fmt.Sprintf("%v", val)
	}
}

// serializeObjectPretty serializes an object with pretty formatting
func serializeObjectPretty(obj Object, indent string, depth int, inArray bool) string {
	if len(obj) == 0 {
		return ""
	}

	keys := make([]string, 0, len(obj))
	for k := range obj {
		keys = append(keys, k)
	}
	sortStrings(keys)

	var parts []string
	for _, key := range keys {
		serializedKey := serializeKey(key)
		serializedValue := serializePretty(obj[key], indent, depth+1, false)

		if inArray {
			innerIndent := strings.Repeat(indent, depth+2)
			parts = append(parts, fmt.Sprintf("%s%s = %s", innerIndent, serializedKey, serializedValue))
		} else if depth == 0 {
			parts = append(parts, fmt.Sprintf("%s = %s", serializedKey, serializedValue))
		} else {
			innerIndent := strings.Repeat(indent, depth)
			parts = append(parts, fmt.Sprintf("%s%s = %s", innerIndent, serializedKey, serializedValue))
		}
	}

	if inArray {
		braceIndent := strings.Repeat(indent, depth+1)
		return fmt.Sprintf("%s{\n%s\n%s}", braceIndent, strings.Join(parts, ",\n"), braceIndent)
	} else if depth == 0 {
		return strings.Join(parts, ",\n")
	} else {
		outerIndent := strings.Repeat(indent, depth-1)
		return fmt.Sprintf("{\n%s\n%s}", strings.Join(parts, ",\n"), outerIndent)
	}
}

// serializeArrayPretty serializes an array with pretty formatting
func serializeArrayPretty(arr Array, indent string, depth int) string {
	if len(arr) == 0 {
		return "[]"
	}

	outerIndent := ""
	if depth > 0 {
		outerIndent = strings.Repeat(indent, depth-1)
	}

	var elements []string
	for _, v := range arr {
		if obj, ok := v.(Object); ok {
			objectDepth := depth - 1
			if objectDepth < 0 {
				objectDepth = 0
			}
			elements = append(elements, serializePretty(obj, indent, objectDepth, true))
		} else {
			elementIndent := indent
			if depth > 0 {
				elementIndent = strings.Repeat(indent, depth)
			}
			serialized := serializePretty(v, indent, depth+1, false)
			elements = append(elements, elementIndent+serialized)
		}
	}

	return "[\n" + strings.Join(elements, ",\n") + "\n" + outerIndent + "]"
}

// =============================================================================
// Utility Functions
// =============================================================================

func isWhitespace(c byte) bool {
	return c == ' ' || c == '\t' || c == '\n' || c == '\r'
}

func isUnquotedKeyChar(c byte) bool {
	return unicode.IsLetter(rune(c)) || unicode.IsDigit(rune(c)) || c == '_' || c == '-'
}

func needsQuoting(s string) bool {
	if s == "" {
		return true
	}
	for _, c := range s {
		if !unicode.IsLetter(c) && !unicode.IsDigit(c) && c != '_' && c != '-' {
			return true
		}
	}
	return false
}

func sortStrings(slice []string) {
	// Simple bubble sort for dependency-free sorting
	n := len(slice)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			if slice[j] > slice[j+1] {
				slice[j], slice[j+1] = slice[j+1], slice[j]
			}
		}
	}
}

// =============================================================================
// JSON Integration
// =============================================================================

// MarshalJSON implements json.Marshaler interface for Object
func (o Object) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]Value(o))
}

// UnmarshalJSON implements json.Unmarshaler interface for Object
func (o *Object) UnmarshalJSON(data []byte) error {
	var m map[string]Value
	if err := json.Unmarshal(data, &m); err != nil {
		return err
	}
	*o = m
	return nil
}

// =============================================================================
// Errors
// =============================================================================

var (
	ErrInvalidSyntax   = errors.New("invalid jhon syntax")
	ErrUnterminatedString = errors.New("unterminated string")
	ErrExpectedEquals  = errors.New("expected '=' after key")
)
