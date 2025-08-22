/**
 * LinkedIn Adaptive Scraper with Self-Maintained Bot Detection
 * Implements self-learning anti-bot strategies with proper wait times and retry logic
 * Focuses on perfect data scraping rather than performance
 */

const { LinkedInAdaptiveConfig } = require('./linkedin-adaptive-config');
const { LinkedInImageAntiBotSystem } = require('./linkedin-image-anti-bot');

class LinkedInAdaptiveScraper {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.adaptiveConfig = new LinkedInAdaptiveConfig();
        this.antiBot = new LinkedInImageAntiBotSystem();
        this.configInitialized = false;
        
        // Self-learning patterns
        this.successfulPatterns = new Map();
        this.failedPatterns = new Map();
        this.detectionTriggers = new Set();
        this.workingSelectors = new Map();
        
        // Timing and retry configuration - REDUCED for better performance
        this.timingConfig = {
            baseDelay: 1000,
            maxDelay: 8000,
            retryMultiplier: 1.3,
            humanVariation: 0.2,
            maxRetries: 2  // Reduced from 5 to 2 for faster execution
        };
        
        // Bot detection indicators
        this.botIndicators = [
            'join now', 'sign in', 'sign up', 'log in', 'login', 'register',
            'create account', 'get started', 'welcome to linkedin',
            'please sign in', 'authentication required'
        ];
        
        // Success metrics tracking
        this.metrics = {
            totalAttempts: 0,
            successfulExtractions: 0,
            botDetections: 0,
            adaptiveImprovements: 0,
            lastSuccessTime: null
        };
        
