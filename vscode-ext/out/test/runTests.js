"use strict";
/**
 * Test Runner for JHON Extension
 *
 * This file runs all unit tests for the parser and formatter.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
console.log('🚀 Starting JHON Extension Tests\n');
console.log('='.repeat(60));
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
// Wrap console.log to count tests
const originalLog = console.log;
console.log = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('✅')) {
        totalTests++;
        passedTests++;
    }
    originalLog.apply(console, args);
};
const originalError = console.error;
console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('❌')) {
        totalTests++;
        failedTests++;
    }
    originalError.apply(console, args);
};
async function runTests() {
    try {
        // Import and run parser tests
        console.log('\n📦 Running Parser Tests...\n');
        await Promise.resolve().then(() => __importStar(require('./parser.test')));
        // Import and run formatter tests
        console.log('\n📦 Running Formatter Tests...\n');
        await Promise.resolve().then(() => __importStar(require('./formatter.test')));
        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 Test Summary');
        console.log('='.repeat(60));
        console.log(`Total Tests:  ${totalTests}`);
        console.log(`✅ Passed:     ${passedTests}`);
        console.log(`❌ Failed:     ${failedTests}`);
        console.log(`Success Rate: ${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0}%`);
        if (failedTests === 0) {
            console.log('\n🎉 All tests passed successfully!\n');
            process.exit(0);
        }
        else {
            console.log(`\n💥 ${failedTests} test(s) failed!\n`);
            process.exit(1);
        }
    }
    catch (error) {
        console.error('\n💥 Test execution failed:', error);
        process.exit(1);
    }
}
// Run the tests
runTests();
//# sourceMappingURL=runTests.js.map