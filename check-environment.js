#!/usr/bin/env node

const fs = require('fs');
const os = require('os');

/**
 * Environment Configuration Checker
 * Displays current environment settings and provides setup guidance
 */

class EnvironmentChecker {
    constructor() {
        this.environment = process.env.NODE_ENV || 'development';
        this.isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
    }

    checkEnvironment() {
        console.log('🌍 Environment Configuration Check');
        console.log('='.repeat(40));
        console.log('');

        // Basic environment info
        this.displayBasicInfo();
        console.log('');

        // Environment variables
        this.displayEnvironmentVariables();
        console.log('');

        // Production indicators
        this.displayProductionIndicators();
        console.log('');

        // Browser configuration
        this.displayBrowserConfiguration();
        console.log('');

        // Configuration files
        this.displayConfigurationFiles();
        console.log('');

        // Recommendations
        this.displayRecommendations();
    }

    displayBasicInfo() {
        console.log('📊 Basic Information:');
        console.log(`   Environment: ${this.environment}`);
        console.log(`   Is Production: ${this.isProduction ? '✅ YES' : '❌ NO'}`);
        console.log(`   Platform: ${os.platform()}`);
        console.log(`   Node.js Version: ${process.version}`);
        console.log(`   Working Directory: ${process.cwd()}`);
    }

    displayEnvironmentVariables() {
        console.log('🔧 Environment Variables:');
        
        const envVars = [
            'NODE_ENV',
            'ADAPTIVE_MODE',
            'VERBOSE_LOGGING',
            'PORT',
            'RENDER',
            'HEROKU',
            'PM2_HOME',
            'PUPPETEER_EXECUTABLE_PATH'
        ];

        envVars.forEach(varName => {
            const value = process.env[varName];
            const status = value ? '✅' : '❌';
            console.log(`   ${status} ${varName}: ${value || 'not set'}`);
        });
    }

    displayProductionIndicators() {
        console.log('🎯 Production Environment Indicators:');
        
        const indicators = [
            { name: 'NODE_ENV=production', check: process.env.NODE_ENV === 'production' },
            { name: 'RENDER platform', check: !!process.env.RENDER },
            { name: 'HEROKU platform', check: !!process.env.HEROKU },
            { name: 'PM2 process manager', check: !!process.env.PM2_HOME },
            { name: 'Production paths', check: this.checkProductionPaths() }
        ];

        indicators.forEach(indicator => {
            const status = indicator.check ? '✅' : '❌';
            console.log(`   ${status} ${indicator.name}`);
        });

        const isProduction = indicators.some(i => i.check);
        console.log('');
        console.log(`🏆 Final Environment: ${isProduction ? '🏭 PRODUCTION' : '💻 DEVELOPMENT'}`);
    }

    checkProductionPaths() {
        const productionPaths = [
            '/usr/bin/microsoft-edge',
            '/usr/bin/google-chrome-stable',
            '/opt/render',
            '/app' // Heroku
        ];

        return productionPaths.some(path => {
            try {
                return fs.existsSync(path);
            } catch (error) {
                return false;
            }
        });
    }

    displayBrowserConfiguration() {
        console.log('🌐 Browser Configuration:');
        
        const browserPaths = [
            '/usr/bin/microsoft-edge',
            '/opt/microsoft/msedge/msedge',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        ];

        let foundBrowsers = [];
        let primaryBrowser = null;

        browserPaths.forEach(browserPath => {
            try {
                if (fs.existsSync(browserPath)) {
                    foundBrowsers.push(browserPath);
                    if (!primaryBrowser) {
                        primaryBrowser = browserPath;
                    }
                }
            } catch (error) {
                // Continue checking
            }
        });

        console.log(`   Primary Browser: ${primaryBrowser || 'Puppeteer bundled browser'}`);
        console.log(`   Available Browsers: ${foundBrowsers.length}`);
        
        if (foundBrowsers.length > 0) {
            console.log('   Found Browsers:');
            foundBrowsers.forEach(browser => {
                const type = this.getBrowserType(browser);
                console.log(`     ✅ ${type}: ${browser}`);
            });
        } else {
            console.log('   ⚠️  No system browsers found - will use Puppeteer bundled browser');
        }
    }

