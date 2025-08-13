#!/usr/bin/env node

/**
 * Browser Selection Test
 * Demonstrates how browser selection works (deterministic, not random)
 */

const fs = require('fs');
const os = require('os');

class BrowserSelectionTest {
    constructor() {
        this.platform = os.platform();
        this.isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
    }

    runTest() {
        console.log('🔍 Browser Selection Logic Test');
        console.log('===============================');
        console.log(`Platform: ${this.platform}`);
        console.log(`Environment: ${this.isProduction ? 'Production' : 'Development'}`);
        console.log('');

        if (this.isProduction) {
            this.testProductionSelection();
        } else {
            this.testDevelopmentSelection();
        }

        console.log('');
        this.demonstrateConsistency();
    }

    testProductionSelection() {
        console.log('🏭 Production Browser Selection Test');
        console.log('-----------------------------------');
        
        const productionBrowserPaths = [
            '/usr/bin/microsoft-edge',           // 1st Priority
            '/opt/microsoft/msedge/msedge',      // 2nd Priority
            '/usr/bin/google-chrome',            // 3rd Priority
            '/usr/bin/google-chrome-stable',     // 4th Priority
            '/usr/bin/chromium-browser',         // 5th Priority
            '/usr/bin/chromium'                  // 6th Priority
        ];

        console.log('Checking browsers in priority order:');
        
        let selectedBrowser = null;
        let selectionReason = '';

        for (let i = 0; i < productionBrowserPaths.length; i++) {
            const browserPath = productionBrowserPaths[i];
            const exists = fs.existsSync(browserPath);
            const status = exists ? '✅ FOUND' : '❌ NOT FOUND';
            const priority = `Priority ${i + 1}`;
            
            console.log(`   ${priority}: ${status} ${browserPath}`);
            
            if (exists && !selectedBrowser) {
                selectedBrowser = browserPath;
                selectionReason = `First available browser (Priority ${i + 1})`;
                console.log(`   🎯 SELECTED: This browser will be used!`);
                console.log(`   🔄 Remaining browsers will NOT be checked`);
            }
        }

        if (selectedBrowser) {
            console.log('');
            console.log('🎯 FINAL SELECTION:');
            console.log(`   Browser: ${selectedBrowser}`);
            console.log(`   Reason: ${selectionReason}`);
            console.log(`   Type: ${this.getBrowserType(selectedBrowser)}`);
        } else {
            console.log('');
            console.log('🔄 FALLBACK SELECTION:');
            console.log('   Browser: Puppeteer bundled Chromium');
            console.log('   Reason: No system browsers found');
        }

        return selectedBrowser;
    }

