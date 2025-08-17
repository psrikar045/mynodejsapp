const puppeteer = require('puppeteer-extra');
const puppeteerCore = require('puppeteer');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { antiBotSystem } = require('../anti-bot-system');
const { extractionLogger } = require('../extraction-logger');
const { FacebookInteractionHandler } = require('./interaction_handler.js');
const { HoneypotDetector } = require('../honeypot_detector.js');
const { FacebookDataExtractor } = require('./data_extractor.js');

puppeteer.use(StealthPlugin());

async function scrapeFacebookCompany(url, sessionId) {
    extractionLogger.step('Starting Facebook scrape with fallback...', { url }, sessionId);
    let browser;
    try {
        browser = await puppeteer.launch({ headless: 'new', args: antiBotSystem.getAdvancedBrowserArgs() });
    } catch (error) {
        extractionLogger.error('Failed to launch browser', { url, error: error.message }, sessionId);
        return { url, status: 'Failed', error: 'Browser launch failed' };
    }

    const page = await browser.newPage();

    const extractMetaDataAsFallback = async () => {
        extractionLogger.warn('Deep scrape failed or could not find tabs. Falling back to meta tag extraction.', null, sessionId);
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

        const interactionHandler = new FacebookInteractionHandler(page);
        await interactionHandler.handleInitialPopups();

        await page.waitForSelector('div[role="main"]', { timeout: 15000, visible: true });
        extractionLogger.step('Main content is visible.', null, sessionId);

        // Attempt deep scrape
        extractionLogger.step('Attempting deep data extraction...', null, sessionId);
        const navigatedToAbout = await interactionHandler.navigateToTab('about');

        if (!navigatedToAbout) {
            throw new Error('Failed to navigate to "About" tab. Aborting deep scrape.');
        }

        // If navigation is successful, proceed with deep extraction
        const honeypotDetector = new HoneypotDetector();
        const trapSelectors = await honeypotDetector.detect(page);
        if (trapSelectors.length > 0) {
            extractionLogger.warn('Potential honeypots detected', { count: trapSelectors.length }, sessionId);
        }

        const dataExtractor = new FacebookDataExtractor(page);
        const aboutInfo = await dataExtractor.extractAboutInfo(trapSelectors);

        extractionLogger.step('Deep data extraction complete.', { fields: Object.keys(aboutInfo).length }, sessionId);
        return { status: 'Success (Deep)', ...aboutInfo };

    } catch (error) {
        extractionLogger.error('Deep scrape failed, initiating fallback.', { error: error.message }, sessionId);
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
