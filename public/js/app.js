// Simple client-side router
const router = {
    routes: {},
    init() {
        window.addEventListener('hashchange', () => this.loadRoute());
        this.loadRoute();
    },
    addRoute(name, handler) {
        this.routes[name] = handler;
    },
    loadRoute() {
        const hash = window.location.hash.slice(1) || 'dashboard';

        // Update active nav link
        document.querySelectorAll('nav a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${hash}`) {
                link.classList.add('active');
            }
        });

        const handler = this.routes[hash];
        if (handler) {
            handler();
        } else {
            document.getElementById('app-root').innerHTML = '<h1>404 - Page not found</h1>';
        }
    }
};

// Fetch and display active connections
async function updateActiveConnections() {
    try {
        const response = await fetch('/api/active-connections');
        const data = await response.json();
        document.getElementById('active-connections').textContent = data.activeConnections;
    } catch (error) {
        console.error('Error fetching active connections:', error);
        document.getElementById('active-connections').textContent = 'N/A';
    }
}

// Pages
function renderDashboard() {
    document.getElementById('app-root').innerHTML = `
        <div class="page active" id="dashboard-page">
            <div class="card">
                <h2>Dashboard</h2>
                <p>Enter a URL to scrape:</p>
                <input type="text" id="url-input" placeholder="https://example.com">
                <button id="scrape-button">Scrape</button>
            </div>
            <div class="card" id="results-container">
                <h3>Results</h3>
                <pre id="results"></pre>
            </div>
        </div>
    `;

    document.getElementById('scrape-button').addEventListener('click', async () => {
        const url = document.getElementById('url-input').value;
        const resultsContainer = document.getElementById('results');
        if (!url) {
            resultsContainer.textContent = 'Please enter a URL.';
            return;
        }

        resultsContainer.textContent = 'Scraping...';
        try {
            const response = await fetch('/api/extract-company-details', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url })
            });
            const data = await response.json();
            resultsContainer.textContent = JSON.stringify(data, null, 2);
        } catch (error) {
            console.error('Error scraping URL:', error);
            resultsContainer.textContent = 'An error occurred while scraping.';
        }
    });
}

async function renderLogs() {
    const appRoot = document.getElementById('app-root');
    appRoot.innerHTML = `
        <div class="page active" id="logs-page">
            <div class="card">
                <h2>Extraction Logs</h2>
                <div id="logs-controls">
                    <input type="text" id="sessionFilter" placeholder="Filter by Session ID...">
                    <select id="levelFilter">
                        <option value="">All Levels</option>
                        <option value="error">Error</option>
                        <option value="warn">Warning</option>
                        <option value="info">Info</option>
                        <option value="step">Step</option>
                        <option value="debug">Debug</option>
                    </select>
                    <button id="refresh-logs-button">Refresh</button>
                </div>
                <div id="logs-container">Loading...</div>
            </div>
        </div>
    `;

    const logsContainer = document.getElementById('logs-container');
    const sessionFilter = document.getElementById('sessionFilter');
    const levelFilter = document.getElementById('levelFilter');
    const refreshButton = document.getElementById('refresh-logs-button');

    let logsData = [];

    async function fetchLogs() {
        try {
            logsContainer.textContent = 'Loading...';
            const response = await fetch('/api/extraction-logs?format=json&limit=200');
            const data = await response.json();
            logsData = data.logs;
            renderFilteredLogs();
        } catch (error) {
            console.error('Error fetching logs:', error);
            logsContainer.textContent = 'Error fetching logs.';
        }
    }

    function renderFilteredLogs() {
        const level = levelFilter.value;
        const sessionId = sessionFilter.value.toLowerCase();

        const filteredLogs = logsData.filter(log => {
            const showByLevel = !level || log.level === level;
            const showBySession = !sessionId || (log.sessionId && log.sessionId.toLowerCase().includes(sessionId));
            return showByLevel && showBySession;
        });

        if (filteredLogs.length === 0) {
            logsContainer.innerHTML = '<p>No logs found.</p>';
            return;
        }

        logsContainer.innerHTML = filteredLogs.map(log => `
            <div class="log-entry log-${log.level}" data-level="${log.level}" data-session="${log.sessionId || ''}">
                <div><strong>${log.level.toUpperCase()}</strong> - <span class="timestamp">${new Date(log.timestamp).toLocaleString()}</span></div>
                ${log.sessionId ? `<div><small>Session: ${log.sessionId}</small></div>` : ''}
                <div>${log.message}</div>
                ${log.data ? `<details><summary>Data</summary><pre class="log-data">${JSON.stringify(log.data, null, 2)}</pre></details>` : ''}
            </div>
        `).join('');
    }

    sessionFilter.addEventListener('keyup', renderFilteredLogs);
    levelFilter.addEventListener('change', renderFilteredLogs);
    refreshButton.addEventListener('click', fetchLogs);

    fetchLogs();
}

