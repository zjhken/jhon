package jhon;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Comprehensive unit tests for JHON parser
 */
@DisplayName("JHON Parser Tests")
class JhonTest {

    // =============================================================================
    // Basic Parsing Tests
    // =============================================================================

    @Test
    @DisplayName("Empty input should return empty object")
    void testEmptyInput() throws Exception {
        Object result = Jhon.parse("");
        assertTrue(result instanceof Map);
        assertTrue(((Map<?, ?>) result).isEmpty());
    }

    @Test
    @DisplayName("Parse basic key-value pairs")
    void testBasicKeyValue() throws Exception {
        Object result = Jhon.parse("a=\"hello\", b=123.45");
        Map<?, ?> obj = (Map<?, ?>) result;

        assertEquals("hello", obj.get("a"));
        assertEquals(123.45, obj.get("b"));
    }

    @Test
    @DisplayName("Parse quoted and unquoted keys")
    void testStringTypes() throws Exception {
        Object result = Jhon.parse("\"quoted key\"=\"value\", unquoted_key=\"another\"");
        Map<?, ?> obj = (Map<?, ?>) result;

        assertEquals("value", obj.get("quoted key"));
        assertEquals("another", obj.get("unquoted_key"));
    }

    @Test
    @DisplayName("Parse various string values")
    void testStringValues() throws Exception {
        Object result = Jhon.parse("text=\"simple string\", empty=\"\", spaces=\"  with  spaces  \"");
        Map<?, ?> obj = (Map<?, ?>) result;

        assertEquals("simple string", obj.get("text"));
        assertEquals("", obj.get("empty"));
        assertEquals("  with  spaces  ", obj.get("spaces"));
    }

    @Test
    @DisplayName("Parse escape sequences")
    void testStringEscaping() throws Exception {
        Object result = Jhon.parse(
                "newline=\"hello\\nworld\", " +
                "tab=\"tab\\there\", " +
                "backslash=\"path\\\\to\\\\file\", " +
                "quote=\"say \\\"hello\\\"\""
        );
        Map<?, ?> obj = (Map<?, ?>) result;

        assertEquals("hello\nworld", obj.get("newline"));
        assertEquals("tab\there", obj.get("tab"));
        assertEquals("path\\to\\file", obj.get("backslash"));
        assertEquals("say \"hello\"", obj.get("quote"));
    }

    @Test
    @DisplayName("Parse Unicode escape sequences")
    void testUnicodeEscape() throws Exception {
        Object result = Jhon.parse("unicode=\"Hello\\u00A9World\"");
        Map<?, ?> obj = (Map<?, ?>) result;

        assertEquals("Hello©World", obj.get("unicode"));
    }

    @Test
    @DisplayName("Parse various number formats")
    void testNumbers() throws Exception {
        Object result = Jhon.parse("int=42, float=3.14, negative=-123, negative_float=-45.67");
        Map<?, ?> obj = (Map<?, ?>) result;

        assertNumberEquals(42.0, obj.get("int"));
        assertEquals(3.14, obj.get("float"));
        assertNumberEquals(-123.0, obj.get("negative"));
        assertEquals(-45.67, obj.get("negative_float"));
    }

    @Test
    @DisplayName("Parse numbers with underscores")
    void testNumbersWithUnderscores() throws Exception {
        Object result = Jhon.parse("large=100_000, million=1_000_000, decimal=1_234.567_890, neg_large=-50_000");
        Map<?, ?> obj = (Map<?, ?>) result;

        assertNumberEquals(100000.0, obj.get("large"));
        assertNumberEquals(1000000.0, obj.get("million"));
        assertEquals(1234.56789, obj.get("decimal"));
        assertNumberEquals(-50000.0, obj.get("neg_large"));
    }

    @Test
    @DisplayName("Parse boolean values")
    void testBooleans() throws Exception {
        Object result = Jhon.parse("truth=true, falsehood=false");
        Map<?, ?> obj = (Map<?, ?>) result;

        assertEquals(true, obj.get("truth"));
        assertEquals(false, obj.get("falsehood"));
    }

