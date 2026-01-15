package jhon;

import java.util.*;

/**
 * Simple test runner without JUnit dependency
 */
public class SimpleTest {
    private static int passed = 0;
    private static int failed = 0;

    public static void main(String[] args) {
        System.out.println("=== Running JHON Parser Tests ===\n");

        testEmptyInput();
        testBasicKeyValue();
        testStringTypes();
        testStringValues();
        testStringEscaping();
        testUnicodeEscape();
        testNumbers();
        testNumbersWithUnderscores();
        testBooleans();
        testNullValue();
        testEmptyArrays();
        testArraysWithStrings();
        testArraysWithNumbers();
        testArraysWithMixedTypes();
        testNestedObjects();
        testRawStrings();
        testRawStringsWithHashes();
        testSingleQuotedStrings();
        testQuotesInsideStrings();
        testQuotedKeysWithSpaces();
        testComplexNestedStructure();
        testDeeplyNestedObjects();
        testArraysInObjects();

        // Error tests
        testErrorUnterminatedString();
        testErrorExpectedEquals();
        testErrorUnterminatedArray();
        testErrorUnterminatedNestedObject();
        testErrorInvalidBoolean();
        testErrorInvalidNull();

        // Serialization tests
        testSerializeBasicObject();
        testSerializeEmptyObject();
        testSerializeString();
        testSerializeStringWithEscapes();
        testSerializeStringWithQuotes();
        testSerializeNumbers();
        testSerializeBoolean();
        testSerializeNull();
        testSerializeArray();
        testSerializeEmptyArray();
        testSerializeNestedObject();
        testSerializeArrayWithObjects();
        testSerializeKeysWithSpecialChars();
        testSerializeRoundTripSimple();
        testSerializeRoundTripComplex();

        // Pretty serialization
        testSerializePrettyBasicObject();
        testSerializePrettyNestedObjects();
        testSerializePrettyArray();
        testSerializePrettyArrayWithObjects();
        testSerializePrettyRoundTrip();

        System.out.println("\n=== Test Results ===");
        System.out.println("Passed: " + passed);
        System.out.println("Failed: " + failed);
        System.exit(failed > 0 ? 1 : 0);
    }

    private static void assertEquals(Object expected, Object actual, String testName) {
        if (!equals(expected, actual)) {
            failed++;
            System.err.println("FAILED: " + testName);
            System.err.println("  Expected: " + expected);
            System.err.println("  Actual: " + actual);
        } else {
            passed++;
            System.out.println("PASSED: " + testName);
        }
    }

    private static boolean equals(Object a, Object b) {
        if (a == b) return true;
        if (a == null || b == null) return false;

        // Handle number comparison
        if (a instanceof Number && b instanceof Number) {
            return ((Number) a).doubleValue() == ((Number) b).doubleValue();
        }

        return Objects.equals(a, b);
    }

    private static void assertTrue(boolean condition, String testName) {
        if (!condition) {
            failed++;
            System.err.println("FAILED: " + testName);
            System.err.println("  Expected: true");
            System.err.println("  Actual: false");
        } else {
            passed++;
            System.out.println("PASSED: " + testName);
        }
    }

    private static void assertNull(Object value, String testName) {
        if (value != null) {
            failed++;
            System.err.println("FAILED: " + testName);
            System.err.println("  Expected: null");
            System.err.println("  Actual: " + value);
        } else {
            passed++;
            System.out.println("PASSED: " + testName);
        }
    }

    private static void assertThrows(Class<? extends Exception> expectedClass, RunnableWithException code, String testName) {
        try {
            code.run();
            failed++;
            System.err.println("FAILED: " + testName);
            System.err.println("  Expected exception: " + expectedClass.getSimpleName());
            System.err.println("  But no exception was thrown");
        } catch (Exception e) {
            if (expectedClass.isInstance(e)) {
                passed++;
                System.out.println("PASSED: " + testName);
            } else {
                failed++;
                System.err.println("FAILED: " + testName);
                System.err.println("  Expected exception: " + expectedClass.getSimpleName());
                System.err.println("  Actual exception: " + e.getClass().getSimpleName());
            }
        }
    }

