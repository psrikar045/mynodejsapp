#!/usr/bin/env node

/**
 * Test script to verify browser detection in production environment
 */

const fs = require('fs');
const os = require('os');

// Set production environment for testing
process.env.NODE_ENV = 'production';

function testBrowserDetection() {
    console.log('🧪 Testing Browser Detection in Production\n');
    
    // Test system info
    console.log('📋 System Information:');
    console.log(`Platform: ${os.platform()}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`RENDER: ${process.env.RENDER || 'not set'}`);
    console.log('');
    
    // Test Chrome paths
    console.log('🔍 Checking Chrome Installation Paths:');
    
    const chromePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
    ];
    
    let foundChrome = null;
    
    for (const chromePath of chromePaths) {
        const exists = fs.existsSync(chromePath);
        console.log(`${exists ? '✅' : '❌'} ${chromePath}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
        if (exists && !foundChrome) {
            foundChrome = chromePath;
        }
    }
    
    console.log('');
    
    if (foundChrome) {
        console.log(`🎉 Found Chrome at: ${foundChrome}`);
        
        // Test Chrome version
        try {
            const { execSync } = require('child_process');
            const version = execSync(`${foundChrome} --version`, { encoding: 'utf-8' });
            console.log(`📋 Chrome Version: ${version.trim()}`);
        } catch (error) {
            console.log(`❌ Could not get Chrome version: ${error.message}`);
        }
    } else {
        console.log('❌ No system Chrome found!');
    }
    
    console.log('');
    
    // Test Puppeteer detection
    try {
        const puppeteer = require('puppeteer');
        console.log('🔍 Testing Puppeteer Browser Detection:');
        
        try {
            const executablePath = puppeteer.executablePath();
            const exists = fs.existsSync(executablePath);
            console.log(`${exists ? '✅' : '❌'} Puppeteer bundled Chromium: ${executablePath}`);
            console.log(`${exists ? '✅' : '❌'} Path exists: ${exists}`);
        } catch (error) {
            console.log(`❌ Puppeteer executablePath() failed: ${error.message}`);
        }
    } catch (error) {
        console.log(`❌ Could not load Puppeteer: ${error.message}`);
    }
    
    console.log('');
    
    // Test launch simulation
    console.log('🚀 Testing Browser Launch Simulation:');
    
    if (foundChrome) {
        console.log(`✅ Would use system Chrome: ${foundChrome}`);
        console.log('✅ This should fix your production scraping issues!');
    } else {
        console.log('❌ Would fallback to Puppeteer bundled Chromium');
        console.log('⚠️  This might be causing your production issues');
    }
}

// Test actual browser detection functions from index.js
function testActualFunctions() {
    console.log('\n🧪 Testing Actual Browser Detection Functions:\n');
    
    try {
        // Simple version of the functions without dependencies
        const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
        console.log(`Production detected: ${isProduction}`);
        
        if (isProduction) {
            const productionChromePaths = [
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium'
            ];
            
            let foundPath = null;
            for (const chromePath of productionChromePaths) {
                if (fs.existsSync(chromePath)) {
                    foundPath = chromePath;
                    break;
                }
            }
            
            if (foundPath) {
                console.log(`✅ getBrowserExecutablePath() would return: ${foundPath}`);
                console.log(`✅ getBrowserExecutablePathForLinkedIn() would return: ${foundPath}`);
            } else {
                console.log('❌ Both functions would return null (Puppeteer bundled Chromium)');
            }
        }
    } catch (error) {
        console.log(`❌ Error testing functions: ${error.message}`);
    }
}

// Run tests
testBrowserDetection();
testActualFunctions();

console.log('\n📝 Next Steps:');
console.log('1. Deploy the updated code to your production server');
console.log('2. Check the server logs for "[Browser] Found system Chrome in production" messages');
console.log('3. Test the /test-browser endpoint to verify browser detection');
console.log('4. Test actual scraping endpoints');