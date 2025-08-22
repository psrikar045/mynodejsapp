// Automatic Maintenance System for Self-Learning Facebook Scraper
// Runs periodic optimization and cleanup without manual intervention

const { SelfLearningSystem } = require('./self_learning_system');
const { extractionLogger } = require('../extraction-logger');

class AutoMaintenanceSystem {
    constructor() {
        this.learningSystem = new SelfLearningSystem();
        this.maintenanceInterval = null;
        this.isRunning = false;
    }

    // Start automatic maintenance
    async start() {
        if (this.isRunning) return;
        
        await this.learningSystem.initialize();
        this.isRunning = true;
        
        // Run maintenance every 6 hours
        this.maintenanceInterval = setInterval(async () => {
            await this.performMaintenance();
        }, 6 * 60 * 60 * 1000);
        
        // Initial maintenance run
        setTimeout(() => this.performMaintenance(), 30000); // 30 seconds after start
        
        extractionLogger.info('Auto-maintenance system started', { interval: '6 hours' });
    }

    // Stop automatic maintenance
    stop() {
        if (this.maintenanceInterval) {
            clearInterval(this.maintenanceInterval);
            this.maintenanceInterval = null;
        }
        this.isRunning = false;
        extractionLogger.info('Auto-maintenance system stopped');
    }

    // Perform comprehensive maintenance
    async performMaintenance() {
        try {
            extractionLogger.info('Starting automatic maintenance cycle');
            
            await this.optimizeSelectors();
            await this.cleanupOldData();
            await this.updateSuccessRates();
            await this.generateInsights();
            
            extractionLogger.info('Automatic maintenance cycle completed');
        } catch (error) {
            extractionLogger.error('Maintenance cycle failed', { error: error.message });
        }
    }

    // Optimize selectors based on performance
    async optimizeSelectors() {
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        const oneMonth = 30 * 24 * 60 * 60 * 1000;
        
        let optimized = 0;
        
        Object.keys(this.learningSystem.learningData.successRates).forEach(key => {
            const data = this.learningSystem.learningData.successRates[key];
            const originalCount = data.selectors.length;
            
            // Remove consistently failing selectors
            data.selectors = data.selectors.filter(s => {
                const successRate = s.successCount / (s.successCount + s.failureCount);
                const isRecent = (now - (s.lastSuccess || s.lastFailure || 0)) < oneWeek;
                const hasMinimumAttempts = (s.successCount + s.failureCount) >= 3;
                
                // Keep if: good success rate OR recent activity OR insufficient data
                return successRate > 0.2 || isRecent || !hasMinimumAttempts;
            });
            
            // Promote high-performing selectors
            data.selectors.forEach(s => {
                const successRate = s.successCount / (s.successCount + s.failureCount);
                const isHighVolume = (s.successCount + s.failureCount) > 10;
                
                if (successRate > 0.8 && isHighVolume) {
                    s.priority = 'high';
                    s.weight = Math.min(s.weight || 1, 2); // Increase weight
                } else if (successRate < 0.3 && isHighVolume) {
                    s.priority = 'low';
                    s.weight = Math.max(s.weight || 1, 0.5); // Decrease weight
                }
            });
            
            // Sort by performance
            data.selectors.sort((a, b) => {
                const aRate = a.successCount / (a.successCount + a.failureCount);
                const bRate = b.successCount / (b.successCount + b.failureCount);
                const aWeight = a.weight || 1;
                const bWeight = b.weight || 1;
                
                return (bRate * bWeight) - (aRate * aWeight);
            });
            
            if (data.selectors.length !== originalCount) {
                optimized++;
            }
        });
        
        await this.learningSystem.saveLearningData();
        extractionLogger.info('Selector optimization completed', { optimizedKeys: optimized });
    }

    // Clean up old and irrelevant data
    async cleanupOldData() {
        const now = Date.now();
        const threeMonths = 90 * 24 * 60 * 60 * 1000;
        let cleaned = 0;
        
        // Remove very old selector data
        Object.keys(this.learningSystem.learningData.successRates).forEach(key => {
            const data = this.learningSystem.learningData.successRates[key];
            const originalCount = data.selectors.length;
            
            data.selectors = data.selectors.filter(s => {
                const lastActivity = Math.max(s.lastSuccess || 0, s.lastFailure || 0);
                const isRecent = (now - lastActivity) < threeMonths;
                const hasGoodPerformance = s.successCount > 5;
                
                return isRecent || hasGoodPerformance;
            });
            
            if (data.selectors.length !== originalCount) {
                cleaned++;
            }
            
            // Remove empty entries
            if (data.selectors.length === 0 && data.total === 0) {
                delete this.learningSystem.learningData.successRates[key];
                cleaned++;
            }
        });
        
        await this.learningSystem.saveLearningData();
        extractionLogger.info('Data cleanup completed', { cleanedKeys: cleaned });
    }

