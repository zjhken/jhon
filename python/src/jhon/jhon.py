"""
JHON - JinHui's Object Notation
A configuration language parser and serializer for Python
"""

from __future__ import annotations
import re
import json
from typing import Any, Dict, List, Union


# =============================================================================
# Exceptions
# =============================================================================

class JhonParseError(Exception):
    """Exception raised when parsing JHON fails."""
    def __init__(self, message: str, position: int = -1):
        self.message = message
        self.position = position
        super().__init__(f"parse error at position {position}: {message}" if position >= 0 else message)


# =============================================================================
# Parser
# =============================================================================

class Parser:
    def __init__(self, input: str):
        self.input = input
        self.pos = 0
        self.length = len(input)

    def parse_jhon_object(self) -> Dict[str, Any]:
        """Parse a top-level JHON object."""
        obj = {}
        is_first = True

        while self.pos < self.length:
            if not is_first:
                if not self._peek_separator(0):
                    raise JhonParseError("Expected comma or newline between properties", self.pos)
                self._skip_separators()

            self._skip_spaces_and_tabs()

            if self.pos >= self.length:
                break

            key = self._parse_key()
            self._skip_whitespace()

            if self.pos >= self.length or self.input[self.pos] != '=':
                raise JhonParseError("Expected '=' after key", self.pos)
            self.pos += 1

            self._skip_whitespace()

            value = self._parse_value()
            obj[key] = value

            is_first = False

        return obj

    def parse_nested_object(self) -> Dict[str, Any]:
        """Parse a nested JHON object {key=value, ...}."""
        if self.pos >= self.length or self.input[self.pos] != '{':
            raise JhonParseError("Expected '{'", self.pos)
        self.pos += 1

        obj = {}
        is_first = True

        while self.pos < self.length:
            if not is_first:
                if not self._peek_separator('}'):
                    raise JhonParseError("Expected comma or newline between object properties", self.pos)
                self._skip_separators()

            self._skip_spaces_and_tabs()

            if self.pos >= self.length:
                raise JhonParseError("Unterminated nested object", self.pos)

            if self.input[self.pos] == '}':
                self.pos += 1
                return obj

            key = self._parse_key()
            self._skip_whitespace()

            if self.pos >= self.length or self.input[self.pos] != '=':
                raise JhonParseError("Expected '=' after key in nested object", self.pos)
            self.pos += 1

            self._skip_whitespace()

            value = self._parse_value()
            obj[key] = value

            is_first = False

        raise JhonParseError("Unterminated nested object", self.pos)

    def _parse_key(self) -> str:
        """Parse a JHON key (quoted or unquoted)."""
        self._skip_whitespace()

        if self.pos >= self.length:
            raise JhonParseError("Expected key", self.pos)

        c = self.input[self.pos]

        if c in ('"', "'"):
            quote_char = c
            self.pos += 1

            result = []
            while self.pos < self.length:
                if self.input[self.pos] == quote_char:
                    self.pos += 1
                    return ''.join(result)
                elif self.input[self.pos] == '\\':
                    self.pos += 1
                    if self.pos < self.length:
                        result.append(self._parse_escape_sequence(quote_char))
                else:
                    result.append(self.input[self.pos])
                    self.pos += 1

            raise JhonParseError("Unterminated string in key", self.pos)
        else:
            start = self.pos
            while self.pos < self.length and self._is_unquoted_key_char(self.input[self.pos]):
                self.pos += 1

            key = self.input[start:self.pos]
            if not key:
                raise JhonParseError("Empty key", self.pos)
            return key

    def _parse_value(self) -> Any:
        """Parse a JHON value."""
        self._skip_whitespace()

        if self.pos >= self.length:
            raise JhonParseError("Expected value", self.pos)

        c = self.input[self.pos]

        if c in ('"', "'"):
            return self._parse_string_value()
        elif c in ('r', 'R'):
            return self._parse_raw_string_value()
        elif c == '[':
            return self._parse_array()
        elif c == '{':
            return self.parse_nested_object()
        elif c.isdigit() or c == '-':
            return self._parse_number()
        elif c in ('t', 'f'):
            return self._parse_boolean()
        elif c == 'n':
            return self._parse_null()

        raise JhonParseError(f"Unexpected character in value: {c}", self.pos)

    def _parse_string_value(self) -> str:
        """Parse a quoted string value."""
        quote_char = self.input[self.pos]
        self.pos += 1

        result = []
        while self.pos < self.length:
            if self.input[self.pos] == quote_char:
                self.pos += 1
                return ''.join(result)
            elif self.input[self.pos] == '\\':
                self.pos += 1
                if self.pos < self.length:
                    result.append(self._parse_escape_sequence(quote_char))
            else:
                result.append(self.input[self.pos])
                self.pos += 1

        raise JhonParseError("Unterminated string", self.pos)

    def _parse_raw_string_value(self) -> str:
        """Parse a raw string value (r"..." or r#"..."#)."""
        if self.pos >= self.length or self.input[self.pos] not in ('r', 'R'):
            raise JhonParseError("Expected raw string", self.pos)
        self.pos += 1

        if self.pos >= self.length:
            raise JhonParseError("Unexpected end of input in raw string", self.pos)

        # Count hash symbols
        hash_count = 0
        while self.pos < self.length and self.input[self.pos] == '#':
            hash_count += 1
            self.pos += 1

        if self.pos >= self.length or self.input[self.pos] != '"':
            raise JhonParseError("Expected opening quote after r and # symbols in raw string", self.pos)
        self.pos += 1

        start = self.pos

        # Look for closing sequence
        while self.pos < self.length:
            if self.input[self.pos] == '"':
                if self.pos + hash_count < self.length:
                    is_closing = True
                    for j in range(1, hash_count + 1):
                        if self.input[self.pos + j] != '#':
                            is_closing = False
                            break

                    if is_closing:
                        content = self.input[start:self.pos]
                        self.pos += hash_count + 1
                        return content

            self.pos += 1

        raise JhonParseError(f"Unterminated raw string (expected closing: \"{'#' * hash_count}\")", self.pos)

    def _parse_escape_sequence(self, quote_char: str) -> str:
        """Parse an escape sequence."""
        if self.pos >= self.length:
            raise JhonParseError("Incomplete escape sequence", self.pos)

        c = self.input[self.pos]
        self.pos += 1

        escape_map = {
            'n': '\n',
            'r': '\r',
            't': '\t',
            'b': '\b',
            'f': '\f',
            '\\': '\\',
            '"': '"',
            "'": "'",
        }

        if c == 'u':
            # Unicode escape
            if self.pos + 3 >= self.length:
                raise JhonParseError("Incomplete Unicode escape sequence", self.pos)
            hex_str = self.input[self.pos:self.pos + 4]
            self.pos += 4
            try:
                code_point = int(hex_str, 16)
                return chr(code_point)
            except ValueError:
                raise JhonParseError("Invalid Unicode escape sequence", self.pos - 4)
        elif c in escape_map:
            return escape_map[c]
        else:
            # Unknown escape, return as literal
            return c

    def _parse_array(self) -> List[Any]:
        """Parse an array value."""
        if self.pos >= self.length or self.input[self.pos] != '[':
            raise JhonParseError("Expected '['", self.pos)
        self.pos += 1

        elements = []
        is_first = True

        while self.pos < self.length:
            if not is_first:
                if not self._peek_separator(']'):
                    raise JhonParseError("Expected comma or newline between array elements", self.pos)
                self._skip_separators()

            self._skip_spaces_and_tabs()

            if self.pos >= self.length:
                raise JhonParseError("Unterminated array", self.pos)

            if self.input[self.pos] == ']':
                self.pos += 1
                return elements

            elements.append(self._parse_value())
            is_first = False

        raise JhonParseError("Unterminated array", self.pos)

    def _parse_number(self) -> float | int:
        """Parse a number value."""
        start = self.pos

        # Optional minus
        if self.pos < self.length and self.input[self.pos] == '-':
            self.pos += 1

        # Digits before decimal (underscores allowed)
        has_digits = False
        while self.pos < self.length and (self.input[self.pos].isdigit() or self.input[self.pos] == '_'):
            if self.input[self.pos] != '_':
                has_digits = True
            self.pos += 1

        if not has_digits:
            raise JhonParseError("Invalid number", self.pos)

        # Optional decimal part
        if self.pos < self.length and self.input[self.pos] == '.':
            self.pos += 1
            has_decimal_digits = False
            while self.pos < self.length and (self.input[self.pos].isdigit() or self.input[self.pos] == '_'):
                if self.input[self.pos] != '_':
                    has_decimal_digits = True
                self.pos += 1
            if not has_decimal_digits:
                raise JhonParseError("Invalid decimal number", self.pos)

        # Build number string without underscores
        num_str = self.input[start:self.pos].replace('_', '')

        try:
            if '.' in num_str or 'e' in num_str.lower():
                return float(num_str)
            else:
                value = int(num_str)
                # Use int for values that fit in standard integer range
                return value
        except ValueError:
            raise JhonParseError("Could not parse number", self.pos)

    def _parse_boolean(self) -> bool:
        """Parse a boolean value."""
        if (self.pos + 3 < self.length and
                self.input[self.pos] == 't' and
                self.input[self.pos + 1] == 'r' and
                self.input[self.pos + 2] == 'u' and
                self.input[self.pos + 3] == 'e'):
            self.pos += 4
            return True
        elif (self.pos + 4 < self.length and
                self.input[self.pos] == 'f' and
                self.input[self.pos + 1] == 'a' and
                self.input[self.pos + 2] == 'l' and
                self.input[self.pos + 3] == 's' and
                self.input[self.pos + 4] == 'e'):
            self.pos += 5
            return False

        raise JhonParseError("Invalid boolean value", self.pos)

    def _parse_null(self) -> None:
        """Parse a null value."""
        if (self.pos + 3 < self.length and
                self.input[self.pos] == 'n' and
                self.input[self.pos + 1] == 'u' and
                self.input[self.pos + 2] == 'l' and
                self.input[self.pos + 3] == 'l'):
            self.pos += 4
            return None

        raise JhonParseError("Invalid null value", self.pos)

    def _skip_separators(self) -> None:
        """Skip comma and newline separators."""
        while self.pos < self.length:
            c = self.input[self.pos]
            if c in ('\n', ','):
                self.pos += 1
            else:
                break

    def _peek_separator(self, closing_char: str) -> bool:
        """Check if there's a separator ahead."""
        temp_pos = self.pos
        found_space = False

        while temp_pos < self.length:
            c = self.input[temp_pos]
            if c in (' ', '\t'):
                temp_pos += 1
                found_space = True
            elif c in ('\n', ','):
                return True
            elif closing_char and c == closing_char:
                return True
            elif found_space:
                return True
            else:
                return False

        return found_space or not closing_char

    def _skip_whitespace(self) -> None:
        """Skip all whitespace."""
        while self.pos < self.length and self.input[self.pos].isspace():
            self.pos += 1

    def _skip_spaces_and_tabs(self) -> None:
        """Skip only spaces and tabs."""
        while self.pos < self.length:
            c = self.input[self.pos]
            if c in (' ', '\t'):
                self.pos += 1
            else:
                break

    @staticmethod
    def _is_unquoted_key_char(c: str) -> bool:
        """Check if character is valid in unquoted key."""
        return c.isalnum() or c in ('_', '-')


