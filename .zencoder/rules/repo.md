---
description: Repository Information Overview
alwaysApply: true
---

# SumNode - Company Details Extraction API

## Summary
A Node.js API service that extracts company details from websites using Puppeteer and web scraping. The application provides endpoints for extracting company information from any website URL, including LinkedIn company pages, with automatic browser detection.

## Structure
- **Root Directory**: Main application files, including entry point (index.js)
- **Test Files**: Various test scripts for API and browser functionality
- **Configuration Files**: package.json for dependencies, render.yaml for deployment

## Language & Runtime
**Language**: JavaScript (Node.js)
**Version**: Node.js 18+ (specified in package.json engines)
**Package Manager**: npm

## Dependencies
**Main Dependencies**:
- express (^4.21.2): Web framework for API endpoints
- puppeteer (^22.15.0): Browser automation for web scraping
- cors (^2.8.5): Cross-origin resource sharing
- axios (^1.11.0): HTTP client for requests
- cheerio (^1.1.2): HTML parsing
- node-vibrant (^3.1.6): Color extraction
- sharp (^0.34.3): Image processing

## Build & Installation
```bash
# Install dependencies
npm install

# Start the server
npm start

# Development mode
npm run dev

# Chrome installation (for Render deployment)
npm run install-chrome
```

## Deployment
**Platform**: Render
**Configuration**: render.yaml
**Build Command**: `npm install && npx puppeteer browsers install chrome`
**Start Command**: `npm start`
**Environment Variables**:
- NODE_ENV: production
- PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: false
- PUPPETEER_CACHE_DIR: /opt/render/project/src/.cache/puppeteer

## API Endpoints
**Main Endpoints**:
- POST /api/extract-company-details: Extracts company details from a given URL
- GET /test: Simple health check endpoint
- GET /test-browser: Browser detection test endpoint

## Browser Configuration
**Local Development**:
- General Extraction: Tries Edge → Chrome → Puppeteer bundled Chromium
- LinkedIn Extraction: Prefers Edge → Chrome → Puppeteer bundled Chromium

**Production (Render)**:
- Uses Chrome installed via `npx puppeteer browsers install chrome`
- Container-optimized Chrome flags

## Testing
**Test Files**:
- test-api.js: API endpoint testing
- test-api-detailed.js: Detailed API testing
- test-linkedin.js: LinkedIn scraping tests
- test-find-chrome.js: Browser detection tests
- test-chrome-fix.js: Chrome configuration tests

**Run Tests**:
```bash
# Run specific test
node test-api.js
node test-linkedin.js
```