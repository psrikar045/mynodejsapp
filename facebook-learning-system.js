/**
 * Facebook Self-Learning Anti-Bot System
 * Adapts strategies based on success/failure patterns
 */

const fs = require('fs').promises;
const path = require('path');

class FacebookLearningSystem {
    constructor() {
        // Use platform-safe path resolution
        this.dataFile = path.resolve(__dirname, 'facebook_learning_data.json');
        this.data = {
            userAgents: { success: {}, blocked: {} },
            selectors: { working: [], failed: [] },
            strategies: { effective: [], ineffective: [] },
            patterns: { blocks: [], successes: [] },
            lastUpdate: Date.now()
        };
        this.loadData();
    }

    async loadData() {
        try {
            const raw = await fs.readFile(this.dataFile, 'utf-8');
            this.data = { ...this.data, ...JSON.parse(raw) };
        } catch (error) {
            await this.saveData(); // Create initial file
        }
    }

    async saveData() {
        try {
            // Ensure directory exists on Linux
            const dir = path.dirname(this.dataFile);
            await fs.mkdir(dir, { recursive: true }).catch(() => {});
            
            await fs.writeFile(this.dataFile, JSON.stringify(this.data, null, 2), 'utf8');
        } catch (error) {
            console.warn('[Learning] Failed to save learning data:', error.message);
        }
    }

    // Record extraction attempt result
    async recordAttempt(result) {
        const { url, userAgent, success, error, selectors, strategy, responseTime } = result;
        
        // Update user agent effectiveness
        if (success) {
            this.data.userAgents.success[userAgent] = (this.data.userAgents.success[userAgent] || 0) + 1;
        } else {
            this.data.userAgents.blocked[userAgent] = (this.data.userAgents.blocked[userAgent] || 0) + 1;
        }

        // Update selector effectiveness
        if (selectors) {
            if (success) {
                selectors.forEach(sel => {
                    if (!this.data.selectors.working.includes(sel)) {
                        this.data.selectors.working.push(sel);
                    }
                });
            } else {
                selectors.forEach(sel => {
                    if (!this.data.selectors.failed.includes(sel)) {
                        this.data.selectors.failed.push(sel);
                    }
                });
            }
        }

        // Update strategy effectiveness
        if (strategy) {
            if (success) {
                this.data.strategies.effective.push({ strategy, timestamp: Date.now(), responseTime });
            } else {
                this.data.strategies.ineffective.push({ strategy, error, timestamp: Date.now() });
            }
        }

        // Record patterns
        const pattern = { url: this.getDomain(url), userAgent, timestamp: Date.now(), error };
        if (success) {
            this.data.patterns.successes.push(pattern);
        } else {
            this.data.patterns.blocks.push(pattern);
        }

        // Cleanup old data (keep last 1000 entries)
        this.cleanupData();
        
        this.data.lastUpdate = Date.now();
        await this.saveData();
    }

    // Get best user agent based on success rate
    getBestUserAgent() {
        const agents = Object.keys(this.data.userAgents.success);
        if (agents.length === 0) return null;

        return agents.reduce((best, agent) => {
            const successRate = this.getSuccessRate(agent);
            const bestRate = this.getSuccessRate(best);
            return successRate > bestRate ? agent : best;
        });
    }

    // Get success rate for user agent
    getSuccessRate(userAgent) {
        const success = this.data.userAgents.success[userAgent] || 0;
        const blocked = this.data.userAgents.blocked[userAgent] || 0;
        return blocked === 0 ? success : success / (success + blocked);
    }

    // Get working selectors prioritized by success
    getWorkingSelectors() {
        return this.data.selectors.working.filter(sel => 
            !this.data.selectors.failed.includes(sel)
        );
    }

    // Get effective strategies
    getEffectiveStrategies() {
        const recent = this.data.strategies.effective.filter(s => 
            Date.now() - s.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
        );
        return recent.sort((a, b) => (a.responseTime || 0) - (b.responseTime || 0));
    }

    // Check if domain is frequently blocked
    isDomainProblematic(url) {
        const domain = this.getDomain(url);
        const recentBlocks = this.data.patterns.blocks.filter(p => 
            p.url === domain && Date.now() - p.timestamp < 60 * 60 * 1000 // Last hour
        );
        return recentBlocks.length > 3;
    }

    // Get recommended delay based on recent blocks
    getRecommendedDelay(url) {
        const domain = this.getDomain(url);
        const recentBlocks = this.data.patterns.blocks.filter(p => 
            p.url === domain && Date.now() - p.timestamp < 30 * 60 * 1000 // Last 30 minutes
        );
        
        if (recentBlocks.length === 0) return 2000; // Default 2s
        if (recentBlocks.length < 3) return 5000;   // 5s if some blocks
        return 15000; // 15s if many blocks
    }

    // Get adaptive browser args based on learning
    getAdaptiveBrowserArgs() {
        const baseArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ];

        // Add args based on effective strategies
        const effectiveStrategies = this.getEffectiveStrategies();
        const additionalArgs = [];

        if (effectiveStrategies.some(s => s.strategy.includes('stealth'))) {
            additionalArgs.push('--disable-blink-features=AutomationControlled');
        }

        if (effectiveStrategies.some(s => s.strategy.includes('mobile'))) {
            additionalArgs.push('--user-agent=mobile');
        }

        return [...baseArgs, ...additionalArgs];
    }

    // Clean up old data to prevent memory issues
    cleanupData() {
        const maxEntries = 1000;
        
        if (this.data.patterns.successes.length > maxEntries) {
            this.data.patterns.successes = this.data.patterns.successes.slice(-maxEntries);
        }
        
        if (this.data.patterns.blocks.length > maxEntries) {
            this.data.patterns.blocks = this.data.patterns.blocks.slice(-maxEntries);
        }

        if (this.data.strategies.effective.length > maxEntries) {
            this.data.strategies.effective = this.data.strategies.effective.slice(-maxEntries);
        }

        if (this.data.strategies.ineffective.length > maxEntries) {
            this.data.strategies.ineffective = this.data.strategies.ineffective.slice(-maxEntries);
        }
    }

    // Extract domain from URL
    getDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }

    // Get analytics about learning system
    getAnalytics() {
        const totalAttempts = Object.values(this.data.userAgents.success).reduce((a, b) => a + b, 0) +
                             Object.values(this.data.userAgents.blocked).reduce((a, b) => a + b, 0);
        
        const successfulAttempts = Object.values(this.data.userAgents.success).reduce((a, b) => a + b, 0);
        const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts * 100).toFixed(1) : 0;

        return {
            totalAttempts,
            successRate: `${successRate}%`,
            workingSelectors: this.data.selectors.working.length,
            failedSelectors: this.data.selectors.failed.length,
            effectiveStrategies: this.data.strategies.effective.length,
            lastUpdate: new Date(this.data.lastUpdate).toISOString()
        };
    }
}

module.exports = { FacebookLearningSystem };