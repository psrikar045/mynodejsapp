/**
 * LinkedIn Production Configuration
 * Optimized settings for LinkedIn image scraping on Linux production servers
 */

const os = require('os');

class LinkedInProductionConfig {
    constructor() {
        this.isProduction = this.detectProductionEnvironment();
        this.config = this.generateConfig();
    }

    detectProductionEnvironment() {
        return (
            process.env.NODE_ENV === 'production' ||
            process.env.RENDER ||
            process.env.HEROKU ||
            process.env.VERCEL ||
            os.platform() === 'linux'
        );
    }

    generateConfig() {
        const baseConfig = {
            // Request timing configuration
            requestTiming: {
                minDelay: 800,
                maxDelay: 3500,
                burstProtection: true,
                adaptiveDelay: true
            },
            
            // Browser configuration
            browser: {
                headless: 'new',
                timeout: 45000,
                maxConcurrent: this.isProduction ? 2 : 3,
                memoryLimit: this.isProduction ? 512 : 1024
            },
            
            // Network configuration
            network: {
                timeout: 15000,
                retries: 3,
                retryDelay: 2000,
                userAgentRotation: 300000, // 5 minutes
                headerRotation: 180000     // 3 minutes
            },
            
            // LinkedIn-specific settings
            linkedin: {
                cdnDomains: [
                    'static.licdn.com',
                    'media.licdn.com',
                    'dms.licdn.com',
                    'cdn.lynda.com'
                ],
                fallbackStrategies: [
                    'alternative_urls',
                    'parameter_stripping',
                    'size_variants',
                    'format_negotiation'
                ],
                sessionPersistence: true,
                cookieRotation: 3600000 // 1 hour
            }
        };

        // Production-specific overrides
        if (this.isProduction) {
            return {
                ...baseConfig,
                browser: {
                    ...baseConfig.browser,
                    args: this.getProductionBrowserArgs(),
                    executablePath: this.getProductionChromePath()
                },
                network: {
                    ...baseConfig.network,
                    timeout: 20000, // Longer timeout for production
                    retries: 4      // More retries for production
                },
                requestTiming: {
                    ...baseConfig.requestTiming,
                    minDelay: 1200,  // Longer delays in production
                    maxDelay: 4500
                }
            };
        }

        // Development-specific overrides
        return {
            ...baseConfig,
            browser: {
                ...baseConfig.browser,
                args: this.getDevelopmentBrowserArgs()
            },
            requestTiming: {
                ...baseConfig.requestTiming,
                minDelay: 500,   // Shorter delays for development
                maxDelay: 2000
            }
        };
    }

    getProductionBrowserArgs() {
        return [
            // Essential security args for production
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            
            // Memory and performance optimization
            '--memory-pressure-off',
            '--max_old_space_size=512',
            '--single-process',
            '--no-zygote',
            
            // Anti-detection args
            '--disable-blink-features=AutomationControlled',
            '--exclude-switches=enable-automation',
            '--disable-extensions-http-throttling',
            '--disable-component-extensions-with-background-pages',
            
            // Network optimization
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            
            // Resource optimization
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI,BlinkGenPropertyTrees',
            
            // Stability improvements
            '--disable-breakpad',
            '--disable-component-update',
            '--disable-domain-reliability',
            '--disable-sync',
            '--metrics-recording-only',
            '--no-report-upload',
            '--safebrowsing-disable-auto-update',
            
            // Display settings
            '--hide-scrollbars',
            '--mute-audio',
            '--window-size=1366,768',
            
            // LinkedIn-specific optimizations
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-ipc-flooding-protection'
        ];
    }

    getDevelopmentBrowserArgs() {
        return [
            // Basic security args
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            
            // Anti-detection args
            '--disable-blink-features=AutomationControlled',
            '--exclude-switches=enable-automation',
            
            // Performance args
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-first-run',
            '--disable-extensions',
            '--disable-plugins',
            '--memory-pressure-off',
            '--max_old_space_size=1024',
            
            // Display settings
            '--window-size=1366,768'
        ];
    }

    getProductionChromePath() {
        // Common Chrome paths on Linux production servers
        const possiblePaths = [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/opt/google/chrome/chrome',
            '/snap/bin/chromium'
        ];

        const fs = require('fs');
        for (const path of possiblePaths) {
            try {
                if (fs.existsSync(path)) {
                    return path;
                }
            } catch (error) {
                continue;
            }
        }

        return null; // Let Puppeteer use its bundled Chromium
    }

    /**
     * Get environment-specific LinkedIn headers
     */
    getLinkedInHeaders(imageUrl) {
        const baseHeaders = {
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Referer': 'https://www.linkedin.com/',
            'Origin': 'https://www.linkedin.com'
        };

        // Add production-specific headers
        if (this.isProduction) {
            baseHeaders['X-Forwarded-For'] = this.generateRandomIP();
            baseHeaders['X-Real-IP'] = this.generateRandomIP();
            baseHeaders['CF-Connecting-IP'] = this.generateRandomIP();
        }

        return baseHeaders;
    }

    generateRandomIP() {
        // Generate a random IP address for header spoofing
        return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    }

    /**
     * Get adaptive delay based on request history
     */
    getAdaptiveDelay(requestHistory = []) {
        const { minDelay, maxDelay } = this.config.requestTiming;
        
        // Base delay
        let delay = Math.random() * (maxDelay - minDelay) + minDelay;
        
        // Increase delay if too many recent requests
        const recentRequests = requestHistory.filter(
            timestamp => Date.now() - timestamp < 60000 // Last minute
        ).length;
        
        if (recentRequests > 5) {
            delay *= 1.5; // Increase delay by 50%
        }
        
        if (recentRequests > 10) {
            delay *= 2; // Double delay if too many requests
        }
        
        return Math.floor(delay);
    }

    /**
     * Check if we should rotate user agent
     */
    shouldRotateUserAgent(lastRotation) {
        return Date.now() - lastRotation > this.config.network.userAgentRotation;
    }

    /**
     * Get configuration summary
     */
    getConfigSummary() {
        return {
            environment: this.isProduction ? 'Production' : 'Development',
            platform: os.platform(),
            browserArgs: this.config.browser.args?.length || 0,
            requestTiming: this.config.requestTiming,
            networkConfig: this.config.network,
            linkedinConfig: this.config.linkedin
        };
    }
}

module.exports = { LinkedInProductionConfig };