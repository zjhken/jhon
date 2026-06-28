package jhon

import (
	"reflect"
	"testing"
)

// ============================================================================
// §2 document form
// ============================================================================

func TestEmptyInput(t *testing.T) {
	v, err := Parse("")
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if v != nil {
		t.Fatalf("expected nil (Empty form), got %#v", v)
	}
}

func TestWhitespaceOnlyInput(t *testing.T) {
	v, err := Parse("   \n\t\r\n  ")
	if err != nil {
		t.Fatal(err)
	}
	if v != nil {
		t.Fatalf("expected nil, got %#v", v)
	}
}

func TestCommentsOnlyInput(t *testing.T) {
	v, err := Parse("// just a comment\n/* block */")
	if err != nil {
		t.Fatal(err)
	}
	if v != nil {
		t.Fatalf("expected nil, got %#v", v)
	}
}

func TestTopLevelObjectWithoutBraces(t *testing.T) {
	v, err := Parse(`name="x",port=80`)
	if err != nil {
		t.Fatal(err)
	}
	want := Object{"name": "x", "port": int64(80)}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestTopLevelObjectWithBracesIsSingleElementArray(t *testing.T) {
	// Per SPEC §2: top-level `{...}` is one element of the implicit array.
	v, err := Parse(`{name="x",port=80}`)
	if err != nil {
		t.Fatal(err)
	}
	want := Array{Object{"name": "x", "port": int64(80)}}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestTopLevelExplicitArrayIsSingleElementArray(t *testing.T) {
	// Per SPEC §2: top-level `[...]` is one element of the implicit array.
	v, err := Parse("[1, 2, 3]")
	if err != nil {
		t.Fatal(err)
	}
	want := Array{Array{int64(1), int64(2), int64(3)}}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestTopLevelScalarNumber(t *testing.T) {
	v, err := Parse("42")
	if err != nil {
		t.Fatal(err)
	}
	want := Array{int64(42)}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestTopLevelScalarString(t *testing.T) {
	v, err := Parse(`"hello"`)
	if err != nil {
		t.Fatal(err)
	}
	want := Array{"hello"}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestTopLevelScalarBoolean(t *testing.T) {
	v1, err := Parse("true")
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v1, Array{true}) {
		t.Fatalf("got %#v", v1)
	}
	v2, err := Parse("false")
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v2, Array{false}) {
		t.Fatalf("got %#v", v2)
	}
}

func TestTopLevelScalarNull(t *testing.T) {
	v, err := Parse("null")
	if err != nil {
		t.Fatal(err)
	}
	want := Array{nil}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestTopLevelMultipleScalarsNewlineSeparated(t *testing.T) {
	v, err := Parse("1\n2\n3")
	if err != nil {
		t.Fatal(err)
	}
	want := Array{int64(1), int64(2), int64(3)}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestTopLevelMultipleScalarsCommaSeparated(t *testing.T) {
	v, err := Parse(`1,2,"haha"`)
	if err != nil {
		t.Fatal(err)
	}
	want := Array{int64(1), int64(2), "haha"}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestTopLevelMixedScalarsAndObject(t *testing.T) {
	// The example from the spec change request.
	v, err := Parse("1\n2\n\"haha\"\n{a=4}")
	if err != nil {
		t.Fatal(err)
	}
	want := Array{int64(1), int64(2), "haha", Object{"a": int64(4)}}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestTopLevelMultipleObjects(t *testing.T) {
	v, err := Parse("{a=1}\n{b=2}")
	if err != nil {
		t.Fatal(err)
	}
	want := Array{Object{"a": int64(1)}, Object{"b": int64(2)}}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestTopLevelKeywordAsKeyIsObjectMode(t *testing.T) {
	// `true`, `false`, `null` in key position are strings.
	v, err := Parse("true=1")
	if err != nil {
		t.Fatal(err)
	}
	want := Object{"true": int64(1)}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestTopLevelNumericKeyIsObjectMode(t *testing.T) {
	v, err := Parse(`42="x"`)
	if err != nil {
		t.Fatal(err)
	}
	want := Object{"42": "x"}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestTopLevelQuotedStringKeyIsObjectMode(t *testing.T) {
	v, err := Parse(`"key"="value"`)
	if err != nil {
		t.Fatal(err)
	}
	want := Object{"key": "value"}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestTopLevelMixedPairThenScalarIsError(t *testing.T) {
	if _, err := Parse("a=1\n2"); err == nil {
		t.Fatal("expected error")
	}
}

func TestTopLevelMixedScalarThenPairIsError(t *testing.T) {
	if _, err := Parse("1\na=2"); err == nil {
		t.Fatal("expected error")
	}
}

func TestTopLevelArrayFollowedByPairsIsError(t *testing.T) {
	if _, err := Parse("[1, 2] key=value"); err == nil {
		t.Fatal("expected error")
	}
}

// ============================================================================
// §3.2 comments
// ============================================================================

func TestSingleLineCommentTrailing(t *testing.T) {
	v, err := Parse(`key="value" // trailing comment`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"key": "value"}) {
		t.Fatalf("got %#v", v)
	}
}

func TestBlockCommentInline(t *testing.T) {
	v, err := Parse(`key=/* inline */"value"`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"key": "value"}) {
		t.Fatalf("got %#v", v)
	}
}

func TestBlockCommentSpanningLines(t *testing.T) {
	v, err := Parse("key=/* spans\nmultiple\nlines */\"value\"")
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"key": "value"}) {
		t.Fatalf("got %#v", v)
	}
}

func TestUnterminatedBlockCommentIsError(t *testing.T) {
	if _, err := Parse("key=/* unterminated"); err == nil {
		t.Fatal("expected error")
	}
}

// ============================================================================
// §3.3 bare keys
// ============================================================================

func TestSimpleIdentifierKey(t *testing.T) {
	v, err := Parse(`keyname="value"`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"keyname": "value"}) {
		t.Fatalf("got %#v", v)
	}
}

func TestKeywordTrueAsKey(t *testing.T) {
	v, err := Parse(`true="yes"`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"true": "yes"}) {
		t.Fatalf("got %#v", v)
	}
}

func TestKeywordFalseAsKey(t *testing.T) {
	v, err := Parse(`false="no"`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"false": "no"}) {
		t.Fatalf("got %#v", v)
	}
}

func TestKeywordNullAsKey(t *testing.T) {
	v, err := Parse(`null="nothing"`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"null": "nothing"}) {
		t.Fatalf("got %#v", v)
	}
}

func TestKeyWithHyphen(t *testing.T) {
	v, err := Parse(`my-key="value"`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"my-key": "value"}) {
		t.Fatalf("got %#v", v)
	}
}

func TestKeyWithDot(t *testing.T) {
	v, err := Parse(`app.version=1`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"app.version": int64(1)}) {
		t.Fatalf("got %#v", v)
	}
}

func TestUnicodeKey(t *testing.T) {
	v, err := Parse(`日本語="value"`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"日本語": "value"}) {
		t.Fatalf("got %#v", v)
	}
}

