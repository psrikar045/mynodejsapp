#!/usr/bin/env node

/**
 * Debug script to check Puppeteer installation and Chrome availability
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Puppeteer installation...');

try {
    const puppeteer = require('puppeteer');
    console.log('✅ Puppeteer package loaded successfully');
    
    // Check if Puppeteer will download Chromium automatically
    console.log('🔧 Environment variables:');
    console.log('   PUPPETEER_SKIP_CHROMIUM_DOWNLOAD:', process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD);
    console.log('   PUPPETEER_CACHE_DIR:', process.env.PUPPETEER_CACHE_DIR);
    console.log('   NODE_ENV:', process.env.NODE_ENV);
    
    // Check various possible cache directories
    const possibleCacheDirs = [
        process.env.PUPPETEER_CACHE_DIR,
        '/opt/render/.cache/puppeteer',
        '/opt/render/project/.cache/puppeteer',
        '/opt/render/project/node_modules/puppeteer/.local-chromium',
        path.join(__dirname, 'node_modules', 'puppeteer', '.local-chromium'),
        path.join(process.env.HOME || '/opt/render', '.cache', 'puppeteer'),
        '/tmp/.cache/puppeteer'
    ].filter(Boolean);
    
    console.log('📁 Checking possible cache directories...');
    for (const cacheDir of possibleCacheDirs) {
        console.log(`   Checking: ${cacheDir}`);
        if (fs.existsSync(cacheDir)) {
            console.log(`   ✅ Directory exists`);
            try {
                const contents = fs.readdirSync(cacheDir);
                console.log(`   📋 Contents: ${contents.join(', ')}`);
            } catch (error) {
                console.log(`   ❌ Error reading: ${error.message}`);
            }
        } else {
            console.log(`   ❌ Directory does not exist`);
        }
    }
    
    // Try to launch Puppeteer
    console.log('🚀 Attempting to launch Puppeteer...');
    
    (async () => {
        try {
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            console.log('✅ Puppeteer launched successfully');
            
            // Try to get browser info
            try {
                const pages = await browser.pages();
                const page = pages[0];
                const browserVersion = await page.browser().version();
                console.log('🌐 Browser version:', browserVersion);
                
                // Check if we can get executable path
                if (browser.process && browser.process()) {
                    console.log('📍 Chrome process PID:', browser.process().pid);
                }
            } catch (infoError) {
                console.log('ℹ️  Browser info not available:', infoError.message);
            }
            
            await browser.close();
            console.log('✅ Browser closed successfully');
        } catch (error) {
            console.log('❌ Failed to launch Puppeteer:', error.message);
        }
    })();
    
} catch (error) {
    console.log('❌ Error loading Puppeteer:', error.message);
}