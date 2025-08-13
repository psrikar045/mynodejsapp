#!/usr/bin/env node

/**
 * Debug script to identify the source of regenerator/babel runtime errors
 * Run this when you encounter the regenerator error to get more details
 */

const http = require('http');

console.log('🐛 Regenerator Error Debugging Tool\n');

// Add debugging information
console.log('📋 Environment Information:');
console.log(`Node Version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`Architecture: ${process.arch}`);
console.log(`Memory Usage:`, process.memoryUsage());
console.log('');

// Test basic async functionality
async function testBasicAsync() {
    console.log('🧪 Testing basic async/await functionality...');
    try {
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('✅ Basic async/await works');
    } catch (error) {
        console.log('❌ Basic async/await failed:', error.message);
    }
}

// Test server connectivity
async function testServerHealth() {
    console.log('🧪 Testing server connectivity...');
    
    return new Promise((resolve) => {
        const req = http.get('http://localhost:3000/test', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('✅ Server is responding');
                    console.log('📋 Server Response:', data.substring(0, 100) + '...');
                } else {
                    console.log(`❌ Server returned status ${res.statusCode}`);
                }
                resolve();
            });
        });

        req.on('error', (error) => {
            console.log(`❌ Server connection failed: ${error.message}`);
            resolve();
        });

        req.setTimeout(5000, () => {
            console.log('⏰ Server connection timeout');
            req.destroy();
            resolve();
        });
    });
}

// Test a simple API call to see where the error occurs
async function testSimpleAPICall() {
    console.log('🧪 Testing simple API call...');
    
    return new Promise((resolve) => {
        const postData = JSON.stringify({ url: 'https://www.google.com' });
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/extract-company-details',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 10000
        };

        console.log('📤 Making API request...');
        
        const req = http.request(options, (res) => {
            console.log(`📥 Response status: ${res.statusCode}`);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
                // Log partial data to see if we're getting streaming responses
                if (data.length % 1000 === 0) {
                    console.log(`📊 Received ${data.length} bytes so far...`);
                }
            });
            
            res.on('end', () => {
                console.log(`📊 Total response size: ${data.length} bytes`);
                
                try {
                    const parsed = JSON.parse(data);
                    console.log('✅ API call completed successfully');
                    console.log('📋 Response keys:', Object.keys(parsed));
                } catch (parseError) {
                    console.log('❌ API response parsing failed:', parseError.message);
                    console.log('📋 Raw response preview:', data.substring(0, 200) + '...');
                }
                resolve();
            });
        });

        req.on('error', (error) => {
            console.log(`❌ API request error: ${error.message}`);
            
            // Check if this is the regenerator error
            if (error.stack && error.stack.includes('regenerator')) {
                console.log('🔍 FOUND REGENERATOR ERROR IN STACK:');
                console.log(error.stack);
            }
            resolve();
        });

        req.on('timeout', () => {
            console.log('⏰ API request timeout');
            req.destroy();
            resolve();
        });

        req.write(postData);
        req.end();
    });
}

// Monitor memory usage
function monitorMemory() {
    console.log('📊 Memory monitoring started (will log every 2 seconds)...\n');
    
    let memoryCheckCount = 0;
    const memoryInterval = setInterval(() => {
        const usage = process.memoryUsage();
        const memoryMB = {
            rss: Math.round(usage.rss / 1024 / 1024),
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
            external: Math.round(usage.external / 1024 / 1024)
        };
        
        console.log(`📊 Memory Usage: RSS=${memoryMB.rss}MB, Heap=${memoryMB.heapUsed}/${memoryMB.heapTotal}MB, External=${memoryMB.external}MB`);
        
        memoryCheckCount++;
        if (memoryCheckCount >= 10) { // Stop after 20 seconds
            clearInterval(memoryInterval);
            console.log('📊 Memory monitoring stopped\n');
        }
    }, 2000);
}

// Main execution
async function runDebugTests() {
    console.log('🚀 Starting Regenerator Error Debug Tests\n');
    
    // Start memory monitoring
    monitorMemory();
    
    // Run tests sequentially
    await testBasicAsync();
    await testServerHealth();
    await testSimpleAPICall();
    
    console.log('\n🎯 Debug Analysis Complete');
    console.log('📋 If you see regenerator errors in the output above, that indicates where the issue is occurring.');
    console.log('📋 Common causes:');
    console.log('   - Infinite loops in async code');
    console.log('   - Memory exhaustion from too many concurrent operations');
    console.log('   - Browser resource leaks');
    console.log('   - Excessive retries without bounds');
    console.log('\n💡 Recommendations:');
    console.log('   - Check server logs for detailed error information');
    console.log('   - Monitor memory usage during operations');
    console.log('   - Limit concurrent browser instances');
    console.log('   - Add timeouts to all async operations');
}

// Handle process signals
process.on('SIGINT', () => {
    console.log('\n⚠️  Debug process interrupted');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.log('💥 UNCAUGHT EXCEPTION:');
    console.log(error.stack);
    
    if (error.stack && error.stack.includes('regenerator')) {
        console.log('🎯 THIS IS THE REGENERATOR ERROR!');
        console.log('🔍 Error details:', error.message);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.log('💥 UNHANDLED PROMISE REJECTION:');
    console.log('Reason:', reason);
    
    if (reason && reason.stack && reason.stack.includes('regenerator')) {
        console.log('🎯 THIS IS THE REGENERATOR ERROR IN A PROMISE!');
    }
});

// Start debugging
runDebugTests().catch(error => {
    console.log('💥 Debug test error:', error.message);
    if (error.stack && error.stack.includes('regenerator')) {
        console.log('🎯 REGENERATOR ERROR FOUND IN DEBUG TESTS!');
        console.log(error.stack);
    }
});