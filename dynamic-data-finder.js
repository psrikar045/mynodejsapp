/**
 * Dynamic Data Finder
 *
 * This module is responsible for finding and extracting additional, non-standard
 * information from a webpage. It looks for SEO-related data and other
 * interesting key-value pairs that are not part of the standard scraping schema.
 */
class DynamicDataFinder {
    constructor(page) {
        this.page = page;
    }

    /**
     * Extracts common SEO-related information from the page.
     * @returns {Promise<object>} An object containing SEO data.
     */
    async extractSeoInfo() {
        console.log('[DynamicDataFinder] Extracting SEO info...');
        const seoData = await this.page.evaluate(() => {
            const getMetaContent = (name) => {
                const meta = document.querySelector(`meta[name="${name}"]`);
                return meta ? meta.getAttribute('content') : null;
            };

            const getLinkHref = (rel) => {
                const link = document.querySelector(`link[rel="${rel}"]`);
                return link ? link.getAttribute('href') : null;
            };

            const getTagContents = (tagName) => {
                return Array.from(document.getElementsByTagName(tagName)).map(tag => tag.innerText.trim());
            };

            const getSocialLinks = () => {
                const links = {};
                const socialPatterns = {
                    twitter: /twitter\.com/,
                    facebook: /facebook\.com/,
                    linkedin: /linkedin\.com\/company/,
                    instagram: /instagram\.com/,
                    youtube: /youtube\.com/,
                };
                document.querySelectorAll('a[href]').forEach(a => {
                    for (const social in socialPatterns) {
                        if (socialPatterns[social].test(a.href)) {
                            if (!links[social]) { // Only grab the first one found
                                links[social] = a.href;
                            }
                        }
                    }
                });
                return links;
            };

            return {
                metaDescription: getMetaContent('description'),
                metaKeywords: getMetaContent('keywords'),
                canonicalUrl: getLinkHref('canonical'),
                h1Tags: getTagContents('h1'),
                h2Tags: getTagContents('h2'),
                socialLinks: getSocialLinks(),
            };
        });
        return seoData;
    }

    /**
     * Scans the page for potential key-value pairs based on a list of keywords.
     * @returns {Promise<object>} An object of discovered key-value pairs.
     */
    async findKeyValuePairs() {
        console.log('[DynamicDataFinder] Finding key-value pairs...');
        const keyValuePairs = await this.page.evaluate(() => {
            const keywords = ['ceo', 'revenue', 'founded', 'employees', 'head office', 'phone', 'email', 'address'];
            const foundData = {};

            // Search all text nodes for keywords
            const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while(node = textNodes.nextNode()) {
                const text = node.textContent.toLowerCase().trim();
                for (const keyword of keywords) {
                    if (text.includes(keyword)) {
                        // Found a keyword. Now, try to find its associated value.
                        // This is a simple heuristic: check the text of the parent's next sibling.
                        const parent = node.parentElement;
                        if (parent) {
                            const nextSibling = parent.nextElementSibling;
                            if (nextSibling && nextSibling.innerText) {
                                const key = keyword.replace(' ', ''); // format key
                                foundData[key] = nextSibling.innerText.trim();
                                break; // Move to the next text node
                            }
                        }
                    }
                }
            }
            return foundData;
        });
        return keyValuePairs;
    }

    /**
     * Runs all extraction methods and returns a combined object.
     * @returns {Promise<object>} A single object with all additional info.
     */
    async findAll() {
        const seoInfo = await this.extractSeoInfo();
        const keyValuePairs = await this.findKeyValuePairs();

        return {
            ...seoInfo,
            ...keyValuePairs,
        };
    }
}

module.exports = { DynamicDataFinder };
