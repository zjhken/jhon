package jhon;

import java.util.*;
import java.util.regex.Pattern;

/**
 * JHON - JinHui's Object Notation
 * A configuration language parser and serializer
 */
public class Jhon {

    // =============================================================================
    // Parse API
    // =============================================================================

    /**
     * Parse a JHON config string into a value
     */
    public static Object parse(String input) throws JhonParseException {
        String cleaned = removeComments(input).trim();

        if (cleaned.isEmpty()) {
            return new LinkedHashMap<String, Object>();
        }

        Parser parser = new Parser(cleaned);

        // Handle top-level objects wrapped in braces
        if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
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
        Serializer serializer = new Serializer();
        if (pretty) {
            return serializer.serializePretty(value, indent, 0, false);
        }
        return serializer.serializeCompact(value);
    }

    // =============================================================================
    // Remove Comments
    // =============================================================================

    static String removeComments(String input) {
        StringBuilder result = new StringBuilder();
        int i = 0;
        int len = input.length();

        while (i < len) {
            char c = input.charAt(i);

            if (c == '/' && i + 1 < len) {
                char nextChar = input.charAt(i + 1);

                if (nextChar == '/') {
                    // Single line comment
                    i += 2;
                    while (i < len && input.charAt(i) != '\n') {
                        i++;
                    }
                    continue;
                } else if (nextChar == '*') {
                    // Multi-line comment
                    i += 2;
                    boolean foundEnd = false;
                    while (i < len) {
                        if (input.charAt(i) == '*' && i + 1 < len && input.charAt(i + 1) == '/') {
                            i += 2;
                            foundEnd = true;
                            break;
                        }
                        i++;
                    }
                    if (!foundEnd) {
                        result.append("/*");
                    }
                    continue;
                }
            }

            result.append(c);
            i++;
        }

        return result.toString();
    }

    // =============================================================================
    // Parser Class
    // =============================================================================

    static class Parser {
        private final String input;
        private int pos;
        private final int len;

        Parser(String input) {
            this.input = input;
            this.pos = 0;
            this.len = input.length();
        }

