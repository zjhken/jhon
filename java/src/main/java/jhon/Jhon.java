package jhon;

import java.util.*;

/**
 * JHON - JinHui's Object Notation
 * A configuration language parser and serializer
 * Optimized for performance
 */
public class Jhon {

    // =============================================================================
    // Parse API
    // =============================================================================

    /**
     * Parse a JHON config string into a value
     */
    public static Object parse(String input) throws JhonParseException {
        char[] cleaned = removeComments(input);

        int start = 0, end = cleaned.length;
        while (start < end && isWhitespace(cleaned[start])) start++;
        while (end > start && isWhitespace(cleaned[end - 1])) end--;

        if (start >= end) {
            return new LinkedHashMap<String, Object>();
        }

        Parser parser = new Parser(cleaned, start, end);

        // Handle top-level objects wrapped in braces
        if (cleaned[start] == '{' && cleaned[end - 1] == '}') {
            return parser.parseNestedObject();
        }

        return parser.parseJhonObject();
    }

    /**
     * Serialize a value to compact JHON format
     */
    public static String serialize(Object value) {
        return serialize(value, false, "  ");
    }

    /**
     * Serialize a value to pretty-printed JHON format
     */
    public static String serializePretty(Object value, String indent) {
        return serialize(value, true, indent);
    }

    /**
     * Serialize a value with options
     */
    public static String serialize(Object value, boolean pretty, String indent) {
        StringBuilder sb = new StringBuilder();
        if (pretty) {
            return serializePretty(value, indent, 0, false);
        }
        serializeCompact(value, sb);
        return sb.toString();
    }

    // =============================================================================
    // Remove Comments (Optimized with char array)
    // =============================================================================

    static char[] removeComments(String input) {
        char[] chars = input.toCharArray();
        char[] result = new char[chars.length];
        int pos = 0;
        int len = chars.length;
        int i = 0;

        while (i < len) {
            char c = chars[i];

            if (c == '/' && i + 1 < len) {
                char nextChar = chars[i + 1];

                if (nextChar == '/') {
                    // Single line comment: skip to newline
                    i += 2;
                    while (i < len && chars[i] != '\n') {
                        i++;
                    }
                    continue;
                } else if (nextChar == '*') {
                    // Multi-line comment: skip to */
                    i += 2;
                    while (i < len) {
                        if (chars[i] == '*' && i + 1 < len && chars[i + 1] == '/') {
                            i += 2;
                            break;
                        }
                        i++;
                    }
                    continue;
                }
            }

            result[pos++] = chars[i++];
        }

        return Arrays.copyOf(result, pos);
    }

    // =============================================================================
    // Parser Class (Optimized)
    // =============================================================================

    static class Parser {
        private final char[] input;
        private int pos;
        private final int end;

        Parser(char[] input, int start, int end) {
            this.input = input;
            this.pos = start;
            this.end = end;
        }

        Map<String, Object> parseJhonObject() throws JhonParseException {
            Map<String, Object> obj = new LinkedHashMap<>();
            boolean isFirst = true;

            while (pos < end) {
                if (!isFirst) {
                    if (!peekSeparator((char) 0)) {
                        throw new JhonParseException("Expected comma or newline between properties", pos);
                    }
                    skipSeparators();
                }

                skipSpacesAndTabs();

                if (pos >= end) {
                    break;
                }

                String key = parseKey();

                skipWhitespace();

                if (pos >= end || input[pos] != '=') {
                    throw new JhonParseException("Expected '=' after key", pos);
                }
                pos++;

                skipWhitespace();

                Object value = parseValue();
                obj.put(key, value);

                isFirst = false;
            }

            return obj;
        }

