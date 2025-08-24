const fs = require('fs').promises;
const path = require('path');
const { MaintenanceManager } = require('./maintenance-script');
const { AdaptiveConfigManager } = require('./adaptive-config-manager');
const { APIPatternManager } = require('./api-pattern-manager');

/**
 * Deployment Script for Adaptive Banner Extraction System
 * Handles deployment, configuration sync, and system updates
 */

class DeploymentManager {
    constructor() {
        this.environment = process.env.NODE_ENV || 'development';
        this.deploymentId = `deploy_${Date.now()}`;
        this.backupDir = path.join(__dirname, 'deployment-backups', this.deploymentId);
    }

    /**
     * Deploy adaptive system updates
     */
    async deploy(options = {}) {
        console.log(`🚀 Starting deployment for ${this.environment} environment...`);
        console.log(`📋 Deployment ID: ${this.deploymentId}\n`);

        try {
            // Pre-deployment checks
            await this.preDeploymentChecks();
            
            // Create backup
            if (!options.skipBackup) {
                await this.createDeploymentBackup();
            }
            
            // Deploy components
            await this.deployAdaptiveSystem();
            
            // Post-deployment validation
            await this.postDeploymentValidation();
            
            // Generate deployment report
            const report = await this.generateDeploymentReport();
            
            console.log('\n✅ Deployment completed successfully!');
            return report;
            
        } catch (error) {
            console.error('\n❌ Deployment failed:', error.message);
            
            if (!options.skipRollback) {
                console.log('🔄 Attempting rollback...');
                await this.rollback();
            }
            
            throw error;
        }
    }

    /**
     * Pre-deployment system checks
     */
    async preDeploymentChecks() {
        console.log('🔍 Running pre-deployment checks...');
        
        // Check if required files exist
        const requiredFiles = [
            'api-pattern-manager.js',
            'adaptive-config-manager.js',
            'linkedin-banner-extractor.js',
            'banner-validator.js',
            'banner-extraction-config.js'
        ];
        
        for (const file of requiredFiles) {
            try {
                await fs.access(path.join(__dirname, file));
            } catch (error) {
                throw new Error(`Required file missing: ${file}`);
            }
        }
        
        // Check system health
        try {
            const adaptiveConfig = new AdaptiveConfigManager();
            await adaptiveConfig.initialize();
            
            const status = adaptiveConfig.getSystemStatus();
            if (status.health.status === 'critical') {
                throw new Error('System health is critical - deployment aborted');
            }
            
            console.log(`✅ System health: ${status.health.status}`);
            
        } catch (error) {
            console.warn('⚠️ Could not check system health:', error.message);
        }
        
        console.log('✅ Pre-deployment checks passed');
    }

    /**
     * Create deployment backup
     */
    async createDeploymentBackup() {
        console.log('💾 Creating deployment backup...');
        
        await fs.mkdir(this.backupDir, { recursive: true });
        
        // Backup current patterns and configurations
        const filesToBackup = [
            'api-patterns-database.json',
            'api-patterns-backup.json',
            'banner-extraction-config.js'
        ];
        
        for (const file of filesToBackup) {
            const sourcePath = path.join(__dirname, file);
            const backupPath = path.join(this.backupDir, file);
            
            try {
                await fs.copyFile(sourcePath, backupPath);
                console.log(`📁 Backed up: ${file}`);
            } catch (error) {
                console.warn(`⚠️ Could not backup ${file}:`, error.message);
            }
        }
        
        // Create deployment metadata
        const metadata = {
            deploymentId: this.deploymentId,
            timestamp: new Date().toISOString(),
            environment: this.environment,
            backupLocation: this.backupDir
        };
        
        await fs.writeFile(
            path.join(this.backupDir, 'deployment-metadata.json'),
            JSON.stringify(metadata, null, 2)
        );
        
        console.log(`✅ Backup created: ${this.backupDir}`);
    }

    /**
     * Deploy adaptive system components
     */
    async deployAdaptiveSystem() {
        console.log('🔧 Deploying adaptive system components...');
        
        // Initialize or update pattern database
        await this.initializePatternDatabase();
        
        // Update configurations for environment
        await this.updateEnvironmentConfigurations();
        
        // Run initial maintenance
        await this.runInitialMaintenance();
        
        console.log('✅ Adaptive system deployed');
    }

    /**
     * Initialize or update pattern database
     */
    async initializePatternDatabase() {
        console.log('📊 Initializing pattern database...');
        
        const patternManager = new APIPatternManager();
        
        await patternManager.initialize();
        
        // Import any existing patterns from backup or external source
        const importFile = path.join(__dirname, 'pattern-import.json');
        try {
            await fs.access(importFile);
            await patternManager.importPatterns(importFile);
            console.log('📥 Imported external patterns');
        } catch (error) {
            console.log('📊 Using default pattern database');
        }
        
        console.log('✅ Pattern database initialized');
    }

    /**
     * Update configurations for current environment
     */
    async updateEnvironmentConfigurations() {
        console.log(`⚙️ Updating configurations for ${this.environment}...`);
        
        const adaptiveConfig = new AdaptiveConfigManager();
        await adaptiveConfig.initialize();
        
        // Update configurations based on environment
        await adaptiveConfig.updateConfigurations();
        
        // Export current configurations for reference
        const configExport = await adaptiveConfig.exportConfigurations();
        console.log(`📤 Configurations exported: ${configExport}`);
        
        console.log('✅ Environment configurations updated');
    }

