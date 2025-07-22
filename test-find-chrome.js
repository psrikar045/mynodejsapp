#!/usr/bin/env node

/**
 * Simple test to verify findChromeExecutable works
 */

const { findChromeExecutable } = require('./ensure-chrome');

console.log('🧪 Testing findChromeExecutable function...');
console.log('');

const chromeExecutable = findChromeExecutable();

if (chromeExecutable) {
    console.log('✅ Success! Chrome executable found:', chromeExecutable);
} else {
    console.log('❌ Chrome executable not found');
}

console.log('');
console.log('🎯 Test completed!');