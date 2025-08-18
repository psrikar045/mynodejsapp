const puppeteer = require('puppeteer-extra');
const puppeteerCore = require('puppeteer');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { antiBotSystem } = require('../anti-bot-system');
const { extractionLogger } = require('../extraction-logger');
const { NavigationHandler } = require('../navigation_handler.js'); // Import NavigationHandler
const { FacebookDataExtractor } = require('./data_extractor.js');
const fs = require('fs').promises;
const axios = require('axios');

puppeteer.use(StealthPlugin());

function extractApiTokens(pageContent) {
    const jazoestMatch = pageContent.match(/name="jazoest" value="(\d+)"/);
    const lsdMatch = pageContent.match(/"LSD",\[\],{"token":"([^"]+)"}/);
    const jazoest = jazoestMatch ? jazoestMatch[1] : null;
    const lsd = lsdMatch ? lsdMatch[1] : null;
    return { jazoest, lsd };
}

async function fetchAboutDataViaApi(page, url, tokens, sessionId) {
    extractionLogger.step('Attempting to fetch "About" data via API...', { url }, sessionId);

    const { jazoest, lsd } = tokens;
    if (!jazoest || !lsd) {
        throw new Error('Missing jazoest or lsd token for API call.');
    }

    const cookies = await page.cookies();
    const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    const apiUrl = new URL('/api/graphql/', url).href;

    const formData = {
        'jazoest': jazoest,
        'lsd': lsd,
        'fb_api_caller_class': 'RelayModern',
        'fb_api_req_friendly_name': 'CometProfileAboutAppSectionQuery',
        'variables': JSON.stringify({
            "scale": 1,
            "sectionName": "CONTACT_INFO",
            "pageID": "100063539252542" // This is the page ID for Meta, it needs to be dynamic
        }),
        'doc_id': '56488' // This also needs to be dynamic
    };

    const headers = {
        'Cookie': cookieString,
        'User-Agent': await page.evaluate(() => navigator.userAgent),
        'Referer': url,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-FB-LSD': lsd,
    };

    try {
        const response = await axios.post(apiUrl, new URLSearchParams(formData), { headers });
        extractionLogger.info('Successfully fetched data from Facebook API.', null, sessionId);

        const responseData = response.data;
        console.log('API Response Data:', JSON.stringify(responseData, null, 2));

        const extractedData = {
            companyName: responseData?.data?.page?.name,
            description: responseData?.data?.page?.about,
            website: responseData?.data?.page?.website,
        };

        return { status: 'Success (API)', ...extractedData };

    } catch (error) {
        extractionLogger.error('Failed to fetch data from Facebook API.', { error: error.message }, sessionId);
        throw error;
    }
}

async function attemptUiDeepScrape(page, sessionId) {
    extractionLogger.step('Attempting UI-based deep scrape...', null, sessionId);
    const navigationHandler = new NavigationHandler(page, extractionLogger);

    const aboutTabSelectors = [
        { type: 'text', value: 'About' },
        { type: 'aria', value: 'About' },
        { type: 'xpath', value: "//*[contains(text(), 'About')]" }
    ];

    const aboutTab = await navigationHandler.findElement(aboutTabSelectors);
    if (!aboutTab) {
        throw new Error('UI deep scrape failed: Could not find "About" tab.');
    }

    const clicked = await navigationHandler.clickElement(aboutTab);
    if (!clicked) {
        throw new Error('UI deep scrape failed: Could not click "About" tab.');
    }

    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for content to load

    const dataExtractor = new FacebookDataExtractor(page);
    const aboutInfo = await dataExtractor.extractAboutInfo();

    extractionLogger.step('UI deep scrape successful.', { fields: Object.keys(aboutInfo).length }, sessionId);
    return { status: 'Success (UI)', ...aboutInfo };
}


