const { sanitizeForLogging } = require('../utils/input-sanitizer');

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
                traps.forEach(selector => {
                    try {
                        document.querySelector(selector)?.remove();
                    } catch (e) { /* ignore */ }
                });
            }

            // Enhanced selector strategy with multiple fallbacks
            const valByTestId = (ids) => {
                for (const id of ids) {
                    try {
                        const el = document.querySelector(`[data-testid="${id}"]`);
                        if (el && el.innerText) return el.innerText.trim();
                    } catch (e) { /* ignore */ }
                }
                return null;
            };
            
            const getTextBySelectors = (selectors) => {
                for (const selector of selectors) {
                    try {
                        const el = document.querySelector(selector);
                        if (el && el.innerText) return el.innerText.trim();
                    } catch (e) { /* ignore */ }
                }
                return null;
            };
            
            // Multiple strategies for company name
            const name = valByTestId(['event_permalink_event_name', 'hero_title', 'page_title', 'page-header-title']) || 
                        getTextBySelectors([
                            'h1[data-testid="page-header-title"]',
                            'h1[role="heading"]',
                            'h1',
                            '[data-testid="page_profile_name"] h1',
                            '.x1heor9g.x1qlqyl8.x1pd3egz.x1a2a7pz h1'
                        ]) ||
                        document.title?.split('|')[0]?.trim() || null;
            
            // Enhanced likes detection
            const likes = valByTestId(['page-likes-count', 'about_likes', 'page_social_context']) || 
                         getTextBySelectors([
                             '[data-testid="page_social_context"] span',
                             'a[href*="/likes"] span',
                             'span:contains("likes")',
                             'div:contains("people like this")',
                         ]) ||
                         Array.from(document.querySelectorAll('a, span, div')).find(el => 
                             /\d+[KMB]?\s*(people\s+)?likes?/i.test(el.innerText || ''))?.innerText?.trim();
            
            // Enhanced followers detection
            const followers = valByTestId(['page-followers-count', 'about_followers', 'page_followers']) || 
                             getTextBySelectors([
                                 '[data-testid="page_followers"] span',
                                 'a[href*="/followers"] span',
                                 'span:contains("followers")',
                                 'div:contains("people follow this")',
                             ]) ||
                             Array.from(document.querySelectorAll('a, span, div')).find(el => 
                                 /\d+[KMB]?\s*(people\s+)?followers?/i.test(el.innerText || ''))?.innerText?.trim();

            return {
                companyName: name,
                likes: likes || null,
                followers: followers || null,
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
                traps.forEach(selector => {
                    try {
                        document.querySelector(selector)?.remove();
                    } catch (e) { /* ignore */ }
                });
            }

            // Enhanced selector strategy
            const valByTestId = (ids) => {
                for (const id of ids) {
                    try {
                        const el = document.querySelector(`[data-testid="${id}"]`);
                        if (el && el.innerText) return el.innerText.trim();
                    } catch (e) { /* ignore */ }
                }
                return null;
            };

            const getInfoByLabel = (labels) => {
                for (const label of Array.isArray(labels) ? labels : [labels]) {
                    try {
                        const element = Array.from(document.querySelectorAll('div, span, dt, th')).find(el => 
                            (el.innerText||'').trim().toLowerCase().includes(label.toLowerCase()));
                        if (element) {
                            // Try multiple strategies to find the value
                            const value = element.nextElementSibling?.innerText?.trim() ||
                                         element.parentElement?.querySelector('dd, td')?.innerText?.trim() ||
                                         element.closest('tr')?.querySelector('td:last-child')?.innerText?.trim();
                            if (value) return value;
                        }
                    } catch (e) { /* ignore */ }
                }
                return null;
            };
            
            const getTextBySelectors = (selectors) => {
                for (const selector of selectors) {
                    try {
                        const el = document.querySelector(selector);
                        if (el && el.innerText) return el.innerText.trim();
                    } catch (e) { /* ignore */ }
                }
                return null;
            };
            
            // Extract website/URL information
            const website = getTextBySelectors([
                'a[href^="http"]:not([href*="facebook.com"]):not([href*="instagram.com"]):not([href*="twitter.com"])',
                '[data-testid="page_website"] a',
                'div:contains("Website") + div a',
                'dt:contains("Website") + dd a'
            ])?.href || getInfoByLabel(['website', 'site web', 'url']);
            
            // Extract description
            const description = valByTestId(['page_description', 'about_description']) ||
                               getTextBySelectors([
                                   '[data-testid="page_description"]',
                                   'div[data-testid="page_additional_info"]',
                                   '.x1i10hfl.xjbqb8w.x6umtig.x1b1mbwd.xaqea5y.xav7gou.x9f619.x1ypdohk.xt0psk2.xe8uvvx.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x16tdsg8.x1hl2dhg.xggy1nq.x1a2a7pz.x1heor9g.xt0b8zv.xo1l8bm'
                               ]) ||
                               getInfoByLabel(['about', 'description', 'story']);
            
            // Extract business hours
            const businessHours = getInfoByLabel(['hours', 'open hours', 'business hours', 'opening hours']) ||
                                 getTextBySelectors([
                                     '[data-testid="page_hours"]',
                                     'div:contains("Open now")',
                                     'div:contains("Closed now")',
                                     'span:contains("Open now")',
                                     'span:contains("Closed now")'
                                 ]);
            
            // Extract price range
            const priceRange = getInfoByLabel(['price range', 'price', 'cost']) ||
                              getTextBySelectors([
                                  '[data-testid="page_price_range"]',
                                  'span:contains("£")',
                                  'span:contains("$")',
                                  'span:contains("€")',
                                  'div:contains("Price range")',
                              ]) ||
                              Array.from(document.querySelectorAll('span, div')).find(el => 
                                  /\$+|£+|€+|price\s*range/i.test(el.innerText || ''))?.innerText?.trim();

            return {
                description: description,
                website: website,
                categories: valByTestId(['about_category', 'page_category']) || getInfoByLabel(['category', 'categories']),
                contactInfo: valByTestId(['about_contact', 'contact_info']) || getInfoByLabel(['contact info', 'contact']),
                websitesAndSocialLinks: valByTestId(['about_websites', 'page_websites']) || getInfoByLabel(['websites and social links', 'social links']),
                email: valByTestId(['contact_email']) || getInfoByLabel(['email', 'e-mail']) || 
                       getTextBySelectors(['a[href^="mailto:"]'])?.replace('mailto:', ''),
                phone: valByTestId(['contact_phone']) || getInfoByLabel(['phone', 'telephone', 'tel']) ||
                       getTextBySelectors(['a[href^="tel:"]'])?.replace('tel:', ''),
                address: valByTestId(['contact_address']) || getInfoByLabel(['address', 'location', 'adresse']),
                businessHours: businessHours,
                priceRange: priceRange
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

            const valByTestId = (ids) => {
                for (const id of ids) {
                    const el = document.querySelector(`[data-testid="${id}"]`);
                    if (el && el.innerText) return el.innerText.trim();
                }
                return null;
            };

            const getInfoByLabel = (label) => {
                const element = Array.from(document.querySelectorAll('div, span')).find(el => el.innerText.trim().toLowerCase().includes(label.toLowerCase()));
                return element?.parentElement?.innerText.trim() || null;
            };
            return {
                pageId: valByTestId(['page_id', 'transparency_page_id']) || getInfoByLabel('page id'),
                creationDate: valByTestId(['page_created', 'creation_date']) || getInfoByLabel('page created'),
                adminInfo: valByTestId(['page_admin', 'managing_org']) || getInfoByLabel('organisation that manages this page'),
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

            const valByTestId = (ids) => {
                for (const id of ids) {
                    const el = document.querySelector(`[data-testid="${id}"]`);
                    if (el && el.innerText) return el.innerText.trim();
                }
                return null;
            };

            const adsStatus = valByTestId(['ads_status', 'page_ads_info']) || 
                             Array.from(document.querySelectorAll('div, span')).find(el => el.innerText.includes('not currently running ads'))?.innerText;
            return {
                adsStatus: adsStatus ? (adsStatus.includes('not') ? 'Not running ads' : 'Running ads') : 'Unknown',
            };
        }, trapSelectors);
    }

    /**
     * Enhanced extraction method that combines all data sources
     * @param {string[]} trapSelectors - Honeypot selectors to avoid
     * @returns {Promise<object>} - Combined extracted data
     */
    async extractComprehensiveData(trapSelectors = []) {
        const headerInfo = await this.extractHeaderInfo(trapSelectors);
        const aboutInfo = await this.extractAboutInfo(trapSelectors);
        const transparencyInfo = await this.extractPageTransparencyInfo(trapSelectors);
        const adsInfo = await this.extractAdsInfo(trapSelectors);

        return {
            ...headerInfo,
            ...aboutInfo,
            ...transparencyInfo,
            ...adsInfo
        };
    }
}

module.exports = { FacebookDataExtractor };