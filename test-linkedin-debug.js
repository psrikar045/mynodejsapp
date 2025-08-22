const { scrapeLinkedInCompany } = require('./linkedin_scraper');
const puppeteer = require('puppeteer');

async function testLinkedInScraper() {
    console.log('🧪 Testing LinkedIn Scraper...');
    
    const testUrl = 'https://www.linkedin.com/company/microsoft/';
    
    let browser;
    try {
        // Launch browser with minimal configuration
        browser = await puppeteer.launch({
            headless: false, // Run in visible mode for debugging
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ],
            defaultViewport: { width: 1366, height: 768 }
        });
        
        console.log('✅ Browser launched successfully');
        
        // Test the scraper
        const result = await scrapeLinkedInCompany(testUrl, browser);
        
        console.log('📊 Scraping Result:');
        console.log('Status:', result.status);
        console.log('Name:', result.name || 'NOT FOUND');
        console.log('Description:', result.description ? result.description.substring(0, 100) + '...' : 'NOT FOUND');
        console.log('Industry:', result.industry || 'NOT FOUND');
        console.log('Founded:', result.founded || 'NOT FOUND');
        console.log('Logo URL:', result.logoUrl || 'NOT FOUND');
        console.log('Banner URL:', result.bannerUrl || 'NOT FOUND');
        
        if (result.error) {
            console.log('❌ Error:', result.error);
            console.log('Error Category:', result.errorCategory);
            if (result.debugInfo) {
                console.log('Debug Info:', result.debugInfo);
            }
        }
        
        // Save result to file for inspection
        const fs = require('fs').promises;
        await fs.writeFile('linkedin_test_result.json', JSON.stringify(result, null, 2));
        console.log('💾 Result saved to linkedin_test_result.json');
        
    } catch (error) {
        console.error('💥 Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        if (browser) {
            await browser.close();
            console.log('🔒 Browser closed');
        }
    }
}

// Run the test
testLinkedInScraper().then(() => {
    console.log('🏁 Test completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Test script failed:', error);
    process.exit(1);
});