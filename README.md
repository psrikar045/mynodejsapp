# SumNode - Company Details Extraction API

A Node.js API service that extracts company details from websites using Puppeteer and web scraping, now with enterprise-level monitoring and logging capabilities.

## 🚀 Features

- Extract company details from any website URL
- LinkedIn company page scraping
- Automatic browser detection (Edge/Chrome)
- Production-ready for Render deployment
- CORS enabled for cross-origin requests
- Comprehensive logging and monitoring system
- Real-time web dashboards for monitoring
- Long-term search history with analytics
- System health monitoring with alerts
- Detailed file logging by category

## 📋 API Endpoints

With new changes we have added few endpoints:

### Core Extraction Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/extract-company-details` | Main extraction endpoint |
| GET | `/test` | Simple health check endpoint |
| GET | `/test-browser` | Browser compatibility test |
| GET | `/health` | System health check |
| GET | `/linkedin-metrics` | LinkedIn extraction metrics |
| GET | `/performance-metrics` | Performance analytics |
| GET | `/anti-bot-status` | Anti-bot system status |

### Monitoring & Logging Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/extraction-sessions` | Active extraction sessions |
| GET | `/api/extraction-logs` | Real-time extraction logs |
| GET | `/api/system-health` | System health dashboard |
| GET | `/api/search-history` | Search history & analytics |
| GET | `/api/logs/:type` | Detailed file logs |
| GET | `/api/logs-status` | Log files status |
| GET | `/api/search-analytics` | Detailed analytics data |
| GET | `/api/logs/search/:query` | Search across all logs |
| POST | `/api/extraction-logs/clear` | Clear all logs (emergency) |

### Detailed Endpoint Examples

#### Extraction Logs

- `http://202.65.155.117:3000/api/extraction-logs?format=html` - Web interface
- `http://202.65.155.117:3000/api/extraction-logs?limit=50` - Limit results
- `http://202.65.155.117:3000/api/extraction-logs?level=error` - Filter by level
- `http://202.65.155.117:3000/api/extraction-logs?sessionId=session_1234567890_abc123` - Filter by session
- `http://202.65.155.117:3000/api/extraction-logs?level=error&limit=10` - Combined filters
- `http://202.65.155.117:3000/api/extraction-logs/SESSION_ID_HERE` - Session-specific logs
- `http://202.65.155.117:3000/api/extraction-sessions` - All active sessions
- `http://202.65.155.117:3000/api/extraction-logs/clear` - Clear logs (POST)

#### System & Analytics Dashboards

- `http://202.65.155.117:3000/api/system-health?format=html` - System health dashboard
- `http://202.65.155.117:3000/api/search-history?format=html` - Search history dashboard
- `http://202.65.155.117:3000/api/search-history/export` - Export history data
- `http://202.65.155.117:3000/api/search-analytics` - Analytics API

#### Detailed Logs

- `http://202.65.155.117:3000/api/logs/:logType` - Specific log type
- `http://202.65.155.117:3000/api/logs-status` - Log files status
- `http://202.65.155.117:3000/api/logs/search/:query` - Search across logs

#### Log Search Query Examples

The query parameter for `/api/logs/search/:query` can be:
- `error` - Search for errors
- `linkedin.com` - Search for domain
- `session_id` - Search for session
- `timeout` - Search for timeouts
- `error?limit=100` - With result limit
- `error?logTypes=extraction,errors,browser` - Filter by log types
- `linkedin?limit=200&logTypes=extraction,linkedin` - Combined parameters

### Available Log Types

Based on your codebase, these are the log types you can filter by:

| Log Type | Description |
|----------|-------------|
| `extraction` | All extraction activities |
| `errors` | Error logs with stack traces |
| `performance` | Performance timing data |
| `system` | System health events |
| `api` | API request/response logs |
| `security` | Security-related events |
| `browser` | Browser launch/close events |
| `linkedin` | LinkedIn-specific activities |

## 📝 API Documentation

### POST /api/extract-company-details

Extracts company details from a given URL.

**Request Body:**
```json
{
  "url": "https://example.com"
}

```

**Response:**
```json
{
  "companyName": "Example Company",
  "description": "Company description...",
  "website": "https://example.com",
  // ... other extracted details
}
```

### GET /test

Simple health check endpoint.

### GET /test-browser

Browser detection test endpoint. Returns information about detected browsers and environment.

**Response:**
```json
{
  "success": true,
  "environment": "production",
  "isRender": true,
  "generalBrowser": "/path/to/chrome",
  "linkedinBrowser": "/path/to/chrome",
  "platform": "linux",
  "puppeteerCacheDir": "/opt/render/.cache/puppeteer"
}
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

The server will run on `http://localhost:3000`

## Deployment to Render

1. Connect your GitHub repository to Render
2. Use the following settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
   - **Node Version:** 18+ (specified in package.json)

3. Set environment variables:
   - `NODE_ENV=production`

The `render.yaml` file is included for automatic configuration.

## Environment Variables

- `NODE_ENV`: Set to `production` for production deployment
- `PORT`: Server port (defaults to 3000)
- `RENDER`: Automatically set by Render platform

## Browser Configuration

The application uses intelligent browser detection with different strategies:

### General Company Extraction:
- **Local Development:** Tries Edge → Chrome → Puppeteer bundled Chromium
- **Production (Render):** Uses Chrome installed via `npx puppeteer browsers install chrome`

### LinkedIn Extraction:
- **Local Development:** Prefers Edge (better for LinkedIn) → Chrome → Puppeteer bundled Chromium  
- **Production (Render):** Uses Chrome (Edge not available in Linux containers)

### Additional Features:
- Automatic Chrome installation during Render deployment
- Stealth measures for LinkedIn scraping (custom user agent, webdriver property removal)
- Container-optimized Chrome flags for production environments

### Test Browser Detection:
Use the `/test-browser` endpoint to verify browser detection:
```bash
curl https://your-app.onrender.com/test-browser
```

## Dependencies

- **express**: Web framework
- **puppeteer**: Browser automation
- **cors**: Cross-origin resource sharing
- **dns**: Domain name resolution (Node.js built-in)

## Error Handling

The API includes comprehensive error handling for:
- Invalid URLs
- Unresolvable domains
- Browser launch failures
- Page load timeouts
- Network errors

## License

ISC
