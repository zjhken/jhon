// Benchmark JHON vs JSON using criterion (works on stable Rust).

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use jhon::{parse, serialize};

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

fn bench_parse(c: &mut Criterion) {
    let mut group = c.benchmark_group("parse");

    group.bench_with_input(BenchmarkId::new("jhon", "small"), &SMALL_JHON, |b, input| {
        b.iter(|| parse(black_box(input)).unwrap());
    });
    group.bench_with_input(BenchmarkId::new("json", "small"), &SMALL_JSON, |b, input| {
        b.iter(|| {
            let _: serde_json::Value = serde_json::from_str(black_box(input)).unwrap();
        });
    });
    group.bench_with_input(BenchmarkId::new("jhon", "medium"), &MEDIUM_JHON, |b, input| {
        b.iter(|| parse(black_box(input)).unwrap());
    });
    group.bench_with_input(
        BenchmarkId::new("json", "medium"),
        &MEDIUM_JSON,
        |b, input| {
            b.iter(|| {
                let _: serde_json::Value = serde_json::from_str(black_box(input)).unwrap();
            });
        },
    );

    group.finish();
}

fn bench_serialize(c: &mut Criterion) {
    let small: serde_json::Value = serde_json::from_str(SMALL_JSON).unwrap();
    let medium: serde_json::Value = serde_json::from_str(MEDIUM_JSON).unwrap();

    let mut group = c.benchmark_group("serialize");

    group.bench_with_input(BenchmarkId::new("jhon", "small"), &small, |b, value| {
        b.iter(|| serialize(black_box(value)));
    });
    group.bench_with_input(BenchmarkId::new("json", "small"), &small, |b, value| {
        b.iter(|| serde_json::to_string(black_box(value)).unwrap());
    });
    group.bench_with_input(BenchmarkId::new("jhon", "medium"), &medium, |b, value| {
        b.iter(|| serialize(black_box(value)));
    });
    group.bench_with_input(BenchmarkId::new("json", "medium"), &medium, |b, value| {
        b.iter(|| serde_json::to_string(black_box(value)).unwrap());
    });

    group.finish();
}

criterion_group!(benches, bench_parse, bench_serialize);
criterion_main!(benches);
