// Adaptive Facebook Data Extractor
// Implements intelligent extraction strategies with fallback mechanisms

const { EXTRACTION_CONFIG, getSelectors, getPattern, getRetryConfig, getTimeoutConfig } = require('./extraction_config');

class AdaptiveExtractor {
    constructor(page, logger, sessionId) {
        this.page = page;
        this.logger = logger;
        this.sessionId = sessionId;
        this.extractionHistory = new Map();
        this.failureCount = 0;
    }

    // Main adaptive extraction method
    async extractWithFallback(extractionType, primaryStrategy, fallbackStrategies = []) {
        const maxRetries = getRetryConfig(extractionType);
        const timeout = getTimeoutConfig(extractionType);
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.logger.step(`${extractionType} extraction attempt ${attempt}/${maxRetries}`, null, this.sessionId);
                
                // Try primary strategy
                const result = await this.executeWithTimeout(primaryStrategy, timeout);
                if (this.isValidResult(result)) {
                    this.recordSuccess(extractionType);
                    return result;
                }
                
                // Try fallback strategies
                for (const [index, fallbackStrategy] of fallbackStrategies.entries()) {
                    try {
                        this.logger.step(`Trying fallback strategy ${index + 1}`, null, this.sessionId);
                        const fallbackResult = await this.executeWithTimeout(fallbackStrategy, timeout);
                        if (this.isValidResult(fallbackResult)) {
                            this.recordSuccess(extractionType);
                            return fallbackResult;
                        }
                    } catch (fallbackError) {
                        this.logger.debug(`Fallback strategy ${index + 1} failed`, { error: fallbackError.message }, this.sessionId);
                    }
                }
                
                if (attempt < maxRetries) {
                    const backoffTime = this.calculateBackoff(attempt);
                    this.logger.step(`Backing off for ${backoffTime}ms`, null, this.sessionId);
                    await this.page.waitForTimeout(backoffTime);
                }
                
            } catch (error) {
                this.logger.warn(`${extractionType} attempt ${attempt} failed`, { error: error.message }, this.sessionId);
                this.recordFailure(extractionType);
                
                if (attempt === maxRetries) {
                    throw error;
                }
            }
        }
        
        return null;
    }

    // Execute function with timeout
    async executeWithTimeout(fn, timeout) {
        return Promise.race([
            fn(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Operation timeout')), timeout)
            )
        ]);
    }

    // Adaptive selector-based extraction
    async extractBySelectors(selectors, extractionFn = null) {
        const strategies = [
            // Strategy 1: Direct selector matching
            async () => {
                for (const selector of selectors) {
                    try {
                        await this.page.waitForSelector(selector, { timeout: 1000 }).catch(() => {});
                        const element = await this.page.$(selector);
                        if (element) {
                            const result = extractionFn ? await extractionFn(element) : await element.evaluate(el => el.innerText?.trim());
                            if (result) return result;
                        }
                    } catch (e) {}
                }
                return null;
            },
            
            // Strategy 2: Visibility-based selection
            async () => {
                return await this.page.evaluate((sels) => {
                    for (const selector of sels) {
                        try {
                            const elements = Array.from(document.querySelectorAll(selector));
                            const visibleElement = elements.find(el => {
                                const rect = el.getBoundingClientRect();
                                return rect.width > 0 && rect.height > 0 && 
                                       window.getComputedStyle(el).visibility !== 'hidden';
                            });
                            if (visibleElement?.innerText?.trim()) {
                                return visibleElement.innerText.trim();
                            }
                        } catch (e) {}
                    }
                    return null;
                }, selectors);
            },
            
            // Strategy 3: Content-based heuristics
            async () => {
                return await this.page.evaluate((sels) => {
                    const allElements = Array.from(document.querySelectorAll('*'));
                    for (const selector of sels) {
                        try {
                            const elements = allElements.filter(el => el.matches && el.matches(selector));
                            // Sort by content relevance
                            const sortedElements = elements.sort((a, b) => {
                                const aText = (a.innerText || '').trim();
                                const bText = (b.innerText || '').trim();
                                return bText.length - aText.length; // Prefer longer content
                            });
                            
                            const bestElement = sortedElements[0];
                            if (bestElement?.innerText?.trim()) {
                                return bestElement.innerText.trim();
                            }
                        } catch (e) {}
                    }
                    return null;
                }, selectors);
            }
        ];
        
        return await this.extractWithFallback('selector', strategies[0], strategies.slice(1));
    }

    // Pattern-based extraction with multiple strategies
    async extractByPattern(patternType, searchScope = 'body') {
        const pattern = getPattern(patternType);
        if (!pattern) return null;
        
        const strategies = [
            // Strategy 1: Direct pattern matching in specified scope
            async () => {
                return await this.page.evaluate((pat, scope) => {
                    const element = document.querySelector(scope);
                    if (!element) return null;
                    
                    const text = element.innerText || element.textContent || '';
                    const matches = text.match(pat);
                    return matches ? matches[0] : null;
                }, pattern, searchScope);
            },
            
            // Strategy 2: Pattern matching in all text content
            async () => {
                return await this.page.evaluate((pat) => {
                    const allText = document.body.innerText || document.body.textContent || '';
                    const matches = allText.match(pat);
                    return matches ? matches[0] : null;
                }, pattern);
            },
            
            // Strategy 3: Pattern matching in specific elements
            async () => {
                return await this.page.evaluate((pat) => {
                    const elements = Array.from(document.querySelectorAll('div, span, p, a, td, li'));
                    for (const el of elements) {
                        const text = el.innerText || el.textContent || '';
                        const matches = text.match(pat);
                        if (matches) return matches[0];
                    }
                    return null;
                }, pattern);
            }
        ];
        
        return await this.extractWithFallback('pattern', strategies[0], strategies.slice(1));
    }

    // Adaptive navigation with multiple strategies
    async navigateAdaptively(targetSelectors, verificationFn = null) {
        const strategies = [
            // Strategy 1: Direct click on visible elements
            async () => {
                for (const selector of targetSelectors) {
                    try {
                        await this.page.waitForSelector(selector, { timeout: 2000 }).catch(() => {});
                        const element = await this.page.$(selector);
                        if (element) {
                            const isVisible = await this.page.evaluate(el => {
                                const rect = el.getBoundingClientRect();
                                return rect.width > 0 && rect.height > 0;
                            }, element);
                            
                            if (isVisible) {
                                await element.click();
                                await this.page.waitForTimeout(3000);
                                
                                if (verificationFn) {
                                    const verified = await verificationFn();
                                    if (verified) return true;
                                } else {
                                    return true;
                                }
                            }
                        }
                    } catch (e) {}
                }
                return false;
            },
            
            // Strategy 2: JavaScript-based navigation
            async () => {
                return await this.page.evaluate((selectors) => {
                    for (const selector of selectors) {
                        try {
                            const element = document.querySelector(selector);
                            if (element && element.click) {
                                element.click();
                                return true;
                            }
                        } catch (e) {}
                    }
                    
                    // Fallback: text-based clicking using aria-label and title attributes
                    const allElements = Array.from(document.querySelectorAll('a, div, span, button'));
                    const searchTerms = ['about', 'transparency', 'info', 'contact'];
                    
                    for (const term of searchTerms) {
                        const element = allElements.find(el => {
                            const text = (el.innerText || '').toLowerCase();
                            const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                            const title = (el.getAttribute('title') || '').toLowerCase();
                            return text.includes(term) || ariaLabel.includes(term) || title.includes(term);
                        });
                        
                        if (element && element.click) {
                            element.click();
                            return true;
                        }
                    }
                    return false;
                }, targetSelectors);
            },
            
            // Strategy 3: Scroll and search
            async () => {
                await this.page.evaluate(() => {
                    window.scrollTo(0, document.body.scrollHeight / 2);
                });
                await this.page.waitForTimeout(1000);
                
                return await this.page.evaluate((selectors) => {
                    for (const selector of selectors) {
                        try {
                            const element = document.querySelector(selector);
                            if (element && element.click) {
                                element.scrollIntoView();
                                element.click();
                                return true;
                            }
                        } catch (e) {}
                    }
                    return false;
                }, targetSelectors);
            }
        ];
        
        return await this.extractWithFallback('navigation', strategies[0], strategies.slice(1));
    }

    // Image extraction with multiple strategies
    async extractImages(imageType) {
        const selectors = getSelectors('images', imageType);
        
        const strategies = [
            // Strategy 1: Direct selector matching
            async () => {
                for (const selector of selectors) {
                    try {
                        const element = await this.page.$(selector);
                        if (element) {
                            const src = await element.evaluate(el => 
                                el.src || el.getAttribute('src') || el.getAttribute('href'));
                            if (src && (src.startsWith('http') || src.startsWith('//'))) {
                                return src.startsWith('//') ? 'https:' + src : src;
                            }
                        }
                    } catch (e) {}
                }
                return null;
            },
            
            // Strategy 2: Heuristic-based image detection
            async () => {
                return await this.page.evaluate((type) => {
                    const images = Array.from(document.querySelectorAll('img'));
                    
                    if (type === 'profile') {
                        // Look for square images (likely profile)
                        const squareImages = images.filter(img => {
                            const rect = img.getBoundingClientRect();
                            return Math.abs(rect.width - rect.height) < 10 && rect.width > 50;
                        });
                        const largest = squareImages.sort((a, b) => 
                            b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
                        return largest?.src;
                    } else if (type === 'banner') {
                        // Look for wide images (likely banners)
                        const wideImages = images.filter(img => {
                            const rect = img.getBoundingClientRect();
                            return rect.width > rect.height * 1.5 && rect.width > 200;
                        });
                        const largest = wideImages.sort((a, b) => 
                            b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
                        return largest?.src;
                    }
                    return null;
                }, imageType);
            },
            
            // Strategy 3: Meta tag fallback
            async () => {
                if (imageType === 'profile') {
                    return await this.page.evaluate(() => {
                        const metaImage = document.querySelector('meta[property="og:image"]');
                        return metaImage?.getAttribute('content');
                    });
                }
                return null;
            }
        ];
        
        return await this.extractWithFallback('image', strategies[0], strategies.slice(1));
    }

    // Utility methods
    isValidResult(result) {
        return result !== null && result !== undefined && 
               (typeof result === 'string' ? result.trim().length > 0 : true);
    }

    calculateBackoff(attempt) {
        const baseDelay = getTimeoutConfig('retryDelay');
        return Math.min(baseDelay * Math.pow(2, attempt - 1), 10000);
    }

    recordSuccess(type) {
        this.extractionHistory.set(type, { success: true, timestamp: Date.now() });
        this.failureCount = 0;
    }

    recordFailure(type) {
        this.extractionHistory.set(type, { success: false, timestamp: Date.now() });
        this.failureCount++;
    }

    getFailureCount() {
        return this.failureCount;
    }

    shouldUseCircuitBreaker() {
        return this.failureCount >= EXTRACTION_CONFIG.errorHandling.maxConsecutiveFailures;
    }
}

module.exports = { AdaptiveExtractor };