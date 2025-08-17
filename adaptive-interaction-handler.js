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
    constructor(page, options = {}) {
        this.page = page;
        this.learnedPatterns = new Map();
        this.observerAttached = false;
        this.dryRun = options.dryRun || false; // Add dryRun option
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

        // Inject the MutationObserver into the page, passing the dryRun status.
        await this.page.evaluate((dryRun) => {
            const keywords = {
                cookie: ['accept', 'agree', 'allow', 'got it', 'ok', 'continue'],
                popup: ['close', 'dismiss', 'no thanks', 'maybe later', 'not now'],
                chat: ['close', 'end chat']
            };

            const clickElement = (element, reason) => {
                if (element && element.offsetParent !== null && !element.disabled) {
                    if (dryRun) {
                        window.onInteractionFound(`[DRY RUN] Would have clicked ${reason} element with selector: ${element.outerHTML}`);
                    } else {
                        element.click();
                        window.onInteractionFound(`Clicked ${reason} element.`);
                    }
                    return true;
                }
                return false;
            };

            const checkAndClick = (element) => {
                if (!element || element.nodeType !== Node.ELEMENT_NODE) return;

                // Only consider elements that are likely to be modals or banners
                const role = element.getAttribute('role');
                const isLikelyContainer = role === 'dialog' || role === 'alertdialog' || element.id.includes('cookie') || element.className.includes('consent');

                if (!isLikelyContainer) return false;

                const checkButtons = (buttons) => {
                    for (const button of buttons) {
                        const text = (button.textContent || '').toLowerCase().trim();
                        const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();

                        // More specific keyword matching
                        if (keywords.popup.some(k => text === k || ariaLabel.includes(k))) {
                            if (clickElement(button, 'pop-up')) return true;
                        }
                        if (keywords.cookie.some(k => text === k || ariaLabel.includes(k))) {
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
        }, this.dryRun); // Pass dryRun status to the browser context

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
            // Prioritize selectors with specific roles and ARIA labels
            '[data-testid="cookie-policy-banner-accept-button"]',
            '#onetrust-accept-btn-handler',
            'button[aria-label*="accept all" i]',
            'button[aria-label*="allow all" i]',
            // Then, text-based selectors which are quite reliable
            'button:has-text(/^Accept all$/i)',
            'button:has-text(/^Allow all$/i)',
            'button:has-text(/^I agree$/i)',
            'button:has-text(/^Accept$/i)',
            // Less specific selectors
            '[id*="cookie"] button:has-text(/accept/i)',
            '[class*="cookie"] button:has-text(/agree/i)',
            '[id*="consent"] button:has-text(/allow/i)',
            '[class*="consent"] button:has-text(/ok/i)',
        ];

        return this.tryToClick(selectors, 'cookie-banner', domain);
    }

    /**
     * Specifically handles generic pop-ups by looking for close buttons.
     */
    async handlePopups(domain) {
        const selectors = [
            // Prioritize specific ARIA labels within dialogs
            '[role="dialog"] button[aria-label*="close" i]',
            '[role="dialog"] button[aria-label*="dismiss" i]',
            // Generic ARIA labels
            'button[aria-label*="close" i]',
            'button[aria-label*="dismiss" i]',
            // Common class names for close buttons, often within a modal
            '.modal-header .close',
            '.modal-close',
            '.close-button',
            'button.close',
            // Text-based dismissal buttons
            'button:has-text(/^Not now$/i)',
            'button:has-text(/^Maybe later$/i)',
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
                const clickResult = await this.page.evaluate((sel, dryRun) => {
                    const element = document.querySelector(sel);
                    if (element && element.offsetParent !== null && !element.disabled) {
                        if (dryRun) {
                            console.log(`[InteractionHandler DEBUG] [DRY RUN] Would click element with selector: "${sel}". OuterHTML: ${element.outerHTML}`);
                        } else {
                            console.log(`[InteractionHandler DEBUG] Found element with selector: "${sel}". OuterHTML: ${element.outerHTML}`);
                            element.click();
                        }
                        return { clicked: true, outerHTML: element.outerHTML };
                    }
                    return { clicked: false };
                }, selector, this.dryRun);

                if (clickResult.clicked) {
                    if (this.dryRun) {
                        console.log(`[InteractionHandler] [DRY RUN] Would have handled ${interactionType} with selector: "${selector}".`);
                        // In a dry run, we can't be sure it was successful, but we proceed as if it was handled to see the next steps.
                        return true;
                    }
                    console.log(`[InteractionHandler] Successfully clicked element for ${interactionType} with selector: "${selector}".`);
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
