package jhon;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * JHON - JinHui's Object Notation.
 *
 * Parser and serializer mirroring rust/src/lib.rs. Strict per SPEC.md — every
 * error case in §8 raises JhonParseException with 1-based line and column.
 */
public final class Jhon {

    private Jhon() {}

    // ==================================================================================
    // Public API
    // ==================================================================================

    public static Object parse(String input) throws JhonParseException {
        Parser p = new Parser(input);
        try {
            p.skipWsAndComments();
            if (p.pos >= p.len) {
                return new LinkedHashMap<String, Object>();
            }
            char first = p.current();
            if (first == '{') {
                return p.parseNestedObject();
            }
            if (first == '[') {
                Object arr = p.parseArray();
                p.skipWsAndComments();
                if (p.pos < p.len) {
                    throw p.syntaxErr("unexpected content after top-level array");
                }
                return arr;
            }
            return p.parseJhonObject();
        } catch (ParseError e) {
            throw new JhonParseException(e);
        }
    }

    public static String serialize(Object value) {
        StringBuilder sb = new StringBuilder();
        serializeCompact(value, sb);
        return sb.toString();
    }

    public static String serializePretty(Object value, String indent) {
        if (indent == null || indent.isEmpty()) indent = "  ";
        StringBuilder sb = new StringBuilder();
        serializePretty(value, indent, 0, false, sb);
        return sb.toString();
    }

    public static String serialize(Object value, boolean pretty, String indent) {
        if (pretty) {
            return serializePretty(value, indent);
        }
        return serialize(value);
    }

    // ==================================================================================
    // ParseError — internal carrier with line/col
    // ==================================================================================

    static final class ParseError extends Exception {
        final int line;
        final int column;
        final int endLine;
        final int endColumn;
        final int position;
        final String key; // for duplicate-key

        ParseError(String message, int line, int column, int endLine, int endColumn, int position, String key) {
            super(message);
            this.line = line;
            this.column = column;
            this.endLine = endLine;
            this.endColumn = endColumn;
            this.position = position;
            this.key = key;
        }
    }

    /** Public exception thrown by {@link #parse(String)}. */
    public static class JhonParseException extends Exception {
        private final int line;
        private final int column;
        private final int endLine;
        private final int endColumn;
        private final int position;
        private final String key;

        JhonParseException(ParseError e) {
            super(e.getMessage(), e);
            this.line = e.line;
            this.column = e.column;
            this.endLine = e.endLine;
            this.endColumn = e.endColumn;
            this.position = e.position;
            this.key = e.key;
        }

        public int getLine() { return line; }
        public int getColumn() { return column; }
        public int getEndLine() { return endLine; }
        public int getEndColumn() { return endColumn; }
        public int getPosition() { return position; }
        public String getDuplicateKey() { return key; }

        @Override
        public String getMessage() {
            if (key != null) {
                return "duplicate key at " + line + ":" + column + ": \"" + key + "\"";
            }
            if (line == 0 && column == 0) {
                return "parse error: " + super.getMessage();
            }
            return "parse error at " + line + ":" + column + ": " + super.getMessage();
        }
    }

    // ==================================================================================
    // Parser
    // ==================================================================================

    static final class Parser {
        private final String input;
        private final int len;
        private int pos = 0;
        private int line = 1;
        private int col = 1;

        Parser(String input) {
            this.input = input;
            this.len = input.length();
        }

        char current() {
            return pos < len ? input.charAt(pos) : '\0';
        }

        char peek(int offset) {
            int idx = pos + offset;
            return (idx >= 0 && idx < len) ? input.charAt(idx) : '\0';
        }

        boolean atEnd() {
            return pos >= len;
        }

        void advance() {
            if (pos >= len) return;
            char c = input.charAt(pos);
            if (c == '\n') {
                line++;
                col = 1;
            } else {
                col++;
            }
            pos++;
        }

        ParseError syntaxErr(String msg) {
            return new ParseError(msg, line, col, line, col + 1, pos, null);
        }

        // Skip whitespace and comments. Returns true if a newline was consumed.
        boolean skipWsAndComments() throws ParseError {
            boolean sawNewline = false;
            while (pos < len) {
                char c = input.charAt(pos);
                if (c == ' ' || c == '\t' || c == '\r') {
                    advance();
                } else if (c == '\n') {
                    sawNewline = true;
                    advance();
                } else if (c == '/' && peek(1) == '/') {
                    advance();
                    advance();
                    while (pos < len && input.charAt(pos) != '\n') advance();
                } else if (c == '/' && peek(1) == '*') {
                    advance();
                    advance();
                    boolean closed = false;
                    while (pos < len) {
                        char d = input.charAt(pos);
                        if (d == '*' && peek(1) == '/') {
                            advance();
                            advance();
                            closed = true;
                            break;
                        }
                        if (d == '\n') sawNewline = true;
                        advance();
                    }
                    if (!closed) {
                        // Silently accept — the trailing chars will surface as
                        // "unexpected content" or EOF later. Mirrors Rust.
                    }
                } else {
                    break;
                }
            }
            return sawNewline;
        }

