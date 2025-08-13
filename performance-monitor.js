/**
 * Advanced Performance Monitoring System
 * Tracks application health, identifies bottlenecks, and provides detailed analytics
 */

const os = require('os');
const fs = require('fs').promises;
const path = require('path');

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            // Request metrics
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            
            // Timing metrics
            responseTimesMs: [],
            browserLaunchTimes: [],
            navigationTimes: [],
            extractionTimes: [],
            
            // Resource metrics
            memoryUsage: [],
            cpuUsage: [],
            
            // Error tracking
            errors: [],
            errorCategories: {
                network: 0,
                timeout: 0,
                parsing: 0,
                browser: 0,
                file_operation: 0,
                memory: 0,
                other: 0
            },
            
            // Platform metrics
            platform: os.platform(),
            nodeVersion: process.version,
            startTime: Date.now(),
            
            // Anti-bot metrics
            botDetectionEvents: 0,
            userAgentRotations: 0,
            stealthModeActivations: 0
        };
        
        this.maxHistorySize = 1000;
        this.monitoringInterval = null;
        this.healthCheckInterval = null;
        
        // Start system monitoring
        this.startSystemMonitoring();
        this.startHealthChecks();
    }

    /**
     * Start system resource monitoring
     */
    startSystemMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.recordSystemMetrics();
        }, 30000); // Every 30 seconds
        
        console.log('📊 [Performance] System monitoring started');
    }

    /**
     * Start periodic health checks
     */
    startHealthChecks() {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 5 * 60 * 1000); // Every 5 minutes
        
        console.log('🏥 [Performance] Health monitoring started');
    }

    /**
     * Record system resource metrics
     */
    async recordSystemMetrics() {
        try {
            // Memory usage
            const memUsage = process.memoryUsage();
            this.metrics.memoryUsage.push({
                timestamp: Date.now(),
                rss: memUsage.rss,
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external
            });

            // CPU usage (approximation using process.cpuUsage())
            const cpuUsage = process.cpuUsage();
            this.metrics.cpuUsage.push({
                timestamp: Date.now(),
                user: cpuUsage.user,
                system: cpuUsage.system
            });

            // Limit history size
            this.limitArraySize(this.metrics.memoryUsage, this.maxHistorySize);
            this.limitArraySize(this.metrics.cpuUsage, this.maxHistorySize);

        } catch (error) {
            this.recordError('system_monitoring', error);
        }
    }

    /**
     * Start timing for an operation
     */
    startTimer(operation) {
        return {
            operation,
            startTime: Date.now(),
            startHrTime: process.hrtime.bigint()
        };
    }

    /**
     * End timing for an operation and record metrics
     */
    endTimer(timer, success = true, additionalData = {}) {
        const endTime = Date.now();
        const endHrTime = process.hrtime.bigint();
        
        const durationMs = endTime - timer.startTime;
        const precisionDurationMs = Number(endHrTime - timer.startHrTime) / 1000000;

        const record = {
            operation: timer.operation,
            duration: durationMs,
            precisionDuration: precisionDurationMs,
            success,
            timestamp: endTime,
            ...additionalData
        };

        // Categorize timing data
        switch (timer.operation) {
            case 'browser_launch':
                this.metrics.browserLaunchTimes.push(record);
                this.limitArraySize(this.metrics.browserLaunchTimes, 100);
                break;
            case 'navigation':
                this.metrics.navigationTimes.push(record);
                this.limitArraySize(this.metrics.navigationTimes, 200);
                break;
            case 'extraction':
                this.metrics.extractionTimes.push(record);
                this.limitArraySize(this.metrics.extractionTimes, 500);
                break;
            case 'request':
                this.metrics.responseTimesMs.push(record);
                this.limitArraySize(this.metrics.responseTimesMs, 1000);
                break;
        }

        console.log(`⏱️ [Performance] ${timer.operation}: ${durationMs}ms (${success ? 'SUCCESS' : 'FAILED'})`);
        return record;
    }

    /**
     * Record an error with categorization
     */
    recordError(category, error, context = {}) {
        const errorRecord = {
            category,
            message: error.message || error,
            stack: error.stack,
            timestamp: Date.now(),
            context
        };

        this.metrics.errors.push(errorRecord);
        this.limitArraySize(this.metrics.errors, 500);

        // Update error categories
        if (this.metrics.errorCategories.hasOwnProperty(category)) {
            this.metrics.errorCategories[category]++;
        } else {
            this.metrics.errorCategories.other++;
        }

        this.metrics.failedRequests++;
        
        console.error(`❌ [Performance] Error in ${category}:`, error.message);
    }

    /**
     * Record successful operation
     */
    recordSuccess(operation, duration = null, context = {}) {
        this.metrics.successfulRequests++;
        this.metrics.totalRequests++;

        if (duration) {
            console.log(`✅ [Performance] ${operation} completed in ${duration}ms`);
        }
    }

    /**
     * Record anti-bot event
     */
    recordAntiBotEvent(eventType, details = {}) {
        switch (eventType) {
            case 'bot_detection':
                this.metrics.botDetectionEvents++;
                break;
            case 'user_agent_rotation':
                this.metrics.userAgentRotations++;
                break;
            case 'stealth_activation':
                this.metrics.stealthModeActivations++;
                break;
        }

        console.log(`🛡️ [Performance] Anti-bot event: ${eventType}`, details);
    }

    /**
     * Perform health check and identify issues
     */
    performHealthCheck() {
        const issues = [];
        const warnings = [];
        
        try {
            // Check memory usage
            const latestMemory = this.metrics.memoryUsage.slice(-1)[0];
            if (latestMemory) {
                const memoryUsageMB = latestMemory.heapUsed / 1024 / 1024;
                if (memoryUsageMB > 500) {
                    issues.push(`High memory usage: ${memoryUsageMB.toFixed(1)}MB`);
                } else if (memoryUsageMB > 250) {
                    warnings.push(`Moderate memory usage: ${memoryUsageMB.toFixed(1)}MB`);
                }
            }

            // Check error rates
            const recentErrors = this.metrics.errors.filter(e => 
                Date.now() - e.timestamp < 10 * 60 * 1000 // Last 10 minutes
            );
            
            if (recentErrors.length > 10) {
                issues.push(`High error rate: ${recentErrors.length} errors in last 10 minutes`);
            } else if (recentErrors.length > 5) {
                warnings.push(`Moderate error rate: ${recentErrors.length} errors in last 10 minutes`);
            }

            // Check success rate
            const successRate = this.getSuccessRate();
            if (successRate < 50) {
                issues.push(`Low success rate: ${successRate}%`);
            } else if (successRate < 80) {
                warnings.push(`Moderate success rate: ${successRate}%`);
            }

            // Check response times
            const avgResponseTime = this.getAverageResponseTime();
            if (avgResponseTime > 30000) {
                issues.push(`Slow response times: ${avgResponseTime}ms average`);
            } else if (avgResponseTime > 15000) {
                warnings.push(`Moderate response times: ${avgResponseTime}ms average`);
            }

            // Log health status
            if (issues.length > 0) {
                console.warn('🚨 [Health Check] Issues detected:', issues);
            }
            if (warnings.length > 0) {
                console.warn('⚠️ [Health Check] Warnings:', warnings);
            }
            if (issues.length === 0 && warnings.length === 0) {
                console.log('✅ [Health Check] System healthy');
            }

        } catch (error) {
            console.error('❌ [Health Check] Health check failed:', error.message);
        }
    }

    /**
     * Get comprehensive performance analytics
     */
    getAnalytics() {
        const uptime = Date.now() - this.metrics.startTime;
        
        return {
            // Basic stats
            totalRequests: this.metrics.totalRequests,
            successRate: `${this.getSuccessRate()}%`,
            failureRate: `${(100 - this.getSuccessRate()).toFixed(1)}%`,
            uptime: `${Math.floor(uptime / 1000 / 60)} minutes`,
            
            // Performance metrics
            averageResponseTime: `${this.getAverageResponseTime()}ms`,
            averageBrowserLaunchTime: `${this.getAverageBrowserLaunchTime()}ms`,
            averageNavigationTime: `${this.getAverageNavigationTime()}ms`,
            averageExtractionTime: `${this.getAverageExtractionTime()}ms`,
            
            // System metrics
            currentMemoryUsage: this.getCurrentMemoryUsage(),
            platform: this.metrics.platform,
            nodeVersion: this.metrics.nodeVersion,
            
            // Error breakdown
            errorCategories: this.metrics.errorCategories,
            recentErrors: this.metrics.errors.slice(-10),
            
            // Anti-bot metrics
            botDetectionEvents: this.metrics.botDetectionEvents,
            userAgentRotations: this.metrics.userAgentRotations,
            stealthModeActivations: this.metrics.stealthModeActivations,
            
            // Performance insights
            insights: this.generateInsights(),
            recommendations: this.generateRecommendations()
        };
    }

    /**
     * Generate performance insights
     */
    generateInsights() {
        const insights = [];
        
        // Analyze response time trends
        const recentResponseTimes = this.metrics.responseTimesMs.slice(-50);
        if (recentResponseTimes.length > 10) {
            const avgRecent = recentResponseTimes.reduce((sum, r) => sum + r.duration, 0) / recentResponseTimes.length;
            const allAvg = this.getAverageResponseTime();
            
            if (avgRecent > allAvg * 1.2) {
                insights.push('Response times are trending slower than average');
            } else if (avgRecent < allAvg * 0.8) {
                insights.push('Response times are trending faster than average');
            }
        }

        // Analyze error patterns
        const recentErrors = this.metrics.errors.filter(e => 
            Date.now() - e.timestamp < 30 * 60 * 1000 // Last 30 minutes
        );
        
        const errorsByCategory = {};
        recentErrors.forEach(error => {
            errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
        });
        
        const topErrorCategory = Object.keys(errorsByCategory)
            .reduce((a, b) => errorsByCategory[a] > errorsByCategory[b] ? a : b, null);
        
        if (topErrorCategory && errorsByCategory[topErrorCategory] > 3) {
            insights.push(`Most common recent error type: ${topErrorCategory} (${errorsByCategory[topErrorCategory]} occurrences)`);
        }

        return insights;
    }

    /**
     * Generate performance recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        
        // Memory recommendations
        const currentMemory = this.getCurrentMemoryUsage();
        if (currentMemory && currentMemory.heapUsedMB > 400) {
            recommendations.push('Consider implementing memory cleanup routines or reducing concurrent operations');
        }

        // Success rate recommendations
        const successRate = this.getSuccessRate();
        if (successRate < 70) {
            recommendations.push('Low success rate detected - consider reviewing anti-bot strategies or target website changes');
        }

        // Browser launch time recommendations
        const avgBrowserLaunch = this.getAverageBrowserLaunchTime();
        if (avgBrowserLaunch > 5000) {
            recommendations.push('Slow browser launch times - consider browser instance pooling or system optimization');
        }

        // Error pattern recommendations
        if (this.metrics.errorCategories.timeout > 10) {
            recommendations.push('High timeout errors - consider increasing timeout values or optimizing page load detection');
        }

        if (this.metrics.errorCategories.network > 5) {
            recommendations.push('Network errors detected - consider implementing additional retry mechanisms');
        }

        return recommendations;
    }

    /**
     * Export performance data to file
     */
    async exportPerformanceData(filename = null) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const exportFilename = filename || `performance-data-${timestamp}.json`;
            const filePath = path.join(__dirname, 'logs', exportFilename);

            // Ensure logs directory exists
            await fs.mkdir(path.dirname(filePath), { recursive: true });

            const exportData = {
                exportTimestamp: new Date().toISOString(),
                analytics: this.getAnalytics(),
                rawMetrics: {
                    responseTimesMs: this.metrics.responseTimesMs.slice(-100), // Last 100 requests
                    browserLaunchTimes: this.metrics.browserLaunchTimes,
                    navigationTimes: this.metrics.navigationTimes,
                    extractionTimes: this.metrics.extractionTimes,
                    memoryUsage: this.metrics.memoryUsage.slice(-50), // Last 50 memory readings
                    errors: this.metrics.errors.slice(-50) // Last 50 errors
                }
            };

            await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
            console.log(`📊 [Performance] Data exported to: ${filePath}`);
            return filePath;

        } catch (error) {
            console.error('❌ [Performance] Export failed:', error.message);
            throw error;
        }
    }

    // Helper methods
    getSuccessRate() {
        if (this.metrics.totalRequests === 0) return 0;
        return ((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(1);
    }

    getAverageResponseTime() {
        if (this.metrics.responseTimesMs.length === 0) return 0;
        return Math.round(
            this.metrics.responseTimesMs.reduce((sum, r) => sum + r.duration, 0) / this.metrics.responseTimesMs.length
        );
    }

    getAverageBrowserLaunchTime() {
        if (this.metrics.browserLaunchTimes.length === 0) return 0;
        return Math.round(
            this.metrics.browserLaunchTimes.reduce((sum, r) => sum + r.duration, 0) / this.metrics.browserLaunchTimes.length
        );
    }

    getAverageNavigationTime() {
        if (this.metrics.navigationTimes.length === 0) return 0;
        return Math.round(
            this.metrics.navigationTimes.reduce((sum, r) => sum + r.duration, 0) / this.metrics.navigationTimes.length
        );
    }

    getAverageExtractionTime() {
        if (this.metrics.extractionTimes.length === 0) return 0;
        return Math.round(
            this.metrics.extractionTimes.reduce((sum, r) => sum + r.duration, 0) / this.metrics.extractionTimes.length
        );
    }

    getCurrentMemoryUsage() {
        const memUsage = process.memoryUsage();
        return {
            rssGB: (memUsage.rss / 1024 / 1024 / 1024).toFixed(2),
            heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
            externalMB: Math.round(memUsage.external / 1024 / 1024)
        };
    }

    limitArraySize(array, maxSize) {
        if (array.length > maxSize) {
            array.splice(0, array.length - Math.floor(maxSize * 0.8));
        }
    }

    /**
     * Clean shutdown
     */
    shutdown() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        console.log('📊 [Performance] Monitoring stopped');
    }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

// Graceful shutdown
process.on('SIGINT', () => {
    performanceMonitor.shutdown();
});

process.on('SIGTERM', () => {
    performanceMonitor.shutdown();
});

module.exports = {
    PerformanceMonitor,
    performanceMonitor
};