        Map<String, Object> parseNestedObject() throws JhonParseException {
            if (pos >= end || input[pos] != '{') {
                throw new JhonParseException("Expected '{'", pos);
            }
            pos++;

            Map<String, Object> obj = new LinkedHashMap<>();
            boolean isFirst = true;

            while (pos < end) {
                if (!isFirst) {
                    if (!peekSeparator('}')) {
                        throw new JhonParseException("Expected comma or newline between object properties", pos);
                    }
                    skipSeparators();
                }

                skipSpacesAndTabs();

                if (pos >= end) {
                    throw new JhonParseException("Unterminated nested object", pos);
                }

                if (input[pos] == '}') {
                    pos++;
                    return obj;
                }

                String key = parseKey();

                skipWhitespace();

                if (pos >= end || input[pos] != '=') {
                    throw new JhonParseException("Expected '=' after key in nested object", pos);
                }
                pos++;

                skipWhitespace();

                Object value = parseValue();
                obj.put(key, value);

                isFirst = false;
            }

            throw new JhonParseException("Unterminated nested object", pos);
        }

        String parseKey() throws JhonParseException {
            skipWhitespace();

            if (pos >= end) {
                throw new JhonParseException("Expected key", pos);
            }

            char c = input[pos];

            if (c == '"' || c == '\'') {
                // Quoted key - parse inline without StringBuilder
                char quoteChar = c;
                pos++;
                int start = pos;

                while (pos < end) {
                    if (input[pos] == quoteChar) {
                        String result = new String(input, start, pos - start);
                        pos++;
                        return unescapeString(result, input, start - 1, pos);
                    } else if (input[pos] == '\\' && pos + 1 < end) {
                        // Has escape, need to use StringBuilder
                        StringBuilder sb = new StringBuilder();
                        sb.append(input, start, pos - start);
                        pos++;
                        sb.append(parseEscapeSequence(quoteChar));
                        while (pos < end) {
                            if (input[pos] == quoteChar) {
                                pos++;
                                return sb.toString();
                            } else if (input[pos] == '\\' && pos + 1 < end) {
                                pos++;
                                sb.append(parseEscapeSequence(quoteChar));
                            } else {
                                sb.append(input[pos++]);
                            }
                        }
                        throw new JhonParseException("Unterminated string in key", pos);
                    }
                    pos++;
                }
                throw new JhonParseException("Unterminated string in key", pos);
            }

            // Unquoted key - extract directly
            int start = pos;
            while (pos < end && isUnquotedKeyChar(input[pos])) {
                pos++;
            }

            if (start == pos) {
                throw new JhonParseException("Empty key", pos);
            }

            return new String(input, start, pos - start);
        }

        Object parseValue() throws JhonParseException {
            skipWhitespace();

            if (pos >= end) {
                throw new JhonParseException("Expected value", pos);
            }

            char c = input[pos];

            if (c == '"' || c == '\'') {
                return parseStringValue();
            } else if (c == 'r' || c == 'R') {
                return parseRawStringValue();
            } else if (c == '[') {
                return parseArray();
            } else if (c == '{') {
                return parseNestedObject();
            } else if (isDigit(c) || c == '-') {
                return parseNumber();
            } else if (c == 't' || c == 'f') {
                return parseBoolean();
            } else if (c == 'n') {
                return parseNull();
            }

            throw new JhonParseException("Unexpected character in value: " + c, pos);
        }

        String parseStringValue() throws JhonParseException {
            char quoteChar = input[pos];
            pos++;

            // First, try to parse without escapes (fast path)
            int start = pos;
            while (pos < end && input[pos] != quoteChar && input[pos] != '\\') {
                pos++;
            }

            if (pos < end && input[pos] == quoteChar) {
                String result = new String(input, start, pos - start);
                pos++;
                return result;
            }

            // Has escapes or need to continue
            StringBuilder result = new StringBuilder(pos - start + 16);
            result.append(input, start, pos - start);

            while (pos < end) {
                if (input[pos] == quoteChar) {
                    pos++;
                    return result.toString();
                } else if (input[pos] == '\\' && pos + 1 < end) {
                    pos++;
                    result.append(parseEscapeSequence(quoteChar));
                } else {
                    result.append(input[pos++]);
                }
            }

            throw new JhonParseException("Unterminated string", pos);
        }

