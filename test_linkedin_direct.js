// Direct test of LinkedIn scraper without starting the server
const { main } = require('./linkedin_scraper');

async function testLinkedInDirectly() {
    console.log('🧪 Testing LinkedIn scraper directly...');
    
    try {
        // Test with a simple LinkedIn company URL
        const result = await main();
        console.log('✅ Test completed successfully');
        console.log('Result status:', result.status);
        console.log('Company name:', result.name);
        console.log('Has adaptive metrics:', !!result.adaptiveMetrics);
        
        if (result.adaptiveMetrics) {
            console.log('Adaptive metrics:', {
                totalAttempts: result.adaptiveMetrics.totalAttempts,
                successfulExtractions: result.adaptiveMetrics.successfulExtractions,
                botDetections: result.adaptiveMetrics.botDetections,
                adaptiveImprovements: result.adaptiveMetrics.adaptiveImprovements
            });
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Check if it's a specific adaptive system error
        if (error.message.includes('LinkedInAdaptiveConfig') || 
            error.message.includes('adaptiveElementExtraction') ||
            error.message.includes('implementAdaptiveDelay')) {
            console.error('🔍 This appears to be an adaptive system error');
        }
    }
}

testLinkedInDirectly();