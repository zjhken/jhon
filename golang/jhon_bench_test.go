package jhon

import (
	"encoding/json"
	"testing"
)

// =============================================================================
// Benchmark inputs — mirror the Rust criterion bench so numbers are
// comparable across implementations.
// =============================================================================

const smallJHON = `name="John Doe",age=30,active=true,score=95.5`

const smallJSON = `{"name":"John Doe","age":30,"active":true,"score":95.5}`

const mediumJHON = `
server={host="localhost",port=8080,ssl={enabled=true,cert_path="/etc/ssl/cert.pem"}},
database={host="db.example.com",port=5432,name="myapp",pool={min_size=5,max_size=100,timeout=30_000}},
features=["auth","logging","caching"],
debug=false,
version=1_000_000
`

const mediumJSON = `{
    "server": {"host": "localhost", "port": 8080, "ssl": {"enabled": true, "cert_path": "/etc/ssl/cert.pem"}},
    "database": {"host": "db.example.com", "port": 5432, "name": "myapp", "pool": {"min_size": 5, "max_size": 100, "timeout": 30000}},
    "features": ["auth", "logging", "caching"],
    "debug": false,
    "version": 1000000
}`

// =============================================================================
// Parse benchmarks
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
		if err := json.Unmarshal([]byte(smallJSON), &result); err != nil {
			b.Fatal(err)
		}
	}
}

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
		if err := json.Unmarshal([]byte(mediumJSON), &result); err != nil {
			b.Fatal(err)
		}
	}
}

// =============================================================================
// Serialize benchmarks
// =============================================================================

func BenchmarkSerializeJHONSmall(b *testing.B) {
	value, _ := Parse(smallJHON)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = Serialize(value)
	}
}

func BenchmarkSerializeJSONSmall(b *testing.B) {
	var value map[string]interface{}
	_ = json.Unmarshal([]byte(smallJSON), &value)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = json.Marshal(value)
	}
}

func BenchmarkSerializeJHONMedium(b *testing.B) {
	value, _ := Parse(mediumJHON)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = Serialize(value)
	}
}

func BenchmarkSerializeJSONMedium(b *testing.B) {
	var value map[string]interface{}
	_ = json.Unmarshal([]byte(mediumJSON), &value)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = json.Marshal(value)
	}
}