func TestQuotedKeyWithSpaces(t *testing.T) {
	v, err := Parse(`"quoted key"="value"`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"quoted key": "value"}) {
		t.Fatalf("got %#v", v)
	}
}

// ============================================================================
// §3.4 strings
// ============================================================================

func TestDoubleQuotedString(t *testing.T) {
	v, err := Parse(`key="value"`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"key": "value"}) {
		t.Fatalf("got %#v", v)
	}
}

func TestSingleQuotedString(t *testing.T) {
	v, err := Parse(`key='value'`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"key": "value"}) {
		t.Fatalf("got %#v", v)
	}
}

func TestStringEscapeNewlineAndTab(t *testing.T) {
	v, err := Parse(`newline="hello\nworld",tab="tab\there"`)
	if err != nil {
		t.Fatal(err)
	}
	want := Object{"newline": "hello\nworld", "tab": "tab\there"}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestStringEscapeUnicode(t *testing.T) {
	v, err := Parse(`copy="©"`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"copy": "©"}) {
		t.Fatalf("got %#v", v)
	}
}

func TestStringEscapeQuoteAndBackslash(t *testing.T) {
	v, err := Parse(`q="say \"hi\"",bs="a\\b"`)
	if err != nil {
		t.Fatal(err)
	}
	want := Object{"q": `say "hi"`, "bs": `a\b`}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestRawStringBasic(t *testing.T) {
	v, err := Parse(`path=r"C:\Windows\System32"`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"path": `C:\Windows\System32`}) {
		t.Fatalf("got %#v", v)
	}
}

