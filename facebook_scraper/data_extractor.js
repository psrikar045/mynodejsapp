/**
 * Extracts granular, honeypot-aware data from different sections of a Facebook page.
 */
class FacebookDataExtractor {
    constructor(page) {
        this.page = page;
    }

    /**
     * Extracts basic header information like name, likes, followers.
     * @param {string[]} trapSelectors - An array of CSS selectors for honeypot elements to avoid.
     * @returns {Promise<object>}
     */
    async extractHeaderInfo(trapSelectors = []) {
        console.log('Extracting header info...');
        return await this.page.evaluate((traps) => {
            // Neutralize traps first
            if (traps && traps.length > 0) {
                traps.forEach(selector => document.querySelector(selector)?.remove());
            }

            const name = document.querySelector('h1')?.innerText.trim() || null;
            const likesElement = Array.from(document.querySelectorAll('a, span')).find(el => el.innerText.includes('likes'));
            const followersElement = Array.from(document.querySelectorAll('a, span')).find(el => el.innerText.includes('followers'));

            return {
                companyName: name,
                likes: likesElement?.innerText.trim() || null,
                followers: followersElement?.innerText.trim() || null,
            };
        }, trapSelectors);
    }

    /**
     * Extracts data from the "About" tab.
     * @param {string[]} trapSelectors - An array of CSS selectors for honeypot elements to avoid.
     * @returns {Promise<object>}
     */
    async extractAboutInfo(trapSelectors = []) {
        console.log('Extracting "About" tab info...');
        return await this.page.evaluate((traps) => {
            if (traps && traps.length > 0) {
                traps.forEach(selector => document.querySelector(selector)?.remove());
            }

            const getInfoByLabel = (label) => {
                const element = Array.from(document.querySelectorAll('div, span')).find(el => el.innerText.trim().toLowerCase() === label.toLowerCase());
                return element?.nextElementSibling?.innerText.trim() || null;
            };
            return {
                categories: getInfoByLabel('category'),
                contactInfo: getInfoByLabel('contact info'),
                websitesAndSocialLinks: getInfoByLabel('websites and social links'),
            };
        }, trapSelectors);
    }

    /**
     * Extracts data from the "Page Transparency" tab.
     * @param {string[]} trapSelectors - An array of CSS selectors for honeypot elements to avoid.
     * @returns {Promise<object>}
     */
    async extractPageTransparencyInfo(trapSelectors = []) {
        console.log('Extracting "Page Transparency" info...');
        return await this.page.evaluate((traps) => {
            if (traps && traps.length > 0) {
                traps.forEach(selector => document.querySelector(selector)?.remove());
            }

            const getInfoByLabel = (label) => {
                const element = Array.from(document.querySelectorAll('div, span')).find(el => el.innerText.trim().toLowerCase().includes(label.toLowerCase()));
                return element?.parentElement?.innerText.trim() || null;
            };
            return {
                pageId: getInfoByLabel('page id'),
                creationDate: getInfoByLabel('page created'),
                adminInfo: getInfoByLabel('organisation that manages this page'),
            };
        }, trapSelectors);
    }

    /**
     * Checks if the page is running ads.
     * @param {string[]} trapSelectors - An array of CSS selectors for honeypot elements to avoid.
     * @returns {Promise<object>}
     */
    async extractAdsInfo(trapSelectors = []) {
        console.log('Extracting ads info...');
        return await this.page.evaluate((traps) => {
            if (traps && traps.length > 0) {
                traps.forEach(selector => document.querySelector(selector)?.remove());
            }

            const adsElement = Array.from(document.querySelectorAll('div, span')).find(el => el.innerText.includes('not currently running ads'));
            return {
                adsStatus: adsElement ? 'Not running ads' : 'Potentially running ads',
            };
        }, trapSelectors);
    }
}

module.exports = { FacebookDataExtractor };