    @Test
    @DisplayName("Parse null value")
    void testNullValue() throws Exception {
        Object result = Jhon.parse("empty=null");
        Map<?, ?> obj = (Map<?, ?>) result;

        assertNull(obj.get("empty"));
    }

    @Test
    @DisplayName("Parse empty array")
    void testEmptyArrays() throws Exception {
        Object result = Jhon.parse("empty=[]");
        Map<?, ?> obj = (Map<?, ?>) result;

        List<?> arr = (List<?>) obj.get("empty");
        assertTrue(arr.isEmpty());
    }

    @Test
    @DisplayName("Parse array with strings")
    void testArraysWithStrings() throws Exception {
        Object result = Jhon.parse("strings=[\"hello\", \"world\", \"test\"]");
        Map<?, ?> obj = (Map<?, ?>) result;

        List<?> arr = (List<?>) obj.get("strings");
        assertEquals(3, arr.size());
        assertEquals("hello", arr.get(0));
        assertEquals("world", arr.get(1));
        assertEquals("test", arr.get(2));
    }

    @Test
    @DisplayName("Parse array with numbers")
    void testArraysWithNumbers() throws Exception {
        Object result = Jhon.parse("numbers=[1, 2.5, -3, 4.0]");
        Map<?, ?> obj = (Map<?, ?>) result;

        List<?> arr = (List<?>) obj.get("numbers");
        assertEquals(4, arr.size());
        assertNumberEquals(1.0, arr.get(0));
        assertEquals(2.5, arr.get(1));
        assertNumberEquals(-3.0, arr.get(2));
        assertEquals(4.0, arr.get(3));
    }

    @Test
    @DisplayName("Parse array with mixed types")
    void testArraysWithMixedTypes() throws Exception {
        Object result = Jhon.parse("mixed=[\"hello\", 123, true, null, 45.6]");
        Map<?, ?> obj = (Map<?, ?>) result;

        List<?> arr = (List<?>) obj.get("mixed");
        assertEquals(5, arr.size());
        assertEquals("hello", arr.get(0));
        assertNumberEquals(123.0, arr.get(1));
        assertEquals(true, arr.get(2));
        assertNull(arr.get(3));
        assertEquals(45.6, arr.get(4));
    }

    @Test
    @DisplayName("Parse multiline input")
    void testMultiline() throws Exception {
        Object result = Jhon.parse(
                "name = \"test\",\n" +
                "age = 25,\n" +
                "active = true,\n" +
                "tags = [\"tag1\", \"tag2\"],\n" +
                "score = 98.5"
        );
        Map<?, ?> obj = (Map<?, ?>) result;

        assertEquals("test", obj.get("name"));
        assertNumberEquals(25.0, obj.get("age"));
        assertEquals(true, obj.get("active"));
    }

    @Test
    @DisplayName("Parse single-line comments")
    void testSingleLineComments() throws Exception {
        Object result = Jhon.parse(
                "// This is a comment\n" +
                "name = \"test\"  // inline comment\n" +
                "age = 25\n" +
                "// Another comment\n" +
                "active = true"
        );
        Map<?, ?> obj = (Map<?, ?>) result;

        assertEquals("test", obj.get("name"));
        assertNumberEquals(25.0, obj.get("age"));
        assertEquals(true, obj.get("active"));
    }

    @Test
    @DisplayName("Parse multi-line comments")
    void testMultilineComments() throws Exception {
        Object result = Jhon.parse(
                "/* This is a\n" +
                "   multiline comment */\n" +
                "name = \"test\"\n" +
                "/* Another comment */\n" +
                "age = 25"
        );
        Map<?, ?> obj = (Map<?, ?>) result;

        assertEquals("test", obj.get("name"));
        assertNumberEquals(25.0, obj.get("age"));
    }

    @Test
    @DisplayName("Parse trailing commas")
    void testTrailingCommas() throws Exception {
        Object result = Jhon.parse("name=\"test\", age=25, ");
        Map<?, ?> obj = (Map<?, ?>) result;

        assertEquals("test", obj.get("name"));
        assertNumberEquals(25.0, obj.get("age"));
    }