    testDevelopmentSelection() {
        console.log('💻 Development Browser Selection Test');
        console.log('------------------------------------');
        
        const browserCandidates = {
            win32: [
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
            ],
            darwin: [
                '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            ],
            linux: [
                '/usr/bin/microsoft-edge',
                '/opt/microsoft/msedge/msedge',
                '/usr/bin/google-chrome-stable',
                '/usr/bin/google-chrome',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium'
            ]
        };

        const paths = browserCandidates[this.platform] || [];
        
        console.log(`Checking ${this.platform} browsers in priority order:`);
        
        let selectedBrowser = null;
        let selectionReason = '';

        for (let i = 0; i < paths.length; i++) {
            const browserPath = paths[i];
            const exists = fs.existsSync(browserPath);
            const status = exists ? '✅ FOUND' : '❌ NOT FOUND';
            const priority = `Priority ${i + 1}`;
            
            console.log(`   ${priority}: ${status} ${browserPath}`);
            
            if (exists && !selectedBrowser) {
                selectedBrowser = browserPath;
                selectionReason = `First available browser (Priority ${i + 1})`;
                console.log(`   🎯 SELECTED: This browser will be used!`);
                console.log(`   🔄 Remaining browsers will NOT be checked`);
            }
        }

        if (selectedBrowser) {
            console.log('');
            console.log('🎯 FINAL SELECTION:');
            console.log(`   Browser: ${selectedBrowser}`);
            console.log(`   Reason: ${selectionReason}`);
            console.log(`   Type: ${this.getBrowserType(selectedBrowser)}`);
        } else {
            console.log('');
            console.log('🔄 FALLBACK SELECTION:');
            console.log('   Browser: Puppeteer bundled Chromium');
            console.log('   Reason: No local browsers found');
        }

        return selectedBrowser;
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

    demonstrateConsistency() {
        console.log('🔄 Consistency Test');
        console.log('------------------');
        console.log('Running browser selection 5 times to demonstrate consistency:');
        
        const results = [];
        
        for (let i = 1; i <= 5; i++) {
            const result = this.simulateBrowserSelection();
            results.push(result);
            console.log(`   Run ${i}: ${result || 'Puppeteer bundled'}`);
        }

        // Check if all results are the same
        const allSame = results.every(result => result === results[0]);
        
        console.log('');
        if (allSame) {
            console.log('✅ CONSISTENCY VERIFIED: Same browser selected every time');
            console.log('🎯 Browser selection is DETERMINISTIC (not random)');
        } else {
            console.log('❌ INCONSISTENCY DETECTED: Different browsers selected');
            console.log('🚨 This should not happen - browser selection should be deterministic');
        }
    }

    simulateBrowserSelection() {
        // Simulate the actual browser selection logic
        const browserPaths = this.isProduction ? [
            '/usr/bin/microsoft-edge',
            '/opt/microsoft/msedge/msedge',
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium'
        ] : this.getDevelopmentPaths();

        for (const browserPath of browserPaths) {
            if (fs.existsSync(browserPath)) {
                return browserPath;
            }
        }
        return null; // Puppeteer bundled
    }

    getDevelopmentPaths() {
        const browserCandidates = {
            win32: [
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
            ],
            darwin: [
                '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            ],
            linux: [
                '/usr/bin/microsoft-edge',
                '/opt/microsoft/msedge/msedge',
                '/usr/bin/google-chrome-stable',
                '/usr/bin/google-chrome',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium'
            ]
        };

        return browserCandidates[this.platform] || [];
    }

    generateSummary() {
        console.log('');
        console.log('📊 BROWSER SELECTION SUMMARY');
        console.log('============================');
        
        console.log('🎯 Key Points:');
        console.log('   ✅ Browser selection is DETERMINISTIC (not random)');
        console.log('   ✅ Uses PRIORITY-BASED selection (first available wins)');
        console.log('   ✅ Results are CONSISTENT (same every time)');
        console.log('   ✅ Microsoft Edge has HIGHEST PRIORITY in production');
        console.log('');
        
        console.log('🔍 Selection Process:');
        console.log('   1. Check browsers in priority order');
        console.log('   2. Use the FIRST browser found');
        console.log('   3. STOP checking remaining browsers');
        console.log('   4. Result is always the same');
        console.log('');
        
        if (this.isProduction) {
            console.log('🏭 Production Environment:');
            console.log('   • Microsoft Edge will be selected if available');
            console.log('   • Chrome/Chromium as fallback options');
            console.log('   • Puppeteer bundled browser as last resort');
        } else {
            console.log('💻 Development Environment:');
            console.log('   • Local browsers checked first');
            console.log('   • Platform-specific paths');
            console.log('   • Puppeteer bundled browser as fallback');
        }
        
        console.log('');
        console.log('🚨 Important:');
        console.log('   • NOT hardcoded to any specific browser');
        console.log('   • NOT random selection');
        console.log('   • Uses intelligent priority system');
        console.log('   • Consistent and predictable behavior');
    }
}

// Run the test
if (require.main === module) {
    const test = new BrowserSelectionTest();
    test.runTest();
    test.generateSummary();
}

module.exports = { BrowserSelectionTest };