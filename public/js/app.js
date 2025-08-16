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

function renderLogs() {
    document.getElementById('app-root').innerHTML = `
        <div class="page active" id="logs-page">
            <div class="card">
                <h2>Extraction Logs</h2>
                <iframe src="/api/extraction-logs?format=html" style="width: 100%; height: 80vh; border: none;"></iframe>
            </div>
        </div>
    `;
}

function renderHistory() {
    document.getElementById('app-root').innerHTML = `
        <div class="page active" id="history-page">
            <div class="card">
                <h2>Search History</h2>
                <iframe src="/api/search-history?format=html" style="width: 100%; height: 80vh; border: none;"></iframe>
            </div>
        </div>
    `;
}

function renderHealth() {
    document.getElementById('app-root').innerHTML = `
        <div class="page active" id="health-page">
            <div class="card">
                <h2>System Health</h2>
                <iframe src="/api/system-health?format=html" style="width: 100%; height: 80vh; border: none;"></iframe>
            </div>
        </div>
    `;
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
