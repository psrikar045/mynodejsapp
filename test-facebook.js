const { scrapeFacebookCompany } = require('./facebook_scraper/facebook_scraper.js');

async function testFacebookScraper() {
    console.log('🚀 Testing Facebook scraper with three-stage fallback...');
    const url = 'https://www.facebook.com/Meta';
    console.log(`🔍 Testing URL: ${url}`);

    try {
        console.log('⏳ Starting extraction...');
        const startTime = Date.now();

        const result = await scrapeFacebookCompany(url);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`⏱️  Extraction completed in ${duration} seconds`);

        console.log('\n=== FINAL RESULT ===');
        console.log(JSON.stringify(result, null, 2));

        if (result && (result.status.startsWith('Success')) && result.companyName) {
            console.log(`\n✅ SUCCESS: Facebook data extracted with status: ${result.status}`);
            console.log('📛 Company Name:', result.companyName);
            console.log('ℹ️  Description:', result.description ? `✅ Found (${result.description.substring(0, 50)}...)` : '❌ Not found');
            console.log('🌐 Website:', result.website ? `✅ Found` : '❌ Not found');
        } else {
            console.log('\n❌ FAILED: No meaningful data extracted');
            if (result && result.error) {
                console.log('🚨 Error:', result.error);
            }
            process.exit(1);
        }
    } catch (error) {
        console.error('\n💥 CRITICAL ERROR:', error);
        process.exit(1);
    }
}

testFacebookScraper();