    @Test
    @DisplayName("Parse array trailing commas")
    void testArrayTrailingCommas() throws Exception {
        Object result = Jhon.parse("items=[\"apple\", \"banana\", \"cherry\", ]");
        Map<?, ?> obj = (Map<?, ?>) result;

        List<?> arr = (List<?>) obj.get("items");
        assertEquals(3, arr.size());
    }

    @Test
    @DisplayName("Parse nested objects")
    void testNestedObjects() throws Exception {
        Object result = Jhon.parse("server={host=\"localhost\", port=8080}");
        Map<?, ?> obj = (Map<?, ?>) result;

        Map<?, ?> server = (Map<?, ?>) obj.get("server");
        assertEquals("localhost", server.get("host"));
        assertNumberEquals(8080.0, server.get("port"));
    }

    @Test
    @DisplayName("Parse raw strings")
    void testRawStrings() throws Exception {
        Object result = Jhon.parse("path=r\"C:\\Windows\\System32\"");
        Map<?, ?> obj = (Map<?, ?>) result;

        assertEquals("C:\\Windows\\System32", obj.get("path"));
    }

    @Test
    @DisplayName("Parse raw strings with hashes")
    void testRawStringsWithHashes() throws Exception {
        Object result = Jhon.parse("contains_hash=r#\"This has a \" quote in it\"#");
        Map<?, ?> obj = (Map<?, ?>) result;

        assertEquals("This has a \" quote in it", obj.get("contains_hash"));
    }

    @Test
    @DisplayName("Parse single-quoted strings")
    void testSingleQuotedStrings() throws Exception {
        Object result = Jhon.parse("name='John', greeting='Hello'");
        Map<?, ?> obj = (Map<?, ?>) result;

        assertEquals("John", obj.get("name"));
        assertEquals("Hello", obj.get("greeting"));
    }

    @Test
    @DisplayName("Parse quotes inside strings")
    void testQuotesInsideStrings() throws Exception {
        Object result = Jhon.parse("text='He said \"hello\" to me'");
        Map<?, ?> obj = (Map<?, ?>) result;

        assertEquals("He said \"hello\" to me", obj.get("text"));
    }

    @Test
    @DisplayName("Parse quoted keys with spaces")
    void testQuotedKeysWithSpaces() throws Exception {
        Object result = Jhon.parse("\"my key\"=\"value\", \"another key\"=\"test\"");
        Map<?, ?> obj = (Map<?, ?>) result;

        assertEquals("value", obj.get("my key"));
        assertEquals("test", obj.get("another key"));
    }

    @Test
    @DisplayName("Parse complex nested structure")
    void testComplexNestedStructure() throws Exception {
        Object result = Jhon.parse(
                "server = {\n" +
                "    host = \"localhost\",\n" +
                "    port = 3000,\n" +
                "    middleware = [\n" +
                "        {name = \"logger\", enabled = true},\n" +
                "        {name = \"cors\", enabled = false}\n" +
                "    ]\n" +
                "}"
        );
        Map<?, ?> obj = (Map<?, ?>) result;

        Map<?, ?> server = (Map<?, ?>) obj.get("server");
        assertEquals("localhost", server.get("host"));
        assertNumberEquals(3000.0, server.get("port"));

        List<?> middleware = (List<?>) server.get("middleware");
        assertEquals(2, middleware.size());

        Map<?, ?> m1 = (Map<?, ?>) middleware.get(0);
        assertEquals("logger", m1.get("name"));
        assertEquals(true, m1.get("enabled"));

        Map<?, ?> m2 = (Map<?, ?>) middleware.get(1);
        assertEquals("cors", m2.get("name"));
        assertEquals(false, m2.get("enabled"));
    }

    @Test
    @DisplayName("Parse deeply nested objects")
    void testDeeplyNestedObjects() throws Exception {
        Object result = Jhon.parse("outer={inner={deep=\"value\"} number=42}");
        Map<?, ?> obj = (Map<?, ?>) result;

        Map<?, ?> outer = (Map<?, ?>) obj.get("outer");
        Map<?, ?> inner = (Map<?, ?>) outer.get("inner");

        assertEquals("value", inner.get("deep"));
        assertNumberEquals(42.0, outer.get("number"));
    }