    @FunctionalInterface
    private interface RunnableWithException {
        void run() throws Exception;
    }

    // =============================================================================
    // Tests
    // =============================================================================

    private static void testEmptyInput() {
        try {
            Object result = Jhon.parse("");
            Map<?, ?> obj = (Map<?, ?>) result;
            assertTrue(obj.isEmpty(), "Empty input should return empty object");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Empty input - " + e.getMessage());
        }
    }

    private static void testBasicKeyValue() {
        try {
            Object result = Jhon.parse("a=\"hello\", b=123.45");
            Map<?, ?> obj = (Map<?, ?>) result;
            assertEquals("hello", obj.get("a"), "Parse basic key-value 'a'");
            assertEquals(123.45, obj.get("b"), "Parse basic key-value 'b'");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Basic key-value - " + e.getMessage());
        }
    }

    private static void testStringTypes() {
        try {
            Object result = Jhon.parse("\"quoted key\"=\"value\", unquoted_key=\"another\"");
            Map<?, ?> obj = (Map<?, ?>) result;
            assertEquals("value", obj.get("quoted key"), "Parse quoted key");
            assertEquals("another", obj.get("unquoted_key"), "Parse unquoted key");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: String types - " + e.getMessage());
        }
    }

    private static void testStringValues() {
        try {
            Object result = Jhon.parse("text=\"simple string\", empty=\"\", spaces=\"  with  spaces  \"");
            Map<?, ?> obj = (Map<?, ?>) result;
            assertEquals("simple string", obj.get("text"), "Parse simple string");
            assertEquals("", obj.get("empty"), "Parse empty string");
            assertEquals("  with  spaces  ", obj.get("spaces"), "Parse string with spaces");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: String values - " + e.getMessage());
        }
    }

    private static void testStringEscaping() {
        try {
            Object result = Jhon.parse("newline=\"hello\\nworld\", backslash=\"path\\\\to\\\\file\"");
            Map<?, ?> obj = (Map<?, ?>) result;
            assertEquals("hello\nworld", obj.get("newline"), "Parse newline escape");
            assertEquals("path\\to\\file", obj.get("backslash"), "Parse backslash escape");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: String escaping - " + e.getMessage());
        }
    }

    private static void testUnicodeEscape() {
        try {
            Object result = Jhon.parse("unicode=\"Hello\\u00A9World\"");
            Map<?, ?> obj = (Map<?, ?>) result;
            assertEquals("Hello©World", obj.get("unicode"), "Parse Unicode escape");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Unicode escape - " + e.getMessage());
        }
    }

    private static void testNumbers() {
        try {
            Object result = Jhon.parse("int=42, float=3.14, negative=-123");
            Map<?, ?> obj = (Map<?, ?>) result;
            assertEquals(42.0, obj.get("int"), "Parse integer");
            assertEquals(3.14, obj.get("float"), "Parse float");
            assertEquals(-123.0, obj.get("negative"), "Parse negative number");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Numbers - " + e.getMessage());
        }
    }

    private static void testNumbersWithUnderscores() {
        try {
            Object result = Jhon.parse("large=100_000, million=1_000_000, decimal=1_234.567_890");
            Map<?, ?> obj = (Map<?, ?>) result;
            assertEquals(100000.0, obj.get("large"), "Parse number with underscores");
            assertEquals(1000000.0, obj.get("million"), "Parse million with underscores");
            assertEquals(1234.56789, obj.get("decimal"), "Parse decimal with underscores");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Numbers with underscores - " + e.getMessage());
        }
    }

    private static void testBooleans() {
        try {
            Object result = Jhon.parse("truth=true, falsehood=false");
            Map<?, ?> obj = (Map<?, ?>) result;
            assertEquals(true, obj.get("truth"), "Parse true boolean");
            assertEquals(false, obj.get("falsehood"), "Parse false boolean");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Booleans - " + e.getMessage());
        }
    }

