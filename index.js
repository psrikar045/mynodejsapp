const Vibrant = require('node-vibrant');
const sharp = require('sharp');
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const dns = require('dns').promises;
const os = require('os');
const fs = require('fs');
const path = require('path');
const { ensureChrome } = require('./ensure-chrome');
const { antiBotSystem } = require('./anti-bot-system');
const { performanceMonitor } = require('./performance-monitor');
const { enhancedFileOps } = require('./enhanced-file-operations');
const { LinkedInImageAntiBotSystem } = require('./linkedin-image-anti-bot');
const { extractionLogger } = require('./extraction-logger');
const { systemHealthMonitor } = require('./system-health-monitor');
const { searchHistoryLogger } = require('./search-history-logger');
const { detailedFileLogger } = require('./detailed-file-logger');

// Initialize LinkedIn-specific anti-bot system
const linkedinAntiBot = new LinkedInImageAntiBotSystem();

/**
 * LinkedIn extraction tracking for monitoring success rates
 * WITH MEMORY LEAK PREVENTION
 */
const linkedInMetrics = {
    totalAttempts: 0,
    successfulExtractions: 0,
    failedExtractions: 0,
    errorCategories: {},
    lastUpdated: new Date().toISOString(),
    // SAFETY: Add bounds to prevent memory accumulation
    maxHistorySize: 100
};

// SAFETY: Periodic cleanup to prevent memory leaks
setInterval(() => {
    // Reset metrics if they grow too large
    if (linkedInMetrics.totalAttempts > linkedInMetrics.maxHistorySize) {
        console.log('Resetting LinkedIn metrics to prevent memory accumulation');
        linkedInMetrics.totalAttempts = Math.floor(linkedInMetrics.totalAttempts / 2);
        linkedInMetrics.successfulExtractions = Math.floor(linkedInMetrics.successfulExtractions / 2);
        linkedInMetrics.failedExtractions = Math.floor(linkedInMetrics.failedExtractions / 2);
        
        // Reset error categories
        Object.keys(linkedInMetrics.errorCategories).forEach(key => {
            linkedInMetrics.errorCategories[key] = Math.floor(linkedInMetrics.errorCategories[key] / 2);
        });
        
        linkedInMetrics.lastUpdated = new Date().toISOString();
    }
}, 30 * 60 * 1000); // Every 30 minutes

const app = express();
const port = process.env.PORT || 3000;

// Simple in-memory cache for performance optimization
const extractionCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// API Request Logging Middleware
app.use(async (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    
    // Override res.send to capture response
    res.send = function(data) {
        const duration = Date.now() - startTime;
        const userAgent = req.get('User-Agent');
        const ip = req.ip || req.connection.remoteAddress;
        
        // Log API request asynchronously
        setImmediate(async () => {
            try {
                await detailedFileLogger.logAPI(
                    req.method,
                    req.originalUrl,
                    res.statusCode,
                    duration,
                    userAgent,
                    ip
                );
            } catch (error) {
                console.error('Failed to log API request:', error);
            }
        });
        
        return originalSend.call(this, data);
    };
    
    next();
});

// ✅ Example test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'SumNode API is working correctly!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// LinkedIn metrics endpoint for monitoring success rates
app.get('/linkedin-metrics', (req, res) => {
    const successRate = linkedInMetrics.totalAttempts > 0 ? 
        ((linkedInMetrics.successfulExtractions / linkedInMetrics.totalAttempts) * 100).toFixed(1) : 0;
    
    res.json({
        status: 'active',
        metrics: {
            ...linkedInMetrics,
            successRate: `${successRate}%`,
            failureRate: `${(100 - parseFloat(successRate)).toFixed(1)}%`
        },
        recommendations: {
            ...(parseFloat(successRate) < 50 && linkedInMetrics.totalAttempts >= 5 ? {
                lowSuccessRate: 'Consider checking LinkedIn blocking patterns or adjusting scraping strategy'
            } : {}),
            ...(linkedInMetrics.errorCategories.timeout > linkedInMetrics.errorCategories.navigation ? {
                highTimeouts: 'Consider increasing timeout values or optimizing page load detection'
            } : {}),
            ...(linkedInMetrics.errorCategories.network > 3 ? {
                networkIssues: 'Consider implementing additional network retry mechanisms'
            } : {})
        },
        _timestamp: new Date().toISOString()
    });
});

// ✅ Advanced Performance Monitoring Endpoint
app.get('/performance-metrics', (req, res) => {
    try {
        const analytics = performanceMonitor.getAnalytics();
        res.json({
            status: 'active',
            ...analytics,
            _timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            _timestamp: new Date().toISOString()
        });
    }
});

// ✅ Anti-Bot System Status Endpoint
app.get('/anti-bot-status', (req, res) => {
    try {
        const analytics = antiBotSystem.getAnalytics();
        res.json({
            status: 'active',
            antiBotSystem: analytics,
            _timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            _timestamp: new Date().toISOString()
        });
    }
});

// ✅ System Health Check Endpoint
app.get('/health', (req, res) => {
    try {
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        // Perform basic health checks
        const healthStatus = {
            status: 'healthy',
            uptime: `${Math.floor(uptime / 60)} minutes`,
            memory: {
                used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
            },
            environment: process.env.NODE_ENV || 'development',
            platform: os.platform(),
            nodeVersion: process.version,
            performanceMetrics: performanceMonitor.getAnalytics(),
            antiBotMetrics: antiBotSystem.getAnalytics()
        };

        // Check for warning conditions
        const warnings = [];
        if (memoryUsage.heapUsed / 1024 / 1024 > 400) {
            warnings.push('High memory usage detected');
            healthStatus.status = 'warning';
        }

        if (warnings.length > 0) {
            healthStatus.warnings = warnings;
        }

        res.json(healthStatus);
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            _timestamp: new Date().toISOString()
        });
    }
});

// ✅ Export Performance Data Endpoint
app.post('/export-performance', async (req, res) => {
    try {
        const filePath = await performanceMonitor.exportPerformanceData();
        res.json({
            success: true,
            message: 'Performance data exported successfully',
            filePath: path.basename(filePath),
            _timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            _timestamp: new Date().toISOString()
        });
    }
});

