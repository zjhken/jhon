"""
JHON - JinHui's Object Notation.

Parser and serializer mirroring rust/src/lib.rs. Strict per SPEC.md — every
error case in §8 raises JhonParseError with 1-based line and column.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple


# =============================================================================
# Public exception
# =============================================================================


class JhonParseError(Exception):
    """Raised by `parse` on invalid input. Carries 1-based line/column."""

    def __init__(
        self,
        message: str,
        *,
        line: int = 0,
        column: int = 0,
        end_line: Optional[int] = None,
        end_column: Optional[int] = None,
        position: int = -1,
        kind: str = "syntax",
        duplicate_key: Optional[str] = None,
    ) -> None:
        self.message = message
        self.line = line
        self.column = column
        self.end_line = end_line if end_line is not None else line
        self.end_column = end_column if end_column is not None else column + 1
        self.position = position
        self.kind = kind
        self.duplicate_key = duplicate_key
        super().__init__(self._format())

    def _format(self) -> str:
        if self.duplicate_key is not None:
            return f'duplicate key at {self.line}:{self.column}: "{self.duplicate_key}"'
        if self.line == 0 and self.column == 0:
            return f'parse error: {self.message}'
        where = (
            "unexpected end of input"
            if self.kind == "eof"
            else "parse error"
        )
        return f'{where} at {self.line}:{self.column}: {self.message}'


# =============================================================================
# Character classification
# =============================================================================

_KEY_DELIMITERS = frozenset(" \t\n\r=,{}[]/\"'#")


def _is_key_delimiter(c: str) -> bool:
    return c in _KEY_DELIMITERS


def _is_dec_digit(c: str) -> bool:
    return "0" <= c <= "9"


def _is_hex_digit(c: str) -> bool:
    return ("0" <= c <= "9") or ("a" <= c <= "f") or ("A" <= c <= "F")


def _hex_value(c: str) -> int:
    if "0" <= c <= "9":
        return ord(c) - ord("0")
    if "a" <= c <= "f":
        return ord(c) - ord("a") + 10
    return ord(c) - ord("A") + 10


def _is_ascii_alphanumeric(c: str) -> bool:
    return (
        ("0" <= c <= "9")
        or ("a" <= c <= "z")
        or ("A" <= c <= "Z")
    )


# =============================================================================
# Parser
# =============================================================================


class Parser:
    """Hand-written recursive descent parser. Tracks 1-based line and column."""

    def __init__(self, input: str) -> None:
        self.input = input
        self.len = len(input)
        self.pos = 0
        self.line = 1
        self.col = 1

    # ------------------------------------------------------------------ cursor

    def _current(self) -> str:
        return self.input[self.pos] if self.pos < self.len else ""

    def _peek(self, offset: int) -> str:
        idx = self.pos + offset
        return self.input[idx] if 0 <= idx < self.len else ""

    def _at_end(self) -> bool:
        return self.pos >= self.len

    def _advance(self) -> str:
        if self.pos >= self.len:
            return ""
        c = self.input[self.pos]
        if c == "\n":
            self.line += 1
            self.col = 1
        else:
            self.col += 1
        self.pos += 1
        return c

    def _syntax_err(self, msg: str, *, kind: str = "syntax") -> JhonParseError:
        return JhonParseError(
            msg,
            line=self.line,
            column=self.col,
            end_line=self.line,
            end_column=self.col + 1,
            position=self.pos,
            kind="eof" if self._at_end() else kind,
        )

    # -------------------------------------------------------- whitespace / comments

    def _skip_ws_and_comments(self) -> bool:
        """Skip whitespace and comments. Returns whether a newline was seen."""
        saw_newline = False
        while True:
            c = self._current()
            if not c:
                break
            if c in " \t\r":
                self._advance()
            elif c == "\n":
                saw_newline = True
                self._advance()
            elif c == "/" and self._peek(1) == "/":
                self._advance()
                self._advance()
                while self._current() and self._current() != "\n":
                    self._advance()
            elif c == "/" and self._peek(1) == "*":
                self._advance()
                self._advance()
                while self._current():
                    if self._current() == "*" and self._peek(1) == "/":
                        self._advance()
                        self._advance()
                        break
                    if self._current() == "\n":
                        saw_newline = True
                    self._advance()
            else:
                break
        return saw_newline

    def _skip_inter_item_separator(self) -> Tuple[bool, bool]:
        """Returns (saw_newline, saw_comma). Per SPEC §5.3 same-line items need a comma."""
        saw_newline = self._skip_ws_and_comments()
        saw_comma = False
        if self._current() == ",":
            saw_comma = True
            self._advance()
            if self._skip_ws_and_comments():
                saw_newline = True
        return saw_newline, saw_comma

    # --------------------------------------------------------------- top-level dispatch

    def parse(self) -> Any:
        self._skip_ws_and_comments()
        if self._at_end():
            # Empty input (including whitespace-only and comments-only) → None.
            # Per SPEC §2, this is the "Empty" form, distinct from {} and [].
            return None
        # Mode detection (SPEC §2): the first top-level element decides.
        # `{...}` and `[...]` always begin array mode since they cannot
        # start a `key=` pair.
        first = self._current()
        object_mode = False
        if first != "{" and first != "[":
            saved_pos, saved_line, saved_col = self.pos, self.line, self.col
            try:
                self._parse_key()
                self._skip_ws_and_comments()
                if self._current() == "=":
                    object_mode = True
            except JhonParseError:
                pass
            self.pos, self.line, self.col = saved_pos, saved_line, saved_col
        if object_mode:
            return self._parse_jhon_object()
        return self._parse_jhon_array()

    def _parse_jhon_object(self) -> Dict[str, Any]:
        obj: Dict[str, Any] = {}
        self._skip_ws_and_comments()
        while self.pos < self.len:
            self._parse_property_into(obj)
            saw_newline, saw_comma = self._skip_inter_item_separator()
            if self._at_end():
                break
            if not saw_newline and not saw_comma:
                raise self._syntax_err("items on the same line must be separated by a comma")
        return obj

    def _parse_jhon_array(self) -> List[Any]:
        arr: List[Any] = []
        self._skip_ws_and_comments()
        while self.pos < self.len:
            if self._current() == "=":
                raise self._syntax_err(
                    "cannot mix key=value pairs and bare values at top level"
                )
            arr.append(self._parse_value())
            saw_newline, saw_comma = self._skip_inter_item_separator()
            if self._at_end():
                break
            if not saw_newline and not saw_comma:
                raise self._syntax_err("items on the same line must be separated by a comma")
        return arr

    def _parse_nested_object(self) -> Dict[str, Any]:
        self._advance()  # {
        obj: Dict[str, Any] = {}
        self._skip_ws_and_comments()
        while True:
            c = self._current()
            if not c:
                raise self._syntax_err("unterminated nested object")
            if c == "}":
                self._advance()
                return obj
            self._parse_property_into(obj)
            saw_newline, saw_comma = self._skip_inter_item_separator()
            if self._current() == "}":
                self._advance()
                return obj
            if self._at_end():
                raise self._syntax_err("unterminated nested object")
            if not saw_newline and not saw_comma:
                raise self._syntax_err("items on the same line must be separated by a comma")

    def _parse_property_into(self, obj: Dict[str, Any]) -> None:
        key = self._parse_key()
        self._skip_ws_and_comments()
        if self._current() != "=":
            raise self._syntax_err("expected '=' after key")
        self._advance()
        self._skip_ws_and_comments()
        value = self._parse_value()
        if key in obj:
            raise JhonParseError(
                f'duplicate key "{key}"',
                line=self.line,
                column=self.col,
                end_line=self.line,
                end_column=self.col + 1,
                position=self.pos,
                kind="duplicate-key",
                duplicate_key=key,
            )
        obj[key] = value

    def _parse_key(self) -> str:
        self._skip_ws_and_comments()
        c = self._current()
        if not c:
            raise self._syntax_err("expected key")
        if c == '"' or c == "'":
            return self._parse_string(c)
        start = self.pos
        while self.pos < self.len and not _is_key_delimiter(self.input[self.pos]):
            self._advance()
        if self.pos == start:
            raise self._syntax_err("empty key")
        return self.input[start:self.pos]

    # ----------------------------------------------------------------- value dispatch

    def _parse_value(self) -> Any:
        self._skip_ws_and_comments()
        c = self._current()
        if not c:
            raise self._syntax_err("expected value")
        if c == '"' or c == "'":
            return self._parse_string(c)
        if c == "r" or c == "R":
            nxt = self._peek(1)
            if nxt == '"' or nxt == "#":
                return self._parse_raw_string()
            raise self._syntax_err(f"unexpected character in value: {c}")
        if c == "[":
            return self._parse_array()
        if c == "{":
            return self._parse_nested_object()
        if c == "-" or _is_dec_digit(c):
            return self._parse_number()
        if c == "t" or c == "f":
            return self._parse_boolean()
        if c == "n":
            return self._parse_null()
        raise self._syntax_err(f"unexpected character in value: {c}")

    def _parse_string(self, quote: str) -> str:
        self._advance()  # opening quote
        # Fast path: no escape, no control char — single slice.
        # Scan ahead for the next interesting byte and consume the run.
        input_str = self.input
        n = self.len
        out: List[str] = []
        while True:
            start = self.pos
            # Advance over plain chars until we hit a special byte.
            while self.pos < n:
                c = input_str[self.pos]
                co = ord(c)
                if co < 0x20 or co == 0x7F:
                    raise self._syntax_err(
                        f"literal control character 0x{co:02X} in string; use an escape or a raw string"
                    )
                if c == quote or c == "\\":
                    break
                self.col += 1
                self.pos += 1
            if self.pos > start:
                out.append(input_str[start:self.pos])
            c = self._current()
            if not c:
                raise self._syntax_err("unterminated string")
            if c == quote:
                self._advance()
                return "".join(out)
            # c == "\\"
            self._advance()
            esc = self._current()
            if not esc:
                raise self._syntax_err("incomplete escape sequence")
            self._advance()
            if esc == "n":
                out.append("\n")
            elif esc == "r":
                out.append("\r")
            elif esc == "t":
                out.append("\t")
            elif esc == "b":
                out.append("\b")
            elif esc == "f":
                out.append("\f")
            elif esc == "\\":
                out.append("\\")
            elif esc == '"':
                out.append('"')
            elif esc == "'":
                out.append("'")
            elif esc == "/":
                out.append("/")
            elif esc == "x":
                v = self._parse_hex_digits(2, "\\x")
                out.append(chr(v))
            elif esc == "u":
                v = self._parse_hex_digits(4, "\\u")
                if 0xD800 <= v <= 0xDFFF:
                    raise self._syntax_err(
                        f"surrogate code point U+{v:04X} requires a pair; surrogate handling is not yet implemented"
                    )
                out.append(chr(v))
            else:
                raise self._syntax_err(f"unknown escape \\{esc}")

    def _parse_hex_digits(self, count: int, label: str) -> int:
        v = 0
        for _ in range(count):
            c = self._current()
            if not c or not _is_hex_digit(c):
                raise self._syntax_err(f"incomplete {label} escape")
            v = (v << 4) | _hex_value(c)
            self._advance()
        return v

    def _parse_raw_string(self) -> str:
        self._advance()  # r or R
        hash_count = 0
        while self._current() == "#":
            hash_count += 1
            self._advance()
        if self._current() != '"':
            raise self._syntax_err("expected opening quote after r and # symbols in raw string")
        self._advance()
        start = self.pos
        closing = '"' + ("#" * hash_count)
        idx = self.input.find(closing, start)
        if idx < 0:
            while self.pos < self.len:
                self._advance()
            raise self._syntax_err(f"unterminated raw string (expected closing {closing!r})")
        value = self.input[start:idx]
        target = idx + len(closing)
        while self.pos < target:
            self._advance()
        return value

    def _parse_number(self) -> Any:
        negative = self._current() == "-"
        if negative:
            self._advance()

        radix = 0
        if self._current() == "0":
            nxt = self._peek(1)
            if nxt == "x":
                radix = 16
            elif nxt == "o":
                radix = 8
            elif nxt == "b":
                radix = 2
            elif nxt in ("X", "O", "B"):
                raise self._syntax_err(
                    f"uppercase radix prefix 0{nxt} not allowed; use lowercase"
                )

        is_float = False
        if radix:
            self._advance()
            self._advance()
            literal = self._scan_radix_digits(radix)
        else:
            literal = self._scan_dec_digits()
            if self._current() == ".":
                is_float = True
                self._advance()
                literal = f"{literal}.{self._scan_dec_digits()}"
            if self._current() in ("e", "E"):
                is_float = True
                self._advance()
                exp = "e"
                if self._current() in ("+", "-"):
                    exp += self._current()
                    self._advance()
                literal = f"{literal}{exp}{self._scan_dec_digits()}"

        cur = self._current()
        nxt = self._peek(1)
        if cur in ("u", "i", "f") and nxt and _is_ascii_alphanumeric(nxt):
            raise self._syntax_err(
                f"number type suffix not allowed (saw '{cur}{nxt}')"
            )

        if radix:
            return -int(literal, radix) if negative else int(literal, radix)

        if not is_float:
            try:
                return -int(literal) if negative else int(literal)
            except ValueError:
                pass
        signed = f"-{literal}" if negative else literal
        try:
            return float(signed)
        except ValueError:
            raise self._syntax_err(f"could not parse number: {signed}")

    def _scan_dec_digits(self) -> str:
        out: List[str] = []
        last_under = False
        has_digit = False
        while self.pos < self.len:
            c = self.input[self.pos]
            if _is_dec_digit(c):
                out.append(c)
                last_under = False
                has_digit = True
                self._advance()
            elif c == "_":
                if not has_digit or last_under:
                    raise self._syntax_err("invalid underscore placement in number")
                last_under = True
                self._advance()
            else:
                break
        if not has_digit:
            raise self._syntax_err("number requires at least one digit")
        if last_under:
            raise self._syntax_err("number cannot end with underscore")
        return "".join(out)

    def _scan_radix_digits(self, radix: int) -> str:
        out: List[str] = []
        last_under = False
        has_digit = False
        while self.pos < self.len:
            c = self.input[self.pos]
            ok = (
                _is_hex_digit(c) if radix == 16
                else ("0" <= c <= "7") if radix == 8
                else c in ("0", "1")
            )
            if ok:
                out.append(c)
                last_under = False
                has_digit = True
                self._advance()
            elif c == "_":
                if not has_digit or last_under:
                    raise self._syntax_err("invalid underscore placement in number")
                last_under = True
                self._advance()
            else:
                break
        if not has_digit:
            raise self._syntax_err("number requires at least one digit after radix prefix")
        if last_under:
            raise self._syntax_err("number cannot end with underscore")
        return "".join(out)

    def _parse_boolean(self) -> bool:
        if self._matches("true"):
            for _ in range(4):
                self._advance()
            return True
        if self._matches("false"):
            for _ in range(5):
                self._advance()
            return False
        raise self._syntax_err("invalid boolean value")

    def _parse_null(self) -> None:
        if self._matches("null"):
            for _ in range(4):
                self._advance()
            return None
        raise self._syntax_err("invalid null value")

    def _matches(self, lit: str) -> bool:
        if self.pos + len(lit) > self.len:
            return False
        return self.input[self.pos:self.pos + len(lit)] == lit

    def _parse_array(self) -> List[Any]:
        self._advance()  # [
        arr: List[Any] = []
        self._skip_ws_and_comments()
        while True:
            c = self._current()
            if not c:
                raise self._syntax_err("unterminated array")
            if c == "]":
                self._advance()
                return arr
            arr.append(self._parse_value())
            saw_newline, saw_comma = self._skip_inter_item_separator()
            if self._current() == "]":
                self._advance()
                return arr
            if self._at_end():
                raise self._syntax_err("unterminated array")
            if not saw_newline and not saw_comma:
                raise self._syntax_err("items on the same line must be separated by a comma")


# =============================================================================
# Serializer
# =============================================================================


class Serializer:
    """Compact and pretty JHON serializers mirroring rust/src/lib.rs."""

    def __init__(self, sort_keys: bool = False) -> None:
        self.sort_keys = sort_keys

    # ---- compact ----

    def serialize(self, value: Any) -> str:
        out: List[str] = []
        self._serialize_top_compact(value, out)
        return "".join(out)

    def _serialize_top_compact(self, v: Any, out: List[str]) -> None:
        """Top-level dispatch per SPEC §2: empty containers and None emit
        nothing (the 'Empty' form); top-level arrays emit bare (no []).
        Everything else falls through to _serialize_compact which preserves
        nested [] and nested null literals."""
        if v is None:
            return
        if isinstance(v, list):
            if not v:
                return
            self._serialize_array_contents_compact(v, out)
            return
        if isinstance(v, dict):
            if not v:
                return
            self._serialize_object_compact(v, out)
            return
        self._serialize_compact(v, out)

    def _serialize_array_contents_compact(self, arr: List[Any], out: List[str]) -> None:
        """Emit comma-separated array contents without surrounding []. Used
        for top-level implicit arrays per SPEC §2."""
        first = True
        for el in arr:
            if not first:
                out.append(",")
            first = False
            if isinstance(el, dict) and not el:
                out.append("{}")
                continue
            if isinstance(el, dict):
                out.append("{")
                self._serialize_object_compact(el, out)
                out.append("}")
                continue
            self._serialize_compact(el, out)

    def _serialize_compact(self, v: Any, out: List[str]) -> None:
        if v is None:
            out.append("null")
            return
        if isinstance(v, bool):
            out.append("true" if v else "false")
            return
        if isinstance(v, str):
            self._serialize_string(v, out)
            return
        if isinstance(v, int):
            out.append(str(v))
            return
        if isinstance(v, float):
            self._serialize_float(v, out)
            return
        if isinstance(v, list):
            if not v:
                out.append("[]")
                return
            out.append("[")
            self._serialize_array_contents_compact(v, out)
            out.append("]")
            return
        if isinstance(v, dict):
            if not v:
                return
            self._serialize_object_compact(v, out)
            return
        out.append(str(v))

    def _serialize_object_compact(self, obj: Dict[str, Any], out: List[str]) -> None:
        first = True
        for key in self._keys(obj):
            if not first:
                out.append(",")
            first = False
            self._serialize_key(key, out)
            out.append("=")
            v = obj[key]
            if isinstance(v, dict):
                if not v:
                    out.append("{}")
                    continue
                out.append("{")
                self._serialize_object_compact(v, out)
                out.append("}")
                continue
            self._serialize_compact(v, out)

    # ---- pretty ----

    def serialize_pretty(
        self, value: Any, indent: str = "  ", *, max_inline_width: int = 0
    ) -> str:
        out: List[str] = []
        if max_inline_width > 0:
            self._serialize_top_pretty_inline(value, indent, max_inline_width, out)
        else:
            self._serialize_top_pretty(value, indent, out)
        return "".join(out)

    def _serialize_top_pretty(self, v: Any, indent: str, out: List[str]) -> None:
        """Top-level pretty dispatch. Mirrors _serialize_top_compact."""
        if v is None:
            return
        if isinstance(v, list):
            if not v:
                return
            self._serialize_top_array_pretty(v, indent, out)
            return
        if isinstance(v, dict):
            if not v:
                return
            self._serialize_object_pretty(v, indent, 0, False, out)
            return
        self._serialize_compact(v, out)

    def _serialize_top_array_pretty(self, arr: List[Any], indent: str, out: List[str]) -> None:
        """Emit a top-level implicit array (no surrounding []). Each element
        on its own line at column 0; object literals keep braces since they
        are array elements, not the implicit top-level form."""
        first = True
        for el in arr:
            if not first:
                out.append("\n")
            first = False
            if isinstance(el, dict) and not el:
                out.append("{}")
                continue
            if isinstance(el, dict):
                out.append("{\n")
                first_pair = True
                for key in self._keys(el):
                    if not first_pair:
                        out.append("\n")
                    first_pair = False
                    out.append(indent)
                    self._serialize_key(key, out)
                    out.append(" = ")
                    self._serialize_pretty(el[key], indent, 1, False, out)
                out.append("\n")
                out.append("}")
                continue
            self._serialize_pretty(el, indent, 0, False, out)

    def _serialize_pretty(
        self, v: Any, indent: str, depth: int, in_array: bool, out: List[str]
    ) -> None:
        if v is None:
            out.append("null")
            return
        if isinstance(v, bool):
            out.append("true" if v else "false")
            return
        if isinstance(v, str):
            self._serialize_string(v, out)
            return
        if isinstance(v, int):
            out.append(str(v))
            return
        if isinstance(v, float):
            self._serialize_float(v, out)
            return
        if isinstance(v, list):
            if not v:
                out.append("[]")
                return
            self._serialize_array_pretty(v, indent, depth, out)
            return
        if isinstance(v, dict):
            if not v:
                if in_array or depth > 0:
                    out.append("{}")
                return
            self._serialize_object_pretty(v, indent, depth, in_array, out)
            return

    def _serialize_object_pretty(
        self,
        obj: Dict[str, Any],
        indent: str,
        depth: int,
        in_array: bool,
        out: List[str],
    ) -> None:
        if in_array:
            out.append(indent * (depth + 1))
            out.append("{\n")
        elif depth > 0:
            out.append("{\n")

        first = True
        for key in self._keys(obj):
            if not first:
                out.append("\n")
            first = False
            inner_depth = (depth + 2) if in_array else (0 if depth == 0 else depth)
            out.append(indent * inner_depth)
            self._serialize_key(key, out)
            out.append(" = ")
            self._serialize_pretty(obj[key], indent, depth + 1, False, out)

        if in_array:
            out.append("\n")
            out.append(indent * (depth + 1))
            out.append("}")
        elif depth > 0:
            out.append("\n")
            out.append(indent * (depth - 1))
            out.append("}")

    def _serialize_array_pretty(
        self, arr: List[Any], indent: str, depth: int, out: List[str]
    ) -> None:
        out.append("[\n")
        first = True
        for v in arr:
            if not first:
                out.append("\n")
            first = False
            if isinstance(v, dict):
                self._serialize_pretty(v, indent, depth, True, out)
            else:
                out.append(indent * (depth + 1))
                self._serialize_pretty(v, indent, depth + 1, False, out)
        out.append("\n")
        out.append(indent * depth)
        out.append("]")

    # ---- helpers ----

    def _keys(self, obj: Dict[str, Any]) -> List[str]:
        keys = list(obj.keys())
        if self.sort_keys:
            keys.sort()
        return keys

    def _serialize_key(self, key: str, out: List[str]) -> None:
        if _needs_quoting(key):
            self._serialize_string(key, out)
            return
        out.append(key)

    @staticmethod
    def _serialize_string(s: str, out: List[str]) -> None:
        out.append('"')
        for c in s:
            o = ord(c)
            if c == "\\":
                out.append("\\\\")
            elif c == '"':
                out.append('\\"')
            elif c == "\n":
                out.append("\\n")
            elif c == "\r":
                out.append("\\r")
            elif c == "\t":
                out.append("\\t")
            elif c == "\b":
                out.append("\\b")
            elif c == "\f":
                out.append("\\f")
            elif o < 0x20:
                out.append(f"\\u{o:04x}")
            else:
                out.append(c)
        out.append('"')

    @staticmethod
    def _serialize_float(f: float, out: List[str]) -> None:
        if f == int(f) and -9.2e18 <= f <= 9.2e18:
            out.append(str(int(f)))
        else:
            out.append(repr(f))

    # ========================================================================
    # Inline-aware pretty printer (`max_inline_width > 0` mode).
    # ========================================================================

    def _serialize_top_pretty_inline(
        self, v: Any, indent: str, max_inline_width: int, out: List[str]
    ) -> None:
        if v is None:
            return
        if isinstance(v, list):
            if len(v) == 0:
                return
            for i, el in enumerate(v):
                if i > 0:
                    out.append("\n")
                self._render_pretty_inline(el, indent, 0, max_inline_width, out)
            return
        if isinstance(v, dict):
            if len(v) == 0:
                return
            keys = self._keys(v)
            for i, k in enumerate(keys):
                if i > 0:
                    out.append("\n")
                self._serialize_key(k, out)
                out.append(" = ")
                self._render_pretty_inline(v[k], indent, 0, max_inline_width, out)
            return
        self._render_pretty_inline(v, indent, 0, max_inline_width, out)

    def _render_pretty_inline(
        self, v: Any, indent: str, depth: int, max_inline_width: int, out: List[str]
    ) -> None:
        # Scalars
        if isinstance(v, str):
            self._serialize_string(v, out)
            return
        if isinstance(v, bool):
            out.append("true" if v else "false")
            return
        if v is None:
            out.append("null")
            return
        if isinstance(v, int):
            out.append(str(v))
            return
        if isinstance(v, float):
            self._serialize_float(v, out)
            return

        if isinstance(v, dict):
            if len(v) == 0:
                out.append("{}")
                return
            inline = self._inline_value(v)
            if len(inline) <= max_inline_width:
                out.append(inline)
                return
            joined = self._joined_object_children(v)
            if joined and len(joined) <= max_inline_width:
                out.append("{")
                out.append("\n" + indent * (depth + 1))
                out.append(joined)
                out.append("\n" + indent * depth)
                out.append("}")
                return
            # wrapper_multi
            out.append("{")
            keys = self._keys(v)
            for k in keys:
                out.append("\n" + indent * (depth + 1))
                self._serialize_key(k, out)
                out.append(" = ")
                self._render_pretty_inline(v[k], indent, depth + 1, max_inline_width, out)
            out.append("\n" + indent * depth)
            out.append("}")
            return

        if isinstance(v, list):
            if len(v) == 0:
                out.append("[]")
                return
            inline = self._inline_value(v)
            if len(inline) <= max_inline_width:
                out.append(inline)
                return
            joined = self._joined_array_children(v)
            if joined and len(joined) <= max_inline_width:
                out.append("[")
                out.append("\n" + indent * (depth + 1))
                out.append(joined)
                out.append("\n" + indent * depth)
                out.append("]")
                return
            # wrapper_multi
            out.append("[")
            for el in v:
                out.append("\n" + indent * (depth + 1))
                self._render_pretty_inline(el, indent, depth + 1, max_inline_width, out)
            out.append("\n" + indent * depth)
            out.append("]")

    def _inline_value(self, v: Any) -> str:
        if isinstance(v, str):
            out: List[str] = []
            self._serialize_string(v, out)
            return "".join(out)
        if isinstance(v, bool):
            return "true" if v else "false"
        if v is None:
            return "null"
        if isinstance(v, int):
            return str(v)
        if isinstance(v, float):
            out = []
            self._serialize_float(v, out)
            return "".join(out)
        if isinstance(v, dict):
            if len(v) == 0:
                return "{}"
            parts = []
            for k in self._keys(v):
                inner: List[str] = []
                self._serialize_key(k, inner)
                parts.append("".join(inner) + " = " + self._inline_value(v[k]))
            return "{ " + ", ".join(parts) + " }"
        if isinstance(v, list):
            if len(v) == 0:
                return "[]"
            return "[ " + ", ".join(self._inline_value(el) for el in v) + " ]"
        return ""

    def _joined_object_children(self, obj: Dict[str, Any]) -> str:
        parts = []
        for k in self._keys(obj):
            inner: List[str] = []
            self._serialize_key(k, inner)
            parts.append("".join(inner) + " = " + self._inline_value(obj[k]))
        return ", ".join(parts)

    def _joined_array_children(self, arr: List[Any]) -> str:
        return ", ".join(self._inline_value(el) for el in arr)


def _needs_quoting(s: str) -> bool:
    if not s:
        return True
    return any(_is_key_delimiter(c) for c in s)


# =============================================================================
# Public functions
# =============================================================================


def parse(input: str) -> Any:
    """Parse a JHON document. Returns a dict for objects, list for arrays."""
    return Parser(input).parse()


def serialize(value: Any, *, sort_keys: bool = False) -> str:
    """Serialize a value to compact JHON."""
    return Serializer(sort_keys=sort_keys).serialize(value)


def serialize_pretty(
    value: Any,
    indent: str = "  ",
    *,
    sort_keys: bool = False,
    max_inline_width: int = 0,
) -> str:
    """Serialize a value to pretty-printed JHON.

    When ``max_inline_width`` > 0, short containers are inlined as
    ``{ k = v, ... }`` / ``[ a, b, ... ]`` provided they fit within that
    many characters. Default 0 preserves the legacy "always multi-line"
    behavior.
    """
    return Serializer(sort_keys=sort_keys).serialize_pretty(
        value, indent=indent, max_inline_width=max_inline_width
    )


# Legacy alias kept for backward compatibility with v1.x callers. The new
# parser strips comments inline, so this returns the input unchanged.
def remove_comments(input: str) -> str:
    """Deprecated. The v2 parser strips comments inline; this is a no-op."""
    return input