# =============================================================================
# Public Parse API
# =============================================================================

def remove_comments(input: str) -> str:
    """Remove // and /* */ style comments from input."""
    result = []
    i = 0
    length = len(input)

    while i < length:
        c = input[i]

        if c == '/' and i + 1 < length:
            next_char = input[i + 1]

            if next_char == '/':
                # Single line comment
                i += 2
                while i < length and input[i] != '\n':
                    i += 1
                continue
            elif next_char == '*':
                # Multi-line comment
                i += 2
                found_end = False
                while i < length:
                    if input[i] == '*' and i + 1 < length and input[i + 1] == '/':
                        i += 2
                        found_end = True
                        break
                    i += 1
                if not found_end:
                    result.append('/*')
                continue

        result.append(c)
        i += 1

    return ''.join(result)


def parse(input: str) -> Dict[str, Any]:
    """
    Parse a JHON config string into a Python dict.

    Args:
        input: JHON format string

    Returns:
        Parsed dictionary

    Raises:
        JhonParseError: If parsing fails

    Examples:
        >>> parse('name="John" age=30')
        {'name': 'John', 'age': 30}
    """
    input = remove_comments(input).strip()

    if not input:
        return {}

    parser = Parser(input)

    # Handle top-level objects wrapped in braces
    if input.startswith('{') and input.endswith('}'):
        return parser.parse_nested_object()

    return parser.parse_jhon_object()