    /**
     * Run initial maintenance after deployment
     */
    async runInitialMaintenance() {
        console.log('🔧 Running initial maintenance...');
        
        const maintenance = new MaintenanceManager();
        
        // Run maintenance with deployment-specific options
        const maintenanceOptions = {
            skipTasks: ['Backup Creation'] // We already created deployment backup
        };
        
        await maintenance.runMaintenance(maintenanceOptions);
        
        console.log('✅ Initial maintenance completed');
    }

    /**
     * Post-deployment validation
     */
    async postDeploymentValidation() {
        console.log('🔍 Running post-deployment validation...');
        
        // Test adaptive configuration system
        try {
            const adaptiveConfig = new AdaptiveConfigManager();
            await adaptiveConfig.initialize();
            
            const status = adaptiveConfig.getSystemStatus();
            
            if (!status.adaptiveMode) {
                throw new Error('Adaptive mode not enabled after deployment');
            }
            
            console.log(`✅ Adaptive system status: ${status.health.status}`);
            
        } catch (error) {
            throw new Error(`Post-deployment validation failed: ${error.message}`);
        }
        
        // Test pattern manager
        try {
            const patternManager = new APIPatternManager();
            await patternManager.initialize();
            
            const report = patternManager.generateReport();
            console.log(`✅ Pattern database: ${report.summary.totalPatterns} patterns loaded`);
            
        } catch (error) {
            throw new Error(`Pattern manager validation failed: ${error.message}`);
        }
        
        console.log('✅ Post-deployment validation passed');
    }

    /**
     * Generate deployment report
     */
    async generateDeploymentReport() {
        const report = {
            deploymentId: this.deploymentId,
            timestamp: new Date().toISOString(),
            environment: this.environment,
            status: 'success',
            components: {
                patternManager: 'deployed',
                adaptiveConfig: 'deployed',
                bannerExtractor: 'updated',
                maintenance: 'completed'
            },
            backupLocation: this.backupDir,
            validationResults: 'passed'
        };
        
        // Get system status after deployment
        try {
            const adaptiveConfig = new AdaptiveConfigManager();
            await adaptiveConfig.initialize();
            report.systemStatus = adaptiveConfig.getSystemStatus();
        } catch (error) {
            report.systemStatusError = error.message;
        }
        
        // Save deployment report
        const reportFile = `deployment-report-${this.deploymentId}.json`;
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
        
        console.log(`📋 Deployment report saved: ${reportFile}`);
        
        return report;
    }

    /**
     * Rollback deployment
     */
    async rollback() {
        console.log('🔄 Rolling back deployment...');
        
        try {
            // Restore backed up files
            const backupFiles = await fs.readdir(this.backupDir);
            
            for (const file of backupFiles) {
                if (file === 'deployment-metadata.json') continue;
                
                const backupPath = path.join(this.backupDir, file);
                const restorePath = path.join(__dirname, file);
                
                try {
                    await fs.copyFile(backupPath, restorePath);
                    console.log(`🔄 Restored: ${file}`);
                } catch (error) {
                    console.warn(`⚠️ Could not restore ${file}:`, error.message);
                }
            }
            
            console.log('✅ Rollback completed');
            
        } catch (error) {
            console.error('❌ Rollback failed:', error.message);
            throw error;
        }
    }

    /**
     * Schedule automatic maintenance
     */
    async scheduleMaintenanceTask() {
        console.log('⏰ Setting up automatic maintenance schedule...');
        
        // This would typically integrate with system cron or task scheduler
        const maintenanceConfig = {
            schedule: this.environment === 'production' ? '0 2 * * *' : '0 */6 * * *', // Daily at 2AM for prod, every 6 hours for dev
            tasks: ['Pattern Analysis', 'Pattern Cleanup', 'Configuration Update', 'Health Check'],
            notifications: true
        };
        
        await fs.writeFile(
            'maintenance-schedule.json',
            JSON.stringify(maintenanceConfig, null, 2)
        );
        
        console.log(`✅ Maintenance scheduled: ${maintenanceConfig.schedule}`);
        
        return maintenanceConfig;
    }
}

/**
 * CLI interface for deployment
 */
async function runDeploymentCLI() {
    const args = process.argv.slice(2);
    const options = {};
    
    if (args.includes('--skip-backup')) {
        options.skipBackup = true;
    }
    
    if (args.includes('--skip-rollback')) {
        options.skipRollback = true;
    }
    
    const deployment = new DeploymentManager();
    
    try {
        const report = await deployment.deploy(options);
        
        // Schedule maintenance if requested
        if (args.includes('--schedule-maintenance')) {
            await deployment.scheduleMaintenanceTask();
        }
        
        console.log('\n🎉 Deployment successful!');
        console.log(`📊 System Status: ${report.systemStatus?.health?.status || 'Unknown'}`);
        console.log(`📋 Report: deployment-report-${deployment.deploymentId}.json`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n💥 Deployment failed:', error.message);
        process.exit(1);
    }
}

// Run deployment if called directly
if (require.main === module) {
    runDeploymentCLI();
}

module.exports = { DeploymentManager };