async function scrapeFacebookCompany(url, sessionId) {
    extractionLogger.step('Starting Facebook scrape with three-stage fallback...', { url }, sessionId);
    let browser;
    try {
        browser = await puppeteer.launch({ headless: 'new', args: antiBotSystem.getAdvancedBrowserArgs() });
    } catch (error) {
        extractionLogger.error('Failed to launch browser', { url, error: error.message }, sessionId);
        return { url, status: 'Failed', error: 'Browser launch failed' };
    }

    const page = await browser.newPage();

    const extractMetaDataAsFallback = async () => {
        extractionLogger.warn('All scrape attempts failed. Falling back to meta tag extraction.', null, sessionId);
        return page.evaluate(() => {
            const data = { status: 'Success (Fallback)', companyName: document.title, profileImage: null, bannerImage: null, description: null, website: null, likes: null, followers: null };
            const metaTags = document.querySelectorAll('meta');
            const metaTagData = {};
            metaTags.forEach(tag => {
                const key = tag.getAttribute('property') || tag.getAttribute('name');
                if (key) metaTagData[key] = tag.getAttribute('content');
            });
            data.companyName = metaTagData['og:title'] || data.companyName;
            data.description = metaTagData['og:description'] || metaTagData['description'];
            data.profileImage = metaTagData['og:image'];
            data.bannerImage = metaTagData['og:image:secure_url'] || metaTagData['og:image'];
            data.website = metaTagData['og:url'];
            const desc = data.description || '';
            const likesMatch = desc.match(/([\d,.]+[KMB]?)\s+likes/i);
            if (likesMatch) data.likes = likesMatch[1];
            if (data.companyName) data.companyName = data.companyName.split('|')[0].trim();
            return data;
        });
    };

    try {
        const device = puppeteerCore.KnownDevices['iPhone 13 Pro'];
        await page.emulate(device);
        extractionLogger.step('Emulating mobile device', { device: device.name }, sessionId);

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000, referer: 'https://www.google.com/' });
        extractionLogger.step('Navigation successful', { url }, sessionId);

        const pageContent = await page.content();

        // --- Stage 1: API Scrape ---
        const tokens = extractApiTokens(pageContent);
        if (tokens.jazoest && tokens.lsd) {
            extractionLogger.info('Successfully extracted API tokens.', { jazoest: !!tokens.jazoest, lsd: !!tokens.lsd }, sessionId);
            try {
                const apiData = await fetchAboutDataViaApi(page, url, tokens, sessionId);
                if (apiData.companyName) { // Simple validation
                    return apiData;
                }
                extractionLogger.warn('API fetch did not return meaningful data, proceeding to UI scrape.', null, sessionId);
            } catch (apiError) {
                extractionLogger.warn('API fetch failed, proceeding to UI scrape.', { error: apiError.message }, sessionId);
            }
        } else {
            extractionLogger.warn('Could not extract API tokens, proceeding to UI scrape.', null, sessionId);
        }

        // --- Stage 2: UI Deep Scrape ---
        try {
            const uiData = await attemptUiDeepScrape(page, sessionId);
            if (uiData.companyName) { // Simple validation
                return uiData;
            }
            extractionLogger.warn('UI deep scrape did not return meaningful data, proceeding to meta fallback.', null, sessionId);
        } catch (uiError) {
            extractionLogger.warn('UI deep scrape failed, proceeding to meta fallback.', { error: uiError.message }, sessionId);
        }

        // --- Stage 3: Meta Tag Fallback ---
        const fallbackData = await extractMetaDataAsFallback();
        return fallbackData;

    } catch (error) {
        extractionLogger.error('An unexpected error occurred during the scraping process.', { error: error.message }, sessionId);
        const fallbackData = await extractMetaDataAsFallback();
        return fallbackData;
    } finally {
        if (browser) {
            await browser.close();
            extractionLogger.debug('Browser closed.', null, sessionId);
        }
    }
}

module.exports = { scrapeFacebookCompany };
