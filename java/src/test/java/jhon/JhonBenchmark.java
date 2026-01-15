package jhon;

import org.junit.jupiter.api.Test;
import org.openjdk.jmh.annotations.*;
import org.openjdk.jmh.infra.Blackhole;

import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * JMH benchmarks for JHON parser comparing with JSON
 */
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.NANOSECONDS)
@Warmup(iterations = 3, time = 1)
@Measurement(iterations = 5, time = 1)
@Fork(1)
@State(Scope.Benchmark)
public class JhonBenchmark {

    // Small configuration
    private static final String SMALL_JHON = "name=\"test\" age=25 active=true";
    private static final String SMALL_JSON = "{\"name\":\"test\",\"age\":25,\"active\":true}";

    // Medium configuration
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

    private static final String MEDIUM_JSON = """
            {"app_name":"ocean-note","version":"1.0.0","debug":true,"database":{"host":"localhost","port":5432,"name":"mydb"},"features":["markdown","collaboration","real-time"],"max_file_size":1048576,"timeout":30.5,"server":{"host":"0.0.0.0","port":3000}}
            """;

    // Large configuration
    private static final String LARGE_JHON = """
            // Application Configuration
            app_name="ocean-note"
            version="2.0.0"
            debug=true
            log_level="info"

            // Database Configuration
            database={
                host="localhost"
                port=5432
                name="mydb"
                pool_size=10
                timeout=30.5
                ssl_enabled=true
                credentials=[
                    {user="admin" role="owner"}
                    {user="reader" role="readonly"}
                    {user="writer" role="readwrite"}
                ]
            }

            // Server Configuration
            server={
                host="0.0.0.0"
                port=3000
                middleware=[
                    {name="logger" enabled=true config={level="info"}}
                    {name="cors" enabled=false config={}}
                    {name="auth" enabled=true config={strategy="jwt"}}
                ]
            }

            // Features
            features=[
                {name="markdown" active=true settings={preview=true}}
                {name="collaboration" active=true settings={realtime=true max_users=100}}
                {name="export" active=false settings=null}
            ]

            // Metadata
            metadata={
                created_at="2024-01-15T10:30:00Z"
                updated_at="2024-01-20T15:45:30Z"
                tags=["production" "web" "api"]
                maintainers=["team-a" "team-b"]
            }
            """;

    // We'll use Gson for JSON comparison - minimal JSON parsing without external lib
    // For fair comparison, we'll implement a simple JSON parser

    // =============================================================================
    // Parse Benchmarks - Small
    // =============================================================================

    @Benchmark
    public void benchmarkParseJHONSmall(Blackhole bh) throws Exception {
        bh.consume(Jhon.parse(SMALL_JHON));
    }

    @Benchmark
    public void benchmarkParseJSONSmall(Blackhole bh) throws Exception {
        bh.consume(parseSimpleJSON(SMALL_JSON));
    }

    // =============================================================================
    // Parse Benchmarks - Medium
    // =============================================================================

    @Benchmark
    public void benchmarkParseJHONMedium(Blackhole bh) throws Exception {
        bh.consume(Jhon.parse(MEDIUM_JHON));
    }

    @Benchmark
    public void benchmarkParseJSONMedium(Blackhole bh) throws Exception {
        bh.consume(parseSimpleJSON(MEDIUM_JSON));
    }

    // =============================================================================
    // Parse Benchmarks - Large
    // =============================================================================

    @Benchmark
    public void benchmarkParseJHONLarge(Blackhole bh) throws Exception {
        bh.consume(Jhon.parse(LARGE_JHON));
    }

    // Large JSON equivalent (without external dependencies)
    private static final String LARGE_JSON = LARGE_JHON
            .replaceAll("// [^\n]+\n", "")
            .replaceAll("=", ":")
            .replaceAll("\\{", "{\"")
            .replaceAll("\\}", "\"}")
            .replaceAll("\"\"", "")
            .replaceAll("\\s+", "")
            .replaceAll("\\[", "[")
            .replaceAll("true", "true")
            .replaceAll("false", "false")
            .replaceAll("null", "null");

    @Benchmark
    public void benchmarkParseJSONLarge(Blackhole bh) throws Exception {
        bh.consume(parseSimpleJSON(LARGE_JSON));
    }

    // =============================================================================
    // Serialize Benchmarks - Small
    // =============================================================================

