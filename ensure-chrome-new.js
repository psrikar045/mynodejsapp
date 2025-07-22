#!/usr/bin/env node

/**
 * Chrome installer and availability checker for Render deployment
 * This module ensures Chrome is available for Puppeteer to use
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function ensureChrome() {
    console.log('🔧 [Chrome Installer] Starting Chrome availability check...');
    
    // Ensure environment variables are set for runtime
    if (!process.env.PUPPETEER_CACHE_DIR) {
        process.env.PUPPETEER_CACHE_DIR = '/opt/render/project/.cache/puppeteer';
        console.log('🔧 [Chrome Installer] Set PUPPETEER_CACHE_DIR to:', process.env.PUPPETEER_CACHE_DIR);
    }
    
    if (!process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD) {
        process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'false';
        console.log('🔧 [Chrome Installer] Set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD to:', process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD);
    }
    
    // Strategy 1: Try to launch Puppeteer with default settings first
    console.log('🔍 [Chrome Installer] Strategy 1: Testing default Puppeteer launch...');
    try {
        const testBrowser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            timeout: 30000
        });
        
        const version = await testBrowser.version();
        console.log('✅ [Chrome Installer] Default Puppeteer Chrome working:', version);
        await testBrowser.close();
        return true;
        
    } catch (error) {
        console.log('❌ [Chrome Installer] Default Puppeteer launch failed:', error.message);
    }
    
    // Strategy 2: Try to find and use a specific Chrome executable
    console.log('🔍 [Chrome Installer] Strategy 2: Looking for specific Chrome executable...');
    const chromeExecutable = findChromeExecutable();
    if (chromeExecutable) {
        console.log('✅ [Chrome Installer] Found Chrome executable:', chromeExecutable);
        
        // Test the found executable
        try {
            const testBrowser = await puppeteer.launch({
                headless: true,
                executablePath: chromeExecutable,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                timeout: 30000
            });
            
            const version = await testBrowser.version();
            console.log('✅ [Chrome Installer] Chrome is working:', version);
            await testBrowser.close();
            
            // Store the working executable path for later use
            process.env.CHROME_EXECUTABLE_PATH = chromeExecutable;
            return true;
            
        } catch (error) {
            console.log('❌ [Chrome Installer] Found Chrome but failed to launch:', error.message);
        }
    }
    
    // Strategy 3: Check for system Chrome as fallback
    console.log('🔍 [Chrome Installer] Strategy 3: Checking for system Chrome...');
    const systemPaths = [
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
    ];
    
    for (const chromePath of systemPaths) {
        if (fs.existsSync(chromePath)) {
            console.log('✅ [Chrome Installer] Found system Chrome:', chromePath);
            
            // Test system Chrome
            try {
                const browser = await puppeteer.launch({
                    headless: true,
                    executablePath: chromePath,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
                await browser.close();
                console.log('✅ [Chrome Installer] System Chrome verified');
                
                // Store the working executable path
                process.env.CHROME_EXECUTABLE_PATH = chromePath;
                return true;
            } catch (testError) {
                console.log('❌ [Chrome Installer] System Chrome test failed:', testError.message);
            }
        }
    }
    
    console.log('❌ [Chrome Installer] All strategies failed');
    return false;
}

/**
 * Find Chrome executable in common locations
 */
