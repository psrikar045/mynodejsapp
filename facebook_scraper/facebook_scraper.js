const puppeteer = require('puppeteer-extra');
const puppeteerCore = require('puppeteer');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { antiBotSystem } = require('../anti-bot-system');
const fs = require('fs').promises;

const COOKIE_FILE_PATH = './facebook-cookies.json';

// Use puppeteer-extra with stealth plugin
puppeteer.use(StealthPlugin());

async function scrapeFacebookCompany(url) {
    console.log('⏳ Starting Facebook meta tag extraction...');
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: antiBotSystem.getAdvancedBrowserArgs(),
        });
    } catch (error) {
        console.error('❌ Failed to launch browser:', error);
        return { url, status: 'Failed', error: 'Browser launch failed' };
    }

    const page = await browser.newPage();

    try {
        // Use a desktop profile for best results with meta tags
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent(antiBotSystem.getRandomUserAgent());

        console.log(`Navigating to ${url} to extract meta tags...`);
        await page.goto(url, {
            waitUntil: 'domcontentloaded', // We don't need to wait for full render
            timeout: 60000,
            referer: 'https://www.google.com/'
        });

        console.log('Extracting data from meta tags...');
        const metaData = await page.evaluate(() => {
            const data = {
                url: window.location.href,
                status: 'Success',
                companyName: document.title, // A good fallback
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

            // Map Open Graph (og:*) and other common meta tags to our data structure
            data.companyName = metaTagData['og:title'] || data.companyName;
            data.description = metaTagData['og:description'] || metaTagData['description'];
            data.profileImage = metaTagData['og:image'];
            data.bannerImage = metaTagData['og:image:secure_url'] || metaTagData['og:image']; // Often the same
            data.website = metaTagData['og:url'];

            // Extract likes/followers from the description as a fallback
            const desc = data.description || '';
            const likesMatch = desc.match(/([\d,.]+[KMB]?)\s+likes/i);
            const followersMatch = desc.match(/([\d,.]+[KMB]?)\s+followers/i);
            if (likesMatch) data.likes = likesMatch[1];
            if (followersMatch) data.followers = followersMatch[1];

            // Clean up company name (remove " | Facebook")
            if (data.companyName) {
                data.companyName = data.companyName.split(' | ')[0].trim();
            }

            return data;
        });

        console.log('✅ Successfully extracted meta data.');
        await page.screenshot({ path: 'facebook-success.png' }); // Keep for debugging
        return metaData;

    } catch (error) {
        console.error(`❌ Error scraping ${url}:`, error);
        await page.screenshot({ path: 'facebook-error.png' });
        return { url, status: 'Failed', error: error.message };
    } finally {
        if (browser) {
            await browser.close();
            console.log('✅ Browser closed.');
        }
    }
}

module.exports = { scrapeFacebookCompany };
