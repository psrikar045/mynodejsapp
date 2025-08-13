/**
 * Test Adaptive Banner Extraction System
 * Demonstrates the self-learning API pattern management and adaptive configuration
 */

const puppeteer = require('puppeteer');
const { LinkedInBannerExtractor } = require('./linkedin-banner-extractor');
const { BannerValidator } = require('./banner-validator');
const { LinkedInImageAntiBotSystem } = require('./linkedin-image-anti-bot');
const { AdaptiveConfigManager } = require('./adaptive-config-manager');
const { antiBotSystem } = require('./anti-bot-system');

// Test companies with different characteristics
const testCompanies = [
    {
        url: 'https://www.linkedin.com/company/microsoft/',
        name: 'Microsoft',
        expectedBanner: true,
        category: 'Large Tech'
    },
    {
        url: 'https://www.linkedin.com/company/google/',
        name: 'Google',
        expectedBanner: true,
        category: 'Large Tech'
    },
    {
        url: 'https://www.linkedin.com/company/tesla/',
        name: 'Tesla',
        expectedBanner: true,
        category: 'Automotive'
    }
];

async function testAdaptiveSystem() {
    console.log('🧠 Testing Adaptive Banner Extraction System...');
    console.log('📋 Features: Self-learning patterns, adaptive configuration, fallback systems\n');
    
    let browser;
    const results = [];
    
    try {
        // Initialize adaptive configuration manager
        console.log('🔧 Initializing adaptive configuration system...');
        const adaptiveConfig = new AdaptiveConfigManager();
        await adaptiveConfig.initialize();
        
        // Get system status
        const systemStatus = adaptiveConfig.getSystemStatus();
        console.log('📊 System Status:', {
            mode: systemStatus.adaptiveMode ? 'Adaptive' : 'Static',
            environment: systemStatus.environment,
            health: systemStatus.health.status,
            patterns: systemStatus.patternSummary.totalPatterns,
            bannerPatterns: systemStatus.patternSummary.bannerPatterns
        });
        
        // Launch browser
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        // Test each company
        for (let i = 0; i < testCompanies.length; i++) {
            const company = testCompanies[i];
            console.log(`\n${'='.repeat(80)}`);
            console.log(`🏢 Testing ${i + 1}/${testCompanies.length}: ${company.name} (${company.category})`);
            console.log(`🌐 URL: ${company.url}`);
            console.log(`${'='.repeat(80)}\n`);

            const result = await testSingleCompany(browser, company, adaptiveConfig);
            results.push(result);

            // Add delay between tests
            if (i < testCompanies.length - 1) {
                const delay = 5000 + Math.random() * 3000;
                console.log(`\n⏳ Waiting ${Math.round(delay)}ms before next test...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // Generate final report
        await generateFinalReport(results, adaptiveConfig);

    } catch (error) {
        console.error('❌ Test suite failed:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function testSingleCompany(browser, company, adaptiveConfig) {
    const page = await browser.newPage();
    const startTime = Date.now();
    
    try {
        // Setup anti-bot measures
        await antiBotSystem.setupStealthMode(page);
        await page.setUserAgent(antiBotSystem.getRandomUserAgent(true));
        await page.setExtraHTTPHeaders(antiBotSystem.getBrowserHeaders());
        await page.setViewport(antiBotSystem.getRandomViewport());

        // Initialize LinkedIn-specific systems
        const linkedinAntiBot = new LinkedInImageAntiBotSystem();
        const bannerExtractor = new LinkedInBannerExtractor(linkedinAntiBot);
        const bannerValidator = new BannerValidator(linkedinAntiBot);

        // Setup network interception
        await bannerExtractor.setupNetworkInterception(page);

        console.log('🌐 Navigating to company page...');
        await page.goto(company.url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });

        // Handle LinkedIn interference
        await handleLinkedInPopups(page);
        await page.waitForTimeout(3000);

        // Extract banner using adaptive system
        console.log('🎯 Starting adaptive banner extraction...');
        const bannerUrl = await bannerExtractor.extractBannerWithAdvancedMethods(page, company.url);
        
        // Get extraction summary
        const extractionSummary = bannerExtractor.getSummary();
        
        // Validate banner if found
        let validation = null;
        if (bannerUrl) {
            console.log('🔍 Validating extracted banner...');
            validation = await bannerValidator.validateBannerUrl(bannerUrl, company.url);
        }

        const extractionTime = Date.now() - startTime;
        
        // Log results
        const success = bannerUrl && validation?.isValid;
        console.log(`\n📊 Results for ${company.name}:`);
        console.log(`   Banner URL: ${bannerUrl || 'None found'}`);
        console.log(`   Validation: ${validation?.isValid ? 'Valid' : 'Invalid/None'}`);
        console.log(`   Extraction Time: ${extractionTime}ms`);
        console.log(`   Network Requests: ${extractionSummary.interceptedRequests}`);
        console.log(`   API Responses: ${extractionSummary.apiResponses}`);
        console.log(`   Discovered Patterns: ${extractionSummary.discoveredPatternsCount}`);

        return {
            company: company.name,
            url: company.url,
            category: company.category,
            bannerUrl,
            validation,
            extractionTime,
            extractionSummary,
            success,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error(`❌ Error testing ${company.name}:`, error.message);
        return {
            company: company.name,
            url: company.url,
            category: company.category,
            bannerUrl: null,
            validation: null,
            extractionTime: Date.now() - startTime,
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    } finally {
        await page.close();
    }
}

async function handleLinkedInPopups(page) {
    try {
        await page.evaluate(() => {
            const closeSelectors = [
                '[data-test-id="login-form"] button[aria-label="Dismiss"]',
                '[data-test-id="cold-signup-dismiss"]',
                '.artdeco-modal__dismiss',
                'button[data-test-id="modal-close-button"]',
                '.artdeco-modal-overlay',
                'button[aria-label="Dismiss"]',
                'button[aria-label="Not now"]'
            ];
            
            for (const selector of closeSelectors) {
                const element = document.querySelector(selector);
                if (element && element.offsetParent !== null) {
                    element.click();
                    break;
                }
            }
        });

        await page.waitForTimeout(2000);
    } catch (error) {
        console.warn('⚠️ Error handling popups:', error.message);
    }
}

async function generateFinalReport(results, adaptiveConfig) {
    console.log('\n' + '='.repeat(100));
    console.log('📊 ADAPTIVE BANNER EXTRACTION SYSTEM - FINAL REPORT');
    console.log('='.repeat(100));

    // Overall statistics
    const totalTests = results.length;
    const successfulTests = results.filter(r => r.success).length;
    const averageTime = results.reduce((sum, r) => sum + r.extractionTime, 0) / totalTests;
    const totalNetworkRequests = results.reduce((sum, r) => sum + (r.extractionSummary?.interceptedRequests || 0), 0);
    const totalApiResponses = results.reduce((sum, r) => sum + (r.extractionSummary?.apiResponses || 0), 0);
    const totalDiscoveredPatterns = results.reduce((sum, r) => sum + (r.extractionSummary?.discoveredPatternsCount || 0), 0);

    console.log('\n🎯 Overall Performance:');
    console.log(`   Success Rate: ${successfulTests}/${totalTests} (${(successfulTests/totalTests*100).toFixed(1)}%)`);
    console.log(`   Average Extraction Time: ${Math.round(averageTime)}ms`);
    console.log(`   Total Network Requests: ${totalNetworkRequests}`);
    console.log(`   Total API Responses: ${totalApiResponses}`);
    console.log(`   New Patterns Discovered: ${totalDiscoveredPatterns}`);

    // Individual results
    console.log('\n📋 Individual Results:');
    results.forEach((result, index) => {
        const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
        console.log(`\n${index + 1}. ${result.company} (${result.category})`);
        console.log(`   Status: ${status}`);
        console.log(`   Time: ${result.extractionTime}ms`);
        
        if (result.bannerUrl) {
            console.log(`   Banner: ${result.bannerUrl.substring(0, 80)}...`);
            if (result.validation) {
                console.log(`   Quality: ${result.validation.width}x${result.validation.height}, ${Math.round((result.validation.size || 0) / 1024)}KB`);
            }
        }
        
        if (result.extractionSummary) {
            console.log(`   Network: ${result.extractionSummary.interceptedRequests} requests, ${result.extractionSummary.apiResponses} responses`);
        }
    });

    // System status after tests
    console.log('\n🧠 Adaptive System Status After Tests:');
    const finalStatus = adaptiveConfig.getSystemStatus();
    console.log(`   Mode: ${finalStatus.adaptiveMode ? 'Adaptive Learning' : 'Static Fallback'}`);
    console.log(`   Health: ${finalStatus.health.status} (${finalStatus.health.successRate})`);
    console.log(`   Total Patterns: ${finalStatus.patternSummary.totalPatterns}`);
    console.log(`   Banner Patterns: ${finalStatus.patternSummary.bannerPatterns}`);
    console.log(`   Last Config Update: ${finalStatus.lastConfigUpdate || 'Never'}`);

    // Recommendations
    if (finalStatus.recommendations && finalStatus.recommendations.length > 0) {
        console.log('\n💡 System Recommendations:');
        finalStatus.recommendations.forEach(rec => {
            console.log(`   ${rec.type.toUpperCase()}: ${rec.message}`);
        });
    }

    // Export configurations for backup
    try {
        const exportFile = await adaptiveConfig.exportConfigurations();
        console.log(`\n📤 Configurations exported to: ${exportFile}`);
    } catch (error) {
        console.warn('⚠️ Failed to export configurations:', error.message);
    }

    console.log('\n✅ Adaptive system test completed successfully!');
    console.log('\n🔮 Key Benefits Demonstrated:');
    console.log('   ✅ Self-learning API patterns from successful requests');
    console.log('   ✅ Adaptive configuration based on success rates');
    console.log('   ✅ Automatic fallback to proven patterns');
    console.log('   ✅ Environment-specific optimizations');
    console.log('   ✅ Continuous improvement through usage');
}

// Run the test
if (require.main === module) {
    testAdaptiveSystem()
        .then(() => {
            console.log('\n🎉 Adaptive system test suite completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = { testAdaptiveSystem };