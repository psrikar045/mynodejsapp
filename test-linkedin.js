const scraperLink = require('./scrapeLinkedIn');

async function testLinkedInScraper() {
    try {
        console.log('🚀 Testing LinkedIn scraper with enhanced fixes...');
        console.log('🔍 Testing URL: https://www.linkedin.com/company/versa-networks/');
        
        // Write test URL to urls.txt (try both URLs)
        const fs = require('fs').promises;
        await fs.writeFile('urls.txt', 'https://www.linkedin.com/company/versa-networks/');
        
        console.log('⏳ Starting extraction...');
        const startTime = Date.now();
        
        // Run the scraper
        const result = await scraperLink.main();
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`⏱️  Extraction completed in ${duration} seconds`);
        
        console.log('\n=== FINAL RESULT ===');
        console.log(JSON.stringify(result, null, 2));
        
        // Check if extraction was successful
        if (result && result.name && result.name !== 'Join' && result.name !== '') {
            console.log('\n✅ SUCCESS: Company data extracted!');
            console.log('📛 Company Name:', result.name);
            console.log('📝 Description:', result.aboutUs ? `${result.aboutUs.substring(0, 150)}...` : '❌ Not found');
            console.log('🏭 Industry:', result.industry || '❌ Not found');
            console.log('📅 Founded:', result.founded || '❌ Not found');
            console.log('🏢 Headquarters:', result.headquarters || result.location || '❌ Not found');
            console.log('🖼️  Logo URL:', result.logoUrl ? '✅ Found' : '❌ Not found');
            
            if (result.aboutUs && result.aboutUs.length > 50) {
                console.log('\n🎉 EXCELLENT: About Us section successfully extracted!');
            } else {
                console.log('\n⚠️  WARNING: About Us section missing or too short');
            }
        } else {
            console.log('\n❌ FAILED: No meaningful data extracted');
            console.log('❓ Possible issues:');
            console.log('  - Login popup not properly dismissed');
            console.log('  - Page structure changed');
            console.log('  - IP blocked by LinkedIn');
            console.log('  - About tab navigation failed');
            
            if (result && result.error) {
                console.log('🚨 Error:', result.error);
            }
        }
        
        // Read and display output.json for verification
        try {
            const outputData = await fs.readFile('output.json', 'utf8');
            console.log('\n📄 Output.json contents:');
            console.log(outputData);
        } catch (e) {
            console.log('❌ Could not read output.json');
        }
        
    } catch (error) {
        console.error('\n💥 CRITICAL ERROR:', error);
        console.log('\n🔧 Troubleshooting tips:');
        console.log('1. Check if Chrome/Chromium is properly installed');
        console.log('2. Verify internet connection');
        console.log('3. Try running with --headful to see browser behavior');
        console.log('4. Check if LinkedIn is blocking your IP');
    }
}

console.log('🔧 Enhanced LinkedIn Scraper Test');
console.log('================================');
testLinkedInScraper();