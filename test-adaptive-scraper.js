/**
 * Test script for LinkedIn Adaptive Scraper
 * Tests the self-learning bot detection system
 */

const { LinkedInAdaptiveScraper } = require('./linkedin-adaptive-scraper');
const { LinkedInAdaptiveConfig } = require('./linkedin-adaptive-config');

async function testAdaptiveScraper() {
    console.log('🧪 [Test] Starting LinkedIn Adaptive Scraper test...');
    
    try {
        // Test 1: Initialize adaptive scraper
        console.log('\n📋 [Test 1] Initializing adaptive scraper...');
        const scraper = new LinkedInAdaptiveScraper();
        await scraper.initializeAdaptiveConfig();
        console.log('✅ [Test 1] Adaptive scraper initialized successfully');
        
        // Test 2: Test adaptive delays
        console.log('\n📋 [Test 2] Testing adaptive delays...');
        const startTime = Date.now();
        await scraper.implementAdaptiveDelay('test_context', null);
        const delayTime = Date.now() - startTime;
        console.log(`✅ [Test 2] Adaptive delay completed: ${delayTime}ms`);
        
        // Test 3: Test configuration manager
        console.log('\n📋 [Test 3] Testing configuration manager...');
        const config = new LinkedInAdaptiveConfig();
        await config.initialize();
        const stats = config.getStats();
        console.log('✅ [Test 3] Configuration manager stats:', stats);
        
        // Test 4: Test delay pattern learning
        console.log('\n📋 [Test 4] Testing delay pattern learning...');
        await config.updateDelayPattern('test_pattern', 2500, true);
        await config.updateDelayPattern('test_pattern', 3000, true);
        await config.updateDelayPattern('test_pattern', 2000, false);
        const optimalDelay = config.getOptimalDelay('test_pattern');
        console.log('✅ [Test 4] Learned delay pattern:', optimalDelay);
        
        // Test 5: Test selector learning
        console.log('\n📋 [Test 5] Testing selector learning...');
        await config.updateSelectorSuccess('companyName', 'h1.test-selector', true);
        await config.updateSelectorSuccess('companyName', 'h1.test-selector', true);
        await config.updateSelectorSuccess('companyName', 'h1.bad-selector', false);
        const bestSelectors = config.getBestSelectors('companyName', 5);
        console.log('✅ [Test 5] Best learned selectors:', bestSelectors);
        
        // Test 6: Test metrics
        console.log('\n📋 [Test 6] Testing metrics collection...');
        const metrics = scraper.getMetrics();
        console.log('✅ [Test 6] Scraper metrics:', {
            totalAttempts: metrics.totalAttempts,
            successfulExtractions: metrics.successfulExtractions,
            configInitialized: metrics.configInitialized,
            sessionId: metrics.sessionId
        });
        
        // Test 7: Test configuration export/import
        console.log('\n📋 [Test 7] Testing configuration export/import...');
        const exportedConfig = await config.exportConfig();
        console.log('✅ [Test 7] Configuration exported successfully');
        console.log('📊 [Test 7] Export stats:', exportedConfig.stats);
        
        console.log('\n🎉 [Test Complete] All tests passed successfully!');
        console.log('🧠 [Summary] Adaptive scraper is ready for self-learning bot detection');
        
        return {
            success: true,
            message: 'All tests passed',
            metrics: metrics,
            configStats: stats
        };
        
    } catch (error) {
        console.error('❌ [Test Failed]', error.message);
        return {
            success: false,
            error: error.message,
            stack: error.stack
        };
    }
}

// Run test if called directly
if (require.main === module) {
    testAdaptiveScraper()
        .then(result => {
            console.log('\n📋 [Final Result]', result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 [Critical Error]', error);
            process.exit(1);
        });
}

module.exports = { testAdaptiveScraper };