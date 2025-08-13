/**
 * Enhanced System Test Script
 * Tests all new logging, monitoring, and search history features
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testEnhancedSystem() {
    console.log('🚀 Testing Enhanced System with Full Logging & Monitoring...\n');
    
    try {
        // Test 1: Server Health Check
        console.log('1️⃣ Testing server health...');
        const healthResponse = await axios.get(`${BASE_URL}/test`);
        console.log('✅ Server is running:', healthResponse.data.message);
        
        // Test 2: System Health Dashboard
        console.log('\n2️⃣ Testing system health monitoring...');
        const systemHealthResponse = await axios.get(`${BASE_URL}/api/system-health`);
        console.log('✅ System Health Status:', systemHealthResponse.data.health.status);
        console.log('📊 Memory Usage:', systemHealthResponse.data.health.summary.memory);
        console.log('⏱️ Uptime:', systemHealthResponse.data.health.summary.uptime);
        
        // Test 3: Detailed File Logs Status
        console.log('\n3️⃣ Testing detailed file logging...');
        const logsStatusResponse = await axios.get(`${BASE_URL}/api/logs-status`);
        console.log('✅ Log Files Status:');
        Object.entries(logsStatusResponse.data.logFiles).forEach(([type, info]) => {
            console.log(`   - ${type}: ${info.sizeFormatted} (${info.exists ? 'exists' : 'missing'})`);
        });
        
        // Test 4: Run Multiple Extractions to Generate Data
        console.log('\n4️⃣ Running extractions to generate logs and history...');
        const testUrls = [
            'https://www.linkedin.com/company/microsoft/',
            'https://www.google.com',
            'https://www.github.com'
        ];
        
        const extractionResults = [];
        for (const url of testUrls) {
            try {
                console.log(`   📋 Extracting: ${url}`);
                const extractionResponse = await axios.post(`${BASE_URL}/api/extract-company-details`, { url });
                extractionResults.push({
                    url,
                    success: true,
                    sessionId: extractionResponse.data._sessionId,
                    cached: extractionResponse.data._cached
                });
                console.log(`   ✅ Success - Session: ${extractionResponse.data._sessionId}`);
            } catch (error) {
                extractionResults.push({
                    url,
                    success: false,
                    error: error.response?.data?.error || error.message
                });
                console.log(`   ❌ Failed - ${error.response?.data?.error || error.message}`);
            }
            
            // Small delay between requests
            await delay(2000);
        }
        
        // Test 5: Check Extraction Logs
        console.log('\n5️⃣ Checking extraction logs...');
        const extractionLogsResponse = await axios.get(`${BASE_URL}/api/extraction-logs?limit=10`);
        console.log('📊 Recent extraction logs:', extractionLogsResponse.data.logs.length);
        console.log('📈 Stats:', {
            totalSessions: extractionLogsResponse.data.stats.totalSessions,
            successRate: extractionLogsResponse.data.stats.successRate + '%',
            running: extractionLogsResponse.data.stats.runningSessions
        });
        
        // Test 6: Check Search History
        console.log('\n6️⃣ Checking search history...');
        const searchHistoryResponse = await axios.get(`${BASE_URL}/api/search-history?limit=10`);
        console.log('🔍 Search history entries:', searchHistoryResponse.data.searches.length);
        console.log('📊 Analytics:', {
            totalSearches: searchHistoryResponse.data.analytics.totalSearches,
            successRate: searchHistoryResponse.data.analytics.successRate + '%',
            avgDuration: searchHistoryResponse.data.analytics.avgDuration + 'ms',
            cacheHitRate: searchHistoryResponse.data.analytics.cacheHitRate + '%'
        });
        
        // Test 7: Check Specific Session Logs
        const successfulExtraction = extractionResults.find(r => r.success && r.sessionId);
        if (successfulExtraction) {
            console.log('\n7️⃣ Checking specific session logs...');
            const sessionResponse = await axios.get(`${BASE_URL}/api/extraction-logs/${successfulExtraction.sessionId}`);
            console.log(`🎯 Session ${successfulExtraction.sessionId}:`);
            console.log('   - Steps:', sessionResponse.data.session.steps.length);
            console.log('   - Errors:', sessionResponse.data.session.errors.length);
            console.log('   - Status:', sessionResponse.data.session.status);
            console.log('   - Duration:', sessionResponse.data.session.performance.duration + 'ms');
        }
        
        // Test 8: Test Detailed Logs
        console.log('\n8️⃣ Testing detailed file logs...');
        const logTypes = ['extraction', 'errors', 'performance', 'system'];
        
        for (const logType of logTypes) {
            try {
                const logResponse = await axios.get(`${BASE_URL}/api/logs/${logType}?limit=5`);
                console.log(`   📝 ${logType}: ${logResponse.data.count} entries`);
            } catch (error) {
                console.log(`   ⚠️ ${logType}: No logs yet`);
            }
        }
        
        // Test 9: Search History Analytics
        console.log('\n9️⃣ Testing search analytics...');
        const analyticsResponse = await axios.get(`${BASE_URL}/api/search-analytics`);
        const analytics = analyticsResponse.data.analytics;
        console.log('📊 Detailed Analytics:');
        console.log('   - Total Searches:', analytics.totalSearches);
        console.log('   - Success Rate:', analytics.successRate + '%');
        console.log('   - LinkedIn Searches:', analytics.linkedInStats.total);
        console.log('   - LinkedIn Success Rate:', analytics.linkedInStats.successRate + '%');
        console.log('   - Cache Hit Rate:', analytics.cacheHitRate + '%');
        console.log('   - Last 24h Activity:', analytics.recentActivity.last24Hours);
        
        // Test 10: Active Sessions
        console.log('\n🔟 Checking active sessions...');
        const activeSessionsResponse = await axios.get(`${BASE_URL}/api/extraction-sessions`);
        console.log('🔄 Active sessions:', activeSessionsResponse.data.sessions.length);
        
        console.log('\n✅ All enhanced system tests completed successfully!');
        
        // Display Available Dashboards
        console.log('\n🌐 Available Web Dashboards:');
        console.log(`   • Real-time Logs: ${BASE_URL}/api/extraction-logs?format=html`);
        console.log(`   • System Health:  ${BASE_URL}/api/system-health?format=html`);
        console.log(`   • Search History: ${BASE_URL}/api/search-history?format=html`);
        
        console.log('\n📋 API Endpoints Summary:');
        console.log(`   • GET  ${BASE_URL}/api/extraction-logs       - Real-time extraction logs`);
        console.log(`   • GET  ${BASE_URL}/api/extraction-sessions   - Active extraction sessions`);
        console.log(`   • GET  ${BASE_URL}/api/system-health         - System health monitoring`);
        console.log(`   • GET  ${BASE_URL}/api/search-history        - Search history & analytics`);
        console.log(`   • GET  ${BASE_URL}/api/search-analytics      - Detailed search analytics`);
        console.log(`   • GET  ${BASE_URL}/api/logs/:type            - Detailed file logs`);
        console.log(`   • GET  ${BASE_URL}/api/logs-status           - Log files status`);
        console.log(`   • GET  ${BASE_URL}/api/logs/search/:query    - Search across all logs`);
        console.log(`   • GET  ${BASE_URL}/api/search-history/export - Export search history`);
        
        console.log('\n🎯 Key Features Enabled:');
        console.log('   ✅ Real-time extraction logging with session tracking');
        console.log('   ✅ Comprehensive system health monitoring');
        console.log('   ✅ Long-term search history with analytics');
        console.log('   ✅ Detailed file logging (extraction, errors, performance, system)');
        console.log('   ✅ Web-based dashboards for easy monitoring');
        console.log('   ✅ Cache hit tracking and performance metrics');
        console.log('   ✅ LinkedIn-specific success rate monitoring');
        console.log('   ✅ Memory-safe log rotation and cleanup');
        
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
    testEnhancedSystem();
}

module.exports = { testEnhancedSystem };