const puppeteer = require('puppeteer');
const { NavigationHandler } = require('./navigation_handler.js');

async function runTests() {
    console.log('🚀 Testing NavigationHandler...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    const navigationHandler = new NavigationHandler(page, console);

    // Navigate to the local test page
    await page.goto(`file://${__dirname}/public/test-page.html`);

    let allTestsPassed = true;

    // Test 1: Find element by CSS ID selector
    console.log('🧪 Test 1: Find element by CSS ID selector');
    const elementById = await navigationHandler.findElement([{ type: 'css', value: '#link-by-id' }]);
    if (elementById) {
        console.log('✅ PASSED');
    } else {
        console.error('❌ FAILED');
        allTestsPassed = false;
    }

    // Test 2: Find element by text
    console.log('🧪 Test 2: Find element by text');
    const elementByText = await navigationHandler.findElement([{ type: 'text', value: 'This is a text span.' }]);
    if (elementByText) {
        console.log('✅ PASSED');
    } else {
        console.error('❌ FAILED');
        allTestsPassed = false;
    }

    // Test 3: Find element by ARIA label
    console.log('🧪 Test 3: Find element by ARIA label');
    const elementByAria = await navigationHandler.findElement([{ type: 'aria', value: 'aria-label-p' }]);
    if (elementByAria) {
        console.log('✅ PASSED');
    } else {
        console.error('❌ FAILED');
        allTestsPassed = false;
    }

    // Test 4: Click an onscreen element
    console.log('🧪 Test 4: Click an onscreen element');
    const onscreenButton = await navigationHandler.findElement([{ type: 'css', value: '#click-me' }]);
    await navigationHandler.clickElement(onscreenButton);
    const clickResult = await page.$eval('#click-result', el => el.innerText);
    if (clickResult === 'Clicked!') {
        console.log('✅ PASSED');
    } else {
        console.error('❌ FAILED');
        allTestsPassed = false;
    }

    // Test 5: Click an offscreen element
    console.log('🧪 Test 5: Click an offscreen element');
    const offscreenButton = await navigationHandler.findElement([{ type: 'css', value: '#offscreen-btn' }]);
    await navigationHandler.clickElement(offscreenButton);
    const offscreenClickResult = await page.$eval('#offscreen-result', el => el.innerText);
    if (offscreenClickResult === 'Offscreen Clicked!') {
        console.log('✅ PASSED');
    } else {
        console.error('❌ FAILED');
        allTestsPassed = false;
    }

    await browser.close();

    if (allTestsPassed) {
        console.log('\n✅ All NavigationHandler tests passed!');
    } else {
        console.error('\n❌ Some NavigationHandler tests failed.');
        process.exit(1);
    }
}

runTests();
