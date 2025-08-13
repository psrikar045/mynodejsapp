with new changes we have added few endpoints

📋 Available Endpoints:

- POST /api/extract-company-details - Main extraction endpoint
- GET  /api/extraction-logs         - Real-time extraction logs
- GET  /api/extraction-sessions     - Active extraction sessions
- GET  /health                      - System health check
- GET  /linkedin-metrics            - LinkedIn extraction metrics
- GET  /performance-metrics         - Performance analytics
- GET  /anti-bot-status             - Anti-bot system status
- GET  /test                        - Basic API test
- GET  /test-browser                - Browser compatibility test

  
# SumNode - Company Details Extraction API

A Node.js API service that extracts company details from websites using Puppeteer and web scraping.

## Features

- Extract company details from any website URL
- LinkedIn company page scraping
- Automatic browser detection (Edge/Chrome)
- Production-ready for Render deployment
- CORS enabled for cross-origin requests

## API Endpoints


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
