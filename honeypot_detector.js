/**
 * Honeypot Detection System
 * Scans a page for common traps set for web scrapers.
 */
class HoneypotDetector {
    constructor() {
        this.suspiciousStrings = [
            'honeypot', 'decoy', 'trap', 'hidden-captcha', 'bot-trap', 'no-scrape'
        ];
    }

    /**
     * Analyzes the page to detect potential honeypot elements.
     * @param {object} page - The Puppeteer page object.
     * @returns {Promise<string[]>} - A promise that resolves to an array of CSS selectors for the identified honeypot elements.
     */
    async detect(page) {
        console.log('🕵️  Scanning for honeypot traps...');
        const honeypotSelectors = await page.evaluate((suspiciousStrings) => {
            const selectors = new Set();
            // A more focused query to avoid iterating over every single element
            const allElements = document.querySelectorAll('a, input, button, form, div, span, li, section');

            allElements.forEach((el, index) => {
                // Assign a unique ID for reliable selection later
                const uniqueId = `trap-candidate-${index}`;
                el.setAttribute('data-trap-id', uniqueId);
                const selector = `[data-trap-id="${uniqueId}"]`;

                const style = window.getComputedStyle(el);

                // 1. Check for invisibility styles
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || style.width === '0px' || style.height === '0px') {
                    selectors.add(selector);
                    return; // Element is a trap, no need for further checks
                }

                // 2. Check for off-screen positioning
                const rect = el.getBoundingClientRect();
                if (rect.right < 0 || rect.bottom < 0 || rect.left > window.innerWidth || rect.top > window.innerHeight) {
                    selectors.add(selector);
                    return;
                }

                // 3. Check for suspicious class names, IDs, or other attributes
                const attributes = [el.className, el.id, el.name, el.getAttribute('aria-label')];
                for (const attr of attributes) {
                    if (typeof attr === 'string') {
                        for (const suspicious of suspiciousStrings) {
                            if (attr.toLowerCase().includes(suspicious)) {
                                selectors.add(selector);
                                return; // Found a suspicious attribute, move to next element
                            }
                        }
                    }
                }
            });

            return Array.from(selectors);
        }, this.suspiciousStrings);

        if (honeypotSelectors.length > 0) {
            console.log(`⚠️  Found ${honeypotSelectors.length} potential honeypot(s).`);
        } else {
            console.log('✅ No obvious honeypot traps detected.');
        }

        return honeypotSelectors;
    }
}

module.exports = { HoneypotDetector };
