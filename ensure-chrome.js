#!/usr/bin/env node

/**
 * Browser availability checker for production deployment
 * Checks for Microsoft Edge, Chrome, and Puppeteer's built-in browser management
 */

const puppeteer = require('puppeteer');

async function ensureChrome() {
    console.log('🔧 [Browser Checker] Checking browser availability...');
    
    try {
        // First attempt: Try to launch Puppeteer with existing Chrome
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ],
            timeout: 30000
        });
        
        const version = await browser.version();
        console.log('✅ [Chrome Installer] Chrome is working:', version);
        await browser.close();
        
        console.log('✅ Chrome is ready for web scraping');
        return true;
        
    } catch (error) {
        console.log('❌ [Chrome Installer] First attempt failed:', error.message);
        
        // Second attempt: Try to install Chrome at runtime
        console.log('🔄 [Chrome Installer] Attempting runtime Chrome installation...');
        try {
            const { execSync } = require('child_process');
            execSync('npx puppeteer browsers install chrome', { 
                stdio: 'inherit',
                timeout: 120000 // 2 minutes timeout
            });
            
            // Try launching again after installation
            const browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ],
                timeout: 30000
            });
            
            const version = await browser.version();
            console.log('✅ [Chrome Installer] Chrome installed and working:', version);
            await browser.close();
            
            console.log('✅ Chrome is ready for web scraping');
            return true;
            
        } catch (installError) {
            console.log('❌ [Chrome Installer] Runtime installation failed:', installError.message);
            return false;
        }
    }
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
        
        // Generic cache paths with environment variable
        process.env.PUPPETEER_CACHE_DIR && path.join(process.env.PUPPETEER_CACHE_DIR, 'chrome/linux-127.0.6533.88/chrome-linux64/chrome'),
        process.env.PUPPETEER_CACHE_DIR && path.join(process.env.PUPPETEER_CACHE_DIR, 'chrome/linux-127.0.6533.88/chrome-linux/chrome'),
        
        // System browser paths (Edge first, then Chrome)
        '/usr/bin/microsoft-edge',
        '/opt/microsoft/msedge/msedge',
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
module.exports = { ensureChrome };

// If run directly, execute the installer
if (require.main === module) {
    ensureChrome()
        .then(success => {
            if (success) {
                console.log('🎉 [Chrome Installer] Chrome is ready!');
                process.exit(0);
            } else {
                console.log('💥 [Chrome Installer] Chrome installation failed!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 [Chrome Installer] Unexpected error:', error);
            process.exit(1);
        });
}