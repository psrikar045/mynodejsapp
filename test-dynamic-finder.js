const puppeteer = require('puppeteer');
const path = require('path');
const { DynamicDataFinder } = require('./dynamic-data-finder.js');

async function runTest() {
    console.log('--- Starting Dynamic Data Finder Isolation Test ---');
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        const testPagePath = `file://${path.join(__dirname, 'public', 'test-popup.html')}`;
        console.log(`Navigating to test page: ${testPagePath}`);
        await page.goto(testPagePath);

        // Test the new module in isolation
        const dataFinder = new DynamicDataFinder(page);
        const additionalInfo = await dataFinder.findAll();

        console.log('--- ADDITIONAL INFO ---');
        console.log(JSON.stringify(additionalInfo, null, 2));
        console.log('-----------------------');

        console.assert(additionalInfo, 'Test Failed: additionalInfo object is null or undefined.');
        console.assert(typeof additionalInfo === 'object', 'Test Failed: additionalInfo is not an object.');
        console.assert(additionalInfo.h1Tags.includes('Test Page'), 'Test Failed: H1 tag was not extracted correctly.');

        console.log('✅ Test Passed: DynamicDataFinder ran successfully.');

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
        console.log('--- Test Finished ---');
    }
}

runTest();