    // Update success rates and statistics
    async updateSuccessRates() {
        let updated = 0;
        
        Object.keys(this.learningSystem.learningData.successRates).forEach(key => {
            const data = this.learningSystem.learningData.successRates[key];
            
            // Recalculate overall success rate
            const totalSuccess = data.selectors.reduce((sum, s) => sum + s.successCount, 0);
            const totalAttempts = data.selectors.reduce((sum, s) => sum + s.successCount + s.failureCount, 0);
            
            if (totalAttempts > 0) {
                data.success = totalSuccess;
                data.total = totalAttempts;
                data.successRate = totalSuccess / totalAttempts;
                data.lastUpdated = Date.now();
                updated++;
            }
        });
        
        await this.learningSystem.saveLearningData();
        extractionLogger.info('Success rates updated', { updatedKeys: updated });
    }

    // Generate insights and recommendations
    async generateInsights() {
        const insights = {
            topPerformingSelectors: [],
            problematicPatterns: [],
            recommendations: [],
            statistics: {}
        };
        
        const allSelectors = [];
        Object.values(this.learningSystem.learningData.successRates).forEach(data => {
            data.selectors.forEach(s => {
                const successRate = s.successCount / (s.successCount + s.failureCount);
                allSelectors.push({
                    ...s,
                    successRate,
                    totalAttempts: s.successCount + s.failureCount
                });
            });
        });
        
        // Top performing selectors
        insights.topPerformingSelectors = allSelectors
            .filter(s => s.totalAttempts >= 5)
            .sort((a, b) => b.successRate - a.successRate)
            .slice(0, 10)
            .map(s => ({
                selector: s.selector,
                successRate: s.successRate,
                attempts: s.totalAttempts
            }));
        
        // Problematic patterns
        insights.problematicPatterns = allSelectors
            .filter(s => s.successRate < 0.3 && s.totalAttempts >= 5)
            .sort((a, b) => a.successRate - b.successRate)
            .slice(0, 5)
            .map(s => ({
                selector: s.selector,
                successRate: s.successRate,
                attempts: s.totalAttempts
            }));
        
        // Statistics
        insights.statistics = {
            totalSelectors: allSelectors.length,
            averageSuccessRate: allSelectors.reduce((sum, s) => sum + s.successRate, 0) / allSelectors.length,
            highPerformers: allSelectors.filter(s => s.successRate > 0.8).length,
            lowPerformers: allSelectors.filter(s => s.successRate < 0.3).length,
            totalAttempts: allSelectors.reduce((sum, s) => sum + s.totalAttempts, 0)
        };
        
        // Generate recommendations
        if (insights.statistics.lowPerformers > insights.statistics.highPerformers) {
            insights.recommendations.push('Consider updating extraction strategies - high failure rate detected');
        }
        
        if (insights.statistics.averageSuccessRate < 0.6) {
            insights.recommendations.push('Overall success rate is low - may need selector discovery refresh');
        }
        
        if (insights.topPerformingSelectors.length < 5) {
            insights.recommendations.push('Limited high-performing selectors - increase learning data collection');
        }
        
        // Save insights
        this.learningSystem.learningData.insights = {
            ...insights,
            generatedAt: Date.now()
        };
        
        await this.learningSystem.saveLearningData();
        extractionLogger.info('Insights generated', { 
            topPerformers: insights.topPerformingSelectors.length,
            recommendations: insights.recommendations.length 
        });
    }

    // Get current system health
    getSystemHealth() {
        const insights = this.learningSystem.learningData.insights;
        if (!insights) return { status: 'unknown', message: 'No insights available' };
        
        const stats = insights.statistics;
        let status = 'healthy';
        let message = 'System performing well';
        
        if (stats.averageSuccessRate < 0.4) {
            status = 'critical';
            message = 'Low success rate - immediate attention needed';
        } else if (stats.averageSuccessRate < 0.6) {
            status = 'warning';
            message = 'Below optimal performance';
        } else if (stats.lowPerformers > stats.highPerformers * 2) {
            status = 'warning';
            message = 'High number of failing selectors';
        }
        
        return {
            status,
            message,
            successRate: stats.averageSuccessRate,
            totalSelectors: stats.totalSelectors,
            recommendations: insights.recommendations,
            lastMaintenance: insights.generatedAt
        };
    }

    // Force maintenance run
    async forceMaintenance() {
        extractionLogger.info('Forced maintenance cycle initiated');
        await this.performMaintenance();
    }
}

// Global instance
const autoMaintenance = new AutoMaintenanceSystem();

// Auto-start maintenance system
process.nextTick(() => {
    autoMaintenance.start().catch(error => {
        extractionLogger.error('Failed to start auto-maintenance', { error: error.message });
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    autoMaintenance.stop();
});

process.on('SIGTERM', () => {
    autoMaintenance.stop();
});

module.exports = { AutoMaintenanceSystem, autoMaintenance };