    private static void testNullValue() {
        try {
            Object result = Jhon.parse("empty=null");
            Map<?, ?> obj = (Map<?, ?>) result;
            assertNull(obj.get("empty"), "Parse null value");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Null value - " + e.getMessage());
        }
    }

    private static void testEmptyArrays() {
        try {
            Object result = Jhon.parse("empty=[]");
            Map<?, ?> obj = (Map<?, ?>) result;
            List<?> arr = (List<?>) obj.get("empty");
            assertTrue(arr.isEmpty(), "Parse empty array");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Empty arrays - " + e.getMessage());
        }
    }

    private static void testArraysWithStrings() {
        try {
            Object result = Jhon.parse("strings=[\"hello\", \"world\", \"test\"]");
            Map<?, ?> obj = (Map<?, ?>) result;
            List<?> arr = (List<?>) obj.get("strings");
            assertEquals(3, arr.size(), "Parse array with 3 strings");
            assertEquals("hello", arr.get(0), "Parse first string in array");
            assertEquals("world", arr.get(1), "Parse second string in array");
            assertEquals("test", arr.get(2), "Parse third string in array");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Arrays with strings - " + e.getMessage());
        }
    }

    private static void testArraysWithNumbers() {
        try {
            Object result = Jhon.parse("numbers=[1, 2.5, -3, 4.0]");
            Map<?, ?> obj = (Map<?, ?>) result;
            List<?> arr = (List<?>) obj.get("numbers");
            assertEquals(4, arr.size(), "Parse array with 4 numbers");
            assertEquals(1.0, arr.get(0), "Parse first number in array");
            assertEquals(2.5, arr.get(1), "Parse second number in array");
            assertEquals(-3.0, arr.get(2), "Parse third number in array");
            assertEquals(4.0, arr.get(3), "Parse fourth number in array");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Arrays with numbers - " + e.getMessage());
        }
    }

    private static void testArraysWithMixedTypes() {
        try {
            Object result = Jhon.parse("mixed=[\"hello\", 123, true, null, 45.6]");
            Map<?, ?> obj = (Map<?, ?>) result;
            List<?> arr = (List<?>) obj.get("mixed");
            assertEquals(5, arr.size(), "Parse mixed array with 5 elements");
            assertEquals("hello", arr.get(0), "Parse string in mixed array");
            assertEquals(123.0, arr.get(1), "Parse number in mixed array");
            assertEquals(true, arr.get(2), "Parse boolean in mixed array");
            assertNull(arr.get(3), "Parse null in mixed array");
            assertEquals(45.6, arr.get(4), "Parse float in mixed array");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Arrays with mixed types - " + e.getMessage());
        }
    }

    private static void testNestedObjects() {
        try {
            Object result = Jhon.parse("server={host=\"localhost\", port=8080}");
            Map<?, ?> obj = (Map<?, ?>) result;
            Map<?, ?> server = (Map<?, ?>) obj.get("server");
            assertEquals("localhost", server.get("host"), "Parse nested object host");
            assertEquals(8080.0, server.get("port"), "Parse nested object port");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Nested objects - " + e.getMessage());
        }
    }

    private static void testRawStrings() {
        try {
            Object result = Jhon.parse("path=r\"C:\\Windows\\System32\"");
            Map<?, ?> obj = (Map<?, ?>) result;
            assertEquals("C:\\Windows\\System32", obj.get("path"), "Parse raw string");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Raw strings - " + e.getMessage());
        }
    }

    private static void testRawStringsWithHashes() {
        try {
            Object result = Jhon.parse("contains_hash=r#\"This has a \" quote in it\"#");
            Map<?, ?> obj = (Map<?, ?>) result;
            assertEquals("This has a \" quote in it", obj.get("contains_hash"), "Parse raw string with hashes");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Raw strings with hashes - " + e.getMessage());
        }
    }

