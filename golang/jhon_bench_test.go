package jhon

import (
	"encoding/json"
	"fmt"
	"testing"
)

// =============================================================================
// Benchmark Data
// =============================================================================

// A small configuration
var smallJHON = `name="test" age=25 active=true`

// A small equivalent JSON
var smallJSON = `{"name":"test","age":25,"active":true}`

// A medium configuration
var mediumJHON = `
app_name="ocean-note"
version="1.0.0"
debug=true
database={host="localhost",port=5432,name="mydb"}
features=["markdown","collaboration","real-time"]
max_file_size=1048576
timeout=30.5
server={host="0.0.0.0",port=3000}
`

var mediumJSON = `{"app_name":"ocean-note","version":"1.0.0","debug":true,"database":{"host":"localhost","port":5432,"name":"mydb"},"features":["markdown","collaboration","real-time"],"max_file_size":1048576,"timeout":30.5,"server":{"host":"0.0.0.0","port":3000}}`

// A large configuration
var largeJHON = `
// Application Configuration
app_name="ocean-note"
version="2.0.0"
debug=true
log_level="info"

// Database Configuration
database={
	host="localhost",
	port=5432,
	name="mydb",
	pool_size=10,
	timeout=30.5,
	ssl_enabled=true,
	ssl_cert=null,
	credentials=[
		{user="admin",role="owner"},
		{user="reader",role="readonly"},
		{user="writer",role="readwrite"}
	]
}

// Server Configuration
server={
	host="0.0.0.0",
	port=3000,
	middleware=[
		{name="logger",enabled=true,config={level="info"}},
		{name="cors",enabled=false,config={}},
		{name="auth",enabled=true,config={strategy="jwt"}}
	]
}

// Features
features=[
	{name="markdown",active=true,settings={preview=true}},
	{name="collaboration",active=true,settings={realtime=true,max_users=100}},
	{name="export",active=false,settings=null}
]

// Metadata
metadata={
	created_at="2024-01-15T10:30:00Z",
	updated_at="2024-01-20T15:45:30Z",
	tags=["production","web","api"],
	maintainers=["team-a","team-b"]
}

// Limits
limits={
	max_file_size=1048576,
	max_files_per_user=100,
	storage_quota=1073741824,
	rate_limits={
		requests_per_minute=60,
		burst_allowed=true
	}
}
`

var largeJSON = `{"app_name":"ocean-note","version":"2.0.0","debug":true,"log_level":"info","database":{"host":"localhost","port":5432,"name":"mydb","pool_size":10,"timeout":30.5,"ssl_enabled":true,"ssl_cert":null,"credentials":[{"user":"admin","role":"owner"},{"user":"reader","role":"readonly"},{"user":"writer","role":"readwrite"}]},"server":{"host":"0.0.0.0","port":3000,"middleware":[{"name":"logger","enabled":true,"config":{"level":"info"}},{"name":"cors","enabled":false,"config":{}},{"name":"auth","enabled":true,"config":{"strategy":"jwt"}}]},"features":[{"name":"markdown","active":true,"settings":{"preview":true}},{"name":"collaboration","active":true,"settings":{"realtime":true,"max_users":100}},{"name":"export","active":false,"settings":null}],"metadata":{"created_at":"2024-01-15T10:30:00Z","updated_at":"2024-01-20T15:45:30Z","tags":["production","web","api"],"maintainers":["team-a","team-b"]},"limits":{"max_file_size":1048576,"max_files_per_user":100,"storage_quota":1073741824,"rate_limits":{"requests_per_minute":60,"burst_allowed":true}}}`

// A very large configuration for stress testing
func generateVeryLargeJHON(size int) string {
	jhon := "// Very Large Configuration\n"
	for i := 0; i < size; i++ {
		jhon += fmt.Sprintf("key_%d=\"value_%d\",", i, i)
	}
	jhon += "array=["
	for i := 0; i < size; i++ {
		jhon += fmt.Sprintf("%d,", i)
	}
	jhon += "]"
	return jhon
}

