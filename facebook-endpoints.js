/**
 * Facebook Learning System API Endpoints
 */

const express = require('express');
const { FacebookAntiBotSystem } = require('./facebook-anti-bot');

const router = express.Router();

// Facebook learning analytics endpoint
router.get('/facebook-learning-analytics', async (req, res) => {
    try {
        const facebookAntiBot = new FacebookAntiBotSystem();
        const analytics = facebookAntiBot.getLearningAnalytics();
        
        res.json({
            success: true,
            analytics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get learning analytics',
            details: error.message
        });
    }
});

// Facebook platform compatibility test
router.get('/facebook-platform-test', async (req, res) => {
    try {
        const { FacebookPlatformUtils } = require('./facebook-platform-utils');
        
        const platformInfo = {
            platform: require('os').platform(),
            isProduction: FacebookPlatformUtils.isProduction(),
            isLinux: FacebookPlatformUtils.isLinux(),
            isWindows: FacebookPlatformUtils.isWindows(),
            isMac: FacebookPlatformUtils.isMac(),
            browserPath: FacebookPlatformUtils.getBrowserExecutablePath(),
            optimalViewport: FacebookPlatformUtils.getOptimalViewport(),
            memoryArgs: FacebookPlatformUtils.getMemoryOptimizedArgs(),
            nodeVersion: process.version,
            timestamp: new Date().toISOString()
        };
        
        res.json({
            success: true,
            platformInfo,
            compatible: true,
            message: 'Facebook scraper is compatible with this platform'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Platform compatibility test failed',
            details: error.message
        });
    }
});

// Facebook anti-bot status endpoint
router.get('/facebook-anti-bot-status', async (req, res) => {
    try {
        const facebookAntiBot = new FacebookAntiBotSystem();
        const analytics = facebookAntiBot.getLearningAnalytics();
        
        const format = req.query.format;
        if (format === 'html') {
            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Facebook Anti-Bot Status</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .metric { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
                    .success { color: #28a745; }
                    .warning { color: #ffc107; }
                    .error { color: #dc3545; }
                </style>
            </head>
            <body>
                <h1>Facebook Anti-Bot Learning System Status</h1>
                <div class="metric">
                    <h3>Total Attempts</h3>
                    <p>${analytics.totalAttempts}</p>
                </div>
                <div class="metric">
                    <h3>Success Rate</h3>
                    <p class="${parseFloat(analytics.successRate) > 70 ? 'success' : parseFloat(analytics.successRate) > 40 ? 'warning' : 'error'}">${analytics.successRate}</p>
                </div>
                <div class="metric">
                    <h3>Working Selectors</h3>
                    <p>${analytics.workingSelectors}</p>
                </div>
                <div class="metric">
                    <h3>Failed Selectors</h3>
                    <p>${analytics.failedSelectors}</p>
                </div>
                <div class="metric">
                    <h3>Effective Strategies</h3>
                    <p>${analytics.effectiveStrategies}</p>
                </div>
                <div class="metric">
                    <h3>Last Update</h3>
                    <p>${analytics.lastUpdate}</p>
                </div>
                <p><a href="/facebook-learning-analytics">View JSON Data</a></p>
            </body>
            </html>
            `;
            res.send(html);
        } else {
            res.json({
                success: true,
                status: 'Facebook Anti-Bot Learning System Active',
                analytics,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get Facebook anti-bot status',
            details: error.message
        });
    }
});

module.exports = router;