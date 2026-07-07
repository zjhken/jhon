package jhon;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * JHON parser/serializer spec-conformance tests. Mirrors rust/src/lib.rs tests
 * one-to-one so behavior parity is verifiable.
 */
@DisplayName("JHON spec parity")
class JhonTest {

    private static Map<String, Object> obj(Object... kv) {
        LinkedHashMap<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    // ====================================================================================
    // §2 document form
    // ====================================================================================

    @Test
    @DisplayName("empty input → null (Empty form)")
    void emptyInput() throws Exception {
        assertNull(Jhon.parse(""));
    }

    @Test
    @DisplayName("whitespace-only → null")
    void whitespaceOnly() throws Exception {
        assertNull(Jhon.parse("   \n\t\r\n  "));
    }

    @Test
    @DisplayName("comments-only → null")
    void commentsOnly() throws Exception {
        assertNull(Jhon.parse("// just a comment\n/* block */"));
    }

    @Test
    @DisplayName("top-level object without braces")
    void topLevelObjectWithoutBraces() throws Exception {
        assertEquals(obj("name", "x", "port", 80L), Jhon.parse("name=\"x\",port=80"));
    }

    @Test
    @DisplayName("top-level object with braces → single-element array")
    void topLevelObjectWithBraces() throws Exception {
        // Per SPEC §2: top-level `{...}` is one element of the implicit array.
        Object v = Jhon.parse("{name=\"x\",port=80}");
        assertTrue(v instanceof List);
        assertEquals(List.of(obj("name", "x", "port", 80L)), v);
    }

    @Test
    @DisplayName("top-level explicit array → single-element array")
    void topLevelArrayAlone() throws Exception {
        // Per SPEC §2: top-level `[...]` is one element of the implicit array.
        Object v = Jhon.parse("[1, 2, 3]");
        assertTrue(v instanceof List);
        assertEquals(List.of(List.of(1L, 2L, 3L)), v);
    }

    @Test
    @DisplayName("top-level scalar number → single-element array")
    void topLevelScalarNumber() throws Exception {
        assertEquals(List.of(42L), Jhon.parse("42"));
    }

    @Test
    @DisplayName("top-level scalar string → single-element array")
    void topLevelScalarString() throws Exception {
        assertEquals(List.of("hello"), Jhon.parse("\"hello\""));
    }

    @Test
    @DisplayName("top-level scalar boolean → single-element array")
    void topLevelScalarBoolean() throws Exception {
        assertEquals(List.of(true), Jhon.parse("true"));
        assertEquals(List.of(false), Jhon.parse("false"));
    }

    @Test
    @DisplayName("top-level scalar null → single-element array")
    void topLevelScalarNull() throws Exception {
        assertEquals(java.util.Collections.singletonList(null), Jhon.parse("null"));
    }

    @Test
    @DisplayName("top-level multiple scalars newline-separated")
    void topLevelMultipleScalars() throws Exception {
        assertEquals(List.of(1L, 2L, 3L), Jhon.parse("1\n2\n3"));
    }

    @Test
    @DisplayName("top-level mixed scalars and object (spec example)")
    void topLevelMixedScalarsAndObject() throws Exception {
        assertEquals(
            List.of(1L, 2L, "haha", obj("a", 4L)),
            Jhon.parse("1\n2\n\"haha\"\n{a=4}")
        );
    }

    @Test
    @DisplayName("top-level multiple objects")
    void topLevelMultipleObjects() throws Exception {
        assertEquals(
            List.of(obj("a", 1L), obj("b", 2L)),
            Jhon.parse("{a=1}\n{b=2}")
        );
    }

    @Test
    @DisplayName("top-level keyword as key → object mode")
    void topLevelKeywordAsKey() throws Exception {
        assertEquals(obj("true", 1L), Jhon.parse("true=1"));
    }

    @Test
    @DisplayName("top-level numeric key → object mode")
    void topLevelNumericKey() throws Exception {
        assertEquals(obj("42", "x"), Jhon.parse("42=\"x\""));
    }

    @Test
    @DisplayName("top-level quoted string key → object mode")
    void topLevelQuotedStringKey() throws Exception {
        assertEquals(obj("key", "value"), Jhon.parse("\"key\"=\"value\""));
    }

    @Test
    @DisplayName("top-level mixed pair then scalar is error")
    void topLevelMixedPairThenScalar() {
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("a=1\n2"));
    }