    @Benchmark
    public void benchmarkSerializeJHONSmall(Blackhole bh) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("name", "test");
        value.put("age", 25);
        value.put("active", true);
        bh.consume(Jhon.serialize(value));
    }

    @Benchmark
    public void benchmarkSerializeJSONSmall(Blackhole bh) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("name", "test");
        value.put("age", 25);
        value.put("active", true);
        bh.consume(toJSONString(value));
    }

    // =============================================================================
    // Serialize Benchmarks - Medium
    // =============================================================================

    @Benchmark
    public void benchmarkSerializeJHONMedium(Blackhole bh) throws Exception {
        Object parsed = Jhon.parse(MEDIUM_JHON);
        bh.consume(Jhon.serialize(parsed));
    }

    @Benchmark
    public void benchmarkSerializeJSONMedium(Blackhole bh) throws Exception {
        Object parsed = parseSimpleJSON(MEDIUM_JSON);
        bh.consume(toJSONString(parsed));
    }

    // =============================================================================
    // Serialize Benchmarks - Large
    // =============================================================================

    @Benchmark
    public void benchmarkSerializeJHONLarge(Blackhole bh) throws Exception {
        Object parsed = Jhon.parse(LARGE_JHON);
        bh.consume(Jhon.serialize(parsed));
    }

    @Benchmark
    public void benchmarkSerializeJSONLarge(Blackhole bh) throws Exception {
        Object parsed = parseSimpleJSON(LARGE_JSON);
        bh.consume(toJSONString(parsed));
    }

    // =============================================================================
    // Round-Trip Benchmarks - Small
    // =============================================================================

    @Benchmark
    public void benchmarkRoundTripJHONSmall(Blackhole bh) throws Exception {
        Map<String, Object> original = new LinkedHashMap<>();
        original.put("name", "test");
        original.put("age", 25);
        original.put("active", true);
        String serialized = Jhon.serialize(original);
        bh.consume(Jhon.parse(serialized));
    }

    @Benchmark
    public void benchmarkRoundTripJSONSmall(Blackhole bh) throws Exception {
        Map<String, Object> original = new LinkedHashMap<>();
        original.put("name", "test");
        original.put("age", 25);
        original.put("active", true);
        String serialized = toJSONString(original);
        bh.consume(parseSimpleJSON(serialized));
    }

    // =============================================================================
    // Round-Trip Benchmarks - Large
    // =============================================================================

    @Benchmark
    public void benchmarkRoundTripJHONLarge(Blackhole bh) throws Exception {
        Object original = Jhon.parse(LARGE_JHON);
        String serialized = Jhon.serialize(original);
        bh.consume(Jhon.parse(serialized));
    }

    @Benchmark
    public void benchmarkRoundTripJSONLarge(Blackhole bh) throws Exception {
        Object original = parseSimpleJSON(LARGE_JSON);
        String serialized = toJSONString(original);
        bh.consume(parseSimpleJSON(serialized));
    }

    // =============================================================================
    // Specialized Benchmarks
    // =============================================================================

    @Benchmark
    public void benchmarkParseNumbersWithUnderscores(Blackhole bh) throws Exception {
        String input = "large=100_000 million=1_000_000 decimal=1_234.567_890 neg_large=-50_000";
        bh.consume(Jhon.parse(input));
    }

    @Benchmark
    public void benchmarkParseRawStrings(Blackhole bh) throws Exception {
        String input = "path=r\"C:\\Windows\\System32\" regex=r\"\\d+\\w*\\s*\" quote=r#\"He said \"hello\" to me\"#";
        bh.consume(Jhon.parse(input));
    }

    @Benchmark
    public void benchmarkParseNestedObjects(Blackhole bh) throws Exception {
        String input = "outer={inner={deep=\"value\"} number=42}";
        bh.consume(Jhon.parse(input));
    }

    @Benchmark
    public void benchmarkParseArrays(Blackhole bh) throws Exception {
        String input = "items=[\"apple\" \"banana\" \"cherry\" \"date\" \"elderberry\" \"fig\" \"grape\"]";
        bh.consume(Jhon.parse(input));
    }

    @Benchmark
    public void benchmarkSerializePretty(Blackhole bh) throws Exception {
        Object parsed = Jhon.parse(LARGE_JHON);
        bh.consume(Jhon.serializePretty(parsed, "  "));
    }

    @Benchmark
    public void benchmarkRemoveComments(Blackhole bh) {
        String input = """
                // This is a comment
                name="test"  /* inline comment */
                age=25
                // Another comment
                active=true /* multi-line
                comment */
                """;
        bh.consume(Jhon.removeComments(input));
    }

    // =============================================================================
    // Simple JSON Parser for Comparison
    // =============================================================================

    private Object parseSimpleJSON(String json) {
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

    private Map<String, Object> parseJSONObject(String json) {
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

    private void parseJSONPair(String pair, Map<String, Object> map) {
        int colonIdx = findColonNotInString(pair);
        if (colonIdx < 0) return;

        String key = pair.substring(0, colonIdx).trim();
        String value = pair.substring(colonIdx + 1).trim();

        key = parseJSONString(key).toString();
        map.put(key, parseSimpleJSON(value));
    }

    private int findColonNotInString(String s) {
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

    private List<Object> parseJSONArray(String json) {
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

    private String parseJSONString(String s) {
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

    private Number parseJSONNumber(String s) {
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

    private String toJSONString(Object obj) {
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

    private String escapeJSONString(String s) {
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    // =============================================================================
    // Comparison Tests
    // =============================================================================

    @Test
    void testStringSizeComparison() throws Exception {
        Object jhonParsed = Jhon.parse(MEDIUM_JHON);
        String jhonSerialized = Jhon.serialize(jhonParsed);

        System.out.println("JHON size: " + jhonSerialized.length() + " bytes");
        System.out.println("JSON size: " + MEDIUM_JSON.trim().length() + " bytes");
        System.out.println("JHON is " + (jhonSerialized.length() * 100.0 / MEDIUM_JSON.trim().length()) + "% of JSON size");
    }

    @Test
    void testLargeConfigComparison() throws Exception {
        Object jhonParsed = Jhon.parse(LARGE_JHON);
        String jhonSerialized = Jhon.serialize(jhonParsed);

        // Create JSON equivalent for comparison
        String largeJson = LARGE_JHON
                .replaceAll("// [^\n]+\n", "")
                .replaceAll("\n", "")
                .replaceAll("=", ":")
                .replaceAll("\"true\"", "true")
                .replaceAll("\"false\"", "false")
                .replaceAll("\"null\"", "null");

        System.out.println("Large JHON size: " + jhonSerialized.length() + " bytes");
        System.out.println("Large JSON size: " + largeJson.length() + " bytes");
    }

    // Main method for running JMH benchmarks
    public static void main(String[] args) throws Exception {
        org.openjdk.jmh.Main.main(args);
    }
}