    private static void testSingleQuotedStrings() {
        try {
            Object result = Jhon.parse("name='John', greeting='Hello'");
            Map<?, ?> obj = (Map<?, ?>) result;
            assertEquals("John", obj.get("name"), "Parse single-quoted string name");
            assertEquals("Hello", obj.get("greeting"), "Parse single-quoted string greeting");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Single-quoted strings - " + e.getMessage());
        }
    }

    private static void testQuotesInsideStrings() {
        try {
            Object result = Jhon.parse("text='He said \"hello\" to me'");
            Map<?, ?> obj = (Map<?, ?>) result;
            assertEquals("He said \"hello\" to me", obj.get("text"), "Parse quotes inside strings");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Quotes inside strings - " + e.getMessage());
        }
    }

    private static void testQuotedKeysWithSpaces() {
        try {
            Object result = Jhon.parse("\"my key\"=\"value\", \"another key\"=\"test\"");
            Map<?, ?> obj = (Map<?, ?>) result;
            assertEquals("value", obj.get("my key"), "Parse quoted key with space");
            assertEquals("test", obj.get("another key"), "Parse quoted key with space 2");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Quoted keys with spaces - " + e.getMessage());
        }
    }

    private static void testComplexNestedStructure() {
        try {
            Object result = Jhon.parse("server={host=\"localhost\" port=3000 middleware=[{name=\"logger\" enabled=true} {name=\"cors\" enabled=false}]}");
            Map<?, ?> obj = (Map<?, ?>) result;
            Map<?, ?> server = (Map<?, ?>) obj.get("server");
            assertEquals("localhost", server.get("host"), "Parse complex nested host");
            assertEquals(3000.0, server.get("port"), "Parse complex nested port");

            List<?> middleware = (List<?>) server.get("middleware");
            assertEquals(2, middleware.size(), "Parse middleware array size");

            Map<?, ?> m1 = (Map<?, ?>) middleware.get(0);
            assertEquals("logger", m1.get("name"), "Parse first middleware name");
            assertEquals(true, m1.get("enabled"), "Parse first middleware enabled");

            Map<?, ?> m2 = (Map<?, ?>) middleware.get(1);
            assertEquals("cors", m2.get("name"), "Parse second middleware name");
            assertEquals(false, m2.get("enabled"), "Parse second middleware enabled");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Complex nested structure - " + e.getMessage());
        }
    }

    private static void testDeeplyNestedObjects() {
        try {
            Object result = Jhon.parse("outer={inner={deep=\"value\"} number=42}");
            Map<?, ?> obj = (Map<?, ?>) result;
            Map<?, ?> outer = (Map<?, ?>) obj.get("outer");
            Map<?, ?> inner = (Map<?, ?>) outer.get("inner");
            assertEquals("value", inner.get("deep"), "Parse deeply nested value");
            assertEquals(42.0, outer.get("number"), "Parse deeply nested number");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Deeply nested objects - " + e.getMessage());
        }
    }

    private static void testArraysInObjects() {
        try {
            Object result = Jhon.parse("data={items=[1, 2, 3] active=true}");
            Map<?, ?> obj = (Map<?, ?>) result;
            Map<?, ?> data = (Map<?, ?>) obj.get("data");
            List<?> items = (List<?>) data.get("items");
            assertEquals(3, items.size(), "Parse items array in object");
            assertEquals(1.0, items.get(0), "Parse first item");
            assertEquals(2.0, items.get(1), "Parse second item");
            assertEquals(3.0, items.get(2), "Parse third item");
            assertEquals(true, data.get("active"), "Parse active in data object");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Arrays in objects - " + e.getMessage());
        }
    }

    // Error tests
    private static void testErrorUnterminatedString() {
        assertThrows(Jhon.JhonParseException.class, () -> {
            Jhon.parse("name=\"unclosed string");
        }, "Error on unterminated string");
    }

    private static void testErrorExpectedEquals() {
        assertThrows(Jhon.JhonParseException.class, () -> {
            Jhon.parse("name \"value\"");
        }, "Error on missing equals");
    }

    private static void testErrorUnterminatedArray() {
        assertThrows(Jhon.JhonParseException.class, () -> {
            Jhon.parse("items=[1, 2, 3");
        }, "Error on unterminated array");
    }

