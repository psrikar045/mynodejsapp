/**
 * LinkedIn Adaptive Configuration Manager
 * Stores and manages learned patterns for bot detection avoidance
 */

const fs = require('fs').promises;
const path = require('path');

class LinkedInAdaptiveConfig {
    constructor() {
        this.configDir = path.join(__dirname, 'adaptive-configs');
        this.configFile = path.join(this.configDir, 'linkedin-patterns.json');
        this.backupFile = path.join(this.configDir, 'linkedin-patterns-backup.json');
        
        this.defaultConfig = {
            // Timing patterns that work well
            successfulDelays: {
                pre_navigation: { min: 2000, max: 4000, average: 3000 },
                post_navigation: { min: 3000, max: 7000, average: 5000 },
                between_extractions: { min: 1000, max: 2000, average: 1500 },
                after_about_tab_click: { min: 2000, max: 3000, average: 2500 },
                before_refresh_retry: { min: 4000, max: 8000, average: 6000 }
            },
            
            // Selectors that have proven successful
            workingSelectors: {
                companyName: [
                    { selector: 'h1.top-card-layout__title', successRate: 0.9, lastUsed: null },
                    { selector: 'h1[data-test-id="company-name"]', successRate: 0.8, lastUsed: null },
                    { selector: '.top-card-layout__entity-info h1', successRate: 0.7, lastUsed: null }
                ],
                description: [
                    { selector: '.org-about-us-organization-description__text', successRate: 0.8, lastUsed: null },
                    { selector: '[data-test-id="about-us-description"]', successRate: 0.7, lastUsed: null },
                    { selector: '.about-us-description-content', successRate: 0.6, lastUsed: null }
                ],
                logo: [
                    { selector: 'img[src*="media.licdn.com/dms/image/"][src*="company-logo"]', successRate: 0.9, lastUsed: null },
                    { selector: 'img[data-test-id="company-logo"]', successRate: 0.8, lastUsed: null },
                    { selector: '.top-card-layout__entity-image img', successRate: 0.7, lastUsed: null }
                ],
                banner: [
                    { selector: 'img[src*="media.licdn.com/dms/image/"][src*="company-background"]', successRate: 0.8, lastUsed: null },
                    { selector: 'div.org-top-card-primary-content__hero-image', successRate: 0.7, lastUsed: null },
                    { selector: 'div.org-top-card-module__hero', successRate: 0.6, lastUsed: null }
                ]
            },
            
            // Bot detection patterns to avoid
            botDetectionTriggers: [
                'join now', 'sign in', 'sign up', 'log in', 'login', 'register',
                'create account', 'get started', 'welcome to linkedin',
                'please sign in', 'authentication required', 'security challenge'
            ],
            
            // Successful countermeasures
            countermeasures: {
                clean_url_navigation: { successRate: 0.7, avgDelay: 3000 },
                page_refresh: { successRate: 0.6, avgDelay: 4000 },
                modal_dismissal: { successRate: 0.8, avgDelay: 1000 },
                human_behavior_simulation: { successRate: 0.5, avgDelay: 2000 }
            },
            
            // Learning metadata
            metadata: {
                version: '1.0.0',
                lastUpdated: new Date().toISOString(),
                totalLearningCycles: 0,
                successfulExtractions: 0,
                failedExtractions: 0
            }
        };
    }

