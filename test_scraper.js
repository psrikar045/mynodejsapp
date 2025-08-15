const puppeteer = require('puppeteer');
const { scrapeLinkedInCompany } = require('./linkedin_scraper');

const testUrl = 'https://www.linkedin.com/company/versa-networks?trk=organization_guest_main-feed-card_feed-actor-image';

(async () => {
    let browser;
    try {
        console.log('Starting test...');
        browser = await puppeteer.launch({
            headless: true, // Use headless mode for testing
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        console.log(`Scraping test URL: ${testUrl}`);
        const companyData = await scrapeLinkedInCompany(testUrl, browser);

        console.log('--- SCRAPED DATA ---');
        console.log(JSON.stringify(companyData, null, 2));
        console.log('--------------------');

        console.log('--- VERIFYING DATA ---');
        console.assert(companyData, 'Test Failed: companyData is null or undefined.');
        console.assert(companyData.status === 'Success', `Test Failed: Scrape status was not 'Success', it was '${companyData.status}'`);
        console.assert(companyData.name, 'Test Failed: Company name is missing.');
        console.assert(companyData.description, 'Test Failed: Company description is missing.');
        console.assert(companyData.logoUrl, 'Test Failed: Company logoUrl is missing.');
        console.assert(companyData.bannerUrl, 'Test Failed: Company bannerUrl is missing.');

        console.log('----------------------');
        console.log('Test assertions complete. Check console for any assertion failures.');

    } catch (error) {
        console.error('Test script failed with an error:', error);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
        console.log('Test finished.');
    }
})();
