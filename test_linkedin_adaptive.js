// Test script to identify specific adaptive scraper errors
const { main } = require('./linkedin_scraper');

async function testLinkedInScraper() {
    console.log('🧪 Testing LinkedIn scraper with adaptive system...');
    
    try {
        // Test with a simple LinkedIn company URL
        const result = await main();
        console.log('✅ Test completed successfully:', result);
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

testLinkedInScraper();