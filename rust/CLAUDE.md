# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JHON (JinHui's Object Notation) is a configuration language parser and serializer library in Rust (edition 2024). It provides a simpler alternative to JSON with support for comments, raw strings, and numbers with underscores.

## Development Commands

- `cargo build` / `cargo b` - Compile the project
- `cargo check` - Quick analysis without building
- `cargo test` / `cargo t` - Run all tests
- `cargo test -- <test_name>` - Run a specific test
- `cargo +nightly bench` - Run benchmarks (requires nightly Rust)
- `cargo clean` - Remove build artifacts
- `cargo doc` - Generate and open documentation
- `cargo clippy` - Run linter checks
- `cargo fmt` - Format code

## Architecture

This is a library crate with a flat structure:
- `src/lib.rs` - Main library entry point with parser and serializer
- `benches/benchmark.rs` - Performance benchmarks comparing JHON vs JSON

## Testing

Tests use standard Rust patterns with `#[test]` attributes and `assert_eq!` macros. All tests are located inline in `src/lib.rs`.

## Benchmarks

The benchmarks use the libtest harness with `#[bench]` attributes (requires nightly Rust):

```bash
cargo +nightly bench
```

Benchmark results compare JHON parsing/serialization against serde_json.
