package jhon;

import com.google.gson.*;
import java.util.*;

/**
 * Simple benchmark runner for JHON parser comparing with Gson (JSON)
 * (No JMH dependency for simpler execution)
 */
public class SimpleBenchmark {

    private static final Gson GSON = new Gson();

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
        System.out.println("JHON Parser Benchmarks (Java) - JHON vs Gson (JSON)");
        System.out.println("=".repeat(80));

        List<Result> results = new ArrayList<>();

        // Warmup
        System.out.println("\nWarming up...");
        for (int i = 0; i < 10000; i++) {
            Jhon.parse(SMALL_JHON);
            GSON.fromJson(SMALL_JSON, Object.class);
        }

        // Parse benchmarks - Small
        System.out.println("\n--- Parse Benchmarks (Small) ---");
        results.add(new Result("Parse JHON (Small)", benchmarkParseJHONSmall()));
        results.add(new Result("Parse Gson/JSON (Small)", benchmarkParseJSONSmall()));

        // Parse benchmarks - Medium
        System.out.println("\n--- Parse Benchmarks (Medium) ---");
        results.add(new Result("Parse JHON (Medium)", benchmarkParseJHONMedium()));
        results.add(new Result("Parse Gson/JSON (Medium)", benchmarkParseJSONMedium()));

        // Serialize benchmarks - Small
        System.out.println("\n--- Serialize Benchmarks (Small) ---");
        results.add(new Result("Serialize JHON (Small)", benchmarkSerializeJHONSmall()));
        results.add(new Result("Serialize Gson/JSON (Small)", benchmarkSerializeJSONSmall()));

        // Serialize benchmarks - Medium
        System.out.println("\n--- Serialize Benchmarks (Medium) ---");
        results.add(new Result("Serialize JHON (Medium)", benchmarkSerializeJHONMedium()));
        results.add(new Result("Serialize Gson/JSON (Medium)", benchmarkSerializeJSONMedium()));

        // Round-trip benchmarks
        System.out.println("\n--- Round-Trip Benchmarks (Small) ---");
        results.add(new Result("Round-trip JHON (Small)", benchmarkRoundTripJHONSmall()));
        results.add(new Result("Round-trip Gson/JSON (Small)", benchmarkRoundTripJSONSmall()));

        // Round-trip benchmarks - Medium
        System.out.println("\n--- Round-Trip Benchmarks (Medium) ---");
        results.add(new Result("Round-trip JHON (Medium)", benchmarkRoundTripJHONMedium()));
        results.add(new Result("Round-trip Gson/JSON (Medium)", benchmarkRoundTripJSONMedium()));

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

        // Comparison summary
        System.out.println("\n" + "=".repeat(80));
        System.out.println("Performance Summary (JHON vs Gson)");
        System.out.println("=".repeat(80));

        long jhonParseSmall = results.get(0).timeNs;
        long gsonParseSmall = results.get(1).timeNs;
        long jhonParseMedium = results.get(2).timeNs;
        long gsonParseMedium = results.get(3).timeNs;

        if (jhonParseSmall < gsonParseSmall) {
            System.out.printf("Parse Small:  JHON is %.2fx faster than Gson%n",
                    (double) gsonParseSmall / jhonParseSmall);
        } else {
            System.out.printf("Parse Small:  Gson is %.2fx faster than JHON%n",
                    (double) jhonParseSmall / gsonParseSmall);
        }

        if (jhonParseMedium < gsonParseMedium) {
            System.out.printf("Parse Medium: JHON is %.2fx faster than Gson%n",
                    (double) gsonParseMedium / jhonParseMedium);
        } else {
            System.out.printf("Parse Medium: Gson is %.2fx faster than JHON%n",
                    (double) jhonParseMedium / gsonParseMedium);
        }

        long jhonSerializeSmall = results.get(4).timeNs;
        long gsonSerializeSmall = results.get(5).timeNs;
        long jhonSerializeMedium = results.get(6).timeNs;
        long gsonSerializeMedium = results.get(7).timeNs;

        if (gsonSerializeSmall < jhonSerializeSmall) {
            System.out.printf("Serialize Small:  Gson is %.2fx faster than JHON%n",
                    (double) jhonSerializeSmall / gsonSerializeSmall);
        } else {
            System.out.printf("Serialize Small:  JHON is %.2fx faster than Gson%n",
                    (double) gsonSerializeSmall / jhonSerializeSmall);
        }

        if (gsonSerializeMedium < jhonSerializeMedium) {
            System.out.printf("Serialize Medium: Gson is %.2fx faster than JHON%n",
                    (double) jhonSerializeMedium / gsonSerializeMedium);
        } else {
            System.out.printf("Serialize Medium: JHON is %.2fx faster than Gson%n",
                    (double) gsonSerializeMedium / jhonSerializeMedium);
        }
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
            GSON.fromJson(SMALL_JSON, Object.class);
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
            GSON.fromJson(MEDIUM_JSON, Object.class);
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
            GSON.toJson(value);
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
        Object parsed = GSON.fromJson(MEDIUM_JSON, Object.class);
        int iterations = 5000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            GSON.toJson(parsed);
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
            String serialized = GSON.toJson(original);
            GSON.fromJson(serialized, Object.class);
        }
        return (System.nanoTime() - start) / iterations;
    }

    static long benchmarkRoundTripJHONMedium() throws Exception {
        Object parsed = Jhon.parse(MEDIUM_JHON);
        String serialized = Jhon.serialize(parsed);
        int iterations = 2000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            Jhon.parse(serialized);
        }
        return (System.nanoTime() - start) / iterations;
    }

    static long benchmarkRoundTripJSONMedium() {
        Object parsed = GSON.fromJson(MEDIUM_JSON, Object.class);
        String serialized = GSON.toJson(parsed);
        int iterations = 2000;
        long start = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            GSON.fromJson(serialized, Object.class);
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
}
