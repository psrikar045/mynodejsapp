const puppeteer = require('puppeteer');
const path = require('path');
const { AdaptiveInteractionHandler } = require('./adaptive-interaction-handler');

async function runTest() {
    console.log('--- Starting Adaptive Interaction Handler Test ---');
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        const testPagePath = `file://${path.join(__dirname, 'public', 'test-popup.html')}`;
        console.log(`Navigating to test page: ${testPagePath}`);
        await page.goto(testPagePath);

        const interactionHandler = new AdaptiveInteractionHandler(page);
        await interactionHandler.initialize();

        console.log('Starting MutationObserver to watch for pop-ups...');
        await interactionHandler.startObserver();

        console.log('Waiting for 5 seconds to allow pop-up to appear and be handled...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        const isPopupVisible = await page.evaluate(() => {
            const popup = document.getElementById('popup');
            return popup && popup.style.display !== 'none';
        });

        if (isPopupVisible) {
            throw new Error('Test Failed: Pop-up is still visible.');
        }

        console.log('✅ Test Passed: Pop-up was successfully handled by the observer.');

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