        // Returns {sawNewline, sawComma}. Per SPEC §5.3 same-line items need a comma.
        boolean[] skipInterItemSeparator() throws ParseError {
            boolean sawNewline = skipWsAndComments();
            boolean sawComma = false;
            if (current() == ',') {
                sawComma = true;
                advance();
                if (skipWsAndComments()) sawNewline = true;
            }
            return new boolean[]{sawNewline, sawComma};
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> parseJhonObject() throws ParseError {
            Map<String, Object> obj = new LinkedHashMap<>();
            skipWsAndComments();
            while (pos < len) {
                parsePropertyInto(obj);
                boolean[] sep = skipInterItemSeparator();
                if (pos >= len) break;
                if (!sep[0] && !sep[1]) {
                    throw syntaxErr("items on the same line must be separated by a comma");
                }
            }
            return obj;
        }

        Map<String, Object> parseNestedObject() throws ParseError {
            advance(); // {
            Map<String, Object> obj = new LinkedHashMap<>();
            skipWsAndComments();
            while (true) {
                char c = current();
                if (c == '\0') {
                    throw syntaxErr("unterminated nested object");
                }
                if (c == '}') {
                    advance();
                    return obj;
                }
                parsePropertyInto(obj);
                boolean[] sep = skipInterItemSeparator();
                if (current() == '}') {
                    advance();
                    return obj;
                }
                if (atEnd()) {
                    throw syntaxErr("unterminated nested object");
                }
                if (!sep[0] && !sep[1]) {
                    throw syntaxErr("items on the same line must be separated by a comma");
                }
            }
        }

        void parsePropertyInto(Map<String, Object> obj) throws ParseError {
            String key = parseKey();
            skipWsAndComments();
            if (current() != '=') {
                throw syntaxErr("expected '=' after key");
            }
            advance();
            skipWsAndComments();
            Object value = parseValue();
            if (obj.containsKey(key)) {
                throw new ParseError(
                    "duplicate key \"" + key + "\"",
                    line, col, line, col + 1, pos, key
                );
            }
            obj.put(key, value);
        }

        String parseKey() throws ParseError {
            skipWsAndComments();
            char c = current();
            if (c == '\0') {
                throw syntaxErr("expected key");
            }
            if (c == '"' || c == '\'') {
                return parseString(c);
            }
            // Bare key — scan until delimiter per SPEC §3.3.
            int start = pos;
            while (pos < len && !isKeyDelimiter(input.charAt(pos))) advance();
            if (pos == start) {
                throw syntaxErr("empty key");
            }
            return input.substring(start, pos);
        }

        Object parseValue() throws ParseError {
            skipWsAndComments();
            char c = current();
            if (c == '\0') {
                throw syntaxErr("expected value");
            }
            if (c == '"' || c == '\'') {
                return parseString(c);
            }
            if (c == 'r' || c == 'R') {
                char next = peek(1);
                if (next == '"' || next == '#') {
                    return parseRawString();
                }
                throw syntaxErr("unexpected character in value: " + c);
            }
            if (c == '[') return parseArray();
            if (c == '{') return parseNestedObject();
            if (c == '-' || (c >= '0' && c <= '9')) return parseNumber();
            if (c == 't' || c == 'f') return parseBoolean();
            if (c == 'n') return parseNull();
            throw syntaxErr("unexpected character in value: " + c);
        }

        String parseString(char quote) throws ParseError {
            advance(); // opening quote
            StringBuilder sb = new StringBuilder();
            while (true) {
                char c = current();
                if (c == '\0') {
                    throw syntaxErr("unterminated string");
                }
                if (c < 0x20 || c == 0x7f) {
                    throw syntaxErr("literal control character 0x"
                        + Integer.toHexString(c).toUpperCase()
                        + " in string; use an escape or a raw string");
                }
                if (c == quote) {
                    advance();
                    return sb.toString();
                }
                if (c == '\\') {
                    advance();
                    char esc = current();
                    if (esc == '\0') {
                        throw syntaxErr("incomplete escape sequence");
                    }
                    advance();
                    switch (esc) {
                        case 'n': sb.append('\n'); break;
                        case 'r': sb.append('\r'); break;
                        case 't': sb.append('\t'); break;
                        case 'b': sb.append((char) 0x08); break;
                        case 'f': sb.append((char) 0x0c); break;
                        case '\\': sb.append('\\'); break;
                        case '"': sb.append('"'); break;
                        case '\'': sb.append('\''); break;
                        case '/': sb.append('/'); break;
                        case 'x': {
                            int v = parseHexDigits(2, "\\x");
                            sb.append((char) v);
                            break;
                        }
                        case 'u': {
                            int v = parseHexDigits(4, "\\u");
                            if (v >= 0xd800 && v <= 0xdfff) {
                                throw syntaxErr("surrogate code point U+"
                                    + String.format("%04X", v)
                                    + " requires a pair; surrogate handling is not yet implemented");
                            }
                            sb.append((char) v); // works for BMP; above BMP needs surrogate pair
                            break;
                        }
                        default:
                            throw syntaxErr("unknown escape \\" + esc);
                    }
                    continue;
                }
                sb.append(c);
                advance();
            }
        }

        int parseHexDigits(int count, String label) throws ParseError {
            int v = 0;
            for (int i = 0; i < count; i++) {
                char c = current();
                if (c == '\0' || !isHexDigit(c)) {
                    throw syntaxErr("incomplete " + label + " escape");
                }
                v = (v << 4) | hexValue(c);
                advance();
            }
            return v;
        }

        String parseRawString() throws ParseError {
            advance(); // 'r' or 'R'
            int hashCount = 0;
            while (current() == '#') {
                hashCount++;
                advance();
            }
            if (current() != '"') {
                throw syntaxErr("expected opening quote after r and # symbols in raw string");
            }
            advance();
            int start = pos;
            // Build closing pattern.
            StringBuilder closingSb = new StringBuilder();
            closingSb.append('"');
            for (int i = 0; i < hashCount; i++) closingSb.append('#');
            String closing = closingSb.toString();
            int idx = input.indexOf(closing, start);
            if (idx < 0) {
                while (pos < len) advance();
                throw syntaxErr("unterminated raw string (expected closing " + closing + ")");
            }
            String value = input.substring(start, idx);
            int target = idx + closing.length();
            while (pos < target) advance();
            return value;
        }

        Object parseNumber() throws ParseError {
            boolean negative = false;
            if (current() == '-') {
                negative = true;
                advance();
            }
            int radix = 0;
            if (current() == '0') {
                char next = peek(1);
                if (next == 'x') radix = 16;
                else if (next == 'o') radix = 8;
                else if (next == 'b') radix = 2;
                else if (next == 'X' || next == 'O' || next == 'B') {
                    throw syntaxErr("uppercase radix prefix 0" + next + " not allowed; use lowercase");
                }
            }

            String literal;
            boolean isFloat = false;

            if (radix != 0) {
                advance(); // 0
                advance(); // x/o/b
                literal = scanRadixDigits(radix);
            } else {
                literal = scanDecDigits();
                if (current() == '.') {
                    isFloat = true;
                    advance();
                    literal = literal + "." + scanDecDigits();
                }
                if (current() == 'e' || current() == 'E') {
                    isFloat = true;
                    advance();
                    String exp = "e";
                    if (current() == '+' || current() == '-') {
                        exp += current();
                        advance();
                    }
                    literal = literal + exp + scanDecDigits();
                }
            }

            char cur = current();
            char next = peek(1);
            if ((cur == 'u' || cur == 'i' || cur == 'f') && isAsciiAlphanumeric(next)) {
                throw syntaxErr("number type suffix not allowed (saw '" + cur + next + "')");
            }

            if (radix != 0) {
                String signed = negative ? "-" + literal : literal;
                BigInteger bi = new BigInteger(literal, radix);
                if (negative) bi = bi.negate();
                // Try to fit into long, otherwise return double.
                try {
                    return bi.longValueExact();
                } catch (ArithmeticException exLong) {
                    return bi.doubleValue();
                }
            }

            if (!isFloat) {
                try {
                    return Long.parseLong(negative ? "-" + literal : literal);
                } catch (NumberFormatException exLong) {
                    // fall through to double
                }
            }
            String signed = negative ? "-" + literal : literal;
            try {
                return Double.parseDouble(signed);
            } catch (NumberFormatException ex) {
                throw syntaxErr("could not parse number: " + signed);
            }
        }

        String scanDecDigits() throws ParseError {
            StringBuilder sb = new StringBuilder();
            boolean lastWasUnder = false;
            boolean hasDigit = false;
            while (pos < len) {
                char c = input.charAt(pos);
                if (c >= '0' && c <= '9') {
                    sb.append(c);
                    lastWasUnder = false;
                    hasDigit = true;
                    advance();
                } else if (c == '_') {
                    if (!hasDigit || lastWasUnder) {
                        throw syntaxErr("invalid underscore placement in number");
                    }
                    lastWasUnder = true;
                    advance();
                } else {
                    break;
                }
            }
            if (!hasDigit) {
                throw syntaxErr("number requires at least one digit");
            }
            if (lastWasUnder) {
                throw syntaxErr("number cannot end with underscore");
            }
            return sb.toString();
        }

        String scanRadixDigits(int radix) throws ParseError {
            StringBuilder sb = new StringBuilder();
            boolean lastWasUnder = false;
            boolean hasDigit = false;
            while (pos < len) {
                char c = input.charAt(pos);
                boolean ok = false;
                if (radix == 16) {
                    ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
                } else if (radix == 8) {
                    ok = c >= '0' && c <= '7';
                } else if (radix == 2) {
                    ok = c == '0' || c == '1';
                }
                if (ok) {
                    sb.append(c);
                    lastWasUnder = false;
                    hasDigit = true;
                    advance();
                } else if (c == '_') {
                    if (!hasDigit || lastWasUnder) {
                        throw syntaxErr("invalid underscore placement in number");
                    }
                    lastWasUnder = true;
                    advance();
                } else {
                    break;
                }
            }
            if (!hasDigit) {
                throw syntaxErr("number requires at least one digit after radix prefix");
            }
            if (lastWasUnder) {
                throw syntaxErr("number cannot end with underscore");
            }
            return sb.toString();
        }

        Object parseBoolean() throws ParseError {
            if (matches("true")) {
                for (int i = 0; i < 4; i++) advance();
                return Boolean.TRUE;
            }
            if (matches("false")) {
                for (int i = 0; i < 5; i++) advance();
                return Boolean.FALSE;
            }
            throw syntaxErr("invalid boolean value");
        }

        Object parseNull() throws ParseError {
            if (matches("null")) {
                for (int i = 0; i < 4; i++) advance();
                return null;
            }
            throw syntaxErr("invalid null value");
        }

        boolean matches(String lit) {
            if (pos + lit.length() > len) return false;
            for (int i = 0; i < lit.length(); i++) {
                if (input.charAt(pos + i) != lit.charAt(i)) return false;
            }
            return true;
        }

        Object parseArray() throws ParseError {
            advance(); // [
            ArrayList<Object> arr = new ArrayList<>();
            skipWsAndComments();
            while (true) {
                char c = current();
                if (c == '\0') {
                    throw syntaxErr("unterminated array");
                }
                if (c == ']') {
                    advance();
                    return arr;
                }
                arr.add(parseValue());
                boolean[] sep = skipInterItemSeparator();
                if (current() == ']') {
                    advance();
                    return arr;
                }
                if (atEnd()) {
                    throw syntaxErr("unterminated array");
                }
                if (!sep[0] && !sep[1]) {
                    throw syntaxErr("items on the same line must be separated by a comma");
                }
            }
        }
    }