        String parseRawStringValue() throws JhonParseException {
            if (pos >= end || (input[pos] != 'r' && input[pos] != 'R')) {
                throw new JhonParseException("Expected raw string", pos);
            }
            pos++;

            if (pos >= end) {
                throw new JhonParseException("Unexpected end of input in raw string", pos);
            }

            // Count hash symbols
            int hashCount = 0;
            while (pos < end && input[pos] == '#') {
                hashCount++;
                pos++;
            }

            if (pos >= end || input[pos] != '"') {
                throw new JhonParseException("Expected opening quote after r and # symbols in raw string", pos);
            }
            pos++;

            int start = pos;

            // Look for closing sequence
            while (pos < end) {
                if (input[pos] == '"') {
                    if (pos + hashCount < end) {
                        boolean isClosing = true;
                        for (int j = 1; j <= hashCount; j++) {
                            if (input[pos + j] != '#') {
                                isClosing = false;
                                break;
                            }
                        }

                        if (isClosing) {
                            String content = new String(input, start, pos - start);
                            pos += hashCount + 1;
                            return content;
                        }
                    }
                }

                pos++;
            }

            throw new JhonParseException("Unterminated raw string", pos);
        }

        char parseEscapeSequence(char quoteChar) throws JhonParseException {
            if (pos >= end) {
                throw new JhonParseException("Incomplete escape sequence", pos);
            }

            char c = input[pos++];
            return switch (c) {
                case 'n' -> '\n';
                case 'r' -> '\r';
                case 't' -> '\t';
                case 'b' -> '\b';
                case 'f' -> '\f';
                case '\\' -> '\\';
                case '"', '\'' -> c;
                case 'u' -> {
                    // Unicode escape
                    if (pos + 3 >= end) {
                        throw new JhonParseException("Incomplete Unicode escape sequence", pos);
                    }
                    int codePoint = 0;
                    for (int j = 0; j < 4; j++) {
                        char hexChar = input[pos++];
                        int digit = hexToDigit(hexChar);
                        if (digit < 0) {
                            throw new JhonParseException("Invalid Unicode escape sequence", pos - 4);
                        }
                        codePoint = (codePoint << 4) | digit;
                    }
                    yield (char) codePoint;
                }
                default -> c;
            };
        }

        List<Object> parseArray() throws JhonParseException {
            if (pos >= end || input[pos] != '[') {
                throw new JhonParseException("Expected '['", pos);
            }
            pos++;

            List<Object> elements = new ArrayList<>();
            boolean isFirst = true;

            while (pos < end) {
                if (!isFirst) {
                    if (!peekSeparator(']')) {
                        throw new JhonParseException("Expected comma or newline between array elements", pos);
                    }
                    skipSeparators();
                }

                skipSpacesAndTabs();

                if (pos >= end) {
                    throw new JhonParseException("Unterminated array", pos);
                }

                if (input[pos] == ']') {
                    pos++;
                    return elements;
                }

                elements.add(parseValue());
                isFirst = false;
            }

            throw new JhonParseException("Unterminated array", pos);
        }

        Number parseNumber() throws JhonParseException {
            // Optional minus
            boolean negative = false;
            if (pos < end && input[pos] == '-') {
                negative = true;
                pos++;
            }

            // Parse digits before decimal
            long intValue = 0;
            boolean hasDigits = false;
            while (pos < end && isDigit(input[pos])) {
                hasDigits = true;
                intValue = intValue * 10 + (input[pos] - '0');
                pos++;
            }

            // Skip underscores
            while (pos < end && input[pos] == '_') {
                pos++;
                while (pos < end && isDigit(input[pos])) {
                    intValue = intValue * 10 + (input[pos] - '0');
                    pos++;
                }
            }

            if (!hasDigits) {
                throw new JhonParseException("Invalid number", pos);
            }

            // Check for decimal part
            if (pos < end && input[pos] == '.') {
                pos++;

                // Parse decimal digits
                double decimalValue = intValue;
                double factor = 0.1;
                boolean hasDecimalDigits = false;

                while (pos < end && isDigit(input[pos])) {
                    hasDecimalDigits = true;
                    decimalValue += (input[pos] - '0') * factor;
                    factor /= 10;
                    pos++;
                }

                // Skip underscores in decimal
                while (pos < end && input[pos] == '_') {
                    pos++;
                    while (pos < end && isDigit(input[pos])) {
                        hasDecimalDigits = true;
                        decimalValue += (input[pos] - '0') * factor;
                        factor /= 10;
                        pos++;
                    }
                }

                if (!hasDecimalDigits) {
                    throw new JhonParseException("Invalid decimal number", pos);
                }

                return negative ? -decimalValue : decimalValue;
            }

            if (negative) {
                intValue = -intValue;
            }

            // Return as int if in range, otherwise long
            if (intValue >= Integer.MIN_VALUE && intValue <= Integer.MAX_VALUE) {
                return (int) intValue;
            }
            return intValue;
        }

