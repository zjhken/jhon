// Benchmark JHON vs JSON using libtest benchmark harness

#![feature(test)]
extern crate test;

const SMALL_JHON: &str = r#"name="John Doe",age=30,active=true,score=95.5"#;
const SMALL_JSON: &str = r#"{"name":"John Doe","age":30,"active":true,"score":95.5}"#;

const MEDIUM_JHON: &str = r#"
server={host="localhost",port=8080,ssl={enabled=true,cert_path="/etc/ssl/cert.pem"}},
database={host="db.example.com",port=5432,name="myapp",pool={min_size=5,max_size=100,timeout=30_000}},
features=["auth","logging","caching"],
debug=false,
version=1_000_000
"#;

const MEDIUM_JSON: &str = r#"{
    "server": {"host": "localhost", "port": 8080, "ssl": {"enabled": true, "cert_path": "/etc/ssl/cert.pem"}},
    "database": {"host": "db.example.com", "port": 5432, "name": "myapp", "pool": {"min_size": 5, "max_size": 100, "timeout": 30000}},
    "features": ["auth", "logging", "caching"],
    "debug": false,
    "version": 1000000
}"#;

#[bench]
fn bench_jhon_parse_small(b: &mut test::Bencher) {
    b.iter(|| jhon::parse(SMALL_JHON).unwrap());
}

#[bench]
fn bench_json_parse_small(b: &mut test::Bencher) {
    b.iter(|| {
        let _: serde_json::Value = serde_json::from_str(SMALL_JSON).unwrap();
    });
}

#[bench]
fn bench_jhon_serialize_small(b: &mut test::Bencher) {
    let value: serde_json::Value = serde_json::from_str(SMALL_JSON).unwrap();
    b.iter(|| jhon::serialize(&value));
}

#[bench]
fn bench_json_serialize_small(b: &mut test::Bencher) {
    let value: serde_json::Value = serde_json::from_str(SMALL_JSON).unwrap();
    b.iter(|| serde_json::to_string(&value).unwrap());
}

#[bench]
fn bench_jhon_parse_medium(b: &mut test::Bencher) {
    b.iter(|| jhon::parse(MEDIUM_JHON).unwrap());
}

#[bench]
fn bench_json_parse_medium(b: &mut test::Bencher) {
    b.iter(|| {
        let _: serde_json::Value = serde_json::from_str(MEDIUM_JSON).unwrap();
    });
}

#[bench]
fn bench_jhon_serialize_medium(b: &mut test::Bencher) {
    let value: serde_json::Value = serde_json::from_str(MEDIUM_JSON).unwrap();
    b.iter(|| jhon::serialize(&value));
}

#[bench]
fn bench_json_serialize_medium(b: &mut test::Bencher) {
    let value: serde_json::Value = serde_json::from_str(MEDIUM_JSON).unwrap();
    b.iter(|| serde_json::to_string(&value).unwrap());
}
