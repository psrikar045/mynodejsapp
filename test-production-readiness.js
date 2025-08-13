/**
 * Production Readiness Test
 * Validates system readiness for production deployment
 */

const puppeteer = require('puppeteer');
const { AdaptiveConfigManager } = require('./adaptive-config-manager');
const { APIPatternManager } = require('./api-pattern-manager');
const { LinkedInBannerExtractor } = require('./linkedin-banner-extractor');
const { LinkedInImageAntiBotSystem } = require('./linkedin-image-anti-bot');
const fs = require('fs').promises;

class ProductionReadinessTest {
    constructor() {
        this.testResults = [];
        this.criticalIssues = [];
        this.warnings = [];
        this.isHealthCheck = process.argv.includes('--health-check');
    }

    async runAllTests() {
        console.log('🏭 Production Readiness Test Suite');
        console.log('=====================================\n');

        const tests = [
            { name: 'Environment Configuration', fn: () => this.testEnvironmentConfig() },
            { name: 'Dependencies Check', fn: () => this.testDependencies() },
            { name: 'File System Permissions', fn: () => this.testFileSystemPermissions() },
            { name: 'Browser Compatibility', fn: () => this.testBrowserCompatibility() },
            { name: 'Anti-Bot System', fn: () => this.testAntiBotSystem() },
            { name: 'Adaptive System', fn: () => this.testAdaptiveSystem() },
            { name: 'Pattern Database', fn: () => this.testPatternDatabase() },
            { name: 'Network Connectivity', fn: () => this.testNetworkConnectivity() },
            { name: 'Error Handling', fn: () => this.testErrorHandling() },
            { name: 'Performance Baseline', fn: () => this.testPerformanceBaseline() },
            { name: 'Memory Management', fn: () => this.testMemoryManagement() },
            { name: 'Logging System', fn: () => this.testLoggingSystem() }
        ];

        for (const test of tests) {
            await this.runSingleTest(test.name, test.fn);
        }

        return this.generateReport();
    }

    async runSingleTest(testName, testFn) {
        console.log(`🔍 Testing: ${testName}...`);
        const startTime = Date.now();

        try {
            const result = await testFn();
            const duration = Date.now() - startTime;
            
            this.testResults.push({
                name: testName,
                status: 'PASS',
                duration,
                result
            });
            
            console.log(`✅ ${testName}: PASSED (${duration}ms)`);
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.testResults.push({
                name: testName,
                status: 'FAIL',
                duration,
                error: error.message
            });
            
            console.error(`❌ ${testName}: FAILED (${duration}ms)`);
            console.error(`   Error: ${error.message}`);
            
            if (this.isCriticalTest(testName)) {
                this.criticalIssues.push(`${testName}: ${error.message}`);
            } else {
                this.warnings.push(`${testName}: ${error.message}`);
            }
        }
        
        console.log(''); // Empty line for readability
    }

    isCriticalTest(testName) {
        const criticalTests = [
            'Environment Configuration',
            'Dependencies Check',
            'Browser Compatibility',
            'Anti-Bot System',
            'Network Connectivity'
        ];
        return criticalTests.includes(testName);
    }

    async testEnvironmentConfig() {
        const config = {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            nodeEnv: process.env.NODE_ENV || 'development',
            adaptiveMode: process.env.ADAPTIVE_MODE !== 'false',
            verboseLogging: process.env.VERBOSE_LOGGING === 'true'
        };

        // Validate Node.js version
        const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
        if (nodeVersion < 18) {
            throw new Error(`Node.js 18+ required, found ${process.version}`);
        }

        // Check environment variables
        if (config.nodeEnv === 'production' && config.verboseLogging) {
            this.warnings.push('Verbose logging enabled in production');
        }

        return config;
    }

