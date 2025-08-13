/**
 * Advanced LinkedIn Banner Extractor
 * PRIMARY: Network interception to capture real banner URLs from API calls
 * FALLBACK: Traditional DOM scraping and direct API calls
 * Handles dynamic patterns, rate limiting, and anti-bot detection
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { getConfig, validateConfig } = require('./banner-extraction-config');
const { AdaptiveConfigManager } = require('./adaptive-config-manager');

class LinkedInBannerExtractor {
    constructor(linkedinAntiBot) {
        // Validate configuration on initialization
        if (!validateConfig()) {
            throw new Error('Invalid banner extraction configuration');
        }
        
        this.antiBot = linkedinAntiBot;
        this.interceptedRequests = [];
        this.bannerUrls = new Set();
        this.apiResponses = [];
        this.discoveredPatterns = new Set(); // Dynamic pattern discovery
        this.sessionHealth = { isValid: true, lastCheck: Date.now() };
        this.rateLimiter = { lastRequest: 0, requestCount: 0, windowStart: Date.now() };
        
        // Initialize adaptive configuration manager
        this.adaptiveConfig = new AdaptiveConfigManager();
        this.configInitialized = false;
        
        // Load initial static configuration as fallback
        this.config = {
            network: getConfig('networkPatterns'),
            api: getConfig('apiEndpoints'),
            dom: getConfig('domSelectors'),
            validation: getConfig('validation'),
            timing: getConfig('timing'),
            session: getConfig('sessionHealth'),
            popups: getConfig('popupHandling'),
            logging: getConfig('logging')
        };
        
        console.log('✅ [Banner Extractor] Initialized with adaptive configuration system');
        console.log(`📊 [Banner Extractor] Logging level: ${this.config.logging.enableDetailedLogging ? 'Detailed' : 'Production'}`);
    }

    /**
     * Initialize adaptive configuration system
     */
    async initializeAdaptiveConfig() {
        if (this.configInitialized) return;
        
        try {
            await this.adaptiveConfig.initialize();
            
            // Load adaptive configurations
            this.config.network = await this.adaptiveConfig.getAdaptiveConfig('networkPatterns');
            this.config.api = await this.adaptiveConfig.getAdaptiveConfig('apiEndpoints');
            this.config.validation = await this.adaptiveConfig.getAdaptiveConfig('validation');
            
            this.configInitialized = true;
            console.log('🧠 [Banner Extractor] Adaptive configuration loaded successfully');
            
        } catch (error) {
            console.warn('⚠️ [Banner Extractor] Adaptive config failed, using static fallback:', error.message);
            // Keep using static configuration
        }
    }

    /**
     * Learn from extraction attempt and update patterns
     */
    async learnFromAttempt(url, method, success, responseData = null, extractionMethod = null) {
        if (!this.configInitialized) return;
        
        try {
            await this.adaptiveConfig.learnFromExtraction(url, method, success, responseData, extractionMethod);
        } catch (error) {
            console.warn('⚠️ [Banner Extractor] Failed to learn from attempt:', error.message);
        }
    }

    /**
     * Enable or disable verbose logging (useful for debugging)
     */
    setVerboseLogging(enabled) {
        this.config.logging.enableDetailedLogging = enabled;
        this.config.logging.logNetworkRequests = enabled;
        this.config.logging.logExclusions = enabled;
        console.log(`🔧 [Banner Extractor] Verbose logging ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Setup network request interception to capture API calls
     */
    async setupNetworkInterception(page) {
        console.log('🕸️ [Banner Extractor] Setting up network interception...');
        
        // Enable request interception
        await page.setRequestInterception(true);
        
        // Track all network requests
        page.on('request', (request) => {
            const url = request.url();
            const resourceType = request.resourceType();
            
            // Log LinkedIn API calls that might contain banner data
            if (this.isLinkedInApiCall(url)) {
                if (this.config.logging.enableDetailedLogging) {
                    console.log(`📡 [API Call] ${request.method()} ${url}`);
                }
                this.interceptedRequests.push({
                    url,
                    method: request.method(),
                    headers: request.headers(),
                    resourceType,
                    timestamp: Date.now()
                });
            }
            
            // Also track image requests from LinkedIn CDN (but only valid banners)
            if (resourceType === 'image' && this.isValidBannerUrl(url)) {
                // isValidBannerUrl now handles its own logging for valid banners
                this.bannerUrls.add(url);
            }
            
            // Continue the request
            request.continue();
        });

        // Capture responses that might contain banner data
        page.on('response', async (response) => {
            const url = response.url();
            const status = response.status();
            
            // Handle LinkedIn API calls
            if (this.isLinkedInApiCall(url) && status === 200) {
                try {
                    const contentType = response.headers()['content-type'] || '';
                    
                    // Handle JSON responses (most LinkedIn API calls)
                    if (contentType.includes('application/json')) {
                        const data = await response.json();
                        this.apiResponses.push({
                            url,
                            data,
                            contentType,
                            timestamp: Date.now()
                        });
                        
                        if (this.config.logging.enableDetailedLogging) {
                            console.log(`📥 [JSON Response] ${url} - ${JSON.stringify(data).length} chars`);
                        }
                        
                        // Extract banner URLs from JSON response
                        this.extractBannerUrlsFromJson(data, url);
                    }
                    
                    // Handle text/HTML responses
                    else if (contentType.includes('text/html') || contentType.includes('text/plain')) {
                        const text = await response.text();
                        this.extractBannerUrlsFromText(text, url);
                    }
                    
                } catch (error) {
                    console.warn(`⚠️ [Banner Extractor] Failed to parse response from ${url}:`, error.message);
                }
            }
            
            // Also handle direct image responses
            if (status === 200 && response.headers()['content-type']?.startsWith('image/')) {
                if (this.isValidBannerUrl(url)) {
                    // isValidBannerUrl now handles its own logging for valid banners
                    this.bannerUrls.add(url);
                }
            }
        });
    }

    /**
     * Check if URL is a LinkedIn API call that might contain banner data
     * Uses both static patterns and dynamic pattern discovery
     */
    isLinkedInApiCall(url) {
        // Static patterns from configuration
        const staticPatterns = this.config.network.staticApiPatterns;
        const contentPatterns = this.config.network.contentPatterns;
        
        // Check static patterns
        const matchesStatic = staticPatterns.some(pattern => url.includes(pattern)) ||
               (url.includes('linkedin.com') && contentPatterns.some(pattern => url.includes(pattern)));
        
        // Check dynamically discovered patterns
        const matchesDynamic = Array.from(this.discoveredPatterns).some(pattern => url.includes(pattern));
        
        // Learn new patterns from LinkedIn API calls
        if (matchesStatic && !matchesDynamic) {
            this.learnApiPattern(url);
        }
        
        return matchesStatic || matchesDynamic;
    }

    /**
     * Learn new API patterns from successful LinkedIn API calls
     */
    learnApiPattern(url) {
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
            
            // Extract potential patterns
            for (let i = 0; i < pathSegments.length - 1; i++) {
                const pattern = '/' + pathSegments.slice(i, i + 2).join('/') + '/';
                if (pattern.length > 5 && !this.discoveredPatterns.has(pattern)) {
                    this.discoveredPatterns.add(pattern);
                    console.log(`🔍 [Pattern Discovery] New API pattern learned: ${pattern}`);
                }
            }
        } catch (error) {
            // Ignore URL parsing errors
        }
    }

    /**
     * Extract banner URLs from JSON API responses
     */
    extractBannerUrlsFromJson(data, sourceUrl) {
        try {
            // Convert to string for easier searching
            const jsonString = JSON.stringify(data);
            
            // Use banner patterns from configuration
            const bannerPatterns = this.config.network.bannerJsonPatterns;
            
            bannerPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(jsonString)) !== null) {
                    const url = match[1] || match[0];
                    if (this.isValidBannerUrl(url)) {
                        // isValidBannerUrl now handles its own logging for valid banners
                        this.bannerUrls.add(url);
                    }
                }
            });
            
            // Deep search in nested objects
            this.deepSearchForBanners(data);
            
        } catch (error) {
            console.warn(`⚠️ [Banner Extractor] Error extracting from JSON:`, error.message);
        }
    }

    /**
     * Deep search for banner URLs in nested JSON objects
     */
    deepSearchForBanners(obj, path = '') {
        if (!obj || typeof obj !== 'object') return;
        
        for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            
            // Check if key suggests banner/cover image
            if (this.isBannerRelatedKey(key) && typeof value === 'string' && this.isValidBannerUrl(value)) {
                // isValidBannerUrl now handles its own logging for valid banners
                this.bannerUrls.add(value);
            }
            
            // Recursively search nested objects and arrays
            if (typeof value === 'object') {
                this.deepSearchForBanners(value, currentPath);
            }
        }
    }

    /**
     * Check if a key name suggests it contains banner/cover image data
     */
    isBannerRelatedKey(key) {
        const bannerKeys = this.config.network.bannerKeys;
        
        return bannerKeys.some(bannerKey => 
            key.toLowerCase().includes(bannerKey.toLowerCase())
        );
    }

    /**
     * Extract banner URLs from text/HTML responses
     */
    extractBannerUrlsFromText(text, sourceUrl) {
        try {
            // Look for LinkedIn CDN URLs in the text
            const urlPatterns = [
                /https:\/\/media\.licdn\.com\/dms\/image\/[^\s"'<>]+/g,
                /https:\/\/static\.licdn\.com\/[^\s"'<>]+/g,
                /https:\/\/dms\.licdn\.com\/[^\s"'<>]+/g
            ];
            
            urlPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(text)) !== null) {
                    const url = match[0];
                    if (this.isValidBannerUrl(url)) {
                        // isValidBannerUrl now handles its own logging for valid banners
                        this.bannerUrls.add(url);
                    }
                }
            });
            
        } catch (error) {
            console.warn(`⚠️ [Banner Extractor] Error extracting from text:`, error.message);
        }
    }

    /**
     * Validate if URL is likely a real banner image (not a dummy or logo)
     */
    isValidBannerUrl(url) {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) {
            return false;
        }
        
        // Fix malformed URLs (common issue with double slashes)
        url = url.replace(/([^:]\/)\/+/g, '$1');
        
        // Check for LinkedIn CDN domains from config
        const validDomains = this.config.validation.validDomains;
        const hasValidDomain = validDomains.some(domain => url.includes(domain));
        if (!hasValidDomain) return false;
        
        // **EXCLUDE LOGOS** - We want banners, not company logos
        const logoPatterns = [
            'company-logo',
            'profile-photo',
            'profile-picture',
            'avatar',
            'logo_',
            '/logo/',
            'headshot',
            'profile_',
            'user-photo'
        ];
        
        const isLogo = logoPatterns.some(pattern => url.toLowerCase().includes(pattern));
        if (isLogo) {
            // Only log logos if detailed logging is enabled
            if (this.config.logging.enableDetailedLogging) {
                console.log(`🚫 [Logo Excluded] ${url.substring(0, 80)}...`);
            }
            return false;
        }
        
        // Check for banner-related path patterns from config
        const bannerPatterns = this.config.validation.bannerPatterns;
        const hasBannerPattern = bannerPatterns.some(pattern => 
            url.toLowerCase().includes(pattern)
        );
        
        // Check image dimensions (banners are typically wide)
        const dimensionPatterns = this.config.validation.dimensionPatterns;
        const hasBannerDimensions = dimensionPatterns.some(pattern => 
            pattern.test(url)
        );
        
        // **BANNER-SPECIFIC PATTERNS** - Look for cover/banner indicators
        const bannerIndicators = [
            'cover',
            'banner',
            'background',
            'hero',
            'company-background',
            'organization-background',
            'profile-background'
        ];
        
        const hasBannerIndicator = bannerIndicators.some(indicator => 
            url.toLowerCase().includes(indicator)
        );
        
        // Exclude obvious dummy/placeholder patterns from config
        const dummyPatterns = this.config.validation.dummyPatterns;
        const isDummy = dummyPatterns.some(pattern => 
            url.toLowerCase().includes(pattern)
        );
        
        // **STRICTER VALIDATION** - Must have banner indicators or dimensions
        const isValid = !isDummy && (hasBannerPattern || hasBannerDimensions || hasBannerIndicator);
        
        // Log only valid banners to reduce noise
        if (isValid && this.config.logging.logNetworkRequests) {
            console.log(`🎯 [Valid Banner] ${url.substring(0, 100)}...`);
        }
        
        return isValid;
    }

    /**
     * Advanced banner extraction using prioritized strategies with adaptive learning
     * PRIMARY: Network interception (most reliable for real images)
     * FALLBACK: Traditional methods if network interception fails
     */
    async extractBannerWithAdvancedMethods(page, companyUrl) {
        console.log('🚀 [Banner Extractor] Starting prioritized banner extraction with adaptive learning...');
        
        // Initialize adaptive configuration if not already done
        await this.initializeAdaptiveConfig();
        
        // Check session health before starting
        await this.checkSessionHealth(page);
        
        const extractionStartTime = Date.now();
        let successfulMethod = null;
        let finalResult = null;
        
        try {
            // PRIMARY STRATEGY: Network interception (highest priority)
            console.log('🎯 [PRIMARY] Network interception strategy...');
            await this.waitForApiCalls(page, 12000); // Extended wait for better coverage
            await this.triggerAdditionalApiCalls(page);
            
            let primaryResult = this.selectBestBannerUrl();
            if (primaryResult) {
                console.log('✅ [PRIMARY SUCCESS] Network interception found banner:', primaryResult);
                successfulMethod = 'Network Interception';
                finalResult = primaryResult;
                
                // Learn from successful network interception
                for (const request of this.interceptedRequests) {
                    await this.learnFromAttempt(request.url, request.method, true, null, 'network_interception');
                }
                
                return primaryResult;
            }
            
            console.log('⚠️ [PRIMARY FAILED] Network interception found no banners, trying fallbacks...');
            
            // Learn from failed network attempts
            for (const request of this.interceptedRequests) {
                await this.learnFromAttempt(request.url, request.method, false, null, 'network_interception');
            }
            
            // FALLBACK STRATEGY 1: Direct API calls with dynamic delays
            console.log('🔄 [FALLBACK 1] Direct API calls...');
            const apiCallsSuccess = await this.makeDirectApiCallsWithRateLimit(companyUrl);
            
            let fallback1Result = this.selectBestBannerUrl();
            if (fallback1Result) {
                console.log('✅ [FALLBACK 1 SUCCESS] Direct API calls found banner:', fallback1Result);
                successfulMethod = 'Direct API Calls';
                finalResult = fallback1Result;
                return fallback1Result;
            }
            
            // FALLBACK STRATEGY 2: Enhanced DOM analysis
            console.log('🔄 [FALLBACK 2] Enhanced DOM analysis...');
            await this.analyzePageSourceEnhanced(page);
            
            let fallback2Result = this.selectBestBannerUrl();
            if (fallback2Result) {
                console.log('✅ [FALLBACK 2 SUCCESS] DOM analysis found banner:', fallback2Result);
                successfulMethod = 'Enhanced DOM Analysis';
                finalResult = fallback2Result;
                return fallback2Result;
            }
            
            // FALLBACK STRATEGY 3: Traditional DOM scraping
            console.log('🔄 [FALLBACK 3] Traditional DOM scraping...');
            const traditionalResult = await this.traditionalDomScraping(page);
            if (traditionalResult) {
                console.log('✅ [FALLBACK 3 SUCCESS] Traditional scraping found banner:', traditionalResult);
                this.bannerUrls.add(traditionalResult);
                successfulMethod = 'Traditional DOM Scraping';
                finalResult = traditionalResult;
                return traditionalResult;
            }
            
            console.log('❌ [ALL STRATEGIES FAILED] No banner found with any method');
            return null;
            
        } finally {
            // Learn from the overall extraction attempt
            const extractionTime = Date.now() - extractionStartTime;
            const success = finalResult !== null;
            
            await this.learnFromAttempt(companyUrl, 'GET', success, null, successfulMethod);
            
            // Log extraction metrics
            console.log(`📊 [Extraction Metrics] Method: ${successfulMethod || 'None'}, Time: ${extractionTime}ms, Success: ${success}`);
        }
    }

    /**
     * Wait for API calls to complete and capture responses
     */
    async waitForApiCalls(page, timeout = 12000) {
        console.log('⏳ [Banner Extractor] Waiting for API calls...');
        
        const startTime = Date.now();
        let lastApiCallTime = startTime;
        let initialRequestCount = this.interceptedRequests.length;
        
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const now = Date.now();
                
                // Update last API call time if we received new calls
                if (this.interceptedRequests.length > initialRequestCount) {
                    const latestRequest = this.interceptedRequests[this.interceptedRequests.length - 1];
                    if (latestRequest.timestamp > lastApiCallTime) {
                        lastApiCallTime = latestRequest.timestamp;
                    }
                }
                
                // Log progress every 2 seconds
                if ((now - startTime) % 2000 < 500) {
                    const newRequests = this.interceptedRequests.length - initialRequestCount;
                    const newResponses = this.apiResponses.length;
                    console.log(`📊 [API Monitor] ${Math.round((now - startTime)/1000)}s: ${newRequests} requests, ${newResponses} responses, ${this.bannerUrls.size} banners`);
                }
                
                // Stop waiting if timeout reached or no recent API calls for 4 seconds
                if (now - startTime > timeout || (this.interceptedRequests.length > initialRequestCount && now - lastApiCallTime > 4000)) {
                    clearInterval(checkInterval);
                    const totalRequests = this.interceptedRequests.length - initialRequestCount;
                    console.log(`✅ [Banner Extractor] API call monitoring complete. Captured ${totalRequests} new requests, ${this.apiResponses.length} responses, found ${this.bannerUrls.size} banner URLs.`);
                    resolve();
                }
            }, 500);
        });
    }

    /**
     * Trigger additional API calls by interacting with the page
     */
    async triggerAdditionalApiCalls(page) {
        console.log('🎯 [Banner Extractor] Triggering additional API calls...');
        
        try {
            // Scroll to trigger lazy loading
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight / 2);
            });
            await page.waitForTimeout(2000);
            
            // Try clicking on About tab if it exists
            const aboutTab = await page.$('a[href*="about"], button[data-test-id*="about"]');
            if (aboutTab) {
                await aboutTab.click();
                await page.waitForTimeout(3000);
            }
            
            // Try hovering over profile elements to trigger additional loads
            const profileElements = await page.$$('.org-top-card-primary-content, .top-card-layout');
            for (const element of profileElements.slice(0, 2)) {
                await element.hover();
                await page.waitForTimeout(1000);
            }
            
        } catch (error) {
            console.warn('⚠️ [Banner Extractor] Error triggering API calls:', error.message);
        }
    }

    /**
     * Check session health and validity
     */
    async checkSessionHealth(page) {
        try {
            const now = Date.now();
            
            // Check session every 5 minutes
            if (now - this.sessionHealth.lastCheck < 5 * 60 * 1000 && this.sessionHealth.isValid) {
                return this.sessionHealth.isValid;
            }
            
            console.log('🔍 [Session Health] Checking session validity...');
            
            // Check if we can access LinkedIn content
            const isLoggedIn = await page.evaluate(() => {
                // Look for indicators that we're logged in or have access
                const indicators = [
                    '.global-nav', // Navigation bar
                    '.top-card-layout', // Company page layout
                    '.org-top-card-summary-info-list', // Company info
                    'main[role="main"]' // Main content area
                ];
                
                return indicators.some(selector => document.querySelector(selector));
            });
            
            // Check for login/access denied indicators
            const isBlocked = await page.evaluate(() => {
                const blockIndicators = [
                    'Join LinkedIn',
                    'Sign in to LinkedIn',
                    'Access denied',
                    'Rate limit exceeded',
                    'Temporarily blocked'
                ];
                
                const pageText = document.body.textContent || '';
                return blockIndicators.some(indicator => pageText.includes(indicator));
            });
            
            this.sessionHealth.isValid = isLoggedIn && !isBlocked;
            this.sessionHealth.lastCheck = now;
            
            if (!this.sessionHealth.isValid) {
                console.warn('⚠️ [Session Health] Session appears invalid or blocked');
            } else {
                console.log('✅ [Session Health] Session is healthy');
            }
            
            return this.sessionHealth.isValid;
            
        } catch (error) {
            console.warn('⚠️ [Session Health] Error checking session:', error.message);
            this.sessionHealth.isValid = false;
            return false;
        }
    }

    /**
     * Make direct API calls with intelligent rate limiting and adaptive learning
     */
    async makeDirectApiCallsWithRateLimit(companyUrl) {
        console.log('🔗 [Banner Extractor] Making rate-limited direct API calls...');
        
        let successfulCalls = 0;
        let totalCalls = 0;
        
        try {
            // Extract company identifier from URL
            const companyMatch = companyUrl.match(/\/company\/([^\/\?]+)/);
            if (!companyMatch) return false;
            
            const companyId = companyMatch[1];
            
            // Get adaptive API endpoints configuration
            const apiConfig = this.configInitialized ? 
                await this.adaptiveConfig.getAdaptiveConfig('apiEndpoints') : 
                this.config.api;
            
            // Use adaptive templates if available, otherwise fall back to static
            const templates = apiConfig.templates || [
                `https://www.linkedin.com/voyager/api/organization/companies?q=universalName&universalName=${companyId}`,
                `https://www.linkedin.com/voyager/api/organization/company/${companyId}`,
                `https://www.linkedin.com/deco-api/identity/dash/companyProfile?q=universalName&universalName=${companyId}`,
                `https://www.linkedin.com/li/api/v1/organization/${companyId}`
            ];
            
            // Add priority templates if available
            const priorityTemplates = apiConfig.priorityTemplates || [];
            const allTemplates = [...priorityTemplates, ...templates];
            
            // Replace {companyId} placeholder
            const allEndpoints = allTemplates.map(template => 
                template.replace('{companyId}', companyId)
            );
            
            // Add endpoints based on discovered patterns
            const dynamicEndpoints = Array.from(this.discoveredPatterns).map(pattern => 
                `https://www.linkedin.com${pattern}${companyId}`
            ).filter(url => {
                try {
                    new URL(url);
                    return true;
                } catch {
                    return false;
                }
            });
            
            const finalEndpoints = [...allEndpoints, ...dynamicEndpoints];
            console.log(`🎯 [API Calls] Trying ${finalEndpoints.length} endpoints (${allEndpoints.length} adaptive + ${dynamicEndpoints.length} dynamic)`);
            
            for (let i = 0; i < finalEndpoints.length; i++) {
                const endpoint = finalEndpoints[i];
                totalCalls++;
                
                try {
                    // Apply rate limiting
                    await this.applyRateLimit();
                    
                    const headers = this.antiBot ? 
                        this.antiBot.getLinkedInImageHeaders(endpoint, companyUrl) : 
                        this.getDefaultHeaders(companyUrl);
                    
                    if (this.config.logging.enableDetailedLogging) {
                        console.log(`📡 [API Call ${i+1}/${finalEndpoints.length}] ${endpoint}`);
                    }
                    
                    const response = await axios.get(endpoint, {
                        headers,
                        timeout: 15000,
                        validateStatus: (status) => status < 500 // Accept redirects, reject server errors
                    });
                    
                    const success = response.status === 200 && response.data;
                    
                    if (success) {
                        console.log(`✅ [API Success] Status ${response.status}, Data size: ${JSON.stringify(response.data).length} chars`);
                        this.extractBannerUrlsFromJson(response.data, endpoint);
                        successfulCalls++;
                        
                        // Learn from successful API call
                        await this.learnFromAttempt(endpoint, 'GET', true, response.data, 'direct_api_call');
                        
                    } else if (response.status === 401 || response.status === 403) {
                        console.warn(`🚫 [API Auth Failed] ${endpoint}: Status ${response.status} - Session may be invalid`);
                        this.sessionHealth.isValid = false;
                        
                        // Learn from auth failure
                        await this.learnFromAttempt(endpoint, 'GET', false, null, 'direct_api_call');
                        
                    } else {
                        console.warn(`⚠️ [API Failed] ${endpoint}: Status ${response.status}`);
                        
                        // Learn from failure
                        await this.learnFromAttempt(endpoint, 'GET', false, null, 'direct_api_call');
                    }
                    
                } catch (error) {
                    const errorContext = {
                        endpoint,
                        status: error.response?.status,
                        statusText: error.response?.statusText,
                        message: error.message
                    };
                    
                    if (this.config.logging.enableDetailedLogging) {
                        console.warn(`❌ [API Error] ${endpoint}:`, errorContext);
                    }
                    
                    // Learn from error
                    await this.learnFromAttempt(endpoint, 'GET', false, null, 'direct_api_call');
                    
                    // Handle specific error types
                    if (error.response?.status === 429) {
                        console.warn('🚫 [Rate Limited] Increasing delays...');
                        await this.handleRateLimit();
                    }
                }
            }
            
            const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) : 0;
            console.log(`📊 [API Calls Summary] ${successfulCalls}/${totalCalls} successful (${(successRate * 100).toFixed(1)}%)`);
            
            return successfulCalls > 0;
            
        } catch (error) {
            console.error('❌ [Banner Extractor] Critical error in direct API calls:', {
                message: error.message,
                stack: error.stack?.split('\n').slice(0, 3).join('\n')
            });
            return false;
        }
    }

    /**
     * Apply intelligent rate limiting with dynamic delays
     */
    async applyRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.rateLimiter.lastRequest;
        
        // Reset window if it's been more than 1 minute
        if (now - this.rateLimiter.windowStart > 60000) {
            this.rateLimiter.requestCount = 0;
            this.rateLimiter.windowStart = now;
        }
        
        // Calculate dynamic delay based on request frequency
        let delay = 1000; // Base delay of 1 second
        
        if (this.rateLimiter.requestCount > 10) {
            delay = 3000 + Math.random() * 2000; // 3-5 seconds for high frequency
        } else if (this.rateLimiter.requestCount > 5) {
            delay = 2000 + Math.random() * 1000; // 2-3 seconds for medium frequency
        } else {
            delay = 1000 + Math.random() * 1000; // 1-2 seconds for low frequency
        }
        
        // Ensure minimum delay between requests
        if (timeSinceLastRequest < delay) {
            const waitTime = delay - timeSinceLastRequest;
            console.log(`⏳ [Rate Limit] Waiting ${Math.round(waitTime)}ms (request #${this.rateLimiter.requestCount + 1})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.rateLimiter.lastRequest = Date.now();
        this.rateLimiter.requestCount++;
    }

    /**
     * Handle rate limiting by increasing delays
     */
    async handleRateLimit() {
        const backoffDelay = 5000 + Math.random() * 5000; // 5-10 seconds
        console.log(`⏳ [Rate Limit Backoff] Waiting ${Math.round(backoffDelay)}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        
        // Reset rate limiter
        this.rateLimiter.requestCount = 0;
        this.rateLimiter.windowStart = Date.now();
    }

    /**
     * Get default headers when antiBot is not available
     */
    getDefaultHeaders(refererUrl) {
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/vnd.linkedin.normalized+json+2.1',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': refererUrl || 'https://www.linkedin.com/',
            'Origin': 'https://www.linkedin.com',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin'
        };
    }

    /**
     * Enhanced page source analysis with deeper inspection
     */
    async analyzePageSourceEnhanced(page) {
        console.log('🔍 [Banner Extractor] Enhanced page source analysis...');
        
        try {
            const pageContent = await page.content();
            const $ = cheerio.load(pageContent);
            
            // 1. JSON-LD scripts analysis
            $('script[type="application/ld+json"]').each((i, el) => {
                try {
                    const jsonData = JSON.parse($(el).html());
                    this.extractBannerUrlsFromJson(jsonData, 'enhanced-jsonld');
                } catch (error) {
                    // Ignore parsing errors
                }
            });
            
            // 2. Embedded JavaScript data with enhanced patterns
            $('script').each((i, el) => {
                const scriptContent = $(el).html();
                if (scriptContent) {
                    // Look for various data patterns
                    const dataPatterns = [
                        'backgroundImage',
                        'coverPhoto',
                        'bannerImage',
                        'heroImage',
                        'companyBackground',
                        'organizationBackground',
                        'media.licdn.com',
                        'dms/image'
                    ];
                    
                    if (dataPatterns.some(pattern => scriptContent.includes(pattern))) {
                        this.extractBannerUrlsFromText(scriptContent, 'enhanced-script');
                    }
                }
            });
            
            // 3. CSS analysis for background images
            $('style').each((i, el) => {
                const cssContent = $(el).html();
                if (cssContent && cssContent.includes('background-image')) {
                    this.extractBannerUrlsFromText(cssContent, 'enhanced-css');
                }
            });
            
            // 4. Meta tags analysis
            $('meta').each((i, el) => {
                const content = $(el).attr('content');
                const property = $(el).attr('property');
                const name = $(el).attr('name');
                
                if (content && (
                    (property && (property.includes('image') || property.includes('banner'))) ||
                    (name && (name.includes('image') || name.includes('banner')))
                )) {
                    if (this.isValidBannerUrl(content)) {
                        console.log(`🎯 [Banner Found] From meta tag: ${content}`);
                        this.bannerUrls.add(content);
                    }
                }
            });
            
            // 5. Data attributes analysis
            $('[data-background-image], [data-banner-url], [data-cover-photo]').each((i, el) => {
                const bgImage = $(el).attr('data-background-image');
                const bannerUrl = $(el).attr('data-banner-url');
                const coverPhoto = $(el).attr('data-cover-photo');
                
                [bgImage, bannerUrl, coverPhoto].forEach(url => {
                    if (url && this.isValidBannerUrl(url)) {
                        console.log(`🎯 [Banner Found] From data attribute: ${url}`);
                        this.bannerUrls.add(url);
                    }
                });
            });
            
        } catch (error) {
            console.error('❌ [Banner Extractor] Error in enhanced page source analysis:', {
                message: error.message,
                stack: error.stack?.split('\n').slice(0, 3).join('\n')
            });
        }
    }

    /**
     * Traditional DOM scraping as final fallback
     */
    async traditionalDomScraping(page) {
        console.log('🔍 [Banner Extractor] Traditional DOM scraping...');
        
        try {
            return await page.evaluate(() => {
                const selectors = [
                    // Priority 1: Company-specific banner containers
                    { selector: 'div.org-top-card-primary-content__hero-image', type: 'bg', priority: 10 },
                    { selector: 'div.org-top-card-module__hero', type: 'bg', priority: 9 },
                    { selector: 'div.profile-background-image__image', type: 'bg', priority: 8 },
                    { selector: 'section[class*="artdeco-card"] div[class*="ivm-image-view-model__background-img"]', type: 'bg', priority: 7 },
                    
                    // Priority 2: Direct image elements
                    { selector: 'img.org-top-card-primary-content__cover', type: 'src', priority: 9 },
                    { selector: 'img[data-test-id*="cover-photo"]', type: 'src', priority: 8 },
                    { selector: 'img[data-test-id*="banner-img"]', type: 'src', priority: 8 },
                    { selector: 'img[src*="media.licdn.com/dms/image/"][src*="company-background"]', type: 'src', priority: 10 },
                    
                    // Priority 3: Generic banner patterns
                    { selector: 'div[class*="cover-img"]', type: 'bg', priority: 6 },
                    { selector: 'div[class*="profile-cover-image"]', type: 'bg', priority: 6 },
                    { selector: 'div[class*="banner-image"]', type: 'bg', priority: 6 },
                    { selector: 'img[alt*="Cover photo"i]', type: 'src', priority: 5 },
                    { selector: 'img[alt*="Banner"i]', type: 'src', priority: 5 },
                    
                    // Priority 4: Container-based searches
                    { selector: 'div.cover-photo img', type: 'src', priority: 4 },
                    { selector: 'div.banner img', type: 'src', priority: 4 },
                    { selector: 'figure[class*="banner"] img', type: 'src', priority: 4 },
                    { selector: 'figure[class*="cover"] img', type: 'src', priority: 4 }
                ];

                const foundUrls = [];

                for (const s of selectors) {
                    const elements = document.querySelectorAll(s.selector);
                    
                    for (const element of elements) {
                        if (!element.offsetParent) continue; // Skip hidden elements
                        
                        let imageUrl = null;
                        
                        if (s.type === 'bg') {
                            const style = window.getComputedStyle(element);
                            const backgroundImage = style.backgroundImage;
                            if (backgroundImage && backgroundImage !== 'none') {
                                imageUrl = backgroundImage.match(/url\(['"]?(.*?)['"]?\)/)?.[1];
                            }
                        } else if (s.type === 'src') {
                            imageUrl = element.src || element.getAttribute('src');
                        }

                        if (imageUrl && imageUrl.startsWith('http')) {
                            // Basic validation
                            const isLinkedInCDN = imageUrl.includes('media.licdn.com') || 
                                                 imageUrl.includes('static.licdn.com') || 
                                                 imageUrl.includes('dms.licdn.com');
                            
                            if (isLinkedInCDN) {
                                foundUrls.push({
                                    url: imageUrl,
                                    priority: s.priority,
                                    selector: s.selector,
                                    type: s.type
                                });
                            }
                        }
                    }
                }

                // Sort by priority and return the best URL
                if (foundUrls.length > 0) {
                    foundUrls.sort((a, b) => b.priority - a.priority);
                    const bestUrl = foundUrls[0];
                    console.log(`✅ [Traditional DOM] Found banner with selector "${bestUrl.selector}": ${bestUrl.url}`);
                    return bestUrl.url;
                }

                console.log('❌ [Traditional DOM] No banner URLs found');
                return null;
            });
            
        } catch (error) {
            console.error('❌ [Banner Extractor] Error in traditional DOM scraping:', {
                message: error.message,
                stack: error.stack?.split('\n').slice(0, 3).join('\n')
            });
            return null;
        }
    }

    /**
     * Select the best banner URL from all found URLs
     */
    selectBestBannerUrl() {
        if (this.bannerUrls.size === 0) {
            console.log('❌ [Banner Extractor] No banner URLs found');
            return null;
        }
        
        const urls = Array.from(this.bannerUrls);
        console.log(`🎯 [Banner Extractor] Found ${urls.length} potential banner URLs`);
        
        // Score URLs based on quality indicators
        const scoredUrls = urls.map(url => ({
            url,
            score: this.scoreBannerUrl(url)
        }));
        
        // Sort by score (highest first)
        scoredUrls.sort((a, b) => b.score - a.score);
        
        const bestUrl = scoredUrls[0]?.url;
        console.log(`✅ [Banner Extractor] Selected best banner URL: ${bestUrl}`);
        
        return bestUrl;
    }

    /**
     * Score a banner URL based on quality indicators
     */
    scoreBannerUrl(url) {
        let score = 0;
        
        // Higher score for company-background in path
        if (url.includes('company-background')) score += 50;
        if (url.includes('organization-background')) score += 45;
        if (url.includes('cover-photo')) score += 40;
        if (url.includes('banner')) score += 35;
        if (url.includes('hero')) score += 30;
        
        // Higher score for larger dimensions
        const dimensionMatch = url.match(/(\d{3,4})x(\d{2,3})/);
        if (dimensionMatch) {
            const width = parseInt(dimensionMatch[1]);
            const height = parseInt(dimensionMatch[2]);
            const aspectRatio = width / height;
            
            // Banner images typically have wide aspect ratios
            if (aspectRatio > 3) score += 30;
            else if (aspectRatio > 2) score += 20;
            else if (aspectRatio > 1.5) score += 10;
            
            // Prefer larger images
            if (width > 1000) score += 20;
            else if (width > 500) score += 10;
        }
        
        // Higher score for recent/high-quality image formats
        if (url.includes('webp')) score += 10;
        if (url.includes('jpg') || url.includes('jpeg')) score += 5;
        
        // Lower score for obvious placeholders
        if (url.includes('placeholder')) score -= 50;
        if (url.includes('default')) score -= 30;
        if (url.includes('blank')) score -= 40;
        
        return score;
    }

    /**
     * Get comprehensive extraction summary with performance metrics
     */
    getSummary() {
        return {
            // Network interception metrics
            interceptedRequests: this.interceptedRequests.length,
            apiResponses: this.apiResponses.length,
            
            // Pattern discovery metrics
            discoveredPatterns: Array.from(this.discoveredPatterns),
            discoveredPatternsCount: this.discoveredPatterns.size,
            
            // Banner extraction results
            bannerUrlsFound: this.bannerUrls.size,
            bannerUrls: Array.from(this.bannerUrls),
            
            // Session and rate limiting status
            sessionHealth: {
                isValid: this.sessionHealth.isValid,
                lastCheck: new Date(this.sessionHealth.lastCheck).toISOString()
            },
            rateLimiter: {
                requestCount: this.rateLimiter.requestCount,
                windowStart: new Date(this.rateLimiter.windowStart).toISOString(),
                timeSinceLastRequest: Date.now() - this.rateLimiter.lastRequest
            },
            
            // Performance indicators
            extractionTimestamp: new Date().toISOString(),
            totalApiCallsAttempted: this.rateLimiter.requestCount,
            networkInterceptionActive: this.interceptedRequests.length > 0
        };
    }

    /**
     * Log detailed error context for debugging
     */
    logErrorContext(operation, error, additionalContext = {}) {
        const errorContext = {
            operation,
            timestamp: new Date().toISOString(),
            error: {
                message: error.message,
                name: error.name,
                stack: error.stack?.split('\n').slice(0, 5).join('\n') // First 5 lines of stack
            },
            sessionHealth: this.sessionHealth,
            rateLimiter: {
                requestCount: this.rateLimiter.requestCount,
                timeSinceLastRequest: Date.now() - this.rateLimiter.lastRequest
            },
            extractionState: {
                interceptedRequests: this.interceptedRequests.length,
                apiResponses: this.apiResponses.length,
                bannerUrlsFound: this.bannerUrls.size,
                discoveredPatterns: this.discoveredPatterns.size
            },
            ...additionalContext
        };
        
        console.error(`❌ [Banner Extractor Error] ${operation}:`, errorContext);
        return errorContext;
    }

    /**
     * Reset extractor state for reuse
     */
    reset() {
        this.interceptedRequests = [];
        this.bannerUrls = new Set();
        this.apiResponses = [];
        // Keep discovered patterns and session health for reuse
        console.log('🔄 [Banner Extractor] State reset for new extraction');
    }

    /**
     * Helper function to select random choice from array
     */
    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
}

module.exports = { LinkedInBannerExtractor };