    /**
     * Initialize configuration directory and file
     */
    async initialize() {
        try {
            // Create config directory if it doesn't exist
            await fs.mkdir(this.configDir, { recursive: true });
            
            // Load existing config or create default
            await this.loadConfig();
            
            console.log('🧠 [LinkedIn Adaptive Config] Initialized successfully');
            
        } catch (error) {
            console.warn('⚠️ [LinkedIn Adaptive Config] Initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Load configuration from file
     */
    async loadConfig() {
        try {
            const configData = await fs.readFile(this.configFile, 'utf8');
            this.config = { ...this.defaultConfig, ...JSON.parse(configData) };
            
            console.log('📖 [LinkedIn Adaptive Config] Loaded existing configuration');
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, use default config
                this.config = { ...this.defaultConfig };
                await this.saveConfig();
                console.log('📝 [LinkedIn Adaptive Config] Created new configuration file');
            } else {
                console.warn('⚠️ [LinkedIn Adaptive Config] Error loading config:', error.message);
                this.config = { ...this.defaultConfig };
            }
        }
    }

    /**
     * Save configuration to file with backup
     */
    async saveConfig() {
        try {
            // Create backup of existing config
            try {
                await fs.copyFile(this.configFile, this.backupFile);
            } catch (backupError) {
                // Ignore backup errors for new files
            }
            
            // Update metadata
            this.config.metadata.lastUpdated = new Date().toISOString();
            this.config.metadata.totalLearningCycles++;
            
            // Save new config
            await fs.writeFile(this.configFile, JSON.stringify(this.config, null, 2));
            
            console.log('💾 [LinkedIn Adaptive Config] Configuration saved successfully');
            
        } catch (error) {
            console.error('❌ [LinkedIn Adaptive Config] Error saving config:', error.message);
            throw error;
        }
    }

    /**
     * Update delay patterns based on success/failure
     */
    async updateDelayPattern(context, delay, success) {
        if (!this.config.successfulDelays[context]) {
            this.config.successfulDelays[context] = {
                min: delay,
                max: delay,
                average: delay,
                samples: []
            };
        }
        
        const pattern = this.config.successfulDelays[context];
        
        if (success) {
            // Add to samples for successful delays
            if (!pattern.samples) pattern.samples = [];
            pattern.samples.push(delay);
            
            // Keep only recent samples (last 50)
            if (pattern.samples.length > 50) {
                pattern.samples = pattern.samples.slice(-50);
            }
            
            // Update statistics
            pattern.average = pattern.samples.reduce((a, b) => a + b, 0) / pattern.samples.length;
            pattern.min = Math.min(pattern.min, delay);
            pattern.max = Math.max(pattern.max, delay);
        }
        
        // Save every 10 updates
        if (this.config.metadata.totalLearningCycles % 10 === 0) {
            await this.saveConfig();
        }
    }

    /**
     * Update selector success rates
     */
    async updateSelectorSuccess(extractionType, selector, success) {
        if (!this.config.workingSelectors[extractionType]) {
            this.config.workingSelectors[extractionType] = [];
        }
        
        const selectors = this.config.workingSelectors[extractionType];
        let selectorInfo = selectors.find(s => s.selector === selector);
        
        if (!selectorInfo) {
            selectorInfo = {
                selector,
                successRate: success ? 1.0 : 0.0,
                attempts: 1,
                successes: success ? 1 : 0,
                lastUsed: new Date().toISOString()
            };
            selectors.push(selectorInfo);
        } else {
            selectorInfo.attempts++;
            if (success) selectorInfo.successes++;
            selectorInfo.successRate = selectorInfo.successes / selectorInfo.attempts;
            selectorInfo.lastUsed = new Date().toISOString();
        }
        
        // Sort by success rate (highest first)
        selectors.sort((a, b) => b.successRate - a.successRate);
        
        // Keep only top 20 selectors
        this.config.workingSelectors[extractionType] = selectors.slice(0, 20);
    }

    /**
     * Update countermeasure effectiveness
     */
    async updateCountermeasure(type, success, delay) {
        if (!this.config.countermeasures[type]) {
            this.config.countermeasures[type] = {
                successRate: success ? 1.0 : 0.0,
                attempts: 1,
                successes: success ? 1 : 0,
                avgDelay: delay,
                totalDelay: delay
            };
        } else {
            const cm = this.config.countermeasures[type];
            cm.attempts++;
            if (success) cm.successes++;
            cm.successRate = cm.successes / cm.attempts;
            cm.totalDelay += delay;
            cm.avgDelay = cm.totalDelay / cm.attempts;
        }
    }

    /**
     * Get optimal delay for a context
     */
    getOptimalDelay(context) {
        const pattern = this.config.successfulDelays[context];
        if (!pattern) {
            return { min: 2000, max: 5000, average: 3000 };
        }
        
        return {
            min: pattern.min || 1000,
            max: pattern.max || 10000,
            average: pattern.average || 3000
        };
    }

    /**
     * Get best selectors for extraction type
     */
    getBestSelectors(extractionType, limit = 10) {
        const selectors = this.config.workingSelectors[extractionType] || [];
        return selectors
            .filter(s => s.successRate > 0.1) // Only selectors with some success
            .slice(0, limit)
            .map(s => s.selector);
    }

    /**
     * Get most effective countermeasures
     */
    getBestCountermeasures(limit = 5) {
        return Object.entries(this.config.countermeasures)
            .filter(([_, cm]) => cm.successRate > 0.3)
            .sort(([_, a], [__, b]) => b.successRate - a.successRate)
            .slice(0, limit)
            .map(([type, cm]) => ({ type, ...cm }));
    }

    /**
     * Record successful extraction
     */
    async recordSuccess() {
        this.config.metadata.successfulExtractions++;
        
        // Save periodically
        if (this.config.metadata.successfulExtractions % 5 === 0) {
            await this.saveConfig();
        }
    }

    /**
     * Record failed extraction
     */
    async recordFailure() {
        this.config.metadata.failedExtractions++;
        
        // Save periodically
        if (this.config.metadata.failedExtractions % 5 === 0) {
            await this.saveConfig();
        }
    }

    /**
     * Get configuration statistics
     */
    getStats() {
        const totalExtractions = this.config.metadata.successfulExtractions + this.config.metadata.failedExtractions;
        const successRate = totalExtractions > 0 ? this.config.metadata.successfulExtractions / totalExtractions : 0;
        
        return {
            version: this.config.metadata.version,
            lastUpdated: this.config.metadata.lastUpdated,
            totalLearningCycles: this.config.metadata.totalLearningCycles,
            totalExtractions,
            successfulExtractions: this.config.metadata.successfulExtractions,
            failedExtractions: this.config.metadata.failedExtractions,
            successRate: Math.round(successRate * 100) / 100,
            learnedDelayPatterns: Object.keys(this.config.successfulDelays).length,
            learnedSelectors: Object.values(this.config.workingSelectors).reduce((total, selectors) => total + selectors.length, 0),
            countermeasures: Object.keys(this.config.countermeasures).length
        };
    }

    /**
     * Export configuration for backup
     */
    async exportConfig() {
        return {
            config: this.config,
            stats: this.getStats(),
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Import configuration from backup
     */
    async importConfig(configData) {
        try {
            this.config = { ...this.defaultConfig, ...configData.config };
            await this.saveConfig();
            console.log('📥 [LinkedIn Adaptive Config] Configuration imported successfully');
        } catch (error) {
            console.error('❌ [LinkedIn Adaptive Config] Error importing config:', error.message);
            throw error;
        }
    }
}

module.exports = { LinkedInAdaptiveConfig };