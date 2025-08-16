/**
 * Adaptive Interaction Handler
 *
 * This module is responsible for intelligently handling dynamic on-page elements
 * like cookie banners, pop-ups, chat widgets, and other interruptions.
 * It uses a combination of predefined selectors, keyword matching, and a
 * self-learning mechanism to adapt to different websites.
 */
const fs = require('fs').promises;
const path = require('path');

const LEARNED_PATTERNS_PATH = path.join(__dirname, 'interaction-patterns.json');

class AdaptiveInteractionHandler {
    constructor(page) {
        this.page = page;
        this.learnedPatterns = new Map();
        this.observerAttached = false;
    }

    /**
     * Initializes the handler by loading learned patterns from a file.
     */
    async initialize() {
        try {
            const data = await fs.readFile(LEARNED_PATTERNS_PATH, 'utf-8');
            const patterns = JSON.parse(data);
            this.learnedPatterns = new Map(Object.entries(patterns));
            console.log('[InteractionHandler] Successfully loaded learned patterns.');
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('[InteractionHandler] No learned patterns file found. Starting fresh.');
            } else {
                console.warn('[InteractionHandler] Error loading learned patterns:', error);
            }
        }
    }

    /**
     * Saves the currently learned patterns to a file.
     */
    async savePatterns() {
        try {
            const patterns = Object.fromEntries(this.learnedPatterns);
            await fs.writeFile(LEARNED_PATTERNS_PATH, JSON.stringify(patterns, null, 2));
            console.log('[InteractionHandler] Successfully saved learned patterns.');
        } catch (error) {
            console.error('[InteractionHandler] Error saving learned patterns:', error);
        }
    }

    /**
     * Starts the MutationObserver to watch for dynamic pop-ups and other interruptions.
     * This is the core of the real-time, delayed pop-up handling.
     */
    async startObserver() {
        if (this.observerAttached) {
            return;
        }

        // Expose a function from Node.js to the browser context for logging.
        await this.page.exposeFunction('onInteractionFound', (log) => {
            console.log(`[InteractionHandler] Observer: ${log}`);
        });

        // Inject the MutationObserver into the page.
        await this.page.evaluate(() => {
            const keywords = {
                cookie: ['accept', 'agree', 'allow', 'got it', 'ok', 'continue'],
                popup: ['close', 'dismiss', 'no thanks', 'maybe later', 'not now'],
                chat: ['close', 'end chat']
            };

            const clickElement = (element, reason) => {
                if (element && element.offsetParent !== null && !element.disabled) {
                    element.click();
                    window.onInteractionFound(`Clicked ${reason} element.`);
                    return true;
                }
                return false;
            };

            const checkAndClick = (element) => {
                if (!element || element.nodeType !== Node.ELEMENT_NODE) return;

                const checkButtons = (buttons) => {
                    for (const button of buttons) {
                        const text = button.textContent.toLowerCase();
                        const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();

                        if (keywords.popup.some(k => text.includes(k) || ariaLabel.includes(k))) {
                            if (clickElement(button, 'pop-up')) return true;
                        }
                        if (keywords.cookie.some(k => text.includes(k) || ariaLabel.includes(k))) {
                            if (clickElement(button, 'cookie banner')) return true;
                        }
                    }
                    return false;
                };

                const buttons = element.querySelectorAll('button');
                return checkButtons(buttons);
            };

            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        for (const node of mutation.addedNodes) {
                            if (checkAndClick(node)) break;
                        }
                    } else if (mutation.type === 'attributes') {
                        if (checkAndClick(mutation.target)) break;
                    }
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class', 'hidden', 'disabled']
            });
            console.log('[InteractionHandler] Advanced MutationObserver started.');
        });

        this.observerAttached = true;
    }

    /**
     * A general-purpose handler that attempts to clear all known interruptions.
     * This can be called once after page load for elements that are present immediately.
     */
    async handleAllInteractions(url) {
        const domain = new URL(url).hostname;
        console.log(`[InteractionHandler] Running initial interaction check for ${domain}...`);

        let handled = await this.handleCookieBanners(domain);
        if (handled) {
            console.log('[InteractionHandler] Handled a cookie banner.');
        }

        handled = await this.handlePopups(domain);
        if (handled) {
            console.log('[InteractionHandler] Handled a pop-up.');
        }
        // Add more handlers here as needed (e.g., for chat widgets).
    }

    /**
     * Specifically handles cookie consent banners by trying a list of selectors.
     */
    async handleCookieBanners(domain) {
        const selectors = [
            // High-confidence selectors
            'button:has-text("Accept all")',
            'button:has-text("Allow all")',
            'button:has-text("I agree")',
            'button:has-text("Accept")',
            'button:has-text("Agree")',
            'button:has-text("Allow")',
            // Common IDs and classes
            '#onetrust-accept-btn-handler',
            '#cookie-accept',
            '.cookie-accept-button',
            '[data-testid="cookie-policy-banner-accept-button"]',
            // Generic container selectors
            '[id*="cookie"] button',
            '[class*="cookie"] button',
            '[id*="consent"] button',
            '[class*="consent"] button',
        ];

        return this.tryToClick(selectors, 'cookie-banner', domain);
    }

    /**
     * Specifically handles generic pop-ups by looking for close buttons.
     */
    async handlePopups(domain) {
        const selectors = [
            // High-confidence selectors for pop-up close buttons
            'button[aria-label*="close" i]',
            'button[aria-label*="dismiss" i]',
            '[role="dialog"] button[class*="close"]',
            // Common classes and IDs
            '.close-button',
            '#pop-up-close-button',
            '.modal-close',
            // More generic selectors
            '[class*="close"]',
            '[id*="close"]',
            'button:has-text("Not now")',
            'button:has-text("Maybe later")',
        ];

        return this.tryToClick(selectors, 'popup', domain);
    }

    /**
     * Tries to find and click an element from a list of selectors.
     * @param {string[]} selectors - A list of selectors to try in order.
     * @param {string} interactionType - The type of interaction (e.g., 'cookie-banner').
     * @param {string} domain - The domain of the current page.
     * @returns {boolean} - True if an element was clicked, false otherwise.
     */
    async tryToClick(selectors, interactionType, domain) {
        const learnedSelector = this.learnedPatterns.get(`${domain}:${interactionType}`);
        if (learnedSelector) {
            selectors.unshift(learnedSelector); // Prioritize the learned selector
        }

        for (const selector of selectors) {
            try {
                const clicked = await this.page.evaluate((sel) => {
                    const element = document.querySelector(sel);
                    // Check if the element is visible and clickable
                    if (element && element.offsetParent !== null && !element.disabled) {
                        element.click();
                        return true;
                    }
                    return false;
                }, selector);

                if (clicked) {
                    console.log(`[InteractionHandler] Successfully clicked element for ${interactionType} with selector: ${selector}`);
                    await this.learnInteraction(domain, interactionType, selector);
                    return true;
                }
            } catch (error) {
                // Ignore errors, just means the selector didn't work.
            }
        }
        return false;
    }

    /**
     * The core of the self-learning mechanism. It records a successful selector for a given
     * domain and interaction type, and then persists the learned patterns to a file.
     */
    async learnInteraction(domain, interactionType, successfulSelector) {
        const key = `${domain}:${interactionType}`;
        const existingPattern = this.learnedPatterns.get(key);

        // Only save if the pattern is new or has changed.
        if (existingPattern !== successfulSelector) {
            console.log(`[InteractionHandler] Learning new pattern for ${key}: ${successfulSelector}`);
            this.learnedPatterns.set(key, successfulSelector);
            await this.savePatterns();
        }
    }
}

module.exports = { AdaptiveInteractionHandler };
