/**
 * Adaptive Configuration Manager
 * Dynamically updates extraction configurations based on success patterns
 * Provides environment-specific configurations and automatic fallbacks
 */

const { APIPatternManager } = require('./api-pattern-manager');
const { getConfig, updatePatterns } = require('./banner-extraction-config');

class AdaptiveConfigManager {
    constructor() {
        this.patternManager = new APIPatternManager();
        this.currentEnvironment = process.env.NODE_ENV || 'development';
        this.configCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.lastConfigUpdate = null;
        this.adaptiveMode = true;
    }

    /**
     * Initialize the adaptive configuration system
     */
    async initialize() {
        try {
            await this.patternManager.initialize();
            await this.updateConfigurations();
            
            // Schedule periodic configuration updates
            this.scheduleConfigUpdates();
            
            console.log('✅ [Adaptive Config] Initialized successfully');
            
        } catch (error) {
            console.error('❌ [Adaptive Config] Initialization failed:', error.message);
            console.log('🛡️ [Adaptive Config] Falling back to static configuration');
            this.adaptiveMode = false;
        }
    }

    /**
     * Get adaptive configuration for banner extraction
     */
    async getAdaptiveConfig(component = 'networkPatterns') {
        const cacheKey = `${component}_${this.currentEnvironment}`;
        
        // Check cache first
        if (this.configCache.has(cacheKey)) {
            const cached = this.configCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.config;
            }
        }
        
        let config;
        
        if (this.adaptiveMode) {
            config = await this.generateAdaptiveConfig(component);
        } else {
            config = getConfig(component);
        }
        
        // Cache the configuration
        this.configCache.set(cacheKey, {
            config,
            timestamp: Date.now()
        });
        
