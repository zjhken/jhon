package jhon;

import java.util.*;

/**
 * Simple benchmark runner for JHON parser comparing with JSON
 * (No JMH dependency for simpler execution)
 */
public class SimpleBenchmark {

    // Test data
    private static final String SMALL_JHON = "name=\"test\" age=25 active=true";
    private static final String SMALL_JSON = "{\"name\":\"test\",\"age\":25,\"active\":true}";

    private static final String MEDIUM_JHON = """
            app_name="ocean-note"
            version="1.0.0"
            debug=true
            database={host="localhost" port=5432 name="mydb"}
            features=["markdown" "collaboration" "real-time"]
            max_file_size=1048576
            timeout=30.5
            server={host="0.0.0.0" port=3000}
            """;

    private static final String MEDIUM_JSON = "{\"app_name\":\"ocean-note\",\"version\":\"1.0.0\",\"debug\":true,\"database\":{\"host\":\"localhost\",\"port\":5432,\"name\":\"mydb\"},\"features\":[\"markdown\",\"collaboration\",\"real-time\"],\"max_file_size\":1048576,\"timeout\":30.5,\"server\":{\"host\":\"0.0.0.0\",\"port\":3000}}";

    public static void main(String[] args) throws Exception {
        System.out.println("=".repeat(80));
        System.out.println("JHON Parser Benchmarks (Java)");
        System.out.println("=".repeat(80));

        List<Result> results = new ArrayList<>();

        // Warmup
        System.out.println("\nWarming up...");
        for (int i = 0; i < 10000; i++) {
            Jhon.parse(SMALL_JHON);
            parseSimpleJSON(SMALL_JSON);
        }

        // Parse benchmarks - Small
        System.out.println("\n--- Parse Benchmarks (Small) ---");
        results.add(new Result("Parse JHON (Small)", benchmarkParseJHONSmall()));
        results.add(new Result("Parse JSON (Small)", benchmarkParseJSONSmall()));

        // Parse benchmarks - Medium
        System.out.println("\n--- Parse Benchmarks (Medium) ---");
        results.add(new Result("Parse JHON (Medium)", benchmarkParseJHONMedium()));
        results.add(new Result("Parse JSON (Medium)", benchmarkParseJSONMedium()));

        // Serialize benchmarks - Small
        System.out.println("\n--- Serialize Benchmarks (Small) ---");
        results.add(new Result("Serialize JHON (Small)", benchmarkSerializeJHONSmall()));
        results.add(new Result("Serialize JSON (Small)", benchmarkSerializeJSONSmall()));

        // Serialize benchmarks - Medium
        System.out.println("\n--- Serialize Benchmarks (Medium) ---");
        results.add(new Result("Serialize JHON (Medium)", benchmarkSerializeJHONMedium()));
        results.add(new Result("Serialize JSON (Medium)", benchmarkSerializeJSONMedium()));

        // Round-trip benchmarks
        System.out.println("\n--- Round-Trip Benchmarks (Small) ---");
        results.add(new Result("Round-trip JHON (Small)", benchmarkRoundTripJHONSmall()));
        results.add(new Result("Round-trip JSON (Small)", benchmarkRoundTripJSONSmall()));

        // Specialized benchmarks
        System.out.println("\n--- Specialized Benchmarks ---");
        results.add(new Result("Remove Comments", benchmarkRemoveComments()));
        results.add(new Result("Parse Numbers with Underscores", benchmarkParseNumbersWithUnderscores()));
        results.add(new Result("Parse Raw Strings", benchmarkParseRawStrings()));
        results.add(new Result("Parse Nested Objects", benchmarkParseNestedObjects()));
        results.add(new Result("Parse Arrays", benchmarkParseArrays()));

        // Print results
        System.out.println("\n" + "=".repeat(80));
        System.out.println("Results (nanoseconds per operation)");
        System.out.println("=".repeat(80));
        System.out.printf("%-40s %15s %15s%n", "Benchmark", "Time (ns)", "Ops/sec");
        System.out.println("-".repeat(80));

        for (Result r : results) {
            long opsPerSec = r.timeNs > 0 ? 1_000_000_000L / r.timeNs : 0;
            System.out.printf("%-40s %15d %15d%n", r.name, r.timeNs, opsPerSec);
        }

        // Size comparison
        System.out.println("\n" + "=".repeat(80));
        System.out.println("Size Comparison");
        System.out.println("=".repeat(80));

        Object jhonObj = Jhon.parse(MEDIUM_JHON);
        String jhonSerialized = Jhon.serialize(jhonObj);

        System.out.println("JHON size:  " + jhonSerialized.length() + " bytes");
        System.out.println("JSON size:  " + MEDIUM_JSON.trim().length() + " bytes");
        System.out.printf("JHON is %.1f%% of JSON size%n",
                jhonSerialized.length() * 100.0 / MEDIUM_JSON.trim().length());
    }

