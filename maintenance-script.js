/**
 * Maintenance Script for Adaptive Banner Extraction System
 * Performs periodic maintenance tasks:
 * - Pattern cleanup and optimization
 * - Configuration updates
 * - Performance analysis
 * - Backup and export operations
 */

const { APIPatternManager } = require('./api-pattern-manager');
const { AdaptiveConfigManager } = require('./adaptive-config-manager');
const fs = require('fs').promises;
const path = require('path');

class MaintenanceManager {
    constructor() {
        this.patternManager = new APIPatternManager();
        this.adaptiveConfig = new AdaptiveConfigManager();
        this.maintenanceLog = [];
    }

    /**
     * Run complete maintenance cycle
     */
    async runMaintenance(options = {}) {
        const startTime = Date.now();
        console.log('🔧 Starting maintenance cycle...\n');
        
        const maintenanceId = `maintenance_${Date.now()}`;
        this.logMaintenance(maintenanceId, 'started', 'Maintenance cycle initiated');

        try {
            // Initialize systems
            await this.initializeSystems();
            
            // Run maintenance tasks
            const tasks = [
                { name: 'Pattern Analysis', fn: () => this.analyzePatterns() },
                { name: 'Pattern Cleanup', fn: () => this.cleanupPatterns() },
                { name: 'Configuration Update', fn: () => this.updateConfigurations() },
                { name: 'Performance Analysis', fn: () => this.analyzePerformance() },
                { name: 'Backup Creation', fn: () => this.createBackups() },
                { name: 'Health Check', fn: () => this.performHealthCheck() }
            ];

            const results = {};
            
            for (const task of tasks) {
                if (options.skipTasks && options.skipTasks.includes(task.name)) {
                    console.log(`⏭️ Skipping ${task.name}...`);
                    continue;
                }
                
                console.log(`🔄 Running ${task.name}...`);
                try {
                    const taskResult = await task.fn();
                    results[task.name] = { success: true, result: taskResult };
                    console.log(`✅ ${task.name} completed`);
                } catch (error) {
                    results[task.name] = { success: false, error: error.message };
                    console.error(`❌ ${task.name} failed:`, error.message);
                    this.logMaintenance(maintenanceId, 'task_failed', `${task.name}: ${error.message}`);
                }
            }

            // Generate maintenance report
            const report = await this.generateMaintenanceReport(results, startTime);
            
            this.logMaintenance(maintenanceId, 'completed', 'Maintenance cycle completed successfully');
            
            return report;

        } catch (error) {
            console.error('❌ Maintenance cycle failed:', error);
            this.logMaintenance(maintenanceId, 'failed', error.message);
            throw error;
        }
    }

    /**
     * Initialize maintenance systems
     */
    async initializeSystems() {
        console.log('🚀 Initializing maintenance systems...');
        
        await this.patternManager.initialize();
        await this.adaptiveConfig.initialize();
        
        console.log('✅ Systems initialized');
    }

    /**
     * Analyze current patterns and their performance
     */
    async analyzePatterns() {
        console.log('📊 Analyzing API patterns...');
        
        const report = this.patternManager.generateReport();
        
        const analysis = {
            totalPatterns: report.summary.totalPatterns,
            successfulPatterns: report.summary.successfulPatterns,
            bannerPatterns: report.summary.bannerPatterns,
            overallSuccessRate: report.summary.overallSuccessRate,
            topPatterns: report.topPatterns,
            recommendations: report.recommendations
        };
        
        console.log(`📈 Pattern Analysis Results:`);
        console.log(`   Total Patterns: ${analysis.totalPatterns}`);
        console.log(`   Successful Patterns: ${analysis.successfulPatterns}`);
        console.log(`   Banner-Specific Patterns: ${analysis.bannerPatterns}`);
        console.log(`   Overall Success Rate: ${(analysis.overallSuccessRate * 100).toFixed(1)}%`);
        
        if (analysis.recommendations.length > 0) {
            console.log(`   Recommendations: ${analysis.recommendations.length} items`);
        }
        
        return analysis;
    }

    /**
     * Clean up old and unsuccessful patterns
     */
    async cleanupPatterns() {
        console.log('🧹 Cleaning up patterns...');
        
        const beforeReport = this.patternManager.generateReport();
        const beforeCount = beforeReport.summary.totalPatterns;
        
        await this.patternManager.cleanupPatterns();
        
        const afterReport = this.patternManager.generateReport();
        const afterCount = afterReport.summary.totalPatterns;
        
        const removedCount = beforeCount - afterCount;
        
        const result = {
            patternsRemoved: removedCount,
            patternsRemaining: afterCount,
            cleanupPerformed: removedCount > 0
        };
        
        if (removedCount > 0) {
            console.log(`🗑️ Removed ${removedCount} unsuccessful patterns`);
        } else {
            console.log(`✨ No patterns needed cleanup`);
        }
        
        return result;
    }

