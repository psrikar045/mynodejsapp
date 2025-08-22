const { sanitizeForLogging } = require('../utils/input-sanitizer');

/**
 * A robust handler for all interactions on the Facebook page.
 */
class FacebookInteractionHandler {
    constructor(page, logger = console) {
        this.page = page;
        this.logger = logger;
    }

    /**
     * Finds and clicks a button or link based on its visible text content.
     * This is a robust alternative to using non-standard CSS selectors.
     * @param {string} text - The text to search for within the element.
     * @param {object} [options={}] - Optional parameters.
     * @param {string} [options.selector='button, a, div[role="button"]'] - The CSS selector for candidate elements.
     * @returns {Promise<boolean>} - True if an element was clicked, false otherwise.
     */
    async clickElementByText(text, options = {}) {
        const { selector = 'button, a, div[role="button"], [data-testid], span[role="button"], div[tabindex="0"]' } = options;
        this.logger.log(`Attempting to click element matching "${selector}" with text: "${sanitizeForLogging(text)}"`);

        try {
            const wasClicked = await this.page.evaluate((searchText, elementSelector) => {
                const elements = Array.from(document.querySelectorAll(elementSelector));
                
                // Multiple matching strategies
                let targetElement = elements.find(el => {
                    const text = el.innerText || el.textContent || '';
                    return text.trim().toLowerCase().includes(searchText.toLowerCase());
                });
                
                // Try exact match if partial match failed
                if (!targetElement) {
                    targetElement = elements.find(el => {
                        const text = el.innerText || el.textContent || '';
                        return text.trim().toLowerCase() === searchText.toLowerCase();
                    });
                }
                
                // Try aria-label match
                if (!targetElement) {
                    targetElement = elements.find(el => {
                        const ariaLabel = el.getAttribute('aria-label') || '';
                        return ariaLabel.toLowerCase().includes(searchText.toLowerCase());
                    });
                }

                if (targetElement) {
                    const rect = targetElement.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) { // Ensure the element is visible
                        // Scroll into view first
                        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        
                        // Add small delay for scroll
                        setTimeout(() => {
                            targetElement.click();
                        }, 500);
                        return true;
                    }
                }
                return false;
            }, text, selector);

            if (wasClicked) {
                this.logger.log(`✅ Successfully clicked element with text: "${sanitizeForLogging(text)}"`);
                await this._randomDelay(1000, 2000); // Wait after click
            } else {
                this.logger.log(`ℹ️ No visible element found with text: "${sanitizeForLogging(text)}"`);
            }
            return wasClicked;
        } catch (error) {
            this.logger.error(`Error clicking element with text "${sanitizeForLogging(text)}": ${sanitizeForLogging(error.message)}`);
            return false;
        }
    }

    /**
     * Handles the initial cookie consent and login popups, implementing a refresh strategy if needed.
     */
    async handleInitialPopups() {
        try {
            await this._randomDelay(2000, 4000); // Wait for popups to appear
            let closedPopup = await this._tryToClosePopups();

            if (!closedPopup) {
                this.logger.log('No popups found on first attempt. Refreshing page to try again...');
                await this.page.reload({ waitUntil: 'domcontentloaded' });
                await this._randomDelay(3000, 5000);

                closedPopup = await this._tryToClosePopups();
            }

            if (!closedPopup) {
                this.logger.log('No popups found or closed after second attempt.');
            }
        } catch (error) {
            this.logger.error(`Error handling initial popups: ${sanitizeForLogging(error.message)}`);
        }
    }

    /**
     * A private helper to attempt closing known popups.
     * @returns {Promise<boolean>} - True if any popup was successfully closed.
     */
    async _tryToClosePopups() {
        const popupTexts = ['Allow all cookies', 'Accept all', 'Not now', 'Close'];
        for (const text of popupTexts) {
            if (await this.clickElementByText(text)) {
                await this._randomDelay(1000, 2000); // Wait for popup to disappear
                return true;
            }
        }
        return false;
    }

    /**
     * Finds and clicks a navigation tab and waits for the page to update.
     * @param {string} tabName - The visible text of the tab to click (e.g., "About", "Photos").
     * @returns {Promise<boolean>} - True if navigation was successful, false otherwise.
     */
    async navigateToTab(tabName) {
        this.logger.log(`Attempting to navigate to tab: "${sanitizeForLogging(tabName)}"`);
        try {
            // Enhanced tab selectors for Facebook
            const tabSelectors = [
                'a[role="tab"]',
                'div[role="tab"]', 
                'a[href*="/about"]',
                '[data-testid*="tab"]',
                'nav a',
                'div[data-testid="page_nav"] a',
                'ul[role="tablist"] a',
                'div[aria-label*="tab"]'
            ].join(', ');
            
            const clicked = await this.clickElementByText(tabName, { 
                selector: tabSelectors
            });

            if (clicked) {
                // Wait for content to load with multiple strategies
                try {
                    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
                } catch (navError) {
                    this.logger.log('No full navigation occurred, waiting for content to change...');
                    
                    // Wait for URL change or content change
                    await Promise.race([
                        this.page.waitForFunction(() => {
                            return document.readyState === 'complete';
                        }, { timeout: 10000 }),
                        this._randomDelay(5000, 7000)
                    ]);
                }
                
                // Additional wait for dynamic content
                await this._randomDelay(2000, 4000);
                
                this.logger.log(`Successfully navigated to the "${sanitizeForLogging(tabName)}" tab.`);
                return true;
            }
        } catch (error) {
            this.logger.error(`Error navigating to tab "${sanitizeForLogging(tabName)}": ${sanitizeForLogging(error.message)}`);
        }
        this.logger.log(`Failed to navigate to tab: "${sanitizeForLogging(tabName)}"`);
        return false;
    }

    /**
     * A private helper for creating a random delay.
     * @param {number} min - Minimum delay in ms.
     * @param {number} max - Maximum delay in ms.
     */
    async _randomDelay(min, max) {
        const delay = Math.random() * (max - min) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Enhanced method to navigate through multiple sub-sections in About tab
     * @param {string[]} sectionNames - Array of section names to navigate through
     * @returns {Promise<boolean[]>} - Array of success/failure for each section
     */
    async navigateToAboutSections(sectionNames = ['Contact and Basic Info', 'Page Transparency']) {
        const results = [];
        for (const sectionName of sectionNames) {
            try {
                const success = await this.clickElementByText(sectionName);
                results.push(success);
                if (success) {
                    await this._randomDelay(2000, 3000); // Wait for section to load
                }
            } catch (error) {
                this.logger.error(`Failed to navigate to section "${sanitizeForLogging(sectionName)}": ${sanitizeForLogging(error.message)}`);
                results.push(false);
            }
        }
        return results;
    }
}

module.exports = { FacebookInteractionHandler };