    getBrowserType(browserPath) {
        if (browserPath.includes('edge') || browserPath.includes('Edge')) {
            return 'Microsoft Edge';
        } else if (browserPath.includes('chrome') || browserPath.includes('Chrome')) {
            return 'Google Chrome';
        } else if (browserPath.includes('chromium')) {
            return 'Chromium';
        }
        return 'Unknown Browser';
    }

    displayConfigurationFiles() {
        console.log('📁 Configuration Files:');
        
        const configFiles = [
            { name: '.env', description: 'Environment variables' },
            { name: 'ecosystem.config.js', description: 'PM2 configuration' },
            { name: 'package.json', description: 'Node.js project config' },
            { name: 'api-patterns-database.json', description: 'Adaptive patterns' },
            { name: 'banner-extraction-config.js', description: 'Banner extraction config' }
        ];

        configFiles.forEach(file => {
            const exists = fs.existsSync(file.name);
            const status = exists ? '✅' : '❌';
            console.log(`   ${status} ${file.name}: ${file.description}`);
        });
    }

    displayRecommendations() {
        console.log('💡 Recommendations:');
        
        if (!this.isProduction && process.env.NODE_ENV !== 'development') {
            console.log('   🔧 Set environment explicitly:');
            console.log('      For production: NODE_ENV=production node index.js');
            console.log('      For development: NODE_ENV=development node index.js');
            console.log('');
        }

        if (!fs.existsSync('.env')) {
            console.log('   📝 Create .env file for consistent configuration:');
            if (this.isProduction) {
                console.log('      echo "NODE_ENV=production" > .env');
                console.log('      echo "ADAPTIVE_MODE=true" >> .env');
                console.log('      echo "VERBOSE_LOGGING=false" >> .env');
            } else {
                console.log('      echo "NODE_ENV=development" > .env');
                console.log('      echo "ADAPTIVE_MODE=true" >> .env');
                console.log('      echo "VERBOSE_LOGGING=true" >> .env');
            }
            console.log('');
        }

        if (this.isProduction && !process.env.PM2_HOME) {
            console.log('   🚀 For production, consider using PM2:');
            console.log('      npm install -g pm2');
            console.log('      pm2 start index.js --name linkedin-scraper --env production');
            console.log('');
        }

        console.log('   ✅ Quick Commands:');
        console.log('      Check status: curl http://localhost:3000/status');
        console.log('      Test browser: curl http://localhost:3000/test-browser');
        console.log('      View logs: pm2 logs linkedin-scraper (if using PM2)');
    }

    generateSetupCommands() {
        console.log('');
        console.log('🚀 Quick Setup Commands:');
        console.log('='.repeat(25));
        
        if (this.isProduction) {
            console.log('Production Setup:');
            console.log('  # Set environment');
            console.log('  echo "NODE_ENV=production" > .env');
            console.log('  echo "ADAPTIVE_MODE=true" >> .env');
            console.log('  echo "VERBOSE_LOGGING=false" >> .env');
            console.log('');
            console.log('  # Start application');
            console.log('  node index.js');
            console.log('');
            console.log('  # Or with PM2 (recommended)');
            console.log('  pm2 start index.js --name linkedin-scraper --env production');
        } else {
            console.log('Development Setup:');
            console.log('  # Default (no setup needed)');
            console.log('  node index.js');
            console.log('');
            console.log('  # Or explicit development');
            console.log('  NODE_ENV=development node index.js');
            console.log('');
            console.log('  # With .env file');
            console.log('  echo "NODE_ENV=development" > .env');
            console.log('  echo "VERBOSE_LOGGING=true" >> .env');
            console.log('  node index.js');
        }
    }
}

// Run the environment check
if (require.main === module) {
    const checker = new EnvironmentChecker();
    checker.checkEnvironment();
    checker.generateSetupCommands();
    
    console.log('');
    console.log('🎯 Current Status: Ready to run with current configuration');
    console.log('💡 Run "node index.js" to start the application');
}

module.exports = { EnvironmentChecker };