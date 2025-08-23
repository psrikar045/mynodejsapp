// Simple test to verify both scrapers work independently
const { main: linkedinMain } = require('./linkedin_scraper');
const { scrapeFacebookCompany } = require('./facebook_scraper/facebook_scraper');
const fs = require('fs').promises;
const { sanitizeForLogging, sanitizeUrl, sanitizeObjectForLogging } = require('./utils/input-sanitizer');

async function testLinkedInScraper() {
    console.log('🔍 Testing LinkedIn Scraper...');
    try {
        // Write test URL to urls.txt
        await fs.writeFile('urls.txt', 'https://www.linkedin.com/company/versa-networks/');
        
        const result = await linkedinMain();
        console.log('✅ LinkedIn Scraper Result:', {
            name: result?.name || 'Missing',
            industry: result?.industry || 'Missing',
            headquarters: result?.headquarters || 'Missing',
            founded: result?.founded || 'Missing',
            description: result?.description ? 'Found' : 'Missing',
            status: result?.status || 'Unknown'
        });
        return result;
    } catch (error) {
        console.error('❌ LinkedIn Scraper Error:', sanitizeForLogging(error.message));
        return { error: error.message };
    }
}

async function testFacebookScraper() {
    console.log('🔍 Testing Facebook Scraper...');
    try {
        const result = await scrapeFacebookCompany('https://www.facebook.com/VersaNetworks', 'test_session_123');
        console.log('✅ Facebook Scraper Result:', {
            companyName: result?.companyName || 'Missing',
            description: result?.description ? 'Found' : 'Missing',
            profileImage: result?.profileImage ? 'Found' : 'Missing',
            status: result?.status || 'Unknown'
        });
        return result;
    } catch (error) {
        console.error('❌ Facebook Scraper Error:', error.message);
        return { error: error.message };
    }
}

async function runTests() {
    console.log('🚀 Starting Independent Scraper Tests...\n');
    
    const linkedinResult = await testLinkedInScraper();
    console.log('\n' + '='.repeat(50) + '\n');
    const facebookResult = await testFacebookScraper();
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary:');
    console.log('LinkedIn Success:', !linkedinResult?.error);
    console.log('Facebook Success:', !facebookResult?.error);
    console.log('='.repeat(50));
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { testLinkedInScraper, testFacebookScraper, runTests };