        console.log('🧠 [LinkedIn Adaptive] Initialized self-learning scraper system');
    }

    generateSessionId() {
        return `adaptive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Initialize adaptive configuration system
     */
    async initializeAdaptiveConfig() {
        if (this.configInitialized) return;
        
        try {
            await this.adaptiveConfig.initialize();
            
            // Load learned patterns
            this.successfulPatterns = await this.loadLearnedPatterns('successful');
            this.failedPatterns = await this.loadLearnedPatterns('failed');
            this.workingSelectors = await this.loadLearnedPatterns('selectors');
            
            this.configInitialized = true;
            console.log('🧠 [LinkedIn Adaptive] Configuration loaded successfully');
            
        } catch (error) {
            console.warn('⚠️ [LinkedIn Adaptive] Config initialization failed, using defaults:', error.message);
        }
    }

    /**
     * Load learned patterns from storage
     */
    async loadLearnedPatterns(type) {
        try {
            const patterns = await this.adaptiveConfig.getAdaptiveConfig(`learnedPatterns_${type}`);
            return new Map(patterns || []);
        } catch (error) {
            return new Map();
        }
    }

    /**
     * Save learned patterns to storage
     */
    async saveLearnedPatterns() {
        try {
            await this.adaptiveConfig.updateConfig('learnedPatterns_successful', Array.from(this.successfulPatterns.entries()));
            await this.adaptiveConfig.updateConfig('learnedPatterns_failed', Array.from(this.failedPatterns.entries()));
            await this.adaptiveConfig.updateConfig('learnedPatterns_selectors', Array.from(this.workingSelectors.entries()));
        } catch (error) {
            console.warn('⚠️ [LinkedIn Adaptive] Failed to save patterns:', error.message);
        }
    }

    /**
     * Implement adaptive human-like delays with learning
     */
    async implementAdaptiveDelay(context = 'default', previousSuccess = null) {
        let delay = this.timingConfig.baseDelay;
        
        // Get learned optimal delay for this context
        if (this.configInitialized) {
            const optimalDelay = this.adaptiveConfig.getOptimalDelay(context);
            delay = optimalDelay.average;
        }
        
        // Adjust based on recent success/failure
        if (previousSuccess === false) {
            delay *= this.timingConfig.retryMultiplier;
        } else if (previousSuccess === true) {
            delay = Math.max(delay * 0.8, this.timingConfig.baseDelay);
        }
        
        // Add human variation
        const variation = delay * this.timingConfig.humanVariation;
        const finalDelay = delay + (Math.random() * variation * 2 - variation);
        const clampedDelay = Math.min(Math.max(finalDelay, 1000), this.timingConfig.maxDelay);
        
        console.log(`⏳ [LinkedIn Adaptive] ${context} delay: ${Math.round(clampedDelay)}ms`);
        
        await new Promise(resolve => setTimeout(resolve, clampedDelay));
        
        // Learn from this delay
        if (this.configInitialized && previousSuccess !== null) {
            await this.adaptiveConfig.updateDelayPattern(context, clampedDelay, previousSuccess);
        }
        
        return clampedDelay;
    }

    /**
     * Learn optimal delay patterns
     */
    learnDelayPattern(contextKey, delay, success) {
        if (!this.successfulPatterns.has(contextKey)) {
            this.successfulPatterns.set(contextKey, {
                attempts: 0,
                successes: 0,
                totalDelay: 0,
                averageDelay: delay
            });
        }
        
        const pattern = this.successfulPatterns.get(contextKey);
        pattern.attempts++;
        pattern.totalDelay += delay;
        
        if (success) {
            pattern.successes++;
        }
        
        pattern.averageDelay = pattern.totalDelay / pattern.attempts;
        pattern.successRate = pattern.successes / pattern.attempts;
        
        this.successfulPatterns.set(contextKey, pattern);
    }

    /**
     * Detect bot detection with learning
     */
    async detectBotDetection(page) {
        try {
            const detectionResult = await page.evaluate((indicators) => {
                const pageTitle = document.title.toLowerCase();
                const h1Text = document.querySelector('h1')?.textContent?.toLowerCase() || '';
                const bodyText = document.body.textContent.toLowerCase();
                
                // Check for login/signup indicators
                const hasLoginIndicators = indicators.some(indicator => 
                    pageTitle.includes(indicator) || 
                    h1Text.includes(indicator) ||
                    bodyText.includes(indicator)
                );
                
                // Check for specific bot detection elements
                const botDetectionElements = [
                    'form[action*="login"]',
                    'input[type="password"]',
                    '.challenge-page',
                    '.security-challenge',
                    '[data-test-id*="challenge"]'
                ];
                
                const hasBotElements = botDetectionElements.some(selector => 
                    document.querySelector(selector)
                );
                
                // Check for company page indicators
                const companyIndicators = [
                    '.top-card-layout__entity-info',
                    '.org-top-card-summary-info-list',
                    '.org-page-navigation',
                    '[data-test-id="company-name"]'
                ];
                
                const hasCompanyElements = companyIndicators.some(selector => 
                    document.querySelector(selector)
                );
                
                return {
                    isDetected: hasLoginIndicators || hasBotElements,
                    hasCompanyElements,
                    pageTitle,
                    h1Text,
                    detectionTriggers: {
                        loginIndicators: hasLoginIndicators,
                        botElements: hasBotElements,
                        noCompanyElements: !hasCompanyElements
                    }
                };
            }, this.botIndicators);
            
            if (detectionResult.isDetected) {
                this.metrics.botDetections++;
                
                // Learn from detection triggers
                Object.keys(detectionResult.detectionTriggers).forEach(trigger => {
                    if (detectionResult.detectionTriggers[trigger]) {
                        this.detectionTriggers.add(trigger);
                    }
                });
                
                console.log('🚨 [LinkedIn Adaptive] Bot detection triggered:', detectionResult.detectionTriggers);
            }
            
            return detectionResult;
            
        } catch (error) {
            console.warn('⚠️ [LinkedIn Adaptive] Detection check failed:', error.message);
            return { isDetected: false, hasCompanyElements: false };
        }
    }

    /**
     * Adaptive retry strategy with learning
     */
    async adaptiveRetry(operation, context, maxRetries = null) {
        const retries = maxRetries || this.timingConfig.maxRetries;
        let lastError = null;
        let attempt = 0;
        
        while (attempt < retries) {
            attempt++;
            this.metrics.totalAttempts++;
            
            try {
                console.log(`🔄 [LinkedIn Adaptive] ${context} attempt ${attempt}/${retries}`);
                
                // Implement adaptive delay before attempt
                await this.implementAdaptiveDelay(`${context}_attempt_${attempt}`, attempt > 1 ? false : null);
                
                const result = await operation();
                
                if (result && result.success !== false) {
                    this.metrics.successfulExtractions++;
                    this.metrics.lastSuccessTime = Date.now();
                    
                    // Learn from successful attempt
                    await this.learnFromSuccess(context, attempt, result);
                    if (this.configInitialized) {
                        await this.adaptiveConfig.recordSuccess();
                    }
                    
                    console.log(`✅ [LinkedIn Adaptive] ${context} succeeded on attempt ${attempt}`);
                    return result;
                }
                
                lastError = new Error(`Operation returned unsuccessful result: ${JSON.stringify(result)}`);
                
            } catch (error) {
                lastError = error;
                console.warn(`⚠️ [LinkedIn Adaptive] ${context} attempt ${attempt} failed:`, error.message);
                
                // Learn from failure
                await this.learnFromFailure(context, attempt, error);
            }
            
            // Progressive delay increase for retries
            if (attempt < retries) {
                const retryDelay = this.timingConfig.baseDelay * Math.pow(this.timingConfig.retryMultiplier, attempt);
                await this.implementAdaptiveDelay(`${context}_retry_${attempt}`, false);
            }
        }
        
        console.error(`❌ [LinkedIn Adaptive] ${context} failed after ${retries} attempts`);
        
        // Record failure in config
        if (this.configInitialized) {
            await this.adaptiveConfig.recordFailure();
        }
        
        throw lastError || new Error(`${context} failed after ${retries} attempts`);
    }

    /**
     * Learn from successful operations
     */
    async learnFromSuccess(context, attempt, result) {
        const key = `success_${context}`;
        
        if (!this.successfulPatterns.has(key)) {
            this.successfulPatterns.set(key, {
                attempts: [],
                averageAttempt: 0,
                successRate: 0,
                lastSuccess: Date.now()
            });
        }
        
        const pattern = this.successfulPatterns.get(key);
        pattern.attempts.push(attempt);
        pattern.averageAttempt = pattern.attempts.reduce((a, b) => a + b, 0) / pattern.attempts.length;
        pattern.lastSuccess = Date.now();
        
        // Keep only recent attempts (last 100)
        if (pattern.attempts.length > 100) {
            pattern.attempts = pattern.attempts.slice(-100);
        }
        
        this.successfulPatterns.set(key, pattern);
        this.metrics.adaptiveImprovements++;
        
        // Save patterns periodically
        if (this.metrics.adaptiveImprovements % 10 === 0) {
            await this.saveLearnedPatterns();
        }
    }

    /**
     * Learn from failed operations
     */
    async learnFromFailure(context, attempt, error) {
        const key = `failure_${context}`;
        
        if (!this.failedPatterns.has(key)) {
            this.failedPatterns.set(key, {
                errors: [],
                commonErrors: new Map(),
                lastFailure: Date.now()
            });
        }
        
        const pattern = this.failedPatterns.get(key);
        pattern.errors.push({
            attempt,
            message: error.message,
            timestamp: Date.now()
        });
        
        // Track common error patterns
        const errorType = this.categorizeError(error);
        const count = pattern.commonErrors.get(errorType) || 0;
        pattern.commonErrors.set(errorType, count + 1);
        
        pattern.lastFailure = Date.now();
        
        // Keep only recent errors (last 50)
        if (pattern.errors.length > 50) {
            pattern.errors = pattern.errors.slice(-50);
        }
        
        this.failedPatterns.set(key, pattern);
    }

    /**
     * Categorize errors for learning
     */
    categorizeError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('timeout')) return 'timeout';
        if (message.includes('navigation')) return 'navigation';
        if (message.includes('network')) return 'network';
        if (message.includes('element')) return 'element_not_found';
        if (message.includes('bot') || message.includes('detection')) return 'bot_detection';
        
        return 'unknown';
    }

    /**
     * Adaptive selector learning and testing
     */
    async adaptiveElementExtraction(page, extractionType, fallbackValue = null) {
        const context = `extraction_${extractionType}`;
        
        return await this.adaptiveRetry(async () => {
            // Get learned selectors for this extraction type
            const learnedSelectors = this.workingSelectors.get(extractionType) || [];
            const defaultSelectors = this.getDefaultSelectors(extractionType);
            
            // Combine learned and default selectors, prioritizing learned ones
            const allSelectors = [...learnedSelectors, ...defaultSelectors];
            
            for (let i = 0; i < allSelectors.length; i++) {
                const selectorInfo = allSelectors[i];
                const selector = typeof selectorInfo === 'string' ? selectorInfo : selectorInfo.selector;
                
                try {
                    const result = await page.evaluate((sel, type) => {
                        const element = document.querySelector(sel);
                        if (!element || !element.offsetParent) return null;
                        
                        let value = null;
                        
                        if (type === 'text') {
                            value = element.textContent?.trim();
                        } else if (type === 'src') {
                            value = element.src || element.getAttribute('src');
                        } else if (type === 'bg') {
                            const style = window.getComputedStyle(element);
                            const bgImage = style.backgroundImage;
                            if (bgImage && bgImage !== 'none') {
                                value = bgImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
                            }
                        } else if (type === 'href') {
                            value = element.href || element.getAttribute('href');
                        }
                        
                        return value && value.length > 0 ? value : null;
                    }, selector, this.getSelectorType(extractionType));
                    
                    if (result) {
                        // Learn from successful selector
                        if (this.configInitialized) {
                            await this.adaptiveConfig.updateSelectorSuccess(extractionType, selector, true);
                        }
                        
                        console.log(`✅ [LinkedIn Adaptive] ${extractionType} extracted with selector: ${selector}`);
                        return { success: true, value: result, selector, method: 'adaptive' };
                    } else {
                        // Learn from failed selector
                        if (this.configInitialized) {
                            await this.adaptiveConfig.updateSelectorSuccess(extractionType, selector, false);
                        }
                    }
                    
                } catch (error) {
                    console.warn(`⚠️ [LinkedIn Adaptive] Selector failed: ${selector}`, error.message);
                }
            }
            
            // If all selectors failed, return fallback
            if (fallbackValue !== null) {
                console.log(`🔄 [LinkedIn Adaptive] Using fallback for ${extractionType}: ${fallbackValue}`);
                return { success: true, value: fallbackValue, method: 'fallback' };
            }
            
            return { success: false, value: null };
            
        }, context);
    }

    /**
     * Learn from successful selectors
     */
    async learnSuccessfulSelector(extractionType, selector, priority) {
        if (!this.workingSelectors.has(extractionType)) {
            this.workingSelectors.set(extractionType, []);
        }
        
        const selectors = this.workingSelectors.get(extractionType);
        
        // Remove if already exists and add to front (highest priority)
        const filtered = selectors.filter(s => 
            (typeof s === 'string' ? s : s.selector) !== selector
        );
        
        filtered.unshift({
            selector,
            successCount: (selectors.find(s => 
                (typeof s === 'string' ? s : s.selector) === selector
            )?.successCount || 0) + 1,
            lastSuccess: Date.now()
        });
        
        // Keep only top 20 selectors
        this.workingSelectors.set(extractionType, filtered.slice(0, 20));
    }

    /**
     * Get default selectors for extraction types
     */
    getDefaultSelectors(extractionType) {
        // First try to get learned selectors from config
        if (this.configInitialized) {
            const learnedSelectors = this.adaptiveConfig.getBestSelectors(extractionType, 10);
            if (learnedSelectors.length > 0) {
                return learnedSelectors;
            }
        }
        
        // Fallback to default selectors
        const selectors = {
            companyName: [
                'h1.top-card-layout__title',
                'h1[data-test-id="company-name"]',
                '.top-card-layout__entity-info h1',
                'h1.org-top-card-summary__title',
                'h1.top-card__title',
                '[data-test-id="org-name"] h1'
            ],
            description: [
                '.org-about-us-organization-description__text',
                '[data-test-id="about-us-description"]',
                '.about-us-description-content',
                '.top-card-layout__card .break-words',
                '.top-card__summary'
            ],
            logo: [
                'img[src*="media.licdn.com/dms/image/"][src*="company-logo"]',
                'img[data-test-id="company-logo"]',
                '.top-card-layout__entity-image img',
                '.org-top-card-primary-content__logo img',
                'img.org-top-card-primary-content__logo'
            ],
            banner: [
                'img[src*="media.licdn.com/dms/image/"][src*="company-background"]',
                'div.org-top-card-primary-content__hero-image',
                'div.org-top-card-module__hero',
                'img.org-top-card-primary-content__cover'
            ],
            industry: [
                // Note: jQuery-style selectors don't work in page.evaluate()
                // These will be handled by custom logic in the extraction function
            ],
            founded: [
                // Note: jQuery-style selectors don't work in page.evaluate()
                // These will be handled by custom logic in the extraction function
            ],
            headquarters: [
                // Note: jQuery-style selectors don't work in page.evaluate()
                // These will be handled by custom logic in the extraction function
            ],
            website: [
                // Note: jQuery-style selectors don't work in page.evaluate()
                // These will be handled by custom logic in the extraction function
            ]
        };
        
        return selectors[extractionType] || [];
    }

    /**
     * Get selector type for evaluation
     */
    getSelectorType(extractionType) {
        const types = {
            companyName: 'text',
            description: 'text',
            logo: 'src',
            banner: 'src',
            industry: 'text',
            founded: 'text',
            headquarters: 'text',
            website: 'href'
        };
        
        return types[extractionType] || 'text';
    }

    /**
     * Comprehensive company data extraction with adaptive learning
     */
    async extractCompanyData(page, url) {
        console.log('🧠 [LinkedIn Adaptive] Starting comprehensive data extraction...');
        
        // Initialize adaptive config if not done
        await this.initializeAdaptiveConfig();
        
        // Check for bot detection first
        const detectionResult = await this.detectBotDetection(page);
        
        if (detectionResult.isDetected) {
            console.log('🚨 [LinkedIn Adaptive] Bot detection found, implementing countermeasures...');
            
            // Implement bot detection countermeasures
            await this.handleBotDetection(page, url);
            
            // Re-check after countermeasures
            const recheckResult = await this.detectBotDetection(page);
            if (recheckResult.isDetected) {
                throw new Error('Bot detection persists after countermeasures');
            }
        }
        
        // Extract data using adaptive methods
        const extractionResults = {};
        
        // Core data extraction with learning
        const extractionTypes = [
            'companyName',
            'description', 
            'logo',
            'banner',
            'industry',
            'founded',
            'headquarters',
            'website'
        ];
        
        for (const type of extractionTypes) {
            try {
                console.log(`🔍 [LinkedIn Adaptive] Extracting ${type}...`);
                const result = await this.adaptiveElementExtraction(page, type);
                
                if (result && result.success) {
                    extractionResults[type] = {
                        value: result.value,
                        method: result.method,
                        selector: result.selector
                    };
                    console.log(`✅ [LinkedIn Adaptive] ${type}: ${result.value?.substring(0, 100)}...`);
                } else {
                    console.log(`❌ [LinkedIn Adaptive] ${type}: Not found`);
                    extractionResults[type] = { value: null, method: 'failed' };
                }
                
                // Small delay between extractions to appear human
                await this.implementAdaptiveDelay('between_extractions', true);
                
            } catch (error) {
                console.warn(`⚠️ [LinkedIn Adaptive] ${type} extraction failed:`, error.message);
                extractionResults[type] = { value: null, method: 'error', error: error.message };
            }
        }
        
        // Build final company data object
        const companyData = {
            url,
            status: 'Success',
            extractionMethod: 'adaptive_learning',
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            
            // Core data
            name: extractionResults.companyName?.value,
            description: extractionResults.description?.value,
            aboutUs: extractionResults.description?.value,
            logoUrl: extractionResults.logo?.value,
            bannerUrl: extractionResults.banner?.value,
            industry: extractionResults.industry?.value,
            founded: extractionResults.founded?.value,
            headquarters: extractionResults.headquarters?.value,
            location: extractionResults.headquarters?.value,
            website: extractionResults.website?.value,
            
            // Metadata
            extractionMetadata: {
                totalAttempts: this.metrics.totalAttempts,
                successfulExtractions: this.metrics.successfulExtractions,
                botDetections: this.metrics.botDetections,
                adaptiveImprovements: this.metrics.adaptiveImprovements,
                extractionMethods: Object.fromEntries(
                    Object.entries(extractionResults).map(([key, result]) => [
                        key, 
                        { method: result.method, selector: result.selector }
                    ])
                )
            }
        };
        
        // Validate extraction quality
        const qualityScore = this.calculateExtractionQuality(companyData);
        companyData.qualityScore = qualityScore;
        
        console.log(`📊 [LinkedIn Adaptive] Extraction complete. Quality score: ${qualityScore.toFixed(2)}/1.0`);
        
        // Save learned patterns
        await this.saveLearnedPatterns();
        
        return companyData;
    }

    /**
     * Handle bot detection with adaptive countermeasures
     */
    async handleBotDetection(page, url) {
        console.log('🛡️ [LinkedIn Adaptive] Implementing bot detection countermeasures...');
        
        // Strategy 1: Try clean URL navigation
        const cleanUrl = url.replace('/mycompany/', '/').replace('/mycompany', '').split('?')[0];
        if (cleanUrl !== url) {
            console.log('🔄 [LinkedIn Adaptive] Trying clean URL navigation...');
            await this.implementAdaptiveDelay('clean_url_navigation', false);
            await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await this.implementAdaptiveDelay('after_clean_navigation', null);
        }
        
        // Strategy 2: Close any modal dialogs
        await page.evaluate(() => {
            const closeSelectors = [
                '.artdeco-modal__dismiss',
                'button[aria-label="Dismiss"]',
                'button[aria-label="Close"]',
                '.artdeco-modal-overlay'
            ];
            
            for (const selector of closeSelectors) {
                const element = document.querySelector(selector);
                if (element && element.offsetParent !== null) {
                    element.click();
                    break;
                }
            }
        });
        
        await this.implementAdaptiveDelay('after_modal_close', null);
        
        // Strategy 3: Simulate human behavior
        await this.simulateHumanBehavior(page);
        
        // Strategy 4: Refresh if needed
        const recheckResult = await this.detectBotDetection(page);
        if (recheckResult.isDetected) {
            console.log('🔄 [LinkedIn Adaptive] Refreshing page as final countermeasure...');
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
            await this.implementAdaptiveDelay('after_refresh', false);
        }
    }

    /**
     * Simulate human behavior on the page
     */
    async simulateHumanBehavior(page) {
        console.log('🤖 [LinkedIn Adaptive] Simulating human behavior...');
        
        try {
            // Random mouse movements
            for (let i = 0; i < 3; i++) {
                const x = Math.random() * 800 + 100;
                const y = Math.random() * 600 + 100;
                await page.mouse.move(x, y);
                await this.implementAdaptiveDelay('mouse_movement', null);
            }
            
            // Random scrolling
            await page.evaluate(() => {
                const scrollAmount = Math.random() * 500 + 200;
                window.scrollBy(0, scrollAmount);
            });
            
            await this.implementAdaptiveDelay('after_scroll', null);
            
            // Hover over some elements
            const elements = await page.$$('h1, h2, .top-card-layout');
            if (elements.length > 0) {
                const randomElement = elements[Math.floor(Math.random() * elements.length)];
                await randomElement.hover();
                await this.implementAdaptiveDelay('after_hover', null);
            }
            
        } catch (error) {
            console.warn('⚠️ [LinkedIn Adaptive] Human behavior simulation failed:', error.message);
        }
    }

    /**
     * Calculate extraction quality score
     */
    calculateExtractionQuality(companyData) {
        const fields = ['name', 'description', 'logoUrl', 'bannerUrl', 'industry', 'founded', 'headquarters', 'website'];
        const weights = { name: 0.3, description: 0.2, logoUrl: 0.1, bannerUrl: 0.1, industry: 0.1, founded: 0.05, headquarters: 0.1, website: 0.05 };
        
        let totalScore = 0;
        let totalWeight = 0;
        
        fields.forEach(field => {
            const weight = weights[field] || 0.1;
            totalWeight += weight;
            
            if (companyData[field] && companyData[field].length > 0) {
                totalScore += weight;
            }
        });
        
        return totalScore / totalWeight;
    }

    /**
     * Get comprehensive metrics and learning status
     */
    getMetrics() {
        return {
            ...this.metrics,
            learnedPatterns: {
                successful: this.successfulPatterns.size,
                failed: this.failedPatterns.size,
                selectors: this.workingSelectors.size
            },
            detectionTriggers: Array.from(this.detectionTriggers),
            sessionId: this.sessionId,
            configInitialized: this.configInitialized
        };
    }
}

module.exports = { LinkedInAdaptiveScraper };