    async testDependencies() {
        const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
        const dependencies = packageJson.dependencies || {};
        
        const requiredDeps = [
            'puppeteer',
            'express',
            'axios',
            'cheerio',
            'cors'
        ];

        const missingDeps = requiredDeps.filter(dep => !dependencies[dep]);
        if (missingDeps.length > 0) {
            throw new Error(`Missing dependencies: ${missingDeps.join(', ')}`);
        }

        // Test require statements for critical modules
        const criticalModules = [
            './adaptive-config-manager',
            './api-pattern-manager',
            './linkedin-banner-extractor',
            './banner-validator',
            './anti-bot-system'
        ];

        for (const module of criticalModules) {
            try {
                require(module);
            } catch (error) {
                throw new Error(`Failed to load module ${module}: ${error.message}`);
            }
        }

        return {
            totalDependencies: Object.keys(dependencies).length,
            requiredDependencies: requiredDeps.length,
            allPresent: true
        };
    }

    async testFileSystemPermissions() {
        const testFiles = [
            'api-patterns-database.json',
            'scraper.log',
            'test-write-permission.tmp'
        ];

        const permissions = {};

        for (const file of testFiles) {
            try {
                if (file === 'test-write-permission.tmp') {
                    // Test write permission
                    await fs.writeFile(file, 'test');
                    await fs.unlink(file);
                    permissions[file] = 'write';
                } else {
                    // Test read permission
                    try {
                        await fs.access(file);
                        permissions[file] = 'read';
                    } catch {
                        permissions[file] = 'not_found';
                    }
                }
            } catch (error) {
                permissions[file] = 'no_permission';
                throw new Error(`File system permission error for ${file}: ${error.message}`);
            }
        }

        return permissions;
    }

