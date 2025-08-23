/**
 * Detailed File Logger System
 * Separate log files for different types of activities
 * Comprehensive logging with rotation and management
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { sanitizeForLogging, sanitizeUrl, sanitizeObjectForLogging } = require('./utils/input-sanitizer');

class DetailedFileLogger {
    constructor() {
        this.logsDir = path.join(__dirname, 'logs');
        this.logFiles = {
            extraction: 'extraction.log',
            errors: 'errors.log',
            performance: 'performance.log',
            system: 'system.log',
            api: 'api.log',
            security: 'security.log',
            browser: 'browser.log',
            linkedin: 'linkedin.log'
        };
        
        this.maxLogSize = 10 * 1024 * 1024; // 10MB per log file
        this.maxLogFiles = 5; // Keep 5 rotated files
        
        this.initializeLogger();
    }

    async initializeLogger() {
        try {
            // Create logs directory
            await fs.mkdir(this.logsDir, { recursive: true });
            
            // Create initial log files if they don't exist
            for (const [type, filename] of Object.entries(this.logFiles)) {
                const filePath = path.join(this.logsDir, filename);
                try {
                    await fs.access(filePath);
                } catch (error) {
                    // File doesn't exist, create it
                    await fs.writeFile(filePath, `# ${type.toUpperCase()} LOG - Started at ${new Date().toISOString()}\n`, 'utf8');
                }
            }
            
            console.log('📝 Detailed file logger initialized');
        } catch (error) {
            console.error('❌ Failed to initialize detailed file logger:', error);
        }
    }

    /**
     * Log extraction activities
     */
    async logExtraction(level, message, data = null, sessionId = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            sessionId,
            data,
            type: 'extraction'
        };

        await this.writeToLog('extraction', logEntry);
    }

    /**
     * Log errors
     */
    async logError(error, context = null, sessionId = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'error',
            message: error.message || error,
            stack: error.stack,
            context,
            sessionId,
            type: 'error'
        };

        await this.writeToLog('errors', logEntry);
    }

    /**
     * Log performance metrics
     */
    async logPerformance(operation, duration, details = null, sessionId = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            operation,
            duration,
            details,
            sessionId,
            type: 'performance'
        };

        await this.writeToLog('performance', logEntry);
    }

    /**
     * Log system activities
     */
    async logSystem(level, message, details = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            details,
            system: {
                memory: process.memoryUsage(),
                uptime: process.uptime(),
                platform: process.platform
            },
            type: 'system'
        };

        await this.writeToLog('system', logEntry);
    }

    /**
     * Log API requests and responses
     */
    async logAPI(method, url, statusCode, duration, userAgent = null, ip = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            method,
            url,
            statusCode,
            duration,
            userAgent,
            ip,
            type: 'api'
        };

        await this.writeToLog('api', logEntry);
    }

    /**
     * Log security events
     */
    async logSecurity(event, severity, details, ip = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            event,
            severity,
            details,
            ip,
            userAgent: details.userAgent,
            type: 'security'
        };

        await this.writeToLog('security', logEntry);
    }

    /**
     * Log browser activities
     */
    async logBrowser(action, success, details = null, sessionId = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            action,
            success,
            details,
            sessionId,
            type: 'browser'
        };

        await this.writeToLog('browser', logEntry);
    }

    /**
     * Log LinkedIn-specific activities
     */
    async logLinkedIn(action, success, details = null, sessionId = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            action,
            success,
            details,
            sessionId,
            type: 'linkedin'
        };

        await this.writeToLog('linkedin', logEntry);
    }

    /**
     * Write to specific log file
     */
    async writeToLog(logType, logEntry) {
        const filename = this.logFiles[logType];
        if (!filename) {
            console.error(`❌ Unknown log type: ${logType}`);
            return;
        }

        const filePath = path.join(this.logsDir, filename);
        const logLine = JSON.stringify(logEntry) + '\n';

        try {
            // Check if file needs rotation
            await this.checkAndRotateLog(filePath);
            
            // Write log entry
            await fs.appendFile(filePath, logLine, 'utf8');
        } catch (error) {
            console.error(`❌ Failed to write ${logType} log:`, error);
        }
    }

    /**
     * Check if log file needs rotation and rotate if necessary
     */
    async checkAndRotateLog(filePath) {
        try {
            const stats = await fs.stat(filePath);
            
            if (stats.size > this.maxLogSize) {
                await this.rotateLogFile(filePath);
            }
        } catch (error) {
            // File doesn't exist or other error - ignore
        }
    }

    /**
     * Rotate log file when it gets too large
     */
    async rotateLogFile(filePath) {
        const fileDir = path.dirname(filePath);
        const fileName = path.basename(filePath, '.log');
        
        try {
            // Rotate existing backup files
            for (let i = this.maxLogFiles - 1; i >= 1; i--) {
                const currentBackup = path.join(fileDir, `${fileName}.${i}.log`);
                const nextBackup = path.join(fileDir, `${fileName}.${i + 1}.log`);
                
                try {
                    await fs.access(currentBackup);
                    if (i === this.maxLogFiles - 1) {
                        // Delete the oldest file
                        await fs.unlink(currentBackup);
                    } else {
                        // Move to next number
                        await fs.rename(currentBackup, nextBackup);
                    }
                } catch (error) {
                    // File doesn't exist - skip
                }
            }
            
            // Move current log to .1 backup
            const firstBackup = path.join(fileDir, `${fileName}.1.log`);
            await fs.rename(filePath, firstBackup);
            
            // Create new empty log file
            const logType = fileName.replace(/[-_]/g, ' ').toUpperCase();
            await fs.writeFile(filePath, `# ${logType} LOG - Started at ${new Date().toISOString()}\n`, 'utf8');

            console.log(`🔄 Rotated log file:`, sanitizeForLogging(fileName.log));
        } catch (error) {
            console.error(`❌ Failed to rotate log file ${filePath}:`, error);
        }
    }

    /**
     * Get log file statistics
     */
    async getLogStats() {
        const stats = {};
        
        for (const [type, filename] of Object.entries(this.logFiles)) {
            const filePath = path.join(this.logsDir, filename);
            
            try {
                const fileStats = await fs.stat(filePath);
                stats[type] = {
                    size: fileStats.size,
                    sizeFormatted: this.formatFileSize(fileStats.size),
                    lastModified: fileStats.mtime,
                    exists: true
                };
            } catch (error) {
                stats[type] = {
                    size: 0,
                    sizeFormatted: '0 B',
                    lastModified: null,
                    exists: false
                };
            }
        }
        
        return stats;
    }

    /**
     * Format file size in human-readable format
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Read recent entries from a specific log
     */
    async readRecentLogs(logType, limit = 100) {
        const filename = this.logFiles[logType];
        if (!filename) {
            throw new Error(`Unknown log type: ${logType}`);
        }

        const filePath = path.join(this.logsDir, filename);
        
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            
            // Parse JSON lines
            const logs = [];
            for (let i = Math.max(0, lines.length - limit); i < lines.length; i++) {
                try {
                    if (lines[i].startsWith('#')) continue; // Skip header comments
                    const logEntry = JSON.parse(lines[i]);
                    logs.push(logEntry);
                } catch (parseError) {
                    // Skip invalid JSON lines
                }
            }
            
            return logs.reverse(); // Most recent first
        } catch (error) {
            if (error.code === 'ENOENT') {
                return []; // File doesn't exist
            }
            throw error;
        }
    }

    /**
     * Search logs across all types
     */
    async searchLogs(query, options = {}) {
        const {
            logTypes = Object.keys(this.logFiles),
            caseSensitive = false,
            limit = 100,
            fromDate = null,
            toDate = null
        } = options;

        const searchQuery = caseSensitive ? query : query.toLowerCase();
        const results = [];

        for (const logType of logTypes) {
            try {
                const logs = await this.readRecentLogs(logType, 1000); // Read more for searching
                
                const filtered = logs.filter(log => {
                    // Date filter
                    if (fromDate && log.timestamp < fromDate) return false;
                    if (toDate && log.timestamp > toDate) return false;
                    
                    // Text search
                    const logText = caseSensitive 
                        ? JSON.stringify(log) 
                        : JSON.stringify(log).toLowerCase();
                    
                    return logText.includes(searchQuery);
                });

                results.push(...filtered.map(log => ({ ...log, logType })));
            } catch (error) {
                console.error(`Error searching ${logType} logs:`, error);
            }
        }

        // Sort by timestamp and limit
        return results
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    /**
     * Export logs to file
     */
    async exportLogs(logType, format = 'json') {
        const exportDir = path.join(this.logsDir, 'exports');
        await fs.mkdir(exportDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${logType}-export-${timestamp}.${format}`;
        const exportPath = path.join(exportDir, filename);

        try {
            const logs = await this.readRecentLogs(logType, 10000); // Export up to 10k entries
            
            if (format === 'json') {
                const exportData = {
                    exportTimestamp: new Date().toISOString(),
                    logType,
                    totalEntries: logs.length,
                    logs
                };
                await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2), 'utf8');
            } else if (format === 'csv') {
                const csv = this.convertLogsToCSV(logs);
                await fs.writeFile(exportPath, csv, 'utf8');
            }

            return exportPath;
        } catch (error) {
            throw new Error(`Failed to export ${logType} logs: ${error.message}`);
        }
    }

    /**
     * Convert logs to CSV format
     */
    convertLogsToCSV(logs) {
        if (logs.length === 0) return '';

        // Common headers
        const headers = ['Timestamp', 'Level', 'Message', 'Session ID', 'Data'];
        
        const rows = logs.map(log => [
            log.timestamp,
            log.level || log.severity || 'info',
            log.message || log.action || log.operation || '',
            log.sessionId || '',
            JSON.stringify(log.data || log.details || {})
        ]);

        return [headers, ...rows]
            .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
            .join('\n');
    }

    /**
     * Clean up old log files
     */
    async cleanupOldLogs(daysToKeep = 30) {
        const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        let totalCleaned = 0;

        try {
            const files = await fs.readdir(this.logsDir);
            
            for (const file of files) {
                if (file.match(/\.\d+\.log$/)) { // Rotated log files
                    const filePath = path.join(this.logsDir, file);
                    const stats = await fs.stat(filePath);
                    
                    if (stats.mtime.getTime() < cutoffDate) {
                        await fs.unlink(filePath);
                        totalCleaned++;
                        console.log(`🗑️ Deleted old log file: ${file}`);
                    }
                }
            }

            if (totalCleaned > 0) {
                console.log(`🧹 Cleaned up ${totalCleaned} old log files`);
            }

            return totalCleaned;
        } catch (error) {
            console.error('❌ Error cleaning up old logs:', error);
            return 0;
        }
    }
}

// Create singleton instance
const detailedFileLogger = new DetailedFileLogger();

module.exports = { detailedFileLogger, DetailedFileLogger };