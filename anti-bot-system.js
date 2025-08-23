/**
 * Advanced Anti-Bot Detection System
 * Provides sophisticated user agent rotation, browser fingerprinting, and human-like behavior patterns
 */

const os = require('os');
let crypto;

class AntiBotSystem {
    constructor() {
        this.currentSession = this.generateSessionId();
        this.lastUserAgentRotation = 0;
        this.userAgentRotationInterval = 5 * 60 * 1000; // 5 minutes
        this.behaviorPatterns = new Map();
        this.requestHistory = [];
        this.maxRequestHistorySize = 1000;
    }

    generateSessionId() {
        if (!crypto) crypto = require('crypto');
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Advanced User Agent Pool with realistic browser distributions
     * Based on real-world browser usage statistics
     */
    getRandomUserAgent(forceRotation = false) {
        const now = Date.now();
        const shouldRotate = forceRotation || (now - this.lastUserAgentRotation > this.userAgentRotationInterval);
        
        if (!shouldRotate && this.currentUserAgent) {
            return this.currentUserAgent;
        }

        const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
        const platform = os.platform();

        // Chrome versions with realistic distribution
        const chromeVersions = [
            '120.0.0.0', '119.0.0.0', '118.0.0.0', '117.0.0.0', '116.0.0.0',
            '121.0.0.0', '122.0.0.0' // Newer versions for realism
        ];

        // Windows user agents (for local development)
        const windowsUserAgents = [
            `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${this.randomChoice(chromeVersions)} Safari/537.36`,
            `Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${this.randomChoice(chromeVersions)} Safari/537.36`,
            `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0`,
            `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${this.randomChoice(chromeVersions)} Safari/537.36 Edg/120.0.0.0`,
            `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${this.randomChoice(chromeVersions)} Safari/537.36 OPR/106.0.0.0`
        ];

        // Linux user agents (for production)
        const linuxUserAgents = [
            `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${this.randomChoice(chromeVersions)} Safari/537.36`,
            `Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/118.0`,
            `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${this.randomChoice(chromeVersions)} Safari/537.36`,
            `Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/118.0`
        ];

        const userAgentPool = (platform === 'linux' || isProduction) ? linuxUserAgents : windowsUserAgents;
        
        this.currentUserAgent = this.randomChoice(userAgentPool);
        this.lastUserAgentRotation = now;
        
        console.log(`🎭 [Anti-Bot] User agent rotated: ${this.currentUserAgent.split(' ')[2]}`);
        return this.currentUserAgent;
    }

    /**
     * Generate realistic browser headers that match the user agent
     */
    getBrowserHeaders() {
        const baseHeaders = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': this.getRandomAcceptLanguage(),
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        };

        // Add Chrome-specific headers if using Chrome user agent
        if (this.currentUserAgent && this.currentUserAgent.includes('Chrome')) {
            const version = this.currentUserAgent.match(/Chrome\/(\d+)/)?.[1] || '120';
            baseHeaders['Sec-Ch-Ua'] = `"Not_A Brand";v="8", "Chromium";v="${version}", "Google Chrome";v="${version}"`;
            baseHeaders['Sec-Ch-Ua-Mobile'] = '?0';
            baseHeaders['Sec-Ch-Ua-Platform'] = this.getChromePlatformHeader();
        }

        return baseHeaders;
    }

    getRandomAcceptLanguage() {
        const languages = [
            'en-US,en;q=0.9',
            'en-US,en;q=0.9,es;q=0.8',
            'en-US,en;q=0.9,fr;q=0.8',
            'en-GB,en;q=0.9',
            'en-US,en;q=0.8'
        ];
        return this.randomChoice(languages);
    }

    getChromePlatformHeader() {
        const platform = os.platform();
        const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
        
        if (platform === 'linux' || isProduction) {
            return '"Linux"';
        } else if (platform === 'win32') {
            return '"Windows"';
        } else {
            return '"macOS"';
        }
    }

    /**
     * Generate human-like browser arguments with anti-detection features
     */
    getAdvancedBrowserArgs() {
        const baseArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--window-size=1366,768'
        ];

        // Advanced anti-detection arguments
        const antiDetectionArgs = [
            '--disable-blink-features=AutomationControlled',
            '--exclude-switches=enable-automation',
            '--disable-extensions-http-throttling',
            '--disable-component-extensions-with-background-pages',
            '--disable-default-apps',
            '--disable-sync',
            '--metrics-recording-only',
            '--no-report-upload',
            '--disable-background-networking'
        ];

        // Production-specific arguments
        const productionArgs = process.env.NODE_ENV === 'production' || process.env.RENDER ? [
            '--single-process',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=site-per-process'
        ] : [];