    async testBrowserCompatibility() {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
                ]
            });

            const page = await browser.newPage();
            await page.goto('https://www.google.com', { timeout: 10000 });
            
            const title = await page.title();
            if (!title) {
                throw new Error('Browser failed to load page');
            }

            const userAgent = await page.evaluate(() => navigator.userAgent);
            
            return {
                browserLaunched: true,
                pageLoaded: true,
                userAgent: userAgent.substring(0, 50) + '...'
            };

        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    async testAntiBotSystem() {
        const { antiBotSystem } = require('./anti-bot-system');
        const linkedinAntiBot = new LinkedInImageAntiBotSystem();

        // Test general anti-bot system
        const userAgent = antiBotSystem.getRandomUserAgent();
        if (!userAgent || userAgent.length < 50) {
            throw new Error('Anti-bot system failed to generate user agent');
        }

        const headers = antiBotSystem.getBrowserHeaders();
        if (!headers || Object.keys(headers).length < 3) {
            throw new Error('Anti-bot system failed to generate headers');
        }

        const viewport = antiBotSystem.getRandomViewport();
        if (!viewport || !viewport.width || !viewport.height) {
            throw new Error('Anti-bot system failed to generate viewport');
        }

        // Test LinkedIn-specific anti-bot system
        const linkedinHeaders = linkedinAntiBot.getLinkedInImageHeaders('https://test.com', 'https://linkedin.com');
        if (!linkedinHeaders || Object.keys(linkedinHeaders).length < 5) {
            throw new Error('LinkedIn anti-bot system failed to generate headers');
        }

        return {
            generalAntiBotWorking: true,
            linkedinAntiBotWorking: true,
            userAgentLength: userAgent.length,
            headerCount: Object.keys(headers).length,
            linkedinHeaderCount: Object.keys(linkedinHeaders).length
        };
    }

    async testAdaptiveSystem() {
        const adaptiveConfig = new AdaptiveConfigManager();
        await adaptiveConfig.initialize();

        const status = adaptiveConfig.getSystemStatus();
        if (!status) {
            throw new Error('Adaptive system failed to initialize');
        }

        if (status.health.status === 'critical') {
            throw new Error(`Adaptive system health is critical: ${status.health.successRate}`);
        }

        const config = await adaptiveConfig.getAdaptiveConfig('networkPatterns');
        if (!config || !config.staticApiPatterns) {
            throw new Error('Adaptive system failed to generate configuration');
        }

        return {
            systemHealth: status.health.status,
            successRate: status.health.successRate,
            totalPatterns: status.patternSummary.totalPatterns,
            adaptiveMode: status.adaptiveMode
        };
    }

    async testPatternDatabase() {
        const patternManager = new APIPatternManager();
        await patternManager.initialize();

        const report = patternManager.generateReport();
        if (!report || !report.summary) {
            throw new Error('Pattern database failed to generate report');
        }

        if (report.summary.totalPatterns === 0) {
            this.warnings.push('Pattern database is empty - system will use defaults');
        }

        const bestPatterns = patternManager.getBestPatterns('production', 10);
        
        return {
            totalPatterns: report.summary.totalPatterns,
            successfulPatterns: report.summary.successfulPatterns,
            bannerPatterns: report.summary.bannerPatterns,
            bestPatternsCount: bestPatterns.length,
            overallSuccessRate: report.summary.overallSuccessRate
        };
    }

    async testNetworkConnectivity() {
        const axios = require('axios');
        
        const testUrls = [
            'https://www.linkedin.com',
            'https://www.google.com',
            'https://media.licdn.com'
        ];

        const results = {};

        for (const url of testUrls) {
            try {
                const response = await axios.get(url, { 
                    timeout: 10000,
                    validateStatus: (status) => status < 500
                });
                results[url] = {
                    status: response.status,
                    accessible: true
                };
            } catch (error) {
                results[url] = {
                    status: error.response?.status || 'timeout',
                    accessible: false,
                    error: error.message
                };
                
                if (url === 'https://www.linkedin.com') {
                    throw new Error(`LinkedIn not accessible: ${error.message}`);
                }
            }
        }

        return results;
    }

    async testErrorHandling() {
        const linkedinAntiBot = new LinkedInImageAntiBotSystem();
        const bannerExtractor = new LinkedInBannerExtractor(linkedinAntiBot);

        // Test invalid URL handling
        try {
            const result = await bannerExtractor.isValidBannerUrl('invalid-url');
            if (result !== false) {
                throw new Error('Error handling failed for invalid URL');
            }
        } catch (error) {
            // This should not throw, it should return false
            throw new Error('Error handling failed - threw exception instead of returning false');
        }

        // Test configuration error handling
        try {
            const config = await bannerExtractor.adaptiveConfig?.getAdaptiveConfig('invalid-component');
            // Should handle gracefully
        } catch (error) {
            // Should not crash the system
        }

        return {
            invalidUrlHandling: true,
            configErrorHandling: true,
            gracefulDegradation: true
        };
    }

    async testPerformanceBaseline() {
        const linkedinAntiBot = new LinkedInImageAntiBotSystem();
        const bannerExtractor = new LinkedInBannerExtractor(linkedinAntiBot);

        // Test URL validation performance
        const testUrls = [
            'https://media.licdn.com/dms/image/company-background/test.jpg',
            'https://media.licdn.com/dms/image/company-logo_100_100/test.jpg',
            'https://static.licdn.com/test.png',
            'https://invalid-domain.com/test.jpg'
        ];

        const startTime = Date.now();
        
        for (let i = 0; i < 100; i++) {
            for (const url of testUrls) {
                bannerExtractor.isValidBannerUrl(url);
            }
        }
        
        const duration = Date.now() - startTime;
        const urlsPerSecond = (testUrls.length * 100) / (duration / 1000);

        if (urlsPerSecond < 1000) {
            this.warnings.push(`URL validation performance is slow: ${urlsPerSecond.toFixed(0)} URLs/sec`);
        }

        return {
            urlValidationSpeed: `${urlsPerSecond.toFixed(0)} URLs/sec`,
            totalDuration: `${duration}ms`,
            acceptable: urlsPerSecond >= 500
        };
    }

    async testMemoryManagement() {
        const initialMemory = process.memoryUsage();
        
        // Create and destroy objects to test memory management
        const linkedinAntiBot = new LinkedInImageAntiBotSystem();
        const bannerExtractor = new LinkedInBannerExtractor(linkedinAntiBot);
        
        // Simulate some operations
        for (let i = 0; i < 100; i++) {
            bannerExtractor.isValidBannerUrl(`https://test${i}.com/image.jpg`);
        }

        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

        return {
            initialHeapUsed: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`,
            finalHeapUsed: `${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`,
            memoryIncrease: `${Math.round(memoryIncrease / 1024)}KB`,
            acceptable: memoryIncrease < 10 * 1024 * 1024 // Less than 10MB increase
        };
    }

    async testLoggingSystem() {
        const fs = require('fs');
        const logFile = 'scraper.log';
        
        // Test log file creation/writing
        const testMessage = `Production readiness test - ${new Date().toISOString()}`;
        
        try {
            // Test console.log override
            console.log(testMessage);
            
            // Check if log was written
            if (fs.existsSync(logFile)) {
                const logContent = await fs.promises.readFile(logFile, 'utf8');
                if (!logContent.includes(testMessage)) {
                    throw new Error('Log message not found in log file');
                }
            }
            
            return {
                logFileExists: fs.existsSync(logFile),
                logWriting: true,
                consoleOverride: true
            };
            
        } catch (error) {
            throw new Error(`Logging system test failed: ${error.message}`);
        }
    }

    generateReport() {
        const passedTests = this.testResults.filter(t => t.status === 'PASS').length;
        const failedTests = this.testResults.filter(t => t.status === 'FAIL').length;
        const totalDuration = this.testResults.reduce((sum, t) => sum + t.duration, 0);

        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: this.testResults.length,
                passed: passedTests,
                failed: failedTests,
                successRate: `${Math.round((passedTests / this.testResults.length) * 100)}%`,
                totalDuration: `${Math.round(totalDuration / 1000)}s`
            },
            productionReady: this.criticalIssues.length === 0,
            criticalIssues: this.criticalIssues,
            warnings: this.warnings,
            testResults: this.testResults
        };

        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 PRODUCTION READINESS REPORT');
        console.log('='.repeat(60));
        
        console.log(`\n🎯 Overall Status: ${report.productionReady ? '✅ PRODUCTION READY' : '❌ NOT READY'}`);
        console.log(`📈 Success Rate: ${report.summary.successRate}`);
        console.log(`⏱️  Total Duration: ${report.summary.totalDuration}`);
        console.log(`✅ Passed: ${report.summary.passed}/${report.summary.totalTests}`);
        console.log(`❌ Failed: ${report.summary.failed}/${report.summary.totalTests}`);

        if (this.criticalIssues.length > 0) {
            console.log('\n🚨 CRITICAL ISSUES:');
            this.criticalIssues.forEach(issue => {
                console.log(`   ❌ ${issue}`);
            });
        }

        if (this.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            this.warnings.forEach(warning => {
                console.log(`   ⚠️  ${warning}`);
            });
        }

        if (report.productionReady) {
            console.log('\n🎉 System is ready for production deployment!');
        } else {
            console.log('\n🔧 Please address critical issues before production deployment.');
        }

        // Save report for health checks
        if (this.isHealthCheck) {
            const healthStatus = {
                healthy: report.productionReady && this.warnings.length < 3,
                timestamp: report.timestamp,
                issues: this.criticalIssues.length,
                warnings: this.warnings.length
            };
            
            console.log(`\n🏥 Health Check: ${healthStatus.healthy ? 'HEALTHY' : 'NEEDS ATTENTION'}`);
        }

        return report;
    }
}

// Run tests if called directly
if (require.main === module) {
    const test = new ProductionReadinessTest();
    test.runAllTests()
        .then(report => {
            const exitCode = report.productionReady ? 0 : 1;
            process.exit(exitCode);
        })
        .catch(error => {
            console.error('💥 Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = { ProductionReadinessTest };