        return config;
    }

    /**
     * Generate adaptive configuration based on learned patterns
     */
    async generateAdaptiveConfig(component) {
        switch (component) {
            case 'networkPatterns':
                return await this.generateNetworkPatternsConfig();
            case 'apiEndpoints':
                return await this.generateApiEndpointsConfig();
            case 'domSelectors':
                return await this.generateDomSelectorsConfig();
            case 'validation':
                return await this.generateValidationConfig();
            default:
                return getConfig(component);
        }
    }

    /**
     * Generate adaptive network patterns configuration
     */
    async generateNetworkPatternsConfig() {
        const baseConfig = getConfig('networkPatterns');
        const bestPatterns = this.patternManager.getBestPatterns(this.currentEnvironment, 30);
        const fallbackPatterns = this.patternManager.getFallbackPatterns();
        
        // Extract API patterns from learned data
        const learnedApiPatterns = bestPatterns
            .filter(p => p.type === 'path' && p.successRate > 0.6)
            .map(p => p.pattern)
            .slice(0, 15);
        
        const learnedContentPatterns = bestPatterns
            .filter(p => p.type === 'query' && p.successRate > 0.5)
            .map(p => p.pattern)
            .slice(0, 10);
        
        // Merge with baseline patterns
        const adaptiveConfig = {
            ...baseConfig,
            staticApiPatterns: [
                ...fallbackPatterns.apiEndpoints,
                ...learnedApiPatterns
            ],
            contentPatterns: [
                ...fallbackPatterns.contentPatterns,
                ...learnedContentPatterns
            ],
            // Add learned banner-specific patterns
            bannerSpecificPatterns: bestPatterns
                .filter(p => p.containsBannerData)
                .map(p => p.pattern)
                .slice(0, 10),
            // Metadata for debugging
            _metadata: {
                generatedAt: new Date().toISOString(),
                environment: this.currentEnvironment,
                learnedPatterns: learnedApiPatterns.length,
                fallbackPatterns: fallbackPatterns.apiEndpoints.length,
                bannerPatterns: bestPatterns.filter(p => p.containsBannerData).length
            }
        };
        
        console.log(`🧠 [Adaptive Config] Generated network patterns: ${adaptiveConfig.staticApiPatterns.length} API + ${adaptiveConfig.contentPatterns.length} content patterns`);
        
        return adaptiveConfig;
    }

    /**
     * Generate adaptive API endpoints configuration
     */
    async generateApiEndpointsConfig() {
        const baseConfig = getConfig('apiEndpoints');
        const bestPatterns = this.patternManager.getBestPatterns(this.currentEnvironment, 20);
        
        // Generate endpoint templates from successful patterns
        const learnedTemplates = bestPatterns
            .filter(p => p.type === 'path' && p.successRate > 0.7)
            .map(p => {
                // Convert pattern to template
                const template = p.pattern.replace(/\/[^\/]+$/, '/{companyId}');
                return `https://www.linkedin.com${template}`;
            })
            .filter((template, index, arr) => arr.indexOf(template) === index) // Remove duplicates
            .slice(0, 10);
        
        const adaptiveConfig = {
            ...baseConfig,
            templates: [
                ...baseConfig.templates,
                ...learnedTemplates
            ],
            // Priority-ordered templates based on success rates
            priorityTemplates: bestPatterns
                .filter(p => p.containsBannerData && p.successRate > 0.8)
                .map(p => `https://www.linkedin.com${p.pattern.replace(/\/[^\/]+$/, '/{companyId}')}`)
                .slice(0, 5),
            _metadata: {
                generatedAt: new Date().toISOString(),
                learnedTemplates: learnedTemplates.length,
                priorityTemplates: bestPatterns.filter(p => p.containsBannerData).length
            }
        };
        
        console.log(`🧠 [Adaptive Config] Generated API endpoints: ${adaptiveConfig.templates.length} total templates`);
        
        return adaptiveConfig;
    }

    /**
     * Generate adaptive DOM selectors configuration
     */
    async generateDomSelectorsConfig() {
        const baseConfig = getConfig('domSelectors');
        
        // For DOM selectors, we rely more on static patterns but can adjust priorities
        // based on which selectors have been successful in recent extractions
        
        const adaptiveConfig = {
            ...baseConfig,
            // Adjust priorities based on recent success (this would need tracking)
            prioritized: baseConfig.prioritized.map(selector => ({
                ...selector,
                // Could adjust priority based on success tracking
                adaptivePriority: selector.priority
            })),
            _metadata: {
                generatedAt: new Date().toISOString(),
                note: 'DOM selectors use static patterns with adaptive prioritization'
            }
        };
        
        return adaptiveConfig;
    }

    /**
     * Generate adaptive validation configuration
     */
    async generateValidationConfig() {
        const baseConfig = getConfig('validation');
        const report = this.patternManager.generateReport();
        
        // Adjust validation thresholds based on success patterns
        const adaptiveConfig = {
            ...baseConfig,
            quality: {
                ...baseConfig.quality,
                // Adjust thresholds based on overall success rate
                minWidth: report.summary.overallSuccessRate > 0.8 ? 150 : baseConfig.quality.minWidth,
                minHeight: report.summary.overallSuccessRate > 0.8 ? 75 : baseConfig.quality.minHeight,
                minAspectRatio: report.summary.overallSuccessRate > 0.7 ? 2.0 : baseConfig.quality.minAspectRatio
            },
            _metadata: {
                generatedAt: new Date().toISOString(),
                basedOnSuccessRate: report.summary.overallSuccessRate,
                totalPatterns: report.summary.totalPatterns
            }
        };
        
        return adaptiveConfig;
    }

    /**
     * Learn from extraction attempt
     */
    async learnFromExtraction(url, method, success, responseData = null, extractionMethod = null) {
        if (!this.adaptiveMode) return;
        
        try {
            await this.patternManager.learnPattern(url, method, success, responseData);
            
            // Track extraction method success
            if (extractionMethod) {
                await this.trackExtractionMethodSuccess(extractionMethod, success);
            }
            
        } catch (error) {
            console.warn('⚠️ [Adaptive Config] Failed to learn from extraction:', error.message);
        }
    }

    /**
     * Track success of different extraction methods
     */
    async trackExtractionMethodSuccess(method, success) {
        // This could be expanded to track which extraction methods work best
        // and adjust the priority order accordingly
        console.log(`📊 [Method Tracking] ${method}: ${success ? 'SUCCESS' : 'FAILED'}`);
    }

    /**
     * Update all configurations based on learned patterns
     */
    async updateConfigurations() {
        if (!this.adaptiveMode) return;
        
        try {
            console.log('🔄 [Adaptive Config] Updating configurations...');
            
            // Clear cache to force regeneration
            this.configCache.clear();
            
            // Pre-generate configurations for common components
            await this.getAdaptiveConfig('networkPatterns');
            await this.getAdaptiveConfig('apiEndpoints');
            
            this.lastConfigUpdate = new Date().toISOString();
            
            console.log('✅ [Adaptive Config] Configurations updated successfully');
            
        } catch (error) {
            console.error('❌ [Adaptive Config] Failed to update configurations:', error.message);
        }
    }

    /**
     * Schedule periodic configuration updates
     */
    scheduleConfigUpdates() {
        // Update configurations every 30 minutes
        setInterval(async () => {
            await this.updateConfigurations();
        }, 30 * 60 * 1000);
        
        // Generate and log reports every 6 hours
        setInterval(async () => {
            const report = this.patternManager.generateReport();
            console.log('📊 [Adaptive Config] Pattern Analysis Report:', {
                totalPatterns: report.summary.totalPatterns,
                successfulPatterns: report.summary.successfulPatterns,
                bannerPatterns: report.summary.bannerPatterns,
                overallSuccessRate: (report.summary.overallSuccessRate * 100).toFixed(1) + '%'
            });
            
            // Log recommendations
            if (report.recommendations.length > 0) {
                console.log('💡 [Adaptive Config] Recommendations:');
                report.recommendations.forEach(rec => {
                    console.log(`   ${rec.type.toUpperCase()}: ${rec.message}`);
                });
            }
        }, 6 * 60 * 60 * 1000);
        
        console.log('⏰ [Adaptive Config] Scheduled periodic updates');
    }

    /**
     * Get fallback configuration for emergency situations
     */
    getFallbackConfig(component) {
        console.log(`🛡️ [Adaptive Config] Using fallback configuration for ${component}`);
        
        const fallbackPatterns = this.patternManager.getFallbackPatterns();
        
        switch (component) {
            case 'networkPatterns':
                return {
                    staticApiPatterns: fallbackPatterns.apiEndpoints,
                    contentPatterns: fallbackPatterns.contentPatterns,
                    bannerJsonPatterns: getConfig('networkPatterns').bannerJsonPatterns,
                    bannerKeys: getConfig('networkPatterns').bannerKeys,
                    _fallback: true
                };
            default:
                return getConfig(component);
        }
    }

    /**
     * Export current adaptive configurations
     */
    async exportConfigurations() {
        const exportData = {
            metadata: {
                exportedAt: new Date().toISOString(),
                environment: this.currentEnvironment,
                adaptiveMode: this.adaptiveMode,
                lastConfigUpdate: this.lastConfigUpdate
            },
            configurations: {},
            patternReport: this.patternManager.generateReport()
        };
        
        // Export all component configurations
        const components = ['networkPatterns', 'apiEndpoints', 'domSelectors', 'validation'];
        for (const component of components) {
            exportData.configurations[component] = await this.getAdaptiveConfig(component);
        }
        
        const filename = `adaptive-config-export-${Date.now()}.json`;
        const fs = require('fs').promises;
        await fs.writeFile(filename, JSON.stringify(exportData, null, 2));
        
        console.log(`📤 [Adaptive Config] Exported configurations to ${filename}`);
        return filename;
    }

    /**
     * Get system status and health metrics
     */
    getSystemStatus() {
        const report = this.patternManager.generateReport();
        
        return {
            adaptiveMode: this.adaptiveMode,
            environment: this.currentEnvironment,
            lastConfigUpdate: this.lastConfigUpdate,
            cacheSize: this.configCache.size,
            patternSummary: report.summary,
            recommendations: report.recommendations,
            health: {
                status: report.summary.overallSuccessRate > 0.6 ? 'healthy' : 'degraded',
                successRate: (report.summary.overallSuccessRate * 100).toFixed(1) + '%',
                totalPatterns: report.summary.totalPatterns,
                bannerPatterns: report.summary.bannerPatterns
            }
        };
    }
}

module.exports = { AdaptiveConfigManager };