# =============================================================================
# Serializer
# =============================================================================

class Serializer:
    def serialize(self, value: Any, pretty: bool = False, indent: str = "  ") -> str:
        """Serialize a value to JHON format."""
        if pretty:
            return self._serialize_pretty(value, indent, 0, False)
        return self._serialize_compact(value)

    def _serialize_compact(self, value: Any) -> str:
        """Serialize a value in compact format."""
        if value is None:
            return "null"
        elif isinstance(value, str):
            return self._serialize_string(value)
        elif isinstance(value, bool):
            return "true" if value else "false"
        elif isinstance(value, (int, float)):
            return self._serialize_number(value)
        elif isinstance(value, list):
            return self._serialize_array_compact(value)
        elif isinstance(value, dict):
            return self._serialize_object_compact(value)

        raise TypeError(f"Cannot serialize value: {type(value)}")

    def _serialize_object_compact(self, obj: Dict) -> str:
        """Serialize an object in compact format."""
        if not obj:
            return ""

        parts = []
        for key in sorted(obj.keys()):
            serialized_key = self._serialize_key(key)
            value = obj[key]

            if isinstance(value, dict):
                if not value:
                    serialized_value = "{}"
                else:
                    serialized_value = "{" + self._serialize_object_compact(value) + "}"
            else:
                serialized_value = self._serialize_compact(value)

            parts.append(f"{serialized_key}={serialized_value}")

        return ",".join(parts)

    def _serialize_array_compact(self, arr: List) -> str:
        """Serialize an array in compact format."""
        if not arr:
            return "[]"

        elements = []
        for v in arr:
            if isinstance(v, dict):
                if not v:
                    elements.append("{}")
                else:
                    elements.append("{" + self._serialize_object_compact(v) + "}")
            else:
                elements.append(self._serialize_compact(v))

        return "[" + ",".join(elements) + "]"

    def _serialize_key(self, key: str) -> str:
        """Serialize a key (quotes if necessary)."""
        if self._needs_quoting(key):
            return self._serialize_string(key)
        return key

    def _serialize_string(self, s: str) -> str:
        """Serialize a string value."""
        result = ['"']

        for c in s:
            if c == '\\':
                result.append('\\\\')
            elif c == '"':
                result.append('\\"')
            elif c == '\n':
                result.append('\\n')
            elif c == '\r':
                result.append('\\r')
            elif c == '\t':
                result.append('\\t')
            elif c == '\b':
                result.append('\\b')
            elif c == '\f':
                result.append('\\f')
            elif c < ' ':
                result.append(f'\\u{ord(c):04x}')
            else:
                result.append(c)

        result.append('"')
        return ''.join(result)

    def _serialize_number(self, n: int | float) -> str:
        """Serialize a number value."""
        if isinstance(n, int) or n.is_integer():
            return str(int(n))
        return str(n)

    def _serialize_pretty(self, value: Any, indent: str, depth: int, in_array: bool) -> str:
        """Serialize with pretty formatting."""
        if value is None:
            return "null"
        elif isinstance(value, str):
            return self._serialize_string(value)
        elif isinstance(value, bool):
            return "true" if value else "false"
        elif isinstance(value, (int, float)):
            return self._serialize_number(value)
        elif isinstance(value, list):
            return self._serialize_array_pretty(value, indent, depth)
        elif isinstance(value, dict):
            return self._serialize_object_pretty(value, indent, depth, in_array)

        raise TypeError(f"Cannot serialize value: {type(value)}")

    def _serialize_object_pretty(self, obj: Dict, indent: str, depth: int, in_array: bool) -> str:
        """Serialize object with pretty formatting."""
        if not obj:
            return ""

        parts = []
        for key in sorted(obj.keys()):
            serialized_key = self._serialize_key(key)
            serialized_value = self._serialize_pretty(obj[key], indent, depth + 1, False)

            if in_array:
                inner_indent = indent * (depth + 2)
                parts.append(f"{inner_indent}{serialized_key} = {serialized_value}")
            elif depth == 0:
                parts.append(f"{serialized_key} = {serialized_value}")
            else:
                inner_indent = indent * depth
                parts.append(f"{inner_indent}{serialized_key} = {serialized_value}")

        if in_array:
            brace_indent = indent * (depth + 1)
            return brace_indent + "{\n" + ",\n".join(parts) + "\n" + brace_indent + "}"
        elif depth == 0:
            return ",\n".join(parts)
        else:
            outer_indent = indent * (depth - 1)
            return "{\n" + ",\n".join(parts) + "\n" + outer_indent + "}"

    def _serialize_array_pretty(self, arr: List, indent: str, depth: int) -> str:
        """Serialize array with pretty formatting."""
        if not arr:
            return "[]"

        outer_indent = indent * (depth - 1) if depth > 0 else ""

        elements = []
        for v in arr:
            if isinstance(v, dict):
                object_depth = max(0, depth - 1)
                elements.append(self._serialize_pretty(v, indent, object_depth, True))
            else:
                element_indent = indent if depth == 0 else indent * depth
                serialized = self._serialize_pretty(v, indent, depth + 1, False)
                elements.append(f"{element_indent}{serialized}")

        return "[\n" + ",\n".join(elements) + "\n" + outer_indent + "]"

    @staticmethod
    def _needs_quoting(s: str) -> bool:
        """Check if a key needs quoting."""
        if not s:
            return True
        for c in s:
            if not (c.isalnum() or c in ('_', '-')):
                return True
        return False


# =============================================================================
# Public Serialize API
# =============================================================================

def serialize(value: Any) -> str:
    """
    Serialize a value to compact JHON format.

    Args:
        value: Python dict, list, or primitive value

    Returns:
        JHON format string

    Examples:
        >>> serialize({"name": "John", "age": 30})
        'age=30,name="John"'
    """
    return Serializer().serialize(value, pretty=False)


def serialize_pretty(value: Any, indent: str = "  ") -> str:
    """
    Serialize a value to pretty-printed JHON format.

    Args:
        value: Python dict, list, or primitive value
        indent: Indentation string (default: "  ")

    Returns:
        Pretty-printed JHON format string

    Examples:
        >>> serialize_pretty({"name": "John", "age": 30})
        'age = 30,\\nname = "John"'
    """
    return Serializer().serialize(value, pretty=True, indent=indent)
