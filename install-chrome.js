#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

async function installChrome() {
    console.log('🔧 Custom Chrome installer starting...');

    // Try to use Puppeteer's built-in browser fetcher
    try {
        const puppeteer = require('puppeteer');
        
        console.log('📦 Using Puppeteer browser fetcher...');
        
        // For older versions of Puppeteer, try to trigger Chromium download
        if (puppeteer.createBrowserFetcher) {
            const browserFetcher = puppeteer.createBrowserFetcher();
            console.log('🌐 Downloading Chromium...');
            
            // Get the default revision
            const revisionInfo = await browserFetcher.download();
            console.log('✅ Chromium downloaded to:', revisionInfo.executablePath);
        } else {
            console.log('⚠️  Browser fetcher not available, trying alternative method...');
            
            // Try to launch Puppeteer to trigger auto-download
            console.log('🚀 Attempting to launch Puppeteer to trigger download...');
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            await browser.close();
            console.log('✅ Puppeteer launch successful - Chromium should be available');
        }
        
    } catch (error) {
    console.log('❌ Chrome installation failed:', error.message);
    
    // Try alternative approach - check if Chrome is available in system
    console.log('🔍 Checking for system Chrome...');
    
    const possiblePaths = [
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
    ];
    
    for (const chromePath of possiblePaths) {
        if (fs.existsSync(chromePath)) {
            console.log(`✅ Found system Chrome: ${chromePath}`);
            process.exit(0);
        }
    }
    
    console.log('⚠️  No Chrome found, but continuing build...');
    console.log('   Puppeteer will attempt to download Chromium at runtime');
    }

    console.log('🎉 Chrome installation process completed');
}

// Run the installer
installChrome().catch(error => {
    console.error('❌ Installation failed:', error.message);
    process.exit(0); // Don't fail the build
});