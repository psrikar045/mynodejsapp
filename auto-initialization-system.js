/**
 * Auto-Initialization System
 * Handles automatic system setup, health checks, and component initialization
 */

const fs = require('fs').promises;
const path = require('path');
const { sanitizeForLogging, sanitizeUrl, sanitizeObjectForLogging } = require('./utils/input-sanitizer');

class AutoInitializationSystem {
    constructor() {
        this.environment = process.env.NODE_ENV || 'development';
        this.verboseLogging = process.env.VERBOSE_LOGGING === 'true';
        this.adaptiveMode = process.env.ADAPTIVE_MODE !== 'false';
        this.initializationSteps = [];
        this.startTime = Date.now();
    }

    /**
     * Main initialization process
     */
    async initialize() {
        console.log('🚀 LinkedIn Banner Extraction System - Auto-Initialization');
        console.log('=' .repeat(65));
        console.log(`📊 Environment: ${this.environment.toUpperCase()}`);
        console.log(`🔧 Adaptive Mode: ${this.adaptiveMode ? 'ENABLED' : 'DISABLED'}`);
        console.log(`📝 Verbose Logging: ${this.verboseLogging ? 'ENABLED' : 'DISABLED'}`);
        console.log('=' .repeat(65));

        try {
            // Step 1: System Health Check
            await this.runInitializationStep('System Health Check', () => this.performHealthCheck());

            // Step 2: Dependency Validation
            await this.runInitializationStep('Dependency Validation', () => this.validateDependencies());

            // Step 3: Auto-Deploy Adaptive System
            await this.runInitializationStep('Adaptive System Deployment', () => this.deployAdaptiveSystem());

            // Step 4: Component Initialization
            await this.runInitializationStep('Component Initialization', () => this.initializeComponents());

            // Step 5: Background Services Setup
            await this.runInitializationStep('Background Services', () => this.setupBackgroundServices());

            // Step 6: Final Validation
            await this.runInitializationStep('Final Validation', () => this.performFinalValidation());

            // Initialization Complete
            const totalTime = Date.now() - this.startTime;
            console.log('\n' + '='.repeat(65));
            console.log('✅ AUTO-INITIALIZATION COMPLETED SUCCESSFULLY');
            console.log('='.repeat(65));
            console.log(`⏱️  Total Time: ${Math.round(totalTime / 1000)}s`);
            console.log(`📊 Steps Completed: ${this.initializationSteps.filter(s => s.success).length}/${this.initializationSteps.length}`);
            console.log('🎉 System is ready for production use!');
            console.log('='.repeat(65));

            return {
                success: true,
                totalTime,
                steps: this.initializationSteps
            };

        } catch (error) {
            console.error('\n❌ AUTO-INITIALIZATION FAILED');
            console.error('Error:', error.message);
            console.error('\n🔧 Attempting fallback initialization...');
            
            return await this.fallbackInitialization();
        }
    }

    /**
     * Run a single initialization step with error handling
     */
    async runInitializationStep(stepName, stepFunction) {
        const stepStartTime = Date.now();
        console.log(`\n🔄 ${stepName}...`);

        try {
            const result = await stepFunction();
            const stepDuration = Date.now() - stepStartTime;
            
            this.initializationSteps.push({
                name: stepName,
                success: true,
                duration: stepDuration,
                result
            });

            console.log(`✅ ${stepName}: COMPLETED (${stepDuration}ms)`);
            
            if (result && typeof result === 'object' && result.details) {
                console.log(`   ${result.details}`);
            }

        } catch (error) {
            const stepDuration = Date.now() - stepStartTime;
            
            this.initializationSteps.push({
                name: stepName,
                success: false,
                duration: stepDuration,
                error: error.message
            });

            console.error(`❌ ${stepName}: FAILED (${stepDuration}ms)`);
            console.error(`   Error: ${error.message}`);
            
            // Determine if this is a critical failure
            if (this.isCriticalStep(stepName)) {
                throw error;
            } else {
                console.warn( sanitizeForLogging(stepName),` ⚠️failed but continuing with fallback...`);
            }
        }
    }

    /**
     * Check if a step is critical for system operation
     */
    isCriticalStep(stepName) {
        const criticalSteps = [
            'System Health Check',
            'Dependency Validation'
        ];
        return criticalSteps.includes(stepName);
    }