    /**
     * Update adaptive configurations
     */
    async updateConfigurations() {
        console.log('⚙️ Updating adaptive configurations...');
        
        await this.adaptiveConfig.updateConfigurations();
        
        const status = this.adaptiveConfig.getSystemStatus();
        
        const result = {
            configurationMode: status.adaptiveMode ? 'adaptive' : 'static',
            lastUpdate: status.lastConfigUpdate,
            cacheSize: status.cacheSize,
            healthStatus: status.health.status
        };
        
        console.log(`🔧 Configuration update completed`);
        console.log(`   Mode: ${result.configurationMode}`);
        console.log(`   Health: ${result.healthStatus}`);
        
        return result;
    }

    /**
     * Analyze system performance
     */
    async analyzePerformance() {
        console.log('📈 Analyzing system performance...');
        
        const systemStatus = this.adaptiveConfig.getSystemStatus();
        const patternReport = this.patternManager.generateReport();
        
        const performance = {
            systemHealth: systemStatus.health.status,
            successRate: systemStatus.health.successRate,
            totalPatterns: systemStatus.patternSummary.totalPatterns,
            bannerPatterns: systemStatus.patternSummary.bannerPatterns,
            adaptiveMode: systemStatus.adaptiveMode,
            recommendations: systemStatus.recommendations.length,
            
            // Performance metrics
            patternEfficiency: patternReport.summary.successfulPatterns / patternReport.summary.totalPatterns,
            bannerPatternRatio: patternReport.summary.bannerPatterns / patternReport.summary.totalPatterns,
            
            // Health indicators
            needsAttention: systemStatus.health.status === 'degraded' || 
                           systemStatus.recommendations.length > 3,
            
            performanceGrade: this.calculatePerformanceGrade(systemStatus, patternReport)
        };
        
        console.log(`📊 Performance Analysis:`);
        console.log(`   System Health: ${performance.systemHealth}`);
        console.log(`   Success Rate: ${performance.successRate}`);
        console.log(`   Pattern Efficiency: ${(performance.patternEfficiency * 100).toFixed(1)}%`);
        console.log(`   Performance Grade: ${performance.performanceGrade}`);
        
        if (performance.needsAttention) {
            console.log(`⚠️ System needs attention`);
        }
        
        return performance;
    }

    /**
     * Calculate performance grade
     */
    calculatePerformanceGrade(systemStatus, patternReport) {
        const successRate = parseFloat(systemStatus.health.successRate) / 100;
        const patternEfficiency = patternReport.summary.successfulPatterns / patternReport.summary.totalPatterns;
        const bannerRatio = patternReport.summary.bannerPatterns / patternReport.summary.totalPatterns;
        
        const score = (successRate * 0.5) + (patternEfficiency * 0.3) + (bannerRatio * 0.2);
        
        if (score >= 0.9) return 'A+';
        if (score >= 0.8) return 'A';
        if (score >= 0.7) return 'B+';
        if (score >= 0.6) return 'B';
        if (score >= 0.5) return 'C+';
        if (score >= 0.4) return 'C';
        return 'D';
    }

    /**
     * Create backups of patterns and configurations
     */
    async createBackups() {
        console.log('💾 Creating backups...');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, 'backups', timestamp);
        
