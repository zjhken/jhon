/**
 * Benchmark comparing Original vs Optimized JHON parser
 */
import { parse as parseOriginal, serialize as serializeOriginal } from './index';
import { parse as parseOptimized } from './index-optimized';
// Create test data
function createTestData() {
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
function benchmark(name, fn, iterations = 10000) {
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
function deepEqual(obj1, obj2) {
    if (obj1 === obj2)
        return true;
    if (typeof obj1 !== typeof obj2)
        return false;
    if (typeof obj1 !== 'object' || obj1 === null || obj2 === null)
        return false;
    if (Array.isArray(obj1) !== Array.isArray(obj2))
        return false;
    if (Array.isArray(obj1)) {
        if (obj1.length !== obj2.length)
            return false;
        for (let i = 0; i < obj1.length; i++) {
            if (!deepEqual(obj1[i], obj2[i]))
                return false;
        }
        return true;
    }
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length)
        return false;
    for (const key of keys1) {
        if (!keys2.includes(key))
            return false;
        if (!deepEqual(obj1[key], obj2[key]))
            return false;
    }
    return true;
}
function runBenchmark() {
    console.log('='.repeat(80));
    console.log('Original vs Optimized JHON Parser Performance Comparison');
    console.log('='.repeat(80));
    console.log();
    const testData = createTestData();
    const jhonString = serializeOriginal(testData);
    console.log(`JHON string size: ${jhonString.length} bytes`);
    console.log();
    console.log('-'.repeat(80));
    console.log();
    // Warm up
    console.log('Warming up...');
    for (let i = 0; i < 1000; i++) {
        parseOriginal(jhonString);
        parseOptimized(jhonString);
    }
    console.log('Warm up complete.');
    console.log();
    // Run benchmarks
    const iterations = 10000;
    console.log('Running benchmarks...');
    console.log(`Iterations: ${iterations.toLocaleString()}`);
    console.log();
    const originalResults = benchmark('Original Parser', () => {
        parseOriginal(jhonString);
    }, iterations);
    const optimizedResults = benchmark('Optimized Parser', () => {
        parseOptimized(jhonString);
    }, iterations);
    // Display results
    console.log('-'.repeat(80));
    console.log();
    console.log('Results:');
    console.log();
    console.log(`  ${originalResults.name}:`);
    console.log(`    Total time:      ${originalResults.totalTime} ms`);
    console.log(`    Average time:    ${originalResults.avgTime} ms`);
    console.log(`    Operations/sec:  ${originalResults.opsPerSec}`);
    console.log();
    console.log(`  ${optimizedResults.name}:`);
    console.log(`    Total time:      ${optimizedResults.totalTime} ms`);
    console.log(`    Average time:    ${optimizedResults.avgTime} ms`);
    console.log(`    Operations/sec:  ${optimizedResults.opsPerSec}`);
    console.log();
    // Calculate comparison
    const originalTime = parseFloat(originalResults.totalTime);
    const optimizedTime = parseFloat(optimizedResults.totalTime);
    const ratio = originalTime / optimizedTime;
    const percentImprovement = ((originalTime - optimizedTime) / originalTime) * 100;
    console.log('-'.repeat(80));
    console.log();
    console.log('Performance Improvement:');
    console.log();
    console.log(`  Optimized parser is ${ratio.toFixed(2)}x faster`);
    console.log(`  Performance improvement: ${percentImprovement.toFixed(2)}%`);
    console.log(`  Time saved: ${(originalTime - optimizedTime).toFixed(2)} ms (${iterations.toLocaleString()} iterations)`);
    console.log();
    // Verify correctness
    console.log('-'.repeat(80));
    console.log();
    console.log('Verification:');
    console.log();
    const originalParsed = parseOriginal(jhonString);
    const optimizedParsed = parseOptimized(jhonString);
    if (deepEqual(originalParsed, optimizedParsed)) {
        console.log('  ✓ Both parsers produced semantically identical results');
    }
    else {
        console.log('  ✗ Parsers produced different results!');
    }
    console.log();
    console.log('='.repeat(80));
}
runBenchmark();
//# sourceMappingURL=benchmark-optimization.js.map