/**
 * API Pattern Manager
 * Automatically discovers, learns, and maintains LinkedIn API patterns
 * Provides fallback configurations and auto-updates patterns based on success rates
 */

const fs = require('fs').promises;
const path = require('path');
const { sanitizeForLogging, sanitizeUrl, sanitizeObjectForLogging } = require('./utils/input-sanitizer');

class APIPatternManager {
    constructor() {
        this.configFile = path.join(__dirname, 'api-patterns-database.json');
        this.backupConfigFile = path.join(__dirname, 'api-patterns-backup.json');
        this.patterns = null;
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            patternDiscoveries: 0,
            lastUpdate: null
        };
        this.learningEnabled = true;
        this.maxPatterns = 100; // Prevent unlimited growth
    }

    /**
     * Initialize the pattern manager and load existing patterns
     */
    async initialize() {
        try {
            await this.loadPatterns();
            console.log('✅ [Pattern Manager] Initialized with', Object.keys(this.patterns.apiEndpoints).length, 'API patterns');
            
            // Schedule periodic maintenance
            this.scheduleMaintenanceTasks();
            
        } catch (error) {
            console.error('❌ [Pattern Manager] Initialization failed:', error.message);
            await this.createDefaultPatterns();
        }
    }

    /**
     * Load patterns from database file
     */
    async loadPatterns() {
        try {
            const data = await fs.readFile(this.configFile, 'utf8');
            this.patterns = JSON.parse(data);
            
            // Validate structure
            if (!this.patterns.apiEndpoints || !this.patterns.metadata) {
                throw new Error('Invalid pattern database structure');
            }
            
            console.log(`📊 [Pattern Manager] Loaded ${Object.keys(this.patterns.apiEndpoints).length} patterns from database`);
            
        } catch (error) {
            console.warn('⚠️ [Pattern Manager] Could not load patterns:', error.message);
            
            // Try backup file
            try {
                const backupData = await fs.readFile(this.backupConfigFile, 'utf8');
                this.patterns = JSON.parse(backupData);
                console.log('✅ [Pattern Manager] Loaded patterns from backup');
            } catch (backupError) {
                throw new Error('Both primary and backup pattern files failed to load');
            }
        }
    }

    /**
     * Create default patterns if no database exists
     */
    async createDefaultPatterns() {
        console.log('🔧 [Pattern Manager] Creating default pattern database...');
        
        this.patterns = {
            metadata: {
                version: '1.0.0',
                created: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                totalPatterns: 0,
                successfulPatterns: 0
            },
            
            // Static baseline patterns (always maintained)
            baselinePatterns: {
                apiEndpoints: [
                    '/voyager/api/',
                    '/voyagerapi/',
                    '/api/v2/',
                    '/deco-api/',
                    '/li/api/'
                ],
                contentPatterns: [
                    'companyUpdates',
                    'organizationDashCompanies',
                    'companyProfile',
                    'organization',
                    'company'
                ]
            },
            
            // Dynamically discovered patterns with success metrics
            apiEndpoints: {},
            
            // Banner extraction patterns
            bannerPatterns: {
                jsonPatterns: [
                    'backgroundImage',
                    'coverPhoto',
                    'bannerImage',
                    'heroImage',
                    'companyBackground'
                ],
                urlPatterns: [
                    'company-background',
                    'organization-background',
                    'cover-photo',
                    'banner-image'
                ]
            },
            
            // Success tracking
            successMetrics: {
                patternSuccessRates: {},
                endpointPerformance: {},
                lastSuccessfulPatterns: [],
                failedPatterns: []
            },
            
            // Configuration for different environments
            environments: {
                production: {
                    useOnlyHighSuccessPatterns: true,
                    minSuccessRate: 0.7,
                    maxRetries: 3
                },
                development: {
                    useOnlyHighSuccessPatterns: false,
                    minSuccessRate: 0.3,
                    maxRetries: 5
                }
            }
        };
        
        await this.savePatterns();
        console.log('✅ [Pattern Manager] Default patterns created');
    }

    /**
     * Learn new API pattern from successful request
     */
    async learnPattern(url, method = 'GET', success = true, responseData = null) {
        if (!this.learningEnabled) return;
        
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(s => s.length > 0);
            
            // Extract potential patterns
            const patterns = this.extractPatternsFromUrl(urlObj, pathSegments);
            
            for (const pattern of patterns) {
                await this.updatePatternMetrics(pattern, method, success, responseData);
            }
            
            this.stats.totalRequests++;
            if (success) {
                this.stats.successfulRequests++;
            }
            
            // Auto-save periodically
            if (this.stats.totalRequests % 50 === 0) {
                await this.savePatterns();
            }
            
        } catch (error) {
            console.warn('⚠️ [Pattern Manager] Failed to learn pattern:', sanitizeForLogging(error.message));
        }
    }

    /**
     * Extract potential API patterns from URL
     */
    extractPatternsFromUrl(urlObj, pathSegments) {
        const patterns = [];
        
        // Extract path-based patterns
        for (let i = 0; i < pathSegments.length - 1; i++) {
            const pattern = '/' + pathSegments.slice(i, i + 2).join('/') + '/';
            if (pattern.length > 5) {
                patterns.push({
                    type: 'path',
                    pattern: pattern,
                    domain: urlObj.hostname,
                    fullPath: urlObj.pathname
                });
            }
        }
        
        // Extract query-based patterns
        if (urlObj.search) {
            const params = new URLSearchParams(urlObj.search);
            for (const [key, value] of params) {
                if (key.length > 2) {
                    patterns.push({
                        type: 'query',
                        pattern: key,
                        domain: urlObj.hostname,
                        sampleValue: value
                    });
                }
            }
        }
        
        // Extract domain-specific patterns
        if (urlObj.hostname.includes('linkedin.com')) {
            patterns.push({
                type: 'domain',
                pattern: urlObj.hostname,
                path: urlObj.pathname
            });
        }
        
        return patterns;
    }

    /**
     * Update metrics for a specific pattern
     */
    async updatePatternMetrics(patternInfo, method, success, responseData) {
        const patternKey = `${patternInfo.type}:${patternInfo.pattern}`;
        
        if (!this.patterns.apiEndpoints[patternKey]) {
            this.patterns.apiEndpoints[patternKey] = {
                pattern: patternInfo.pattern,
                type: patternInfo.type,
                domain: patternInfo.domain,
                method: method,
                discovered: new Date().toISOString(),
                totalRequests: 0,
                successfulRequests: 0,
                successRate: 0,
                lastUsed: null,
                lastSuccess: null,
                containsBannerData: false,
                sampleResponses: []
            };
            
            this.stats.patternDiscoveries++;
            console.log(`🔍 [Pattern Discovery] New pattern:`, sanitizeForLogging(patternKey));
        }
        
        const pattern = this.patterns.apiEndpoints[patternKey];
        pattern.totalRequests++;
        pattern.lastUsed = new Date().toISOString();
        
        if (success) {
            pattern.successfulRequests++;
            pattern.lastSuccess = new Date().toISOString();
            
            // Check if response contains banner data
            if (responseData && this.containsBannerData(responseData)) {
                pattern.containsBannerData = true;
                console.log(`🎯 [Banner Pattern] Pattern contains banner data: ${patternKey}`);
            }
            
            // Store sample response (limited)
            if (pattern.sampleResponses.length < 3 && responseData) {
                pattern.sampleResponses.push({
                    timestamp: new Date().toISOString(),
                    dataSize: JSON.stringify(responseData).length,
                    containsBanner: this.containsBannerData(responseData)
                });
            }
        }
        
        // Update success rate
        pattern.successRate = pattern.successfulRequests / pattern.totalRequests;
        
        // Update global success metrics
        this.patterns.successMetrics.patternSuccessRates[patternKey] = pattern.successRate;
    }

    /**
     * Check if response data contains banner information
     */
    containsBannerData(data) {
        if (!data) return false;
        
        const dataString = JSON.stringify(data).toLowerCase();
        const bannerIndicators = [
            'backgroundimage',
            'coverphoto',
            'bannerimage',
            'heroimage',
            'company-background',
            'media.licdn.com/dms/image',
            'cover',
            'banner'
        ];
        
        return bannerIndicators.some(indicator => dataString.includes(indicator));
    }

    /**
     * Get best patterns for current environment
     */
    getBestPatterns(environment = 'production', limit = 20) {
        const envConfig = this.patterns.environments[environment];
        const minSuccessRate = envConfig.minSuccessRate;
        
        // Filter patterns by success rate
        const goodPatterns = Object.entries(this.patterns.apiEndpoints)
            .filter(([key, pattern]) => pattern.successRate >= minSuccessRate)
            .sort((a, b) => {
                // Sort by success rate, then by banner data presence, then by recent usage
                const aPattern = a[1];
                const bPattern = b[1];
                
                if (aPattern.containsBannerData !== bPattern.containsBannerData) {
                    return bPattern.containsBannerData - aPattern.containsBannerData;
                }
                
                if (Math.abs(aPattern.successRate - bPattern.successRate) > 0.1) {
                    return bPattern.successRate - aPattern.successRate;
                }
                
                return new Date(bPattern.lastSuccess || 0) - new Date(aPattern.lastSuccess || 0);
            })
            .slice(0, limit);
        
        console.log(`📊 [Pattern Manager] Retrieved ${goodPatterns.length} best patterns for ${environment}`);
        
        return goodPatterns.map(([key, pattern]) => ({
            key,
            ...pattern
        }));
    }

    /**
     * Get fallback patterns (baseline + historically successful)
     */
    getFallbackPatterns() {
        const fallbackPatterns = {
            apiEndpoints: [...this.patterns.baselinePatterns.apiEndpoints],
            contentPatterns: [...this.patterns.baselinePatterns.contentPatterns],
            historicallySuccessful: []
        };
        
        // Add historically successful patterns
        const historicalPatterns = Object.entries(this.patterns.apiEndpoints)
            .filter(([key, pattern]) => pattern.successRate > 0.8 && pattern.totalRequests > 10)
            .sort((a, b) => b[1].successRate - a[1].successRate)
            .slice(0, 10);
        
        fallbackPatterns.historicallySuccessful = historicalPatterns.map(([key, pattern]) => pattern.pattern);
        
        console.log(`🛡️ [Pattern Manager] Fallback patterns: ${fallbackPatterns.apiEndpoints.length} baseline + ${fallbackPatterns.historicallySuccessful.length} historical`);
        
        return fallbackPatterns;
    }

    /**
     * Save patterns to database file
     */
    async savePatterns() {
        try {
            // Update metadata
            this.patterns.metadata.lastUpdated = new Date().toISOString();
            this.patterns.metadata.totalPatterns = Object.keys(this.patterns.apiEndpoints).length;
            this.patterns.metadata.successfulPatterns = Object.values(this.patterns.apiEndpoints)
                .filter(p => p.successRate > 0.5).length;
            
            // Create backup of current file
            try {
                await fs.copyFile(this.configFile, this.backupConfigFile);
            } catch (backupError) {
                // Backup failed, but continue with save
            }
            
            // Save new patterns
            await fs.writeFile(this.configFile, JSON.stringify(this.patterns, null, 2));
            
            console.log(`💾 [Pattern Manager] Saved ${this.patterns.metadata.totalPatterns} patterns to database`);
            
        } catch (error) {
            console.error('❌ [Pattern Manager] Failed to save patterns:', error.message);
        }
    }

    /**
     * Clean up old and unsuccessful patterns
     */
    async cleanupPatterns() {
        console.log('🧹 [Pattern Manager] Starting pattern cleanup...');
        
        const beforeCount = Object.keys(this.patterns.apiEndpoints).length;
        const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        
        // Remove patterns that are old and unsuccessful
        for (const [key, pattern] of Object.entries(this.patterns.apiEndpoints)) {
            const shouldRemove = (
                pattern.successRate < 0.1 && 
                pattern.totalRequests > 10 &&
                new Date(pattern.lastUsed) < cutoffDate
            );
            
            if (shouldRemove) {
                delete this.patterns.apiEndpoints[key];
                delete this.patterns.successMetrics.patternSuccessRates[key];
            }
        }
        
        const afterCount = Object.keys(this.patterns.apiEndpoints).length;
        const removedCount = beforeCount - afterCount;
        
        if (removedCount > 0) {
            console.log(`🗑️ [Pattern Manager] Cleaned up ${removedCount} unsuccessful patterns`);
            await this.savePatterns();
        }
    }

    /**
     * Generate pattern analysis report
     */
    generateReport() {
        const patterns = Object.values(this.patterns.apiEndpoints);
        const totalPatterns = patterns.length;
        const successfulPatterns = patterns.filter(p => p.successRate > 0.5).length;
        const bannerPatterns = patterns.filter(p => p.containsBannerData).length;
        
        const report = {
            summary: {
                totalPatterns,
                successfulPatterns,
                bannerPatterns,
                overallSuccessRate: this.stats.successfulRequests / this.stats.totalRequests,
                lastUpdated: this.patterns.metadata.lastUpdated
            },
            topPatterns: patterns
                .sort((a, b) => b.successRate - a.successRate)
                .slice(0, 10)
                .map(p => ({
                    pattern: p.pattern,
                    successRate: p.successRate,
                    totalRequests: p.totalRequests,
                    containsBannerData: p.containsBannerData
                })),
            recommendations: this.generateRecommendations(patterns)
        };
        
        return report;
    }

    /**
     * Generate recommendations based on pattern analysis
     */
    generateRecommendations(patterns) {
        const recommendations = [];
        
        const lowSuccessPatterns = patterns.filter(p => p.successRate < 0.3 && p.totalRequests > 5);
        if (lowSuccessPatterns.length > 0) {
            recommendations.push({
                type: 'cleanup',
                message: `Consider removing ${lowSuccessPatterns.length} low-success patterns`,
                patterns: lowSuccessPatterns.slice(0, 5).map(p => p.pattern)
            });
        }
        
        const bannerPatterns = patterns.filter(p => p.containsBannerData && p.successRate > 0.7);
        if (bannerPatterns.length > 0) {
            recommendations.push({
                type: 'prioritize',
                message: `Prioritize ${bannerPatterns.length} high-success banner patterns`,
                patterns: bannerPatterns.slice(0, 5).map(p => p.pattern)
            });
        }
        
        return recommendations;
    }

    /**
     * Schedule periodic maintenance tasks
     */
    scheduleMaintenanceTasks() {
        // Cleanup every 24 hours
        setInterval(async () => {
            await this.cleanupPatterns();
        }, 24 * 60 * 60 * 1000);
        
        // Save patterns every hour
        setInterval(async () => {
            await this.savePatterns();
        }, 60 * 60 * 1000);
        
        console.log('⏰ [Pattern Manager] Scheduled maintenance tasks');
    }

    /**
     * Export patterns for external use or backup
     */
    async exportPatterns(filename = null) {
        const exportData = {
            ...this.patterns,
            exportedAt: new Date().toISOString(),
            stats: this.stats
        };
        
        const exportFile = filename || `api-patterns-export-${Date.now()}.json`;
        await fs.writeFile(exportFile, JSON.stringify(exportData, null, 2));
        
        console.log(`📤 [Pattern Manager] Exported patterns to ${exportFile}`);
        return exportFile;
    }

    /**
     * Import patterns from external source
     */
    async importPatterns(filename) {
        try {
            const data = await fs.readFile(filename, 'utf8');
            const importedData = JSON.parse(data);
            
            // Merge with existing patterns
            for (const [key, pattern] of Object.entries(importedData.apiEndpoints || {})) {
                if (!this.patterns.apiEndpoints[key] || 
                    this.patterns.apiEndpoints[key].successRate < pattern.successRate) {
                    this.patterns.apiEndpoints[key] = pattern;
                }
            }
            
            await this.savePatterns();
            console.log(`📥 [Pattern Manager] Imported patterns from ${filename}`);
            
        } catch (error) {
            console.error('❌ [Pattern Manager] Failed to import patterns:', error.message);
        }
    }
}

module.exports = { APIPatternManager };