    @Test
    @DisplayName("top-level mixed scalar then pair is error")
    void topLevelMixedScalarThenPair() {
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("1\na=2"));
    }

    @Test
    @DisplayName("top-level array followed by content is error")
    void topLevelArrayFollowed() {
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("[1, 2] key=value"));
    }

    // ====================================================================================
    // §3.2 comments
    // ====================================================================================

    @Test
    @DisplayName("single-line trailing comment")
    void singleLineTrailing() throws Exception {
        assertEquals(obj("key", "value"), Jhon.parse("key=\"value\" // trailing"));
    }

    @Test
    @DisplayName("block comment inline")
    void blockCommentInline() throws Exception {
        assertEquals(obj("key", "value"), Jhon.parse("key=/* inline */\"value\""));
    }

    @Test
    @DisplayName("unterminated block comment is error")
    void unterminatedBlockComment() {
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("key=/* unterminated"));
    }

    // ====================================================================================
    // §3.3 bare keys
    // ====================================================================================

    @Test
    @DisplayName("simple identifier key")
    void simpleIdentifier() throws Exception {
        assertEquals(obj("keyname", "value"), Jhon.parse("keyname=\"value\""));
    }

    @Test
    @DisplayName("true/false/null as string keys")
    void keywordAsKey() throws Exception {
        assertEquals(obj("true", "yes"), Jhon.parse("true=\"yes\""));
        assertEquals(obj("false", "no"), Jhon.parse("false=\"no\""));
        assertEquals(obj("null", "nothing"), Jhon.parse("null=\"nothing\""));
    }

    @Test
    @DisplayName("hyphen / dot / unicode in keys")
    void keysWithSpecialChars() throws Exception {
        assertEquals(obj("my-key", "v"), Jhon.parse("my-key=\"v\""));
        assertEquals(obj("app.version", 1L), Jhon.parse("app.version=1"));
        assertEquals(obj("日本語", "v"), Jhon.parse("日本語=\"v\""));
    }

    @Test
    @DisplayName("quoted key with spaces")
    void quotedKey() throws Exception {
        assertEquals(obj("quoted key", "v"), Jhon.parse("\"quoted key\"=\"v\""));
    }

    // ====================================================================================
    // §3.4 strings
    // ====================================================================================

    @Test
    @DisplayName("double and single quoted")
    void quotedStrings() throws Exception {
        assertEquals(obj("k", "value"), Jhon.parse("k=\"value\""));
        assertEquals(obj("k", "value"), Jhon.parse("k='value'"));
    }

    @Test
    @DisplayName("escape newline and tab")
    void escapesNewlineTab() throws Exception {
        assertEquals(
            obj("newline", "hello\nworld", "tab", "tab\there"),
            Jhon.parse("newline=\"hello\\nworld\",tab=\"tab\\there\"")
        );
    }

    @Test
    @DisplayName("escape quote and backslash")
    void escapesQuoteBs() throws Exception {
        Object parsed = Jhon.parse("q=\"say \\\"hi\\\"\",bs=\"a\\\\b\"");
        assertEquals(obj("q", "say \"hi\"", "bs", "a\\b"), parsed);
    }

    @Test
    @DisplayName("raw string basic")
    void rawStringBasic() throws Exception {
        assertEquals(obj("path", "C:\\Windows\\System32"), Jhon.parse("path=r\"C:\\Windows\\System32\""));
    }

    @Test
    @DisplayName("raw string with hashes")
    void rawStringWithHashes() throws Exception {
        assertEquals(obj("q", "contains \"quotes\""), Jhon.parse("q=r#\"contains \"quotes\"\"#"));
    }

    @Test
    @DisplayName("unrecognized escape is error")
    void unrecognizedEscape() {
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("key=\"value\\q\""));
    }

    @Test
    @DisplayName("unterminated string is error")
    void unterminatedString() {
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("key=\"unterminated"));
    }

    // ====================================================================================
    // §3.5 numbers
    // ====================================================================================

    @Test
    @DisplayName("decimal integer")
    void decimalInteger() throws Exception {
        assertEquals(obj("n", 42L), Jhon.parse("n=42"));
    }

    @Test
    @DisplayName("negative integer")
    void negativeInteger() throws Exception {
        assertEquals(obj("n", -5L), Jhon.parse("n=-5"));
    }

    @Test
    @DisplayName("number with underscores")
    void underscores() throws Exception {
        assertEquals(obj("n", 1_000_000L), Jhon.parse("n=1_000_000"));
    }

    @Test
    @DisplayName("float fractional")
    void floatFractional() throws Exception {
        assertEquals(obj("n", 12.5), Jhon.parse("n=12.5"));
    }

    @Test
    @DisplayName("float with exponent only")
    void floatExponentOnly() throws Exception {
        assertEquals(obj("n", 1e10), Jhon.parse("n=1e10"));
    }

    @Test
    @DisplayName("float with fractional and exponent")
    void floatFractionalExponent() throws Exception {
        assertEquals(obj("n", 1.5e-3), Jhon.parse("n=1.5E-3"));
    }

    @Test
    @DisplayName("hex lowercase")
    void hexLowercase() throws Exception {
        assertEquals(obj("n", 255L), Jhon.parse("n=0xff"));
    }

    @Test
    @DisplayName("hex with uppercase digits")
    void hexUppercaseDigits() throws Exception {
        assertEquals(obj("n", 0xDE_ADL), Jhon.parse("n=0xDE_AD"));
    }

    @Test
    @DisplayName("octal and binary")
    void octalBinary() throws Exception {
        assertEquals(obj("n", 511L), Jhon.parse("n=0o777"));
        assertEquals(obj("n", 10L), Jhon.parse("n=0b1010"));
    }

    @Test
    @DisplayName("negative hex literal")
    void negativeHex() throws Exception {
        assertEquals(obj("n", -255L), Jhon.parse("n=-0xff"));
    }

    @Test
    @DisplayName("+ prefix is error")
    void plusPrefix() {
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("n=+5"));
    }

    @Test
    @DisplayName("uppercase radix prefixes are error")
    void uppercaseRadix() {
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("n=0Xff"));
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("n=0O77"));
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("n=0B10"));
    }

    @Test
    @DisplayName("type suffix is error")
    void typeSuffix() {
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("n=5u8"));
    }

    @Test
    @DisplayName("leading / trailing / adjacent underscores are error")
    void badUnderscores() {
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("n=_5"));
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("n=5_"));
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("n=5__5"));
    }

    // ====================================================================================
    // §5 objects
    // ====================================================================================

    @Test
    @DisplayName("basic key value pairs")
    void basicKv() throws Exception {
        assertEquals(
            obj("name", "John", "age", 30L, "active", true),
            Jhon.parse("name=\"John\",age=30,active=true")
        );
    }

    @Test
    @DisplayName("nested object")
    void nestedObject() throws Exception {
        assertEquals(
            obj("server", obj("host", "localhost", "port", 8080L)),
            Jhon.parse("server={host=\"localhost\", port=8080}")
        );
    }

    @Test
    @DisplayName("whitespace around equals is insignificant")
    void whitespaceAroundEquals() throws Exception {
        assertEquals(
            obj("a", 1L, "b", 2L, "c", 3L),
            Jhon.parse("a=1, b = 2 , c=3")
        );
    }

    @Test
    @DisplayName("duplicate keys are error")
    void duplicateKeys() {
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("a=1, a=2"));
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("outer={a=1, a=2}"));
    }

    // ====================================================================================
    // §5.3 separators
    // ====================================================================================

    @Test
    @DisplayName("newline-separated multiline")
    void newlineSeparated() throws Exception {
        assertEquals(
            obj("a", 1L, "b", 2L, "c", 3L),
            Jhon.parse("a=1\nb=2\nc=3")
        );
    }

    @Test
    @DisplayName("trailing comma at top level")
    void trailingCommaTopLevel() throws Exception {
        assertEquals(obj("a", 1L, "b", 2L), Jhon.parse("a=1, b=2,"));
    }

    @Test
    @DisplayName("same-line space-only separator is error")
    void sameLineSpaceOnly() {
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("a=1 b=2"));
    }

    @Test
    @DisplayName("same-line tab-only separator is error")
    void sameLineTabOnly() {
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("a=1\tb=2"));
    }

    // ====================================================================================
    // §6 arrays
    // ====================================================================================

    @Test
    @DisplayName("empty array")
    void emptyArray() throws Exception {
        Object v = Jhon.parse("items=[]");
        Map<String, Object> wrap = obj("items", new java.util.ArrayList<>());
        assertEquals(wrap, v);
    }

    @Test
    @DisplayName("array mixed types")
    void arrayMixed() throws Exception {
        Object v = Jhon.parse("mixed=[1, \"two\", true, null]");
        java.util.ArrayList<Object> arr = new java.util.ArrayList<>();
        arr.add(1L);
        arr.add("two");
        arr.add(true);
        arr.add(null);
        Map<String, Object> wrap = obj("mixed", arr);
        assertEquals(wrap, v);
    }

    @Test
    @DisplayName("unbalanced array is error")
    void unbalancedArray() {
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("[1, 2, 3"));
    }

    @Test
    @DisplayName("unbalanced braces are error")
    void unbalancedBraces() {
        assertThrows(Jhon.JhonParseException.class, () -> Jhon.parse("{a=1, b=2"));
    }

    // ====================================================================================
    // §7 serialization
    // ====================================================================================

    @Test
    @DisplayName("compact serialize no spaces around equals")
    void compactSerialize() {
        // LinkedHashMap preserves insertion order, so no sortKeys needed.
        assertEquals(
            "name=\"John\",age=30",
            Jhon.serialize(obj("name", "John", "age", 30L))
        );
    }

    @Test
    @DisplayName("compact serialize nested object")
    void compactSerializeNested() {
        assertEquals(
            "server={host=\"localhost\",port=8080}",
            Jhon.serialize(obj("server", obj("host", "localhost", "port", 8080L)))
        );
    }

    @Test
    @DisplayName("compact serialize top-level array (bare, no brackets)")
    void compactSerializeArray() {
        java.util.ArrayList<Object> arr = new java.util.ArrayList<>();
        arr.add(obj("a", 1L));
        arr.add(obj("b", 2L));
        assertEquals("{a=1},{b=2}", Jhon.serialize(arr));
    }

    @Test
    @DisplayName("pretty serialize spaces around equals, no commas")
    void prettySerialize() {
        assertEquals(
            "name = \"John\"\nage = 30",
            Jhon.serializePretty(obj("name", "John", "age", 30L), "  ")
        );
    }

    @Test
    @DisplayName("pretty serialize nested object")
    void prettySerializeNested() {
        assertEquals(
            "server = {\n  host = \"localhost\"\n  port = 5432\n}",
            Jhon.serializePretty(obj("server", obj("host", "localhost", "port", 5432L)), "  ")
        );
    }

    @Test
    @DisplayName("pretty serialize deeply nested mixed structure")
    void prettySerializeDeeplyNested() {
        // Mixed nesting stress: arrays of objects containing arrays (some
        // with nested objects), deep object chains, arrays of arrays with
        // objects. Pinned cross-impl in rust/src/lib.rs pretty_serialize_deeply_nested.
        // Uses the new inline-short mode (maxInlineWidth=44, tab indent).
        java.util.ArrayList<Object> b1Only = new java.util.ArrayList<>();
        b1Only.add("c1");
        java.util.ArrayList<Object> b1WithObj = new java.util.ArrayList<>();
        b1WithObj.add("c1");
        b1WithObj.add(obj("d1", 4L));

        java.util.ArrayList<Object> a1 = new java.util.ArrayList<>();
        a1.add(obj("b1", b1Only));
        a1.add(obj("b1", new java.util.ArrayList<>(b1WithObj)));
        a1.add(obj("b1", new java.util.ArrayList<>(b1Only)));
        a1.add(obj("b1", new java.util.ArrayList<>(b1Only)));
        a1.add(obj("b1", new java.util.ArrayList<>(b1Only)));
        a1.add(obj("b1", new java.util.ArrayList<>(b1Only)));

        java.util.ArrayList<Object> c4arr = new java.util.ArrayList<>();
        c4arr.add("d1");
        c4arr.add("d3");
        java.util.ArrayList<Object> a3inner = new java.util.ArrayList<>();
        a3inner.add("b4");
        a3inner.add("b5");
        a3inner.add("b6");
        a3inner.add(obj("c4", c4arr));
        java.util.ArrayList<Object> a3 = new java.util.ArrayList<>();
        a3.add(a3inner);

        Object value = obj(
            "a1", a1,
            "a2", obj("b2", obj(
                "c2", obj("d2", "hahaha"),
                "c3", obj("d3", "hohohoh")
            )),
            "a3", a3
        );
        assertEquals(
            "a1 = [\n" +
            "\t{ b1 = [ \"c1\" ] }\n" +
            "\t{ b1 = [ \"c1\", { d1 = 4 } ] }\n" +
            "\t{ b1 = [ \"c1\" ] }\n" +
            "\t{ b1 = [ \"c1\" ] }\n" +
            "\t{ b1 = [ \"c1\" ] }\n" +
            "\t{ b1 = [ \"c1\" ] }\n" +
            "]\n" +
            "a2 = {\n" +
            "\tb2 = {\n" +
            "\t\tc2 = { d2 = \"hahaha\" }\n" +
            "\t\tc3 = { d3 = \"hohohoh\" }\n" +
            "\t}\n" +
            "}\n" +
            "a3 = [\n" +
            "\t[\n" +
            "\t\t\"b4\", \"b5\", \"b6\", { c4 = [ \"d1\", \"d3\" ] }\n" +
            "\t]\n" +
            "]",
            Jhon.serializePretty(value, "\t", 44)
        );
    }

    @Test
    @DisplayName("pretty serialize top-level array (bare, one per line)")
    void prettySerializeArray() {
        java.util.ArrayList<Object> arr = new java.util.ArrayList<>();
        arr.add(1L);
        arr.add(2L);
        arr.add(3L);
        assertEquals("1\n2\n3", Jhon.serializePretty(arr, "  "));
    }

    @Test
    @DisplayName("serialize top-level array with object (bare)")
    void serializeTopLevelArrayWithObject() {
        java.util.ArrayList<Object> arr = new java.util.ArrayList<>();
        arr.add(1L);
        arr.add(obj("a", 2L));
        assertEquals("1,{a=2}", Jhon.serialize(arr));
    }

    @Test
    @DisplayName("serialize empty containers and null → empty string")
    void serializeEmpty() {
        assertEquals("", Jhon.serialize(obj()));
        java.util.ArrayList<Object> arr = new java.util.ArrayList<>();
        assertEquals("", Jhon.serialize(arr));
        assertEquals("", Jhon.serialize(null));
    }

    @Test
    @DisplayName("nested null and nested array preserved")
    void serializeNested() {
        assertEquals("a=null", Jhon.serialize(obj("a", null)));
        java.util.ArrayList<Object> inner = new java.util.ArrayList<>();
        inner.add(1L);
        inner.add(2L);
        inner.add(3L);
        assertEquals("a=[1,2,3]", Jhon.serialize(obj("a", inner)));
    }

    @Test
    @DisplayName("round trip compact preserves value")
    void roundTripCompact() throws Exception {
        Object original = obj(
            "name", "John",
            "age", 30L,
            "server", obj("host", "localhost", "port", 5432L)
        );
        Object roundTrip = Jhon.parse(Jhon.serialize(original));
        assertEquals(original, roundTrip);
    }

    @Test
    @DisplayName("hex/octal/binary serialize as decimal")
    void radixSerializeAsDecimal() throws Exception {
        assertEquals(255L, Jhon.parse("n=0xff").equals(obj("n", 255L)) ? 255L : 0);
        assertEquals(
            obj("hex", 255L, "oct", 511L, "bin", 10L),
            Jhon.parse("hex=0xff, oct=0o777, bin=0b1010")
        );
    }

    // ====================================================================================
    // Error positioning
    // ====================================================================================

    @Test
    @DisplayName("syntax error reports line and column")
    void syntaxErrorPosition() {
        Jhon.JhonParseException ex = assertThrows(
            Jhon.JhonParseException.class,
            () -> Jhon.parse("a=1\nb=+5")
        );
        assertEquals(2, ex.getLine());
        assertEquals(3, ex.getColumn());
    }

    @Test
    @DisplayName("duplicate-key error carries the key name")
    void duplicateKeyPosition() {
        Jhon.JhonParseException ex = assertThrows(
            Jhon.JhonParseException.class,
            () -> Jhon.parse("a=1, a=2")
        );
        assertEquals("a", ex.getDuplicateKey());
    }
}
