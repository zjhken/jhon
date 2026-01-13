# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jhon is a Rust library project (edition 2024) in early development. It's currently a minimal starter template with basic arithmetic functionality.

## Development Commands

- `cargo build` / `cargo b` - Compile the project
- `cargo check` - Quick analysis without building
- `cargo test` / `cargo t` - Run all tests
- `cargo test -- <test_name>` - Run a specific test
- `cargo run` - Run the project (when binary target is added)
- `cargo clean` - Remove build artifacts
- `cargo doc` - Generate and open documentation
- `cargo clippy` - Run linter checks
- `cargo fmt` - Format code

## Architecture

This is a library crate with a flat structure:
- `src/lib.rs` - Main library entry point

Currently uses no external dependencies and has no module organization. As the project grows, consider:
- Organizing code into logical modules (e.g., `src/core/`, `src/utils/`)
- Adding proper documentation with `///` doc comments
- Structuring the API surface area clearly

## Testing

Tests use standard Rust patterns with `#[test]` attributes and `assert_eq!` macros. All tests are currently located inline in `src/lib.rs`.
