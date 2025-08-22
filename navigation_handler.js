/**
 * @module navigation_handler
 * @description This module provides advanced, robust functions for navigating and interacting with web pages using Puppeteer.
 * It is designed to be resilient to website changes and anti-bot measures.
 */

class NavigationHandler {
    constructor(page, logger) {
        this.page = page;
        this.logger = logger || console;
    }

    /**
     * Finds an element on the page using a variety of robust strategies.
     * It tries selectors in order and returns the first element found.
     * @param {Array<Object>} selectors - An array of selector objects. Each object should have a `type` and a `value`.
     *   - type: 'xpath', 'css', 'aria', 'text'
     *   - value: The selector string.
     * @param {number} [timeout=10000] - The maximum time to wait for the element in milliseconds.
     * @returns {Promise<import('puppeteer').ElementHandle | null>} The Puppeteer ElementHandle or null if not found.
     */
    async findElement(selectors, timeout = 10000) {
        for (const selector of selectors) {
            try {
                this.logger.debug(`[NavigationHandler] Trying to find element with selector: ${JSON.stringify(selector)}`);
                let element = null;
                const waitOptions = { timeout, visible: true };

                switch (selector.type) {
                    case 'xpath':
                        element = await this.page.waitForXPath(selector.value, waitOptions);
                        break;
                    case 'css':
                        element = await this.page.waitForSelector(selector.value, waitOptions);
                        break;
                    case 'aria':
                        element = await this.page.waitForSelector(`[aria-label="${selector.value}"]`, waitOptions);
                        break;
                    case 'text':
                        // Using Puppeteer's built-in text selector pseudo-class
                        element = await this.page.waitForSelector(`::-p-text(${selector.value})`, waitOptions);
                        break;
                    default:
                        this.logger.warn(`[NavigationHandler] Unknown selector type: ${selector.type}`);
                        continue;
                }

                if (element) {
                    this.logger.info(`[NavigationHandler] Found element using selector: ${JSON.stringify(selector)}`);
                    return element;
                }
            } catch (error) {
                this.logger.debug(`[NavigationHandler] Could not find element with selector: ${JSON.stringify(selector)}.`);
            }
        }

        this.logger.warn(`[NavigationHandler] Failed to find element with any of the provided selectors.`);
        return null;
    }

    /**
     * Clicks an element in a human-like way, with fallbacks.
     * @param {import('puppeteer').ElementHandle} element - The Puppeteer ElementHandle to click.
     * @returns {Promise<boolean>} True if the click was successful, false otherwise.
     */
    async clickElement(element) {
        if (!element) {
            this.logger.warn('[NavigationHandler] Cannot click a null element.');
            return false;
        }

        try {
            // 1. Scroll the element into view
            await this.page.evaluate(el => el.scrollIntoView({ block: 'center' }), element);
            this.logger.debug('[NavigationHandler] Scrolled element into view.');

            // Add a small random delay to mimic human behavior
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

            // 2. Try a standard click first
            this.logger.debug('[NavigationHandler] Attempting standard click.');
            await element.click();
            this.logger.info('[NavigationHandler] Standard click successful.');
            return true;
        } catch (error) {
            this.logger.warn(`[NavigationHandler] Standard click failed: ${error.message}. Falling back to JavaScript click.`);

            // 3. Fallback to JavaScript click
            try {
                await this.page.evaluate(el => el.click(), element);
                this.logger.info('[NavigationHandler] JavaScript click successful.');
                return true;
            } catch (jsClickError) {
                this.logger.error(`[NavigationHandler] Both standard and JavaScript clicks failed: ${jsClickError.message}`);
                return false;
            }
        }
    }
}

module.exports = { NavigationHandler };