    /**
     * Perform system health check
     */
    async performHealthCheck() {
        const health = {
            nodeVersion: process.version,
            platform: process.platform,
            memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            uptime: Math.round(process.uptime()),
            environment: this.environment
        };

        // Check Node.js version
        const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
        if (nodeVersion < 18) {
            throw new Error(`Node.js 18+ required, found ${process.version}`);
        }

        // Check available memory
        const totalMemory = Math.round(process.memoryUsage().heapTotal / 1024 / 1024);
        if (totalMemory < 100) {
            console.warn('⚠️  Low memory available, performance may be affected');
        }

        // Check disk space
        try {
            await fs.access('.', fs.constants.W_OK);
        } catch (error) {
            throw new Error('No write permission in current directory');
        }

        // Check browser availability
        const browserStatus = await this.checkBrowserAvailability();
        health.browserAvailable = browserStatus.available;
        health.browserPath = browserStatus.path;

        return {
            details: `Node.js ${health.nodeVersion}, Memory: ${health.memory}MB, Platform: ${health.platform}, Browser: ${browserStatus.available ? '✅' : '⚠️'}`,
            health
        };
    }

    /**
     * Check browser availability
     */
    async checkBrowserAvailability() {
        const fs = require('fs');
        
        // Browser paths to check (Edge first, then Chrome)
        const browserPaths = [
            '/usr/bin/microsoft-edge',           // Microsoft Edge (production)
            '/opt/microsoft/msedge/msedge',      // Alternative Edge path
            '/usr/bin/google-chrome-stable',     // Chrome stable
            '/usr/bin/google-chrome',            // Chrome
            '/usr/bin/chromium-browser',         // Chromium browser
            '/usr/bin/chromium',                 // Chromium
            // Windows paths
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            // Mac paths
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        ];

        for (const browserPath of browserPaths) {
            try {
                if (fs.existsSync(browserPath)) {
                    return {
                        available: true,
                        path: browserPath,
                        type: browserPath.includes('edge') || browserPath.includes('Edge') ? 'Microsoft Edge' : 'Chrome/Chromium'
                    };
                }
            } catch (error) {
                // Continue checking other paths
            }
        }

        // Check if Puppeteer bundled browser is available
        try {
            const puppeteer = require('puppeteer');
            const executablePath = puppeteer.executablePath();
            if (executablePath && fs.existsSync(executablePath)) {
                return {
                    available: true,
                    path: executablePath,
                    type: 'Puppeteer Bundled Chromium'
                };
            }
        } catch (error) {
            // Puppeteer not available or no bundled browser
        }

        return {
            available: false,
            path: null,
            type: 'None'
        };
    }

    /**
     * Validate required dependencies
     */
    async validateDependencies() {
        const requiredModules = [
            'puppeteer',
            'express',
            'axios',
            'cheerio',
            'cors'
        ];

        const moduleStatus = {};
        let missingModules = [];

        for (const module of requiredModules) {
            try {
                require(module);
                moduleStatus[module] = 'available';
            } catch (error) {
                moduleStatus[module] = 'missing';
                missingModules.push(module);
            }
        }

        if (missingModules.length > 0) {
            throw new Error(`Missing required modules: ${missingModules.join(', ')}. Run 'npm install' to install dependencies.`);
        }

        // Check if main application files exist
        const requiredFiles = [
            'linkedin-banner-extractor.js',
            'banner-validator.js',
            'anti-bot-system.js',
            'banner-extraction-config.js'
        ];

        for (const file of requiredFiles) {
            try {
                await fs.access(file);
            } catch (error) {
                throw new Error(`Required file missing: ${file}`);
            }
        }

        return {
            details: `All ${requiredModules.length} dependencies validated`,
            moduleStatus,
            filesValidated: requiredFiles.length
        };
    }