        Map<String, Object> parseJhonObject() throws JhonParseException {
            Map<String, Object> obj = new LinkedHashMap<>();
            boolean isFirst = true;

            while (pos < len) {
                if (!isFirst) {
                    if (!peekSeparator((char) 0)) {
                        throw new JhonParseException("Expected comma or newline between properties", pos);
                    }
                    skipSeparators();
                }

                skipSpacesAndTabs();

                if (pos >= len) {
                    break;
                }

                String key = parseKey();

                skipWhitespace();

                if (pos >= len || input.charAt(pos) != '=') {
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
            if (pos >= len || input.charAt(pos) != '{') {
                throw new JhonParseException("Expected '{'", pos);
            }
            pos++;

            Map<String, Object> obj = new LinkedHashMap<>();
            boolean isFirst = true;

            while (pos < len) {
                if (!isFirst) {
                    if (!peekSeparator('}')) {
                        throw new JhonParseException("Expected comma or newline between object properties", pos);
                    }
                    skipSeparators();
                }

                skipSpacesAndTabs();

                if (pos >= len) {
                    throw new JhonParseException("Unterminated nested object", pos);
                }

                if (input.charAt(pos) == '}') {
                    pos++;
                    return obj;
                }

                String key = parseKey();

                skipWhitespace();

                if (pos >= len || input.charAt(pos) != '=') {
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

            if (pos >= len) {
                throw new JhonParseException("Expected key", pos);
            }

            char c = input.charAt(pos);

            if (c == '"' || c == '\'') {
                // Quoted key
                char quoteChar = c;
                pos++;

                StringBuilder result = new StringBuilder();
                while (pos < len) {
                    if (input.charAt(pos) == quoteChar) {
                        pos++;
                        return result.toString();
                    } else if (input.charAt(pos) == '\\') {
                        pos++;
                        if (pos < len) {
                            result.append(parseEscapeSequence(quoteChar));
                        }
                    } else {
                        result.append(input.charAt(pos));
                        pos++;
                    }
                }
                throw new JhonParseException("Unterminated string in key", pos);
            }

            // Unquoted key
            int start = pos;
            while (pos < len && isUnquotedKeyChar(input.charAt(pos))) {
                pos++;
            }

            String key = input.substring(start, pos);
            if (key.isEmpty()) {
                throw new JhonParseException("Empty key", pos);
            }

            return key;
        }

        Object parseValue() throws JhonParseException {
            skipWhitespace();

            if (pos >= len) {
                throw new JhonParseException("Expected value", pos);
            }

            char c = input.charAt(pos);

            if (c == '"' || c == '\'') {
                return parseStringValue();
            } else if (c == 'r' || c == 'R') {
                return parseRawStringValue();
            } else if (c == '[') {
                return parseArray();
            } else if (c == '{') {
                return parseNestedObject();
            } else if (Character.isDigit(c) || c == '-') {
                return parseNumber();
            } else if (c == 't' || c == 'f') {
                return parseBoolean();
            } else if (c == 'n') {
                return parseNull();
            }

            throw new JhonParseException("Unexpected character in value: " + c, pos);
        }

        String parseStringValue() throws JhonParseException {
            char quoteChar = input.charAt(pos);
            pos++;

            StringBuilder result = new StringBuilder();
            while (pos < len) {
                if (input.charAt(pos) == quoteChar) {
                    pos++;
                    return result.toString();
                } else if (input.charAt(pos) == '\\') {
                    pos++;
                    if (pos < len) {
                        result.append(parseEscapeSequence(quoteChar));
                    }
                } else {
                    result.append(input.charAt(pos));
                    pos++;
                }
            }

            throw new JhonParseException("Unterminated string", pos);
        }

        String parseRawStringValue() throws JhonParseException {
            if (pos >= len || (input.charAt(pos) != 'r' && input.charAt(pos) != 'R')) {
                throw new JhonParseException("Expected raw string", pos);
            }
            pos++;

            if (pos >= len) {
                throw new JhonParseException("Unexpected end of input in raw string", pos);
            }

            // Count hash symbols
            int hashCount = 0;
            while (pos < len && input.charAt(pos) == '#') {
                hashCount++;
                pos++;
            }

            if (pos >= len || input.charAt(pos) != '"') {
                throw new JhonParseException("Expected opening quote after r and # symbols in raw string", pos);
            }
            pos++;

            int start = pos;

            // Look for closing sequence
            while (pos < len) {
                if (input.charAt(pos) == '"') {
                    if (pos + hashCount < len) {
                        boolean isClosing = true;
                        for (int j = 1; j <= hashCount; j++) {
                            if (input.charAt(pos + j) != '#') {
                                isClosing = false;
                                break;
                            }
                        }

                        if (isClosing) {
                            String content = input.substring(start, pos);
                            pos += hashCount + 1;
                            return content;
                        }
                    }
                }

                pos++;
            }

            throw new JhonParseException("Unterminated raw string (expected closing: \"" +
                    "#".repeat(hashCount) + "\")", pos);
        }

        char parseEscapeSequence(char quoteChar) throws JhonParseException {
            if (pos >= len) {
                throw new JhonParseException("Incomplete escape sequence", pos);
            }

            char c = input.charAt(pos);
            pos++;

            switch (c) {
                case 'n':
                    return '\n';
                case 'r':
                    return '\r';
                case 't':
                    return '\t';
                case 'b':
                    return '\b';
                case 'f':
                    return '\f';
                case '\\':
                    return '\\';
                case '"':
                case '\'':
                    return c;
                case 'u': {
                    // Unicode escape
                    if (pos + 3 >= len) {
                        throw new JhonParseException("Incomplete Unicode escape sequence", pos);
                    }
                    String hex = input.substring(pos, pos + 4);
                    pos += 4;
                    try {
                        int codePoint = Integer.parseInt(hex, 16);
                        return (char) codePoint;
                    } catch (NumberFormatException e) {
                        throw new JhonParseException("Invalid Unicode escape sequence", pos - 4);
                    }
                }
                default:
                    return c;
            }
        }

        List<Object> parseArray() throws JhonParseException {
            if (pos >= len || input.charAt(pos) != '[') {
                throw new JhonParseException("Expected '['", pos);
            }
            pos++;

            List<Object> elements = new ArrayList<>();
            boolean isFirst = true;

            while (pos < len) {
                if (!isFirst) {
                    if (!peekSeparator(']')) {
                        throw new JhonParseException("Expected comma or newline between array elements", pos);
                    }
                    skipSeparators();
                }

                skipSpacesAndTabs();

                if (pos >= len) {
                    throw new JhonParseException("Unterminated array", pos);
                }

                if (input.charAt(pos) == ']') {
                    pos++;
                    return elements;
                }

                elements.add(parseValue());
                isFirst = false;
            }

            throw new JhonParseException("Unterminated array", pos);
        }

        Number parseNumber() throws JhonParseException {
            int start = pos;

            // Optional minus
            if (pos < len && input.charAt(pos) == '-') {
                pos++;
            }

            // Digits before decimal
            boolean hasDigits = false;
            while (pos < len && (Character.isDigit(input.charAt(pos)) || input.charAt(pos) == '_')) {
                if (input.charAt(pos) != '_') {
                    hasDigits = true;
                }
                pos++;
            }

            if (!hasDigits) {
                throw new JhonParseException("Invalid number", pos);
            }

            // Optional decimal
            if (pos < len && input.charAt(pos) == '.') {
                pos++;
                boolean hasDecimalDigits = false;
                while (pos < len && (Character.isDigit(input.charAt(pos)) || input.charAt(pos) == '_')) {
                    if (input.charAt(pos) != '_') {
                        hasDecimalDigits = true;
                    }
                    pos++;
                }
                if (!hasDecimalDigits) {
                    throw new JhonParseException("Invalid decimal number", pos);
                }
            }

            String numStr = input.substring(start, pos).replace("_", "");
            try {
                if (numStr.contains(".")) {
                    return Double.parseDouble(numStr);
                } else {
                    long value = Long.parseLong(numStr);
                    if (value >= Integer.MIN_VALUE && value <= Integer.MAX_VALUE) {
                        return (int) value;
                    }
                    return value;
                }
            } catch (NumberFormatException e) {
                throw new JhonParseException("Could not parse number", pos);
            }
        }

        Boolean parseBoolean() throws JhonParseException {
            if (pos + 3 < len &&
                    input.charAt(pos) == 't' &&
                    input.charAt(pos + 1) == 'r' &&
                    input.charAt(pos + 2) == 'u' &&
                    input.charAt(pos + 3) == 'e') {
                pos += 4;
                return true;
            } else if (pos + 4 < len &&
                    input.charAt(pos) == 'f' &&
                    input.charAt(pos + 1) == 'a' &&
                    input.charAt(pos + 2) == 'l' &&
                    input.charAt(pos + 3) == 's' &&
                    input.charAt(pos + 4) == 'e') {
                pos += 5;
                return false;
            }

            throw new JhonParseException("Invalid boolean value", pos);
        }

        Object parseNull() throws JhonParseException {
            if (pos + 3 < len &&
                    input.charAt(pos) == 'n' &&
                    input.charAt(pos + 1) == 'u' &&
                    input.charAt(pos + 2) == 'l' &&
                    input.charAt(pos + 3) == 'l') {
                pos += 4;
                return null;
            }

            throw new JhonParseException("Invalid null value", pos);
        }

        void skipSeparators() {
            while (pos < len) {
                char c = input.charAt(pos);
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

            while (tempPos < len) {
                char c = input.charAt(tempPos);
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
            while (pos < len && isWhitespace(input.charAt(pos))) {
                pos++;
            }
        }

        void skipSpacesAndTabs() {
            while (pos < len) {
                char c = input.charAt(pos);
                if (c == ' ' || c == '\t') {
                    pos++;
                } else {
                    break;
                }
            }
        }

        boolean isWhitespace(char c) {
            return c == ' ' || c == '\t' || c == '\n' || c == '\r';
        }

        boolean isUnquotedKeyChar(char c) {
            return Character.isLetterOrDigit(c) || c == '_' || c == '-';
        }
    }

    // =============================================================================
    // Serializer Class
    // =============================================================================

    static class Serializer {

        String serializeCompact(Object value) {
            if (value == null) {
                return "null";
            } else if (value instanceof String) {
                return serializeString((String) value);
            } else if (value instanceof Number) {
                return serializeNumber((Number) value);
            } else if (value instanceof Boolean) {
                return (Boolean) value ? "true" : "false";
            } else if (value instanceof List) {
                return serializeArrayCompact((List<?>) value);
            } else if (value instanceof Map) {
                return serializeObjectCompact((Map<?, ?>) value);
            }
            throw new IllegalArgumentException("Cannot serialize value: " + value);
        }

        String serializeObjectCompact(Map<?, ?> obj) {
            if (obj.isEmpty()) {
                return "";
            }

            List<String> sortedKeys = new ArrayList<>(obj.keySet().size());
            for (Object key : obj.keySet()) {
                sortedKeys.add(key.toString());
            }
            Collections.sort(sortedKeys);

            List<String> parts = new ArrayList<>();
            for (String key : sortedKeys) {
                String serializedKey = serializeKey(key);
                Object value = obj.get(key);
                String serializedValue;

                if (value instanceof Map) {
                    Map<?, ?> nestedObj = (Map<?, ?>) value;
                    if (nestedObj.isEmpty()) {
                        serializedValue = "{}";
                    } else {
                        serializedValue = "{" + serializeObjectCompact(nestedObj) + "}";
                    }
                } else {
                    serializedValue = serializeCompact(value);
                }

                parts.add(serializedKey + "=" + serializedValue);
            }

            return String.join(",", parts);
        }

        String serializeArrayCompact(List<?> arr) {
            if (arr.isEmpty()) {
                return "[]";
            }

            List<String> elements = new ArrayList<>();
            for (Object v : arr) {
                if (v instanceof Map) {
                    Map<?, ?> obj = (Map<?, ?>) v;
                    if (obj.isEmpty()) {
                        elements.add("{}");
                    } else {
                        elements.add("{" + serializeObjectCompact(obj) + "}");
                    }
                } else {
                    elements.add(serializeCompact(v));
                }
            }

            return "[" + String.join(",", elements) + "]";
        }

        String serializeKey(String key) {
            if (needsQuoting(key)) {
                return serializeString(key);
            }
            return key;
        }

        String serializeString(String s) {
            StringBuilder result = new StringBuilder();
            result.append('"');

            for (int i = 0; i < s.length(); i++) {
                char c = s.charAt(i);
                switch (c) {
                    case '\\' -> result.append("\\\\");
                    case '"' -> result.append("\\\"");
                    case '\n' -> result.append("\\n");
                    case '\r' -> result.append("\\r");
                    case '\t' -> result.append("\\t");
                    case '\b' -> result.append("\\b");
                    case '\f' -> result.append("\\f");
                    default -> {
                        if (c < ' ') {
                            result.append(String.format("\\u%04x", (int) c));
                        } else {
                            result.append(c);
                        }
                    }
                }
            }

            result.append('"');
            return result.toString();
        }

        String serializeNumber(Number n) {
            if (n instanceof Integer || n instanceof Long) {
                return n.toString();
            }
            double d = n.doubleValue();
            if (d == (long) d) {
                return String.format("%.0f", d);
            }
            return Double.toString(d);
        }

        String serializePretty(Object value, String indent, int depth, boolean inArray) {
            if (value == null) {
                return "null";
            } else if (value instanceof String) {
                return serializeString((String) value);
            } else if (value instanceof Number) {
                return serializeNumber((Number) value);
            } else if (value instanceof Boolean) {
                return (Boolean) value ? "true" : "false";
            } else if (value instanceof List) {
                return serializeArrayPretty((List<?>) value, indent, depth);
            } else if (value instanceof Map) {
                return serializeObjectPretty((Map<?, ?>) value, indent, depth, inArray);
            }
            throw new IllegalArgumentException("Cannot serialize value: " + value);
        }

        String serializeObjectPretty(Map<?, ?> obj, String indent, int depth, boolean inArray) {
            if (obj.isEmpty()) {
                return "";
            }

            List<String> sortedKeys = new ArrayList<>(obj.keySet().size());
            for (Object key : obj.keySet()) {
                sortedKeys.add(key.toString());
            }
            Collections.sort(sortedKeys);

            List<String> parts = new ArrayList<>();
            for (String key : sortedKeys) {
                String serializedKey = serializeKey(key);
                String serializedValue = serializePretty(obj.get(key), indent, depth + 1, false);

                String innerIndent;
                if (inArray) {
                    innerIndent = indent.repeat(depth + 2);
                    parts.add(innerIndent + serializedKey + " = " + serializedValue);
                } else if (depth == 0) {
                    parts.add(serializedKey + " = " + serializedValue);
                } else {
                    innerIndent = indent.repeat(depth);
                    parts.add(innerIndent + serializedKey + " = " + serializedValue);
                }
            }

            if (inArray) {
                String braceIndent = indent.repeat(depth + 1);
                return braceIndent + "{\n" + String.join(",\n", parts) + "\n" + braceIndent + "}";
            } else if (depth == 0) {
                return String.join(",\n", parts);
            } else {
                String outerIndent = indent.repeat(depth - 1);
                return "{\n" + String.join(",\n", parts) + "\n" + outerIndent + "}";
            }
        }

        String serializeArrayPretty(List<?> arr, String indent, int depth) {
            if (arr.isEmpty()) {
                return "[]";
            }

            String outerIndent = depth > 0 ? indent.repeat(depth - 1) : "";

            List<String> elements = new ArrayList<>();
            for (Object v : arr) {
                if (v instanceof Map) {
                    int objectDepth = Math.max(0, depth - 1);
                    elements.add(serializePretty(v, indent, objectDepth, true));
                } else {
                    String elementIndent = depth == 0 ? indent : indent.repeat(depth);
                    String serialized = serializePretty(v, indent, depth + 1, false);
                    elements.add(elementIndent + serialized);
                }
            }

            return "[\n" + String.join(",\n", elements) + "\n" + outerIndent + "]";
        }

        boolean needsQuoting(String s) {
            if (s.isEmpty()) {
                return true;
            }
            for (char c : s.toCharArray()) {
                if (!Character.isLetterOrDigit(c) && c != '_' && c != '-') {
                    return true;
                }
            }
            return false;
        }
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