    @Test
    @DisplayName("Parse arrays in objects")
    void testArraysInObjects() throws Exception {
        Object result = Jhon.parse("data={items=[1, 2, 3] active=true}");
        Map<?, ?> obj = (Map<?, ?>) result;

        Map<?, ?> data = (Map<?, ?>) obj.get("data");
        List<?> items = (List<?>) data.get("items");

        assertEquals(3, items.size());
        assertNumberEquals(1.0, items.get(0));
        assertNumberEquals(2.0, items.get(1));
        assertNumberEquals(3.0, items.get(2));
        assertEquals(true, data.get("active"));
    }

    // =============================================================================
    // Error Tests
    // =============================================================================

    @Test
    @DisplayName("Error on unterminated string")
    void testErrorUnterminatedString() {
        assertThrows(Jhon.JhonParseException.class, () -> {
            Jhon.parse("name=\"unclosed string");
        });
    }

    @Test
    @DisplayName("Error on missing equals")
    void testErrorExpectedEquals() {
        assertThrows(Jhon.JhonParseException.class, () -> {
            Jhon.parse("name \"value\"");
        });
    }

    @Test
    @DisplayName("Error on unterminated array")
    void testErrorUnterminatedArray() {
        assertThrows(Jhon.JhonParseException.class, () -> {
            Jhon.parse("items=[1, 2, 3");
        });
    }

    @Test
    @DisplayName("Error on unterminated nested object")
    void testErrorUnterminatedNestedObject() {
        assertThrows(Jhon.JhonParseException.class, () -> {
            Jhon.parse("server={host=\"localhost\"");
        });
    }

    @Test
    @DisplayName("Error on invalid boolean")
    void testErrorInvalidBoolean() {
        assertThrows(Jhon.JhonParseException.class, () -> {
            Jhon.parse("active=troo");
        });
    }

    @Test
    @DisplayName("Error on invalid null")
    void testErrorInvalidNull() {
        assertThrows(Jhon.JhonParseException.class, () -> {
            Jhon.parse("value=nul");
        });
    }

    // =============================================================================
    // Serialization Tests
    // =============================================================================

    @Test
    @DisplayName("Serialize basic object")
    void testSerializeBasicObject() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("name", "John");
        value.put("age", 30);
        String result = Jhon.serialize(value);

