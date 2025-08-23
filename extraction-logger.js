/**
 * Extraction Logger System
 * Captures and manages extraction logs for debugging production issues
 * Provides real-time logging visibility similar to local development
 */

class ExtractionLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000; // Prevent memory overflow
        this.sessionLogs = new Map(); // Session-based logs
        this.maxSessions = 50; // Limit concurrent sessions
        this.currentSessionId = null;
    }

    /**
     * Start a new extraction session
     */
    startSession(url, sessionId = null) {
        const session = sessionId || this._generateSessionId();
        this.currentSessionId = session;
        
        const now = Date.now();
        const sessionLog = {
            sessionId: session,
            url: url,
            startTime: new Date(now).toISOString(),
            endTime: null,
            status: 'running',
            logs: [],
            steps: [],
            errors: [],
            warnings: [],
            performance: {
                startTime: now,
                endTime: null,
                duration: null
            }
        };

        this.sessionLogs.set(session, sessionLog);
        this._cleanupOldSessions();
        
        this.log('info', `🚀 Starting extraction session for: ${url}`, { sessionId: session });
        
        return session;
    }

    /**
     * End current extraction session
     */
    endSession(sessionId, status = 'completed', result = null) {
        const session = this.sessionLogs.get(sessionId);
        if (session) {
            session.endTime = new Date().toISOString();
            session.status = status;
            session.performance.endTime = Date.now();
            session.performance.duration = session.performance.endTime - session.performance.startTime;
            
            if (result) {
                session.result = result;
            }

            this.log('info', `✅ Session ${status}: ${session.url} (${session.performance.duration}ms)`, { sessionId });
        }
        
        this.currentSessionId = null;
    }

    /**
     * Log extraction step
     */
    step(stepName, details = null, sessionId = null) {
        const session = sessionId || this.currentSessionId;
        const timestamp = new Date().toISOString();
        const stepData = {
            step: stepName,
            timestamp,
            details,
            performance: Date.now()
        };

        // Add to session logs
        if (session && this.sessionLogs.has(session)) {
            this.sessionLogs.get(session).steps.push(stepData);
        }

        // Add to global logs
        stepData.sessionId = session;
        this.log('step', `📋 STEP: ${stepName}`, stepData);
        
        console.log(`📋 [${timestamp}] STEP: ${stepName}${details ? ` - ${JSON.stringify(details)}` : ''}`);
    }

    /**
     * Log with different levels
     */
    log(level, message, data = null, sessionId = null) {
        const session = sessionId || this.currentSessionId;
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data,
            sessionId: session
        };

        // Add to global logs
        this.logs.push(logEntry);
        this._rotateGlobalLogs();

        // Add to session logs
        if (session && this.sessionLogs.has(session)) {
            const sessionLog = this.sessionLogs.get(session);
            sessionLog.logs.push(logEntry);

            // Categorize by level
            if (level === 'error') {
                sessionLog.errors.push(logEntry);
            } else if (level === 'warn') {
                sessionLog.warnings.push(logEntry);
            }
        }

        // Console output with emoji prefixes
        const emoji = this._getLevelEmoji(level);
        const sessionInfo = session ? `[${session}] ` : '';
        console.log(`${emoji} [${timestamp}] ${sessionInfo}${message}`);
        
        if (data && typeof data === 'object') {
            console.log('   📊 Data:', JSON.stringify(data, null, 2));
        }
    }

    /**
     * Log error with stack trace
     */
    error(message, error, details = null, sessionId = null) {
        const session = sessionId || this.currentSessionId;
        const errorData = {
            message,
            error: error?.message || error,
            stack: error?.stack,
            details
        };

        this.log('error', message, errorData, session);
        
        // Also log to console.error for proper error handling
        console.error(`❌ [ERROR] ${message}`, error);
    }

    /**
     * Log warning
     */
    warn(message, details = null, sessionId = null) {
        this.log('warn', message, details, sessionId);
    }

    /**
     * Log info
     */
    info(message, details = null, sessionId = null) {
        this.log('info', message, details, sessionId);
    }

    /**
     * Log debug information
     */
    debug(message, details = null, sessionId = null) {
        this.log('debug', message, details, sessionId);
    }

    /**
     * Get logs for a specific session
     */
    getSessionLogs(sessionId) {
        return this.sessionLogs.get(sessionId) || null;
    }

    /**
     * Get all active sessions
     */
    getActiveSessions() {
        const sessions = Array.from(this.sessionLogs.values());
        return sessions.map(session => ({
            sessionId: session.sessionId,
            url: session.url,
            startTime: session.startTime,
            endTime: session.endTime,
            status: session.status,
            duration: session.performance.duration,
            stepsCount: session.steps.length,
            errorsCount: session.errors.length,
            warningsCount: session.warnings.length
        }));
    }

    /**
     * Get recent logs (global)
     */
    getRecentLogs(limit = 100, level = null, sessionId = null, offset = 0) {
        let filteredLogs = [...this.logs];

        // Filter by level
        if (level) {
            filteredLogs = filteredLogs.filter(log => log.level === level);
        }

        // Filter by session
        if (sessionId) {
            filteredLogs = filteredLogs.filter(log => log.sessionId === sessionId);
        }

        // Sort by timestamp (most recent first)
        filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Apply offset and limit for pagination
        const startIndex = offset;
        const endIndex = startIndex + limit;
        
        return filteredLogs.slice(startIndex, endIndex);
    }

    /**
     * Get system statistics
     */
    getStats() {
        const totalSessions = this.sessionLogs.size;
        const runningSessions = Array.from(this.sessionLogs.values())
            .filter(s => s.status === 'running').length;
        const completedSessions = Array.from(this.sessionLogs.values())
            .filter(s => s.status === 'completed').length;
        const failedSessions = Array.from(this.sessionLogs.values())
            .filter(s => s.status === 'failed').length;

        return {
            totalLogs: this.logs.length,
            totalSessions,
            runningSessions,
            completedSessions,
            failedSessions,
            successRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : 0,
            memoryUsage: {
                globalLogs: this.logs.length,
                sessionLogs: this.sessionLogs.size,
                maxGlobalLogs: this.maxLogs,
                maxSessions: this.maxSessions
            }
        };
    }

    /**
     * Clear all logs (emergency cleanup)
     */
    clearAllLogs() {
        const clearedCount = this.logs.length + this.sessionLogs.size;
        this.logs = [];
        this.sessionLogs.clear();
        this.currentSessionId = null;
        
        console.log(`🧹 Cleared ${clearedCount} log entries`);
        return clearedCount;
    }

    /**
     * Generate unique session ID
     */
    _generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get emoji for log level
     */
    _getLevelEmoji(level) {
        const emojis = {
            'error': '❌',
            'warn': '⚠️',
            'info': 'ℹ️',
            'debug': '🐛',
            'step': '📋',
            'success': '✅'
        };
        return emojis[level] || '📝';
    }

    /**
     * Rotate global logs to prevent memory overflow
     */
    _rotateGlobalLogs() {
        if (this.logs.length > this.maxLogs) {
            const removeCount = Math.floor(this.maxLogs * 0.2); // Remove 20%
            this.logs.splice(0, removeCount);
        }
    }

    /**
     * Cleanup old sessions to prevent memory overflow
     */
    _cleanupOldSessions() {
        if (this.sessionLogs.size > this.maxSessions) {
            const sessions = Array.from(this.sessionLogs.entries())
                .sort((a, b) => new Date(a[1].startTime) - new Date(b[1].startTime));
            
            const removeCount = Math.floor(this.maxSessions * 0.2); // Remove 20% oldest
            for (let i = 0; i < removeCount; i++) {
                this.sessionLogs.delete(sessions[i][0]);
            }
        }
    }
}

// Create singleton instance
const extractionLogger = new ExtractionLogger();

module.exports = { extractionLogger, ExtractionLogger };