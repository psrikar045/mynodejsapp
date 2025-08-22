const puppeteer = require('puppeteer');
const { antiBotSystem } = require('../anti-bot-system');
const { FacebookAntiBotSystem } = require('../facebook-anti-bot');
const { FacebookPlatformUtils } = require('../facebook-platform-utils');
const { extractionLogger } = require('../extraction-logger');
const fs = require('fs').promises;
const { sanitizeForLogging } = require('../utils/input-sanitizer');

const cookiesFile = require('path').resolve(__dirname, 'facebook_cookies.json');

// Simple Facebook data extraction
async function extractFacebookData(page, sessionId) {
    extractionLogger.step('Extracting Facebook data from page...', null, sessionId);
    
    return await page.evaluate(() => {
        const data = {};
        
        // Extract company name from title or header
        const title = document.title;
        if (title) {
            data.companyName = title.split('|')[0].trim();
        }
        
        // Extract description from meta tags or page content
        const metaDescription = document.querySelector('meta[property="og:description"], meta[name="description"]');
        if (metaDescription) {
            data.description = metaDescription.getAttribute('content');
        }
        
        // Extract profile image
        const profileImg = document.querySelector('image[data-imgperflogname="profileCoverPhoto"], img[data-imgperflogname="profileCoverPhoto"]');
        if (profileImg) {
            data.profileImage = profileImg.src || profileImg.getAttribute('src');
        }
        
        // Fallback for profile image from meta tags
        if (!data.profileImage) {
            const ogImage = document.querySelector('meta[property="og:image"]');
            if (ogImage) {
                data.profileImage = ogImage.getAttribute('content');
            }
        }
        
        // Extract banner image (same as profile for Facebook pages)
        data.bannerImage = data.profileImage;
        
        // Extract likes and followers from page text
        const pageText = document.body.innerText || '';
        const likesMatch = pageText.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s+likes/i);
        if (likesMatch) {
            data.likes = likesMatch[1];
        }
        
        const followersMatch = pageText.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s+followers/i);
        if (followersMatch) {
            data.followers = followersMatch[1];
        }
        
        // Extract website from links
        const websiteLink = Array.from(document.querySelectorAll('a[href]'))
            .find(link => {
                const href = link.href;
                return href && !href.includes('facebook.com') && !href.includes('instagram.com') && 
                       (href.startsWith('http://') || href.startsWith('https://'));
            });
        if (websiteLink) {
            data.website = websiteLink.href;
        }
        
        return data;
    });
}

async function scrapeFacebookCompany(url, sessionId) {
    extractionLogger.step('Starting Facebook scrape with enhanced anti-bot measures...', { url: sanitizeForLogging(url) }, sessionId);
    const facebookAntiBot = new FacebookAntiBotSystem();
    let browser;
    
    try {
        const browserPath = FacebookPlatformUtils.getBrowserExecutablePath();
        const launchOptions = {
            headless: 'new',
            args: facebookAntiBot.getFacebookBrowserArgs(),
            defaultViewport: FacebookPlatformUtils.getOptimalViewport()
        };
        
        if (browserPath) {
            launchOptions.executablePath = browserPath;
        }
        
        browser = await puppeteer.launch(launchOptions);
    } catch (error) {
        extractionLogger.error('Failed to launch browser', { url: sanitizeForLogging(url), error: sanitizeForLogging(error.message) }, sessionId);
        return { url: sanitizeForLogging(url), status: 'Failed', error: 'Browser launch failed' };
    }

    const page = await browser.newPage();
    
    // Setup Facebook-specific stealth mode
    await facebookAntiBot.setupFacebookStealth(page, sessionId);
    
    // Setup request interception
    await facebookAntiBot.setupFacebookInterception(page, sessionId);

    // Load cookies if present
    try {
        const cookiesString = await fs.readFile(cookiesFile, 'utf-8');
        const cookies = JSON.parse(cookiesString);
        if (Array.isArray(cookies) && cookies.length > 0) {
            await page.setCookie(...cookies);
            extractionLogger.step('Loaded Facebook cookies for session.', { count: cookies.length }, sessionId);
        }
    } catch (error) {
        extractionLogger.warn('Failed to load Facebook cookies', { error: sanitizeForLogging(error.message) }, sessionId);
    }

    try {
        // Navigate to Facebook page
        const navigationSuccess = await facebookAntiBot.navigateToFacebookPage(page, url, sessionId);
        if (!navigationSuccess) {
            extractionLogger.error('Failed to navigate to Facebook page', { url: sanitizeForLogging(url) }, sessionId);
            throw new Error('Navigation failed');
        }
        
        // Wait for page to be ready
        const pageReady = await facebookAntiBot.waitForFacebookPageReady(page, sessionId);
        if (!pageReady) {
            extractionLogger.warn('Timeout waiting for Facebook page to be ready', {}, sessionId);
        }
        
        // Extract data using simple method
        extractionLogger.info('Recovered from error, attempting fallback extraction', {}, sessionId);
        const extractedData = await extractFacebookData(page, sessionId);
        
        // Add status and ensure we have basic data
        extractedData.status = 'Success (Fallback)';
        if (!extractedData.companyName && extractedData.description) {
            // Try to extract company name from description
            const titleMatch = extractedData.description.match(/^([^,\.]+)/);
            if (titleMatch) {
                extractedData.companyName = titleMatch[1].trim();
            }
        }
        
        return extractedData;
        
    } catch (error) {
        extractionLogger.error('An unexpected error occurred during the scraping process.', { error: sanitizeForLogging(error.message) }, sessionId);
        
        // Fallback extraction from meta tags
        extractionLogger.warn('All scrape attempts failed. Falling back to meta tag extraction.', null, sessionId);
        const fallbackData = await page.evaluate(() => {
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
            const likesMatch = desc.match(/[\d,.]+[KMB]?\s+likes/i);
            if (likesMatch) data.likes = likesMatch[0].split(' ')[0];
            if (data.companyName) data.companyName = data.companyName.split('|')[0].trim();
            return data;
        });
        
        return fallbackData;
        
    } finally {
        if (browser) {
            try {
                // Persist cookies
                const cookies = await page.cookies();
                if (Array.isArray(cookies) && cookies.length > 0) {
                    await fs.writeFile(cookiesFile, JSON.stringify(cookies, null, 2), 'utf-8');
                    extractionLogger.step('Persisted Facebook cookies after run.', { count: cookies.length }, sessionId);
                }
            } catch (error) {
                extractionLogger.warn('Failed to persist Facebook cookies', { error: sanitizeForLogging(error.message) }, sessionId);
            }
            await browser.close();
            extractionLogger.debug('Browser closed.', null, sessionId);
        }
    }
}

module.exports = { scrapeFacebookCompany };