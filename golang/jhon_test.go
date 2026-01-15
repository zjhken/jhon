package jhon

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"
)

// =============================================================================
// Basic Parsing Tests
// =============================================================================

func TestEmptyInput(t *testing.T) {
	result, err := Parse("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.(Object)) != 0 {
		t.Errorf("expected empty object, got %v", result)
	}
}

func TestBasicKeyValue(t *testing.T) {
	result, err := Parse(`a="hello", b=123.45`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj, ok := result.(Object)
	if !ok {
		t.Fatalf("expected Object, got %T", result)
	}

	if obj["a"] != "hello" {
		t.Errorf("expected a='hello', got %v", obj["a"])
	}
	if obj["b"] != 123.45 {
		t.Errorf("expected b=123.45, got %v", obj["b"])
	}
}

func TestStringTypes(t *testing.T) {
	result, err := Parse(`"quoted key"="value", unquoted_key="another"`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	if obj["quoted key"] != "value" {
		t.Errorf("expected 'quoted key'='value', got %v", obj["quoted key"])
	}
	if obj["unquoted_key"] != "another" {
		t.Errorf("expected 'unquoted_key'='another', got %v", obj["unquoted_key"])
	}
}

func TestStringValues(t *testing.T) {
	result, err := Parse(`text="simple string", empty="", spaces="  with  spaces  "`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	if obj["text"] != "simple string" {
		t.Errorf("expected 'text'='simple string', got %v", obj["text"])
	}
	if obj["empty"] != "" {
		t.Errorf("expected 'empty'='', got %v", obj["empty"])
	}
	if obj["spaces"] != "  with  spaces  " {
		t.Errorf("expected 'spaces'='  with  spaces  ', got %v", obj["spaces"])
	}
}

func TestStringEscaping(t *testing.T) {
	result, err := Parse(`
		newline="hello\nworld",
		tab="tab\there",
		backslash="path\\to\\file",
		quote="say \"hello\"",
		carriage_return="line1\rline2"
	`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	expectedNewline := "hello\nworld"
	expectedTab := "tab\there"
	expectedBackslash := "path\\to\\file"
	expectedQuote := `say "hello"`
	expectedCR := "line1\rline2"

	if obj["newline"] != expectedNewline {
		t.Errorf("expected newline=%q, got %q", expectedNewline, obj["newline"])
	}
	if obj["tab"] != expectedTab {
		t.Errorf("expected tab=%q, got %q", expectedTab, obj["tab"])
	}
	if obj["backslash"] != expectedBackslash {
		t.Errorf("expected backslash=%q, got %q", expectedBackslash, obj["backslash"])
	}
	if obj["quote"] != expectedQuote {
		t.Errorf("expected quote=%q, got %q", expectedQuote, obj["quote"])
	}
	if obj["carriage_return"] != expectedCR {
		t.Errorf("expected carriage_return=%q, got %q", expectedCR, obj["carriage_return"])
	}
}

func TestUnicodeEscape(t *testing.T) {
	result, err := Parse(`unicode="Hello\u00A9World"`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	expected := "Hello©World"
	if obj["unicode"] != expected {
		t.Errorf("expected unicode=%q, got %q", expected, obj["unicode"])
	}
}

func TestNumbers(t *testing.T) {
	result, err := Parse(`int=42, float=3.14, negative=-123, negative_float=-45.67`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	if obj["int"] != 42.0 {
		t.Errorf("expected int=42.0, got %v", obj["int"])
	}
	if obj["float"] != 3.14 {
		t.Errorf("expected float=3.14, got %v", obj["float"])
	}
	if obj["negative"] != -123.0 {
		t.Errorf("expected negative=-123.0, got %v", obj["negative"])
	}
	if obj["negative_float"] != -45.67 {
		t.Errorf("expected negative_float=-45.67, got %v", obj["negative_float"])
	}
}

func TestNumbersWithUnderscores(t *testing.T) {
	result, err := Parse(`large=100_000, million=1_000_000, decimal=1_234.567_890, neg_large=-50_000`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	if obj["large"] != 100000.0 {
		t.Errorf("expected large=100000.0, got %v", obj["large"])
	}
	if obj["million"] != 1000000.0 {
		t.Errorf("expected million=1000000.0, got %v", obj["million"])
	}
	if obj["decimal"] != 1234.56789 {
		t.Errorf("expected decimal=1234.56789, got %v", obj["decimal"])
	}
	if obj["neg_large"] != -50000.0 {
		t.Errorf("expected neg_large=-50000.0, got %v", obj["neg_large"])
	}
}

func TestBooleans(t *testing.T) {
	result, err := Parse(`truth=true, falsehood=false`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	if obj["truth"] != true {
		t.Errorf("expected truth=true, got %v", obj["truth"])
	}
	if obj["falsehood"] != false {
		t.Errorf("expected falsehood=false, got %v", obj["falsehood"])
	}
}

func TestNullValue(t *testing.T) {
	result, err := Parse(`empty=null`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	if obj["empty"] != nil {
		t.Errorf("expected empty=null, got %v", obj["empty"])
	}
}

func TestEmptyArrays(t *testing.T) {
	result, err := Parse(`empty=[]`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	arr, ok := obj["empty"].(Array)
	if !ok {
		t.Fatalf("expected Array, got %T", obj["empty"])
	}
	if len(arr) != 0 {
		t.Errorf("expected empty array, got %v", arr)
	}
}

func TestArraysWithStrings(t *testing.T) {
	result, err := Parse(`strings=["hello", "world", "test"]`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	arr := obj["strings"].(Array)
	if len(arr) != 3 {
		t.Fatalf("expected array of length 3, got %d", len(arr))
	}
	if arr[0] != "hello" || arr[1] != "world" || arr[2] != "test" {
		t.Errorf("unexpected array values: %v", arr)
	}
}

func TestArraysWithNumbers(t *testing.T) {
	result, err := Parse(`numbers=[1, 2.5, -3, 4.0]`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	arr := obj["numbers"].(Array)
	expected := []float64{1, 2.5, -3, 4}
	for i, v := range arr {
		if v != expected[i] {
			t.Errorf("expected arr[%d]=%v, got %v", i, expected[i], v)
		}
	}
}

func TestArraysWithMixedTypes(t *testing.T) {
	result, err := Parse(`mixed=["hello", 123, true, null, 45.6]`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	arr := obj["mixed"].(Array)
	if len(arr) != 5 {
		t.Fatalf("expected array of length 5, got %d", len(arr))
	}
	if arr[0] != "hello" {
		t.Errorf("expected arr[0]='hello', got %v", arr[0])
	}
	if arr[1] != 123.0 {
		t.Errorf("expected arr[1]=123.0, got %v", arr[1])
	}
	if arr[2] != true {
		t.Errorf("expected arr[2]=true, got %v", arr[2])
	}
	if arr[3] != nil {
		t.Errorf("expected arr[3]=null, got %v", arr[3])
	}
	if arr[4] != 45.6 {
		t.Errorf("expected arr[4]=45.6, got %v", arr[4])
	}
}

func TestMultiline(t *testing.T) {
	result, err := Parse(`
		name = "test",
		age = 25,
		active = true,
		tags = ["tag1", "tag2"],
		score = 98.5
	`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	if obj["name"] != "test" {
		t.Errorf("expected name='test', got %v", obj["name"])
	}
	if obj["age"] != 25.0 {
		t.Errorf("expected age=25.0, got %v", obj["age"])
	}
	if obj["active"] != true {
		t.Errorf("expected active=true, got %v", obj["active"])
	}
}

func TestSingleLineComments(t *testing.T) {
	result, err := Parse(`
		// This is a comment
		name = "test"  // inline comment
		age = 25
		// Another comment
		active = true
	`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	if obj["name"] != "test" {
		t.Errorf("expected name='test', got %v", obj["name"])
	}
	if obj["age"] != 25.0 {
		t.Errorf("expected age=25.0, got %v", obj["age"])
	}
	if obj["active"] != true {
		t.Errorf("expected active=true, got %v", obj["active"])
	}
}

func TestMultilineComments(t *testing.T) {
	result, err := Parse(`
		/* This is a
		   multiline comment */
		name = "test"
		/* Another comment */
		age = 25
	`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	if obj["name"] != "test" {
		t.Errorf("expected name='test', got %v", obj["name"])
	}
	if obj["age"] != 25.0 {
		t.Errorf("expected age=25.0, got %v", obj["age"])
	}
}

func TestTrailingCommas(t *testing.T) {
	result, err := Parse(`name="test", age=25, `)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	if obj["name"] != "test" || obj["age"] != 25.0 {
		t.Errorf("unexpected values: %v", obj)
	}
}

func TestArrayTrailingCommas(t *testing.T) {
	result, err := Parse(`items=["apple", "banana", "cherry", ]`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	arr := obj["items"].(Array)
	if len(arr) != 3 {
		t.Fatalf("expected array of length 3, got %d", len(arr))
	}
}

func TestNestedObjects(t *testing.T) {
	result, err := Parse(`server={host="localhost", port=8080}`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	server, ok := obj["server"].(Object)
	if !ok {
		t.Fatalf("expected server to be Object, got %T", obj["server"])
	}
	if server["host"] != "localhost" {
		t.Errorf("expected host='localhost', got %v", server["host"])
	}
	if server["port"] != 8080.0 {
		t.Errorf("expected port=8080.0, got %v", server["port"])
	}
}

func TestRawStrings(t *testing.T) {
	result, err := Parse(`path=r"C:\Windows\System32"`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	expected := `C:\Windows\System32`
	if obj["path"] != expected {
		t.Errorf("expected path=%q, got %q", expected, obj["path"])
	}
}

func TestRawStringsWithHashes(t *testing.T) {
	result, err := Parse(`contains_hash=r#"This has a " quote in it"#`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	expected := `This has a " quote in it`
	if obj["contains_hash"] != expected {
		t.Errorf("expected contains_hash=%q, got %q", expected, obj["contains_hash"])
	}
}

func TestSingleQuotedStrings(t *testing.T) {
	result, err := Parse(`name='John', greeting='Hello'`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	if obj["name"] != "John" {
		t.Errorf("expected name='John', got %v", obj["name"])
	}
	if obj["greeting"] != "Hello" {
		t.Errorf("expected greeting='Hello', got %v", obj["greeting"])
	}
}

func TestQuotesInsideStrings(t *testing.T) {
	result, err := Parse(`text='He said "hello" to me'`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	expected := `He said "hello" to me`
	if obj["text"] != expected {
		t.Errorf("expected text=%q, got %q", expected, obj["text"])
	}

	result2, err := Parse(`text="It's a beautiful day"`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj2 := result2.(Object)
	expected2 := "It's a beautiful day"
	if obj2["text"] != expected2 {
		t.Errorf("expected text=%q, got %q", expected2, obj2["text"])
	}
}

func TestQuotedKeysWithSpaces(t *testing.T) {
	result, err := Parse(`"my key"="value", "another key"="test"`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	if obj["my key"] != "value" {
		t.Errorf("expected 'my key'='value', got %v", obj["my key"])
	}
	if obj["another key"] != "test" {
		t.Errorf("expected 'another key'='test', got %v", obj["another key"])
	}
}

func TestComplexNestedStructure(t *testing.T) {
	result, err := Parse(`
		server = {
			host = "localhost",
			port = 3000,
			middleware = [
				{name = "logger", enabled = true},
				{name = "cors", enabled = false}
			]
		}
	`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	server, ok := obj["server"].(Object)
	if !ok {
		t.Fatalf("expected server to be Object, got %T", obj["server"])
	}
	if server["host"] != "localhost" {
		t.Errorf("expected host='localhost', got %v", server["host"])
	}
	if server["port"] != 3000.0 {
		t.Errorf("expected port=3000.0, got %v", server["port"])
	}

	middleware, ok := server["middleware"].(Array)
	if !ok {
		t.Fatalf("expected middleware to be Array, got %T", server["middleware"])
	}
	if len(middleware) != 2 {
		t.Fatalf("expected middleware array of length 2, got %d", len(middleware))
	}

	m1 := middleware[0].(Object)
	if m1["name"] != "logger" {
		t.Errorf("expected m1 name='logger', got %v", m1["name"])
	}
	if m1["enabled"] != true {
		t.Errorf("expected m1 enabled=true, got %v", m1["enabled"])
	}

	m2 := middleware[1].(Object)
	if m2["name"] != "cors" {
		t.Errorf("expected m2 name='cors', got %v", m2["name"])
	}
	if m2["enabled"] != false {
		t.Errorf("expected m2 enabled=false, got %v", m2["enabled"])
	}
}

func TestDeeplyNestedObjects(t *testing.T) {
	result, err := Parse(`outer={inner={deep="value"} number=42}`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	outer := obj["outer"].(Object)
	inner := outer["inner"].(Object)

	if inner["deep"] != "value" {
		t.Errorf("expected deep='value', got %v", inner["deep"])
	}
	if outer["number"] != 42.0 {
		t.Errorf("expected number=42.0, got %v", outer["number"])
	}
}

func TestArraysInObjects(t *testing.T) {
	result, err := Parse(`data={items=[1, 2, 3] active=true}`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	obj := result.(Object)
	data := obj["data"].(Object)
	items := data["items"].(Array)

	if len(items) != 3 {
		t.Fatalf("expected items array of length 3, got %d", len(items))
	}
	if items[0] != 1.0 || items[1] != 2.0 || items[2] != 3.0 {
		t.Errorf("unexpected items values: %v", items)
	}
	if data["active"] != true {
		t.Errorf("expected active=true, got %v", data["active"])
	}
}

// =============================================================================
// Error Tests
// =============================================================================

func TestErrorUnterminatedString(t *testing.T) {
	_, err := Parse(`name="unclosed string`)
	if err == nil {
		t.Error("expected error for unterminated string, got nil")
	}
}

func TestErrorExpectedEquals(t *testing.T) {
	_, err := Parse(`name "value"`)
	if err == nil {
		t.Error("expected error for missing equals, got nil")
	}
}

func TestErrorUnterminatedArray(t *testing.T) {
	_, err := Parse(`items=[1, 2, 3`)
	if err == nil {
		t.Error("expected error for unterminated array, got nil")
	}
}

func TestErrorUnterminatedNestedObject(t *testing.T) {
	_, err := Parse(`server={host="localhost"`)
	if err == nil {
		t.Error("expected error for unterminated nested object, got nil")
	}
}

func TestErrorInvalidBoolean(t *testing.T) {
	_, err := Parse(`active=troo`)
	if err == nil {
		t.Error("expected error for invalid boolean, got nil")
	}
}

func TestErrorInvalidNull(t *testing.T) {
	_, err := Parse(`value=nul`)
	if err == nil {
		t.Error("expected error for invalid null, got nil")
	}
}

// =============================================================================
// Serialization Tests
// =============================================================================

func TestSerializeBasicObject(t *testing.T) {
	value := Object{"name": "John", "age": 30.0}
	result := Serialize(value)
	expected := "age=30,name=\"John\""
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

func TestSerializeEmptyObject(t *testing.T) {
	value := Object{}
	result := Serialize(value)
	if result != "" {
		t.Errorf("expected empty string, got %q", result)
	}
}

func TestSerializeString(t *testing.T) {
	result := Serialize("hello world")
	expected := `"hello world"`
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

func TestSerializeStringWithEscapes(t *testing.T) {
	result := Serialize("line1\nline2\ttab")
	expected := `"line1\nline2\ttab"`
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

func TestSerializeStringWithQuotes(t *testing.T) {
	result := Serialize(`He said "hello"`)
	expected := `"He said \"hello\""`
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

func TestSerializeNumbers(t *testing.T) {
	value := Object{"int": 42.0, "float": 3.14, "negative": -123.0}
	result := Serialize(value)
	expected := "float=3.14,int=42,negative=-123"
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

func TestSerializeBoolean(t *testing.T) {
	value := Object{"active": true, "inactive": false}
	result := Serialize(value)
	expected := "active=true,inactive=false"
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

func TestSerializeNull(t *testing.T) {
	value := Object{"empty": nil}
	result := Serialize(value)
	expected := "empty=null"
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

func TestSerializeArray(t *testing.T) {
	value := Array{1.0, 2.0, 3.0, "hello", true}
	result := Serialize(value)
	expected := "[1,2,3,\"hello\",true]"
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

func TestSerializeEmptyArray(t *testing.T) {
	result := Serialize(Array{})
	expected := "[]"
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

func TestSerializeNestedObject(t *testing.T) {
	value := Object{"server": Object{"host": "localhost", "port": 8080.0}}
	result := Serialize(value)
	expected := "server={host=\"localhost\",port=8080}"
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

func TestSerializeArrayWithObjects(t *testing.T) {
	value := Array{Object{"name": "John", "age": 30.0}, Object{"name": "Jane", "age": 25.0}}
	result := Serialize(value)
	expected := "[{age=30,name=\"John\"},{age=25,name=\"Jane\"}]"
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

func TestSerializeKeysWithSpecialChars(t *testing.T) {
	value := Object{"my key": "value1", "key@symbol": "value2"}
	result := Serialize(value)
	// Keys are sorted alphabetically
	expected := "\"key@symbol\"=\"value2\",\"my key\"=\"value1\""
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

func TestSerializeKeysWithHyphens(t *testing.T) {
	value := Object{"my-key": "value", "another_key": "test"}
	result := Serialize(value)
	expected := "another_key=\"test\",my-key=\"value\""
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

func TestSerializeRoundTripSimple(t *testing.T) {
	original := Object{"name": "John", "age": 30.0, "active": true}
	serialized := Serialize(original)
	parsed, err := Parse(serialized)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	parsedObj := parsed.(Object)
	if parsedObj["name"] != original["name"] {
		t.Errorf("round trip failed: name changed from %v to %v", original["name"], parsedObj["name"])
	}
	if parsedObj["age"] != original["age"] {
		t.Errorf("round trip failed: age changed from %v to %v", original["age"], parsedObj["age"])
	}
	if parsedObj["active"] != original["active"] {
		t.Errorf("round trip failed: active changed from %v to %v", original["active"], parsedObj["active"])
	}
}

func TestSerializeRoundTripComplex(t *testing.T) {
	original := Object{
		"app_name": "ocean-note",
		"version":  "2.0.0",
		"database": Object{
			"host":     "localhost",
			"port":     5432.0,
			"name":     "mydb",
			"ssl":      true,
			"timeout":  30.5,
		},
		"features": Array{"markdown", "collaboration", "real-time"},
	}

	serialized := Serialize(original)
	parsed, err := Parse(serialized)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	parsedObj := parsed.(Object)
	if parsedObj["app_name"] != original["app_name"] {
		t.Errorf("round trip failed: app_name changed")
	}
	if parsedObj["version"] != original["version"] {
		t.Errorf("round trip failed: version changed")
	}

	db := parsedObj["database"].(Object)
	originalDb := original["database"].(Object)
	if db["host"] != originalDb["host"] {
		t.Errorf("round trip failed: database.host changed")
	}
}

// =============================================================================
// Pretty Serialization Tests
// =============================================================================

func TestSerializePrettyBasicObject(t *testing.T) {
	value := Object{"name": "John", "age": 30.0}
	result := SerializeWithOptions(value, SerializeOptions{Pretty: true, Indent: "  "})
	expected := "age = 30,\nname = \"John\""
	if result != expected {
		t.Errorf("expected:\n%s\ngot:\n%s", expected, result)
	}
}

func TestSerializePrettyNestedObjects(t *testing.T) {
	value := Object{"server": Object{"host": "localhost", "port": 8080.0}}
	result := SerializeWithOptions(value, SerializeOptions{Pretty: true, Indent: "  "})
	expected := "server = {\n  host = \"localhost\",\n  port = 8080\n}"
	if result != expected {
		t.Errorf("expected:\n%s\ngot:\n%s", expected, result)
	}
}

func TestSerializePrettyArray(t *testing.T) {
	value := Array{1.0, 2.0, 3.0, "hello"}
	result := SerializeWithOptions(value, SerializeOptions{Pretty: true, Indent: "  "})
	expected := "[\n  1,\n  2,\n  3,\n  \"hello\"\n]"
	if result != expected {
		t.Errorf("expected:\n%s\ngot:\n%s", expected, result)
	}
}

func TestSerializePrettyArrayWithObjects(t *testing.T) {
	value := Array{
		Object{"name": "John", "age": 30.0},
		Object{"name": "Jane", "age": 25.0},
	}
	result := SerializeWithOptions(value, SerializeOptions{Pretty: true, Indent: "  "})
	expected := "[\n  {\n    age = 30,\n    name = \"John\"\n  },\n  {\n    age = 25,\n    name = \"Jane\"\n  }\n]"
	if result != expected {
		t.Errorf("expected:\n%s\ngot:\n%s", expected, result)
	}
}

func TestSerializePrettyDeeplyNested(t *testing.T) {
	value := Object{
		"database": Object{
			"credentials": Array{
				Object{"user": "admin", "role": "owner"},
				Object{"user": "reader", "role": "readonly"},
			},
		},
	}
	result := SerializeWithOptions(value, SerializeOptions{Pretty: true, Indent: "  "})
	expected := "database = {\n  credentials = [\n    {\n      role = \"owner\",\n      user = \"admin\"\n    },\n    {\n      role = \"readonly\",\n      user = \"reader\"\n    }\n  ]\n}"
	if result != expected {
		t.Errorf("expected:\n%s\ngot:\n%s", expected, result)
	}
}

func TestSerializePrettyRoundTrip(t *testing.T) {
	original := Object{
		"name":  "John",
		"age":   30.0,
		"active": true,
		"tags":  Array{"developer", "golang"},
	}

	serialized := SerializeWithOptions(original, SerializeOptions{Pretty: true, Indent: "  "})
	parsed, err := Parse(serialized)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	parsedObj := parsed.(Object)
	if parsedObj["name"] != original["name"] {
		t.Errorf("round trip failed: name changed")
	}
	if parsedObj["age"] != original["age"] {
		t.Errorf("round trip failed: age changed")
	}

	tags, ok := parsedObj["tags"].(Array)
	if !ok {
		t.Fatalf("expected tags to be Array, got %T", parsedObj["tags"])
	}
	if len(tags) != 2 || tags[0] != "developer" || tags[1] != "golang" {
		t.Errorf("round trip failed: tags changed: %v", tags)
	}
}

// =============================================================================
// JSON Integration Tests
// =============================================================================

func TestJSONMarshal(t *testing.T) {
	obj := Object{"name": "John", "age": 30.0, "active": true}

	data, err := json.Marshal(obj)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := `{"active":true,"age":30,"name":"John"}`
	if string(data) != expected {
		t.Errorf("expected %q, got %q", expected, string(data))
	}
}

func TestJSONUnmarshal(t *testing.T) {
	data := []byte(`{"name":"John","age":30,"active":true}`)

	var obj Object
	err := json.Unmarshal(data, &obj)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if obj["name"] != "John" {
		t.Errorf("expected name='John', got %v", obj["name"])
	}
	if obj["age"] != 30.0 {
		t.Errorf("expected age=30.0, got %v", obj["age"])
	}
	if obj["active"] != true {
		t.Errorf("expected active=true, got %v", obj["active"])
	}
}

func TestJSONRoundTrip(t *testing.T) {
	original := Object{
		"app_name": "ocean-note",
		"version":  "1.0.0",
		"debug":    true,
		"port":     3000.0,
		"features": Array{"markdown", "collaboration"},
	}

	// Marshal to JSON
	jsonData, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("unexpected error marshaling: %v", err)
	}

	// Unmarshal from JSON
	var unmarshaled Object
	err = json.Unmarshal(jsonData, &unmarshaled)
	if err != nil {
		t.Fatalf("unexpected error unmarshaling: %v", err)
	}

	// Verify
	if unmarshaled["app_name"] != original["app_name"] {
		t.Errorf("JSON round trip failed: app_name changed")
	}
	if unmarshaled["version"] != original["version"] {
		t.Errorf("JSON round trip failed: version changed")
	}

	// JSON unmarshals arrays as []interface{}, need to handle both types
	features, ok := unmarshaled["features"].(Array)
	if !ok {
		// Try as []interface{}
		slice, ok := unmarshaled["features"].([]interface{})
		if !ok {
			t.Fatalf("expected features to be Array or []interface{}, got %T", unmarshaled["features"])
		}
		if len(slice) != 2 {
			t.Errorf("JSON round trip failed: features length changed")
		}
		if slice[0] != "markdown" || slice[1] != "collaboration" {
			t.Errorf("JSON round trip failed: features values changed")
		}
		return
	}
	if len(features) != 2 {
		t.Errorf("JSON round trip failed: features length changed")
	}
}

// =============================================================================
// Example File Test
// =============================================================================

func TestExampleFile(t *testing.T) {
	// Read the example.jhon file
	content, err := os.ReadFile("../vscode-ext/examples/example.jhon")
	if err != nil {
		t.Skip("example file not found")
	}

	result, err := Parse(string(content))
	if err != nil {
		t.Fatalf("unexpected error parsing example file: %v", err)
	}

	obj := result.(Object)

	// Verify some expected values
	if obj["app_name"] != "ocean-note" {
		t.Errorf("expected app_name='ocean-note', got %v", obj["app_name"])
	}
	if obj["version"] != "1.0.0" {
		t.Errorf("expected version='1.0.0', got %v", obj["version"])
	}
	if obj["debug"] != true {
		t.Errorf("expected debug=true, got %v", obj["debug"])
	}

	// Check database config
	db, ok := obj["database"].(Object)
	if !ok {
		t.Fatal("expected database to be Object")
	}
	if db["host"] != "localhost" {
		t.Errorf("expected database.host='localhost', got %v", db["host"])
	}
	if db["port"] != 5432.0 {
		t.Errorf("expected database.port=5432.0, got %v", db["port"])
	}

	// Check features
	features, ok := obj["features"].(Array)
	if !ok {
		t.Fatal("expected features to be Array")
	}
	if len(features) != 3 {
		t.Errorf("expected 3 features, got %d", len(features))
	}

	// Check server config with nested middleware array
	server, ok := obj["server"].(Object)
	if !ok {
		t.Fatal("expected server to be Object")
	}
	middleware, ok := server["middleware"].(Array)
	if !ok {
		t.Fatal("expected server.middleware to be Array")
	}
	if len(middleware) != 2 {
		t.Errorf("expected 2 middleware items, got %d", len(middleware))
	}

	// Verify raw string handling
	if obj["windows_path"] != `C:\Windows\System32` {
		t.Errorf("expected windows_path=C:\\Windows\\System32, got %v", obj["windows_path"])
	}
}

// =============================================================================
// Helper Functions for Tests
// =============================================================================

func ExampleParse() {
	result, err := Parse(`name="John" age=30`)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	fmt.Println(result)
	// Output: map[age:30 name:John]
}

func ExampleSerialize() {
	value := Object{"name": "John", "age": 30.0}
	jhonString := Serialize(value)
	fmt.Println(jhonString)
	// Output: age=30,name="John"
}