    // ==================================================================================
    // Serializer
    // ==================================================================================

    static void serializeCompact(Object v, StringBuilder sb) {
        if (v == null) {
            sb.append("null");
            return;
        }
        if (v instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> obj = (Map<String, Object>) v;
            if (obj.isEmpty()) return;
            serializeObjectCompact(obj, sb);
            return;
        }
        if (v instanceof ArrayList) {
            ArrayList<?> arr = (ArrayList<?>) v;
            if (arr.isEmpty()) {
                sb.append("[]");
                return;
            }
            sb.append('[');
            boolean first = true;
            for (Object el : arr) {
                if (!first) sb.append(',');
                first = false;
                if (el instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> m = (Map<String, Object>) el;
                    if (m.isEmpty()) {
                        sb.append("{}");
                    } else {
                        sb.append('{');
                        serializeObjectCompact(m, sb);
                        sb.append('}');
                    }
                    continue;
                }
                serializeCompact(el, sb);
            }
            sb.append(']');
            return;
        }
        if (v instanceof String) {
            serializeString((String) v, sb);
            return;
        }
        if (v instanceof Long || v instanceof Integer || v instanceof Short || v instanceof Byte) {
            sb.append(((Number) v).longValue());
            return;
        }
        if (v instanceof BigInteger) {
            sb.append(v.toString());
            return;
        }
        if (v instanceof Double || v instanceof Float) {
            double d = ((Number) v).doubleValue();
            if (d == Math.rint(d) && d >= -9.2e18 && d <= 9.2e18) {
                sb.append((long) d);
            } else {
                sb.append(d);
            }
            return;
        }
        if (v instanceof Boolean) {
            sb.append(((Boolean) v) ? "true" : "false");
            return;
        }
        sb.append(v.toString());
    }