function findChromeExecutable() {
    console.log('🔍 [Chrome Installer] Searching for Chrome executable...');
    
    // Check multiple possible cache directories
    const cacheDirs = [
        process.env.PUPPETEER_CACHE_DIR,
        '/opt/render/project/.cache/puppeteer',
        '/opt/render/.cache/puppeteer',
        path.join(__dirname, '.cache', 'puppeteer'),
        path.join(process.cwd(), '.cache', 'puppeteer')
    ].filter(Boolean);
    
    for (const cacheDir of cacheDirs) {
        console.log('🔍 [Chrome Installer] Checking cache directory:', cacheDir);
        
        if (fs.existsSync(cacheDir)) {
            console.log('✅ [Chrome Installer] Cache directory exists');
            
            try {
                const contents = fs.readdirSync(cacheDir);
                console.log('🔍 [Chrome Installer] Cache contents:', contents.join(', '));
                
                // Look for chrome directory
                if (contents.includes('chrome')) {
                    const chromeDir = path.join(cacheDir, 'chrome');
                    console.log('🔍 [Chrome Installer] Exploring chrome directory:', chromeDir);
                    
                    const chromeContents = fs.readdirSync(chromeDir);
                    console.log('🔍 [Chrome Installer] Chrome directory contents:', chromeContents.join(', '));
                    
                    // Look for version directories
                    for (const versionDir of chromeContents) {
                        const versionPath = path.join(chromeDir, versionDir);
                        if (fs.statSync(versionPath).isDirectory()) {
                            console.log('🔍 [Chrome Installer] Checking version directory:', versionPath);
                            
                            // Try different possible executable paths
                            const possibleExePaths = [
                                path.join(versionPath, 'chrome-linux64', 'chrome'),
                                path.join(versionPath, 'chrome-linux', 'chrome'),
                                path.join(versionPath, 'chrome'),
                            ];
                            
                            for (const exePath of possibleExePaths) {
                                if (fs.existsSync(exePath)) {
                                    console.log('✅ [Chrome Installer] Found Chrome executable:', exePath);
                                    return exePath;
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.log('❌ [Chrome Installer] Error exploring cache directory:', error.message);
            }
        } else {
            console.log('❌ [Chrome Installer] Cache directory does not exist');
        }
    }
    
    // Fallback to predefined paths
    const possiblePaths = [
        // Render-specific paths
        '/opt/render/project/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome',
        '/opt/render/project/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux/chrome',
        '/opt/render/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome',
        '/opt/render/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux/chrome',
        
        // Generic cache paths with environment variable
        process.env.PUPPETEER_CACHE_DIR && path.join(process.env.PUPPETEER_CACHE_DIR, 'chrome/linux-127.0.6533.88/chrome-linux64/chrome'),
        process.env.PUPPETEER_CACHE_DIR && path.join(process.env.PUPPETEER_CACHE_DIR, 'chrome/linux-127.0.6533.88/chrome-linux/chrome'),
        
        // System Chrome paths
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
    ].filter(Boolean);
    
    console.log('🔍 [Chrome Installer] Checking predefined paths...');
    for (const chromePath of possiblePaths) {
        console.log('🔍 [Chrome Installer] Checking:', chromePath);
        if (fs.existsSync(chromePath)) {
            console.log('✅ [Chrome Installer] Found Chrome at:', chromePath);
            return chromePath;
        }
    }
    
    // Try to use Puppeteer's built-in executable path detection
    try {
        console.log('🔍 [Chrome Installer] Trying Puppeteer executablePath...');
        const puppeteerExecutable = puppeteer.executablePath();
        if (puppeteerExecutable && fs.existsSync(puppeteerExecutable)) {
            console.log('✅ [Chrome Installer] Found Puppeteer executable:', puppeteerExecutable);
            return puppeteerExecutable;
        }
    } catch (error) {
        console.log('❌ [Chrome Installer] Puppeteer executablePath failed:', error.message);
    }
    
    console.log('❌ [Chrome Installer] No Chrome executable found');
    return null;
}

// Export for use in other modules
module.exports = { ensureChrome, findChromeExecutable };

// If run directly, execute the installer
if (require.main === module) {
    ensureChrome().then(success => {
        if (success) {
            console.log('🎉 Chrome is ready!');
            process.exit(0);
        } else {
            console.log('💥 Chrome setup failed!');
            process.exit(1);
        }
    }).catch(error => {
        console.error('💥 Chrome installer error:', error);
        process.exit(1);
    });
}