    private static void testErrorUnterminatedNestedObject() {
        assertThrows(Jhon.JhonParseException.class, () -> {
            Jhon.parse("server={host=\"localhost\"");
        }, "Error on unterminated nested object");
    }

    private static void testErrorInvalidBoolean() {
        assertThrows(Jhon.JhonParseException.class, () -> {
            Jhon.parse("active=troo");
        }, "Error on invalid boolean");
    }

    private static void testErrorInvalidNull() {
        assertThrows(Jhon.JhonParseException.class, () -> {
            Jhon.parse("value=nul");
        }, "Error on invalid null");
    }

    // Serialization tests
    private static void testSerializeBasicObject() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("name", "John");
        value.put("age", 30);
        String result = Jhon.serialize(value);
        assertEquals("age=30,name=\"John\"", result, "Serialize basic object");
    }

    private static void testSerializeEmptyObject() {
        Map<String, Object> value = new LinkedHashMap<>();
        String result = Jhon.serialize(value);
        assertEquals("", result, "Serialize empty object");
    }

    private static void testSerializeString() {
        String result = Jhon.serialize("hello world");
        assertEquals("\"hello world\"", result, "Serialize string");
    }

    private static void testSerializeStringWithEscapes() {
        String result = Jhon.serialize("line1\nline2\ttab");
        assertEquals("\"line1\\nline2\\ttab\"", result, "Serialize string with escapes");
    }

    private static void testSerializeStringWithQuotes() {
        String result = Jhon.serialize("He said \"hello\"");
        assertEquals("\"He said \\\"hello\\\"\"", result, "Serialize string with quotes");
    }

    private static void testSerializeNumbers() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("int", 42);
        value.put("float", 3.14);
        value.put("negative", -123);
        String result = Jhon.serialize(value);
        assertEquals("float=3.14,int=42,negative=-123", result, "Serialize numbers");
    }

    private static void testSerializeBoolean() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("active", true);
        value.put("inactive", false);
        String result = Jhon.serialize(value);
        assertEquals("active=true,inactive=false", result, "Serialize booleans");
    }

    private static void testSerializeNull() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("empty", null);
        String result = Jhon.serialize(value);
        assertEquals("empty=null", result, "Serialize null");
    }

    private static void testSerializeArray() {
        List<Object> value = List.of(1, 2, 3, "hello", true);
        String result = Jhon.serialize(value);
        assertEquals("[1,2,3,\"hello\",true]", result, "Serialize array");
    }

    private static void testSerializeEmptyArray() {
        String result = Jhon.serialize(List.of());
        assertEquals("[]", result, "Serialize empty array");
    }

    private static void testSerializeNestedObject() {
        Map<String, Object> server = new LinkedHashMap<>();
        server.put("host", "localhost");
        server.put("port", 8080);

        Map<String, Object> value = new LinkedHashMap<>();
        value.put("server", server);

        String result = Jhon.serialize(value);
        assertEquals("server={host=\"localhost\",port=8080}", result, "Serialize nested object");
    }

    private static void testSerializeArrayWithObjects() {
        Map<String, Object> person1 = new LinkedHashMap<>();
        person1.put("name", "John");
        person1.put("age", 30);

        Map<String, Object> person2 = new LinkedHashMap<>();
        person2.put("name", "Jane");
        person2.put("age", 25);

        List<Object> value = List.of(person1, person2);
        String result = Jhon.serialize(value);
        assertEquals("[{age=30,name=\"John\"},{age=25,name=\"Jane\"}]", result, "Serialize array with objects");
    }

    private static void testSerializeKeysWithSpecialChars() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("my key", "value1");
        value.put("key@symbol", "value2");
        String result = Jhon.serialize(value);
        assertEquals("\"key@symbol\"=\"value2\",\"my key\"=\"value1\"", result, "Serialize keys with special chars");
    }

    private static void testSerializeRoundTripSimple() {
        try {
            Map<String, Object> original = new LinkedHashMap<>();
            original.put("name", "John");
            original.put("age", 30);
            original.put("active", true);

            String serialized = Jhon.serialize(original);
            Object parsed = Jhon.parse(serialized);

            Map<?, ?> parsedObj = (Map<?, ?>) parsed;
            assertEquals(original.get("name"), parsedObj.get("name"), "Round trip name");
            assertEquals(original.get("age"), parsedObj.get("age"), "Round trip age");
            assertEquals(original.get("active"), parsedObj.get("active"), "Round trip active");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Round trip simple - " + e.getMessage());
        }
    }

    private static void testSerializeRoundTripComplex() {
        try {
            Map<String, Object> database = new LinkedHashMap<>();
            database.put("host", "localhost");
            database.put("port", 5432);
            database.put("ssl", true);

            Map<String, Object> original = new LinkedHashMap<>();
            original.put("app_name", "ocean-note");
            original.put("database", database);
            original.put("features", List.of("markdown", "collaboration"));

            String serialized = Jhon.serialize(original);
            Object parsed = Jhon.parse(serialized);

            Map<?, ?> parsedObj = (Map<?, ?>) parsed;
            assertEquals(original.get("app_name"), parsedObj.get("app_name"), "Round trip complex app_name");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Round trip complex - " + e.getMessage());
        }
    }

    // Pretty serialization tests
    private static void testSerializePrettyBasicObject() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("name", "John");
        value.put("age", 30);
        String result = Jhon.serializePretty(value, "  ");
        assertEquals("age = 30,\nname = \"John\"", result, "Serialize pretty basic object");
    }

    private static void testSerializePrettyNestedObjects() {
        Map<String, Object> server = new LinkedHashMap<>();
        server.put("host", "localhost");
        server.put("port", 8080);

        Map<String, Object> value = new LinkedHashMap<>();
        value.put("server", server);

        String result = Jhon.serializePretty(value, "  ");
        assertEquals("server = {\n  host = \"localhost\",\n  port = 8080\n}", result, "Serialize pretty nested objects");
    }

    private static void testSerializePrettyArray() {
        List<Object> value = List.of(1, 2, 3, "hello");
        String result = Jhon.serializePretty(value, "  ");
        assertEquals("[\n  1,\n  2,\n  3,\n  \"hello\"\n]", result, "Serialize pretty array");
    }

    private static void testSerializePrettyArrayWithObjects() {
        Map<String, Object> person1 = new LinkedHashMap<>();
        person1.put("name", "John");
        person1.put("age", 30);

        Map<String, Object> person2 = new LinkedHashMap<>();
        person2.put("name", "Jane");
        person2.put("age", 25);

        List<Object> value = List.of(person1, person2);
        String result = Jhon.serializePretty(value, "  ");
        assertEquals("[\n  {\n    age = 30,\n    name = \"John\"\n  },\n  {\n    age = 25,\n    name = \"Jane\"\n  }\n]", result, "Serialize pretty array with objects");
    }

    private static void testSerializePrettyRoundTrip() {
        try {
            Map<String, Object> original = new LinkedHashMap<>();
            original.put("name", "John");
            original.put("age", 30);
            original.put("active", true);
            original.put("tags", List.of("developer", "java"));

            String serialized = Jhon.serializePretty(original, "  ");
            Object parsed = Jhon.parse(serialized);

            Map<?, ?> parsedObj = (Map<?, ?>) parsed;
            assertEquals(original.get("name"), parsedObj.get("name"), "Pretty round trip name");
            assertEquals(original.get("age"), parsedObj.get("age"), "Pretty round trip age");

            List<?> tags = (List<?>) parsedObj.get("tags");
            assertEquals(2, tags.size(), "Pretty round trip tags size");
            assertEquals("developer", tags.get(0), "Pretty round trip first tag");
            assertEquals("java", tags.get(1), "Pretty round trip second tag");
        } catch (Exception e) {
            failed++;
            System.err.println("FAILED: Pretty round trip - " + e.getMessage());
        }
    }
}