async function renderHistory() {
    const appRoot = document.getElementById('app-root');
    appRoot.innerHTML = `
        <div class="page active" id="history-page">
            <div class="card">
                <h2>Search History & Analytics</h2>
                <div class="grid" id="history-analytics">Loading analytics...</div>
            </div>
            <div class="card">
                <h3>Search History</h3>
                <div id="history-table-container">Loading history...</div>
            </div>
        </div>
    `;

    try {
        const response = await fetch('/api/search-history?format=json&limit=100');
        const data = await response.json();
        const { analytics, searches } = data;

        // Render analytics
        document.getElementById('history-analytics').innerHTML = `
            <div class="card">
                <h3>Success Rate</h3>
                <canvas id="successRateChart"></canvas>
            </div>
            <div class="card">
                <h3>Cache Performance</h3>
                <canvas id="cacheHitChart"></canvas>
            </div>
            <div class="card">
                <h3>LinkedIn vs. Other</h3>
                <canvas id="linkedinChart"></canvas>
            </div>
        `;

        new Chart(document.getElementById('successRateChart'), {
            type: 'doughnut',
            data: {
                labels: ['Success', 'Failed'],
                datasets: [{
                    data: [analytics.successRate, 100 - analytics.successRate],
                    backgroundColor: ['#27ae60', '#e74c3c']
                }]
            }
        });

        new Chart(document.getElementById('cacheHitChart'), {
            type: 'doughnut',
            data: {
                labels: ['Cache Hit', 'Cache Miss'],
                datasets: [{
                    data: [analytics.cacheHitRate, 100 - analytics.cacheHitRate],
                    backgroundColor: ['#3498db', '#95a5a6']
                }]
            }
        });

        new Chart(document.getElementById('linkedinChart'), {
            type: 'bar',
            data: {
                labels: ['LinkedIn', 'Other Websites'],
                datasets: [{
                    label: 'Number of Searches',
                    data: [analytics.linkedInStats.total, analytics.totalSearches - analytics.linkedInStats.total],
                    backgroundColor: ['#0077b5', '#f39c12']
                }]
            }
        });

        // Render history table
        const historyTableContainer = document.getElementById('history-table-container');
        if (searches.length === 0) {
            historyTableContainer.innerHTML = '<p>No search history found.</p>';
            return;
        }

        historyTableContainer.innerHTML = `
            <table id="historyTable">
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Domain</th>
                        <th>Status</th>
                        <th>Duration (ms)</th>
                        <th>Type</th>
                    </tr>
                </thead>
                <tbody>
                    ${searches.map(search => `
                        <tr>
                            <td>${new Date(search.timestamp).toLocaleString()}</td>
                            <td>${search.domain}</td>
                            <td>${search.status}</td>
                            <td>${search.performance.duration || 'N/A'}</td>
                            <td>${search.extraction.isLinkedIn ? 'LinkedIn' : 'Website'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error fetching search history:', error);
        document.getElementById('app-root').innerHTML = '<h2>Error loading search history.</h2>';
    }
}

async function renderHealth() {
    const appRoot = document.getElementById('app-root');
    appRoot.innerHTML = `
        <div class="page active" id="health-page">
            <div class="card">
                <div id="header" class="header">
                    <h1>🏥 System Health Dashboard</h1>
                    <p>Status: <strong id="statusText">...</strong> | Last Update: <span id="lastUpdate">...</span></p>
                </div>
            </div>
            <div class="grid">
                <div class="card">
                    <h3>💾 Process Memory (MB)</h3>
                    <canvas id="processMemChart"></canvas>
                </div>
                <div class="card">
                    <h3>🖥️ System Memory (GB)</h3>
                    <canvas id="systemMemChart"></canvas>
                </div>
                <div class="card">
                    <h3>⚡ CPU Usage (%)</h3>
                    <canvas id="cpuChart"></canvas>
                </div>
            </div>
            <div id="health-table-container">
                <!-- Details will be rendered here -->
            </div>
        </div>
    `;

    let healthInterval;
    let charts = {};

    function formatTime(ts) {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function updateHealthData(data) {
        if (!data || !data.health || !data.history) {
            console.error("Invalid data structure for update.");
            return;
        }

        const { health, history } = data;
        const initialHistory = history.slice(-50);
        const latest = initialHistory.length > 0 ? initialHistory[initialHistory.length - 1] : {};

        // Update header using the 'health' object
        document.getElementById('statusText').textContent = health.status?.toUpperCase() ?? 'UNKNOWN';
        const lastUpdateTimestamp = health.timestamp ? new Date(health.timestamp).toLocaleString() : 'N/A';
        document.getElementById('lastUpdate').textContent = lastUpdateTimestamp;
        const header = document.getElementById('header');
        header.className = 'header status-' + (health.status || 'unknown');

        // Update charts
        const labels = initialHistory.map(h => formatTime(h.timestamp));
        charts.processMem.data.labels = labels;
        charts.processMem.data.datasets[0].data = initialHistory.map(h => h.memory.used);
        charts.processMem.update('none');

        charts.systemMem.data.labels = labels;
        charts.systemMem.data.datasets[0].data = initialHistory.map(h => (h.system.totalMemory - h.system.freeMemory).toFixed(2));
        charts.systemMem.update('none');

        charts.cpu.data.labels = labels;
        charts.cpu.data.datasets[0].data = initialHistory.map(h => h.system.cpuPercent);
        charts.cpu.update('none');

        // Update tables
        document.getElementById('health-table-container').innerHTML = `
            <div class="grid details-grid">
                <div class="card">
                    <h3>⚙️ Process Info</h3>
                    <table id="processInfoTable">
                        <tr><th>PID</th><td>${latest.process?.pid ?? 'N/A'}</td></tr>
                        <tr><th>Uptime</th><td>${latest.process?.uptimeFormatted ?? 'N/A'}</td></tr>
                        <tr><th>Node.js</th><td>${latest.process?.version ?? 'N/A'}</td></tr>
                        <tr><th>Platform</th><td>${latest.process?.platform ?? 'N/A'}</td></tr>
                        <tr><th>Architecture</th><td>${latest.process?.arch ?? 'N/A'}</td></tr>
                        <tr><th>Active Handles</th><td>${latest.process?.activeHandles ?? 'N/A'}</td></tr>
                    </table>
                </div>
                <div class="card">
                    <h3>🌍 Environment</h3>
                    <table id="environmentInfoTable">
                        <tr><th>NODE_ENV</th><td>${latest.environment?.nodeEnv ?? 'N/A'}</td></tr>
                        <tr><th>Port</th><td>${latest.environment?.port ?? 'N/A'}</td></tr>
                        <tr><th>Puppeteer Cache</th><td>${latest.environment?.puppeteerCacheDir || 'Default'}</td></tr>
                    </table>
                </div>
                <div class="card">
                    <h3>💽 Disk Usage</h3>
                    <table id="diskUsageTable">
                        <thead><tr><th>Mount</th><th>Total</th><th>Used</th><th>Free</th><th>Usage %</th></tr></thead>
                        <tbody>
                        ${latest.disk && latest.disk.length > 0 ? latest.disk.map(d => `
                            <tr>
                                <td>${d.mount || d.drive}</td>
                                <td>${d.total} GB</td>
                                <td>${d.used} GB</td>
                                <td>${d.available || d.free} GB</td>
                                <td>${d.usagePercent}%</td>
                            </tr>
                        `).join('') : '<tr><td colspan="5">No disk data</td></tr>'}
                        </tbody>
                    </table>
                </div>
                <div class="card">
                    <h3>📡 Network Info</h3>
                    <table id="networkInfoTable">
                        <thead><tr><th>Interface</th><th>IP</th><th>MAC</th><th>Family</th></tr></thead>
                        <tbody>
                        ${latest.network ? Object.entries(latest.network).map(([name, interfaces]) =>
                            interfaces.map(iface => `
                            <tr>
                                <td>${name}</td>
                                <td>${iface.address}</td>
                                <td>${iface.mac}</td>
                                <td>${iface.family}</td>
                            </tr>
                            `).join('')
                        ).join('') : '<tr><td colspan="4">No network data</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async function fetchInitialData() {
        try {
            const response = await fetch('/api/system-health?format=json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            if (!data || !data.health || !data.history) {
                throw new Error("Invalid data structure received from API.");
            }

            const initialHistory = data.history.slice(-50);

            charts.processMem = new Chart(document.getElementById('processMemChart'), {
                type: 'line',
                data: {
                    labels: initialHistory.map(h => formatTime(h.timestamp)),
                    datasets: [{ label: 'Process MB', data: initialHistory.map(h => h.memory.used), borderColor: '#3498db', fill: false, tension: 0.1 }]
                }
            });

            charts.systemMem = new Chart(document.getElementById('systemMemChart'), {
                type: 'line',
                data: {
                    labels: initialHistory.map(h => formatTime(h.timestamp)),
                    datasets: [{ label: 'System Used GB', data: initialHistory.map(h => (h.system.totalMemory - h.system.freeMemory).toFixed(2)), borderColor: '#e67e22', fill: false, tension: 0.1 }]
                }
            });

            charts.cpu = new Chart(document.getElementById('cpuChart'), {
                type: 'line',
                data: {
                    labels: initialHistory.map(h => formatTime(h.timestamp)),
                    datasets: [{ label: 'CPU %', data: initialHistory.map(h => h.system.cpuPercent), borderColor: '#2ecc71', fill: false, tension: 0.1 }]
                }
            });

            updateHealthData(data);

            healthInterval = setInterval(async () => {
                const response = await fetch('/api/system-health?format=json');
                const data = await response.json();
                updateHealthData(data);
            }, 15000);

        } catch (error) {
            console.error('Error fetching or rendering system health:', error);
            appRoot.innerHTML = `<h2>Error loading system health.</h2><p>${error.message}</p>`;
        }
    }

    // Clear previous interval if it exists
    if (window.healthInterval) {
        clearInterval(window.healthInterval);
    }
    fetchInitialData();
    window.healthInterval = healthInterval;
}


// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    router.addRoute('dashboard', renderDashboard);
    router.addRoute('logs', renderLogs);
    router.addRoute('history', renderHistory);
    router.addRoute('health', renderHealth);
    router.init();

    updateActiveConnections();
    setInterval(updateActiveConnections, 5000); // Update every 5 seconds
});
