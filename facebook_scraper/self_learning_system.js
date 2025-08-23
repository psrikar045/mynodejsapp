// Self-Learning Adaptive Facebook Extraction System
// Automatically discovers and maintains selectors, navigation patterns, and extraction strategies

const fs = require('fs').promises;

class SelfLearningSystem {
    constructor() {
        const path = require('path'); // Lazy load when needed
        this.learningDataFile = path.resolve(__dirname, 'learning_data.json');
        this.selectorCacheFile = path.resolve(__dirname, 'selector_cache.json');
        this.learningData = {};
        this.selectorCache = {};
        this.successPatterns = new Map();
        this.failurePatterns = new Map();
    }

    async initialize() {
        try {
            const learningData = await fs.readFile(this.learningDataFile, 'utf-8');
            this.learningData = JSON.parse(learningData);
        } catch (e) {
            this.learningData = {
                selectors: {},
                navigationPatterns: {},
                extractionStrategies: {},
                pageLayouts: {},
                successRates: {},
                lastUpdated: Date.now()
            };
        }

        try {
            const selectorData = await fs.readFile(this.selectorCacheFile, 'utf-8');
            this.selectorCache = JSON.parse(selectorData);
        } catch (e) {
            this.selectorCache = {};
        }
    }

    // Discover and learn new selectors dynamically
    async discoverSelectors(page, targetType, expectedContent = null) {
        const discoveredSelectors = await page.evaluate((type, content) => {
            const selectors = [];
            const elements = Array.from(document.querySelectorAll('*'));
            
            // Generate potential selectors for each element
            elements.forEach(el => {
                if (!el.innerText?.trim() && !el.src && !el.href) return;
                
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return;
                
                // Generate multiple selector variations
                const variations = [];
                
                // By data attributes
                Object.keys(el.dataset).forEach(key => {
                    variations.push(`[data-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}="${el.dataset[key]}"]`);
                    variations.push(`[data-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}*="${el.dataset[key]}"]`);
                });
                
                // By class combinations
                if (el.className) {
                    const classes = el.className.split(' ').filter(c => c.length > 2);
                    classes.forEach(cls => variations.push(`.${cls}`));
                    if (classes.length > 1) {
                        variations.push(`.${classes.slice(0, 2).join('.')}`);
                    }
                }
                
                // By attributes
                ['role', 'aria-label', 'title', 'alt'].forEach(attr => {
                    const value = el.getAttribute(attr);
                    if (value) {
                        variations.push(`[${attr}="${value}"]`);
                        variations.push(`[${attr}*="${value.split(' ')[0]}"]`);
                    }
                });
                
                // By tag + attributes
                if (el.tagName) {
                    const tag = el.tagName.toLowerCase();
                    variations.push(tag);
                    if (el.className) {
                        variations.push(`${tag}.${el.className.split(' ')[0]}`);
                    }
                }
                
                // By text content patterns
                const text = el.innerText?.trim();
                if (text && text.length < 50) {
                    variations.push(`*:contains("${text}")`);
                    const words = text.split(' ');
                    if (words.length > 1) {
                        variations.push(`*:contains("${words[0]}")`);
                    }
                }
                
                // Score selectors based on specificity and content relevance
                variations.forEach(selector => {
                    let score = 0;
                    
                    // Prefer data attributes
                    if (selector.includes('data-')) score += 10;
                    
                    // Prefer specific roles
                    if (selector.includes('role=')) score += 8;
                    
                    // Prefer unique identifiers
                    if (selector.includes('testid') || selector.includes('test-id')) score += 15;
                    
                    // Content relevance scoring
                    if (content && text && text.toLowerCase().includes(content.toLowerCase())) {
                        score += 20;
                    }
                    
                    // Type-specific scoring
                    if (type === 'navigation' && /about|transparency|home|posts/i.test(text || selector)) {
                        score += 15;
                    }
                    
                    if (type === 'companyName' && el.tagName === 'H1') {
                        score += 10;
                    }
                    
                    if (type === 'image' && (el.tagName === 'IMG' || selector.includes('image'))) {
                        score += 10;
                    }
                    
                    selectors.push({ selector, score, element: el.tagName, text: text?.substring(0, 50) });
                });
            });
            
            // Return top scoring selectors
            return selectors
                .sort((a, b) => b.score - a.score)
                .slice(0, 20)
                .map(s => s.selector);
                
        }, targetType, expectedContent);

        // Test discovered selectors
        const validSelectors = [];
        for (const selector of discoveredSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const isVisible = await page.evaluate(el => {
                        const rect = el.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0;
                    }, element);
                    
                    if (isVisible) {
                        validSelectors.push({
                            selector,
                            discovered: Date.now(),
                            type: targetType,
                            tested: true
                        });
                    }
                }
            } catch (e) {}
        }

        // Update learning data
        if (!this.learningData.selectors[targetType]) {
            this.learningData.selectors[targetType] = [];
        }
        
        this.learningData.selectors[targetType] = [
            ...validSelectors,
            ...this.learningData.selectors[targetType].filter(s => 
                !validSelectors.some(v => v.selector === s.selector)
            )
        ].slice(0, 50); // Keep top 50 selectors

        await this.saveLearningData();
        return validSelectors.map(v => v.selector);
    }

    // Learn from successful extractions
    async recordSuccess(extractionType, selectors, data, pageUrl) {
        const key = `${extractionType}_${this.getUrlPattern(pageUrl)}`;
        
        if (!this.learningData.successRates[key]) {
            this.learningData.successRates[key] = { success: 0, total: 0, selectors: [] };
        }
        
        this.learningData.successRates[key].success++;
        this.learningData.successRates[key].total++;
        
        // Record successful selectors
        selectors.forEach(selector => {
            const existing = this.learningData.successRates[key].selectors.find(s => s.selector === selector);
            if (existing) {
                existing.successCount++;
                existing.lastSuccess = Date.now();
            } else {
                this.learningData.successRates[key].selectors.push({
                    selector,
                    successCount: 1,
                    failureCount: 0,
                    lastSuccess: Date.now(),
                    dataQuality: this.assessDataQuality(data)
                });
            }
        });

        await this.saveLearningData();
    }

    // Learn from failures and adapt
    async recordFailure(extractionType, selectors, error, pageUrl) {
        const key = `${extractionType}_${this.getUrlPattern(pageUrl)}`;
        
        if (!this.learningData.successRates[key]) {
            this.learningData.successRates[key] = { success: 0, total: 0, selectors: [] };
        }
        
        this.learningData.successRates[key].total++;
        
        // Record failed selectors
        selectors.forEach(selector => {
            const existing = this.learningData.successRates[key].selectors.find(s => s.selector === selector);
            if (existing) {
                existing.failureCount++;
                existing.lastFailure = Date.now();
            } else {
                this.learningData.successRates[key].selectors.push({
                    selector,
                    successCount: 0,
                    failureCount: 1,
                    lastFailure: Date.now(),
                    error: error?.substring(0, 100)
                });
            }
        });

        await this.saveLearningData();
    }

    // Get adaptive selectors based on learning
    getAdaptiveSelectors(extractionType, pageUrl = '') {
        const key = `${extractionType}_${this.getUrlPattern(pageUrl)}`;
        const learned = this.learningData.successRates[key];
        
        if (!learned) {
            return this.getDefaultSelectors(extractionType);
        }
        
        // Sort selectors by success rate and recency
        const sortedSelectors = learned.selectors
            .filter(s => s.successCount > 0)
            .sort((a, b) => {
                const aRate = a.successCount / (a.successCount + a.failureCount);
                const bRate = b.successCount / (b.successCount + b.failureCount);
                const aRecency = (Date.now() - (a.lastSuccess || 0)) / (1000 * 60 * 60 * 24); // days
                const bRecency = (Date.now() - (b.lastSuccess || 0)) / (1000 * 60 * 60 * 24);
                
                return (bRate - aRate) + (aRecency - bRecency) * 0.1;
            })
            .map(s => s.selector);
            
        return sortedSelectors.length > 0 ? sortedSelectors : this.getDefaultSelectors(extractionType);
    }

    // Auto-discover navigation patterns
    async discoverNavigationPattern(page, targetText) {
        return await page.evaluate((text) => {
            const patterns = [];
            const elements = Array.from(document.querySelectorAll('a, div, span, button'));
            
            elements.forEach(el => {
                const elementText = (el.innerText || el.textContent || '').toLowerCase();
                const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                const href = el.getAttribute('href') || '';
                
                if (elementText.includes(text.toLowerCase()) || 
                    ariaLabel.includes(text.toLowerCase()) ||
                    href.includes(text.toLowerCase())) {
                    
                    // Generate navigation patterns
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        patterns.push({
                            selector: this.generateSelector(el),
                            method: 'click',
                            text: elementText,
                            position: { x: rect.x, y: rect.y },
                            size: { width: rect.width, height: rect.height }
                        });
                    }
                }
            });
            
            return patterns.sort((a, b) => {
                // Prefer elements with exact text match
                const aExact = a.text === text.toLowerCase() ? 10 : 0;
                const bExact = b.text === text.toLowerCase() ? 10 : 0;
                return bExact - aExact;
            });
            
        }, targetText);
    }

    // Adaptive extraction strategy selection
    getAdaptiveStrategy(extractionType, pageLayout) {
        const strategies = this.learningData.extractionStrategies[extractionType] || [];
        
        // Find best strategy for current page layout
        const bestStrategy = strategies
            .filter(s => s.pageLayout === pageLayout || s.pageLayout === 'universal')
            .sort((a, b) => b.successRate - a.successRate)[0];
            
        return bestStrategy || this.getDefaultStrategy(extractionType);
    }

    // Learn page layout patterns
    async analyzePageLayout(page) {
        return await page.evaluate(() => {
            const layout = {
                hasHeader: !!document.querySelector('header, [role="banner"]'),
                hasNavigation: !!document.querySelector('nav, [role="navigation"]'),
                hasSidebar: !!document.querySelector('aside, [role="complementary"]'),
                mainContentSelector: null,
                totalElements: document.querySelectorAll('*').length,
                hasDataTestIds: document.querySelectorAll('[data-testid]').length > 0,
                hasAriaLabels: document.querySelectorAll('[aria-label]').length > 0,
                framework: 'unknown'
            };
            
            // Detect main content area
            const mainSelectors = ['main', '[role="main"]', '#main', '.main-content'];
            for (const selector of mainSelectors) {
                if (document.querySelector(selector)) {
                    layout.mainContentSelector = selector;
                    break;
                }
            }
            
            // Detect framework patterns
            if (document.querySelector('[data-reactroot]') || window.React) {
                layout.framework = 'react';
            } else if (document.querySelector('[ng-app]') || window.angular) {
                layout.framework = 'angular';
            } else if (document.querySelector('[data-vue]') || window.Vue) {
                layout.framework = 'vue';
            }
            
            return layout;
        });
    }

    // Auto-update selectors based on success rates
    async optimizeSelectors() {
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        
        Object.keys(this.learningData.successRates).forEach(key => {
            const data = this.learningData.successRates[key];
            
            // Remove selectors with consistently low success rates
            data.selectors = data.selectors.filter(s => {
                const successRate = s.successCount / (s.successCount + s.failureCount);
                const isRecent = (now - (s.lastSuccess || s.lastFailure || 0)) < oneWeek;
                
                return successRate > 0.1 || isRecent;
            });
            
            // Promote high-performing selectors
            data.selectors.forEach(s => {
                const successRate = s.successCount / (s.successCount + s.failureCount);
                if (successRate > 0.8 && s.successCount > 5) {
                    s.priority = 'high';
                }
            });
        });
        
        await this.saveLearningData();
    }

    // Helper methods
    getUrlPattern(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname + urlObj.pathname.split('/').slice(0, 3).join('/');
        } catch (e) {
            return 'unknown';
        }
    }

    assessDataQuality(data) {
        const fields = Object.keys(data).filter(k => data[k] && data[k] !== '');
        return fields.length / 10; // Normalize to 0-1 scale
    }

    getDefaultSelectors(type) {
        const defaults = {
            companyName: ['h1', '[data-testid*="title"]', '.title'],
            navigation: ['a', 'button', '[role="button"]'],
            image: ['img', 'image', '[role="img"]'],
            contact: ['[href^="mailto:"]', '[href^="tel:"]']
        };
        return defaults[type] || ['*'];
    }

    getDefaultStrategy(type) {
        return {
            method: 'selector',
            fallback: 'pattern',
            timeout: 3000,
            retries: 2
        };
    }

    async saveLearningData() {
        this.learningData.lastUpdated = Date.now();
        try {
            await fs.writeFile(this.learningDataFile, JSON.stringify(this.learningData, null, 2));
        } catch (e) {
            console.warn('Failed to save learning data:', e.message);
        }
    }
}

module.exports = { SelfLearningSystem };