const { scrapeFacebookCompany } = require('./facebook_scraper/facebook_scraper.js');

async function testFacebookScraper() {
    console.log('🚀 Testing Facebook scraper...');
    const url = 'https://www.facebook.com/Meta';
    console.log(`🔍 Testing URL: ${url}`);

    try {
        console.log('⏳ Starting extraction...');
        const startTime = Date.now();

        // The scraper function now handles its own browser management
        const result = await scrapeFacebookCompany(url);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`⏱️  Extraction completed in ${duration} seconds`);

        console.log('\n=== FINAL RESULT ===');
        console.log(JSON.stringify(result, null, 2));

        if (result && result.status === 'Success' && result.companyName) {
            console.log('\n✅ SUCCESS: Facebook data extracted!');
            console.log('📛 Company Name:', result.companyName);
            console.log('👍 Likes:', result.likes || '❌ Not found');
            console.log('👥 Followers:', result.followers || '❌ Not found');
            console.log('✅ Verified:', result.verified);
            console.log('🖼️  Profile Image:', result.profileImage ? '✅ Found' : '❌ Not found');
            console.log('🖼️  Banner Image:', result.bannerImage ? '✅ Found' : '❌ Not found');
            console.log('ℹ️  About:', result.description ? `✅ Found (${result.description.substring(0, 50)}...)` : '❌ Not found');
        } else {
            console.log('\n❌ FAILED: No meaningful data extracted');
            if (result && result.error) {
                console.log('🚨 Error:', result.error);
            }
        }
    } catch (error) {
        console.error('\n💥 CRITICAL ERROR:', error);
    }
}

testFacebookScraper();
