/**
 * LinkedIn Image Anti-Bot Detection System
 * Specialized system for bypassing LinkedIn's CDN bot detection for image scraping
 * Handles both local development and Linux production environments
 */

const crypto = require('crypto');
const os = require('os');
const { LinkedInProductionConfig } = require('./linkedin-production-config');

class LinkedInImageAntiBotSystem {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.requestCount = 0;
        this.lastRequestTime = 0;
        this.lastUserAgentRotation = 0;
        this.requestHistory = [];
        this.ipRotationPool = [];
        this.cookieJar = new Map();
        this.fingerprintCache = new Map();
        
        // Initialize production configuration
        this.productionConfig = new LinkedInProductionConfig();
        
        // LinkedIn-specific detection patterns
        this.linkedinDetectionFactors = {
            userAgentConsistency: true,
            headerFingerprinting: true,
            requestTiming: true,
            referrerValidation: true,
            sessionPersistence: true,
            tlsFingerprinting: true,
            behaviorAnalysis: true
        };
        
        this.initializeSystem();
    }

    generateSessionId() {
        return crypto.randomBytes(16).toString('hex');
    }

    initializeSystem() {
        console.log('🛡️ [LinkedIn Anti-Bot] Initializing advanced LinkedIn image anti-bot system');
        console.log(`🔧 [LinkedIn Anti-Bot] Environment: ${this.isProduction() ? 'Production (Linux)' : 'Development (Local)'}`);
        console.log(`🆔 [LinkedIn Anti-Bot] Session ID: ${this.sessionId}`);
    }

    isProduction() {
        return process.env.NODE_ENV === 'production' || process.env.RENDER || os.platform() === 'linux';
    }

    /**
     * Generate LinkedIn-specific user agents that are less likely to be detected
     * Uses real browser fingerprints and avoids common bot signatures
     */
    getLinkedInOptimizedUserAgent() {
        const isProduction = this.isProduction();
        
        // LinkedIn prefers these specific browser versions (based on analysis)
        const linkedinFriendlyVersions = {
            chrome: ['120.0.0.0', '119.0.0.0', '121.0.0.0', '118.0.0.0'],
            firefox: ['118.0', '119.0', '120.0'],
            edge: ['120.0.0.0', '119.0.0.0']
        };

        let userAgents;
        
        if (isProduction) {
            // Linux production environment - use server-like but realistic UAs
            userAgents = [
                `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${this.randomChoice(linkedinFriendlyVersions.chrome)} Safari/537.36`,
                `Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:${this.randomChoice(linkedinFriendlyVersions.firefox)}) Gecko/20100101 Firefox/${this.randomChoice(linkedinFriendlyVersions.firefox)}`,
                `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${this.randomChoice(linkedinFriendlyVersions.chrome)} Safari/537.36`,
                // Add some variety with different Linux distributions
                `Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:${this.randomChoice(linkedinFriendlyVersions.firefox)}) Gecko/20100101 Firefox/${this.randomChoice(linkedinFriendlyVersions.firefox)}`,
                `Mozilla/5.0 (X11; CentOS; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${this.randomChoice(linkedinFriendlyVersions.chrome)} Safari/537.36`
            ];
        } else {
            // Local development - use desktop user agents
            userAgents = [
                `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${this.randomChoice(linkedinFriendlyVersions.chrome)} Safari/537.36`,
                `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${this.randomChoice(linkedinFriendlyVersions.firefox)}) Gecko/20100101 Firefox/${this.randomChoice(linkedinFriendlyVersions.firefox)}`,
                `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${this.randomChoice(linkedinFriendlyVersions.chrome)} Safari/537.36 Edg/${this.randomChoice(linkedinFriendlyVersions.edge)}`,
                `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${this.randomChoice(linkedinFriendlyVersions.chrome)} Safari/537.36`,
                `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${this.randomChoice(linkedinFriendlyVersions.firefox)}) Gecko/20100101 Firefox/${this.randomChoice(linkedinFriendlyVersions.firefox)}`
            ];
        }

        return this.randomChoice(userAgents);
    }

    /**
     * Generate LinkedIn-specific headers that mimic real browser requests
     * These headers are crucial for bypassing LinkedIn's CDN bot detection
     * Uses production configuration for environment-specific optimization
     */
    getLinkedInImageHeaders(imageUrl, refererUrl = null) {
        // Check if we should rotate user agent
        if (this.productionConfig.shouldRotateUserAgent(this.lastUserAgentRotation)) {
            this.lastUserAgentRotation = Date.now();
        }
        
        const userAgent = this.getLinkedInOptimizedUserAgent();
        
        // Use production config for base headers
        const headers = this.productionConfig.getLinkedInHeaders(imageUrl);
        
        // Override with our user agent
        headers['User-Agent'] = userAgent;
        
        // Add referer - crucial for LinkedIn CDN
        if (refererUrl) {
            headers['Referer'] = refererUrl;
        } else if (!headers['Referer']) {
            // Use realistic LinkedIn referers
            const linkedinReferers = [
                'https://www.linkedin.com/',
                'https://www.linkedin.com/feed/',
                'https://www.linkedin.com/company/',
                'https://www.linkedin.com/in/',
                'https://www.linkedin.com/search/'
            ];
            headers['Referer'] = this.randomChoice(linkedinReferers);
        }

        // Chrome-specific headers (if using Chrome UA)
        if (userAgent.includes('Chrome')) {
            const chromeVersion = userAgent.match(/Chrome\/(\d+)/)?.[1] || '120';
            headers['Sec-Ch-Ua'] = `"Not_A Brand";v="8", "Chromium";v="${chromeVersion}", "Google Chrome";v="${chromeVersion}"`;
            headers['Sec-Ch-Ua-Mobile'] = '?0';
            headers['Sec-Ch-Ua-Platform'] = this.isProduction() ? '"Linux"' : '"Windows"';
            headers['Sec-Ch-Ua-Platform-Version'] = this.isProduction() ? '"5.4.0"' : '"10.0.0"';
        }

        // Add some randomization to avoid fingerprinting
        if (Math.random() > 0.5) {
            headers['Upgrade-Insecure-Requests'] = '1';
        }

        // LinkedIn sometimes checks for these
        if (Math.random() > 0.7) {
            headers['X-Requested-With'] = 'XMLHttpRequest';
        }

        return headers;
    }

    /**
     * Get LinkedIn-optimized Accept-Language header
     */
    getLinkedInAcceptLanguage() {
        // LinkedIn is primarily English but supports multiple languages
        const languages = [
            'en-US,en;q=0.9',
            'en-US,en;q=0.9,es;q=0.8',
            'en-GB,en-US;q=0.9,en;q=0.8',
            'en-US,en;q=0.8,es;q=0.7',
            'en-US,en;q=0.9,fr;q=0.8,de;q=0.7'
        ];
        return this.randomChoice(languages);
    }

    /**
     * Generate browser arguments optimized for LinkedIn image scraping
     * Uses production configuration for environment-specific optimization
     */
    getLinkedInBrowserArgs() {
        // Use production configuration for browser arguments
        return this.productionConfig.config.browser.args || this.getDefaultBrowserArgs();
    }

    /**
     * Fallback browser arguments if production config is not available
     */
    getDefaultBrowserArgs() {
        const isProduction = this.isProduction();
        
        const baseArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--disable-default-apps',
            '--disable-extensions',
            '--disable-component-extensions-with-background-pages'
        ];

        // LinkedIn-specific anti-detection arguments
        const linkedinArgs = [
            '--disable-blink-features=AutomationControlled',
            '--exclude-switches=enable-automation',
            '--disable-web-security', // Sometimes needed for CORS
            '--disable-features=VizDisplayCompositor',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-hang-monitor',
            '--disable-client-side-phishing-detection',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            '--disable-sync',
            '--metrics-recording-only',
            '--no-report-upload',
            '--safebrowsing-disable-auto-update',
            '--disable-domain-reliability'
        ];

        // Production-specific arguments for Linux servers
        if (isProduction) {
            linkedinArgs.push(
                '--single-process', // Better for containers
                '--no-zygote',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-breakpad',
                '--disable-component-update',
                '--disable-domain-reliability',
                '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                '--hide-scrollbars',
                '--mute-audio'
            );
        }

        // Randomize window size to avoid fingerprinting
        const windowSizes = [
            '--window-size=1366,768',
            '--window-size=1920,1080',
            '--window-size=1440,900',
            '--window-size=1536,864'
        ];
        linkedinArgs.push(this.randomChoice(windowSizes));

        return [...baseArgs, ...linkedinArgs];
    }

    /**
     * Implement human-like delays between requests to avoid rate limiting
     * Uses production configuration for adaptive delays
     */
    async implementHumanDelay() {
        const now = Date.now();
        
        // Use production config for adaptive delay calculation
        const delay = this.productionConfig.getAdaptiveDelay(this.requestHistory);
        
        console.log(`⏳ [LinkedIn Anti-Bot] Implementing adaptive human delay: ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Update request history
        this.lastRequestTime = now;
        this.requestCount++;
        this.requestHistory.push(now);
        
        // Keep request history manageable (last 100 requests)
        if (this.requestHistory.length > 100) {
            this.requestHistory = this.requestHistory.slice(-100);
        }
    }

    /**
     * Setup stealth mode for Puppeteer page specifically for LinkedIn images
     */
    async setupLinkedInStealthMode(page) {
        console.log('🥷 [LinkedIn Anti-Bot] Setting up stealth mode for LinkedIn image extraction');
        
        // Remove automation indicators
        await page.evaluateOnNewDocument(() => {
            // Remove webdriver property
            delete navigator.__proto__.webdriver;
            
            // Override the plugins property to use a custom getter
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5] // Fake plugins
            });
            
            // Override the languages property
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
            
            // Override the permissions property
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            
            // Mock chrome runtime for better stealth
            if (!window.chrome) {
                window.chrome = {};
            }
            if (!window.chrome.runtime) {
                window.chrome.runtime = {
                    onConnect: undefined,
                    onMessage: undefined
                };
            }
        });

        // Set realistic viewport
        const viewports = [
            { width: 1366, height: 768 },
            { width: 1920, height: 1080 },
            { width: 1440, height: 900 },
            { width: 1536, height: 864 }
        ];
        await page.setViewport(this.randomChoice(viewports));

        // Set extra HTTP headers
        await page.setExtraHTTPHeaders(this.getLinkedInImageHeaders());
    }

    /**
     * Validate if an image URL is from LinkedIn CDN
     */
    isLinkedInImageUrl(url) {
        const linkedinDomains = [
            'static.licdn.com',
            'media.licdn.com',
            'cdn.lynda.com',
            'dms.licdn.com'
        ];
        
        return linkedinDomains.some(domain => url.includes(domain));
    }

    /**
     * Generate alternative LinkedIn image URLs when original fails
     */
    generateAlternativeLinkedInUrls(originalUrl) {
        if (!this.isLinkedInImageUrl(originalUrl)) {
            return [];
        }

        const alternatives = [];
        
        try {
            const url = new URL(originalUrl);
            
            // Strategy 1: Try different size parameters
            if (url.pathname.includes('/sc/h/')) {
                alternatives.push(originalUrl.replace('/sc/h/', '/sc/p/'));
                alternatives.push(originalUrl + '/shrink_200_200');
                alternatives.push(originalUrl + '/shrink_400_400');
                alternatives.push(originalUrl + '/shrink_800_800');
            }
            
            // Strategy 2: Try different image formats
            if (url.searchParams.has('e') && url.searchParams.has('v')) {
                const newUrl = new URL(originalUrl);
                newUrl.searchParams.set('v', 'beta');
                newUrl.searchParams.set('t', Date.now().toString());
                alternatives.push(newUrl.toString());
            }
            
            // Strategy 3: Remove problematic parameters
            const cleanUrl = new URL(originalUrl);
            cleanUrl.search = ''; // Remove all query parameters
            alternatives.push(cleanUrl.toString());
            
            // Strategy 4: Try with common LinkedIn image parameters
            const paramVariations = [
                `${originalUrl}?trk=public_profile_browsemap`,
                `${originalUrl}?v=beta&t=${Date.now()}`,
                `${originalUrl}?lipi=urn%3Ali%3Apage%3Ad_flagship3_company%3B${this.sessionId}`
            ];
            alternatives.push(...paramVariations);
            
        } catch (error) {
            console.warn('🚨 [LinkedIn Anti-Bot] Error generating alternative URLs:', error.message);
        }
        
        return alternatives;
    }

    /**
     * Utility function for random choice
     */
    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    /**
     * Get session-specific cookies for LinkedIn
     */
    getLinkedInSessionCookies() {
        // Generate realistic LinkedIn session cookies
        const cookies = [
            {
                name: 'li_at',
                value: this.generateRandomToken(64),
                domain: '.linkedin.com',
                path: '/',
                httpOnly: true,
                secure: true
            },
            {
                name: 'JSESSIONID',
                value: `"ajax:${this.generateRandomToken(16)}"`,
                domain: '.linkedin.com',
                path: '/',
                httpOnly: true
            },
            {
                name: 'bcookie',
                value: `"v=2&${this.generateRandomToken(32)}"`,
                domain: '.linkedin.com',
                path: '/'
            }
        ];
        
        return cookies;
    }

    generateRandomToken(length) {
        return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
    }

    /**
     * Log anti-bot activity for monitoring
     */
    logActivity(action, details = {}) {
        const timestamp = new Date().toISOString();
        console.log(`🛡️ [LinkedIn Anti-Bot] ${timestamp} - ${action}`, details);
    }
}

module.exports = { LinkedInImageAntiBotSystem };