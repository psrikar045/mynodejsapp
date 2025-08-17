const puppeteer = require('puppeteer');
const { scrapeLinkedInCompany } = require('./linkedin_scraper');

// Use the URL provided by the user for debugging
const testUrl = 'https://www.linkedin.com/company/versa-networks/mycompany/';

(async () => {
    let browser;
    try {
        console.log('--- Starting Debug Run ---');
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        console.log(`Scraping debug URL in DRY RUN mode: ${testUrl}`);

        const scrapingPromise = scrapeLinkedInCompany(testUrl, browser, null, { dryRun: true });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Scraping function timed out after 3 minutes')), 180000)
        );

        const companyData = await Promise.race([
            scrapingPromise,
            timeoutPromise
        ]);

        console.log('--- DEBUG RUN OUTPUT ---');
        console.log(JSON.stringify(companyData, null, 2));
        console.log('------------------------');

    } catch (error) {
        console.error('Debug script failed with an error:', error);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
        console.log('--- Debug Run Finished ---');
    }
})();
