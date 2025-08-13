/**
 * Search History Logger
 * Long-term storage and tracking of all extraction searches
 * Stores comprehensive data for analytics and monitoring
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class SearchHistoryLogger {
    constructor() {
        this.historyDir = path.join(__dirname, 'search-history');
        this.historyFile = path.join(this.historyDir, 'search-history.json');
        this.dailyLogDir = path.join(this.historyDir, 'daily-logs');
        this.searchHistory = [];
        this.maxMemoryHistory = 500; // Keep recent 500 searches in memory
        
        // Initialize storage
        this.initializeStorage();
    }

    async initializeStorage() {
        try {
            // Create directories
            await fs.mkdir(this.historyDir, { recursive: true });
            await fs.mkdir(this.dailyLogDir, { recursive: true });

            // Load existing history
            await this.loadExistingHistory();
            
            console.log('📚 Search history logger initialized');
        } catch (error) {
            console.error('❌ Failed to initialize search history logger:', error);
        }
    }

    async loadExistingHistory() {
        try {
            const data = await fs.readFile(this.historyFile, 'utf8');
            const history = JSON.parse(data);
            this.searchHistory = history.searches || [];
            
            // Keep only recent searches in memory
            if (this.searchHistory.length > this.maxMemoryHistory) {
                this.searchHistory = this.searchHistory.slice(-this.maxMemoryHistory);
            }
            
            console.log(`📊 Loaded ${this.searchHistory.length} recent searches from history`);
        } catch (error) {
            // File doesn't exist or is corrupt - start fresh
            this.searchHistory = [];
            console.log('📝 Starting fresh search history');
        }
    }

    /**
     * Log a search entry with comprehensive details
     */
    async logSearch(searchData) {
        const timestamp = new Date().toISOString();
        const searchId = this.generateSearchId();
        
        const searchEntry = {
            searchId,
            timestamp,
            url: searchData.url,
            normalizedUrl: searchData.normalizedUrl,
            domain: this.extractDomain(searchData.normalizedUrl || searchData.url),
            sessionId: searchData.sessionId,
            
            // Status information
            status: searchData.status || 'unknown', // 'success', 'failed', 'cached', 'timeout', etc.
            statusCode: searchData.statusCode,
            errorMessage: searchData.errorMessage,
            
            // Performance metrics
            performance: {
                duration: searchData.duration,
                cacheHit: searchData.cacheHit || false,
                browserLaunchTime: searchData.browserLaunchTime,
                extractionTime: searchData.extractionTime,
                dataSize: searchData.dataSize
            },
            
            // Extraction results summary
            extraction: {
                fieldsExtracted: searchData.fieldsExtracted || [],
                companyName: searchData.companyName,
                industry: searchData.industry,
                hasLogo: !!searchData.companyLogo,
                hasBanner: !!searchData.bannerImage,
                hasWebsite: !!searchData.website,
                isLinkedIn: this.isLinkedInUrl(searchData.normalizedUrl || searchData.url),
                isVerified: searchData.verifiedPage || false
            },
            
            // Technical details
            technical: {
                userAgent: searchData.userAgent,
                browserUsed: searchData.browserUsed,
                platform: process.platform,
                nodeVersion: process.version,
                retryCount: searchData.retryCount || 0
            },
            
            // User context (if available)
            context: {
                userIP: searchData.userIP,
                referer: searchData.referer,
                source: searchData.source || 'api'
            }
        };

        // Add to memory history
        this.searchHistory.push(searchEntry);
        
        // Rotate memory history
        if (this.searchHistory.length > this.maxMemoryHistory) {
            this.searchHistory.shift();
        }

        // Save to persistent storage
        await this.saveSearchEntry(searchEntry);
        
        // Log to daily file
        await this.logToDailyFile(searchEntry);

        return searchEntry;
    }

    /**
     * Save search entry to main history file
     */
    async saveSearchEntry(searchEntry) {
        try {
            // Load current history
            let fullHistory = [];
            try {
                const data = await fs.readFile(this.historyFile, 'utf8');
                const historyData = JSON.parse(data);
                fullHistory = historyData.searches || [];
            } catch (error) {
                // File doesn't exist - start fresh
                fullHistory = [];
            }

            // Add new entry
            fullHistory.push(searchEntry);

            // Save back to file
            const historyData = {
                lastUpdated: new Date().toISOString(),
                totalSearches: fullHistory.length,
                searches: fullHistory
            };

            await fs.writeFile(this.historyFile, JSON.stringify(historyData, null, 2), 'utf8');
        } catch (error) {
            console.error('❌ Failed to save search history:', error);
        }
    }

    /**
     * Log to daily file for better organization
     */
    async logToDailyFile(searchEntry) {
        const dateString = searchEntry.timestamp.split('T')[0]; // YYYY-MM-DD
        const dailyFile = path.join(this.dailyLogDir, `searches-${dateString}.json`);

        try {
            // Load existing daily data
            let dailyData = [];
            try {
                const data = await fs.readFile(dailyFile, 'utf8');
                dailyData = JSON.parse(data);
            } catch (error) {
                // File doesn't exist - start fresh
                dailyData = [];
            }

            // Add new entry
            dailyData.push(searchEntry);

            // Save daily file
            await fs.writeFile(dailyFile, JSON.stringify(dailyData, null, 2), 'utf8');
        } catch (error) {
            console.error('❌ Failed to save daily search log:', error);
        }
    }

    /**
     * Generate unique search ID
     */
    generateSearchId() {
        return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Extract domain from URL
     */
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Check if URL is LinkedIn
     */
    isLinkedInUrl(url) {
        return url && url.toLowerCase().includes('linkedin.com');
    }

    /**
     * Get recent searches with filtering
     */
    getRecentSearches(options = {}) {
        const {
            limit = 50,
            status = null,
            domain = null,
            isLinkedIn = null,
            fromDate = null,
            toDate = null
        } = options;

        let filtered = [...this.searchHistory];

        // Apply filters
        if (status) {
            filtered = filtered.filter(search => search.status === status);
        }

        if (domain) {
            filtered = filtered.filter(search => search.domain.includes(domain));
        }

        if (isLinkedIn !== null) {
            filtered = filtered.filter(search => search.extraction.isLinkedIn === isLinkedIn);
        }

        if (fromDate) {
            filtered = filtered.filter(search => search.timestamp >= fromDate);
        }

        if (toDate) {
            filtered = filtered.filter(search => search.timestamp <= toDate);
        }

        // Sort by timestamp (most recent first) and limit
        return filtered
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    /**
     * Get search analytics and statistics
     */
    getSearchAnalytics() {
        if (this.searchHistory.length === 0) {
            return {
                totalSearches: 0,
                successRate: 0,
                avgDuration: 0,
                topDomains: [],
                statusBreakdown: {},
                linkedInStats: { total: 0, successful: 0 }
            };
        }

        const total = this.searchHistory.length;
        const successful = this.searchHistory.filter(s => s.status === 'success').length;
        const successRate = (successful / total * 100).toFixed(1);

        // Calculate average duration
        const durations = this.searchHistory
            .filter(s => s.performance.duration)
            .map(s => s.performance.duration);
        const avgDuration = durations.length > 0 
            ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
            : 0;

        // Top domains
        const domainCounts = {};
        this.searchHistory.forEach(search => {
            const domain = search.domain;
            domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        });

        const topDomains = Object.entries(domainCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([domain, count]) => ({ domain, count }));

        // Status breakdown
        const statusBreakdown = {};
        this.searchHistory.forEach(search => {
            const status = search.status;
            statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
        });

        // LinkedIn specific stats
        const linkedInSearches = this.searchHistory.filter(s => s.extraction.isLinkedIn);
        const linkedInSuccessful = linkedInSearches.filter(s => s.status === 'success');

        return {
            totalSearches: total,
            successRate: parseFloat(successRate),
            avgDuration: avgDuration,
            topDomains,
            statusBreakdown,
            linkedInStats: {
                total: linkedInSearches.length,
                successful: linkedInSuccessful.length,
                successRate: linkedInSearches.length > 0 
                    ? (linkedInSuccessful.length / linkedInSearches.length * 100).toFixed(1)
                    : 0
            },
            cacheHitRate: this.calculateCacheHitRate(),
            recentActivity: this.getRecentActivity()
        };
    }

    /**
     * Calculate cache hit rate
     */
    calculateCacheHitRate() {
        const cached = this.searchHistory.filter(s => s.performance.cacheHit).length;
        const total = this.searchHistory.length;
        return total > 0 ? ((cached / total) * 100).toFixed(1) : 0;
    }

    /**
     * Get recent activity summary
     */
    getRecentActivity() {
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const recentSearches = this.searchHistory.filter(s => s.timestamp >= last24Hours);
        
        return {
            last24Hours: recentSearches.length,
            lastHour: recentSearches.filter(s => 
                s.timestamp >= new Date(Date.now() - 60 * 60 * 1000).toISOString()
            ).length,
            avgPerHour: recentSearches.length > 0 ? (recentSearches.length / 24).toFixed(1) : 0
        };
    }

    /**
     * Search in history by various criteria
     */
    searchHistory(query, options = {}) {
        const {
            searchField = 'all', // 'url', 'domain', 'companyName', 'all'
            limit = 100,
            caseSensitive = false
        } = options;

        const searchQuery = caseSensitive ? query : query.toLowerCase();
        
        return this.searchHistory.filter(entry => {
            const getValue = (field) => {
                switch (field) {
                    case 'url':
                        return entry.url || '';
                    case 'domain':
                        return entry.domain || '';
                    case 'companyName':
                        return entry.extraction.companyName || '';
                    case 'all':
                        return [
                            entry.url,
                            entry.domain,
                            entry.extraction.companyName,
                            entry.extraction.industry
                        ].filter(Boolean).join(' ');
                    default:
                        return '';
                }
            };

            const value = caseSensitive ? getValue(searchField) : getValue(searchField).toLowerCase();
            return value.includes(searchQuery);
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    }

    /**
     * Export search history to file
     */
    async exportSearchHistory(format = 'json', filename = null) {
        if (!filename) {
            filename = `search-history-export-${Date.now()}.${format}`;
        }

        const exportFile = path.join(this.historyDir, filename);
        const exportData = {
            exportTimestamp: new Date().toISOString(),
            analytics: this.getSearchAnalytics(),
            totalRecords: this.searchHistory.length,
            searches: this.searchHistory
        };

        try {
            if (format === 'json') {
                await fs.writeFile(exportFile, JSON.stringify(exportData, null, 2), 'utf8');
            } else if (format === 'csv') {
                const csv = this.convertToCSV(exportData.searches);
                await fs.writeFile(exportFile, csv, 'utf8');
            }
            
            return exportFile;
        } catch (error) {
            throw new Error(`Failed to export search history: ${error.message}`);
        }
    }

    /**
     * Convert search data to CSV format
     */
    convertToCSV(searches) {
        if (searches.length === 0) return '';

        const headers = [
            'Timestamp', 'URL', 'Domain', 'Status', 'Duration (ms)', 'Company Name',
            'Industry', 'Has Logo', 'Has Banner', 'Is LinkedIn', 'Cache Hit',
            'Browser Used', 'Retry Count', 'Error Message'
        ];

        const rows = searches.map(search => [
            search.timestamp,
            search.url,
            search.domain,
            search.status,
            search.performance.duration || '',
            search.extraction.companyName || '',
            search.extraction.industry || '',
            search.extraction.hasLogo,
            search.extraction.hasBanner,
            search.extraction.isLinkedIn,
            search.performance.cacheHit,
            search.technical.browserUsed || '',
            search.technical.retryCount,
            search.errorMessage || ''
        ]);

        return [headers, ...rows]
            .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
            .join('\n');
    }

    /**
     * Get search by ID
     */
    getSearchById(searchId) {
        return this.searchHistory.find(search => search.searchId === searchId);
    }

    /**
     * Clear old data (cleanup)
     */
    async clearOldData(daysToKeep = 90) {
        const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();
        
        try {
            // Load full history
            const data = await fs.readFile(this.historyFile, 'utf8');
            const historyData = JSON.parse(data);
            const allSearches = historyData.searches || [];

            // Filter out old entries
            const recentSearches = allSearches.filter(search => search.timestamp >= cutoffDate);
            const removedCount = allSearches.length - recentSearches.length;

            // Save updated history
            const updatedHistoryData = {
                lastUpdated: new Date().toISOString(),
                totalSearches: recentSearches.length,
                searches: recentSearches
            };

            await fs.writeFile(this.historyFile, JSON.stringify(updatedHistoryData, null, 2), 'utf8');

            console.log(`🧹 Cleaned up ${removedCount} old search entries (keeping ${daysToKeep} days)`);
            return removedCount;
        } catch (error) {
            console.error('❌ Failed to clean up old search data:', error);
            return 0;
        }
    }
}

// Create singleton instance
const searchHistoryLogger = new SearchHistoryLogger();

module.exports = { searchHistoryLogger, SearchHistoryLogger };