        Boolean parseBoolean() throws JhonParseException {
            if (pos + 3 < end &&
                    input[pos] == 't' && input[pos + 1] == 'r' &&
                    input[pos + 2] == 'u' && input[pos + 3] == 'e') {
                pos += 4;
                return true;
            } else if (pos + 4 < end &&
                    input[pos] == 'f' && input[pos + 1] == 'a' &&
                    input[pos + 2] == 'l' && input[pos + 3] == 's' &&
                    input[pos + 4] == 'e') {
                pos += 5;
                return false;
            }

            throw new JhonParseException("Invalid boolean value", pos);
        }

        Object parseNull() throws JhonParseException {
            if (pos + 3 < end &&
                    input[pos] == 'n' && input[pos + 1] == 'u' &&
                    input[pos + 2] == 'l' && input[pos + 3] == 'l') {
                pos += 4;
                return null;
            }

            throw new JhonParseException("Invalid null value", pos);
        }

        void skipSeparators() {
            while (pos < end) {
                char c = input[pos];
                if (c == '\n' || c == ',') {
                    pos++;
                } else {
                    break;
                }
            }
        }

        boolean peekSeparator(char closingChar) {
            int tempPos = pos;
            boolean foundSpace = false;

            while (tempPos < end) {
                char c = input[tempPos];
                if (c == ' ' || c == '\t') {
                    tempPos++;
                    foundSpace = true;
                } else if (c == '\n' || c == ',') {
                    return true;
                } else if (c == closingChar && closingChar != 0) {
                    return true;
                } else if (foundSpace) {
                    return true;
                } else {
                    return false;
                }
            }

            return foundSpace || closingChar == 0;
        }

        void skipWhitespace() {
            while (pos < end && isWhitespace(input[pos])) {
                pos++;
            }
        }

        void skipSpacesAndTabs() {
            while (pos < end) {
                char c = input[pos];
                if (c == ' ' || c == '\t') {
                    pos++;
                } else {
                    break;
                }
            }
        }

        // Helper to unescape a string (only used when escapes were detected)
        private String unescapeString(String s, char[] input, int quoteStart, int quoteEnd) {
            // Simple check - if no backslash in string, no unescaping needed
            for (int i = 0; i < s.length(); i++) {
                if (s.charAt(i) == '\\') {
                    // Need to unescape - use StringBuilder
                    StringBuilder sb = new StringBuilder(s.length());
                    int srcPos = quoteStart + 1; // After opening quote

                    while (srcPos < quoteEnd - 1) {
                        if (input[srcPos] == '\\' && srcPos + 1 < quoteEnd) {
                            srcPos++;
                            char esc = input[srcPos++];
                            sb.append(switch (esc) {
                                case 'n' -> '\n';
                                case 'r' -> '\r';
                                case 't' -> '\t';
                                case 'b' -> '\b';
                                case 'f' -> '\f';
                                case '\\', '"', '\'' -> esc;
                                default -> esc;
                            });
                        } else {
                            sb.append(input[srcPos++]);
                        }
                    }
                    return sb.toString();
                }
            }
            return s;
        }
    }

    // =============================================================================
    // Serializer (Optimized with StringBuilder)
    // =============================================================================