func generateVeryLargeJSON(size int) string {
	jsonStr := "{"
	for i := 0; i < size; i++ {
		jsonStr += fmt.Sprintf("\"key_%d\":\"value_%d\"", i, i)
		if i < size-1 {
			jsonStr += ","
		}
	}
	jsonStr += ",\"array\":["
	for i := 0; i < size; i++ {
		jsonStr += fmt.Sprintf("%d", i)
		if i < size-1 {
			jsonStr += ","
		}
	}
	jsonStr += "]}"
	return jsonStr
}

// =============================================================================
// Parse Benchmarks - Small
// =============================================================================

func BenchmarkParseJHONSmall(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := Parse(smallJHON)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkParseJSONSmall(b *testing.B) {
	for i := 0; i < b.N; i++ {
		var result map[string]interface{}
		err := json.Unmarshal([]byte(smallJSON), &result)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// =============================================================================
// Parse Benchmarks - Medium
// =============================================================================

func BenchmarkParseJHONMedium(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := Parse(mediumJHON)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkParseJSONMedium(b *testing.B) {
	for i := 0; i < b.N; i++ {
		var result map[string]interface{}
		err := json.Unmarshal([]byte(mediumJSON), &result)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// =============================================================================
// Parse Benchmarks - Large
// =============================================================================

func BenchmarkParseJHONLarge(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := Parse(largeJHON)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkParseJSONLarge(b *testing.B) {
	for i := 0; i < b.N; i++ {
		var result map[string]interface{}
		err := json.Unmarshal([]byte(largeJSON), &result)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// =============================================================================
// Parse Benchmarks - Very Large (100 items)
// =============================================================================

func BenchmarkParseJHONVeryLarge100(b *testing.B) {
	input := generateVeryLargeJHON(100)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := Parse(input)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkParseJSONVeryLarge100(b *testing.B) {
	input := generateVeryLargeJSON(100)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var result map[string]interface{}
		err := json.Unmarshal([]byte(input), &result)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// =============================================================================
// Serialize Benchmarks - Small
// =============================================================================

func BenchmarkSerializeJHONSmall(b *testing.B) {
	value := Object{"name": "test", "age": 25.0, "active": true}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = Serialize(value)
	}
}

func BenchmarkSerializeJSONSmall(b *testing.B) {
	value := map[string]interface{}{"name": "test", "age": 25.0, "active": true}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = json.Marshal(value)
	}
}

// =============================================================================
// Serialize Benchmarks - Medium
// =============================================================================

func BenchmarkSerializeJHONMedium(b *testing.B) {
	result, err := Parse(mediumJHON)
	if err != nil {
		b.Fatal(err)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = Serialize(result)
	}
}

func BenchmarkSerializeJSONMedium(b *testing.B) {
	var result map[string]interface{}
	err := json.Unmarshal([]byte(mediumJSON), &result)
	if err != nil {
		b.Fatal(err)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = json.Marshal(result)
	}
}

// =============================================================================
// Serialize Benchmarks - Large
// =============================================================================

func BenchmarkSerializeJHONLarge(b *testing.B) {
	result, err := Parse(largeJHON)
	if err != nil {
		b.Fatal(err)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = Serialize(result)
	}
}

func BenchmarkSerializeJSONLarge(b *testing.B) {
	var result map[string]interface{}
	err := json.Unmarshal([]byte(largeJSON), &result)
	if err != nil {
		b.Fatal(err)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = json.Marshal(result)
	}
}

// =============================================================================
// Round-Trip Benchmarks - Small
// =============================================================================

func BenchmarkRoundTripJHONSmall(b *testing.B) {
	original := Object{"name": "test", "age": 25.0, "active": true}
	for i := 0; i < b.N; i++ {
		serialized := Serialize(original)
		_, err := Parse(serialized)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkRoundTripJSONSmall(b *testing.B) {
	original := map[string]interface{}{"name": "test", "age": 25.0, "active": true}
	for i := 0; i < b.N; i++ {
		bytes, _ := json.Marshal(original)
		var result map[string]interface{}
		err := json.Unmarshal(bytes, &result)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// =============================================================================
// Round-Trip Benchmarks - Large
// =============================================================================

func BenchmarkRoundTripJHONLarge(b *testing.B) {
	original, err := Parse(largeJHON)
	if err != nil {
		b.Fatal(err)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		serialized := Serialize(original)
		_, err := Parse(serialized)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkRoundTripJSONLarge(b *testing.B) {
	var original map[string]interface{}
	err := json.Unmarshal([]byte(largeJSON), &original)
	if err != nil {
		b.Fatal(err)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		bytes, _ := json.Marshal(original)
		var result map[string]interface{}
		err := json.Unmarshal(bytes, &result)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// =============================================================================
// Comment Removal Benchmark
// =============================================================================

func BenchmarkRemoveComments(b *testing.B) {
	input := `
	// This is a comment
	name="test"  /* inline comment */
	age=25
	// Another comment
	active=true /* multi-line
	comment */
	`
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = removeComments(input)
	}
}

// =============================================================================
// Memory Allocation Benchmarks
// =============================================================================

func BenchmarkAllocParseJHONMedium(b *testing.B) {
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_, err := Parse(mediumJHON)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkAllocParseJSONMedium(b *testing.B) {
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		var result map[string]interface{}
		err := json.Unmarshal([]byte(mediumJSON), &result)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkAllocSerializeJHONMedium(b *testing.B) {
	result, err := Parse(mediumJHON)
	if err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = Serialize(result)
	}
}

func BenchmarkAllocSerializeJSONMedium(b *testing.B) {
	var result map[string]interface{}
	err := json.Unmarshal([]byte(mediumJSON), &result)
	if err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = json.Marshal(result)
	}
}

// =============================================================================
// Specialized Benchmarks
// =============================================================================

func BenchmarkParseNumbersWithUnderscores(b *testing.B) {
	input := `large=100_000 million=1_000_000 decimal=1_234.567_890 neg_large=-50_000`
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := Parse(input)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkParseRawStrings(b *testing.B) {
	input := `path=r"C:\Windows\System32" regex=r"\d+\w*\s*" quote=r#"He said "hello" to me"#`
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := Parse(input)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkParseNestedObjects(b *testing.B) {
	input := `outer={inner={deep="value"} number=42}`
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := Parse(input)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkParseArrays(b *testing.B) {
	input := `items=["apple","banana","cherry","date","elderberry","fig","grape"]`
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := Parse(input)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkSerializePretty(b *testing.B) {
	result, err := Parse(largeJHON)
	if err != nil {
		b.Fatal(err)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = SerializeWithOptions(result, SerializeOptions{Pretty: true, Indent: "  "})
	}
}

// =============================================================================
// Comparison Test - String Size
// =============================================================================

func TestStringSizeComparison(t *testing.T) {
	jhonParsed, _ := Parse(mediumJHON)
	jhonSerialized := Serialize(jhonParsed)
	t.Logf("JHON size: %d bytes", len(jhonSerialized))
	t.Logf("JSON size: %d bytes", len(mediumJSON))
	t.Logf("JHON is %.2f%% of JSON size", float64(len(jhonSerialized))/float64(len(mediumJSON))*100)
}

// =============================================================================
// Comparison Test - Large Config
// =============================================================================

func TestLargeConfigComparison(t *testing.T) {
	jhonParsed, _ := Parse(largeJHON)
	jhonSerialized := Serialize(jhonParsed)
	t.Logf("Large JHON size: %d bytes", len(jhonSerialized))
	t.Logf("Large JSON size: %d bytes", len(largeJSON))
	t.Logf("JHON is %.2f%% of JSON size", float64(len(jhonSerialized))/float64(len(largeJSON))*100)
}
