// Auto-Adaptive Extractor with Self-Learning Capabilities
// Automatically adapts to Facebook changes without manual intervention

const { SelfLearningSystem } = require('./self_learning_system');

class AutoAdaptiveExtractor {
    constructor(page, logger, sessionId) {
        this.page = page;
        this.logger = logger;
        this.sessionId = sessionId;
        this.learningSystem = new SelfLearningSystem();
        this.pageLayout = null;
        this.discoveredSelectors = new Map();
    }

    async initialize() {
        await this.learningSystem.initialize();
        this.pageLayout = await this.learningSystem.analyzePageLayout(this.page);
        this.logger.step('Auto-adaptive extractor initialized', { layout: this.pageLayout.framework }, this.sessionId);
    }

    // Self-discovering navigation
    async navigateAdaptively(targetText, verificationFn = null) {
        const pageUrl = this.page.url();
        
        // Get learned selectors first
        let selectors = this.learningSystem.getAdaptiveSelectors('navigation', pageUrl);
        
        // If no learned selectors or recent failures, discover new ones
        if (selectors.length === 0 || await this.shouldRediscover('navigation')) {
            this.logger.step('Discovering new navigation patterns', { target: targetText }, this.sessionId);
            const discovered = await this.learningSystem.discoverNavigationPattern(this.page, targetText);
            selectors = discovered.map(p => p.selector);
        }

        // Try navigation with adaptive retry - OPTIMIZED: reduced from 3 to 2 attempts
        for (let attempt = 1; attempt <= 2; attempt++) {
            for (const selector of selectors) {
                try {
                    const success = await this.attemptNavigation(selector, verificationFn);
                    if (success) {
                        await this.learningSystem.recordSuccess('navigation', [selector], { navigated: true }, pageUrl);
                        return true;
                    }
                } catch (error) {
                    await this.learningSystem.recordFailure('navigation', [selector], error.message, pageUrl);
                }
            }
            
            if (attempt < 2) {
                // Rediscover selectors for next attempt
                const newSelectors = await this.learningSystem.discoverNavigationPattern(this.page, targetText);
                selectors = newSelectors.map(p => p.selector);
                await this.page.waitForTimeout(500 * attempt); // Reduced wait time
            }
        }
        
        return false;
    }

    // Self-discovering data extraction
    async extractDataAdaptively(dataType, expectedPattern = null) {
        const pageUrl = this.page.url();
        let selectors = this.learningSystem.getAdaptiveSelectors(dataType, pageUrl);
        
        // Discover new selectors if needed
        if (selectors.length === 0 || await this.shouldRediscover(dataType)) {
            this.logger.step('Discovering new selectors', { type: dataType }, this.sessionId);
            selectors = await this.learningSystem.discoverSelectors(this.page, dataType, expectedPattern);
        }

        // Try extraction with multiple strategies
        const strategies = [
            () => this.extractBySelectors(selectors),
            () => this.extractByPattern(dataType),
            () => this.extractByHeuristics(dataType),
            () => this.extractByAI(dataType)
        ];

        for (const strategy of strategies) {
            try {
                const result = await strategy();
                if (this.isValidResult(result)) {
                    await this.learningSystem.recordSuccess(dataType, selectors, { [dataType]: result }, pageUrl);
                    return result;
                }
            } catch (error) {
                await this.learningSystem.recordFailure(dataType, selectors, error.message, pageUrl);
            }
        }

        return null;
    }

    // AI-powered content extraction
    async extractByAI(dataType) {
        return await this.page.evaluate((type) => {
            // AI-like heuristics for content extraction
            const elements = Array.from(document.querySelectorAll('*'));
            const candidates = [];

            elements.forEach(el => {
                if (!el.innerText?.trim()) return;
                
                const text = el.innerText.trim();
                const rect = el.getBoundingClientRect();
                
                if (rect.width === 0 || rect.height === 0) return;
                
                let score = 0;
                
                // Type-specific AI scoring
                switch (type) {
                    case 'companyName':
                        if (el.tagName === 'H1') score += 20;
                        if (text.length > 5 && text.length < 100) score += 10;
                        if (/^[A-Z]/.test(text)) score += 5;
                        if (rect.y < 300) score += 10; // Likely in header
                        break;
                        
                    case 'email':
                        if (/@/.test(text)) score += 30;
                        if (el.tagName === 'A' && el.href?.startsWith('mailto:')) score += 25;
                        break;
                        
                    case 'phone':
                        if (/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(text)) score += 25;
                        if (el.tagName === 'A' && el.href?.startsWith('tel:')) score += 20;
                        break;
                        
                    case 'address':
                        if (/\d+.*(?:street|road|avenue|way)/i.test(text)) score += 20;
                        if (/\b\d{5}\b/.test(text)) score += 15;
                        break;
                }
                
                // General scoring factors
                if (el.getAttribute('data-testid')) score += 15;
                if (el.getAttribute('aria-label')) score += 10;
                if (el.className?.includes(type)) score += 10;
                
                candidates.push({ element: el, text, score });
            });
            
            // Return highest scoring candidate
            const best = candidates.sort((a, b) => b.score - a.score)[0];
            return best?.text || null;
            
        }, dataType);
    }