    private static void serializeCompact(Object value, StringBuilder sb) {
        if (value == null) {
            sb.append("null");
        } else if (value instanceof String) {
            serializeString((String) value, sb);
        } else if (value instanceof Number) {
            serializeNumber((Number) value, sb);
        } else if (value instanceof Boolean) {
            sb.append((Boolean) value ? "true" : "false");
        } else if (value instanceof List) {
            serializeArrayCompact((List<?>) value, sb);
        } else if (value instanceof Map) {
            serializeObjectCompact((Map<?, ?>) value, sb);
        } else {
            throw new IllegalArgumentException("Cannot serialize value: " + value);
        }
    }

    private static void serializeObjectCompact(Map<?, ?> obj, StringBuilder sb) {
        if (obj.isEmpty()) {
            return;
        }

        // Get and sort keys
        String[] keys = new String[obj.size()];
        int i = 0;
        for (Object key : obj.keySet()) {
            keys[i++] = key.toString();
        }
        Arrays.sort(keys);

        boolean first = true;
        for (String key : keys) {
            if (!first) {
                sb.append(',');
            }
            first = false;

            // Write key
            serializeKey(key, sb);
            sb.append('=');

            // Write value
            Object v = obj.get(key);
            if (v instanceof Map) {
                Map<?, ?> nestedObj = (Map<?, ?>) v;
                sb.append('{');
                if (!nestedObj.isEmpty()) {
                    serializeObjectCompact(nestedObj, sb);
                }
                sb.append('}');
            } else {
                serializeCompact(v, sb);
            }
        }
    }

    private static void serializeArrayCompact(List<?> arr, StringBuilder sb) {
        if (arr.isEmpty()) {
            sb.append("[]");
            return;
        }

        sb.append('[');
        boolean first = true;
        for (Object v : arr) {
            if (!first) {
                sb.append(',');
            }
            first = false;

            if (v instanceof Map) {
                Map<?, ?> obj = (Map<?, ?>) v;
                sb.append('{');
                if (!obj.isEmpty()) {
                    serializeObjectCompact(obj, sb);
                }
                sb.append('}');
            } else {
                serializeCompact(v, sb);
            }
        }
        sb.append(']');
    }

    private static void serializeKey(String key, StringBuilder sb) {
        if (needsQuoting(key)) {
            serializeString(key, sb);
        } else {
            sb.append(key);
        }
    }

