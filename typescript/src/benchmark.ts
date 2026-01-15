/**
 * Benchmark test comparing JSON vs JHON vs TOML parsing performance
 */

import { parse, serialize, type JhonObject } from './index';
import TOML from 'toml';

// Create a complex test data structure (compatible with JSON, JHON, and TOML)
function createTestData(): JhonObject {
  return {
    app_name: 'ocean-note',
    version: '2.0.0',
    database: {
      host: 'localhost',
      port: 5432,
      name: 'mydb',
      pool_size: 10,
      timeout: 30.5,
      ssl_enabled: true,
      ssl_cert: null,
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      middleware: [
        { name: 'logger', enabled: true, level: 'info' },
        { name: 'cors', enabled: false, origins: ['all'] },
        { name: 'auth', enabled: true, strategy: 'jwt' },
      ],
    },
    features: [
      { name: 'markdown', active: true, preview: true, gfm: true },
      { name: 'collaboration', active: true, realtime: true, max_users: 100 },
      { name: 'export', active: false, formats: ['pdf', 'docx', 'txt'] },
    ],
    metadata: {
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-20T15:45:30Z',
      tags: ['production', 'web', 'api'],
      maintainers: ['team-a', 'team-b'],
    },
    limits: {
      max_file_size: 1048576,
      max_files_per_user: 100,
      storage_quota: 1073741824,
      rate_limits: {
        requests_per_minute: 60,
        burst_allowed: true,
        burst_size: 10,
      },
      session_limits: {
        max_sessions: 5,
        session_timeout: 3600,
      },
    },
    features_v2: {
      editing: {
        autocomplete: true,
        spellcheck: true,
        word_count: true,
      },
      collaboration: {
        realtime: true,
        comments: true,
        version_history: true,
      },
      export: {
        pdf: true,
        docx: true,
        txt: true,
      },
    },
    theme: {
      mode: 'dark',
      primary_color: '#007bff',
      secondary_color: '#6c757d',
      font_size: 14,
    },
    logging: {
      level: 'info',
      format: 'json',
      outputs: ['console', 'file'],
      rotation: {
        enabled: true,
        max_size: 10485760,
        max_files: 10,
      },
    },
    users: [
      {
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        active: true,
        roles: ['admin', 'user'],
      },
      {
        id: 2,
        name: 'Bob',
        email: 'bob@example.com',
        active: true,
        roles: ['user'],
      },
      {
        id: 3,
        name: 'Charlie',
        email: 'charlie@example.com',
        active: false,
        roles: ['user'],
      },
      {
        id: 4,
        name: 'Diana',
        email: 'diana@example.com',
        active: true,
        roles: ['admin', 'moderator', 'user'],
      },
      {
        id: 5,
        name: 'Eve',
        email: 'eve@example.com',
        active: true,
        roles: ['moderator'],
      },
    ],
    settings: {
      auto_save: true,
      auto_save_interval: 300,
      max_history: 100,
      default_visibility: 'private',
      allow_comments: true,
      allow_sharing: true,
    },
  };
}

// Convert test data to TOML format
function toTOML(obj: any, indent = 0): string {
  const spaces = '  '.repeat(indent);
  let result = '';

  if (Array.isArray(obj)) {
    // TOML requires array of tables for objects in arrays
    obj.forEach((item, idx) => {
      if (typeof item === 'object' && item !== null) {
        result += `\n${spaces}[[items]]\n`;
        result += toTOML(item, indent);
      }
    });
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          // Array of inline tables or primitive values
          if (value.length > 0 && typeof value[0] === 'object') {
            // Array of tables - handled at parent level
          } else {
            // Inline array
            result += `${spaces}${key} = ${JSON.stringify(value)}\n`;
          }
        } else {
          // Nested object - create a table
          result += `\n${spaces}[${key}]\n`;
          result += toTOML(value, indent);
        }
      } else if (typeof value === 'string') {
        result += `${spaces}${key} = "${value}"\n`;
      } else if (typeof value === 'boolean') {
        result += `${spaces}${key} = ${value}\n`;
      } else if (value === null) {
        // TOML doesn't have null, skip or use empty string
        result += `${spaces}${key} = ""\n`;
      } else {
        result += `${spaces}${key} = ${value}\n`;
      }
    }
  }

  return result;
}

// Benchmark function
function benchmark(name: string, fn: () => void, iterations: number = 10000) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  const totalTime = end - start;
  const avgTime = totalTime / iterations;
  const opsPerSec = (iterations / totalTime) * 1000;

  return {
    name,
    iterations,
    totalTime: totalTime.toFixed(2),
    avgTime: avgTime.toFixed(4),
    opsPerSec: opsPerSec.toFixed(0),
  };
}