func TestRawStringWithHashes(t *testing.T) {
	v, err := Parse(`q=r#"contains "quotes""#`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"q": `contains "quotes"`}) {
		t.Fatalf("got %#v", v)
	}
}

func TestUnrecognizedEscapeIsError(t *testing.T) {
	if _, err := Parse(`key="value\q"`); err == nil {
		t.Fatal("expected error")
	}
}

func TestUnterminatedStringIsError(t *testing.T) {
	if _, err := Parse(`key="unterminated`); err == nil {
		t.Fatal("expected error")
	}
}

// ============================================================================
// §3.5 numbers
// ============================================================================

func TestDecimalInteger(t *testing.T) {
	v, err := Parse(`n=42`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"n": int64(42)}) {
		t.Fatalf("got %#v", v)
	}
}

func TestNegativeInteger(t *testing.T) {
	v, err := Parse(`n=-5`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"n": int64(-5)}) {
		t.Fatalf("got %#v", v)
	}
}

func TestNumberWithUnderscores(t *testing.T) {
	v, err := Parse(`n=1_000_000`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"n": int64(1_000_000)}) {
		t.Fatalf("got %#v", v)
	}
}

func TestFloatFractional(t *testing.T) {
	v, err := Parse(`n=12.5`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"n": 12.5}) {
		t.Fatalf("got %#v", v)
	}
}

func TestFloatWithExponentOnly(t *testing.T) {
	v, err := Parse(`n=1e10`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"n": 1e10}) {
		t.Fatalf("got %#v", v)
	}
}

func TestFloatWithFractionalAndExponent(t *testing.T) {
	v, err := Parse(`n=1.5E-3`)
	if err != nil {
		t.Fatal(err)
	}
	want := Object{"n": 1.5e-3}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestHexLiteralLowercase(t *testing.T) {
	v, err := Parse(`n=0xff`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"n": int64(255)}) {
		t.Fatalf("got %#v", v)
	}
}

func TestHexLiteralUppercaseDigits(t *testing.T) {
	v, err := Parse(`n=0xDE_AD`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"n": int64(0xDE_AD)}) {
		t.Fatalf("got %#v", v)
	}
}

func TestOctalLiteral(t *testing.T) {
	v, err := Parse(`n=0o777`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"n": int64(0o777)}) {
		t.Fatalf("got %#v", v)
	}
}

func TestBinaryLiteral(t *testing.T) {
	v, err := Parse(`n=0b1010`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"n": int64(0b1010)}) {
		t.Fatalf("got %#v", v)
	}
}

func TestNegativeHexLiteral(t *testing.T) {
	v, err := Parse(`n=-0xff`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"n": int64(-255)}) {
		t.Fatalf("got %#v", v)
	}
}

func TestPositiveWithPlusPrefixIsError(t *testing.T) {
	if _, err := Parse(`n=+5`); err == nil {
		t.Fatal("expected error")
	}
}

func TestUppercaseHexPrefixIsError(t *testing.T) {
	if _, err := Parse(`n=0Xff`); err == nil {
		t.Fatal("expected error")
	}
}

func TestUppercaseOctalPrefixIsError(t *testing.T) {
	if _, err := Parse(`n=0O77`); err == nil {
		t.Fatal("expected error")
	}
}

func TestUppercaseBinaryPrefixIsError(t *testing.T) {
	if _, err := Parse(`n=0B10`); err == nil {
		t.Fatal("expected error")
	}
}

func TestNumberTypeSuffixIsError(t *testing.T) {
	if _, err := Parse(`n=5u8`); err == nil {
		t.Fatal("expected error")
	}
}

func TestLeadingUnderscoreIsError(t *testing.T) {
	if _, err := Parse(`n=_5`); err == nil {
		t.Fatal("expected error")
	}
}

func TestTrailingUnderscoreIsError(t *testing.T) {
	if _, err := Parse(`n=5_`); err == nil {
		t.Fatal("expected error")
	}
}

func TestAdjacentUnderscoresAreError(t *testing.T) {
	if _, err := Parse(`n=5__5`); err == nil {
		t.Fatal("expected error")
	}
}