        assertEquals("age=30,name=\"John\"", result);
    }

    @Test
    @DisplayName("Serialize empty object")
    void testSerializeEmptyObject() {
        Map<String, Object> value = new LinkedHashMap<>();
        String result = Jhon.serialize(value);

        assertEquals("", result);
    }

    @Test
    @DisplayName("Serialize string")
    void testSerializeString() {
        String result = Jhon.serialize("hello world");
        assertEquals("\"hello world\"", result);
    }

    @Test
    @DisplayName("Serialize string with escapes")
    void testSerializeStringWithEscapes() {
        String result = Jhon.serialize("line1\nline2\ttab");
        assertEquals("\"line1\\nline2\\ttab\"", result);
    }

    @Test
    @DisplayName("Serialize string with quotes")
    void testSerializeStringWithQuotes() {
        String result = Jhon.serialize("He said \"hello\"");
        assertEquals("\"He said \\\"hello\\\"\"", result);
    }

    @Test
    @DisplayName("Serialize numbers")
    void testSerializeNumbers() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("int", 42);
        value.put("float", 3.14);
        value.put("negative", -123);
        String result = Jhon.serialize(value);

        assertEquals("float=3.14,int=42,negative=-123", result);
    }

    @Test
    @DisplayName("Serialize booleans")
    void testSerializeBoolean() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("active", true);
        value.put("inactive", false);
        String result = Jhon.serialize(value);

        assertEquals("active=true,inactive=false", result);
    }

    @Test
    @DisplayName("Serialize null")
    void testSerializeNull() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("empty", null);
        String result = Jhon.serialize(value);

        assertEquals("empty=null", result);
    }

    @Test
    @DisplayName("Serialize array")
    void testSerializeArray() {
        List<Object> value = List.of(1, 2, 3, "hello", true);
        String result = Jhon.serialize(value);

        assertEquals("[1,2,3,\"hello\",true]", result);
    }

    @Test
    @DisplayName("Serialize empty array")
    void testSerializeEmptyArray() {
        String result = Jhon.serialize(List.of());
        assertEquals("[]", result);
    }

    @Test
    @DisplayName("Serialize nested object")
    void testSerializeNestedObject() {
        Map<String, Object> server = new LinkedHashMap<>();
        server.put("host", "localhost");
        server.put("port", 8080);

        Map<String, Object> value = new LinkedHashMap<>();
        value.put("server", server);

        String result = Jhon.serialize(value);
        assertEquals("server={host=\"localhost\",port=8080}", result);
    }

    @Test
    @DisplayName("Serialize array with objects")
    void testSerializeArrayWithObjects() {
        Map<String, Object> person1 = new LinkedHashMap<>();
        person1.put("name", "John");
        person1.put("age", 30);

        Map<String, Object> person2 = new LinkedHashMap<>();
        person2.put("name", "Jane");
        person2.put("age", 25);

        List<Object> value = List.of(person1, person2);
        String result = Jhon.serialize(value);

        assertEquals("[{age=30,name=\"John\"},{age=25,name=\"Jane\"}]", result);
    }

    @Test
    @DisplayName("Serialize keys with special characters")
    void testSerializeKeysWithSpecialChars() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("my key", "value1");
        value.put("key@symbol", "value2");

        String result = Jhon.serialize(value);
        assertEquals("\"key@symbol\"=\"value2\",\"my key\"=\"value1\"", result);
    }

    @Test
    @DisplayName("Serialize round trip simple")
    void testSerializeRoundTripSimple() throws Exception {
        Map<String, Object> original = new LinkedHashMap<>();
        original.put("name", "John");
        original.put("age", 30);
        original.put("active", true);

        String serialized = Jhon.serialize(original);
        Object parsed = Jhon.parse(serialized);

        Map<?, ?> parsedObj = (Map<?, ?>) parsed;
        assertEquals(original.get("name"), parsedObj.get("name"));
        assertEquals(original.get("age"), parsedObj.get("age"));
        assertEquals(original.get("active"), parsedObj.get("active"));
    }

    @Test
    @DisplayName("Serialize round trip complex")
    void testSerializeRoundTripComplex() throws Exception {
        Map<String, Object> database = new LinkedHashMap<>();
        database.put("host", "localhost");
        database.put("port", 5432);
        database.put("name", "mydb");
        database.put("ssl", true);
        database.put("timeout", 30.5);

        Map<String, Object> original = new LinkedHashMap<>();
        original.put("app_name", "ocean-note");
        original.put("version", "2.0.0");
        original.put("database", database);
        original.put("features", List.of("markdown", "collaboration", "real-time"));

        String serialized = Jhon.serialize(original);
        Object parsed = Jhon.parse(serialized);

        Map<?, ?> parsedObj = (Map<?, ?>) parsed;
        assertEquals(original.get("app_name"), parsedObj.get("app_name"));
        assertEquals(original.get("version"), parsedObj.get("version"));

        Map<?, ?> parsedDb = (Map<?, ?>) parsedObj.get("database");
        assertEquals(database.get("host"), parsedDb.get("host"));
        assertEquals(database.get("port"), parsedDb.get("port"));
    }

    // =============================================================================
    // Pretty Serialization Tests
    // =============================================================================

    @Test
    @DisplayName("Serialize pretty basic object")
    void testSerializePrettyBasicObject() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("name", "John");
        value.put("age", 30);

        String result = Jhon.serializePretty(value, "  ");
        assertEquals("age = 30,\nname = \"John\"", result);
    }

    @Test
    @DisplayName("Serialize pretty nested objects")
    void testSerializePrettyNestedObjects() {
        Map<String, Object> server = new LinkedHashMap<>();
        server.put("host", "localhost");
        server.put("port", 8080);

        Map<String, Object> value = new LinkedHashMap<>();
        value.put("server", server);

        String result = Jhon.serializePretty(value, "  ");
        assertEquals("server = {\n  host = \"localhost\",\n  port = 8080\n}", result);
    }

    @Test
    @DisplayName("Serialize pretty array")
    void testSerializePrettyArray() {
        List<Object> value = List.of(1, 2, 3, "hello");
        String result = Jhon.serializePretty(value, "  ");

        assertEquals("[\n  1,\n  2,\n  3,\n  \"hello\"\n]", result);
    }

    @Test
    @DisplayName("Serialize pretty array with objects")
    void testSerializePrettyArrayWithObjects() {
        Map<String, Object> person1 = new LinkedHashMap<>();
        person1.put("name", "John");
        person1.put("age", 30);

        Map<String, Object> person2 = new LinkedHashMap<>();
        person2.put("name", "Jane");
        person2.put("age", 25);

        List<Object> value = List.of(person1, person2);
        String result = Jhon.serializePretty(value, "  ");

        assertEquals("[\n  {\n    age = 30,\n    name = \"John\"\n  },\n  {\n    age = 25,\n    name = \"Jane\"\n  }\n]", result);
    }

    @Test
    @DisplayName("Serialize pretty round trip")
    void testSerializePrettyRoundTrip() throws Exception {
        Map<String, Object> original = new LinkedHashMap<>();
        original.put("name", "John");
        original.put("age", 30);
        original.put("active", true);
        original.put("tags", List.of("developer", "java"));

        String serialized = Jhon.serializePretty(original, "  ");
        Object parsed = Jhon.parse(serialized);

        Map<?, ?> parsedObj = (Map<?, ?>) parsed;
        assertEquals(original.get("name"), parsedObj.get("name"));
        assertEquals(original.get("age"), parsedObj.get("age"));

        List<?> tags = (List<?>) parsedObj.get("tags");
        assertEquals(2, tags.size());
        assertEquals("developer", tags.get(0));
        assertEquals("java", tags.get(1));
    }

    // =============================================================================
    // Integration Tests
    // =============================================================================

    @Test
    @DisplayName("Round trip complex configuration")
    void testRoundTripComplexConfiguration() throws Exception {
        String jhonInput = """
                // Application Configuration
                app_name="ocean-note"
                version="2.0.0"
                debug=true

                // Database Configuration
                database={
                    host="localhost"
                    port=5432
                    name="mydb"
                    pool_size=10
                    timeout=30.5
                    ssl_enabled=true
                }

                // Features
                features=["markdown","collaboration","real-time"]

                // Server Configuration
                server={
                    host="0.0.0.0"
                    port=3000
                    middleware=[
                        {name="logger" enabled=true}
                        {name="cors" enabled=false}
                    ]
                }
                """;

        Object parsed = Jhon.parse(jhonInput);
        String serialized = Jhon.serialize(parsed);

        // Verify it can be parsed again
        Object reparsed = Jhon.parse(serialized);
        Map<?, ?> obj = (Map<?, ?>) reparsed;

        assertEquals("ocean-note", obj.get("app_name"));
        assertEquals("2.0.0", obj.get("version"));
        assertEquals(true, obj.get("debug"));

        Map<?, ?> database = (Map<?, ?>) obj.get("database");
        assertEquals("localhost", database.get("host"));
        assertNumberEquals(5432.0, database.get("port"));

        List<?> features = (List<?>) obj.get("features");
        assertEquals(3, features.size());
    }

    // =============================================================================
    // Helper Methods
    // =============================================================================

    private static void assertNumberEquals(Number expected, Object actual) {
        if (actual instanceof Number) {
            Number actualNum = (Number) actual;
            assertEquals(expected.doubleValue(), actualNum.doubleValue(), 0.001);
        } else {
            fail("Expected Number but got: " + actual);
        }
    }
}