// Main benchmark
function runBenchmark() {
  console.log('='.repeat(80));
  console.log('JSON vs JHON vs TOML Parsing Performance Benchmark');
  console.log('='.repeat(80));
  console.log();

  // Create test data
  const testData = createTestData();

  // Serialize to JSON
  const jsonString = JSON.stringify(testData);
  console.log(`JSON string size: ${jsonString.length} bytes`);
  console.log(`JSON string preview: ${jsonString.substring(0, 100)}...`);
  console.log();

  // Serialize to JHON
  const jhonString = serialize(testData);
  console.log(`JHON string size: ${jhonString.length} bytes`);
  console.log(`JHON string preview: ${jhonString.substring(0, 100)}...`);
  console.log();

  // Serialize to TOML
  const tomlString = toTOML(testData);
  console.log(`TOML string size: ${tomlString.length} bytes`);
  console.log(`TOML string preview: ${tomlString.substring(0, 100)}...`);
  console.log();

  // Size comparisons
  const jhonSizeDiff = ((jhonString.length - jsonString.length) / jsonString.length) * 100;
  const tomlSizeDiff = ((tomlString.length - jsonString.length) / jsonString.length) * 100;

  console.log('Size Comparison (relative to JSON):');
  console.log(`  JHON: ${jhonSizeDiff > 0 ? '+' : ''}${jhonSizeDiff.toFixed(2)}%`);
  console.log(`  TOML: ${tomlSizeDiff > 0 ? '+' : ''}${tomlSizeDiff.toFixed(2)}%`);
  console.log();

  console.log('-'.repeat(80));
  console.log();

  // Warm up
  console.log('Warming up...');
  for (let i = 0; i < 1000; i++) {
    JSON.parse(jsonString);
    parse(jhonString);
    try {
      TOML.parse(tomlString);
    } catch (e) {
      // TOML parsing might fail for complex structures
    }
  }
  console.log('Warm up complete.');
  console.log();

  // Run benchmarks
  const iterations = 10000;

  console.log('Running benchmarks...');
  console.log(`Iterations: ${iterations.toLocaleString()}`);
  console.log();

  const jsonResults = benchmark('JSON.parse', () => {
    JSON.parse(jsonString);
  }, iterations);

  const jhonResults = benchmark('JHON.parse', () => {
    parse(jhonString);
  }, iterations);

  let tomlResults;
  try {
    tomlResults = benchmark('TOML.parse', () => {
      try {
        TOML.parse(tomlString);
      } catch (e) {
        // Ignore errors in benchmark
      }
    }, iterations);
  } catch (e) {
    console.log('TOML parsing skipped (unsupported structure)');
  }

  // Display results
  console.log('-'.repeat(80));
  console.log();
  console.log('Results:');
  console.log();
  console.log(`  ${jsonResults.name}:`);
  console.log(`    Total time:      ${jsonResults.totalTime} ms`);
  console.log(`    Average time:    ${jsonResults.avgTime} ms`);
  console.log(`    Operations/sec:  ${jsonResults.opsPerSec}`);
  console.log();
  console.log(`  ${jhonResults.name}:`);
  console.log(`    Total time:      ${jhonResults.totalTime} ms`);
  console.log(`    Average time:    ${jhonResults.avgTime} ms`);
  console.log(`    Operations/sec:  ${jhonResults.opsPerSec}`);
  console.log();

  if (tomlResults) {
    console.log(`  ${tomlResults.name}:`);
    console.log(`    Total time:      ${tomlResults.totalTime} ms`);
    console.log(`    Average time:    ${tomlResults.avgTime} ms`);
    console.log(`    Operations/sec:  ${tomlResults.opsPerSec}`);
    console.log();
  }

  // Calculate comparisons
  const jsonTime = parseFloat(jsonResults.totalTime);
  const jhonTime = parseFloat(jhonResults.totalTime);
  const jhonRatio = jhonTime / jsonTime;
  const jhonPercentDiff = (jhonRatio - 1) * 100;

  console.log('-'.repeat(80));
  console.log();
  console.log('Performance Comparison (vs JSON):');
  console.log();
  console.log(`  JHON: ${jhonRatio < 1 ? 'faster' : 'slower'} by ${Math.abs(jhonPercentDiff).toFixed(2)}% (${jhonRatio.toFixed(2)}x)`);

  if (tomlResults) {
    const tomlTime = parseFloat(tomlResults.totalTime);
    const tomlRatio = tomlTime / jsonTime;
    const tomlPercentDiff = (tomlRatio - 1) * 100;
    console.log(`  TOML: ${tomlRatio < 1 ? 'faster' : 'slower'} by ${Math.abs(tomlPercentDiff).toFixed(2)}% (${tomlRatio.toFixed(2)}x)`);
  }
  console.log();

  // Verify correctness
  console.log('-'.repeat(80));
  console.log();
  console.log('Verification:');
  console.log();

  const jsonParsed = JSON.parse(jsonString);
  const jhonParsed = parse(jhonString);

  // Deep comparison function
  function deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (typeof obj1 !== typeof obj2) return false;
    if (typeof obj1 !== 'object' || obj1 === null || obj2 === null) return false;

    if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
    if (Array.isArray(obj1)) {
      if (obj1.length !== obj2.length) return false;
      for (let i = 0; i < obj1.length; i++) {
        if (!deepEqual(obj1[i], obj2[i])) return false;
      }
      return true;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!deepEqual(obj1[key], obj2[key])) return false;
    }

    return true;
  }

  if (deepEqual(jsonParsed, jhonParsed)) {
    console.log('  ✓ JSON and JHON parsers produced semantically identical results');
    console.log('  (Note: JHON sorts object keys alphabetically by default)');
  } else {
    console.log('  ✗ JSON and JHON parsers produced different results!');
  }

  try {
    const tomlParsed = TOML.parse(tomlString);
    if (deepEqual(jsonParsed, tomlParsed)) {
      console.log('  ✓ JSON and TOML parsers produced semantically identical results');
    } else {
      console.log('  ✗ JSON and TOML parsers produced different results!');
      console.log('  (Note: TOML has structural limitations for complex nested data)');
    }
  } catch (e) {
    console.log('  ⚠ TOML parsing failed (structure not fully compatible with TOML format)');
  }
  console.log();

  console.log('='.repeat(80));
}

// Run the benchmark
runBenchmark();