// ============================================================================
// §5 objects
// ============================================================================

func TestBasicKeyValuePairs(t *testing.T) {
	v, err := Parse(`name="John",age=30,active=true`)
	if err != nil {
		t.Fatal(err)
	}
	want := Object{"name": "John", "age": int64(30), "active": true}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestNestedObject(t *testing.T) {
	v, err := Parse(`server={host="localhost", port=8080}`)
	if err != nil {
		t.Fatal(err)
	}
	want := Object{"server": Object{"host": "localhost", "port": int64(8080)}}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestWhitespaceAroundEqualsInsignificant(t *testing.T) {
	v, err := Parse(`a=1, b = 2 , c=3`)
	if err != nil {
		t.Fatal(err)
	}
	want := Object{"a": int64(1), "b": int64(2), "c": int64(3)}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestDuplicateKeysAtTopLevelAreError(t *testing.T) {
	if _, err := Parse(`a=1, a=2`); err == nil {
		t.Fatal("expected error")
	}
}

func TestDuplicateKeysInNestedObjectAreError(t *testing.T) {
	if _, err := Parse(`outer={a=1, a=2}`); err == nil {
		t.Fatal("expected error")
	}
}

// ============================================================================
// §5.3 separators
// ============================================================================

func TestSameLineCommaSeparated(t *testing.T) {
	v, err := Parse(`a=1, b=2, c=3`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"a": int64(1), "b": int64(2), "c": int64(3)}) {
		t.Fatalf("got %#v", v)
	}
}

func TestNewlineSeparatedMultiline(t *testing.T) {
	v, err := Parse("a=1\nb=2\nc=3")
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"a": int64(1), "b": int64(2), "c": int64(3)}) {
		t.Fatalf("got %#v", v)
	}
}

func TestTrailingCommaAtTopLevel(t *testing.T) {
	v, err := Parse(`a=1, b=2,`)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(v, Object{"a": int64(1), "b": int64(2)}) {
		t.Fatalf("got %#v", v)
	}
}

func TestSameLineSpaceOnlySeparatorIsError(t *testing.T) {
	if _, err := Parse(`a=1 b=2`); err == nil {
		t.Fatal("expected error")
	}
}

func TestSameLineTabOnlySeparatorIsError(t *testing.T) {
	if _, err := Parse("a=1\tb=2"); err == nil {
		t.Fatal("expected error")
	}
}

// ============================================================================
// §6 arrays
// ============================================================================