    // Pattern-based extraction with auto-learning
    async extractByPattern(dataType) {
        const patterns = this.getAdaptivePatterns(dataType);
        
        return await this.page.evaluate((pats) => {
            const text = document.body.innerText || '';
            
            for (const pattern of pats) {
                const match = text.match(new RegExp(pattern, 'gi'));
                if (match) return match[0];
            }
            
            return null;
        }, patterns);
    }

    // Heuristic-based extraction
    async extractByHeuristics(dataType) {
        return await this.page.evaluate((type) => {
            const heuristics = {
                companyName: () => {
                    // Try document title first
                    const title = document.title?.split('|')[0]?.trim();
                    if (title && title.length > 2 && title.length < 100) return title;
                    
                    // Try largest heading
                    const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
                    const largest = headings.sort((a, b) => {
                        const aRect = a.getBoundingClientRect();
                        const bRect = b.getBoundingClientRect();
                        return (bRect.width * bRect.height) - (aRect.width * aRect.height);
                    })[0];
                    
                    return largest?.innerText?.trim();
                },
                
                likes: () => {
                    const text = document.body.innerText;
                    const match = text.match(/(\d+[KMB]?)\s*(?:people\s+)?likes?/i);
                    return match?.[1];
                },
                
                followers: () => {
                    const text = document.body.innerText;
                    const match = text.match(/(\d+[KMB]?)\s*(?:people\s+)?followers?/i);
                    return match?.[1];
                },
                
                profileImage: () => {
                    const images = Array.from(document.querySelectorAll('img'));
                    // Find square image (likely profile)
                    const square = images.find(img => {
                        const rect = img.getBoundingClientRect();
                        return Math.abs(rect.width - rect.height) < 10 && rect.width > 50;
                    });
                    return square?.src;
                }
            };
            
            return heuristics[type] ? heuristics[type]() : null;
        }, dataType);
    }

    // Auto-learning selector extraction
    async extractBySelectors(selectors) {
        for (const selector of selectors) {
            try {
                const element = await this.page.$(selector);
                if (element) {
                    const result = await element.evaluate(el => {
                        if (el.tagName === 'IMG') return el.src;
                        if (el.tagName === 'A' && el.href) {
                            if (el.href.startsWith('mailto:')) return el.href.replace('mailto:', '');
                            if (el.href.startsWith('tel:')) return el.href.replace('tel:', '');
                            return el.href;
                        }
                        return el.innerText?.trim();
                    });
                    
                    if (this.isValidResult(result)) return result;
                }
            } catch (e) {}
        }
        return null;
    }

    // Attempt navigation with verification
    async attemptNavigation(selector, verificationFn) {
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
                    await this.page.waitForTimeout(2000);
                    
                    if (verificationFn) {
                        return await verificationFn();
                    }
                    return true;
                }
            }
        } catch (e) {}
        return false;
    }

    // Determine if rediscovery is needed
    async shouldRediscover(type) {
        const pageUrl = this.page.url();
        const key = `${type}_${this.learningSystem.getUrlPattern(pageUrl)}`;
        const data = this.learningSystem.learningData.successRates[key];
        
        if (!data) return true;
        
        const recentFailures = data.selectors.filter(s => {
            const recentFailure = Date.now() - (s.lastFailure || 0) < 60000; // 1 minute
            const lowSuccessRate = s.successCount / (s.successCount + s.failureCount) < 0.3;
            return recentFailure && lowSuccessRate;
        });
        
        return recentFailures.length > data.selectors.length * 0.5;
    }

    // Get adaptive patterns based on learning
    getAdaptivePatterns(type) {
        const learned = this.learningSystem.learningData.extractionStrategies[type];
        if (learned?.patterns) return learned.patterns;
        
        // Default patterns
        const defaults = {
            email: ['[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}'],
            phone: ['\\+?1?[-\\s]?\\(?\\d{3}\\)?[-\\s]?\\d{3}[-\\s]?\\d{4}'],
            likes: ['(\\d+[KMB]?)\\s*(?:people\\s+)?likes?'],
            followers: ['(\\d+[KMB]?)\\s*(?:people\\s+)?followers?']
        };
        
        return defaults[type] || [];
    }

    // Validate extraction result
    isValidResult(result) {
        return result && 
               typeof result === 'string' && 
               result.trim().length > 0 && 
               result.trim().length < 1000;
    }

    // Auto-optimize based on performance
    async optimizeExtraction() {
        await this.learningSystem.optimizeSelectors();
        this.logger.step('Extraction patterns optimized', {}, this.sessionId);
    }
}

module.exports = { AutoAdaptiveExtractor };