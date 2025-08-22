/**
 * Facebook-Specific Anti-Bot System
 * Advanced measures to bypass Facebook's sophisticated bot detection
 */

const { antiBotSystem } = require('./anti-bot-system');
const { extractionLogger } = require('./extraction-logger');
const { FacebookLearningSystem } = require('./facebook-learning-system');
const { FacebookPlatformUtils } = require('./facebook-platform-utils');

class FacebookAntiBotSystem {
    constructor() {
        const isProduction = FacebookPlatformUtils.isProduction();
        
        // Platform-specific user agents
        this.facebookUserAgents = isProduction ? [
            // Linux production user agents
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/120.0'
        ] : [
            // Development user agents (Windows/Mac)
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
        ];
        
        this.currentUserAgent = null;
        this.sessionCookies = new Map();
        this.learningSystem = new FacebookLearningSystem();
    }

    /**
     * Get Facebook-optimized user agent using learning system
     */
    getFacebookUserAgent() {
        if (!this.currentUserAgent) {
            const bestAgent = this.learningSystem.getBestUserAgent();
            this.currentUserAgent = bestAgent || this.facebookUserAgents[Math.floor(Math.random() * this.facebookUserAgents.length)];
        }
        return this.currentUserAgent;
    }

    /**
     * Get Facebook-specific headers with platform compatibility
     */
    getFacebookHeaders(referer = 'https://www.google.com/') {
        const userAgent = this.getFacebookUserAgent();
        const isLinux = userAgent.includes('Linux');
        
        const headers = {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
            'Referer': referer
        };
        
        // Add Chrome-specific headers if using Chrome user agent
        if (userAgent.includes('Chrome')) {
            const version = userAgent.match(/Chrome\/(\d+)/)?.[1] || '120';
            headers['Sec-Ch-Ua'] = `"Not_A Brand";v="8", "Chromium";v="${version}", "Google Chrome";v="${version}"`;
            headers['Sec-Ch-Ua-Mobile'] = '?0';
            headers['Sec-Ch-Ua-Platform'] = isLinux ? '"Linux"' : '"Windows"';
        }
        
        return headers;
    }