func TestEmptyArray(t *testing.T) {
	v, err := Parse(`items=[]`)
	if err != nil {
		t.Fatal(err)
	}
	want := Object{"items": Array{}}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestArrayOfStrings(t *testing.T) {
	v, err := Parse(`items=["a", "b", "c"]`)
	if err != nil {
		t.Fatal(err)
	}
	want := Object{"items": Array{"a", "b", "c"}}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestArrayMixedTypes(t *testing.T) {
	v, err := Parse(`mixed=[1, "two", true, null]`)
	if err != nil {
		t.Fatal(err)
	}
	want := Object{"mixed": Array{int64(1), "two", true, nil}}
	if !reflect.DeepEqual(v, want) {
		t.Fatalf("got %#v want %#v", v, want)
	}
}

func TestUnbalancedArrayIsError(t *testing.T) {
	if _, err := Parse(`[1, 2, 3`); err == nil {
		t.Fatal("expected error")
	}
}

func TestUnbalancedBracesAreError(t *testing.T) {
	if _, err := Parse(`{a=1, b=2`); err == nil {
		t.Fatal("expected error")
	}
}

// ============================================================================
// §7 serialization
// ============================================================================

func TestCompactSerializeNoSpacesAroundEquals(t *testing.T) {
	got := SerializeWithOptions(Object{"name": "John", "age": int64(30)}, SerializeOptions{SortKeys: true})
	if got != `age=30,name="John"` {
		t.Fatalf("got %q", got)
	}
}

func TestCompactSerializeNestedObject(t *testing.T) {
	got := SerializeWithOptions(
		Object{"server": Object{"host": "localhost", "port": int64(8080)}},
		SerializeOptions{SortKeys: true},
	)
	if got != `server={host="localhost",port=8080}` {
		t.Fatalf("got %q", got)
	}
}

func TestCompactSerializeTopLevelArray(t *testing.T) {
	// Top-level arrays serialize bare (no surrounding []).
	got := Serialize(Array{Object{"a": int64(1)}, Object{"b": int64(2)}})
	if got != `{a=1},{b=2}` {
		t.Fatalf("got %q", got)
	}
}

func TestPrettySerializeSpacesAroundEqualsNoTrailingCommas(t *testing.T) {
	got := SerializeWithOptions(
		Object{"name": "John", "age": int64(30)},
		SerializeOptions{SortKeys: true, Indent: "  "},
	)
	want := "age = 30\nname = \"John\""
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestPrettySerializeNestedObject(t *testing.T) {
	got := SerializeWithOptions(
		Object{"server": Object{"host": "localhost", "port": int64(5432)}},
		SerializeOptions{SortKeys: true, Indent: "  "},
	)
	want := "server = {\n  host = \"localhost\"\n  port = 5432\n}"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestPrettySerializeArrayNoTrailingCommas(t *testing.T) {
	// Top-level arrays serialize bare: one element per line, no [].
	got := SerializePretty(Array{int64(1), int64(2), int64(3)}, "  ")
	want := "1\n2\n3"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestSerializeTopLevelArrayWithObject(t *testing.T) {
	got := Serialize(Array{int64(1), Object{"a": int64(2)}})
	if got != `1,{a=2}` {
		t.Fatalf("got %q", got)
	}
}

func TestSerializeEmptyObjectToEmptyString(t *testing.T) {
	if got := Serialize(Object{}); got != "" {
		t.Fatalf("got %q", got)
	}
}

func TestSerializeEmptyArrayToEmptyString(t *testing.T) {
	if got := Serialize(Array{}); got != "" {
		t.Fatalf("got %q", got)
	}
}

func TestSerializeTopLevelNilToEmptyString(t *testing.T) {
	if got := Serialize(nil); got != "" {
		t.Fatalf("got %q", got)
	}
}

func TestSerializeNestedNullPreserved(t *testing.T) {
	got := Serialize(Object{"a": nil})
	if got != "a=null" {
		t.Fatalf("got %q", got)
	}
}

func TestSerializeNestedArrayPreserved(t *testing.T) {
	got := Serialize(Object{"a": Array{int64(1), int64(2), int64(3)}})
	if got != "a=[1,2,3]" {
		t.Fatalf("got %q", got)
	}
}

func TestRoundTripCompactPreservesValue(t *testing.T) {
	original := Object{
		"name": "John",
		"age":  int64(30),
		"server": Object{
			"host": "localhost",
			"port": int64(5432),
		},
	}
	roundTrip, err := Parse(SerializeWithOptions(original, SerializeOptions{SortKeys: true}))
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(roundTrip, original) {
		t.Fatalf("got %#v want %#v", roundTrip, original)
	}
}

func TestHexOctalBinarySerializeAsDecimal(t *testing.T) {
	got := SerializeWithOptions(
		Object{"hex": int64(0xff), "oct": int64(0o777), "bin": int64(0b1010)},
		SerializeOptions{SortKeys: true},
	)
	if got != `bin=10,hex=255,oct=511` {
		t.Fatalf("got %q", got)
	}
}

// ============================================================================
// Error positioning
// ============================================================================

func TestSyntaxErrorReportsLineAndColumn(t *testing.T) {
	_, err := Parse("a=1\nb=+5")
	if err == nil {
		t.Fatal("expected error")
	}
	pe, ok := err.(*ParseError)
	if !ok {
		t.Fatalf("expected *ParseError, got %T", err)
	}
	if pe.Line != 2 || pe.Column != 3 {
		t.Fatalf("got line %d col %d, want 2:3", pe.Line, pe.Column)
	}
}

func TestDuplicateKeyErrorReportsKey(t *testing.T) {
	_, err := Parse(`a=1, a=2`)
	if err == nil {
		t.Fatal("expected error")
	}
	pe, ok := err.(*ParseError)
	if !ok {
		t.Fatalf("expected *ParseError, got %T", err)
	}
	if pe.Kind != ParseErrorDuplicateKey {
		t.Fatalf("got kind %v", pe.Kind)
	}
	if pe.Key != "a" {
		t.Fatalf("got key %q", pe.Key)
	}
}
