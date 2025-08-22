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
        const connections = data.activeConnections || 0;
        document.getElementById('active-connections').textContent = connections;
    } catch (error) {
        console.error('Error fetching active connections:', error);
        document.getElementById('active-connections').textContent = 'Error';
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
                    <input type="number" id="limitFilter" placeholder="Limit" value="200" min="10" max="1000">
                    <button id="refresh-logs-button">Refresh</button>
                    <button id="load-older-logs-button">Load Older</button>
                </div>
                <div id="logs-container">Loading...</div>
            </div>
        </div>
    `;

    const logsContainer = document.getElementById('logs-container');
    const sessionFilter = document.getElementById('sessionFilter');
    const levelFilter = document.getElementById('levelFilter');
    const limitFilter = document.getElementById('limitFilter');
    const refreshButton = document.getElementById('refresh-logs-button');
    const loadOlderButton = document.getElementById('load-older-logs-button');

    let logsData = [];
    let currentOffset = 0;

    async function fetchLogs(append = false) {
        try {
            if (!append) {
                logsContainer.textContent = 'Loading...';
                currentOffset = 0;
            }
            
            const limit = parseInt(limitFilter.value) || 200;
            const level = levelFilter.value;
            const sessionId = sessionFilter.value;
            
            let url = `/api/extraction-logs?format=json&limit=${limit}&offset=${currentOffset}`;
            if (level) url += `&level=${level}`;
            if (sessionId) url += `&sessionId=${sessionId}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (append) {
                logsData = [...logsData, ...data.logs];
                currentOffset += data.logs.length;
            } else {
                logsData = data.logs;
                currentOffset = data.logs.length;
            }
            
            renderFilteredLogs();
            
            // Hide load older button if no more logs
            loadOlderButton.style.display = data.logs.length < limit ? 'none' : 'inline-block';
        } catch (error) {
            console.error('Error fetching logs:', error);
            logsContainer.textContent = 'Error fetching logs.';
        }
    }

    function renderFilteredLogs() {
        const level = levelFilter.value;
        const sessionId = sessionFilter.value.toLowerCase();

        let filteredLogs = logsData;
        if (level || sessionId) {
            filteredLogs = logsData.filter(log => {
                const showByLevel = !level || log.level === level;
                const showBySession = !sessionId || (log.sessionId && log.sessionId.toLowerCase().includes(sessionId));
                return showByLevel && showBySession;
            });
        }

        if (filteredLogs.length === 0) {
            logsContainer.innerHTML = '<p>No logs found matching the current filters.</p>';
            return;
        }

        logsContainer.innerHTML = filteredLogs.map(log => `
            <div class="log-entry log-${log.level}" data-level="${log.level}" data-session="${log.sessionId || ''}">
                <div><strong>${log.level.toUpperCase()}</strong> - <span class="timestamp">${new Date(log.timestamp).toLocaleString()}</span></div>
                ${log.sessionId ? `<div><small>Session: <a href="#" onclick="openSessionLogs('${log.sessionId}')">${log.sessionId}</a></small></div>` : ''}
                <div>${log.message}</div>
                ${log.data ? `<details><summary>Data</summary><pre class="log-data">${JSON.stringify(log.data, null, 2)}</pre></details>` : ''}
            </div>
        `).join('');
    }

    sessionFilter.addEventListener('input', () => {
        currentOffset = 0;
        fetchLogs();
    });
    levelFilter.addEventListener('change', () => {
        currentOffset = 0;
        fetchLogs();
    });
    refreshButton.addEventListener('click', () => fetchLogs());
    loadOlderButton.addEventListener('click', () => fetchLogs(true));

    fetchLogs();
}

// Function to open session logs in new tab
function openSessionLogs(sessionId) {
    const url = `/api/extraction-logs/${sessionId}?format=html`;
    window.open(url, '_blank');
}