// ✅ Extraction Logs Endpoint - Get recent extraction logs
app.get('/api/extraction-logs', (req, res) => {
    try {
        const {
            limit = 100,
            level = null,
            sessionId = null,
            format = 'json'
        } = req.query;

        const logs = extractionLogger.getRecentLogs(
            parseInt(limit),
            level,
            sessionId
        );

        const stats = extractionLogger.getStats();

        if (format === 'html') {
            // Return HTML formatted logs for easy browser viewing
            const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Extraction Logs</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: 'Courier New', monospace; background: #1a1a1a; color: #00ff00; margin: 20px; }
        .header { background: #333; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 20px; }
        .stat-card { background: #2a2a2a; padding: 10px; border-radius: 5px; border-left: 4px solid #00ff00; }
        .log-entry { margin: 10px 0; padding: 10px; background: #2a2a2a; border-radius: 5px; border-left: 4px solid #555; }
        .log-error { border-left-color: #ff4444; }
        .log-warn { border-left-color: #ffaa00; }
        .log-info { border-left-color: #4488ff; }
        .log-step { border-left-color: #00ff00; }
        .log-debug { border-left-color: #888; }
        .timestamp { color: #888; font-size: 0.9em; }
        .session-id { color: #00aaff; font-size: 0.9em; }
        .data { background: #1a1a1a; padding: 10px; margin: 5px 0; border-radius: 3px; font-size: 0.9em; overflow-x: auto; }
        .refresh-btn { background: #00ff00; color: #000; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 5px; }
        .filter-controls { margin: 10px 0; }
        .filter-controls select, .filter-controls input { background: #333; color: #fff; border: 1px solid #555; padding: 5px; margin: 0 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 SumNode Extraction Logs</h1>
        <p>Real-time extraction debugging for production environment</p>
        <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
        <button class="refresh-btn" onclick="autoRefresh()">⏰ Auto Refresh (30s)</button>
    </div>
    
    <div class="stats">
        <div class="stat-card"><strong>Total Logs:</strong> ${stats.totalLogs}</div>
        <div class="stat-card"><strong>Total Sessions:</strong> ${stats.totalSessions}</div>
        <div class="stat-card"><strong>Running Sessions:</strong> ${stats.runningSessions}</div>
        <div class="stat-card"><strong>Success Rate:</strong> ${stats.successRate}%</div>
        <div class="stat-card"><strong>Completed:</strong> ${stats.completedSessions}</div>
        <div class="stat-card"><strong>Failed:</strong> ${stats.failedSessions}</div>
    </div>

    <div class="filter-controls">
        <strong>Filters:</strong>
        <select onchange="filterLogs(this.value)" id="levelFilter">
            <option value="">All Levels</option>
            <option value="error">Errors Only</option>
            <option value="warn">Warnings Only</option>
            <option value="info">Info Only</option>
            <option value="step">Steps Only</option>
        </select>
        <input type="text" placeholder="Session ID" onchange="filterBySession(this.value)" id="sessionFilter">
        <button class="refresh-btn" onclick="clearFilters()">Clear Filters</button>
    </div>

    <div class="logs">
        ${logs.map(log => `
            <div class="log-entry log-${log.level}">
                <div class="timestamp">${log.timestamp}</div>
                ${log.sessionId ? `<div class="session-id">Session: ${log.sessionId}</div>` : ''}
                <div><strong>${log.level.toUpperCase()}:</strong> ${log.message}</div>
                ${log.data ? `<div class="data">${JSON.stringify(log.data, null, 2)}</div>` : ''}
            </div>
        `).join('')}
    </div>

    <script>
        function filterLogs(level) {
            const url = new URL(window.location);
            if (level) { url.searchParams.set('level', level); }
            else { url.searchParams.delete('level'); }
            window.location = url.toString();
        }
        
        function filterBySession(sessionId) {
            const url = new URL(window.location);
            if (sessionId) { url.searchParams.set('sessionId', sessionId); }
            else { url.searchParams.delete('sessionId'); }
            window.location = url.toString();
        }
        
        function clearFilters() {
            const url = new URL(window.location);
            url.searchParams.delete('level');
            url.searchParams.delete('sessionId');
            window.location = url.toString();
        }
        
        function autoRefresh() {
            setInterval(() => location.reload(), 30000);
            alert('Auto-refresh enabled (30 seconds)');
        }
    </script>
</body>
</html>`;
            return res.send(html);
        }

        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            stats,
            logs,
            filters: { limit, level, sessionId },
            helpText: 'Add ?format=html to view logs in browser-friendly format'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ✅ Get Specific Session Logs
app.get('/api/extraction-logs/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const sessionLogs = extractionLogger.getSessionLogs(sessionId);
        
        if (!sessionLogs) {
            return res.status(404).json({
                status: 'error',
                message: 'Session not found',
                sessionId
            });
        }

        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            session: sessionLogs
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ✅ Get Active Sessions
app.get('/api/extraction-sessions', (req, res) => {
    try {
        const sessions = extractionLogger.getActiveSessions();
        const stats = extractionLogger.getStats();

        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            stats,
            sessions
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ✅ Clear Extraction Logs (Emergency)
app.post('/api/extraction-logs/clear', (req, res) => {
    try {
        const clearedCount = extractionLogger.clearAllLogs();
        
        res.json({
            status: 'success',
            message: 'All extraction logs cleared',
            clearedCount,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ✅ System Health Dashboard
app.get('/api/system-health', (req, res) => {
    try {
        const { format = 'json' } = req.query;
        const currentHealth = systemHealthMonitor.getCurrentHealth();
        const healthHistory = systemHealthMonitor.getHealthHistory(50);
        
if (format === 'html') {
    const initialHistory = healthHistory.slice(-50); // send last 50 points for first render

    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>System Health Dashboard</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: 'Arial', sans-serif; background: #f5f5f5; margin: 20px; }
        .dashboard { max-width: 1400px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 25px; border-radius: 10px; margin-bottom: 25px; font-size: 1.2em; }
        .status-${currentHealth.status} { border-left: 6px solid ${currentHealth.status === 'healthy' ? '#27ae60' : currentHealth.status === 'warning' ? '#f39c12' : '#e74c3c'}; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 25px; }
        .card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 3px 15px rgba(0,0,0,0.1); font-size: 1.1em; }
        .metric { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #eee; font-size: 1.1em; }
        .metric:last-child { border-bottom: none; }
        .metric-value { font-weight: bold; color: #2c3e50; font-size: 1.2em; }
        canvas { max-width: 100%; height: 250px; }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header status-${currentHealth.status}">
            <h1>🏥 System Health Dashboard</h1>
            <p>Status: <strong id="statusText">${currentHealth.status.toUpperCase()}</strong> | Last Update: <span id="lastUpdate">${currentHealth.lastUpdate || 'Never'}</span></p>
        </div>

        <div class="grid">
            <div class="card">
                <h3>💾 Process Memory Usage (MB)</h3>
                <canvas id="processMemChart"></canvas>
            </div>

            <div class="card">
                <h3>🖥️ System Memory Usage (GB)</h3>
                <canvas id="systemMemChart"></canvas>
            </div>

            <div class="card">
                <h3>⚡ CPU Usage (%)</h3>
                <canvas id="cpuChart"></canvas>
            </div>
        </div>
    </div>

    <script>
        // Initial data
        const history = ${JSON.stringify(initialHistory)};
        
        function formatTime(ts) {
            return new Date(ts).toLocaleTimeString();
        }

        const processMemChart = new Chart(document.getElementById('processMemChart'), {
            type: 'line',
            data: {
                labels: history.map(h => formatTime(h.timestamp)),
                datasets: [{ label: 'Process MB', data: history.map(h => h.memory.used), borderColor: '#3498db', fill: false }]
            }
        });

        const systemMemChart = new Chart(document.getElementById('systemMemChart'), {
            type: 'line',
            data: {
                labels: history.map(h => formatTime(h.timestamp)),
                datasets: [{ label: 'System GB', data: history.map(h => h.system.totalMemory - h.system.freeMemory), borderColor: '#e67e22', fill: false }]
            }
        });

        const cpuChart = new Chart(document.getElementById('cpuChart'), {
            type: 'line',
            data: {
                labels: history.map(h => formatTime(h.timestamp)),
                datasets: [{ label: 'CPU %', data: history.map(h => h.system.cpuPercent), borderColor: '#2ecc71', fill: false }]
            }
        });

        // Function to update charts without reloading
        async function updateCharts() {
            try {
                const res = await fetch('/metrics');
                const data = await res.json();
                const latest = data.history.slice(-50);

                // Update labels & datasets
                processMemChart.data.labels = latest.map(h => formatTime(h.timestamp));
                processMemChart.data.datasets[0].data = latest.map(h => h.memory.used);
                processMemChart.update();

                systemMemChart.data.labels = latest.map(h => formatTime(h.timestamp));
                systemMemChart.data.datasets[0].data = latest.map(h => h.system.totalMemory - h.system.freeMemory);
                systemMemChart.update();

                cpuChart.data.labels = latest.map(h => formatTime(h.timestamp));
                cpuChart.data.datasets[0].data = latest.map(h => h.system.cpuPercent);
                cpuChart.update();

                // Update status text & last update
                document.getElementById('statusText').textContent = latest[latest.length-1]?.status?.toUpperCase() || 'UNKNOWN';
                document.getElementById('lastUpdate').textContent = latest[latest.length-1]?.timestamp || 'Never';

            } catch (err) {
                console.error('Error updating charts:', err);
            }
        }

        // Auto-update every 5 seconds
        setInterval(updateCharts, 5000);
    </script>
</body>
</html>`;
    return res.send(html);
}


        
        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            health: currentHealth,
            history: healthHistory,
            helpText: 'Add ?format=html for web dashboard view'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
// Example Express endpoint
app.get('/metrics', (req, res) => {
    const history = systemHealthMonitor.getHealthHistory(50); // last 50 readings
    res.json({
        history
    });
});

// ✅ Search History Endpoint
app.get('/api/search-history', (req, res) => {
    try {
        const {
            limit = 50,
            status = null,
            domain = null,
            isLinkedIn = null,
            format = 'json'
        } = req.query;

        const options = { limit: parseInt(limit), status, domain };
        if (isLinkedIn !== null) {
            options.isLinkedIn = isLinkedIn === 'true';
        }

        const searches = searchHistoryLogger.getRecentSearches(options);
        const analytics = searchHistoryLogger.getSearchAnalytics();

        if (format === 'html') {
            const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Search History</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: 'Courier New', monospace; background: #1a1a2e; color: #eee; margin: 20px; }
        .header { background: #16213e; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: #0f3460; padding: 15px; border-radius: 8px; text-align: center; }
        .search-table { width: 100%; border-collapse: collapse; background: #16213e; }
        .search-table th, .search-table td { padding: 12px; text-align: left; border-bottom: 1px solid #0f3460; }
        .search-table th { background: #0f3460; position: sticky; top: 0; }
        .status-success { color: #27ae60; }
        .status-failed { color: #e74c3c; }
        .status-cached { color: #3498db; }
        .domain { color: #f39c12; }
        .linkedin { background: #0077b5; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; }
        .refresh-btn { background: #27ae60; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 Search History Dashboard</h1>
        <p>Complete extraction search history and analytics</p>
        <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
        <button class="refresh-btn" onclick="exportHistory()">📁 Export</button>
    </div>
    
    <div class="stats-grid">
        <div class="stat-card">
            <h3>Total Searches</h3>
            <h2>${analytics.totalSearches}</h2>
        </div>
        <div class="stat-card">
            <h3>Success Rate</h3>
            <h2>${analytics.successRate}%</h2>
        </div>
        <div class="stat-card">
            <h3>Avg Duration</h3>
            <h2>${analytics.avgDuration}ms</h2>
        </div>
        <div class="stat-card">
            <h3>LinkedIn Success</h3>
            <h2>${analytics.linkedInStats.successRate}%</h2>
        </div>
        <div class="stat-card">
            <h3>Cache Hit Rate</h3>
            <h2>${analytics.cacheHitRate}%</h2>
        </div>
        <div class="stat-card">
            <h3>Last 24h</h3>
            <h2>${analytics.recentActivity.last24Hours}</h2>
        </div>
    </div>

    <table class="search-table">
        <thead>
            <tr>
                <th>Timestamp</th>
                <th>Domain</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Company</th>
                <th>Type</th>
            </tr>
        </thead>
        <tbody>
            ${searches.map(search => `
                <tr>
                    <td>${new Date(search.timestamp).toLocaleString()}</td>
                    <td class="domain">${search.domain}</td>
                    <td class="status-${search.status}">${search.status}</td>
                    <td>${search.performance.duration || 'N/A'}ms</td>
                    <td>${search.extraction.companyName || 'N/A'}</td>
                    <td>${search.extraction.isLinkedIn ? '<span class="linkedin">LinkedIn</span>' : 'Website'}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <script>
        function exportHistory() {
            window.open('/api/search-history/export', '_blank');
        }
    </script>
</body>
</html>`;
            return res.send(html);
        }

        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            analytics,
            searches,
            filters: { limit, status, domain, isLinkedIn },
            helpText: 'Add ?format=html for web dashboard view'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ✅ Search History Analytics
app.get('/api/search-analytics', (req, res) => {
    try {
        const analytics = searchHistoryLogger.getSearchAnalytics();
        
        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            analytics
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ✅ Export Search History
app.get('/api/search-history/export', async (req, res) => {
    try {
        const { format = 'json' } = req.query;
        const exportPath = await searchHistoryLogger.exportSearchHistory(format);
        
        res.json({
            status: 'success',
            message: 'Search history exported successfully',
            exportPath: path.basename(exportPath),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ✅ Detailed File Logs
app.get('/api/logs/:logType', async (req, res) => {
    try {
        const { logType } = req.params;
        const { limit = 100 } = req.query;
        
        const logs = await detailedFileLogger.readRecentLogs(logType, parseInt(limit));
        
        res.json({
            status: 'success',
            logType,
            count: logs.length,
            logs,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ✅ Log Files Status
app.get('/api/logs-status', async (req, res) => {
    try {
        const stats = await detailedFileLogger.getLogStats();
        
        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            logFiles: stats
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ✅ Search All Logs
app.get('/api/logs/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { limit = 50, logTypes } = req.query;
        
        const options = { limit: parseInt(limit) };
        if (logTypes) {
            options.logTypes = logTypes.split(',');
        }
        
        const results = await detailedFileLogger.searchLogs(query, options);
        
        res.json({
            status: 'success',
            query,
            resultCount: results.length,
            results,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ✅ Browser detection test endpoint
app.get('/test-browser', (req, res) => {
  try {
    const generalBrowserPath = getBrowserExecutablePath();
    const linkedinBrowserPath = getBrowserExecutablePathForLinkedIn();
    
    res.json({
      success: true,
      environment: process.env.NODE_ENV || 'development',
      isRender: !!process.env.RENDER,
      generalBrowser: generalBrowserPath || 'Puppeteer bundled Chromium',
      linkedinBrowser: linkedinBrowserPath || 'Puppeteer bundled Chromium',
      platform: os.platform(),
      puppeteerCacheDir: process.env.PUPPETEER_CACHE_DIR || 'default'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ Enhanced server startup with auto-initialization
async function startServer() {
  try {
    // Step 1: Auto-initialize all systems
    console.log('🚀 Starting LinkedIn Banner Extraction System...');
    
    const { AutoInitializationSystem } = require('./auto-initialization-system');
    const autoInit = new AutoInitializationSystem();
    
    const initResult = await autoInit.initialize();
    
    if (!initResult.success) {
      console.error('❌ Auto-initialization failed. Starting in limited mode...');
      if (!initResult.fallback) {
        console.error('💥 Critical failure - cannot start server');
        process.exit(1);
      }
    }
    
    // Step 2: Ensure Chrome is available
    console.log('🔧 Ensuring Chrome availability...');
    const chromeReady = await ensureChrome();
    
    if (!chromeReady) {
      console.error('❌ Failed to initialize Chrome. Server may not work properly.');
      // Continue anyway - some endpoints might still work
    }
    
    // Step 3: Start the Express server
    app.listen(port, () => {
      console.log('\n' + '='.repeat(65));
      console.log('🎉 LINKEDIN BANNER EXTRACTION SYSTEM READY');
      console.log('='.repeat(65));
      console.log(`🌐 Server running on port ${port}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔧 Chrome Status: ${chromeReady ? '✅ Ready' : '⚠️  Limited'}`);
      console.log(`🧠 Adaptive Mode: ${process.env.ADAPTIVE_MODE !== 'false' ? '✅ Enabled' : '❌ Disabled'}`);
      console.log('='.repeat(65));
      console.log('📋 Available Endpoints:');
      console.log('   POST /api/extract-company-details - Main extraction endpoint');
      console.log('   GET  /api/extraction-logs         - Real-time extraction logs');
      console.log('   GET  /api/extraction-sessions     - Active extraction sessions');
      console.log('   GET  /api/system-health           - System health dashboard');
      console.log('   GET  /api/search-history          - Search history & analytics');
      console.log('   GET  /api/logs/:type              - Detailed file logs');
      console.log('   GET  /health                      - System health check');
      console.log('   GET  /linkedin-metrics            - LinkedIn extraction metrics');
      console.log('   GET  /performance-metrics         - Performance analytics');
      console.log('   GET  /anti-bot-status             - Anti-bot system status');
      console.log('   GET  /test                        - Basic API test');
      console.log('   GET  /test-browser                - Browser compatibility test');
      console.log('='.repeat(65));
      
      if (initResult.success) {
        console.log('✅ All systems initialized successfully!');
        console.log('🎯 System is ready for production use');
      } else {
        console.log('⚠️  System running in limited mode');
        console.log('🔧 Some advanced features may not be available');
      }
      
      console.log('='.repeat(65));
    });
    
  } catch (error) {
    console.error('💥 Server startup failed:', error);
    console.error('\n🔧 Attempting emergency startup...');
    
    try {
      // Emergency startup without auto-initialization
      app.listen(port, () => {
        console.log('⚠️  Emergency mode: Server running on port', port);
        console.log('🚨 Limited functionality - some features may not work');
        console.log('💡 Try running: node deploy-adaptive-system.js');
      });
    } catch (emergencyError) {
      console.error('💥 Emergency startup also failed:', emergencyError);
      process.exit(1);
    }
  }
}

// Enhanced health endpoint with auto-initialization status
app.get('/status', (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Get adaptive system status if available
    let adaptiveStatus = null;
    try {
      const { AdaptiveConfigManager } = require('./adaptive-config-manager');
      const adaptiveConfig = new AdaptiveConfigManager();
      adaptiveConfig.initialize().then(() => {
        adaptiveStatus = adaptiveConfig.getSystemStatus();
      }).catch(() => {
        adaptiveStatus = { error: 'Adaptive system not available' };
      });
    } catch (error) {
      adaptiveStatus = { error: 'Adaptive system not installed' };
    }
    
    const status = {
      system: 'LinkedIn Banner Extraction System',
      status: 'operational',
      uptime: `${Math.floor(uptime / 60)} minutes`,
      memory: {
        used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
      },
      environment: process.env.NODE_ENV || 'development',
      adaptiveMode: process.env.ADAPTIVE_MODE !== 'false',
      verboseLogging: process.env.VERBOSE_LOGGING === 'true',
      platform: os.platform(),
      nodeVersion: process.version,
      adaptiveSystem: adaptiveStatus,
      endpoints: {
        extraction: '/api/extract-company-details',
        extractionLogs: '/api/extraction-logs',
        extractionSessions: '/api/extraction-sessions',
        systemHealth: '/api/system-health',
        searchHistory: '/api/search-history',
        detailedLogs: '/api/logs/:type',
        health: '/health',
        metrics: '/linkedin-metrics',
        performance: '/performance-metrics',
        antiBotStatus: '/anti-bot-status'
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(status);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Start the server with auto-initialization
startServer();

/* 
PERFORMANCE OPTIMIZATIONS IMPLEMENTED:

1. SMART NAVIGATION TIMEOUTS:
   - Adaptive timeout strategy: try fast (15s DOM), then medium (45s load), then fallback (60s networkidle2)
   - Reduced retry attempts from 3 to 2 for faster failure handling

2. INTELLIGENT RESOURCE BLOCKING:
   - Block heavy media, analytics, tracking, social media embeds
   - Keep essential resources like CSS, JS, and woff2 fonts
   - Significantly reduces page load time

3. PARALLEL PROCESSING:
   - All main extraction functions run in parallel with individual timeouts
   - LinkedIn extraction runs separately with graceful failure handling
   - Each extraction type has optimized timeout (15-30s)

4. SMART CACHING:
   - 10-minute in-memory cache for repeated requests
   - Automatic cache cleanup to prevent memory leaks
   - Cache hit returns results instantly

5. OPTIMIZED DATA EXTRACTION:
   - Reduced number of elements processed (3 instead of 5 per selector)
   - Limited color extraction to 4 colors instead of 6
   - Limited image extraction to 2 images instead of 4
   - Faster browser launch timeouts (60s instead of 120s)

6. GRACEFUL DEGRADATION:
   - Individual extraction failures don't break entire process
   - LinkedIn extraction is optional and non-blocking
   - Performance monitoring and timing information

7. REDUCED OVERALL TIMEOUTS:
   - Main extraction: 4 minutes (was 10 minutes)
   - LinkedIn extraction: 2 minutes (was 5 minutes)
   - Individual extractions: 15-30 seconds each

EXPECTED PERFORMANCE IMPROVEMENT:
- 60-70% faster for typical websites
- 80%+ faster for cached requests
- More reliable with graceful failure handling
- Better resource utilization
*/
// Utility functions grouped into an object
const utils = {
    /**
     * Validates if a given string is a valid URL.
     * @param {string} url - The URL string to validate.
     * @returns {boolean} True if the URL is valid, false otherwise.
     */
 normalizeUrl(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }
    
    url = url.trim();
    
    // Handle empty string after trimming
    if (!url) {
        return null;
    }
    
    // Handle incomplete protocol URLs
    if (url === 'http://' || url === 'https://') {
        return null;
    }
    
    // Remove trailing slash if present (except for root domain)
    if (url.endsWith('/') && url.length > 1) {
        url = url.slice(0, -1);
    }
    
    // Add https:// if not already present
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    
    return url;
},

 isValidUrl(url) {
    try {
        const normalized = utils.normalizeUrl(url);
        if (!normalized) {
            return false;
        }
        new URL(normalized);
        return true;
    } catch (e) {
        return false;
    }
},



    /**
     * Checks if the domain of a given URL is resolvable via DNS.
     * @param {string} url - The URL string to check.
     * @returns {Promise<boolean>} True if the domain is resolvable, false otherwise.
     */
    async isDomainResolvable(url) {
        try {
            const domain = new URL(url).hostname;
            await dns.lookup(domain);
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Calculates the Euclidean distance between two RGB colors.
     * @param {number} r1 - Red component of the first color.
     * @param {number} g1 - Green component of the first color.
     * @param {number} b1 - Blue component of the first color.
     * @param {number} r2 - Red component of the second color.
     * @param {number} g2 - Green component of the second color.
     * @param {number} b2 - Blue component of the second color.
     * @returns {number} The distance between the two colors.
     */
    calculateColorDistance(r1, g1, b1, r2, g2, b2) {
        return Math.sqrt(
            Math.pow(r2 - r1, 2) +
            Math.pow(g2 - g1, 2) +
            Math.pow(b2 - b1, 2)
        );
    },

    /**
     * Parses an RGB color string (e.g., "rgb(255, 0, 0)") into an object with r, g, b components.
     * @param {string} colorStr - The RGB color string.
     * @returns {{r: number, g: number, b: number}|null} An object with r, g, b properties, or null if parsing fails.
     */
    getRGBFromString(colorStr) {
        if (!colorStr) return null; // Handle null or undefined input
        // Updated regex to match rgb(r,g,b) or rgba(r,g,b,a)
        const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
        if (match) {
            return {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3])
            };
        }
        return null;
    },

    /**
     * Groups similar colors together based on a distance threshold.
     * @param {Array<{color: string, count: number}>} colors - An array of color objects, each with a color string and a count.
     * @param {number} [threshold=30] - The maximum distance for colors to be considered similar.
     * @returns {Array<object>} An array of color groups, sorted by count.
     */
    groupSimilarColors(colors, threshold = 30) {
        const groups = [];
        for (const color of colors) {
            const rgb = this.getRGBFromString(color.color);
            if (!rgb) continue;

            let foundGroup = false;
            for (const group of groups) {
                const groupRGB = this.getRGBFromString(group.color);
                if (!groupRGB) continue;

                const distance = this.calculateColorDistance(
                    rgb.r, rgb.g, rgb.b,
                    groupRGB.r, groupRGB.g, groupRGB.b
                );

                if (distance <= threshold) {
                    group.colors.push(color);
                    group.count += color.count;
                    foundGroup = true;
                    break;
                }
            }

            if (!foundGroup) {
                groups.push({
                    color: color.color,
                    count: color.count,
                    colors: [color]
                });
            }
        }
        return groups.sort((a, b) => b.count - a.count);
    },

    /**
     * Gets the closest human-readable name for a given RGB color.
     * @param {number} r - Red component of the color.
     * @param {number} g - Green component of the color.
     * @param {number} b - Blue component of the color.
     * @returns {string} The name of the closest color (e.g., "red", "blue", "unknown").
     */
    getColorName(r, g, b) {
        const colors = {
            'red': [255, 0, 0], 'green': [0, 255, 0], 'blue': [0, 0, 255],
            'yellow': [255, 255, 0], 'cyan': [0, 255, 255], 'magenta': [255, 0, 255],
            'white': [255, 255, 255], 'black': [0, 0, 0], 'gray': [128, 128, 128],
            'orange': [255, 165, 0], 'purple': [128, 0, 128], 'brown': [165, 42, 42],
            'pink': [255, 192, 203]
        };
        let minDistance = Infinity;
        let closestColor = 'unknown';
        for (const [name, [cr, cg, cb]] of Object.entries(colors)) {
            const distance = this.calculateColorDistance(r, g, b, cr, cg, cb);
            if (distance < minDistance) {
                minDistance = distance;
                closestColor = name;
            }
        }
        return closestColor;
    },

    /**
     * Generates lighter, darker, and complementary variations of a given RGB color.
     * @param {number} r - Red component of the color.
     * @param {number} g - Green component of the color.
     * @param {number} b - Blue component of the color.
     * @returns {{lighter: string, darker: string, complementary: string}} An object with RGB strings for lighter, darker, and complementary colors.
     */
    getColorVariations(r, g, b) {
        return {
            lighter: `rgb(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 30)})`,
            darker: `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`,
            complementary: `rgb(${255 - r}, ${255 - g}, ${255 - b})`
        };
    },

    /**
     * Calculates the contrast ratio between two RGB colors.
     * @param {number} r1 - Red component of the first color.
     * @param {number} g1 - Green component of the first color.
     * @param {number} b1 - Blue component of the first color.
     * @param {number} r2 - Red component of the second color.
     * @param {number} g2 - Green component of the second color.
     * @param {number} b2 - Blue component of the second color.
     * @returns {number} The contrast ratio.
     */
    calculateContrast(r1, g1, b1, r2, g2, b2) {
        const l1 = 0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1;
        const l2 = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    },

    /**
     * Converts RGB color components to a hex color string.
     * @param {number} r - Red component.
     * @param {number} g - Green component.
     * @param {number} b - Blue component.
     * @returns {string} The hex color string (e.g., "#RRGGBB").
     */
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
};

/**
 * Get advanced rotating user agent with anti-bot features
 */
function getUserAgent(forceRotation = false) {
    return antiBotSystem.getRandomUserAgent(forceRotation);
}

/**
 * Get comprehensive browser headers for anti-detection
 */
function getBrowserHeaders() {
    return antiBotSystem.getBrowserHeaders();
}

/**
 * Get advanced browser arguments with stealth features
 */
function getAdvancedBrowserArgs() {
    return antiBotSystem.getAdvancedBrowserArgs();
}

/**
 * Get Linux-specific Chrome arguments (mainly for production)
 */
function getLinuxSpecificArgs() {
    // Use enhanced browser args that include platform-specific optimizations
    return getAdvancedBrowserArgs().filter(arg => 
        arg.includes('--single-process') || 
        arg.includes('--disable-gpu') ||
        arg.includes('--disable-web-security')
    );
}



/**
 * Update LinkedIn metrics and log detailed information
 */
function updateLinkedInMetrics(success, error = null, extractedData = null) {
    linkedInMetrics.totalAttempts++;
    linkedInMetrics.lastUpdated = new Date().toISOString();
    
    if (success) {
        linkedInMetrics.successfulExtractions++;
        logger.info('LinkedIn extraction succeeded', { 
            details: { 
                successRate: `${((linkedInMetrics.successfulExtractions / linkedInMetrics.totalAttempts) * 100).toFixed(1)}%`,
                totalAttempts: linkedInMetrics.totalAttempts,
                hasName: !!extractedData?.name,
                hasDescription: !!extractedData?.description,
                hasLogo: !!extractedData?.logoUrl,
                hasBanner: !!extractedData?.bannerUrl
            } 
        });
    } else {
        linkedInMetrics.failedExtractions++;
        const errorCategory = error?.message?.includes('timeout') ? 'timeout' : 
                             error?.message?.includes('navigation') ? 'navigation' : 
                             error?.message?.includes('selector') ? 'parsing' : 'other';
        
        linkedInMetrics.errorCategories[errorCategory] = (linkedInMetrics.errorCategories[errorCategory] || 0) + 1;
        
        logger.error('LinkedIn extraction failed', error, { 
            details: { 
                errorCategory,
                successRate: `${((linkedInMetrics.successfulExtractions / linkedInMetrics.totalAttempts) * 100).toFixed(1)}%`,
                totalAttempts: linkedInMetrics.totalAttempts,
                errorDistribution: linkedInMetrics.errorCategories
            } 
        });
    }
}

/**
 * Provide fallback colors for LinkedIn images when extraction fails
 * Returns appropriate colors based on context (banner vs logo)
 */
function getLinkedInFallbackColors(context) {
    const contextLower = context.toLowerCase();
    
    if (contextLower.includes('banner') || contextLower.includes('background')) {
        // LinkedIn brand blue and complementary colors for banners
        return {
            colors: ['#0077B5', '#005885', '#00A0DC', '#FFFFFF', '#F3F6F8'],
            hex: '#0077B5',
            rgb: 'rgb(0,119,181)'
        };
    } else if (contextLower.includes('logo')) {
        // More neutral colors for logos
        return {
            colors: ['#0077B5', '#FFFFFF', '#F3F6F8', '#005885', '#666666'],
            hex: '#0077B5',
            rgb: 'rgb(0,119,181)'
        };
    } else {
        // Default LinkedIn colors
        return {
            colors: ['#0077B5', '#005885', '#FFFFFF', '#F3F6F8', '#666666'],
            hex: '#0077B5',
            rgb: 'rgb(0,119,181)'
        };
    }
}

/**
 * Try alternative LinkedIn image URLs when the original fails
 * LinkedIn sometimes blocks direct image access but allows alternative formats
 */
async function tryAlternativeLinkedInImageUrl(originalUrl, context) {
    try {
        // Only process LinkedIn URLs
        if (!originalUrl.includes('linkedin.com') && !originalUrl.includes('licdn.com')) {
            return null;
        }
        
        logger.debug(`Trying alternative LinkedIn image strategies for ${context}`, { 
            details: { originalUrl } 
        });
        
        // Strategy 1: Try different image sizes/formats
        const alternatives = [];
        
        // If it's a company banner/background image
        if (originalUrl.includes('/sc/h/')) {
            // Try different size variants
            alternatives.push(originalUrl.replace('/sc/h/', '/sc/p/'));
            alternatives.push(originalUrl + '/shrink_200_200');
            alternatives.push(originalUrl + '/shrink_400_400');
        }
        
        // If it's a logo image
        if (originalUrl.includes('company-logo')) {
            alternatives.push(originalUrl.replace('company-logo', 'company-logo_100_100'));
            alternatives.push(originalUrl.replace('company-logo', 'company-logo_200_200'));
        }
        
        // Strategy 2: Try adding common LinkedIn image parameters
        const urlObj = new URL(originalUrl);
        alternatives.push(`${originalUrl}?v=beta&t=${Date.now()}`);
        alternatives.push(`${originalUrl}?trk=public_profile_browsemap`);
        
        // Strategy 3: Try removing parameters that might cause issues
        const cleanUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
        if (cleanUrl !== originalUrl) {
            alternatives.push(cleanUrl);
        }
        
        // Test each alternative (but don't recurse infinitely)
        for (const altUrl of alternatives) {
            try {
                logger.debug(`Testing alternative LinkedIn URL: ${altUrl}`);
                
                const testResponse = await axios({
                    method: 'head', // Just check headers, don't download
                    url: altUrl,
                    timeout: 5000,
                    headers: {
                        'User-Agent': getUserAgent(),
                        'Referer': 'https://www.linkedin.com/',
                        'Accept': 'image/*'
                    }
                });
                
                const contentType = testResponse.headers['content-type'] || '';
                if (contentType.startsWith('image/')) {
                    logger.info(`Found working alternative LinkedIn image URL for ${context}`, { 
                        details: { original: originalUrl, alternative: altUrl, contentType } 
                    });
                    return altUrl;
                }
            } catch (error) {
                // Continue to next alternative
                logger.debug(`Alternative URL failed: ${altUrl} - ${error.message}`);
            }
        }
        
        logger.warn(`No working alternative LinkedIn image URL found for ${context}`);
        return null;
        
    } catch (error) {
        logger.warn(`Error trying alternative LinkedIn image URLs for ${context}`, error);
        return null;
    }
}

/**
 * Browser-based image extraction for better reliability
 * Uses Puppeteer to navigate to image URLs instead of direct HTTP requests
 * WITH RESOURCE LEAK PREVENTION
 */
async function extractImageWithBrowser(imageUrl, context = 'image') {
    let browser = null;
    let page = null;
    let tempImagePath = null;
    const timeout = 15000; // Fixed timeout to prevent hanging
    
    try {
        // SAFETY: Check browser limit before launching
        if (!browserManager.canLaunchBrowser()) {
            logger.warn(`Browser launch skipped - too many active browsers`, { 
                details: { active: browserManager.activeBrowsers, max: browserManager.maxConcurrentBrowsers } 
            });
            return null; // Fallback to HTTP method
        }
        
        logger.debug(`Starting browser-based image extraction for ${context}`, { details: { imageUrl } });
        
        // Launch a lightweight browser instance for image extraction
        const browserPath = getBrowserExecutablePath();
        
        // Use LinkedIn-specific browser args if it's a LinkedIn image
        const isLinkedInImage = linkedinAntiBot.isLinkedInImageUrl(imageUrl);
        const browserArgs = isLinkedInImage ? 
            linkedinAntiBot.getLinkedInBrowserArgs() : 
            [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--no-first-run',
                '--disable-extensions',
                '--disable-plugins',
                '--memory-pressure-off',
                '--max_old_space_size=256'
            ];
        
        const launchOptions = {
            headless: 'new',
            args: browserArgs,
            timeout: 30000,
            // Prevent resource exhaustion
            defaultViewport: { width: 800, height: 600 },
            devtools: false
        };
        
        if (browserPath) {
            launchOptions.executablePath = browserPath;
        }
        
        // Add timeout wrapper to prevent hanging
        browser = await Promise.race([
            puppeteer.launch(launchOptions),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Browser launch timeout')), 30000)
            )
        ]);
        
        // SAFETY: Register browser instance
        browserManager.registerBrowser();
        
        page = await browser.newPage();
        
        // Set resource limits
        await page.setViewport({ width: 800, height: 600 });
        await page.setDefaultTimeout(timeout);
        
        // **ENHANCED: LinkedIn-specific anti-bot measures**
        if (linkedinAntiBot.isLinkedInImageUrl(imageUrl)) {
            logger.debug('Applying advanced LinkedIn-specific anti-bot measures');
            
            // Setup LinkedIn stealth mode
            await linkedinAntiBot.setupLinkedInStealthMode(page);
            
            // Set LinkedIn-optimized headers
            const linkedinHeaders = linkedinAntiBot.getLinkedInImageHeaders(imageUrl);
            await page.setExtraHTTPHeaders(linkedinHeaders);
            
            // Set LinkedIn-optimized user agent
            const linkedinUserAgent = linkedinAntiBot.getLinkedInOptimizedUserAgent();
            await page.setUserAgent(linkedinUserAgent);
            
            // Implement human-like delay
            await linkedinAntiBot.implementHumanDelay();
            
            linkedinAntiBot.logActivity('LinkedIn image extraction initiated', { 
                imageUrl, 
                userAgent: linkedinUserAgent.split(' ')[2],
                environment: linkedinAntiBot.isProduction() ? 'production' : 'development'
            });
        }
        
        // Navigate with strict timeout
        logger.debug(`Navigating to image URL: ${imageUrl}`);
        await Promise.race([
            page.goto(imageUrl, { 
                waitUntil: 'domcontentloaded', // Faster than 'load'
                timeout: timeout 
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Navigation timeout')), timeout)
            )
        ]);
        
        // **ENHANCED: Check if we got an actual image or error page**
        const pageContent = await page.content();
        const isErrorPage = pageContent.includes('<html') || 
                           pageContent.includes('<?xml') || 
                           pageContent.includes('error') ||
                           pageContent.includes('Access Denied') ||
                           pageContent.includes('Forbidden');
        
        if (isErrorPage) {
            logger.warn(`Detected error page instead of image for ${context}`, { 
                details: { imageUrl, contentPreview: pageContent.substring(0, 200) } 
            });
            return null; // Trigger fallback to HTTP method
        }
        
        // Take a screenshot with timeout
        const tempDir = os.tmpdir();
        const fileName = `browser_image_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
        tempImagePath = path.join(tempDir, fileName);
        
        await Promise.race([
            page.screenshot({ 
                path: tempImagePath, 
                fullPage: false,
                type: 'png',
                quality: 80, // Reduce file size
                clip: { x: 0, y: 0, width: 800, height: 600 } // Limit screenshot area
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Screenshot timeout')), 10000)
            )
        ]);
        
        logger.info(`Browser-based image extraction successful for ${context}`, { 
            details: { imageUrl, tempPath: tempImagePath } 
        });
        
        return tempImagePath;
        
    } catch (error) {
        logger.error(`Browser-based image extraction failed for ${context}`, error, { 
            details: { imageUrl, fallbackToAxios: true, timeout: timeout } 
        });
        
        // Return null to trigger fallback to axios method
        return null;
        
    } finally {
        // CRITICAL: Always cleanup resources
        try {
            if (page) {
                await page.close();
            }
        } catch (cleanupError) {
            logger.debug('Page cleanup warning', { details: { error: cleanupError.message } });
        }
        
        try {
            if (browser) {
                await browser.close();
                // SAFETY: Unregister browser instance
                browserManager.unregisterBrowser();
            }
        } catch (cleanupError) {
            logger.debug('Browser cleanup warning', { details: { error: cleanupError.message } });
        }
    }
}

/**
 * SAFETY: Global browser instance tracking to prevent resource exhaustion
 */
const browserManager = {
    activeBrowsers: 0,
    maxConcurrentBrowsers: 3, // Limit concurrent browsers
    
    canLaunchBrowser() {
        return this.activeBrowsers < this.maxConcurrentBrowsers;
    },
    
    registerBrowser() {
        this.activeBrowsers++;
        logger.debug(`Browser instance started`, { details: { active: this.activeBrowsers, max: this.maxConcurrentBrowsers } });
    },
    
    unregisterBrowser() {
        this.activeBrowsers = Math.max(0, this.activeBrowsers - 1);
        logger.debug(`Browser instance ended`, { details: { active: this.activeBrowsers, max: this.maxConcurrentBrowsers } });
    }
};

/**
 * Enhanced logging utility for better error tracking and debugging
 */
const logger = {
    info: (message, context = {}) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] INFO: ${message}`, context.details ? `| Details: ${JSON.stringify(context.details)}` : '');
    },
    
    warn: (message, context = {}) => {
        const timestamp = new Date().toISOString();
        console.warn(`[${timestamp}] WARN: ${message}`, context.details ? `| Details: ${JSON.stringify(context.details)}` : '');
    },
    
    error: (message, error, context = {}) => {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ERROR: ${message}`);
        if (error) {
            console.error(`[${timestamp}] ERROR Stack:`, error.stack || error.message || error);
        }
        if (context.details) {
            console.error(`[${timestamp}] ERROR Details:`, JSON.stringify(context.details, null, 2));
        }
    },
    
    debug: (message, context = {}) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] DEBUG: ${message}`, context.details ? `| Details: ${JSON.stringify(context.details)}` : '');
    }
};

/**
 * Retry utility with exponential backoff for robust error handling
 */
async function retryWithBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 10000,
        backoffMultiplier = 2,
        operation = 'operation'
    } = options;
    
    // SAFETY: Enforce absolute limits to prevent infinite loops
    const absoluteMaxRetries = Math.min(Math.max(maxRetries, 1), 5); // Between 1 and 5
    const safeMaxDelay = Math.min(maxDelay, 30000); // Max 30 seconds
    
    let attempt = 0;
    let lastError;
    
    while (attempt < absoluteMaxRetries) {
        try {
            logger.debug(`Attempting ${operation}`, { details: { attempt: attempt + 1, maxRetries: absoluteMaxRetries } });
            
            // SAFETY: Add timeout wrapper to prevent hanging functions
            const result = await Promise.race([
                fn(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`${operation} operation timeout after 30s`)), 30000)
                )
            ]);
            
            if (attempt > 0) {
                logger.info(`${operation} succeeded after ${attempt + 1} attempts`);
            }
            
            return result;
        } catch (error) {
            attempt++;
            lastError = error;
            
            // SAFETY: Don't retry certain fatal errors to prevent infinite loops
            if (error.message.includes('ENOTFOUND') || 
                error.message.includes('ECONNREFUSED') ||
                error.message.includes('Invalid URL') ||
                error.message.includes('EACCES') ||
                error.message.includes('permission denied')) {
                logger.error(`${operation} failed with non-retryable error`, error);
                throw lastError;
            }
            
            logger.warn(`${operation} failed on attempt ${attempt}`, { 
                details: { 
                    error: error.message,
                    attempt,
                    maxRetries: absoluteMaxRetries,
                    willRetry: attempt < absoluteMaxRetries,
                    errorType: error.name || 'UnknownError'
                }
            });
            
            if (attempt >= absoluteMaxRetries) {
                logger.error(`${operation} failed after ${absoluteMaxRetries} attempts`, lastError);
                throw lastError;
            }
            
            // Calculate delay with exponential backoff and jitter
            const baseDelay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
            const jitter = Math.random() * 1000; // Add randomness to prevent thundering herd
            const delay = Math.min(baseDelay + jitter, safeMaxDelay);
            
            logger.debug(`Waiting ${Math.round(delay)}ms before retry`);
            
            // SAFETY: Use AbortController pattern for cancellable delays
            await new Promise((resolve) => {
                const timeoutId = setTimeout(resolve, delay);
                // Cleanup mechanism (could be enhanced with AbortController if needed)
                process.once('SIGINT', () => {
                    clearTimeout(timeoutId);
                    resolve();
                });
            });
        }
    }
    
    throw lastError;
}

/**
 * Enhanced browser launch with detailed error logging and retry mechanism
 */
async function launchBrowserWithRetry(launchOptions, context = '') {
    return await retryWithBackoff(async () => {
        const browserPath = launchOptions.executablePath;
        logger.info(`Launching browser ${context}`, { 
            details: {
                browserPath: browserPath || 'Puppeteer bundled Chromium',
                platform: os.platform(),
                isProduction: !!(process.env.NODE_ENV === 'production' || process.env.RENDER)
            }
        });
        
        try {
            const browser = await puppeteer.launch(launchOptions);
            logger.info(`Browser launched successfully ${context}`);
            return browser;
        } catch (error) {
            logger.error(`Browser launch failed ${context}`, error, {
                details: {
                    browserPath: browserPath || 'Puppeteer bundled Chromium',
                    launchArgs: launchOptions.args,
                    timeout: launchOptions.timeout
                }
            });
            throw error;
        }
    }, {
        maxRetries: 3,
        initialDelay: 2000,
        operation: `browser launch ${context}`
    });
}

/**
 * Enhanced page navigation with retry and detailed error logging
 */
async function navigateToPageWithRetry(page, url, options = {}) {
    const { timeout = 45000, waitUntil = 'domcontentloaded', context = '' } = options;
    
    return await retryWithBackoff(async () => {
        logger.debug(`Navigating to URL ${context}`, { details: { url, timeout, waitUntil } });
        
        try {
            const response = await page.goto(url, {
                waitUntil: waitUntil,
                timeout: timeout
            });
            
            if (!response) {
                throw new Error('Navigation returned null response');
            }
            
            const status = response.status();
            logger.info(`Navigation successful ${context}`, { 
                details: { 
                    url, 
                    status,
                    finalUrl: page.url()
                }
            });
            
            if (status >= 400) {
                throw new Error(`HTTP ${status} error for URL: ${url}`);
            }
            
            return response;
        } catch (error) {
            logger.error(`Navigation failed ${context}`, error, {
                details: {
                    url,
                    timeout,
                    waitUntil,
                    currentUrl: page.url()
                }
            });
            throw error;
        }
    }, {
        maxRetries: 2,
        initialDelay: 3000,
        operation: `page navigation ${context}`
    });
}

/**
 * Sets up a Puppeteer browser instance and a new page, then navigates to the given URL.
 * Includes error handling for browser launch and page navigation.
 * This version is specifically for the /api/extract-company-details endpoint.
 * @param {string} url - The URL to navigate to.
 * @returns {Promise<{browser: import('puppeteer').Browser, page: import('puppeteer').Page}>} A promise that resolves to an object containing the browser and page objects.
 * @throws Will throw an error if Puppeteer setup or navigation fails.
 */
async function setupPuppeteerPageForCompanyDetails(url) {
    logger.info('Setting up browser for company details extraction', { details: { url } });
    
    const browserPath = getBrowserExecutablePath();
    
    const launchOptions = {
        args: getAdvancedBrowserArgs(),
        headless: 'new', // Use new headless mode for better compatibility
        defaultViewport: antiBotSystem.getRandomViewport(),
        timeout: 60000,
        protocolTimeout: 180000,
        // Advanced stealth features
        ignoreDefaultArgs: ['--enable-automation'],
        ignoreHTTPSErrors: true
    };

    // Only set executablePath if we found a specific browser
    if (browserPath) {
        launchOptions.executablePath = browserPath;
    }
    
    // Launch browser with enhanced retry and logging
    const browser = await launchBrowserWithRetry(launchOptions, 'for company details');

    try {
        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(180000); // Default navigation timeout (3 minutes)
        await page.setViewport({ width: 1366, height: 768 }); // LinkedIn-optimized viewport
        
        // **LINKEDIN-SPECIFIC: Add enhanced headers for better compatibility**
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        });

        // **SIMPLIFIED: Minimal request interception for LinkedIn compatibility**
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const url = req.url();
            const resourceType = req.resourceType();
            
            // Only block obviously unnecessary resources, allow everything else for LinkedIn
            if (url.includes('google-analytics') ||
                url.includes('googletagmanager') ||
                url.includes('doubleclick') ||
                url.includes('facebook.com/tr') ||
                (resourceType === 'media' && (url.includes('.mp4') || url.includes('.mov')))) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Navigation with retry logic and progressive wait conditions
        let response;
        let navigationSuccess = false;
        let lastError;
        
        // Smart navigation with adaptive timeouts - try fast first, fallback to slower
        const waitConditions = [
            { condition: 'domcontentloaded', timeout: 15000 },  // Fast DOM load
            { condition: 'load', timeout: 45000 },              // Full load with reasonable timeout
            { condition: 'networkidle2', timeout: 60000 }       // Fallback for complex sites
        ];
        
        for (let attempt = 1; attempt <= 2; attempt++) {
            for (let conditionIndex = 0; conditionIndex < waitConditions.length; conditionIndex++) {
                const { condition: waitCondition, timeout } = waitConditions[conditionIndex];
                
                try {
                    logger.debug(`Navigation attempt ${attempt}/2 with '${waitCondition}'`, { 
                        details: { timeout: `${timeout/1000}s`, url } 
                    });
                    
                    response = await page.goto(url, {
                        waitUntil: waitCondition,
                        timeout: timeout
                    });
                    
                    navigationSuccess = true;
                    logger.info(`Navigation succeeded with '${waitCondition}' on attempt ${attempt}`);
                    break;
                } catch (error) {
                    lastError = error;
                    logger.warn(`Navigation failed with '${waitCondition}'`, { 
                        details: { error: error.message, attempt } 
                    });
                    
                    // If this was the last condition, break to try next attempt
                    if (conditionIndex === waitConditions.length - 1) {
                        break;
                    }
                }
            }
            
            if (navigationSuccess) break;
            
            if (attempt < 2) {
                logger.debug('Waiting before navigation retry', { details: { delay: '2 seconds' } });
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        if (!navigationSuccess) {
            // Final fallback attempt with minimal requirements
            logger.warn('Attempting final fallback navigation');
            try {
                response = await page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });
                navigationSuccess = true;
                logger.info('Fallback navigation succeeded');
            } catch (fallbackError) {
                logger.error('All navigation attempts failed', fallbackError, {
                    details: { originalError: lastError.message, url }
                });
                throw new Error(`Navigation failed completely. Last error: ${lastError.message}, Fallback error: ${fallbackError.message}`);
            }
        }

        if (!response) {
            throw new Error('Failed to load the page: No response received.');
        }

        if (!response.ok()) {
            logger.warn(`HTTP ${response.status()} response but continuing`, { 
                details: { url, status: response.status() } 
            });
        }
        
        // Give the page a moment to settle after navigation (reduced delay)
        await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced from 2000ms to 1000ms
        return { browser, page };
    } catch (error) {
        if (browser) {
            await browser.close(); // Ensure browser is closed on error during setup
        }
        // Re-throw the error to be caught by the endpoint's main try-catch block
        if (error.message && error.message.includes(url)) {
            throw error; // Error message already contains URL and potentially status
        } else {
            // Add URL context if not present
            throw new Error(`Puppeteer setup or navigation failed for URL ${url}: ${error.message}`);
        }
    }
}
function normalizeLinkedInUrl(url) {
    if (!url) return '';

    return url
        .trim()
        .replace(/\/(mycompany|about|overview)(\/)?$/, '') // remove '/mycompany', '/about', or '/overview'
        .replace(/\/+$/, ''); // remove trailing slashes
}
function getBrowserExecutablePath() {
    const platform = os.platform();
    
    // Check if we're in a production environment (like Render)
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
    
    if (isProduction) {
        // For production environments, try to find system browsers first
        console.log('[Browser] Production environment detected, checking for system browsers');
        
        // Check for system browsers in production (Edge first, then Chrome)
        const productionBrowserPaths = [
            '/usr/bin/microsoft-edge',           // Microsoft Edge (newly installed)
            '/opt/microsoft/msedge/msedge',      // Alternative Edge path
            '/usr/bin/google-chrome',            // Google Chrome
            '/usr/bin/google-chrome-stable',     // Chrome stable
            '/usr/bin/chromium-browser',         // Chromium browser
            '/usr/bin/chromium'                  // Chromium
        ];
        
        for (const browserPath of productionBrowserPaths) {
            if (fs.existsSync(browserPath)) {
                console.log(`[Browser] Found system browser in production: ${browserPath}`);
                return browserPath;
            }
        }
        
        // Fallback to Puppeteer bundled Chromium if no system browser found
        console.log('[Browser] No system browser found, using Puppeteer bundled Chromium');
        return null; // Let Puppeteer handle browser detection automatically
    }
    
    // For local development, try to find installed browsers
    const browserCandidates = {
        win32: [
            // Edge paths
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            // Chrome paths
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            // User-specific Chrome paths
            `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
            `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
            `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`
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
            '/usr/bin/chromium',
            '/snap/bin/chromium'
        ]
    };

    const paths = browserCandidates[platform] || [];
    
    for (const browserPath of paths) {
        if (browserPath && fs.existsSync(browserPath)) {
            console.log(`[Browser] Found local browser: ${browserPath}`);
            return browserPath;
        }
    }

    // If no local browser found, use Puppeteer's bundled Chromium
    console.log('[Browser] No local browser found, will use Puppeteer bundled Chromium');
    return null;
}
/**
 * Get browser executable path specifically for LinkedIn extraction
 * Prefers Edge for local development, Chrome for production
 */
function getBrowserExecutablePathForLinkedIn() {
    const platform = os.platform();
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
    
    if (isProduction) {
        // In production, prefer Microsoft Edge for LinkedIn if available
        console.log('[LinkedIn Browser] Production environment detected, checking for system browsers');
        
        const productionLinkedInBrowserPaths = [
            '/usr/bin/microsoft-edge',           // Microsoft Edge (preferred for LinkedIn)
            '/opt/microsoft/msedge/msedge',      // Alternative Edge path
            '/usr/bin/google-chrome',            // Google Chrome fallback
            '/usr/bin/google-chrome-stable',     // Chrome stable fallback
            '/usr/bin/chromium-browser',         // Chromium browser fallback
            '/usr/bin/chromium'                  // Chromium fallback
        ];
        
        for (const browserPath of productionLinkedInBrowserPaths) {
            if (fs.existsSync(browserPath)) {
                console.log(`[LinkedIn Browser] Found system browser in production: ${browserPath}`);
                return browserPath;
            }
        }
        
        // Fallback to Puppeteer bundled Chromium if no system browser found
        console.log('[LinkedIn Browser] No system browser found, using Puppeteer bundled Chromium');
        return null; // Let Puppeteer handle browser detection automatically
    }
    
    // For local development, prefer Edge for LinkedIn
    const browserCandidates = {
        win32: [
            // Edge paths (preferred for LinkedIn)
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            // Chrome paths (fallback)
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
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

    const paths = browserCandidates[platform] || [];
    
    for (const browserPath of paths) {
        if (browserPath && fs.existsSync(browserPath)) {
            logger.info(`Found browser for LinkedIn: ${browserPath}`);
            return browserPath;
        }
    }

    logger.debug('No specific browser found for LinkedIn, using default');
    return null;
}

/**
 * Use Edge (local) or Chrome (production) to scrape company details from a LinkedIn company page
 */
/**
 * Graceful degradation wrapper for LinkedIn extraction
 * Ensures that LinkedIn scraping failures don't break the main extraction process
 */
async function extractCompanyDataFromLinkedInSafely(linkedinUrl) {
    const startTime = Date.now();
    
    try {
        logger.info('Attempting LinkedIn data extraction with enhanced monitoring', { 
            details: { 
                linkedinUrl,
                currentSuccessRate: linkedInMetrics.totalAttempts > 0 ? 
                    `${((linkedInMetrics.successfulExtractions / linkedInMetrics.totalAttempts) * 100).toFixed(1)}%` : 'N/A'
            } 
        });
        
        const result = await extractCompanyDataFromLinkedIn(linkedinUrl);
        const extractionTime = (Date.now() - startTime) / 1000;
        
        // Update metrics for successful extraction
        updateLinkedInMetrics(true, null, result);
        
        logger.info('LinkedIn extraction completed successfully', { 
            details: { 
                extractionTime: `${extractionTime.toFixed(2)}s`,
                hasLogo: !!result?.logoUrl,
                hasBanner: !!result?.bannerUrl,
                hasDescription: !!result?.description
            } 
        });
        
        return result;
        
    } catch (error) {
        const extractionTime = (Date.now() - startTime) / 1000;
        
        // Update metrics for failed extraction
        updateLinkedInMetrics(false, error);
        
        logger.error('LinkedIn extraction failed, continuing without LinkedIn data', error, {
            details: { 
                linkedinUrl, 
                extractionTime: `${extractionTime.toFixed(2)}s`,
                gracefulDegradation: true 
            }
        });
        
        // Return structured error result instead of throwing
        return {
            company: '',
            description: '',
            website: '',
            industry: '',
            companySize: '',
            headquarters: '',
            founded: '',
            specialties: '',
            employees: '',
            followers: '',
            error: `LinkedIn extraction failed: ${error.message}`,
            extractionSkipped: true,
            failureTime: new Date().toISOString(),
            extractionTime: `${extractionTime.toFixed(2)}s`
        };
    }
}

//this is been used to fetch the data from linkedin
async function extractCompanyDataFromLinkedIn(linkedinUrl) {
    logger.info('Starting LinkedIn company data extraction', { details: { linkedinUrl } });
    
    const browserPath = getBrowserExecutablePathForLinkedIn();

    const launchOptions = {
        headless: 'new',
        args: getAdvancedBrowserArgs(),
        timeout: 60000, // Reduced browser launch timeout for LinkedIn
        protocolTimeout: 180000, // Reduced protocol timeout for LinkedIn
        defaultViewport: antiBotSystem.getRandomViewport(),
        // Advanced stealth features for LinkedIn
        ignoreDefaultArgs: ['--enable-automation'],
        ignoreHTTPSErrors: true
    };

    // Only set executablePath if we found a specific browser
    if (browserPath) {
        launchOptions.executablePath = browserPath;
    }
    // If browserPath is null, Puppeteer will use its bundled Chromium

    // Launch browser with enhanced retry and logging
    const browser = await launchBrowserWithRetry(launchOptions, 'for LinkedIn extraction');

    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    try {
        const cleanUrl = normalizeLinkedInUrl(linkedinUrl);
        
        // Enhanced stealth measures for LinkedIn with anti-bot system
        await page.setUserAgent(getUserAgent(true)); // Force rotation for LinkedIn
        await page.setExtraHTTPHeaders(getBrowserHeaders());
        
        // Advanced stealth mode setup
        await antiBotSystem.setupStealthMode(page);
        
        // Record anti-bot event
        performanceMonitor.recordAntiBotEvent('stealth_activation', { context: 'LinkedIn extraction' });
        
        // Enhanced anti-detection measures
        await page.evaluateOnNewDocument(() => {
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
          
            // Override the plugins property to use a custom getter
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            
            // Override the languages property to use a custom getter
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
            
            // Override the permissions property
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        });
        
        // Set viewport to common resolution
        await page.setViewport({ width: 1366, height: 768 });
        
        // Smart LinkedIn navigation with adaptive approach
        let navigationSuccess = false;
        let lastError = null;
        
        // Try fast approach first, then fallback to more reliable approach
        const navigationStrategies = [
            { waitUntil: 'domcontentloaded', timeout: 20000 },  // Fast approach
            { waitUntil: 'load', timeout: 60000 }               // Reliable fallback
        ];
        
        for (let attempt = 1; attempt <= 2; attempt++) {
            for (const strategy of navigationStrategies) {
                try {
                    logger.debug(`LinkedIn navigation attempt ${attempt}/2`, { 
                        details: { 
                            strategy: strategy.waitUntil, 
                            timeout: `${strategy.timeout/1000}s`,
                            url: cleanUrl
                        } 
                    });
                    await page.goto(cleanUrl, strategy);
                    navigationSuccess = true;
                    logger.info(`LinkedIn navigation successful with ${strategy.waitUntil} on attempt ${attempt}`);
                    
                    // Human-like behavior simulation after navigation
                    await antiBotSystem.humanDelay(2000, 4000);
                    await antiBotSystem.simulateHumanBehavior(page, {
                        enableMouseMovement: true,
                        enableScrolling: true
                    });
                    
                    break;
                } catch (error) {
                    lastError = error;
                    logger.warn(`LinkedIn navigation failed with ${strategy.waitUntil}`, { 
                        details: { error: error.message, attempt, strategy: strategy.waitUntil } 
                    });
                }
            }
            
            if (navigationSuccess) break;
            
            if (attempt < 2) {
                console.log(`[LinkedIn] Waiting 2 seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        if (!navigationSuccess) {
            logger.error('LinkedIn navigation failed after all strategies', lastError, {
                details: { url: cleanUrl, strategiesAttempted: navigationStrategies.length }
            });
            throw new Error(`LinkedIn navigation failed after trying all strategies. Last error: ${lastError.message}`);
        }
        
        // Wait a bit for dynamic content to load with reduced delay
        const randomDelay = 500 + Math.random() * 1000; // 0.5-1.5 seconds (reduced from 1-3 seconds)
        await new Promise(resolve => setTimeout(resolve, randomDelay));

        // Try to close various popups that might appear
        const popupSelectors = [
            'button[aria-label="Dismiss"]',
            'button[data-test-modal-close-btn]',
            'button[class*="modal-close"]',
            '.modal button[aria-label*="close"]',
            '.artdeco-modal__dismiss'
        ];
        
        for (const selector of popupSelectors) {
            try {
                await page.click(selector, { timeout: 1000 }); // Reduced from 2000ms to 1000ms
                console.log(`[LinkedIn] Dismissed popup using selector: ${selector}`);
                await new Promise(resolve => setTimeout(resolve, 500)); // Reduced from 1000ms to 500ms
                break;
            } catch {
                // Continue to next selector
            }
        }

        // Add timeout to the page evaluation (reduced timeout)
        console.log('[LinkedIn] Starting page data extraction...');
        const data = await Promise.race([
            page.evaluate(() => {
            console.log('[LinkedIn Eval] Starting data extraction...');
            const getByLabel = (label) => {
                const items = Array.from(document.querySelectorAll('dt'));
                for (const dt of items) {
                    if (dt.innerText.trim().toLowerCase() === label.toLowerCase()) {
                        return dt.nextElementSibling?.innerText?.trim() || null;
                    }
                }
                return null;
            };
            const banner =
        document.querySelector('section.org-top-card img')?.src || // sometimes used
        document.querySelector('img.org-top-card-primary-content__cover')?.src || // new format
        Array.from(document.querySelectorAll('img')).find(img =>
            img.src?.includes('/images/profile/cover'))?.src || null;
const getImageFromBanner = () => {
    const selectors = [
        // Priority 1: DIVs with background-image
        { selector: 'div.org-top-card-primary-content__hero-image', type: 'bg' },
        { selector: 'div.org-top-card-module__hero', type: 'bg' },
        { selector: 'div.profile-background-image__image', type: 'bg' },
        { selector: 'section[class*="artdeco-card"] div[class*="ivm-image-view-model__background-img"]', type: 'bg'},
        { selector: 'div[class*="cover-img"]', type: 'bg' },
        { selector: 'div[class*="profile-cover-image"]', type: 'bg' },
        { selector: 'div[class*="banner-image"]', type: 'bg' },

        // Priority 2: Specific IMG tags
        { selector: 'img.org-top-card-primary-content__cover', type: 'src' },
        { selector: 'img[data-test-id*="cover-photo"]', type: 'src' },
        { selector: 'img[data-test-id*="banner-img"]', type: 'src' },
        { selector: 'img[alt*="Cover photo"i]', type: 'src' },
        { selector: 'img[alt*="Cover image"i]', type: 'src' },
        { selector: 'img[alt*="Banner"i]', type: 'src' },
        { selector: 'img[class*="cover-image"]', type: 'src' },
        { selector: 'img[class*="banner-image"]', type: 'src' },
        // More specific path for company background images on LinkedIn CDN
        { selector: 'img[src*="media.licdn.com/dms/image/"][src*="company-background"]', type: 'src'},


        // Priority 3: IMG tags within known banner/cover containers
        { selector: 'div.cover-photo img', type: 'src' },
        { selector: 'div.banner img', type: 'src' },
        { selector: 'figure[class*="banner"] img', type: 'src' },
        { selector: 'figure[class*="cover"] img', type: 'src' },

        // Priority 4: Less specific, but still plausible (use with caution, check result)
        // Removed the naturalWidth/Height check as it's unreliable here.
        // The selector 'section.org-top-card img' is broad; specific sub-selectors are better.
    ];

    for (const item of selectors) {
        const element = document.querySelector(item.selector);
        if (element) {
            if (item.type === 'bg') {
                const bg = getComputedStyle(element).backgroundImage;
                if (bg && bg !== 'none') {
                    const match = bg.match(/url\(["']?(.*?)["']?\)/);
                    if (match && match[1]) {
                        // Ensure it's a full URL, not a relative path or data URI if possible
                        // For LinkedIn, urls are usually absolute from media.licdn.com
                        if (match[1].startsWith('http') || match[1].startsWith('//')) {
                             // console.log(`[LinkedIn Scrape - getImageFromBanner] Found BG: ${match[1]} via ${item.selector}`);
                            return match[1];
                        } else if (match[1].startsWith('data:image')) {
                            // Potentially handle data URIs if necessary, or ignore them
                            // console.log(`[LinkedIn Scrape - getImageFromBanner] Found data URI BG, skipping: via ${item.selector}`);
                        }
                    }
                }
            } else if (item.type === 'src') {
                const src = element.getAttribute('src');
                if (src) {
                     // console.log(`[LinkedIn Scrape - getImageFromBanner] Found SRC: ${src} via ${item.selector}`);
                    // Ensure it's a full URL
                    if (src.startsWith('http') || src.startsWith('//')) {
                        return src;
                    } else if (src.startsWith('data:image')) {
                         // console.log(`[LinkedIn Scrape - getImageFromBanner] Found data URI src, skipping: via ${item.selector}`);
                    } else {
                        // Attempt to resolve relative URLs, though less common for critical images like banners
                        // return new URL(src, document.baseURI).href; // Might be needed if relative paths are used
                    }
                }
            }
        }
    }
    // console.log(`[LinkedIn Scrape - getImageFromBanner] No banner image found after trying all selectors.`);
    return null;
};
    // Description: from the About Us section, usually inside <section.about-us>
    // const aboutSection = document.querySelector('section.about-us') || document.querySelector('[data-test-id="about-us"]') || document.querySelector('.org-page-details__definition-text');
    // const description = aboutSection?.innerText?.trim() || null;

    // Description: from the About Us section
    let description = null;
    const descriptionSelectors = [
        'section.about-us',
        '[data-test-id="about-us"]',
        '.org-page-details__definition-text', // Often contains the main description text
        'div[class*="about__content"] p',    // General pattern for about content paragraphs
        'section[aria-label*="About"] p'     // Accessibility pattern for about sections
    ];
    for (const selector of descriptionSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const text = element.innerText?.trim();
            if (text) {
                description = text;
                break;
            }
        }
    }

            console.log('[LinkedIn Eval] Extracting banner...');
            const bannerUrl = getImageFromBanner();
            console.log('[LinkedIn Eval] Banner extracted, getting company details...');
            
            const result = {
                bannerUrl: bannerUrl,
                description: description, // Use the potentially populated description variable
                industry: getByLabel('Industry'),
                companySize: getByLabel('Company size'),
                headquarters: getByLabel('Headquarters'),
                location: getByLabel('Headquarters'),
                type: getByLabel('Company type') || getByLabel('Type'),
                founded: getByLabel('Founded'),
                specialties: getByLabel('Specialties'),
                locations: getByLabel('Locations')
            };
            
            console.log('[LinkedIn Eval] Data extraction completed');
            return result;
        }),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('LinkedIn page evaluation timeout after 45 seconds')), 45000) // Balanced timeout - not too fast, not too slow
        )
    ]);
        
        console.log('[LinkedIn] Page evaluation completed successfully');
        await context.close();
        await browser.close();
        return data;
    } catch (err) {
        console.error('[LinkedIn Scrape Error]', err.message);
        
        // Enhanced LinkedIn-specific error categorization
        const errorCategory = err.message.includes('Navigation timeout') ? 'navigation_timeout' :
                             err.message.includes('net::ERR_') ? 'network_error' :
                             err.message.includes('Protocol error') ? 'protocol_error' : 'other';
        
        logger.error(`LinkedIn extraction failed - ${errorCategory}`, err, {
            details: { 
                linkedinUrl, 
                errorCategory,
                suggestion: errorCategory === 'navigation_timeout' ? 'LinkedIn may be blocking requests or server is slow' :
                           errorCategory === 'network_error' ? 'Connection issue or LinkedIn blocking' :
                           errorCategory === 'protocol_error' ? 'Browser communication issue' : 'Unknown error'
            }
        });
        
        try {
            await context.close();
            await browser.close();
        } catch (closeError) {
            console.error('[LinkedIn] Error closing browser:', closeError.message);
        }
        
        return { 
            error: `LinkedIn scraping failed: ${err.message}`,
            errorType: err.name || 'UnknownError'
        };
    }
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Check if color is greyscale
 */
function isGreyscale(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  
  const { r, g, b } = rgb;
  const diff = Math.max(r, g, b) - Math.min(r, g, b);
  return diff < 10; // Threshold for greyscale detection
}
// Add this new helper function
async function cleanUpTempImageFile(filePath, shouldCleanUp) {
    if (shouldCleanUp && filePath) {
        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 200; // Wait 100ms between retries

        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                // Add a small delay before attempting to unlink
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                await fss.unlink(filePath);
                console.info(`Cleaned up temporary file: ${filePath}`);
                return; // Successfully deleted, exit the helper function
            } catch (cleanupError) {
                // Check for common error codes indicating file is locked/in use/permission denied
                if (cleanupError.code === 'EBUSY' || cleanupError.code === 'EPERM' || cleanupError.code === 'EMFILE' || cleanupError.code === 'ENOENT') {
                    if (cleanupError.code === 'ENOENT' && i === 0) {
                        // If file doesn't exist on first try, maybe it was never created or already deleted
                        console.warn(`Temporary file ${filePath} not found for cleanup (might be already gone).`);
                        return; // No need to retry if it doesn't exist
                    }
                    if (i < MAX_RETRIES - 1) {
                        console.warn(`Attempt ${i + 1}/${MAX_RETRIES}: File ${filePath} busy, permission issue, or missing. Retrying...`);
                    } else {
                        // Last attempt failed
                        console.error(`Failed to clean up temporary file ${filePath} after ${MAX_RETRIES} attempts:`, cleanupError);
                    }
                } else {
                    // Another type of error, no need to retry
                    console.error(`Unexpected error during temporary file cleanup ${filePath}:`, cleanupError);
                    return; // Other error, exit the helper function
                }
            }
        }
    }
}
  /**
   * Extract dominant colors from image using node-vibrant
   */
  async function extractColorsFromImage(imagePath, context = 'image') {
     let localImagePath = imagePath; // Assume it's a path initially
    let cleanupTempFile = false; // Flag to indicate if we need to delete a temp file

    try {
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            logger.info(`Starting image extraction for ${context}`, { details: { imageUrl: imagePath } });
            
            // Try browser-based extraction first (more reliable)
            localImagePath = await extractImageWithBrowser(imagePath, context);
            
            if (localImagePath) {
                cleanupTempFile = true;
                logger.info(`Browser-based image extraction successful for ${context}`);
            } else {
                // Fallback to axios method if browser-based extraction fails
                logger.debug(`Attempting HTTP image download for ${context}`);
                
                const response = await retryWithBackoff(async () => {
                    // **ENHANCED: LinkedIn-specific headers for HTTP requests**
                    let headers;
                    
                    if (linkedinAntiBot.isLinkedInImageUrl(imagePath)) {
                        // Use LinkedIn-optimized headers
                        headers = linkedinAntiBot.getLinkedInImageHeaders(imagePath);
                        
                        // Implement human delay for LinkedIn requests
                        await linkedinAntiBot.implementHumanDelay();
                        
                        linkedinAntiBot.logActivity('LinkedIn HTTP image request', { 
                            imageUrl: imagePath,
                            userAgent: headers['User-Agent'].split(' ')[2]
                        });
                    } else {
                        // Use standard headers for non-LinkedIn images
                        headers = {
                            'User-Agent': getUserAgent(),
                            'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'Accept-Language': 'en-US,en;q=0.9',
                        };
                    }
                    
                    return await axios({
                        method: 'get',
                        url: imagePath,
                        responseType: 'arraybuffer',
                        timeout: 10000,
                        headers: headers,
                        maxRedirects: 5,
                        validateStatus: function (status) {
                            return status >= 200 && status < 300;
                        }
                    });
                }, {
                    maxRetries: 3,
                    initialDelay: 1000,
                    operation: `HTTP image download for ${context}`
                });

                // **ENHANCED: Validate response content type and detect XML/HTML responses**
                const contentType = response.headers['content-type'] || '';
                const responseData = response.data;
                
                // Check if response is actually an image
                if (!contentType.startsWith('image/')) {
                    // Try to detect XML/HTML content in the response
                    const responseText = Buffer.from(responseData).toString('utf8', 0, 500);
                    
                    if (responseText.includes('<?xml') || 
                        responseText.includes('<html') || 
                        responseText.includes('<!DOCTYPE') ||
                        contentType.includes('xml') ||
                        contentType.includes('html')) {
                        
                        logger.warn(`LinkedIn returned ${contentType || 'non-image'} content instead of image for ${context}`, {
                            details: { 
                                imageUrl: imagePath, 
                                contentType, 
                                responsePreview: responseText.substring(0, 200),
                                responseSize: responseData.length
                            }
                        });
                        
                        // Try alternative LinkedIn image strategies using advanced anti-bot system
                        const alternativeUrls = linkedinAntiBot.generateAlternativeLinkedInUrls(imagePath);
                        
                        for (const alternativeUrl of alternativeUrls) {
                            try {
                                logger.info(`Trying alternative LinkedIn image URL for ${context}`, { 
                                    details: { original: imagePath, alternative: alternativeUrl } 
                                });
                                
                                // Test the alternative URL with a HEAD request first
                                const testHeaders = linkedinAntiBot.getLinkedInImageHeaders(alternativeUrl);
                                const testResponse = await axios({
                                    method: 'head',
                                    url: alternativeUrl,
                                    timeout: 5000,
                                    headers: testHeaders
                                });
                                
                                const contentType = testResponse.headers['content-type'] || '';
                                if (contentType.startsWith('image/')) {
                                    linkedinAntiBot.logActivity('Alternative LinkedIn URL found', { 
                                        original: imagePath, 
                                        alternative: alternativeUrl,
                                        contentType 
                                    });
                                    
                                    // Recursive call with alternative URL
                                    return await extractColorsFromImage(alternativeUrl, context);
                                }
                            } catch (altError) {
                                logger.debug(`Alternative URL failed: ${alternativeUrl} - ${altError.message}`);
                                continue;
                            }
                        }
                        
                        // If no alternative works, throw error to trigger fallback
                        throw new Error(`LinkedIn returned ${contentType || 'XML/HTML'} content instead of image`);
                    }
                }

                // Create a temporary file path with proper extension based on content type
                const tempDir = os.tmpdir();
                let fileExtension = '.jpg'; // default
                
                if (contentType.includes('png')) fileExtension = '.png';
                else if (contentType.includes('webp')) fileExtension = '.webp';
                else if (contentType.includes('gif')) fileExtension = '.gif';
                else if (contentType.includes('svg')) fileExtension = '.svg';
                
                const fileName = `http_image_${Date.now()}_${Math.random().toString(36).substring(7)}${fileExtension}`;
                localImagePath = path.join(tempDir, fileName);

                // Write the image data to the temporary file
                await fss.writeFile(localImagePath, responseData);
                cleanupTempFile = true;
                
                logger.info(`HTTP-based image extraction successful for ${context}`, { 
                    details: { 
                        imageSize: `${responseData.length} bytes`,
                        contentType: contentType,
                        fileName: fileName
                    } 
                });
            }
        }
      // **ENHANCED: Better image format handling and validation**
      let metadata, palette;
      
      try {
          // First, validate that the file is actually an image
          metadata = await sharp(localImagePath).metadata();
          
          if (!metadata.width || !metadata.height) {
              throw new Error('Invalid image: no dimensions found');
          }
          
          logger.debug(`Image metadata extracted for ${context}`, { 
              details: { 
                  width: metadata.width, 
                  height: metadata.height, 
                  format: metadata.format,
                  size: metadata.size 
              } 
          });
          
      } catch (sharpError) {
          logger.warn(`Sharp metadata extraction failed for ${context}, trying alternative approach`, sharpError);
          
          // Try to read file and check if it's actually an image
          const fileBuffer = await fss.readFile(localImagePath);
          const fileHeader = fileBuffer.toString('hex', 0, 10);
          
          // Check for common image file signatures
          const isValidImage = 
              fileHeader.startsWith('ffd8ff') || // JPEG
              fileHeader.startsWith('89504e47') || // PNG
              fileHeader.startsWith('47494638') || // GIF
              fileHeader.startsWith('424d') || // BMP
              fileHeader.startsWith('52494646'); // WebP
          
          if (!isValidImage) {
              throw new Error(`File is not a valid image format. Header: ${fileHeader}`);
          }
          
          // Set default metadata if Sharp fails but file seems to be an image
          metadata = { width: null, height: null, format: 'unknown' };
      }
      
      const imageWidth = metadata.width;
      const imageHeight = metadata.height;
      
      try {
          palette = await Vibrant.from(localImagePath).getPalette();
      } catch (vibrantError) {
          logger.warn(`Vibrant color extraction failed for ${context}, trying Sharp color analysis`, vibrantError);
          
          // Fallback: use Sharp to get dominant colors
          try {
              const { dominant } = await sharp(localImagePath).stats();
              palette = {
                  Vibrant: { getHex: () => `#${dominant.r.toString(16).padStart(2, '0')}${dominant.g.toString(16).padStart(2, '0')}${dominant.b.toString(16).padStart(2, '0')}`, getPopulation: () => 100 }
              };
          } catch (sharpStatsError) {
              logger.warn(`Sharp color analysis also failed for ${context}`, sharpStatsError);
              throw new Error('Both Vibrant and Sharp color extraction failed');
          }
      }
      const colors = [];
      
      // Extract colors from vibrant palette
      for (const [name, swatch] of Object.entries(palette)) {
        if (swatch) {
          const hex = swatch.getHex();
          if (hex && !isGreyscale(hex)) {
            colors.push({
              hex: hex,
              population: swatch.getPopulation(),
              rgb: hexToRgb(hex),
              name: name
            });
          }
        }
      }
       // Sort by population and return top 5
    const topColors = colors
      .sort((a, b) => b.population - a.population)
      .slice(0, 5)
      .map(color => color.hex);
      // Sort by population and return top 5
      // return colors
      //   .sort((a, b) => b.population - a.population)
      //   .slice(0, 5)
      //   .map(color => color.hex);
      cleanupTempFile = true; // Set cleanup flag to true if we downloaded a temp file
      const rgb = hexToRgb(topColors[0]);
      return {
      width: imageWidth,
      height: imageHeight,
      colors: topColors,
      hex: topColors[0],
      rgb: `rgb(${rgb.r},${rgb.g},${rgb.b})`
    };
        
    } catch (error) {
      logger.error(`Error extracting colors from ${context}`, error, { 
          details: { imagePath, context } 
      });
      
      // **ENHANCED: Provide fallback colors for LinkedIn images when extraction fails**
      if (context && context.toLowerCase().includes('linkedin')) {
          logger.info(`Providing LinkedIn fallback colors for ${context}`);
          
          const fallbackColors = getLinkedInFallbackColors(context);
          return {
              width: null,
              height: null,
              colors: fallbackColors.colors,
              hex: fallbackColors.hex,
              rgb: fallbackColors.rgb,
              error: `Color extraction failed: ${error.message}`,
              context: context,
              fallback: true
          };
      }
      
      return {
          width: null,
          height: null,
          colors: [],
          error: `Color extraction failed: ${error.message}`,
          context: context
      };
    }finally {
        // Step 4: Guarantee cleanup using the helper method
        // This will run reliably regardless of success or failure in the try block
        await cleanUpTempImageFile(localImagePath, cleanupTempFile);
    }
  }
const extraction = require('./extraction');
const scraperLink = require('./scrapeLinkedIn');
const fss = require('fs').promises;
async function extractCompanyDetailsFromPage(page, url, browser) { // Added browser argument here
    const startTime = Date.now();
    logger.info('Starting company details extraction from page', { details: { url } });
    // Helper to get content from meta tags more reliably
    const getMetaContent = async (page, selectors) => { // Added page argument
        for (const selector of selectors) {
            try {
                const content = await page.$eval(selector, el => el.content.trim());
                if (content) return content;
            } catch (e) { /* Selector not found or element has no content, try next */ }
        }
        return null;
    };

    // Helper to get text, preferring more specific selectors first
    const getTextFromSelectors = async (page, selectors) => { // Added page argument
        for (const selector of selectors) {
            try {
                const text = await page.$eval(selector, el => el.textContent.trim());
                if (text) return text;
            } catch (e) { /* Selector not found, try next */ }
        }
        return null;
    };

    // Helper to get an attribute, preferring more specific selectors first
    const getAttributeFromSelectors = async (page, selectors, attribute) => { // Added page argument
         for (const selector of selectors) {
            try {
                const attrVal = await page.$eval(selector, (el, attr) => el.getAttribute(attr), attribute);
                if (attrVal) return attrVal.trim();
            } catch (e) { /* Selector not found, try next */ }
        }
        return null;
    };

    // Helper to resolve a URL against a base URL
    const resolveUrl = (relativeOrAbsoluteUrl, baseUrl) => {
        if (!relativeOrAbsoluteUrl) return null;
        if (relativeOrAbsoluteUrl.startsWith('http')) return relativeOrAbsoluteUrl;
        try {
            return new URL(relativeOrAbsoluteUrl, baseUrl).href;
        } catch (e) {
            console.warn(`Invalid URL to resolve: ${relativeOrAbsoluteUrl} against base ${baseUrl}`);
            return null;
        }
    };

    // 3a. Extract Logo URLs
    const getLogoDetails = async (page, baseUrl) => {
        console.log(`[getLogoDetails] Starting extraction for ${baseUrl}`);

        let primaryLogoUrl = null;
        let iconUrl = null;
        let bannerUrl = null;
        let symbolUrl = null; // Keep trying for symbol, though hard

        // --- Evaluation within page context ---
        const extractedAssets = await page.evaluate(async (pageBaseUrl) => {
            const results = {
                metaLogo: null,
                metaIcon: null,
                metaBanner: null,
                imgLogo: null,
                linkIcon: null,
                favicon: null, // Explicit favicon URL
                svgLogo: null, // For linked SVG files or <use> tags
            };
            const consoleMessages = []; // For debugging inside evaluate

            // Respect <base href> if present
            const baseHref = (document.querySelector('base[href]')?.getAttribute('href')) || document.baseURI || pageBaseUrl;
            const makeAbsolute = (url) => {
                if (!url || typeof url !== 'string') return null;
                try {
                    return new URL(url, baseHref).href;
                } catch (e) {
                    consoleMessages.push(`Invalid URL for new URL(url, baseHref): ${url}, ${baseHref}`);
                    return null;
                }
            };

            // 1. Meta tags for primary logo (most reliable)
            const ogLogo = document.querySelector('meta[property="og:logo"]');
            if (ogLogo && ogLogo.content) results.metaLogo = makeAbsolute(ogLogo.content);
            else {
                const itemPropLogo = document.querySelector('meta[itemprop="logo"]');
                if (itemPropLogo && itemPropLogo.content) results.metaLogo = makeAbsolute(itemPropLogo.content);
                else {
                    const twitterImage = document.querySelector('meta[name="twitter:image"]');
                    if (twitterImage && twitterImage.content && (twitterImage.content.includes('logo') || twitterImage.content.includes('brand'))) { // Heuristic for twitter image as logo
                        results.metaLogo = makeAbsolute(twitterImage.content);
                    }
                }
            }
            consoleMessages.push(`Meta Logo candidates: og: ${ogLogo?.content}, itemprop: ${document.querySelector('meta[itemprop="logo"]')?.content}, twitter: ${document.querySelector('meta[name="twitter:image"]')?.content}`);


            // 2. Meta tags for banner (often og:image)
            const ogImage = document.querySelector('meta[property="og:image"]');
            if (ogImage && ogImage.content) results.metaBanner = makeAbsolute(ogImage.content);
            else {
                 const twitterImageSrc = document.querySelector('meta[name="twitter:image:src"]');
                 if (twitterImageSrc && twitterImageSrc.content) results.metaBanner = makeAbsolute(twitterImageSrc.content);
            }
             consoleMessages.push(`Meta Banner candidates: og: ${ogImage?.content}, twitter:src: ${document.querySelector('meta[name="twitter:image:src"]')?.content}`);


            // 3. Link tags for icons (favicon, apple-touch-icon)
            // Collect all potential icon links and pick the best by size/type preference
            const iconElements = Array.from(document.querySelectorAll(
                'link[rel~="icon" i], link[rel="shortcut icon" i], link[rel="mask-icon" i], link[rel="apple-touch-icon" i], link[rel="apple-touch-icon-precomposed" i]'
            ));

            const iconCandidates = iconElements.map(el => {
                const href = el.getAttribute('href') || el.href;
                const sizesAttr = (el.getAttribute('sizes') || '').toLowerCase();
                let sizeScore = 0;
                const m = sizesAttr.match(/(\d+)\s*x\s*(\d+)/);
                if (m) {
                    // Prefer square and bigger sizes
                    sizeScore = Math.min(parseInt(m[1], 10), parseInt(m[2], 10));
                }
                const type = (el.getAttribute('type') || '').toLowerCase();
                const rel = (el.getAttribute('rel') || '').toLowerCase();
                const hrefLower = (href || '').toLowerCase();
                const isSvg = type.includes('svg') || hrefLower.endsWith('.svg');
                const isPng = type.includes('png') || hrefLower.endsWith('.png');
                const isIco = type.includes('x-icon') || hrefLower.endsWith('.ico');
                const isApple = rel.includes('apple-touch-icon');
                const baseScore = (isApple ? 5 : 0) + (rel.includes('icon') ? 10 : 0);
                const formatBoost = isSvg ? 8 : (isPng ? 6 : (isIco ? 3 : 0));
                const score = baseScore + formatBoost + sizeScore; // overall score
                return {
                    href: makeAbsolute(href),
                    score,
                    sizeScore,
                    type,
                    rel
                };
            }).filter(c => !!c.href);

            if (iconCandidates.length) {
                iconCandidates.sort((a, b) => b.score - a.score);
                results.favicon = iconCandidates[0].href;
            }

            // Preserve legacy linkIcon behavior: pick the first declared rel icon to avoid output changes
            try {
                const legacyEl = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
                if (legacyEl && (legacyEl.getAttribute('href') || legacyEl.href)) {
                    results.linkIcon = makeAbsolute(legacyEl.getAttribute('href') || legacyEl.href);
                }
            } catch {}

            // Try other common favicon rels if we didn't pick one yet but something is present
            if (!results.favicon && !iconCandidates.length) {
                const el = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
                if (el && (el.getAttribute('href') || el.href)) {
                    results.favicon = makeAbsolute(el.getAttribute('href') || el.href);
                }
            }

            // Fallbacks for sites that declare icons via manifest only
            if (!results.favicon) {
                try {
                    const manifestLink = document.querySelector('link[rel="manifest"]');
                    if (manifestLink) {
                        const manifestUrl = makeAbsolute(manifestLink.getAttribute('href') || manifestLink.href);
                        if (manifestUrl) {
                            const res = await fetch(manifestUrl);
                            if (res.ok) {
                                const manifest = await res.json();
                                const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
                                const manifestCandidates = icons.map(i => {
                                    const src = i.src || i.url;
                                    const sizesAttr = (i.sizes || '').toLowerCase();
                                    let sizeScore = 0;
                                    const m = sizesAttr.match(/(\d+)x(\d+)/);
                                    if (m) sizeScore = Math.min(parseInt(m[1], 10), parseInt(m[2], 10));
                                    const type = (i.type || '').toLowerCase();
                                    const srcLower = (src || '').toLowerCase();
                                    const isSvg = type.includes('svg') || srcLower.endsWith('.svg');
                                    const isPng = type.includes('png') || srcLower.endsWith('.png');
                                    const isIco = type.includes('x-icon') || srcLower.endsWith('.ico');
                                    const formatBoost = isSvg ? 8 : (isPng ? 6 : (isIco ? 3 : 0));
                                    const score = formatBoost + sizeScore;
                                    return { href: makeAbsolute(src), score };
                                }).filter(c => !!c.href);
                                if (manifestCandidates.length) {
                                    manifestCandidates.sort((a, b) => b.score - a.score);
                                    results.favicon = manifestCandidates[0].href;
                                }
                            }
                        }
                    }
                } catch (e) {
                    consoleMessages.push(`Manifest parsing failed: ${e?.message || e}`);
                }
            }

            // As a last resort, probe common favicon paths to avoid returning an icon
            if (!results.favicon) {
                const commonPaths = [
                    '/favicon.ico',
                    '/favicon.png',
                    '/apple-touch-icon.png',
                    '/apple-touch-icon-precomposed.png'
                ];
                for (const p of commonPaths) {
                    try {
                        const testUrl = makeAbsolute(p);
                        const resp = await fetch(testUrl, { method: 'HEAD' });
                        if (resp.ok) { results.favicon = testUrl; break; }
                    } catch {}
                }
            }

            // Fallback to default /favicon.ico even if not confirmed; many servers serve it
            if (!results.favicon) {
                results.favicon = makeAbsolute('/favicon.ico');
            }

            // Provide camelCase alias as requested
            results.favIcon = results.favicon;

            consoleMessages.push(`Favicon candidate: ${results.favicon}`);
            consoleMessages.push(`Link Icon candidate: ${results.linkIcon}`);

            // 4. Image tags for primary logo (fallback if meta tags fail)
            if (!results.metaLogo) {
                const imgSelectors = [
                    'img[itemprop="logo"][src]', // Prioritize itemprop on img
                    'img[alt*="logo"i][src]',
                    'img[class*="logo"i][src]',
                    'img[id*="logo"i][src]',
                    'header img[src]',
                    'a[href="/"] img[src]', // Logo linked to homepage
                    'div[class*="logo"i] img[src]'
                ];
                for (const selector of imgSelectors) {
                    const el = document.querySelector(selector);
                    if (el && el.src) {
                        // Basic check to avoid tiny images / tracking pixels if possible from attributes
                        const width = parseInt(el.getAttribute('width') || '0', 10) || el.naturalWidth || 0;
                        const height = parseInt(el.getAttribute('height') || '0', 10) || el.naturalHeight || 0;
                        consoleMessages.push(`Img candidate: ${el.src}, w:${width}, h:${height}`);
                        if (width === 1 && height === 1) continue; // Skip 1x1 pixels

                        results.imgLogo = makeAbsolute(el.src);
                        if(results.imgLogo) break;
                    }
                }
            }
             consoleMessages.push(`Img Logo candidate: ${results.imgLogo}`);

            // 5. SVG specific search (basic: linked SVGs or <use>)
            const svgUseElements = document.querySelectorAll('svg use');
            let foundSvgHref = null;
            for (const svgUseEl of svgUseElements) {
                let href = svgUseEl.getAttribute('href');
                // If href is null or an internal fragment, try xlink:href
                if (!href || href.startsWith('#')) {
                    const xlinkHref = svgUseEl.getAttribute('xlink:href');
                    if (xlinkHref && !xlinkHref.startsWith('#')) {
                        href = xlinkHref; // Use xlink:href if it's external
                    } else if (xlinkHref && xlinkHref.startsWith('#') && (!href || href.startsWith('#'))) {
                        // Both are internal, or href was null and xlink:href is internal
                        consoleMessages.push(`Found internal SVG <use> reference (href: ${href}, xlink:href: ${xlinkHref}). Symbol extraction from sprites not implemented.`);
                        href = null; // Don't use internal fragments as a direct src
                    } else if (!href && !xlinkHref) {
                        href = null; // Neither attribute exists
                    }
                }

                if (href && !href.startsWith('#')) { // Ensure it's an external link
                    foundSvgHref = href;
                    consoleMessages.push(`Found external SVG <use> href: ${foundSvgHref}`);
                    break;
                } else if (href && href.startsWith('#')) { // Log internal references if not already logged
                     consoleMessages.push(`Found internal SVG <use> reference: ${href}. Symbol extraction from sprites not implemented.`);
                }
            }
            if (foundSvgHref) {
                results.svgLogo = makeAbsolute(foundSvgHref);
            }
             consoleMessages.push(`SVG Logo candidate from <use>: ${results.svgLogo || 'null'}`);
             console.log('Puppeteer evaluate console:', consoleMessages.join('\\n')); // Log messages from within evaluate

            return results;
        }, baseUrl); // Pass baseUrl to page.evaluate

        console.log('[getLogoDetails] Extracted assets from page:', JSON.stringify(extractedAssets, null, 2));

        // Prioritize sources for primaryLogoUrl
        primaryLogoUrl = extractedAssets.metaLogo || extractedAssets.imgLogo || extractedAssets.svgLogo;

        // Icon URL
        iconUrl = extractedAssets.linkIcon;

        // Banner URL (don't use logo as banner if they are the same)
        if (extractedAssets.metaBanner && extractedAssets.metaBanner !== primaryLogoUrl) {
            bannerUrl = extractedAssets.metaBanner;
        }

        // Symbol: still hard. If svgLogo was found and it's different from primaryLogo, maybe it's a symbol?
        if (extractedAssets.svgLogo && extractedAssets.svgLogo !== primaryLogoUrl) {
            // This is a weak heuristic. A true symbol is often part of a combined logo.
            // For now, we don't have a strong way to identify it.
        }

        return {
            Logo: primaryLogoUrl,
            Symbol: symbolUrl, // Remains null for now mostly
            // Preserve legacy Icon behavior
            Icon: extractedAssets.linkIcon || iconUrl || null,
            Favicon: extractedAssets.favicon || null, // Keep favicon independent from icon
            Banner: bannerUrl
        };
    };

    // 3b. Extract Brand Colors
    const getBrandColors = async (page) => {
        console.log(`[getBrandColors] Starting color extraction.`);
        try {
            const colorsData = await page.evaluate(() => {
                const collectedColors = new Map(); // Use a Map to store unique colors and their sources/counts

                // Helper to parse color string "rgb(r, g, b)" or "rgba(r, g, b, a)" to {r, g, b}
                const parseRgb = (colorStr) => {
                    if (!colorStr || typeof colorStr !== 'string') return null;
                    const match = colorStr.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\)/);
                    if (match) return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
                    return null;
                };

                // Helper to convert {r, g, b} to hex #RRGGBB
                const rgbToHex = (r, g, b) => {
                    return '#' + [r, g, b].map(x => {
                        const hex = x.toString(16);
                        return hex.length === 1 ? '0' + hex : hex;
                    }).join('');
                };

                // Helper to calculate brightness (0-255)
                const calculateBrightness = (r, g, b) => Math.round((0.299 * r + 0.587 * g + 0.114 * b));

                // Helper to add color to map if it's significant
                const addColor = (rgbString, sourceHint) => {
                    if (!rgbString || rgbString === 'transparent' || rgbString === 'rgba(0, 0, 0, 0)') return;

                    const rgb = parseRgb(rgbString);
                    if (!rgb) return;

                    // Filter out pure white and black unless they are from very specific sources, or very dark/light grays
                    const brightness = calculateBrightness(rgb.r, rgb.g, rgb.b);
                    if ((brightness > 250 && !(sourceHint.includes('variable') && sourceHint.toLowerCase().includes('background'))) && // Allow very light bg from vars
                        (brightness < 10 && !(sourceHint.includes('variable') && sourceHint.toLowerCase().includes('text')))) { // Allow very dark text from vars
                        // Heuristic: avoid near white/black unless explicitly defined or contextually important
                        // This needs refinement based on how "brand" colors are defined vs utility colors
                         if (!sourceHint.toLowerCase().includes('primary') && !sourceHint.toLowerCase().includes('accent') && !sourceHint.toLowerCase().includes('brand')) {
                           // return; // Commented out to be more inclusive initially
                         }
                    }

                    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
                    if (!collectedColors.has(hex)) {
                        collectedColors.set(hex, {
                            hex: hex,
                            rgb: `rgb(${rgb.r},${rgb.g},${rgb.b})`,
                            brightness: brightness,
                            sources: [sourceHint],
                            count: 1
                        });
                    } else {
                        const existing = collectedColors.get(hex);
                        existing.sources.push(sourceHint);
                        existing.count++;
                    }
                };

                // 1. Scan CSS Custom Properties on :root
                const rootStyle = window.getComputedStyle(document.documentElement);
                for (let i = 0; i < rootStyle.length; i++) {
                    const propName = rootStyle[i];
                    if (propName.startsWith('--') && (propName.toLowerCase().includes('color') || propName.toLowerCase().includes('brand') || propName.toLowerCase().includes('primary') || propName.toLowerCase().includes('accent') || propName.toLowerCase().includes('secondary'))) {
                        const propValue = rootStyle.getPropertyValue(propName).trim();
                        addColor(propValue, `css_variable: ${propName}`);
                    }
                }

                // 2. Collect colors from key UI elements
                const keySelectors = [
                    { selector: 'button, [role="button"], .button, .btn', purpose: 'button_bg', prop: 'backgroundColor' },
                    { selector: 'button, [role="button"], .button, .btn', purpose: 'button_text', prop: 'color' },
                    { selector: 'a', purpose: 'link_text', prop: 'color' },
                    { selector: 'h1, .h1', purpose: 'h1_text', prop: 'color' },
                    { selector: 'h2, .h2', purpose: 'h2_text', prop: 'color' },
                    { selector: 'header, [role="banner"]', purpose: 'header_bg', prop: 'backgroundColor'},
                    { selector: '[class*="primary-bg"], [class*="accent-bg"]', purpose: 'primary_accent_bg', prop: 'backgroundColor'},
                    { selector: '[class*="primary-text"], [class*="accent-text"]', purpose: 'primary_accent_text', prop: 'color'}
                ];

                keySelectors.forEach(item => {
                    try {
                        const elements = Array.from(document.querySelectorAll(item.selector)).slice(0, 3); // Reduced from 5 to 3 elements per selector for speed
                        elements.forEach(el => {
                            const style = window.getComputedStyle(el);
                            addColor(style[item.prop], item.purpose);
                        });
                    } catch (e) { /* ignore selector errors */ }
                });

                // Convert Map to Array for easier processing/sorting later if needed
                return Array.from(collectedColors.values());
            });

            // Post-processing: Sort by brightness or count, select top N, etc.
            // For now, just take them as found, up to a limit.
            // A more sophisticated selection would involve frequency, source priority, contrast checks, etc.
            let finalColors = colorsData;

            // Sort by brightness (desc) then by count (desc) as a simple heuristic for "importance"
            finalColors.sort((a, b) => {
                if (a.brightness !== b.brightness) {
                    return b.brightness - a.brightness; // Darker colors first, then lighter
                }
                return b.count - a.count; // Then by how many times it was found
            });

            // Filter out very similar colors if too many are found (complex, skip for now)
            // Limit to a reasonable number, reduced for speed
            finalColors = finalColors.slice(0, 4); // Reduced from 6 to 4 colors for faster processing

            console.log(`[getBrandColors] Found ${finalColors.length} potential brand colors.`);
            return finalColors.map(c => ({
                hex: c.hex,
                rgb: c.rgb,
                brightness: c.brightness,
                // name: c.sources.join(', ').substring(0,50) // Use first source as a hint for name
                name: c.sources[0] // Simpler name from first source
            }));

        } catch (e) {
            console.warn("[getBrandColors] Error during color extraction:", e.message);
            return [];
        }
    };

    // 3c. Extract Key Fonts
    const getKeyFonts = async (page) => {
        console.log(`[getKeyFonts] Starting font extraction.`);
        try {
            // Helper function to parse the primary font name from a CSS font-family stack
            const parsePrimaryFont = (fontStack) => {
                if (!fontStack || typeof fontStack !== 'string') return null;
                // Split by comma, take the first part, remove quotes and trim
                const firstFont = fontStack.split(',')[0].trim();
                return firstFont.replace(/^['"]|['"]$/g, ''); // Remove surrounding quotes
            };

            const fontsInfo = await page.evaluate(() => {
                const getFontFamily = (selectors) => {
                    for (const selector of selectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            const ff = window.getComputedStyle(element).fontFamily;
                            if (ff) return ff;
                        }
                    }
                    return null;
                };

                // More targeted selectors for headings
                const headingSelectors = [
                    'h1', 'h2', 'h3', // Prioritize actual heading tags
                    '.h1', '.h2', '.h3', // Common heading classes
                    '[class*="headline"]', '[class*="heading"]', '[class*="title"]', // Class names indicating headings
                    '[role="heading"][aria-level="1"]', '[role="heading"][aria-level="2"]' // ARIA roles
                ];
                const headingFontStack = getFontFamily(headingSelectors);

                // More targeted selectors for body text
                const bodySelectors = [
                    'p', // Standard paragraph
                    'article p', 'main p', 'section p', // Paragraphs within semantic content areas
                    '.content p', '.text-block p', '[class*="body-text"] p', '[class*="content-text"] p', // Paragraphs within common content divs
                    'body' // Fallback to body itself if no specific p text found
                ];
                let bodyFontStack = getFontFamily(bodySelectors);

                // If body font is same as heading, try a more generic body selector as a last resort for differentiation
                if (bodyFontStack === headingFontStack) {
                    bodyFontStack = window.getComputedStyle(document.body).fontFamily;
                }

                return { headingFontStack, bodyFontStack };
            });

            const headingFontName = parsePrimaryFont(fontsInfo.headingFontStack);
            const bodyFontName = parsePrimaryFont(fontsInfo.bodyFontStack);

            const resultFonts = [];
            if (headingFontName) {
                resultFonts.push({
                    name: headingFontName,
                    type: 'heading', // Heuristic type
                    stack: fontsInfo.headingFontStack || ''
                });
            }
            if (bodyFontName) {
                // Avoid adding the same font entry if body font resolves to the same as heading
                if (!headingFontName || (headingFontName && bodyFontName !== headingFontName) ||
                    (bodyFontName === headingFontName && fontsInfo.bodyFontStack !== fontsInfo.headingFontStack)) {
                    resultFonts.push({
                        name: bodyFontName,
                        type: 'body', // Heuristic type
                        stack: fontsInfo.bodyFontStack || ''
                    });
                } else if (!headingFontName && bodyFontName) { // Only body font was found
                     resultFonts.push({
                        name: bodyFontName,
                        type: 'body',
                        stack: fontsInfo.bodyFontStack || ''
                    });
                }
            }

            console.log(`[getKeyFonts] Extracted fonts:`, JSON.stringify(resultFonts));
            return resultFonts; // Return array structure

        } catch (e) {
            console.warn("[getKeyFonts] Error during font extraction:", e.message);
            return []; // Return empty array on error
        }
    };

    // 3d. Extract General Images (e.g., a hero image, more illustrative)
    const getGeneralImages = async (page, baseUrl, existingLogoUrls = {}) => { // Added existingLogoUrls to avoid duplicates
        console.log(`[getGeneralImages] Starting image extraction for ${baseUrl}. Excluding known logos:`, existingLogoUrls);
        let images = await page.evaluate((pageBaseUrl, knownLogoSrcs) => {
            const collectedImages = new Map(); // Use Map to ensure unique src easily

            const resolveImgUrl = (imgSrc) => {
                if (!imgSrc || typeof imgSrc !== 'string') return null;
                try { return new URL(imgSrc, pageBaseUrl).href; }
                catch (e) { console.warn(`Invalid image URL to resolve: ${imgSrc} on base ${pageBaseUrl}`); return null; }
            };

            const addImage = (src, alt, typeHint = 'Page Image') => {
                const resolvedSrc = resolveImgUrl(src);
                if (resolvedSrc && !knownLogoSrcs.includes(resolvedSrc) && !collectedImages.has(resolvedSrc)) {
                    collectedImages.set(resolvedSrc, { src: resolvedSrc, alt: (alt || typeHint).trim() });
                }
            };

            // 1. Prioritize Open Graph images and Twitter card images (if not already used as main logo/banner)
            document.querySelectorAll('meta[property^="og:image"], meta[name^="twitter:image"]').forEach(meta => {
                if (meta.content) {
                    addImage(meta.content, meta.getAttribute('property') || meta.getAttribute('name'), 'Social Preview Image');
                }
            });

            // 2. Look for hero/banner images or significant images in main content areas
            // Enhanced selectors for typical hero/banner sections
            const mainContentSelectors = [
                'header img[src]', // Image directly in header (might be a banner)
                'main img[src]',    // Images within main content
                'article img[src]',
                'section[role="banner"] img[src]', 'section[class*="banner"i] img[src]', // Banner sections
                'figure img[src]', // Images within figure tags
                '.hero img[src]', '.hero-image img[src]', '[class*="hero"i] img[src]', // Common hero classes
                '.carousel img[src]', '.slider img[src]', // Images in carousels/sliders
                'div[data-hero] img[src]'
            ];

            for (const contentSelector of mainContentSelectors) {
                if (collectedImages.size >= 3) break; // Reduced from 5 to 3 for faster processing
                try {
                    const imgElements = Array.from(document.querySelectorAll(contentSelector));
                    for (const img of imgElements) {
                        if (collectedImages.size >= 3) break; // Reduced from 5 to 3
                        const imgSrc = img.getAttribute('src'); // Get attribute directly to resolve later
                        if (!imgSrc) continue;

                        const width = img.naturalWidth || parseInt(img.getAttribute('width') || '0', 10);
                        const height = img.naturalHeight || parseInt(img.getAttribute('height') || '0', 10);

                        // Filter for significant images:
                        // - Not too small (e.g., larger than 200px in one dimension, or area > 30000px)
                        // - Aspect ratio not extremely skewed (e.g., not a very thin line, unless very long)
                        const area = width * height;
                        const isSignificantSize = (width > 200 || height > 200) || (area > 30000);
                        const isNotASpacer = (width > 1 && height > 1); // Avoid 1x1 tracking pixels
                        // Avoid very narrow/short images unless they are very long/wide (potential banners)
                        const reasonableAspectRatio = (width > 0 && height > 0) ?
                                                    (Math.max(width,height) / Math.min(width,height) < 10) || (width > 400 || height > 400)
                                                    : false;

                        if (isSignificantSize && isNotASpacer && reasonableAspectRatio) {
                            addImage(imgSrc, img.alt, 'Content Image');
                        }
                    }
                } catch (e) { console.warn(`Error with selector ${contentSelector} in getGeneralImages: ${e.message}`); }
            }

            // Convert Map values to Array
            return Array.from(collectedImages.values());
        }, baseUrl, [existingLogoUrls.Logo, existingLogoUrls.Icon, existingLogoUrls.Banner].filter(Boolean));

        // Limit to max 2-3 images for faster processing
        return (images || []).slice(0, 2); // Reduced from 4 to 2
    };

    // 3e. Extract Company Information (Name, Description, etc.)
    const getCompanyInfo = async (page, inputUrl) => { // Added page argument
        let name = await getMetaContent(page, ['meta[property="og:site_name"]', 'meta[name="application-name"]', 'meta[name="twitter:title"]', 'meta[itemprop="name"]']);
        if (!name) name = await getTextFromSelectors(page, ['title']);

        let description = await getMetaContent(page, ['meta[property="og:description"]', 'meta[name="description"]', 'meta[name="twitter:description"]', 'meta[itemprop="description"]']);

        let website = await getMetaContent(page, ['meta[property="og:url"]']);
        if(!website) website = await getAttributeFromSelectors(page, ['link[rel="canonical"]'], 'href');
        website = resolveUrl(website, inputUrl) || inputUrl;


        let industry = null, location = null, founded = null, companyType = null, employees = null;
        let keywords = [];

        try {
            const jsonLdData = await page.evaluate(() => {
                const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                const allJson = [];
                scripts.forEach(script => {
                    try { allJson.push(JSON.parse(script.textContent || '{}')); }
                    catch (e) { console.warn("Error parsing individual JSON-LD script:", e.message); }
                });
                return allJson;
            });

            const processJsonLdObject = (obj) => {
                if (!obj || typeof obj !== 'object') return;

                const type = obj['@type'];
                const isOrg = type === 'Organization' || type === 'Corporation' || (Array.isArray(type) && (type.includes('Organization') || type.includes('Corporation')));

                if (isOrg) {
                    if (!name && obj.name) name = typeof obj.name === 'string' ? obj.name.trim() : String(obj.name).trim();
                    if (!description && obj.description) description = String(obj.description).trim();
                    if (!description && obj.disambiguatingDescription) description = String(obj.disambiguatingDescription).trim();

                    if (!industry && obj.industry) {
                        industry = Array.isArray(obj.industry) ? obj.industry.map(String).join(', ') : String(obj.industry);
                    }

                    if (!location && obj.address) {
                        const addr = obj.address;
                        let locParts = [];
                        if (addr.streetAddress) locParts.push(addr.streetAddress);
                        if (addr.addressLocality) locParts.push(addr.addressLocality);
                        if (addr.addressRegion) locParts.push(addr.addressRegion);
                        if (addr.postalCode) locParts.push(addr.postalCode);
                        if (addr.addressCountry) locParts.push(typeof addr.addressCountry === 'string' ? addr.addressCountry : addr.addressCountry.name);
                        if (locParts.length > 0) location = locParts.join(', ');
                        else if (typeof addr === 'string') location = addr;
                    }
                     if (!location && obj.location?.address) { // Nested location
                        const addr = obj.location.address;
                        let locParts = [];
                        if (addr.streetAddress) locParts.push(addr.streetAddress);
                        if (addr.addressLocality) locParts.push(addr.addressLocality);
                        // ... (similar address parsing as above)
                        if (locParts.length > 0) location = locParts.join(', ');
                        else if (typeof addr === 'string') location = addr;
                    }


                    if (!founded && obj.foundingDate) founded = String(obj.foundingDate);

                    if (!employees && obj.numberOfEmployees) {
                        const emp = obj.numberOfEmployees;
                        if (emp.value) employees = String(emp.value);
                        else if (emp.minValue && emp.maxValue) employees = `${emp.minValue}-${emp.maxValue}`;
                        else if (typeof emp === 'string' || typeof emp === 'number') employees = String(emp);
                    }
                    if (!website && obj.url && typeof obj.url === 'string' && obj.url.startsWith('http')) website = obj.url;
                    if (obj.keywords) {
                        const kw = typeof obj.keywords === 'string' ? obj.keywords.split(',') : (Array.isArray(obj.keywords) ? obj.keywords : []);
                        keywords.push(...kw.map(k => String(k).trim()));
                    }
                    if (obj.knowsAbout) {
                         const ka = Array.isArray(obj.knowsAbout) ? obj.knowsAbout : [obj.knowsAbout];
                         ka.forEach(item => {
                             if(typeof item === 'string') keywords.push(item.trim());
                             else if (item && item.name && typeof item.name === 'string') keywords.push(item.name.trim());
                         });
                    }
                }
                // Recursively search in properties if it's an object or array
                Object.values(obj).forEach(value => {
                    if (typeof value === 'object' || Array.isArray(value)) {
                        processJsonLdObject(value);
                    }
                });
            };

            if (Array.isArray(jsonLdData)) {
                jsonLdData.forEach(processJsonLdObject);
            } else if (typeof jsonLdData === 'object') {
                processJsonLdObject(jsonLdData);
            }

        } catch(e) {
            console.warn("Error processing JSON-LD for company info:", e.message);
        }

        // Fallback for name if still not found
        if (!name) name = await getTextFromSelectors(page, ['h1', '.site-title', 'header [class*="title"]', 'meta[name="title"]']);
        // Fallback for description
        if (!description) description = await getMetaContent(page, ['meta[name="abstract"]', 'meta[name="subject"]']);

        if (keywords.length > 0 && !industry) { // Use keywords as a fallback for industry
            industry = [...new Set(keywords)].slice(0, 3).join(', '); // Take unique keywords, up to 3
        }


        return {
            Name: name ? name.substring(0, 255) : null, // Max length
            Description: description ? description.substring(0, 1000) : null, // Max length
            Industry: industry, Location: location,
            Founded: founded, CompanyType: companyType, Employees: employees, Website: website
        };
    };

    // 3f. Extract Social Media Links
    const getSocialLinks = async (page, baseUrl) => { // Added page, baseUrl arguments
        let links = await page.evaluate((pageBaseUrl) => { // Renamed for clarity
            const foundLinks = {};
            const socialSelectors = { // More comprehensive selectors
                Twitter: [
                    'a[href*="twitter.com/"][href*="intent/"]', // Less likely to be the main profile
                    'a[href*="twitter.com/"]',
                    'a[aria-label*="Twitter"i]',
                    'meta[property="og:see_also"][content*="twitter.com"]',
                    'meta[name="twitter:site"]' // Content is often @handle
                ],
                LinkedIn: [
                    'a[href*="linkedin.com/company/"]', 'a[href*="linkedin.com/school/"]', 'a[href*="linkedin.com/showcase/"]', 'a[href*="linkedin.com/in/"]',
                    'a[aria-label*="LinkedIn"i]',
                    'meta[property="og:see_also"][content*="linkedin.com"]'
                ],
                Facebook: [
                    'a[href*="facebook.com/"]', 'a[href*="fb.me/"]',
                    'a[aria-label*="Facebook"i]',
                    'meta[property="og:see_also"][content*="facebook.com"]'
                ],
                YouTube: [
                    'a[href*="youtube.com/channel/"]', 'a[href*="youtube.com/user/"]', 'a[href*="youtube.com/c/"]',
                    'a[aria-label*="YouTube"i]',
                    'meta[property="og:see_also"][content*="youtube.com"]'
                ],
                Instagram: [
                    'a[href*="instagram.com/"]',
                    'a[aria-label*="Instagram"i]',
                    'meta[property="og:see_also"][content*="instagram.com"]'
                ],
            };

            const resolveSocialUrl = (link, platform) => {
                if (!link) return null;
                if (platform === 'Twitter' && link.startsWith('@')) {
                    return `https://twitter.com/${link.substring(1)}`;
                }
                try { return new URL(link, pageBaseUrl).href; }
                catch (e) { return null; }
            };

            for (const [socialName, selectors] of Object.entries(socialSelectors)) {
                if (foundLinks[socialName]) continue; // Already found a good one

                for (const selector of selectors) {
                    try {
                        if (selector.startsWith('meta[')) { // Handle meta tags
                            const metaElement = document.querySelector(selector);
                            if (metaElement && metaElement.content) {
                                const resolved = resolveSocialUrl(metaElement.content, socialName);
                                if (resolved) { foundLinks[socialName] = resolved; break; }
                            }
                        } else { // Handle anchor tags
                            const elements = Array.from(document.querySelectorAll(selector));
                            for (const el of elements) {
                                const href = el.href;
                                // Basic filter to avoid share links, mailto, etc.
                                if (href && !href.startsWith('mailto:') && !href.includes('share') && !href.includes('intent')) {
                                     const resolved = resolveSocialUrl(href, socialName);
                                     if (resolved) {foundLinks[socialName] = resolved; break;}
                                }
                            }
                        }
                    } catch (e) { /* ignore selector errors */ }
                    if (foundLinks[socialName]) break;
                }
            }
            return foundLinks;
        }, baseUrl);

        return links || {};
    };

    // Execute logo details first as its output is needed by getGeneralImages
    const logoData = await getLogoDetails(page, url);
    let colorAnalysis ={};
    let logoColors = {};
    let bannerColors = {};
    // Execute remaining extraction functions in parallel with timeout for each
    console.log('[Extraction] Starting parallel data extraction...');
    const [colorData, fontData, imageData, companyInfoData, socialLinkData] = await Promise.all([
        Promise.race([
            getBrandColors(page),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Color extraction timeout')), 30000))
        ]).catch(err => { console.warn('[Colors] Extraction failed:', err.message); return []; }),
        
        Promise.race([
            getKeyFonts(page),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Font extraction timeout')), 15000))
        ]).catch(err => { console.warn('[Fonts] Extraction failed:', err.message); return []; }),
        
        Promise.race([
            getGeneralImages(page, url, logoData),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Image extraction timeout')), 20000))
        ]).catch(err => { console.warn('[Images] Extraction failed:', err.message); return []; }),
        
        Promise.race([
            getCompanyInfo(page, url),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Company info extraction timeout')), 25000))
        ]).catch(err => { console.warn('[Company Info] Extraction failed:', err.message); return {}; }),
        
        Promise.race([
            getSocialLinks(page, url),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Social links extraction timeout')), 15000))
        ]).catch(err => { console.warn('[Social Links] Extraction failed:', err.message); return {}; })
    ]);
    console.log('[Extraction] Parallel data extraction completed');
colorAnalysis = colorData; // Use the colorData directly, no need to merge with logo colors
    let finalCompanyInfo = { ...companyInfoData, SocialLinks: socialLinkData };

    // Smart LinkedIn data extraction - run in parallel with main extraction, with timeout
    let linkedInDataPromise = null;
    let linkedInData = null;
    if (socialLinkData && socialLinkData.LinkedIn) {
        const linkedInUrl = socialLinkData.LinkedIn;
        // Basic validation for a LinkedIn company URL structure
        if (linkedInUrl.includes('linkedin.com/company')) {
            logger.info('Found LinkedIn URL, starting parallel extraction', { details: { linkedInUrl } });
            
            // Start LinkedIn extraction in parallel with reduced timeout
            await fss.writeFile('urls.txt', linkedInUrl);
            // const newLogicData = scraperLink.main();
            // console.log('[extractCompanyDetailsFromPage] New logic data:', newLogicData);
            linkedInDataPromise = Promise.race([
                // extractCompanyDataFromLinkedIn(linkedInUrl),
                // extraction.scrapeLinkedInCompany(linkedInUrl),
                scraperLink.main(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('LinkedIn extraction timeout after 2 minutes')), 120000) // Reduced from 5 minutes to 2 minutes
                )
            ]).catch(error => {
                logger.warn(`LinkedIn extraction failed during parallel execution`, { 
                    details: { error: error.message, isTimeout: error.message.includes('timeout') } 
                });
                return { error: error.message }; // Return error object instead of throwing
            });
        }
    }

    // If LinkedIn extraction was started, wait for it with a reasonable timeout
    if (linkedInDataPromise) {
        try {
            console.log('[LinkedIn] Waiting for LinkedIn data extraction to complete...');
            // const linkedInData = await linkedInDataPromise;
            // AWAIT this promise to get its resolved value.
        // Execution will pause here until the promise settles.
        linkedInData = await linkedInDataPromise;

            if (linkedInData && !linkedInData.error) {
                logger.info('Merging LinkedIn data successfully', { details: { hasData: !!linkedInData } });
                // **FIXED: Correct field mapping from LinkedIn scraper response**
                finalCompanyInfo.Name = linkedInData.name || finalCompanyInfo.Name; // LinkedIn uses lowercase 'name'
                finalCompanyInfo.Description = linkedInData.description || linkedInData.aboutUs || finalCompanyInfo.Description;
                finalCompanyInfo.Industry = linkedInData.industry || finalCompanyInfo.Industry;
                finalCompanyInfo.CompanySize = linkedInData.companySize || linkedInData.employees || finalCompanyInfo.Employees;
                finalCompanyInfo.Location = linkedInData.location || linkedInData.headquarters || finalCompanyInfo.Location;
                finalCompanyInfo.Headquarters = linkedInData.headquarters || linkedInData.location || finalCompanyInfo.Location;
                finalCompanyInfo.Type = linkedInData.type || finalCompanyInfo.CompanyType;
                finalCompanyInfo.Founded = linkedInData.founded || finalCompanyInfo.Founded;
                finalCompanyInfo.Website = linkedInData.website || finalCompanyInfo.Website;
                finalCompanyInfo.Employees = linkedInData.employees || linkedInData.companySize || finalCompanyInfo.Employees;
                finalCompanyInfo.CompanyType = linkedInData.type || finalCompanyInfo.CompanyType;
                // **NEW: Add LinkedIn-specific data fields**
                if (linkedInData.specialties && linkedInData.specialties.length > 0) {
                    finalCompanyInfo.Specialties = linkedInData.specialties.filter(s => s && s.trim() !== '');
                }
                if (linkedInData.locations && linkedInData.locations.length > 0) {
                    finalCompanyInfo.Locations = linkedInData.locations.filter(l => l && l.trim() !== '');
                }
                
                // **ENHANCED: Better logging**
                console.log("[LinkedIn] Successfully merged data:");
                console.log("- Name:", finalCompanyInfo.Name);
                console.log("- Description:", finalCompanyInfo.Description ? "✅ Found" : "❌ Missing");
                console.log("- Industry:", finalCompanyInfo.Industry || "❌ Missing");
                console.log("- Founded:", finalCompanyInfo.Founded || "❌ Missing");
                console.log("- Headquarters:", finalCompanyInfo.Headquarters || "❌ Missing");
                // Potentially add LinkedIn banner to Logo object if found and not already present
                if (linkedInData.bannerUrl) {
                    logoData.LinkedInBanner = linkedInData.bannerUrl; // Add as a new property or replace
                    bannerColors = await extractColorsFromImage(logoData.LinkedInBanner, 'LinkedIn banner');
                    logger.info("LinkedIn banner colors extracted successfully", { 
                        details: { 
                            bannerUrl: logoData.LinkedInBanner,
                            colorsFound: bannerColors?.colors?.length || 0,
                            hasError: !!bannerColors?.error
                        } 
                    });
                    colorData.LinkedInBannerData = {
                        hex: bannerColors.hex,
                        rgb: bannerColors.rgb,//`rgb(${bannerColors.rgb.r},${bannerColors.rgb.g},${bannerColors.rgb.b})`,
                        width: bannerColors.width,
                        height: bannerColors.height,
                        colors: bannerColors.colors, // This is the array of hex colors 
                        name: 'Banner Image' 
                    };
                }
                if (linkedInData.logoUrl) {
                    logoData.LinkedInLogo = linkedInData.logoUrl; // Add as a new property or replace
                    logoColors = await extractColorsFromImage(logoData.LinkedInLogo, 'LinkedIn logo');
                    logger.info("LinkedIn logo colors extracted successfully", { 
                        details: { 
                            logoUrl: logoData.LinkedInLogo,
                            colorsFound: logoColors?.colors?.length || 0,
                            hasError: !!logoColors?.error
                        } 
                    });
                     colorData.LinkedInLogoData = {
                        hex: logoColors.hex,
                        rgb: logoColors.rgb,//`rgb(${logoColors.rgb.r},${logoColors.rgb.g},${logoColors.rgb.b})`,
                        width: logoColors.width,
                        height: logoColors.height,
                        colors: logoColors.colors,
                        name: 'Logo Image'
                    };
                }
                const colorAnalysis2 = [
                    bannerColors,
                     logoColors
                ]
                colorAnalysis = [...colorData, ...colorAnalysis2];
            } else if (linkedInData && linkedInData.error) {
                logger.warn('LinkedIn extraction failed, continuing without LinkedIn data', { 
                    details: { error: linkedInData.error, gracefulDegradation: true } 
                });
                finalCompanyInfo.LinkedInError = linkedInData.error; // Add error info for debugging
            }
        } catch (liError) {
            logger.error('Exception while processing LinkedIn data', liError, { 
                details: { url: linkedInUrl, gracefulDegradation: true } 
            });
            finalCompanyInfo.LinkedInError = liError.message;
        }
    }


    const endTime = Date.now();
    const extractionTime = (endTime - startTime) / 1000;
    logger.info('Company details extraction completed', { 
        details: { 
            url, 
            extractionTime: `${extractionTime.toFixed(2)} seconds`,
            hasLinkedInData: !!linkedInData && !linkedInData.error
        } 
    });

    return {
        Logo: logoData, 
        Colors: colorAnalysis,  // New field for color analysis
        Fonts: fontData, 
        Images: imageData,
        Company: finalCompanyInfo, // Use the potentially updated finalCompanyInfo
        _performance: {
            extractionTimeSeconds: extractionTime,
            timestamp: new Date().toISOString()
        },
        _message: "Data extracted dynamically. Accuracy may vary based on website structure."
    };
}


// New endpoint for extracting specific company details
app.post('/api/extract-company-details', async (req, res) => {
    const { url } = req.body;
    let sessionId = null;
    
    try {
        // Check if URL is provided
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'URL is required and must be a string' });
        }
        
        const originalUrl = url.trim();
        
        // Check if URL is empty after trimming
        if (!originalUrl) {
            return res.status(400).json({ error: 'URL cannot be empty' });
        }
        
        // Start extraction session for logging
        sessionId = extractionLogger.startSession(originalUrl);
        extractionLogger.step('URL Validation', { originalUrl });
        
        // Track performance start time
        const performanceStart = Date.now();
        
        // Normalize the URL (adds https:// if missing)
        const normalizedUrl = utils.normalizeUrl(originalUrl);
        
        // Check if normalization failed
        if (!normalizedUrl) {
            extractionLogger.error('URL normalization failed', new Error('Invalid URL format'), { originalUrl });
            return res.status(400).json({ 
                error: 'Invalid URL format - unable to normalize',
                provided: originalUrl,
                sessionId
            });
        }
        
        extractionLogger.step('URL Normalized', { normalizedUrl });
        
        // Validate the normalized URL
        if (!utils.isValidUrl(normalizedUrl)) {
            extractionLogger.error('URL validation failed', new Error('Invalid URL format'), { originalUrl, normalizedUrl });
            console.log(`[DEBUG] URL validation failed for: "${originalUrl}" -> "${normalizedUrl}"`);
            return res.status(400).json({ 
                error: 'Invalid URL format',
                provided: originalUrl,
                normalized: normalizedUrl,
                sessionId
            });
        }
        
        extractionLogger.step('URL Validation Complete', { status: 'valid' });

        // Check cache first for performance
        const cacheKey = normalizedUrl.toLowerCase().trim();
        const cachedResult = extractionCache.get(cacheKey);
        if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_DURATION) {
            extractionLogger.info('Cache hit - returning cached result', { 
                url, 
                cacheAge: Math.round((Date.now() - cachedResult.timestamp) / 1000) + 's' 
            }, sessionId);
            extractionLogger.endSession(sessionId, 'completed', cachedResult.data);
            
            // Log to search history for cache hit
            await searchHistoryLogger.logSearch({
                url: originalUrl,
                normalizedUrl,
                sessionId,
                status: 'success',
                duration: Date.now() - performanceStart,
                cacheHit: true,
                userAgent: getUserAgent(),
                fieldsExtracted: Object.keys(cachedResult.data),
                companyName: cachedResult.data.companyName,
                industry: cachedResult.data.industry,
                companyLogo: cachedResult.data.companyLogo,
                bannerImage: cachedResult.data.bannerImage,
                website: cachedResult.data.website,
                verifiedPage: cachedResult.data.verifiedPage
            });
            
            return res.status(200).json({
                ...cachedResult.data,
                _cached: true,
                _cacheAge: Math.round((Date.now() - cachedResult.timestamp) / 1000),
                _sessionId: sessionId
            });
        }
        
        extractionLogger.step('Cache Check Complete', { status: 'cache_miss' });

        const isResolvable = await utils.isDomainResolvable(normalizedUrl);
        if (!isResolvable) {
            extractionLogger.error('Domain resolution failed', new Error('Domain name could not be resolved'), { normalizedUrl }, sessionId);
            extractionLogger.endSession(sessionId, 'failed');
            return res.status(400).json({ 
                error: 'Domain name could not be resolved', 
                sessionId 
            });
        }
        
        extractionLogger.step('Domain Resolution Complete', { status: 'resolved' });

        let browser;
        try {
            extractionLogger.step('Browser Launch Starting', { userAgent: getUserAgent() });
            const { browser: launchedBrowser, page } = await setupPuppeteerPageForCompanyDetails(normalizedUrl);
            browser = launchedBrowser;
            extractionLogger.step('Browser Launch Complete', { status: 'success' });

            // Add timeout wrapper for the entire extraction process with smart timeout
            extractionLogger.step('Extraction Process Starting', { timeout: '4 minutes' });
            console.log('[Extraction] Starting company details extraction with 4-minute timeout...');
            
            const companyDetails = await Promise.race([
                extractCompanyDetailsFromPage(page, normalizedUrl, browser),
                new Promise((_, reject) => 
                    setTimeout(() => {
                        extractionLogger.error('Extraction timeout', new Error('Company extraction timeout after 4 minutes'), { normalizedUrl }, sessionId);
                        reject(new Error('Company extraction timeout after 4 minutes'));
                    }, 240000) // Balanced timeout - allows LinkedIn extraction but not too long
                )
            ]);

            extractionLogger.step('Extraction Process Complete', { status: 'success', dataFields: Object.keys(companyDetails).length });

            // Cache the result for future requests
            extractionCache.set(cacheKey, {
                data: companyDetails,
                timestamp: Date.now()
            });
            extractionLogger.step('Result Cached', { cacheKey });

            // Clean old cache entries periodically
            if (extractionCache.size > 100) { // Limit cache size
                const oldestEntries = Array.from(extractionCache.entries())
                    .sort((a, b) => a[1].timestamp - b[1].timestamp)
                    .slice(0, 20); // Remove oldest 20 entries
                
                oldestEntries.forEach(([key]) => extractionCache.delete(key));
                extractionLogger.step('Cache Cleanup', { removedEntries: 20, totalCacheSize: extractionCache.size });
            }

            extractionLogger.endSession(sessionId, 'completed', companyDetails);
            
            // Log to search history for successful extraction
            await searchHistoryLogger.logSearch({
                url: originalUrl,
                normalizedUrl,
                sessionId,
                status: 'success',
                duration: Date.now() - performanceStart,
                cacheHit: false,
                userAgent: getUserAgent(),
                fieldsExtracted: Object.keys(companyDetails),
                companyName: companyDetails.companyName,
                industry: companyDetails.industry,
                companyLogo: companyDetails.companyLogo,
                bannerImage: companyDetails.bannerImage,
                website: companyDetails.website,
                verifiedPage: companyDetails.verifiedPage,
                browserUsed: 'chrome'
            });
            
            res.status(200).json({
                ...companyDetails,
                _sessionId: sessionId
            });

        } catch (error) {
            extractionLogger.error('Company details extraction failed', error, { 
                url: normalizedUrl, 
                userAgent: getUserAgent(),
                platform: os.platform()
            }, sessionId);
            
            // Enhanced error handling with specific error types
            let errorMessage = 'Failed to extract company details. An unexpected error occurred.';
            let statusCode = 500;

            if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
                errorMessage = 'The extraction timed out. The page might be too complex or unresponsive.';
                statusCode = 504; // Gateway Timeout
                extractionLogger.warn('Extraction timeout occurred', { url: normalizedUrl, timeout: '4 minutes' }, sessionId);
            } else if (error.message.includes('net::ERR_') || error.message.includes('navigation')) {
                errorMessage = 'Failed to navigate to the website. Please check if the URL is accessible.';
                statusCode = 502; // Bad Gateway
                extractionLogger.error('Navigation error', error, { url: normalizedUrl }, sessionId);
            } else if (error.message.includes('browser') || error.message.includes('launch')) {
                errorMessage = 'Browser initialization failed. Please try again.';
                statusCode = 503; // Service Unavailable
                extractionLogger.error('Browser launch error', error, { url: normalizedUrl }, sessionId);
            }

            extractionLogger.endSession(sessionId, 'failed', { error: errorMessage, details: error.message });
            
            // Log to search history for failed extraction
            await searchHistoryLogger.logSearch({
                url: originalUrl,
                normalizedUrl,
                sessionId,
                status: 'failed',
                statusCode,
                errorMessage,
                duration: Date.now() - performanceStart,
                cacheHit: false,
                userAgent: getUserAgent(),
                browserUsed: 'chrome'
            });
            
            res.status(statusCode).json({ 
                error: errorMessage, 
                details: error.message,
                _timestamp: new Date().toISOString(),
                _errorType: error.name || 'Unknown',
                _sessionId: sessionId
            });
        } finally {
            if (browser) {
                try {
                    extractionLogger.step('Browser Cleanup Starting', null, sessionId);
                    await browser.close(); // Ensure browser is closed
                    console.log('[Browser] Browser closed successfully');
                    extractionLogger.step('Browser Cleanup Complete', { status: 'success' }, sessionId);
                } catch (closeError) {
                    console.error('[Browser] Error closing browser:', closeError.message);
                    extractionLogger.error('Browser cleanup failed', closeError, null, sessionId);
                }
            }
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
                extractionLogger.debug('Garbage collection triggered', null, sessionId);
            }
        }
        
    } catch (outerError) {
        // Handle any errors that occur outside the main try block (like session creation)
        if (sessionId) {
            extractionLogger.error('Outer extraction error', outerError, { url }, sessionId);
            extractionLogger.endSession(sessionId, 'failed');
            
            // Log to search history for critical error
            try {
                await searchHistoryLogger.logSearch({
                    url: url || 'unknown',
                    normalizedUrl: 'unknown',
                    sessionId,
                    status: 'failed',
                    statusCode: 500,
                    errorMessage: 'Critical extraction error occurred',
                    duration: Date.now() - (performanceStart || Date.now()),
                    cacheHit: false,
                    userAgent: getUserAgent()
                });
            } catch (logError) {
                console.error('Failed to log search history for outer error:', logError);
            }
        }
        
        res.status(500).json({
            error: 'Critical extraction error occurred',
            details: outerError.message,
            _timestamp: new Date().toISOString(),
            _sessionId: sessionId
        });
    }
});