    static void serializeObjectCompact(Map<String, Object> obj, StringBuilder sb) {
        boolean first = true;
        for (Map.Entry<String, Object> e : obj.entrySet()) {
            if (!first) sb.append(',');
            first = false;
            serializeKey(e.getKey(), sb);
            sb.append('=');
            Object v = e.getValue();
            if (v instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> m = (Map<String, Object>) v;
                if (m.isEmpty()) {
                    sb.append("{}");
                } else {
                    sb.append('{');
                    serializeObjectCompact(m, sb);
                    sb.append('}');
                }
                continue;
            }
            serializeCompact(v, sb);
        }
    }

    static void serializePretty(Object v, String indent, int depth, boolean inArray, StringBuilder sb) {
        if (v == null) { sb.append("null"); return; }
        if (v instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> obj = (Map<String, Object>) v;
            if (obj.isEmpty()) {
                if (inArray || depth > 0) sb.append("{}");
                return;
            }
            serializeObjectPretty(obj, indent, depth, inArray, sb);
            return;
        }
        if (v instanceof ArrayList) {
            ArrayList<?> arr = (ArrayList<?>) v;
            if (arr.isEmpty()) { sb.append("[]"); return; }
            serializeArrayPretty(arr, indent, depth, sb);
            return;
        }
        // Scalars: reuse compact formatter.
        serializeCompact(v, sb);
    }

