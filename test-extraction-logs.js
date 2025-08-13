/**
 * Test script for the new Extraction Logging System
 * Demonstrates how to use the logging endpoints
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testExtractionLogs() {
    console.log('🚀 Testing Extraction Logging System...\n');
    
    try {
        // Test 1: Check if server is running
        console.log('1️⃣ Testing server connection...');
        const healthResponse = await axios.get(`${BASE_URL}/test`);
        console.log('✅ Server is running:', healthResponse.data.message);
        
        // Test 2: Start an extraction to generate logs
        console.log('\n2️⃣ Starting extraction to generate logs...');
        const extractionResponse = await axios.post(`${BASE_URL}/api/extract-company-details`, {
            url: 'https://www.linkedin.com/company/microsoft/'
        });
        
        console.log('✅ Extraction completed');
        const sessionId = extractionResponse.data._sessionId;
        console.log('📋 Session ID:', sessionId);
        
        // Wait a moment for logs to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 3: Get recent logs
        console.log('\n3️⃣ Fetching recent logs...');
        const logsResponse = await axios.get(`${BASE_URL}/api/extraction-logs?limit=10`);
        console.log('📊 Recent logs count:', logsResponse.data.logs.length);
        console.log('📈 Stats:', logsResponse.data.stats);
        
        // Test 4: Get specific session logs
        if (sessionId) {
            console.log('\n4️⃣ Fetching session-specific logs...');
            const sessionResponse = await axios.get(`${BASE_URL}/api/extraction-logs/${sessionId}`);
            console.log('🎯 Session logs:');
            console.log('   - Steps:', sessionResponse.data.session.steps.length);
            console.log('   - Errors:', sessionResponse.data.session.errors.length);
            console.log('   - Status:', sessionResponse.data.session.status);
            console.log('   - Duration:', sessionResponse.data.session.performance.duration + 'ms');
        }
        
        // Test 5: Get active sessions
        console.log('\n5️⃣ Checking active sessions...');
        const sessionsResponse = await axios.get(`${BASE_URL}/api/extraction-sessions`);
        console.log('🔄 Active sessions:', sessionsResponse.data.sessions.length);
        console.log('📊 Session stats:', sessionsResponse.data.stats);
        
        console.log('\n✅ All tests completed successfully!');
        console.log('\n📋 Available Logging Endpoints:');
        console.log(`   • GET  ${BASE_URL}/api/extraction-logs           - View recent logs`);
        console.log(`   • GET  ${BASE_URL}/api/extraction-logs?format=html - View logs in browser`);
        console.log(`   • GET  ${BASE_URL}/api/extraction-sessions      - View active sessions`);
        console.log(`   • GET  ${BASE_URL}/api/extraction-logs/:sessionId - View specific session`);
        console.log(`   • POST ${BASE_URL}/api/extraction-logs/clear     - Clear all logs`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Make sure your server is running:');
            console.log('   npm start');
        }
        
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', error.response.data);
        }
    }
}

// Run the test
if (require.main === module) {
    testExtractionLogs();
}

module.exports = { testExtractionLogs };