// New Sessions page
async function renderSessions() {
    const appRoot = document.getElementById('app-root');
    appRoot.innerHTML = `
        <div class="page active" id="sessions-page">
            <div class="card">
                <h2>Active Sessions</h2>
                <button id="refresh-sessions-button">Refresh</button>
                <div id="sessions-container">Loading...</div>
            </div>
        </div>
    `;

    const sessionsContainer = document.getElementById('sessions-container');
    const refreshButton = document.getElementById('refresh-sessions-button');

    async function fetchSessions() {
        try {
            sessionsContainer.textContent = 'Loading...';
            const response = await fetch('/api/extraction-sessions');
            const data = await response.json();
            
            if (!data.sessions || data.sessions.length === 0) {
                sessionsContainer.innerHTML = '<p>No active sessions found.</p>';
                return;
            }

            sessionsContainer.innerHTML = `
                <div class="grid">
                    ${data.sessions.map(session => `
                        <div class="card">
                            <h3>Session: ${session.sessionId}</h3>
                            <p><strong>URL:</strong> ${session.url}</p>
                            <p><strong>Status:</strong> ${session.status}</p>
                            <p><strong>Started:</strong> ${new Date(session.startTime).toLocaleString()}</p>
                            <p><strong>Duration:</strong> ${session.duration || 'In progress'}</p>
                            <p><strong>Steps:</strong> ${session.steps || 0}</p>
                            <button onclick="openSessionLogs('${session.sessionId}')">View Logs</button>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            console.error('Error fetching sessions:', error);
            sessionsContainer.textContent = 'Error fetching sessions.';
        }
    }

    refreshButton.addEventListener('click', fetchSessions);
    fetchSessions();
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
                        <tr><th>NODE_ENV</th><td>${latest.environment?.nodeEnv || 'development'}</td></tr>
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


// API Endpoints testing page
async function renderEndpoints() {
    const appRoot = document.getElementById('app-root');
    appRoot.innerHTML = `
        <div class="page active" id="endpoints-page">
            <div class="card">
                <h2>🚀 API Endpoints Tester</h2>
                <p>Test and explore all available API endpoints</p>
            </div>
            <div class="endpoints-grid">
                <div class="card endpoint-card">
                    <h3>📊 System Health</h3>
                    <p>Check system status and performance</p>
                    <button onclick="testEndpoint('/health', 'GET')">GET /health</button>
                    <button onclick="testEndpoint('/learning-system-status', 'GET')">GET /learning-system-status</button>
                    <button onclick="testEndpoint('/force-maintenance', 'POST')">POST /force-maintenance</button>
                </div>
                <div class="card endpoint-card">
                    <h3>🔍 Extraction</h3>
                    <p>Company data extraction endpoints</p>
                    <input type="text" id="extract-url" placeholder="https://example.com" style="width: 100%; margin: 5px 0;">
                    <button onclick="testExtraction()">POST /api/extract-company-details</button>
                </div>
                <div class="card endpoint-card">
                    <h3>📝 Logs & Sessions</h3>
                    <p>View extraction logs and sessions</p>
                    <button onclick="testEndpoint('/api/extraction-logs?limit=10', 'GET')">GET /api/extraction-logs</button>
                    <button onclick="testEndpoint('/api/extraction-sessions', 'GET')">GET /api/extraction-sessions</button>
                    <button onclick="testEndpoint('/api/logs/extraction', 'GET')">GET /api/logs/extraction</button>
                </div>
                <div class="card endpoint-card">
                    <h3>📈 Analytics</h3>
                    <p>Performance and search analytics</p>
                    <button onclick="testEndpoint('/api/search-history?limit=5', 'GET')">GET /api/search-history</button>
                    <button onclick="testEndpoint('/api/search-analytics', 'GET')">GET /api/search-analytics</button>
                    <button onclick="testEndpoint('/performance-metrics', 'GET')">GET /performance-metrics</button>
                </div>
                <div class="card endpoint-card">
                    <h3>🤖 Anti-Bot & LinkedIn</h3>
                    <p>Anti-bot system and LinkedIn metrics</p>
                    <button onclick="testEndpoint('/anti-bot-status', 'GET')">GET /anti-bot-status</button>
                    <button onclick="testEndpoint('/linkedin-metrics', 'GET')">GET /linkedin-metrics</button>
                    <button onclick="testEndpoint('/facebook-anti-bot-status', 'GET')">GET /facebook-anti-bot-status</button>
                </div>
                <div class="card endpoint-card">
                    <h3>🔧 Utilities</h3>
                    <p>System utilities and testing</p>
                    <button onclick="testEndpoint('/test', 'GET')">GET /test</button>
                    <button onclick="testEndpoint('/test-browser', 'GET')">GET /test-browser</button>
                    <button onclick="testEndpoint('/api/active-connections', 'GET')">GET /api/active-connections</button>
                </div>
            </div>
            <div class="card" id="endpoint-results">
                <h3>📋 Results</h3>
                <div id="results-content">Click any endpoint button above to test it</div>
            </div>
        </div>
    `;
}

function testEndpoint(url, method = 'GET', body = null) {
    const resultsContent = document.getElementById('results-content');
    resultsContent.innerHTML = `<div class="loading">Testing ${method} ${url}...</div>`;
    
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    fetch(url, options)
        .then(response => {
            const status = response.status;
            const statusClass = status >= 200 && status < 300 ? 'success' : 'error';
            return response.json().then(data => ({ status, data, statusClass }));
        })
        .then(({ status, data, statusClass }) => {
            resultsContent.innerHTML = `
                <div class="endpoint-result ${statusClass}">
                    <div class="result-header">
                        <strong>${method} ${url}</strong>
                        <span class="status-badge status-${status}">${status}</span>
                    </div>
                    <pre class="result-body">${JSON.stringify(data, null, 2)}</pre>
                </div>
            `;
        })
        .catch(error => {
            resultsContent.innerHTML = `
                <div class="endpoint-result error">
                    <div class="result-header">
                        <strong>${method} ${url}</strong>
                        <span class="status-badge status-error">ERROR</span>
                    </div>
                    <pre class="result-body">${error.message}</pre>
                </div>
            `;
        });
}

function testExtraction() {
    const url = document.getElementById('extract-url').value;
    if (!url) {
        alert('Please enter a URL to extract');
        return;
    }
    testEndpoint('/api/extract-company-details', 'POST', { url });
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    router.addRoute('dashboard', renderDashboard);
    router.addRoute('logs', renderLogs);
    router.addRoute('sessions', renderSessions);
    router.addRoute('history', renderHistory);
    router.addRoute('health', renderHealth);
    router.addRoute('endpoints', renderEndpoints);
    router.init();

    updateActiveConnections();
    setInterval(updateActiveConnections, 90000); // Update every 90 seconds
});