    static void serializeObjectPretty(Map<String, Object> obj, String indent, int depth, boolean inArray, StringBuilder sb) {
        if (inArray) {
            for (int i = 0; i < depth + 1; i++) sb.append(indent);
            sb.append("{\n");
        } else if (depth > 0) {
            sb.append("{\n");
        }
        boolean first = true;
        for (Map.Entry<String, Object> e : obj.entrySet()) {
            if (!first) sb.append('\n');
            first = false;
            int innerDepth;
            if (inArray) innerDepth = depth + 2;
            else if (depth == 0) innerDepth = 0;
            else innerDepth = depth;
            for (int i = 0; i < innerDepth; i++) sb.append(indent);
            serializeKey(e.getKey(), sb);
            sb.append(" = ");
            serializePretty(e.getValue(), indent, depth + 1, false, sb);
        }
        if (inArray) {
            sb.append('\n');
            for (int i = 0; i < depth + 1; i++) sb.append(indent);
            sb.append('}');
        } else if (depth > 0) {
            sb.append('\n');
            for (int i = 0; i < depth - 1; i++) sb.append(indent);
            sb.append('}');
        }
    }

    static void serializeArrayPretty(ArrayList<?> arr, String indent, int depth, StringBuilder sb) {
        sb.append("[\n");
        boolean first = true;
        for (Object v : arr) {
            if (!first) sb.append('\n');
            first = false;
            if (v instanceof Map) {
                serializePretty(v, indent, depth, true, sb);
            } else {
                for (int i = 0; i < depth + 1; i++) sb.append(indent);
                serializePretty(v, indent, depth + 1, false, sb);
            }
        }
        sb.append('\n');
        for (int i = 0; i < depth; i++) sb.append(indent);
        sb.append(']');
    }

    static void serializeKey(String key, StringBuilder sb) {
        if (needsQuoting(key)) {
            serializeString(key, sb);
            return;
        }
        sb.append(key);
    }

    static boolean needsQuoting(String s) {
        if (s.isEmpty()) return true;
        for (int i = 0; i < s.length(); i++) {
            if (isKeyDelimiter(s.charAt(i))) return true;
        }
        return false;
    }

    static void serializeString(String s, StringBuilder sb) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\': sb.append("\\\\"); break;
                case '"': sb.append("\\\""); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                case '\b': sb.append("\\b"); break;
                case '\f': sb.append("\\f"); break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append('"');
    }

    // ==================================================================================
    // Character helpers
    // ==================================================================================

    static boolean isKeyDelimiter(char c) {
        switch (c) {
            case ' ': case '\t': case '\n': case '\r':
            case '=': case ',':
            case '{': case '}': case '[': case ']':
            case '/': case '"': case '\'': case '#':
                return true;
        }
        return false;
    }

    static boolean isHexDigit(char c) {
        return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
    }

    static int hexValue(char c) {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
        return c - 'A' + 10;
    }

    static boolean isAsciiAlphanumeric(char c) {
        return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
    }
}