    /**
     * Deploy adaptive system if needed
     */
    async deployAdaptiveSystem() {
        try {
            // Check if adaptive system is already deployed
            const adaptiveFiles = [
                'api-pattern-manager.js',
                'adaptive-config-manager.js'
            ];

            let needsDeployment = false;
            for (const file of adaptiveFiles) {
                try {
                    await fs.access(file);
                } catch (error) {
                    needsDeployment = true;
                    break;
                }
            }

            if (!needsDeployment && !this.adaptiveMode) {
                return {
                    details: 'Adaptive system disabled by configuration',
                    deployed: false,
                    reason: 'disabled'
                };
            }

            if (!needsDeployment) {
                // Check if pattern database exists
                try {
                    await fs.access('api-patterns-database.json');
                    return {
                        details: 'Adaptive system already deployed and configured',
                        deployed: true,
                        reason: 'already_exists'
                    };
                } catch (error) {
                    needsDeployment = true;
                }
            }

            if (needsDeployment) {
                console.log('   📦 Deploying adaptive system components...');
                
                // Import and run deployment
                const { DeploymentManager } = require('./deploy-adaptive-system');
                const deployment = new DeploymentManager();
                
                await deployment.deploy({ 
                    skipBackup: true,  // Skip backup on initial deployment
                    skipRollback: true // Don't rollback on first deployment
                });

                return {
                    details: 'Adaptive system deployed successfully',
                    deployed: true,
                    reason: 'new_deployment'
                };
            }

        } catch (error) {
            if (this.adaptiveMode) {
                console.warn('⚠️  Adaptive system deployment failed, using static configuration');
                return {
                    details: 'Using static configuration (adaptive system unavailable)',
                    deployed: false,
                    reason: 'deployment_failed',
                    error: error.message
                };
            } else {
                return {
                    details: 'Static configuration mode (adaptive system disabled)',
                    deployed: false,
                    reason: 'disabled'
                };
            }
        }
    }

    /**
     * Initialize system components
     */
    async initializeComponents() {
        const components = [];

        try {
            // Initialize anti-bot system
            const { antiBotSystem } = require('./anti-bot-system');
            components.push('Anti-Bot System');

            // Initialize LinkedIn-specific anti-bot
            const { LinkedInImageAntiBotSystem } = require('./linkedin-image-anti-bot');
            const linkedinAntiBot = new LinkedInImageAntiBotSystem();
            components.push('LinkedIn Anti-Bot System');

            // Initialize banner extractor
            const { LinkedInBannerExtractor } = require('./linkedin-banner-extractor');
            const bannerExtractor = new LinkedInBannerExtractor(linkedinAntiBot);
            components.push('Banner Extractor');

            // Initialize banner validator
            const { BannerValidator } = require('./banner-validator');
            const bannerValidator = new BannerValidator(linkedinAntiBot);
            components.push('Banner Validator');

            // Initialize adaptive system (if available)
            if (this.adaptiveMode) {
                try {
                    const { AdaptiveConfigManager } = require('./adaptive-config-manager');
                    const adaptiveConfig = new AdaptiveConfigManager();
                    await adaptiveConfig.initialize();
                    components.push('Adaptive Configuration Manager');

                    const { APIPatternManager } = require('./api-pattern-manager');
                    const patternManager = new APIPatternManager();
                    await patternManager.initialize();
                    components.push('API Pattern Manager');
                } catch (error) {
                    console.warn('⚠️  Adaptive components not available, using static configuration');
                }
            }

        } catch (error) {
            throw new Error(`Component initialization failed: ${error.message}`);
        }

        return {
            details: `${components.length} components initialized successfully`,
            components
        };
    }

    /**
     * Setup background services
     */
    async setupBackgroundServices() {
        const services = [];

        try {
            // Schedule maintenance if in production
            if (this.environment === 'production') {
                this.scheduleMaintenanceTasks();
                services.push('Maintenance Scheduler');
            }

            // Setup health monitoring
            this.setupHealthMonitoring();
            services.push('Health Monitor');

            // Setup log rotation (if needed)
            if (this.environment === 'production') {
                this.setupLogRotation();
                services.push('Log Rotation');
            }

        } catch (error) {
            console.warn('⚠️  Some background services failed to start:', error.message);
        }

        return {
            details: `${services.length} background services configured`,
            services
        };
    }

    /**
     * Schedule maintenance tasks
     */
    scheduleMaintenanceTasks() {
        // Schedule daily maintenance at 2 AM (production)
        const maintenanceInterval = this.environment === 'production' ? 
            24 * 60 * 60 * 1000 : // 24 hours for production
            6 * 60 * 60 * 1000;   // 6 hours for development

        setTimeout(async () => {
            try {
                console.log('🔧 Running scheduled maintenance...');
                const { MaintenanceManager } = require('./maintenance-script');
                const maintenance = new MaintenanceManager();
                await maintenance.runMaintenance({ skipTasks: ['Backup Creation'] });
                
                // Schedule next maintenance
                this.scheduleMaintenanceTasks();
            } catch (error) {
                console.error('❌ Scheduled maintenance failed:', error.message);
            }
        }, maintenanceInterval);

        console.log(`   📅 Maintenance scheduled every ${Math.round(maintenanceInterval / (60 * 60 * 1000))} hours`);
    }