        return [...baseArgs, ...antiDetectionArgs, ...productionArgs];
    }

    /**
     * Generate realistic viewport sizes
     */
    getRandomViewport() {
        const commonViewports = [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1536, height: 864 },
            { width: 1440, height: 900 },
            { width: 1600, height: 900 },
            { width: 1280, height: 720 }
        ];
        return this.randomChoice(commonViewports);
    }

    /**
     * Generate human-like delays with randomization
     */
    getRandomDelay(min = 1000, max = 3000) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Advanced human behavior simulation
     */
    async simulateHumanBehavior(page, options = {}) {
        const {
            enableMouseMovement = true,
            enableScrolling = true,
            enableTypingPattern = false
        } = options;

        try {
            // Random mouse movements
            if (enableMouseMovement) {
                const movements = Math.floor(Math.random() * 3) + 2; // 2-4 movements
                for (let i = 0; i < movements; i++) {
                    const x = Math.floor(Math.random() * 1200) + 100;
                    const y = Math.floor(Math.random() * 600) + 100;
                    const steps = Math.floor(Math.random() * 10) + 5; // 5-14 steps
                    
                    await page.mouse.move(x, y, { steps });
                    await this.humanDelay(100, 300);
                }
            }

            // Random scrolling behavior
            if (enableScrolling) {
                const scrolls = Math.floor(Math.random() * 3) + 1; // 1-3 scrolls
                for (let i = 0; i < scrolls; i++) {
                    const scrollDistance = Math.floor(Math.random() * 400) + 100;
                    await page.evaluate((distance) => {
                        window.scrollBy(0, distance);
                    }, scrollDistance);
                    await this.humanDelay(800, 1500);
                }
            }

        } catch (error) {
            console.warn('[Anti-Bot] Behavior simulation error:', error.message);
        }
    }

    /**
     * Enhanced stealth mode setup
     */
    async setupStealthMode(page) {
        try {
            // Remove navigator.webdriver property
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
            });

            // Mock navigator properties
            await page.evaluateOnNewDocument(() => {
                const originalQuery = window.navigator.permissions.query;
                return window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Denial.denied }) :
                        originalQuery(parameters)
                );
            });

            // Override plugin detection
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
            });

            // Mock canvas fingerprint
            await page.evaluateOnNewDocument(() => {
                const getContext = HTMLCanvasElement.prototype.getContext;
                HTMLCanvasElement.prototype.getContext = function(type) {
                    if (type === '2d') {
                        const context = getContext.call(this, type);
                        const originalFillText = context.fillText;
                        context.fillText = function(...args) {
                            // Add noise to canvas fingerprint
                            const noise = Math.random() * 0.1;
                            args[1] += noise;
                            args[2] += noise;
                            return originalFillText.apply(this, args);
                        };
                        return context;
                    }
                    return getContext.call(this, type);
                };
            });

            console.log('🛡️ [Anti-Bot] Stealth mode activated');
        } catch (error) {
            console.warn('[Anti-Bot] Stealth mode setup error:', error.message);
        }
    }

    /**
     * Human-like delay with natural variation
     */
    async humanDelay(min = 1000, max = 2000) {
        const baseDelay = Math.random() * (max - min) + min;
        // Add natural variation using normal distribution
        const variation = (Math.random() + Math.random() + Math.random()) / 3; // Approximate normal distribution
        const delay = baseDelay * (0.7 + 0.6 * variation);
        await new Promise(resolve => setTimeout(resolve, Math.floor(delay)));
    }

    /**
     * Track request patterns for anomaly detection
     */
    trackRequest(url, success, responseTime) {
        this.requestHistory.push({
            url,
            success,
            responseTime,
            timestamp: Date.now(),
            userAgent: this.currentUserAgent
        });

        // Limit history size to prevent memory leaks
        if (this.requestHistory.length > this.maxRequestHistorySize) {
            this.requestHistory = this.requestHistory.slice(-this.maxRequestHistorySize / 2);
        }
    }

    /**
     * Get performance analytics
     */
    getAnalytics() {
        const recent = this.requestHistory.slice(-100);
        const successRate = recent.length > 0 ? 
            (recent.filter(r => r.success).length / recent.length * 100).toFixed(1) : 0;
        
        const avgResponseTime = recent.length > 0 ? 
            recent.reduce((sum, r) => sum + r.responseTime, 0) / recent.length : 0;

        return {
            totalRequests: this.requestHistory.length,
            recentSuccessRate: `${successRate}%`,
            avgResponseTime: `${avgResponseTime.toFixed(0)}ms`,
            currentUserAgent: this.currentUserAgent?.split(' ')[2] || 'Not set',
            sessionId: this.currentSession,
            lastRotation: new Date(this.lastUserAgentRotation).toISOString()
        };
    }

    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
}

// Singleton instance
const antiBotSystem = new AntiBotSystem();

module.exports = {
    AntiBotSystem,
    antiBotSystem
};