        try {
            await fs.mkdir(backupDir, { recursive: true });
            
            // Export patterns
            const patternsFile = await this.patternManager.exportPatterns(
                path.join(backupDir, 'api-patterns.json')
            );
            
            // Export configurations
            const configFile = await this.adaptiveConfig.exportConfigurations();
            await fs.rename(configFile, path.join(backupDir, 'adaptive-config.json'));
            
            // Create maintenance log backup
            const maintenanceLogFile = path.join(backupDir, 'maintenance-log.json');
            await fs.writeFile(maintenanceLogFile, JSON.stringify(this.maintenanceLog, null, 2));
            
            const result = {
                backupDirectory: backupDir,
                files: ['api-patterns.json', 'adaptive-config.json', 'maintenance-log.json'],
                timestamp
            };
            
            console.log(`💾 Backup created: ${backupDir}`);
            
            return result;
            
        } catch (error) {
            console.error('❌ Backup creation failed:', error.message);
            throw error;
        }
    }

    /**
     * Perform system health check
     */
    async performHealthCheck() {
        console.log('🏥 Performing health check...');
        
        const systemStatus = this.adaptiveConfig.getSystemStatus();
        const patternReport = this.patternManager.generateReport();
        
        const healthCheck = {
            timestamp: new Date().toISOString(),
            overall: 'healthy',
            issues: [],
            warnings: [],
            recommendations: []
        };
        
        // Check system health
        if (systemStatus.health.status === 'degraded') {
            healthCheck.issues.push('System health is degraded');
            healthCheck.overall = 'degraded';
        }
        
        // Check success rate
        const successRate = parseFloat(systemStatus.health.successRate) / 100;
        if (successRate < 0.5) {
            healthCheck.issues.push(`Low success rate: ${systemStatus.health.successRate}`);
            healthCheck.overall = 'critical';
        } else if (successRate < 0.7) {
            healthCheck.warnings.push(`Moderate success rate: ${systemStatus.health.successRate}`);
            if (healthCheck.overall === 'healthy') healthCheck.overall = 'warning';
        }
        
        // Check pattern count
        if (patternReport.summary.totalPatterns < 5) {
            healthCheck.warnings.push('Low number of learned patterns');
            if (healthCheck.overall === 'healthy') healthCheck.overall = 'warning';
        }
        
        // Check banner patterns
        if (patternReport.summary.bannerPatterns === 0) {
            healthCheck.issues.push('No banner-specific patterns discovered');
            healthCheck.overall = 'degraded';
        }
        
        // Add system recommendations
        healthCheck.recommendations = systemStatus.recommendations.map(r => r.message);
        
        console.log(`🏥 Health Check Results:`);
        console.log(`   Overall Status: ${healthCheck.overall.toUpperCase()}`);
        console.log(`   Issues: ${healthCheck.issues.length}`);
        console.log(`   Warnings: ${healthCheck.warnings.length}`);
        console.log(`   Recommendations: ${healthCheck.recommendations.length}`);
        
        return healthCheck;
    }

    /**
     * Generate comprehensive maintenance report
     */
    async generateMaintenanceReport(taskResults, startTime) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const report = {
            metadata: {
                timestamp: new Date().toISOString(),
                duration: `${Math.round(duration / 1000)}s`,
                version: '1.0.0'
            },
            summary: {
                tasksRun: Object.keys(taskResults).length,
                tasksSuccessful: Object.values(taskResults).filter(r => r.success).length,
                tasksFailed: Object.values(taskResults).filter(r => !r.success).length
            },
            taskResults,
            systemStatus: this.adaptiveConfig.getSystemStatus(),
            recommendations: []
        };
        
        // Generate recommendations based on results
        if (report.summary.tasksFailed > 0) {
            report.recommendations.push('Review failed maintenance tasks and address underlying issues');
        }
        
        if (taskResults['Performance Analysis']?.result?.needsAttention) {
            report.recommendations.push('System performance needs attention - review patterns and configurations');
        }
        
        if (taskResults['Health Check']?.result?.overall !== 'healthy') {
            report.recommendations.push('System health check indicates issues - review health check details');
        }
        
        // Save report
        const reportFile = `maintenance-report-${Date.now()}.json`;
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
        
        console.log('\n📋 Maintenance Report Generated:');
        console.log(`   Duration: ${report.metadata.duration}`);
        console.log(`   Tasks: ${report.summary.tasksSuccessful}/${report.summary.tasksRun} successful`);
        console.log(`   Report saved: ${reportFile}`);
        
        if (report.recommendations.length > 0) {
            console.log('\n💡 Maintenance Recommendations:');
            report.recommendations.forEach(rec => {
                console.log(`   • ${rec}`);
            });
        }
        
        return report;
    }

    /**
     * Log maintenance activities
     */
    logMaintenance(id, type, message) {
        const logEntry = {
            id,
            timestamp: new Date().toISOString(),
            type,
            message
        };
        
        this.maintenanceLog.push(logEntry);
        
        // Keep only last 1000 entries
        if (this.maintenanceLog.length > 1000) {
            this.maintenanceLog = this.maintenanceLog.slice(-1000);
        }
    }
}

/**
 * CLI interface for maintenance script
 */
async function runMaintenanceCLI() {
    const args = process.argv.slice(2);
    const options = {};
    
    // Parse command line arguments
    if (args.includes('--skip-cleanup')) {
        options.skipTasks = (options.skipTasks || []).concat(['Pattern Cleanup']);
    }
    
    if (args.includes('--skip-backup')) {
        options.skipTasks = (options.skipTasks || []).concat(['Backup Creation']);
    }
    
    if (args.includes('--analysis-only')) {
        options.skipTasks = ['Pattern Cleanup', 'Configuration Update', 'Backup Creation'];
    }
    
    const maintenance = new MaintenanceManager();
    
    try {
        const report = await maintenance.runMaintenance(options);
        
        console.log('\n✅ Maintenance completed successfully!');
        
        if (report.summary.tasksFailed > 0) {
            console.log(`⚠️ ${report.summary.tasksFailed} tasks failed - check the report for details`);
            process.exit(1);
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Maintenance failed:', error.message);
        process.exit(1);
    }
}

// Run maintenance if called directly
if (require.main === module) {
    runMaintenanceCLI();
}

module.exports = { MaintenanceManager };