    private static void serializeString(String s, StringBuilder sb) {
        sb.append('"');

        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\' -> sb.append("\\\\");
                case '"' -> sb.append("\\\"");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                default -> {
                    if (c < ' ') {
                        sb.append("\\u");
                        appendHex(c, sb);
                    } else {
                        sb.append(c);
                    }
                }
            }
        }

        sb.append('"');
    }

    private static void serializeNumber(Number n, StringBuilder sb) {
        if (n instanceof Integer || n instanceof Long) {
            sb.append(n.longValue());
        } else if (n instanceof Float || n instanceof Double) {
            double d = n.doubleValue();
            if (d == (long) d) {
                sb.append((long) d);
            } else {
                sb.append(d);
            }
        } else {
            double d = n.doubleValue();
            if (d == (long) d) {
                sb.append((long) d);
            } else {
                sb.append(d);
            }
        }
    }

    private static void appendHex(char c, StringBuilder sb) {
        String hex = Integer.toHexString(c);
        for (int i = 0; i < 4 - hex.length(); i++) {
            sb.append('0');
        }
        sb.append(hex);
    }

    private static String serializePretty(Object value, String indent, int depth, boolean inArray) {
        StringBuilder sb = new StringBuilder();
        serializePrettyValue(value, indent, depth, inArray, sb);
        return sb.toString();
    }

    private static void serializePrettyValue(Object value, String indent, int depth, boolean inArray, StringBuilder sb) {
        if (value == null) {
            sb.append("null");
        } else if (value instanceof String) {
            serializeString((String) value, sb);
        } else if (value instanceof Number) {
            serializeNumber((Number) value, sb);
        } else if (value instanceof Boolean) {
            sb.append((Boolean) value ? "true" : "false");
        } else if (value instanceof List) {
            serializeArrayPretty((List<?>) value, indent, depth, sb);
        } else if (value instanceof Map) {
            serializeObjectPretty((Map<?, ?>) value, indent, depth, inArray, sb);
        } else {
            throw new IllegalArgumentException("Cannot serialize value: " + value);
        }
    }

    private static void serializeObjectPretty(Map<?, ?> obj, String indent, int depth, boolean inArray, StringBuilder sb) {
        if (obj.isEmpty()) {
            sb.append("{}");
            return;
        }

        // Get and sort keys
        String[] keys = new String[obj.size()];
        int idx = 0;
        for (Object key : obj.keySet()) {
            keys[idx++] = key.toString();
        }
        Arrays.sort(keys);

        // Add opening brace
        if (inArray) {
            String braceIndent = repeat(indent, depth + 1);
            sb.append(braceIndent).append("{\n");
        } else if (depth > 0) {
            sb.append("{\n");
        }

        boolean first = true;
        for (String key : keys) {
            if (!first) {
                sb.append(",\n");
            }
            first = false;

            String innerIndent;
            if (inArray) {
                innerIndent = repeat(indent, depth + 2);
            } else if (depth == 0) {
                innerIndent = "";
            } else {
                innerIndent = repeat(indent, depth);
            }

            sb.append(innerIndent);
            serializeKey(key, sb);
            sb.append(" = ");
            serializePrettyValue(obj.get(key), indent, depth + 1, false, sb);
        }

        // Add closing brace
        if (inArray) {
            String braceIndent = repeat(indent, depth + 1);
            sb.append("\n").append(braceIndent).append("}");
        } else if (depth > 0) {
            String outerIndent = repeat(indent, depth - 1);
            sb.append("\n").append(outerIndent).append("}");
        }
    }

    private static void serializeArrayPretty(List<?> arr, String indent, int depth, StringBuilder sb) {
        if (arr.isEmpty()) {
            sb.append("[]");
            return;
        }

        sb.append("[\n");
        String outerIndent = repeat(indent, depth);

        boolean first = true;
        for (Object v : arr) {
            if (!first) {
                sb.append(",\n");
            }
            first = false;

            if (v instanceof Map) {
                int objectDepth = Math.max(0, depth);
                serializeObjectPretty((Map<?, ?>) v, indent, objectDepth, true, sb);
            } else {
                String elementIndent = repeat(indent, depth + 1);
                sb.append(elementIndent);
                serializePrettyValue(v, indent, depth + 1, false, sb);
            }
        }
        sb.append("\n").append(outerIndent).append("]");
    }

    private static String repeat(String s, int count) {
        if (count <= 0) return "";
        if (count == 1) return s;

        StringBuilder sb = new StringBuilder(s.length() * count);
        for (int i = 0; i < count; i++) {
            sb.append(s);
        }
        return sb.toString();
    }

    private static boolean needsQuoting(String s) {
        if (s.isEmpty()) {
            return true;
        }
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (!(c >= 'a' && c <= 'z') && !(c >= 'A' && c <= 'Z') &&
                !(c >= '0' && c <= '9') && c != '_' && c != '-') {
                return true;
            }
        }
        return false;
    }

    // =============================================================================
    // Utility Methods
    // =============================================================================

    private static boolean isWhitespace(char c) {
        return c == ' ' || c == '\t' || c == '\n' || c == '\r';
    }

    private static boolean isUnquotedKeyChar(char c) {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
               (c >= '0' && c <= '9') || c == '_' || c == '-';
    }

    private static boolean isDigit(char c) {
        return c >= '0' && c <= '9';
    }

    private static int hexToDigit(char c) {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
        if (c >= 'A' && c <= 'F') return c - 'A' + 10;
        return -1;
    }

    // =============================================================================
    // Exception Class
    // =============================================================================

    public static class JhonParseException extends Exception {
        private final int position;

        public JhonParseException(String message, int position) {
            super(message);
            this.position = position;
        }

        public int getPosition() {
            return position;
        }

        @Override
        public String getMessage() {
            return "parse error at position " + position + ": " + super.getMessage();
        }
    }
}
