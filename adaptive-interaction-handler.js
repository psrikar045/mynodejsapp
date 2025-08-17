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
        this.dryRun = options.dryRun || false;
    }

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

    async savePatterns() {
        try {
            const patterns = Object.fromEntries(this.learnedPatterns);
            await fs.writeFile(LEARNED_PATTERNS_PATH, JSON.stringify(patterns, null, 2));
            console.log('[InteractionHandler] Successfully saved learned patterns.');
        } catch (error) {
            console.error('[InteractionHandler] Error saving learned patterns:', error);
        }
    }

    async startObserver() {
        if (this.observerAttached) {
            return;
        }

        await this.page.exposeFunction('onInteractionFound', (log) => {
            console.log(`[InteractionHandler] Observer: ${log}`);
        });

        await this.page.evaluate((dryRun) => {
            const keywords = {
                cookie: ['accept', 'agree', 'allow', 'got it', 'ok', 'continue'],
                popup: ['close', 'dismiss', 'no thanks', 'maybe later', 'not now'],
            };

            const clickElement = (element, reason) => {
                if (element && element.offsetParent !== null && !element.disabled) {
                    if (dryRun) {
                        window.onInteractionFound(`[DRY RUN] Would have clicked ${reason} element: ${element.outerHTML}`);
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

                const role = element.getAttribute('role');
                const isLikelyContainer = role === 'dialog' || role === 'alertdialog' || element.id.includes('cookie') || element.className.includes('consent');

                if (!isLikelyContainer) return false;

                const buttons = Array.from(element.querySelectorAll('button'));
                for (const button of buttons) {
                    const text = (button.textContent || '').toLowerCase().trim();
                    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();

                    if (keywords.popup.some(k => text === k || ariaLabel.includes(k))) {
                        if (clickElement(button, 'pop-up')) return true;
                    }
                    if (keywords.cookie.some(k => text === k || ariaLabel.includes(k))) {
                        if (clickElement(button, 'cookie banner')) return true;
                    }
                }
                return false;
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
                attributeFilter: ['style', 'class', 'hidden']
            });
            console.log('[InteractionHandler] Advanced MutationObserver started.');
        }, this.dryRun);

        this.observerAttached = true;
    }

    async handleAllInteractions(url) {
        const domain = new URL(url).hostname;
        console.log(`[InteractionHandler] Running initial interaction check for ${domain}...`);

        let handled = await this.tryToClick('cookie-banner', domain, [
            '[data-testid="cookie-policy-banner-accept-button"]',
            '#onetrust-accept-btn-handler',
            'button[aria-label*="accept all" i]',
            'button:has-text(/^Accept all$/i)',
            'button:has-text(/^I agree$/i)',
        ]);

        if (!handled) {
          handled = await this.tryToClick('popup', domain, [
              '[role="dialog"] button[aria-label*="close" i]',
              '[role="dialog"] button[aria-label*="dismiss" i]',
              'button.modal-close',
              'button:has-text(/^Not now$/i)',
          ]);
        }
    }

    async tryToClick(interactionType, domain, selectors) {
        const learnedSelector = this.learnedPatterns.get(`${domain}:${interactionType}`);
        if (learnedSelector) {
            selectors.unshift(learnedSelector);
        }

        for (const selector of selectors) {
            try {
                const clickResult = await this.page.evaluate((sel, dryRun) => {
                    const element = document.querySelector(sel);
                    if (element && element.offsetParent !== null && !element.disabled) {
                        if (dryRun) {
                            console.log(`[InteractionHandler DEBUG] [DRY RUN] Would click element with selector: "${sel}".`);
                        } else {
                            element.click();
                        }
                        return { clicked: true };
                    }
                    return { clicked: false };
                }, selector, this.dryRun);

                if (clickResult.clicked) {
                    if (this.dryRun) {
                        console.log(`[InteractionHandler] [DRY RUN] Would have handled ${interactionType} with selector: "${selector}".`);
                    } else {
                        console.log(`[InteractionHandler] Successfully handled ${interactionType} with selector: "${selector}".`);
                        await this.learnInteraction(domain, interactionType, selector);
                    }
                    return true;
                }
            } catch (error) {
                // Ignore errors
            }
        }
        return false;
    }

    async learnInteraction(domain, interactionType, successfulSelector) {
        const key = `${domain}:${interactionType}`;
        const existingPattern = this.learnedPatterns.get(key);

        if (existingPattern !== successfulSelector) {
            console.log(`[InteractionHandler] Learning new pattern for ${key}: ${successfulSelector}`);
            this.learnedPatterns.set(key, successfulSelector);
            await this.savePatterns();
        }
    }
}

module.exports = { AdaptiveInteractionHandler };