    static class Result {
        String name;
        long timeNs;

        Result(String name, long timeNs) {
            this.name = name;
            this.timeNs = timeNs;
        }
    }

    // Benchmark methods
    static long benchmarkParseJHONSmall() throws Exception {
        int iterations = 10000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            Jhon.parse(SMALL_JHON);
        }
        return (System.nanoTime() - start) / iterations;
    }

    static long benchmarkParseJSONSmall() {
        int iterations = 10000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            parseSimpleJSON(SMALL_JSON);
        }
        return (System.nanoTime() - start) / iterations;
    }

    static long benchmarkParseJHONMedium() throws Exception {
        int iterations = 5000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            Jhon.parse(MEDIUM_JHON);
        }
        return (System.nanoTime() - start) / iterations;
    }

    static long benchmarkParseJSONMedium() {
        int iterations = 5000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            parseSimpleJSON(MEDIUM_JSON);
        }
        return (System.nanoTime() - start) / iterations;
    }

    static long benchmarkSerializeJHONSmall() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("name", "test");
        value.put("age", 25);
        value.put("active", true);
        int iterations = 10000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            Jhon.serialize(value);
        }
        return (System.nanoTime() - start) / iterations;
    }

    static long benchmarkSerializeJSONSmall() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("name", "test");
        value.put("age", 25);
        value.put("active", true);
        int iterations = 10000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            toJSONString(value);
        }
        return (System.nanoTime() - start) / iterations;
    }

    static long benchmarkSerializeJHONMedium() throws Exception {
        Object parsed = Jhon.parse(MEDIUM_JHON);
        int iterations = 5000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            Jhon.serialize(parsed);
        }
        return (System.nanoTime() - start) / iterations;
    }

    static long benchmarkSerializeJSONMedium() {
        Object parsed = parseSimpleJSON(MEDIUM_JSON);
        int iterations = 5000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            toJSONString(parsed);
        }
        return (System.nanoTime() - start) / iterations;
    }

    static long benchmarkRoundTripJHONSmall() throws Exception {
        Map<String, Object> original = new LinkedHashMap<>();
        original.put("name", "test");
        original.put("age", 25);
        original.put("active", true);
        int iterations = 5000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            String serialized = Jhon.serialize(original);
            Jhon.parse(serialized);
        }
        return (System.nanoTime() - start) / iterations;
    }

    static long benchmarkRoundTripJSONSmall() {
        Map<String, Object> original = new LinkedHashMap<>();
        original.put("name", "test");
        original.put("age", 25);
        original.put("active", true);
        int iterations = 5000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            String serialized = toJSONString(original);
            parseSimpleJSON(serialized);
        }
        return (System.nanoTime() - start) / iterations;
    }

    static long benchmarkRemoveComments() {
        String input = """
                // This is a comment
                name="test"  /* inline comment */
                age=25
                // Another comment
                active=true /* multi-line
                comment */
                """;
        int iterations = 100000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            Jhon.removeComments(input);
        }
        return (System.nanoTime() - start) / iterations;
    }

    static long benchmarkParseNumbersWithUnderscores() throws Exception {
        String input = "large=100_000 million=1_000_000 decimal=1_234.567_890 neg_large=-50_000";
        int iterations = 10000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            Jhon.parse(input);
        }
        return (System.nanoTime() - start) / iterations;
    }

    static long benchmarkParseRawStrings() throws Exception {
        String input = "path=r\"C:\\Windows\\System32\" regex=r\"\\d+\\w*\\s*\" quote=r#\"He said \"hello\" to me\"#";
        int iterations = 10000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            Jhon.parse(input);
        }
        return (System.nanoTime() - start) / iterations;
    }

    static long benchmarkParseNestedObjects() throws Exception {
        String input = "outer={inner={deep=\"value\"} number=42}";
        int iterations = 10000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            Jhon.parse(input);
        }
        return (System.nanoTime() - start) / iterations;
    }

    static long benchmarkParseArrays() throws Exception {
        String input = "items=[\"apple\" \"banana\" \"cherry\" \"date\" \"elderberry\" \"fig\" \"grape\"]";
        int iterations = 10000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            Jhon.parse(input);
        }
        return (System.nanoTime() - start) / iterations;
    }

    // Simple JSON parser for comparison
    private static Object parseSimpleJSON(String json) {
        json = json.trim();
        if (json.startsWith("{")) {
            return parseJSONObject(json);
        } else if (json.startsWith("[")) {
            return parseJSONArray(json);
        } else if (json.startsWith("\"")) {
            return parseJSONString(json);
        } else if (json.equals("true")) {
            return true;
        } else if (json.equals("false")) {
            return false;
        } else if (json.equals("null")) {
            return null;
        } else {
            return parseJSONNumber(json);
        }
    }

    private static Map<String, Object> parseJSONObject(String json) {
        Map<String, Object> map = new LinkedHashMap<>();
        json = json.substring(1, json.length() - 1).trim();
        if (json.isEmpty()) return map;

        int depth = 0;
        int start = 0;
        boolean inString = false;

        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '"' && (i == 0 || json.charAt(i - 1) != '\\')) {
                inString = !inString;
            } else if (!inString) {
                if (c == '{' || c == '[') depth++;
                else if (c == '}' || c == ']') depth--;
                else if (c == ',' && depth == 0) {
                    parseJSONPair(json.substring(start, i), map);
                    start = i + 1;
                }
            }
        }
        if (start < json.length()) {
            parseJSONPair(json.substring(start), map);
        }
        return map;
    }

    private static void parseJSONPair(String pair, Map<String, Object> map) {
        int colonIdx = findColonNotInString(pair);
        if (colonIdx < 0) return;

        String key = pair.substring(0, colonIdx).trim();
        String value = pair.substring(colonIdx + 1).trim();

        key = parseJSONString(key).toString();
        map.put(key, parseSimpleJSON(value));
    }

    private static int findColonNotInString(String s) {
        boolean inString = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' && (i == 0 || s.charAt(i - 1) != '\\')) {
                inString = !inString;
            } else if (c == ':' && !inString) {
                return i;
            }
        }
        return -1;
    }

    private static List<Object> parseJSONArray(String json) {
        List<Object> list = new ArrayList<>();
        json = json.substring(1, json.length() - 1).trim();
        if (json.isEmpty()) return list;

        int depth = 0;
        int start = 0;
        boolean inString = false;

        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '"' && (i == 0 || json.charAt(i - 1) != '\\')) {
                inString = !inString;
            } else if (!inString) {
                if (c == '{' || c == '[') depth++;
                else if (c == '}' || c == ']') depth--;
                else if (c == ',' && depth == 0) {
                    list.add(parseSimpleJSON(json.substring(start, i).trim()));
                    start = i + 1;
                }
            }
        }
        if (start < json.length()) {
            list.add(parseSimpleJSON(json.substring(start).trim()));
        }
        return list;
    }

    private static String parseJSONString(String s) {
        if (s.startsWith("\"") && s.endsWith("\"")) {
            s = s.substring(1, s.length() - 1);
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < s.length(); i++) {
                char c = s.charAt(i);
                if (c == '\\' && i + 1 < s.length()) {
                    char next = s.charAt(i + 1);
                    switch (next) {
                        case 'n' -> sb.append('\n');
                        case 'r' -> sb.append('\r');
                        case 't' -> sb.append('\t');
                        case 'b' -> sb.append('\b');
                        case 'f' -> sb.append('\f');
                        case '"' -> sb.append('"');
                        case '\\' -> sb.append('\\');
                        case 'u' -> {
                            if (i + 5 <= s.length()) {
                                String hex = s.substring(i + 2, i + 6);
                                sb.append((char) Integer.parseInt(hex, 16));
                                i += 5;
                            }
                        }
                        default -> sb.append(next);
                    }
                    i++;
                } else {
                    sb.append(c);
                }
            }
            return sb.toString();
        }
        return s;
    }

    private static Number parseJSONNumber(String s) {
        try {
            if (s.contains(".") || s.contains("e") || s.contains("E")) {
                return Double.parseDouble(s);
            }
            long value = Long.parseLong(s);
            if (value >= Integer.MIN_VALUE && value <= Integer.MAX_VALUE) {
                return (int) value;
            }
            return value;
        } catch (NumberFormatException e) {
            return Double.parseDouble(s);
        }
    }

    private static String toJSONString(Object obj) {
        if (obj == null) return "null";
        if (obj instanceof String) return "\"" + escapeJSONString((String) obj) + "\"";
        if (obj instanceof Number) return obj.toString();
        if (obj instanceof Boolean) return obj.toString();

        if (obj instanceof Map) {
            StringBuilder sb = new StringBuilder("{");
            Map<?, ?> map = (Map<?, ?>) obj;
            boolean first = true;
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (!first) sb.append(",");
                sb.append("\"").append(escapeJSONString(entry.getKey().toString())).append("\":");
                sb.append(toJSONString(entry.getValue()));
                first = false;
            }
            sb.append("}");
            return sb.toString();
        }

        if (obj instanceof List) {
            StringBuilder sb = new StringBuilder("[");
            List<?> list = (List<?>) obj;
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append(toJSONString(list.get(i)));
            }
            sb.append("]");
            return sb.toString();
        }

        return "\"" + obj.toString() + "\"";
    }

    private static String escapeJSONString(String s) {
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
