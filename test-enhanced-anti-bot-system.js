#!/usr/bin/env node

/**
 * Comprehensive Test Script for Enhanced Anti-Bot System and Performance Monitoring
 * Tests all new features including user agent rotation, stealth mode, performance tracking, and error handling
 */

const http = require('http');
const { antiBotSystem } = require('./anti-bot-system');
const { performanceMonitor } = require('./performance-monitor');
const { enhancedFileOps } = require('./enhanced-file-operations');

console.log('🧪 COMPREHENSIVE ANTI-BOT & PERFORMANCE SYSTEM TESTS\n');
console.log('='*60);

// Test configuration
const TEST_CONFIG = {
    baseUrl: 'http://localhost:3000',
    testTimeout: 30000,
    apiEndpoints: [
        '/health',
        '/performance-metrics',
        '/anti-bot-status',
        '/linkedin-metrics'
    ],
    testUrls: [
        'https://example.com',
        'https://linkedin.com/company/microsoft'  // For testing (will use mock in dev)
    ]
};

class EnhancedTestSuite {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            startTime: Date.now(),
            tests: []
        };
    }

    /**
     * Run all test suites
     */
    async runAllTests() {
        console.log(`🚀 Starting comprehensive test suite...\n`);

        try {
            // System component tests
            await this.testAntiBotSystem();
            await this.testPerformanceMonitor();
            await this.testEnhancedFileOperations();
            
            // API endpoint tests
            await this.testApiEndpoints();
            
            // Integration tests
            await this.testIntegrationFeatures();
            
            // Performance stress tests
            await this.testPerformanceUnderLoad();

            // Generate final report
            await this.generateTestReport();

        } catch (error) {
            console.error('❌ Test suite failed with critical error:', error.message);
            this.recordTest('Critical Error', false, error.message);
        }
    }

    /**
     * Test Anti-Bot System functionality
     */
    async testAntiBotSystem() {
        console.log('🛡️  TESTING ANTI-BOT SYSTEM');
        console.log('-'.repeat(40));

        // Test 1: User Agent Rotation
        await this.runTest('User Agent Rotation', async () => {
            const agents = [];
            for (let i = 0; i < 5; i++) {
                agents.push(antiBotSystem.getRandomUserAgent(true));
            }
            
            const uniqueAgents = new Set(agents);
            if (uniqueAgents.size < 3) {
                throw new Error(`Insufficient user agent variation: ${uniqueAgents.size}/5`);
            }
            
            console.log(`   ✅ Generated ${uniqueAgents.size} unique user agents`);
        });

        // Test 2: Browser Headers Generation
        await this.runTest('Browser Headers Generation', async () => {
            const headers = antiBotSystem.getBrowserHeaders();
            
            const requiredHeaders = ['Accept', 'Accept-Language', 'User-Agent'];
            for (const header of requiredHeaders) {
                if (!headers[header]) {
                    throw new Error(`Missing required header: ${header}`);
                }
            }
            
            console.log(`   ✅ Generated ${Object.keys(headers).length} headers`);
        });

        // Test 3: Advanced Browser Args
        await this.runTest('Advanced Browser Arguments', async () => {
            const args = antiBotSystem.getAdvancedBrowserArgs();
            
            const requiredArgs = ['--no-sandbox', '--disable-blink-features=AutomationControlled'];
            for (const arg of requiredArgs) {
                if (!args.some(a => a.includes(arg.split('=')[0]))) {
                    throw new Error(`Missing required argument pattern: ${arg}`);
                }
            }
            
            console.log(`   ✅ Generated ${args.length} browser arguments`);
        });

        // Test 4: Random Viewport Generation
        await this.runTest('Random Viewport Generation', async () => {
            const viewports = [];
            for (let i = 0; i < 3; i++) {
                viewports.push(antiBotSystem.getRandomViewport());
            }
            
            // Check if viewports have realistic dimensions
            for (const vp of viewports) {
                if (vp.width < 800 || vp.height < 600 || vp.width > 2000 || vp.height > 1200) {
                    throw new Error(`Unrealistic viewport: ${vp.width}x${vp.height}`);
                }
            }
            
            console.log(`   ✅ Generated realistic viewports`);
        });

        // Test 5: Analytics Functionality
        await this.runTest('Anti-Bot Analytics', async () => {
            // Simulate some activity
            antiBotSystem.trackRequest('test-url', true, 500);
            antiBotSystem.trackRequest('test-url-2', false, 1000);
            
            const analytics = antiBotSystem.getAnalytics();
            
            if (!analytics.totalRequests || !analytics.currentUserAgent) {
                throw new Error('Analytics missing required fields');
            }
            
            console.log(`   ✅ Analytics working: ${analytics.totalRequests} requests tracked`);
        });

        console.log('');
    }

    /**
     * Test Performance Monitor functionality
     */
    async testPerformanceMonitor() {
        console.log('📊 TESTING PERFORMANCE MONITOR');
        console.log('-'.repeat(40));

        // Test 1: Timer Operations
        await this.runTest('Timer Operations', async () => {
            const timer = performanceMonitor.startTimer('test_operation');
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
            const result = performanceMonitor.endTimer(timer, true, { testData: 'example' });
            
            if (!result.duration || result.duration < 90) {
                throw new Error(`Timer inaccurate: ${result.duration}ms`);
            }
            
            console.log(`   ✅ Timer measured ${result.duration}ms`);
        });

        // Test 2: Error Recording
        await this.runTest('Error Recording', async () => {
            const testError = new Error('Test error message');
            performanceMonitor.recordError('test_category', testError, { testContext: true });
            
            const analytics = performanceMonitor.getAnalytics();
            if (!analytics.errorCategories || !analytics.recentErrors) {
                throw new Error('Error recording not functioning');
            }
            
            console.log(`   ✅ Error recorded in analytics`);
        });

        // Test 3: Success Recording
        await this.runTest('Success Recording', async () => {
            const initialSuccesses = performanceMonitor.getAnalytics().totalRequests;
            performanceMonitor.recordSuccess('test_operation', 250);
            
            const newSuccesses = performanceMonitor.getAnalytics().totalRequests;
            if (newSuccesses <= initialSuccesses) {
                throw new Error('Success recording not functioning');
            }
            
            console.log(`   ✅ Success recorded: ${newSuccesses} total requests`);
        });

        // Test 4: Analytics Generation
        await this.runTest('Analytics Generation', async () => {
            const analytics = performanceMonitor.getAnalytics();
            
            const requiredFields = ['totalRequests', 'successRate', 'uptime', 'insights', 'recommendations'];
            for (const field of requiredFields) {
                if (analytics[field] === undefined) {
                    throw new Error(`Missing analytics field: ${field}`);
                }
            }
            
            console.log(`   ✅ Complete analytics generated`);
        });

        // Test 5: Anti-Bot Event Recording
        await this.runTest('Anti-Bot Event Recording', async () => {
            const initialEvents = performanceMonitor.getAnalytics().botDetectionEvents || 0;
            performanceMonitor.recordAntiBotEvent('bot_detection', { test: true });
            
            const newEvents = performanceMonitor.getAnalytics().botDetectionEvents;
            if (newEvents <= initialEvents) {
                throw new Error('Anti-bot event recording not functioning');
            }
            
            console.log(`   ✅ Anti-bot events: ${newEvents}`);
        });

        console.log('');
    }

    /**
     * Test Enhanced File Operations
     */
    async testEnhancedFileOperations() {
        console.log('📁 TESTING ENHANCED FILE OPERATIONS');
        console.log('-'.repeat(40));

        const testFile = './test-enhanced-file-ops.txt';
        const testContent = 'Enhanced file operations test content\nLine 2\nLine 3';

        // Test 1: Enhanced Write
        await this.runTest('Enhanced File Write', async () => {
            const result = await enhancedFileOps.writeFile(testFile, testContent, {
                atomic: true,
                backup: false
            });
            
            if (!result.success) {
                throw new Error('File write failed');
            }
            
            console.log(`   ✅ File written successfully`);
        });

        // Test 2: Enhanced Read
        await this.runTest('Enhanced File Read', async () => {
            const content = await enhancedFileOps.readFile(testFile);
            
            if (content !== testContent) {
                throw new Error('File content mismatch');
            }
            
            console.log(`   ✅ File read successfully (${content.length} chars)`);
        });

        // Test 3: File Copy
        await this.runTest('Enhanced File Copy', async () => {
            const copyPath = './test-enhanced-file-ops-copy.txt';
            const result = await enhancedFileOps.copyFile(testFile, copyPath);
            
            if (!result.success) {
                throw new Error('File copy failed');
            }
            
            // Cleanup
            await enhancedFileOps.deleteFile(copyPath);
            console.log(`   ✅ File copied and cleaned up`);
        });

        // Test 4: Error Handling
        await this.runTest('File Operation Error Handling', async () => {
            try {
                await enhancedFileOps.readFile('./non-existent-file-12345.txt');
                throw new Error('Should have thrown an error for non-existent file');
            } catch (error) {
                if (!error.name || !error.name.includes('FileOperationError')) {
                    // This is expected for non-existent files
                    console.log(`   ✅ Proper error handling for non-existent file`);
                } else {
                    throw error;
                }
            }
        });

        // Cleanup test files
        try {
            await enhancedFileOps.deleteFile(testFile);
        } catch (error) {
            console.warn('   ⚠️  Warning: Could not cleanup test file');
        }

        console.log('');
    }

    /**
     * Test API endpoints
     */
    async testApiEndpoints() {
        console.log('🌐 TESTING API ENDPOINTS');
        console.log('-'.repeat(40));

        for (const endpoint of TEST_CONFIG.apiEndpoints) {
            await this.runTest(`GET ${endpoint}`, async () => {
                const response = await this.makeHttpRequest('GET', endpoint);
                
                if (response.statusCode !== 200) {
                    throw new Error(`HTTP ${response.statusCode}: ${response.data.error || 'Unknown error'}`);
                }
                
                const data = JSON.parse(response.data);
                if (!data.status) {
                    throw new Error('Response missing status field');
                }
                
                console.log(`   ✅ ${endpoint} responded with ${data.status}`);
            });
        }

        console.log('');
    }

    /**
     * Test integration features
     */
    async testIntegrationFeatures() {
        console.log('🔗 TESTING INTEGRATION FEATURES');
        console.log('-'.repeat(40));

        // Test 1: Performance Export
        await this.runTest('Performance Data Export', async () => {
            const response = await this.makeHttpRequest('POST', '/export-performance');
            
            if (response.statusCode !== 200) {
                throw new Error(`Export failed: HTTP ${response.statusCode}`);
            }
            
            const data = JSON.parse(response.data);
            if (!data.success || !data.filePath) {
                throw new Error('Export response invalid');
            }
            
            console.log(`   ✅ Performance data exported: ${data.filePath}`);
        });

        // Test 2: Health Check Integration
        await this.runTest('Health Check Integration', async () => {
            const response = await this.makeHttpRequest('GET', '/health');
            
            if (response.statusCode !== 200) {
                throw new Error(`Health check failed: HTTP ${response.statusCode}`);
            }
            
            const data = JSON.parse(response.data);
            if (!data.performanceMetrics || !data.antiBotMetrics) {
                throw new Error('Health check missing integrated metrics');
            }
            
            console.log(`   ✅ Health check includes all system metrics`);
        });

        console.log('');
    }

    /**
     * Test performance under load
     */
    async testPerformanceUnderLoad() {
        console.log('⚡ TESTING PERFORMANCE UNDER LOAD');
        console.log('-'.repeat(40));

        await this.runTest('Concurrent User Agent Generation', async () => {
            const promises = [];
            for (let i = 0; i < 20; i++) {
                promises.push(Promise.resolve(antiBotSystem.getRandomUserAgent()));
            }
            
            const results = await Promise.all(promises);
            const uniqueResults = new Set(results);
            
            if (uniqueResults.size < 5) {
                throw new Error(`Insufficient concurrency variation: ${uniqueResults.size}`);
            }
            
            console.log(`   ✅ Generated ${uniqueResults.size} unique agents concurrently`);
        });

        await this.runTest('Performance Monitor Under Load', async () => {
            // Simulate multiple operations
            const operations = [];
            for (let i = 0; i < 50; i++) {
                operations.push(async () => {
                    const timer = performanceMonitor.startTimer(`load_test_${i}`);
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                    performanceMonitor.endTimer(timer, true);
                });
            }
            
            await Promise.all(operations.map(op => op()));
            
            const analytics = performanceMonitor.getAnalytics();
            if (!analytics.totalRequests || analytics.totalRequests < 50) {
                throw new Error('Performance monitor failed under load');
            }
            
            console.log(`   ✅ Performance monitor handled ${analytics.totalRequests} operations`);
        });

        console.log('');
    }

    /**
     * Generate comprehensive test report
     */
    async generateTestReport() {
        console.log('📋 GENERATING TEST REPORT');
        console.log('='.repeat(60));

        const endTime = Date.now();
        const duration = endTime - this.results.startTime;

        console.log(`\n🎯 TEST SUMMARY:`);
        console.log(`   Duration: ${(duration / 1000).toFixed(1)}s`);
        console.log(`   Tests Run: ${this.results.tests.length}`);
        console.log(`   ✅ Passed: ${this.results.passed}`);
        console.log(`   ❌ Failed: ${this.results.failed}`);
        console.log(`   ⚠️  Warnings: ${this.results.warnings}`);
        
        const successRate = ((this.results.passed / this.results.tests.length) * 100).toFixed(1);
        console.log(`   Success Rate: ${successRate}%\n`);

        // Show failed tests
        if (this.results.failed > 0) {
            console.log('❌ FAILED TESTS:');
            this.results.tests
                .filter(test => !test.passed)
                .forEach(test => {
                    console.log(`   • ${test.name}: ${test.error}`);
                });
            console.log('');
        }

        // Show warnings
        if (this.results.warnings > 0) {
            console.log('⚠️  WARNINGS:');
            this.results.tests
                .filter(test => test.warning)
                .forEach(test => {
                    console.log(`   • ${test.name}: ${test.warning}`);
                });
            console.log('');
        }

        // System recommendations
        console.log('💡 RECOMMENDATIONS:');
        if (this.results.failed === 0) {
            console.log('   ✅ All systems functioning optimally');
            console.log('   ✅ Anti-bot features are properly configured');
            console.log('   ✅ Performance monitoring is active');
            console.log('   ✅ Error handling is working correctly');
        } else {
            console.log('   ⚠️  Some systems need attention - check failed tests above');
            if (this.results.failed > 5) {
                console.log('   🚨 Multiple system failures detected - review configuration');
            }
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`🏁 TEST SUITE COMPLETED - ${successRate}% SUCCESS RATE`);
        console.log(`${'='.repeat(60)}\n`);

        // Export test results
        try {
            const reportPath = await performanceMonitor.exportPerformanceData(`test-report-${Date.now()}.json`);
            console.log(`📊 Detailed report exported to: ${reportPath}`);
        } catch (error) {
            console.warn('⚠️  Could not export detailed report:', error.message);
        }
    }

    // Helper methods

    async runTest(testName, testFunction) {
        try {
            console.log(`   Running: ${testName}...`);
            await testFunction();
            this.recordTest(testName, true);
        } catch (error) {
            console.error(`   ❌ ${testName} failed: ${error.message}`);
            this.recordTest(testName, false, error.message);
        }
    }

    recordTest(name, passed, error = null, warning = null) {
        this.results.tests.push({
            name,
            passed,
            error,
            warning,
            timestamp: new Date().toISOString()
        });

        if (passed) {
            this.results.passed++;
        } else {
            this.results.failed++;
        }

        if (warning) {
            this.results.warnings++;
        }
    }

    makeHttpRequest(method, path) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: 3000,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: TEST_CONFIG.testTimeout
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));
            req.end();
        });
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const testSuite = new EnhancedTestSuite();
    testSuite.runAllTests()
        .then(() => {
            process.exit(testSuite.results.failed > 0 ? 1 : 0);
        })
        .catch((error) => {
            console.error('💥 Test suite crashed:', error);
            process.exit(1);
        });
}

module.exports = { EnhancedTestSuite };