    /**
     * Setup Facebook-specific stealth mode
     */
    async setupFacebookStealth(page, sessionId) {
        try {
            // Remove webdriver traces
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                
                // Remove automation indicators
                delete window.navigator.__proto__.webdriver;
                
                // Mock chrome runtime
                window.chrome = {
                    runtime: {}
                };
                
                // Override permissions
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: 'denied' }) :
                        originalQuery(parameters)
                );
                
                // Mock plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
                
                // Mock languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
            });

            // Set realistic viewport
            await page.setViewport({
                width: 1366 + Math.floor(Math.random() * 200),
                height: 768 + Math.floor(Math.random() * 200),
                deviceScaleFactor: 1,
                hasTouch: false,
                isLandscape: true,
                isMobile: false,
            });

            // Set user agent
            await page.setUserAgent(this.getFacebookUserAgent());

            // Set extra headers
            await page.setExtraHTTPHeaders(this.getFacebookHeaders());

            extractionLogger.info('Facebook stealth mode activated', { userAgent: this.getFacebookUserAgent() }, sessionId);
        } catch (error) {
            extractionLogger.warn('Facebook stealth setup failed', { error: error.message }, sessionId);
        }
    }

    /**
     * Handle Facebook-specific popups and overlays
     */
    async handleFacebookPopups(page, sessionId) {
        try {
            // Wait for page to load
            await page.waitForTimeout(2000);

            // Handle cookie consent
            const cookieSelectors = [
                '[data-testid="cookie-policy-manage-dialog"] button[data-testid="cookie-policy-manage-dialog-accept-button"]',
                'button[data-cookiebanner="accept_button"]',
                'button[title="Accept All"]',
                'button:contains("Allow all cookies")',
                'button:contains("Accept all")',
                '[aria-label="Allow all cookies"]'
            ];

            for (const selector of cookieSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        await element.click();
                        await page.waitForTimeout(1000);
                        extractionLogger.info('Closed cookie consent popup', { selector }, sessionId);
                        break;
                    }
                } catch (error) {
                    // Continue to next selector
                }
            }

            // Handle login prompts
            const loginSelectors = [
                'div[role="button"]:contains("Not Now")',
                'button:contains("Not Now")',
                '[aria-label="Close"]',
                'div[aria-label="Close"]'
            ];

            for (const selector of loginSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        await element.click();
                        await page.waitForTimeout(1000);
                        extractionLogger.info('Closed login prompt', { selector }, sessionId);
                        break;
                    }
                } catch (error) {
                    // Continue to next selector
                }
            }

        } catch (error) {
            extractionLogger.warn('Error handling Facebook popups', { error: error.message }, sessionId);
        }
    }

    /**
     * Simulate human-like behavior on Facebook
     */
    async simulateFacebookBehavior(page, sessionId) {
        try {
            // Random mouse movements
            const movements = Math.floor(Math.random() * 3) + 2;
            for (let i = 0; i < movements; i++) {
                const x = Math.floor(Math.random() * 800) + 100;
                const y = Math.floor(Math.random() * 600) + 100;
                await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
                await page.waitForTimeout(Math.floor(Math.random() * 500) + 200);
            }

            // Random scrolling
            const scrolls = Math.floor(Math.random() * 3) + 1;
            for (let i = 0; i < scrolls; i++) {
                const scrollDistance = Math.floor(Math.random() * 300) + 100;
                await page.evaluate((distance) => {
                    window.scrollBy(0, distance);
                }, scrollDistance);
                await page.waitForTimeout(Math.floor(Math.random() * 1000) + 800);
            }

            extractionLogger.info('Simulated human behavior on Facebook', { movements, scrolls }, sessionId);
        } catch (error) {
            extractionLogger.warn('Error simulating Facebook behavior', { error: error.message }, sessionId);
        }
    }

    /**
     * Enhanced navigation with anti-detection and learning
     */
    async navigateToFacebookPage(page, url, sessionId) {
        const startTime = Date.now();
        
        try {
            const recommendedDelay = this.learningSystem.getRecommendedDelay(url);
            if (this.learningSystem.isDomainProblematic(url)) {
                extractionLogger.warn('Domain flagged as problematic, using extended delay', { delay: recommendedDelay }, sessionId);
                await page.waitForTimeout(recommendedDelay);
            }

            await page.setExtraHTTPHeaders({
                ...this.getFacebookHeaders(),
                'Referer': 'https://www.google.com/'
            });

            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            await page.waitForTimeout(3000);
            await this.handleFacebookPopups(page, sessionId);
            await this.simulateFacebookBehavior(page, sessionId);

            await this.learningSystem.recordAttempt({
                url,
                userAgent: this.currentUserAgent,
                success: true,
                strategy: 'navigation',
                responseTime: Date.now() - startTime
            });

            extractionLogger.info('Successfully navigated to Facebook page', { url }, sessionId);
            return true;
        } catch (error) {
            await this.learningSystem.recordAttempt({
                url,
                userAgent: this.currentUserAgent,
                success: false,
                error: error.message,
                strategy: 'navigation'
            });

            extractionLogger.error('Failed to navigate to Facebook page', { url, error: error.message }, sessionId);
            return false;
        }
    }

    /**
     * Get Facebook-optimized browser args with Linux compatibility
     */
    getFacebookBrowserArgs() {
        const baseArgs = antiBotSystem.getAdvancedBrowserArgs();
        const adaptiveArgs = this.learningSystem.getAdaptiveBrowserArgs();
        
        const facebookSpecificArgs = [
            '--disable-blink-features=AutomationControlled',
            '--exclude-switches=enable-automation',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-field-trial-config',
            '--disable-back-forward-cache',
            '--disable-ipc-flooding-protection',
            '--metrics-recording-only',
            '--no-report-upload',
            '--disable-sync'
        ];
        
        // Platform-specific optimizations
        const platformArgs = [];
        
        if (FacebookPlatformUtils.isProduction() || FacebookPlatformUtils.isLinux()) {
            platformArgs.push(
                '--single-process',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=site-per-process',
                '--disable-dev-shm-usage'
            );
        }
        
        const memoryArgs = FacebookPlatformUtils.getMemoryOptimizedArgs();

        return [...baseArgs, ...adaptiveArgs, ...facebookSpecificArgs, ...platformArgs, ...memoryArgs];
    }

    /**
     * Setup request interception for Facebook
     */
    async setupFacebookInterception(page, sessionId) {
        try {
            await page.setRequestInterception(true);
            
            page.on('request', (request) => {
                const url = request.url();
                const resourceType = request.resourceType();
                
                // Block unnecessary resources to speed up loading
                if (resourceType === 'image' || resourceType === 'media' || resourceType === 'font') {
                    request.abort();
                    return;
                }
                
                // Block tracking and analytics
                if (url.includes('analytics') || url.includes('tracking') || url.includes('ads')) {
                    request.abort();
                    return;
                }
                
                // Continue with modified headers
                const headers = {
                    ...request.headers(),
                    ...this.getFacebookHeaders(request.headers().referer)
                };
                
                request.continue({ headers });
            });

            extractionLogger.info('Facebook request interception setup complete', {}, sessionId);
        } catch (error) {
            extractionLogger.warn('Failed to setup Facebook request interception', { error: error.message }, sessionId);
        }
    }

    /**
     * Wait for Facebook page to be ready
     */
    async waitForFacebookPageReady(page, sessionId) {
        try {
            // Wait for basic page structure
            await page.waitForSelector('body', { timeout: 30000 });
            
            // Wait for content to load
            await page.waitForFunction(() => {
                return document.readyState === 'complete' && 
                       document.querySelector('body') && 
                       document.querySelector('body').children.length > 0;
            }, { timeout: 30000 });

            // Additional wait for dynamic content
            await page.waitForTimeout(5000);

            extractionLogger.info('Facebook page ready for extraction', {}, sessionId);
            return true;
        } catch (error) {
            extractionLogger.warn('Timeout waiting for Facebook page to be ready', { error: error.message }, sessionId);
            return false;
        }
    }

    /**
     * Enhanced error recovery for Facebook with learning
     */
    async handleFacebookError(page, error, sessionId, url = null) {
        try {
            extractionLogger.warn('Handling Facebook error', { error: error.message }, sessionId);
            
            const isBlocked = await page.evaluate(() => {
                return document.body.innerText.includes('blocked') || 
                       document.body.innerText.includes('temporarily unavailable') ||
                       document.body.innerText.includes('try again later') ||
                       document.body.innerText.includes('rate limit');
            });

            if (isBlocked) {
                if (url) {
                    await this.learningSystem.recordAttempt({
                        url,
                        userAgent: this.currentUserAgent,
                        success: false,
                        error: 'blocked',
                        strategy: 'error_recovery'
                    });
                }
                
                extractionLogger.error('Facebook page is blocked', {}, sessionId);
                return { blocked: true, error: 'Page blocked by Facebook' };
            }

            await page.reload({ waitUntil: 'domcontentloaded' });
            await this.waitForFacebookPageReady(page, sessionId);
            
            return { recovered: true };
        } catch (recoveryError) {
            extractionLogger.error('Failed to recover from Facebook error', { 
                originalError: error.message, 
                recoveryError: recoveryError.message 
            }, sessionId);
            return { failed: true, error: recoveryError.message };
        }
    }

    getLearningAnalytics() {
        return this.learningSystem.getAnalytics();
    }

    async recordExtractionResult(url, success, error = null, selectors = null) {
        await this.learningSystem.recordAttempt({
            url,
            userAgent: this.currentUserAgent,
            success,
            error,
            selectors,
            strategy: 'extraction'
        });
    }
}

module.exports = { FacebookAntiBotSystem };