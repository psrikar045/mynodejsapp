/**
 * A robust handler for all interactions on the Facebook page.
 */
class FacebookInteractionHandler {
    constructor(page) {
        this.page = page;
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
        const { selector = 'button, a, div[role="button"]' } = options;
        console.log(`Attempting to click element matching "${selector}" with text: "${text}"`);

        const wasClicked = await this.page.evaluate((searchText, elementSelector) => {
            const elements = Array.from(document.querySelectorAll(elementSelector));
            const targetElement = elements.find(el => el.innerText.trim().toLowerCase().includes(searchText.toLowerCase()));

            if (targetElement) {
                const rect = targetElement.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) { // Ensure the element is visible
                    targetElement.click();
                    return true;
                }
            }
            return false;
        }, text, selector);

        if (wasClicked) {
            console.log(`✅ Successfully clicked element with text: "${text}"`);
        } else {
            console.log(`ℹ️ No visible element found with text: "${text}"`);
        }
        return wasClicked;
    }

    /**
     * Handles the initial cookie consent and login popups, implementing a refresh strategy if needed.
     */
    async handleInitialPopups() {
        await this._randomDelay(2000, 4000); // Wait for popups to appear
        let closedPopup = await this._tryToClosePopups();

        if (!closedPopup) {
            console.log('No popups found on first attempt. Refreshing page to try again...');
            await this.page.reload({ waitUntil: 'domcontentloaded' });
            await this._randomDelay(3000, 5000);

            closedPopup = await this._tryToClosePopups();
        }

        if (!closedPopup) {
            console.log('No popups found or closed after second attempt.');
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
        console.log(`Attempting to navigate to tab: "${tabName}"`);
        try {
            const clicked = await this.clickElementByText(tabName, { selector: 'a[role="tab"], div[role="tab"], a[href*="/about"]' });

            if (clicked) {
                await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {
                    console.log('No full navigation occurred, waiting for content to change...');
                    return this._randomDelay(3000, 5000);
                });
                console.log(`Successfully navigated to the "${tabName}" tab.`);
                return true;
            }
        } catch (error) {
            console.error(`Error navigating to tab "${tabName}":`, error.message);
        }
        console.log(`Failed to navigate to tab: "${tabName}"`);
        return false;
    }

    /**
     * A private helper for creating a random delay.
     * @param {number} min - Minimum delay in ms.
     * @param {number} max - Maximum delay in ms.
     */
    async _randomDelay(min, max) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
    }
}

module.exports = { FacebookInteractionHandler };
