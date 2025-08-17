const puppeteer = require('puppeteer-extra');
const puppeteerCore = require('puppeteer');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { antiBotSystem } = require('../anti-bot-system');
const { extractionLogger } = require('../extraction-logger'); // Import the logger
const fs = require('fs').promises;

const COOKIE_FILE_PATH = './facebook-cookies.json';

// Use puppeteer-extra with stealth plugin
puppeteer.use(StealthPlugin());

async function scrapeFacebookCompany(url, sessionId) { // Added sessionId
    extractionLogger.step('Starting Facebook meta tag extraction...', null, sessionId);
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: antiBotSystem.getAdvancedBrowserArgs(),
        });
    } catch (error) {
        extractionLogger.error('Failed to launch browser', error, { url }, sessionId);
        return { url, status: 'Failed', error: 'Browser launch failed' };
    }

    const page = await browser.newPage();

    try {
        // Use a desktop profile for best results with meta tags
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent(antiBotSystem.getRandomUserAgent());

        extractionLogger.step('Navigating to URL for meta tag extraction', { url }, sessionId);
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
            referer: 'https://www.google.com/'
        });

        extractionLogger.step('Extracting data from meta tags...', null, sessionId);
        const metaData = await page.evaluate(() => {
            const data = {
                url: window.location.href,
                status: 'Success',
                companyName: document.title,
                profileImage: null,
                bannerImage: null,
                description: null,
                website: null,
                likes: null,
                followers: null,
            };

            const metaTags = document.querySelectorAll('meta');
            const metaTagData = {};
            metaTags.forEach(tag => {
                const key = tag.getAttribute('property') || tag.getAttribute('name');
                const value = tag.getAttribute('content');
                if (key) {
                    metaTagData[key] = value;
                }
            });

            data.companyName = metaTagData['og:title'] || data.companyName;
            data.description = metaTagData['og:description'] || metaTagData['description'];
            data.profileImage = metaTagData['og:image'];
            data.bannerImage = metaTagData['og:image:secure_url'] || metaTagData['og:image'];
            data.website = metaTagData['og:url'];

            const desc = data.description || '';
            const likesMatch = desc.match(/([\d,.]+[KMB]?)\s+likes/i);
            const followersMatch = desc.match(/([\d,.]+[KMB]?)\s+followers/i);
            if (likesMatch) data.likes = likesMatch[1];
            if (followersMatch) data.followers = followersMatch[1];

            if (data.companyName) {
                data.companyName = data.companyName.split(' | ')[0].trim();
            }

            return data;
        });

        extractionLogger.step('Successfully extracted meta data', { extractedFields: Object.keys(metaData).length }, sessionId);
        return metaData;

    } catch (error) {
        extractionLogger.error('Facebook scraping failed', error, { url }, sessionId);
        try {
            await page.screenshot({ path: 'facebook-error.png' });
            extractionLogger.debug('Saved error screenshot to facebook-error.png', null, sessionId);
        } catch (screenshotError) {
            extractionLogger.error('Failed to save error screenshot', screenshotError, { url }, sessionId);
        }
        return { url, status: 'Failed', error: error.message };
    } finally {
        if (browser) {
            await browser.close();
            extractionLogger.debug('Browser closed.', null, sessionId);
        }
    }
}

module.exports = { scrapeFacebookCompany };