    /**
     * Setup health monitoring
     */
    setupHealthMonitoring() {
        // Health check every 30 minutes
        setInterval(async () => {
            try {
                if (this.adaptiveMode) {
                    const { AdaptiveConfigManager } = require('./adaptive-config-manager');
                    const adaptiveConfig = new AdaptiveConfigManager();
                    await adaptiveConfig.initialize();
                    
                    const status = adaptiveConfig.getSystemStatus();
                    if (status.health.status === 'critical') {
                        console.warn('⚠️  System health is critical - consider running maintenance');
                    }
                }
            } catch (error) {
                // Health monitoring is non-critical
                if (this.verboseLogging) {
                    console.warn('Health monitoring check failed:', error.message);
                }
            }
        }, 30 * 60 * 1000); // 30 minutes

        console.log('   💓 Health monitoring active (30-minute intervals)');
    }

    /**
     * Setup log rotation
     */
    setupLogRotation() {
        // Simple log rotation - keep logs under 10MB
        setInterval(async () => {
            try {
                const logFile = 'scraper.log';
                const stats = await fs.stat(logFile).catch(() => null);
                
                if (stats && stats.size > 10 * 1024 * 1024) { // 10MB
                    const backupFile = `scraper.log.${Date.now()}`;
                    await fs.rename(logFile, backupFile);
                    console.log(`📋 Log rotated: ${backupFile}`);
                }
            } catch (error) {
                // Log rotation is non-critical
                if (this.verboseLogging) {
                    console.warn('Log rotation failed:', error.message);
                }
            }
        }, 60 * 60 * 1000); // 1 hour

        console.log('   📋 Log rotation configured (10MB limit)');
    }

    /**
     * Perform final validation
     */
    async performFinalValidation() {
        const validations = [];

        try {
            // Test banner extractor initialization
            const { LinkedInImageAntiBotSystem } = require('./linkedin-image-anti-bot');
            const { LinkedInBannerExtractor } = require('./linkedin-banner-extractor');
            
            const linkedinAntiBot = new LinkedInImageAntiBotSystem();
            const bannerExtractor = new LinkedInBannerExtractor(linkedinAntiBot);
            
            validations.push('Banner Extractor Ready');

            // Test configuration loading
            const { getConfig } = require('./banner-extraction-config');
            const config = getConfig('networkPatterns');
            
            if (!config) {
                throw new Error('Configuration loading failed');
            }
            
            validations.push('Configuration System Ready');

            // Test adaptive system (if enabled)
            if (this.adaptiveMode) {
                try {
                    const { AdaptiveConfigManager } = require('./adaptive-config-manager');
                    const adaptiveConfig = new AdaptiveConfigManager();
                    await adaptiveConfig.initialize();
                    
                    validations.push('Adaptive System Ready');
                } catch (error) {
                    validations.push('Static Configuration Ready (Adaptive Unavailable)');
                }
            } else {
                validations.push('Static Configuration Ready');
            }

        } catch (error) {
            throw new Error(`Final validation failed: ${error.message}`);
        }

        return {
            details: `${validations.length} validation checks passed`,
            validations
        };
    }

    /**
     * Fallback initialization for critical failures
     */
    async fallbackInitialization() {
        console.log('🔄 Running fallback initialization...');
        
        try {
            // Disable adaptive mode for fallback
            this.adaptiveMode = false;
            
            // Basic component initialization
            await this.initializeComponents();
            
            console.log('✅ Fallback initialization completed');
            console.log('⚠️  System running in limited mode (adaptive features disabled)');
            
            return {
                success: true,
                fallback: true,
                adaptiveMode: false
            };
            
        } catch (error) {
            console.error('❌ Fallback initialization also failed:', error.message);
            console.error('🚨 System cannot start - please check configuration and dependencies');
            
            return {
                success: false,
                fallback: true,
                error: error.message
            };
        }
    }

    /**
     * Get initialization summary
     */
    getSummary() {
        return {
            environment: this.environment,
            adaptiveMode: this.adaptiveMode,
            verboseLogging: this.verboseLogging,
            totalSteps: this.initializationSteps.length,
            successfulSteps: this.initializationSteps.filter(s => s.success).length,
            failedSteps: this.initializationSteps.filter(s => !s.success).length,
            totalTime: Date.now() - this.startTime,
            steps: this.initializationSteps
        };
    }
}

module.exports = { AutoInitializationSystem };