const Vibrant = require('node-vibrant');
const sharp = require('sharp');
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const dns = require('dns').promises;
const os = require('os');
const fs = require('fs');
const path = require('path');
const { ensureChrome } = require('./ensure-chrome');

const app = express();
const port = process.env.PORT || 3000;

// Simple in-memory cache for performance optimization
const extractionCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// ✅ Example test endpoint
app.get('/test', (req, res) => {
  res.send('test completed');
});

// ✅ Browser detection test endpoint
app.get('/test-browser', (req, res) => {
  try {
    const generalBrowserPath = getBrowserExecutablePath();
    const linkedinBrowserPath = getBrowserExecutablePathForLinkedIn();
    
    res.json({
      success: true,
      environment: process.env.NODE_ENV || 'development',
      isRender: !!process.env.RENDER,
      generalBrowser: generalBrowserPath || 'Puppeteer bundled Chromium',
      linkedinBrowser: linkedinBrowserPath || 'Puppeteer bundled Chromium',
      platform: os.platform(),
      puppeteerCacheDir: process.env.PUPPETEER_CACHE_DIR || 'default'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ Start the server with Chrome initialization
async function startServer() {
  try {
    // Ensure Chrome is available before starting the server
    console.log('🚀 Initializing server...');
    const chromeReady = await ensureChrome();
    
    if (!chromeReady) {
      console.error('❌ Failed to initialize Chrome. Server may not work properly.');
      // Continue anyway - some endpoints might still work
    }
    
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      if (chromeReady) {
        console.log('✅ Chrome is ready for web scraping');
      } else {
        console.log('⚠️  Chrome initialization failed - web scraping may not work');
      }
    });
    
  } catch (error) {
    console.error('💥 Server startup failed:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

/* 
PERFORMANCE OPTIMIZATIONS IMPLEMENTED:

1. SMART NAVIGATION TIMEOUTS:
   - Adaptive timeout strategy: try fast (15s DOM), then medium (45s load), then fallback (60s networkidle2)
   - Reduced retry attempts from 3 to 2 for faster failure handling

2. INTELLIGENT RESOURCE BLOCKING:
   - Block heavy media, analytics, tracking, social media embeds
   - Keep essential resources like CSS, JS, and woff2 fonts
   - Significantly reduces page load time

3. PARALLEL PROCESSING:
   - All main extraction functions run in parallel with individual timeouts
   - LinkedIn extraction runs separately with graceful failure handling
   - Each extraction type has optimized timeout (15-30s)

4. SMART CACHING:
   - 10-minute in-memory cache for repeated requests
   - Automatic cache cleanup to prevent memory leaks
   - Cache hit returns results instantly

5. OPTIMIZED DATA EXTRACTION:
   - Reduced number of elements processed (3 instead of 5 per selector)
   - Limited color extraction to 4 colors instead of 6
   - Limited image extraction to 2 images instead of 4
   - Faster browser launch timeouts (60s instead of 120s)

6. GRACEFUL DEGRADATION:
   - Individual extraction failures don't break entire process
   - LinkedIn extraction is optional and non-blocking
   - Performance monitoring and timing information

7. REDUCED OVERALL TIMEOUTS:
   - Main extraction: 4 minutes (was 10 minutes)
   - LinkedIn extraction: 2 minutes (was 5 minutes)
   - Individual extractions: 15-30 seconds each

EXPECTED PERFORMANCE IMPROVEMENT:
- 60-70% faster for typical websites
- 80%+ faster for cached requests
- More reliable with graceful failure handling
- Better resource utilization
*/
// Utility functions grouped into an object
const utils = {
    /**
     * Validates if a given string is a valid URL.
     * @param {string} url - The URL string to validate.
     * @returns {boolean} True if the URL is valid, false otherwise.
     */
 normalizeUrl(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }
    
    url = url.trim();
    
    // Handle empty string after trimming
    if (!url) {
        return null;
    }
    
    // Handle incomplete protocol URLs
    if (url === 'http://' || url === 'https://') {
        return null;
    }
    
    // Remove trailing slash if present (except for root domain)
    if (url.endsWith('/') && url.length > 1) {
        url = url.slice(0, -1);
    }
    
    // Add https:// if not already present
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    
    return url;
},

 isValidUrl(url) {
    try {
        const normalized = utils.normalizeUrl(url);
        if (!normalized) {
            return false;
        }
        new URL(normalized);
        return true;
    } catch (e) {
        return false;
    }
},



    /**
     * Checks if the domain of a given URL is resolvable via DNS.
     * @param {string} url - The URL string to check.
     * @returns {Promise<boolean>} True if the domain is resolvable, false otherwise.
     */
    async isDomainResolvable(url) {
        try {
            const domain = new URL(url).hostname;
            await dns.lookup(domain);
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Calculates the Euclidean distance between two RGB colors.
     * @param {number} r1 - Red component of the first color.
     * @param {number} g1 - Green component of the first color.
     * @param {number} b1 - Blue component of the first color.
     * @param {number} r2 - Red component of the second color.
     * @param {number} g2 - Green component of the second color.
     * @param {number} b2 - Blue component of the second color.
     * @returns {number} The distance between the two colors.
     */
    calculateColorDistance(r1, g1, b1, r2, g2, b2) {
        return Math.sqrt(
            Math.pow(r2 - r1, 2) +
            Math.pow(g2 - g1, 2) +
            Math.pow(b2 - b1, 2)
        );
    },

    /**
     * Parses an RGB color string (e.g., "rgb(255, 0, 0)") into an object with r, g, b components.
     * @param {string} colorStr - The RGB color string.
     * @returns {{r: number, g: number, b: number}|null} An object with r, g, b properties, or null if parsing fails.
     */
    getRGBFromString(colorStr) {
        if (!colorStr) return null; // Handle null or undefined input
        // Updated regex to match rgb(r,g,b) or rgba(r,g,b,a)
        const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
        if (match) {
            return {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3])
            };
        }
        return null;
    },

    /**
     * Groups similar colors together based on a distance threshold.
     * @param {Array<{color: string, count: number}>} colors - An array of color objects, each with a color string and a count.
     * @param {number} [threshold=30] - The maximum distance for colors to be considered similar.
     * @returns {Array<object>} An array of color groups, sorted by count.
     */
    groupSimilarColors(colors, threshold = 30) {
        const groups = [];
        for (const color of colors) {
            const rgb = this.getRGBFromString(color.color);
            if (!rgb) continue;

            let foundGroup = false;
            for (const group of groups) {
                const groupRGB = this.getRGBFromString(group.color);
                if (!groupRGB) continue;

                const distance = this.calculateColorDistance(
                    rgb.r, rgb.g, rgb.b,
                    groupRGB.r, groupRGB.g, groupRGB.b
                );

                if (distance <= threshold) {
                    group.colors.push(color);
                    group.count += color.count;
                    foundGroup = true;
                    break;
                }
            }

            if (!foundGroup) {
                groups.push({
                    color: color.color,
                    count: color.count,
                    colors: [color]
                });
            }
        }
        return groups.sort((a, b) => b.count - a.count);
    },

    /**
     * Gets the closest human-readable name for a given RGB color.
     * @param {number} r - Red component of the color.
     * @param {number} g - Green component of the color.
     * @param {number} b - Blue component of the color.
     * @returns {string} The name of the closest color (e.g., "red", "blue", "unknown").
     */
    getColorName(r, g, b) {
        const colors = {
            'red': [255, 0, 0], 'green': [0, 255, 0], 'blue': [0, 0, 255],
            'yellow': [255, 255, 0], 'cyan': [0, 255, 255], 'magenta': [255, 0, 255],
            'white': [255, 255, 255], 'black': [0, 0, 0], 'gray': [128, 128, 128],
            'orange': [255, 165, 0], 'purple': [128, 0, 128], 'brown': [165, 42, 42],
            'pink': [255, 192, 203]
        };
        let minDistance = Infinity;
        let closestColor = 'unknown';
        for (const [name, [cr, cg, cb]] of Object.entries(colors)) {
            const distance = this.calculateColorDistance(r, g, b, cr, cg, cb);
            if (distance < minDistance) {
                minDistance = distance;
                closestColor = name;
            }
        }
        return closestColor;
    },

    /**
     * Generates lighter, darker, and complementary variations of a given RGB color.
     * @param {number} r - Red component of the color.
     * @param {number} g - Green component of the color.
     * @param {number} b - Blue component of the color.
     * @returns {{lighter: string, darker: string, complementary: string}} An object with RGB strings for lighter, darker, and complementary colors.
     */
    getColorVariations(r, g, b) {
        return {
            lighter: `rgb(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 30)})`,
            darker: `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`,
            complementary: `rgb(${255 - r}, ${255 - g}, ${255 - b})`
        };
    },

    /**
     * Calculates the contrast ratio between two RGB colors.
     * @param {number} r1 - Red component of the first color.
     * @param {number} g1 - Green component of the first color.
     * @param {number} b1 - Blue component of the first color.
     * @param {number} r2 - Red component of the second color.
     * @param {number} g2 - Green component of the second color.
     * @param {number} b2 - Blue component of the second color.
     * @returns {number} The contrast ratio.
     */
    calculateContrast(r1, g1, b1, r2, g2, b2) {
        const l1 = 0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1;
        const l2 = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    },

    /**
     * Converts RGB color components to a hex color string.
     * @param {number} r - Red component.
     * @param {number} g - Green component.
     * @param {number} b - Blue component.
     * @returns {string} The hex color string (e.g., "#RRGGBB").
     */
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
};

/**
 * Sets up a Puppeteer browser instance and a new page, then navigates to the given URL.
 * Includes error handling for browser launch and page navigation.
 * This version is specifically for the /api/extract-company-details endpoint.
 * @param {string} url - The URL to navigate to.
 * @returns {Promise<{browser: import('puppeteer').Browser, page: import('puppeteer').Page}>} A promise that resolves to an object containing the browser and page objects.
 * @throws Will throw an error if Puppeteer setup or navigation fails.
 */
async function setupPuppeteerPageForCompanyDetails(url) {
    // Chrome availability is ensured at server startup
    
    const browserPath = getBrowserExecutablePath();
    
    const launchOptions = {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-javascript-harmony-shipping',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ],
        headless: 'new', // Use new headless mode for better LinkedIn compatibility
        defaultViewport: {
            width: 1366,
            height: 768
        },
        timeout: 60000,
        protocolTimeout: 180000
    };

    // Only set executablePath if we found a specific browser
    if (browserPath) {
        launchOptions.executablePath = browserPath;
    }
    
    // Browser launch with optimized retry logic
    let browser;
    let lastError;
    
    for (let attempt = 1; attempt <= 2; attempt++) { // Reduced from 3 to 2 attempts
        try {
            console.log(`[Browser] Launch attempt ${attempt}/2...`);
            browser = await puppeteer.launch(launchOptions);
            console.log(`[Browser] Launch successful on attempt ${attempt}`);
            break;
        } catch (error) {
            lastError = error;
            console.log(`[Browser] Launch attempt ${attempt} failed:`, error.message);
            
            if (attempt < 2) {
                console.log(`[Browser] Waiting 1 second before retry...`); // Reduced from 3 seconds
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    if (!browser) {
        throw new Error(`Browser launch failed after 2 attempts. Last error: ${lastError.message}`);
    }

    try {
        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(180000); // Default navigation timeout (3 minutes)
        await page.setViewport({ width: 1366, height: 768 }); // LinkedIn-optimized viewport
        
        // **LINKEDIN-SPECIFIC: Add enhanced headers for better compatibility**
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        });

        // **SIMPLIFIED: Minimal request interception for LinkedIn compatibility**
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const url = req.url();
            const resourceType = req.resourceType();
            
            // Only block obviously unnecessary resources, allow everything else for LinkedIn
            if (url.includes('google-analytics') ||
                url.includes('googletagmanager') ||
                url.includes('doubleclick') ||
                url.includes('facebook.com/tr') ||
                (resourceType === 'media' && (url.includes('.mp4') || url.includes('.mov')))) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Navigation with retry logic and progressive wait conditions
        let response;
        let navigationSuccess = false;
        let lastError;
        
        // Smart navigation with adaptive timeouts - try fast first, fallback to slower
        const waitConditions = [
            { condition: 'domcontentloaded', timeout: 15000 },  // Fast DOM load
            { condition: 'load', timeout: 45000 },              // Full load with reasonable timeout
            { condition: 'networkidle2', timeout: 60000 }       // Fallback for complex sites
        ];
        
        for (let attempt = 1; attempt <= 2; attempt++) {
            for (let conditionIndex = 0; conditionIndex < waitConditions.length; conditionIndex++) {
                const { condition: waitCondition, timeout } = waitConditions[conditionIndex];
                
                try {
                    console.log(`[Navigation] Attempt ${attempt}/2 with '${waitCondition}' (${timeout/1000}s timeout) for ${url}`);
                    
                    response = await page.goto(url, {
                        waitUntil: waitCondition,
                        timeout: timeout
                    });
                    
                    navigationSuccess = true;
                    console.log(`[Navigation] Success with '${waitCondition}' on attempt ${attempt}`);
                    break;
                } catch (error) {
                    lastError = error;
                    console.log(`[Navigation] Failed with '${waitCondition}':`, error.message);
                    
                    // If this was the last condition, break to try next attempt
                    if (conditionIndex === waitConditions.length - 1) {
                        break;
                    }
                }
            }
            
            if (navigationSuccess) break;
            
            if (attempt < 2) {
                console.log(`[Navigation] Waiting 2 seconds before retry...`); // Reduced from 5 seconds
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        if (!navigationSuccess) {
            // Final fallback attempt with minimal requirements
            console.log(`[Navigation] Final fallback attempt with minimal timeout...`);
            try {
                response = await page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000 // Keep reasonable timeout for reliability
                });
                navigationSuccess = true;
                console.log(`[Navigation] Fallback attempt succeeded`);
            } catch (fallbackError) {
                throw new Error(`Navigation failed completely. Last error: ${lastError.message}, Fallback error: ${fallbackError.message}`);
            }
        }

        if (!response) {
            throw new Error('Failed to load the page: No response received.');
        }

        if (!response.ok()) {
            console.warn(`[Navigation] HTTP ${response.status()} for ${url}, but continuing...`);
            // Don't throw error for non-2xx status codes, many sites work despite this
        }
        
        // Give the page a moment to settle after navigation (reduced delay)
        await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced from 2000ms to 1000ms
        return { browser, page };
    } catch (error) {
        if (browser) {
            await browser.close(); // Ensure browser is closed on error during setup
        }
        // Re-throw the error to be caught by the endpoint's main try-catch block
        if (error.message && error.message.includes(url)) {
            throw error; // Error message already contains URL and potentially status
        } else {
            // Add URL context if not present
            throw new Error(`Puppeteer setup or navigation failed for URL ${url}: ${error.message}`);
        }
    }
}
function normalizeLinkedInUrl(url) {
    if (!url) return '';

    return url
        .trim()
        .replace(/\/(mycompany|about|overview)(\/)?$/, '') // remove '/mycompany', '/about', or '/overview'
        .replace(/\/+$/, ''); // remove trailing slashes
}
function getBrowserExecutablePath() {
    const platform = os.platform();
    
    // Check if we're in a production environment (like Render)
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
    
    if (isProduction) {
        // For production environments (Render), let Puppeteer handle browser detection automatically
        console.log('[Browser] Production environment detected, using Puppeteer bundled Chromium');
        return null; // Let Puppeteer handle browser detection automatically
    }
    
    // For local development, try to find installed browsers
    const browserCandidates = {
        win32: [
            // Edge paths
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            // Chrome paths
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            // User-specific Chrome paths
            `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
            `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
            `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`
        ],
        darwin: [
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        ],
        linux: [
            '/usr/bin/microsoft-edge',
            '/opt/microsoft/msedge/msedge',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/snap/bin/chromium'
        ]
    };

    const paths = browserCandidates[platform] || [];
    
    for (const browserPath of paths) {
        if (browserPath && fs.existsSync(browserPath)) {
            console.log(`[Browser] Found local browser: ${browserPath}`);
            return browserPath;
        }
    }

    // If no local browser found, use Puppeteer's bundled Chromium
    console.log('[Browser] No local browser found, will use Puppeteer bundled Chromium');
    return null;
}
/**
 * Get browser executable path specifically for LinkedIn extraction
 * Prefers Edge for local development, Chrome for production
 */
function getBrowserExecutablePathForLinkedIn() {
    const platform = os.platform();
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
    
    if (isProduction) {
        // In production (Render), use Puppeteer's bundled Chromium for LinkedIn
        console.log('[LinkedIn Browser] Production environment detected, using Puppeteer bundled Chromium');
        return null; // Let Puppeteer handle browser detection automatically
    }
    
    // For local development, prefer Edge for LinkedIn
    const browserCandidates = {
        win32: [
            // Edge paths (preferred for LinkedIn)
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            // Chrome paths (fallback)
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
        ],
        darwin: [
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        ],
        linux: [
            '/usr/bin/microsoft-edge',
            '/opt/microsoft/msedge/msedge',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium'
        ]
    };

    const paths = browserCandidates[platform] || [];
    
    for (const browserPath of paths) {
        if (browserPath && fs.existsSync(browserPath)) {
            console.log(`[LinkedIn Browser] Found browser for LinkedIn: ${browserPath}`);
            return browserPath;
        }
    }

    console.log('[LinkedIn Browser] No specific browser found, using default');
    return null;
}

/**
 * Use Edge (local) or Chrome (production) to scrape company details from a LinkedIn company page
 */
//this is been used to fetch the data from linkedin
async function extractCompanyDataFromLinkedIn(linkedinUrl) {
    // Chrome availability is ensured at server startup
    
    const browserPath = getBrowserExecutablePathForLinkedIn();

    const launchOptions = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-extensions',
            // LinkedIn-specific arguments to avoid detection
            '--disable-blink-features=AutomationControlled',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
        ],
        timeout: 60000, // Reduced browser launch timeout for LinkedIn
        protocolTimeout: 180000 // Reduced protocol timeout for LinkedIn
    };

    // Only set executablePath if we found a specific browser
    if (browserPath) {
        launchOptions.executablePath = browserPath;
    }
    // If browserPath is null, Puppeteer will use its bundled Chromium

    const browser = await puppeteer.launch(launchOptions);

    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    try {
        const cleanUrl = normalizeLinkedInUrl(linkedinUrl);
        
        // Enhanced stealth measures for LinkedIn
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36');
        
        // Set additional headers to look more like a real browser
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        });
        
        // Enhanced anti-detection measures
        await page.evaluateOnNewDocument(() => {
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
          
            // Override the plugins property to use a custom getter
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            
            // Override the languages property to use a custom getter
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
            
            // Override the permissions property
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        });
        
        // Set viewport to common resolution
        await page.setViewport({ width: 1366, height: 768 });
        
        // Smart LinkedIn navigation with adaptive approach
        let navigationSuccess = false;
        let lastError = null;
        
        // Try fast approach first, then fallback to more reliable approach
        const navigationStrategies = [
            { waitUntil: 'domcontentloaded', timeout: 20000 },  // Fast approach
            { waitUntil: 'load', timeout: 60000 }               // Reliable fallback
        ];
        
        for (let attempt = 1; attempt <= 2; attempt++) {
            for (const strategy of navigationStrategies) {
                try {
                    console.log(`[LinkedIn] Navigation attempt ${attempt}/2 to ${cleanUrl} with ${strategy.waitUntil} (${strategy.timeout/1000}s)`);
                    await page.goto(cleanUrl, strategy);
                    navigationSuccess = true;
                    console.log(`[LinkedIn] Navigation successful with ${strategy.waitUntil} on attempt ${attempt}`);
                    break;
                } catch (error) {
                    lastError = error;
                    console.log(`[LinkedIn] Navigation failed with ${strategy.waitUntil}:`, error.message);
                }
            }
            
            if (navigationSuccess) break;
            
            if (attempt < 2) {
                console.log(`[LinkedIn] Waiting 2 seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        if (!navigationSuccess) {
            throw new Error(`LinkedIn navigation failed after trying all strategies. Last error: ${lastError.message}`);
        }
        
        // Wait a bit for dynamic content to load with reduced delay
        const randomDelay = 500 + Math.random() * 1000; // 0.5-1.5 seconds (reduced from 1-3 seconds)
        await new Promise(resolve => setTimeout(resolve, randomDelay));

        // Try to close various popups that might appear
        const popupSelectors = [
            'button[aria-label="Dismiss"]',
            'button[data-test-modal-close-btn]',
            'button[class*="modal-close"]',
            '.modal button[aria-label*="close"]',
            '.artdeco-modal__dismiss'
        ];
        
        for (const selector of popupSelectors) {
            try {
                await page.click(selector, { timeout: 1000 }); // Reduced from 2000ms to 1000ms
                console.log(`[LinkedIn] Dismissed popup using selector: ${selector}`);
                await new Promise(resolve => setTimeout(resolve, 500)); // Reduced from 1000ms to 500ms
                break;
            } catch {
                // Continue to next selector
            }
        }

        // Add timeout to the page evaluation (reduced timeout)
        console.log('[LinkedIn] Starting page data extraction...');
        const data = await Promise.race([
            page.evaluate(() => {
            console.log('[LinkedIn Eval] Starting data extraction...');
            const getByLabel = (label) => {
                const items = Array.from(document.querySelectorAll('dt'));
                for (const dt of items) {
                    if (dt.innerText.trim().toLowerCase() === label.toLowerCase()) {
                        return dt.nextElementSibling?.innerText?.trim() || null;
                    }
                }
                return null;
            };
            const banner =
        document.querySelector('section.org-top-card img')?.src || // sometimes used
        document.querySelector('img.org-top-card-primary-content__cover')?.src || // new format
        Array.from(document.querySelectorAll('img')).find(img =>
            img.src?.includes('/images/profile/cover'))?.src || null;
const getImageFromBanner = () => {
    const selectors = [
        // Priority 1: DIVs with background-image
        { selector: 'div.org-top-card-primary-content__hero-image', type: 'bg' },
        { selector: 'div.org-top-card-module__hero', type: 'bg' },
        { selector: 'div.profile-background-image__image', type: 'bg' },
        { selector: 'section[class*="artdeco-card"] div[class*="ivm-image-view-model__background-img"]', type: 'bg'},
        { selector: 'div[class*="cover-img"]', type: 'bg' },
        { selector: 'div[class*="profile-cover-image"]', type: 'bg' },
        { selector: 'div[class*="banner-image"]', type: 'bg' },

        // Priority 2: Specific IMG tags
        { selector: 'img.org-top-card-primary-content__cover', type: 'src' },
        { selector: 'img[data-test-id*="cover-photo"]', type: 'src' },
        { selector: 'img[data-test-id*="banner-img"]', type: 'src' },
        { selector: 'img[alt*="Cover photo"i]', type: 'src' },
        { selector: 'img[alt*="Cover image"i]', type: 'src' },
        { selector: 'img[alt*="Banner"i]', type: 'src' },
        { selector: 'img[class*="cover-image"]', type: 'src' },
        { selector: 'img[class*="banner-image"]', type: 'src' },
        // More specific path for company background images on LinkedIn CDN
        { selector: 'img[src*="media.licdn.com/dms/image/"][src*="company-background"]', type: 'src'},


        // Priority 3: IMG tags within known banner/cover containers
        { selector: 'div.cover-photo img', type: 'src' },
        { selector: 'div.banner img', type: 'src' },
        { selector: 'figure[class*="banner"] img', type: 'src' },
        { selector: 'figure[class*="cover"] img', type: 'src' },

        // Priority 4: Less specific, but still plausible (use with caution, check result)
        // Removed the naturalWidth/Height check as it's unreliable here.
        // The selector 'section.org-top-card img' is broad; specific sub-selectors are better.
    ];

    for (const item of selectors) {
        const element = document.querySelector(item.selector);
        if (element) {
            if (item.type === 'bg') {
                const bg = getComputedStyle(element).backgroundImage;
                if (bg && bg !== 'none') {
                    const match = bg.match(/url\(["']?(.*?)["']?\)/);
                    if (match && match[1]) {
                        // Ensure it's a full URL, not a relative path or data URI if possible
                        // For LinkedIn, urls are usually absolute from media.licdn.com
                        if (match[1].startsWith('http') || match[1].startsWith('//')) {
                             // console.log(`[LinkedIn Scrape - getImageFromBanner] Found BG: ${match[1]} via ${item.selector}`);
                            return match[1];
                        } else if (match[1].startsWith('data:image')) {
                            // Potentially handle data URIs if necessary, or ignore them
                            // console.log(`[LinkedIn Scrape - getImageFromBanner] Found data URI BG, skipping: via ${item.selector}`);
                        }
                    }
                }
            } else if (item.type === 'src') {
                const src = element.getAttribute('src');
                if (src) {
                     // console.log(`[LinkedIn Scrape - getImageFromBanner] Found SRC: ${src} via ${item.selector}`);
                    // Ensure it's a full URL
                    if (src.startsWith('http') || src.startsWith('//')) {
                        return src;
                    } else if (src.startsWith('data:image')) {
                         // console.log(`[LinkedIn Scrape - getImageFromBanner] Found data URI src, skipping: via ${item.selector}`);
                    } else {
                        // Attempt to resolve relative URLs, though less common for critical images like banners
                        // return new URL(src, document.baseURI).href; // Might be needed if relative paths are used
                    }
                }
            }
        }
    }
    // console.log(`[LinkedIn Scrape - getImageFromBanner] No banner image found after trying all selectors.`);
    return null;
};
    // Description: from the About Us section, usually inside <section.about-us>
    // const aboutSection = document.querySelector('section.about-us') || document.querySelector('[data-test-id="about-us"]') || document.querySelector('.org-page-details__definition-text');
    // const description = aboutSection?.innerText?.trim() || null;

    // Description: from the About Us section
    let description = null;
    const descriptionSelectors = [
        'section.about-us',
        '[data-test-id="about-us"]',
        '.org-page-details__definition-text', // Often contains the main description text
        'div[class*="about__content"] p',    // General pattern for about content paragraphs
        'section[aria-label*="About"] p'     // Accessibility pattern for about sections
    ];
    for (const selector of descriptionSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const text = element.innerText?.trim();
            if (text) {
                description = text;
                break;
            }
        }
    }

            console.log('[LinkedIn Eval] Extracting banner...');
            const bannerUrl = getImageFromBanner();
            console.log('[LinkedIn Eval] Banner extracted, getting company details...');
            
            const result = {
                bannerUrl: bannerUrl,
                description: description, // Use the potentially populated description variable
                industry: getByLabel('Industry'),
                companySize: getByLabel('Company size'),
                headquarters: getByLabel('Headquarters'),
                location: getByLabel('Headquarters'),
                type: getByLabel('Company type') || getByLabel('Type'),
                founded: getByLabel('Founded'),
                specialties: getByLabel('Specialties'),
                locations: getByLabel('Locations')
            };
            
            console.log('[LinkedIn Eval] Data extraction completed');
            return result;
        }),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('LinkedIn page evaluation timeout after 45 seconds')), 45000) // Balanced timeout - not too fast, not too slow
        )
    ]);
        
        console.log('[LinkedIn] Page evaluation completed successfully');
        await context.close();
        await browser.close();
        return data;
    } catch (err) {
        console.error('[LinkedIn Scrape Error]', err.message);
        
        // Provide more specific error information
        if (err.message.includes('Navigation timeout')) {
            console.error('[LinkedIn] Navigation timeout - LinkedIn may be blocking requests or server is slow');
        } else if (err.message.includes('net::ERR_')) {
            console.error('[LinkedIn] Network error - connection issue or LinkedIn blocking');
        } else if (err.message.includes('Protocol error')) {
            console.error('[LinkedIn] Protocol error - browser communication issue');
        }
        
        try {
            await context.close();
            await browser.close();
        } catch (closeError) {
            console.error('[LinkedIn] Error closing browser:', closeError.message);
        }
        
        return { 
            error: `LinkedIn scraping failed: ${err.message}`,
            errorType: err.name || 'UnknownError'
        };
    }
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Check if color is greyscale
 */
function isGreyscale(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  
  const { r, g, b } = rgb;
  const diff = Math.max(r, g, b) - Math.min(r, g, b);
  return diff < 10; // Threshold for greyscale detection
}
// Add this new helper function
async function cleanUpTempImageFile(filePath, shouldCleanUp) {
    if (shouldCleanUp && filePath) {
        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 200; // Wait 100ms between retries

        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                // Add a small delay before attempting to unlink
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                await fss.unlink(filePath);
                console.info(`Cleaned up temporary file: ${filePath}`);
                return; // Successfully deleted, exit the helper function
            } catch (cleanupError) {
                // Check for common error codes indicating file is locked/in use/permission denied
                if (cleanupError.code === 'EBUSY' || cleanupError.code === 'EPERM' || cleanupError.code === 'EMFILE' || cleanupError.code === 'ENOENT') {
                    if (cleanupError.code === 'ENOENT' && i === 0) {
                        // If file doesn't exist on first try, maybe it was never created or already deleted
                        console.warn(`Temporary file ${filePath} not found for cleanup (might be already gone).`);
                        return; // No need to retry if it doesn't exist
                    }
                    if (i < MAX_RETRIES - 1) {
                        console.warn(`Attempt ${i + 1}/${MAX_RETRIES}: File ${filePath} busy, permission issue, or missing. Retrying...`);
                    } else {
                        // Last attempt failed
                        console.error(`Failed to clean up temporary file ${filePath} after ${MAX_RETRIES} attempts:`, cleanupError);
                    }
                } else {
                    // Another type of error, no need to retry
                    console.error(`Unexpected error during temporary file cleanup ${filePath}:`, cleanupError);
                    return; // Other error, exit the helper function
                }
            }
        }
    }
}
  /**
   * Extract dominant colors from image using node-vibrant
   */
  async function extractColorsFromImage(imagePath) {
     let localImagePath = imagePath; // Assume it's a path initially
    let cleanupTempFile = false; // Flag to indicate if we need to delete a temp file

    try {
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            // cleanupTempFile = true;
            const response = await axios({
                method: 'get',
                url: imagePath,
                responseType: 'arraybuffer' // Get image data as a buffer
            });

            // Create a temporary file path
            const tempDir = os.tmpdir();
            const fileName = `temp_image_${Date.now()}${path.extname(new URL(imagePath).pathname) || '.jpg'}`; // Use actual extension or default to .jpg
            localImagePath = path.join(tempDir, fileName);

            // Write the image data to the temporary file
            await fss.writeFile(localImagePath, response.data);
        }
      const metadata = await sharp(localImagePath).metadata();
    const imageWidth = metadata.width;
    const imageHeight = metadata.height;
      const palette = await Vibrant.from(localImagePath).getPalette();
      const colors = [];
      
      // Extract colors from vibrant palette
      for (const [name, swatch] of Object.entries(palette)) {
        if (swatch) {
          const hex = swatch.getHex();
          if (hex && !isGreyscale(hex)) {
            colors.push({
              hex: hex,
              population: swatch.getPopulation(),
              rgb: hexToRgb(hex),
              name: name
            });
          }
        }
      }
       // Sort by population and return top 5
    const topColors = colors
      .sort((a, b) => b.population - a.population)
      .slice(0, 5)
      .map(color => color.hex);
      // Sort by population and return top 5
      // return colors
      //   .sort((a, b) => b.population - a.population)
      //   .slice(0, 5)
      //   .map(color => color.hex);
      cleanupTempFile = true; // Set cleanup flag to true if we downloaded a temp file
      return {
      width: imageWidth,
      height: imageHeight,
      colors: topColors
    };
        
    } catch (error) {
      console.error(`Error extracting colors from image ${imagePath}:`, error);
      return {
      width: null,
      height: null,
      colors: []
    }; // Return null or appropriate defaults on error
    }finally {
        // Step 4: Guarantee cleanup using the helper method
        // This will run reliably regardless of success or failure in the try block
        await cleanUpTempImageFile(localImagePath, cleanupTempFile);
    }
  }
const extraction = require('./extraction');
const scraperLink = require('./scrapeLinkedIn');
const fss = require('fs').promises;
async function extractCompanyDetailsFromPage(page, url, browser) { // Added browser argument here
    const startTime = Date.now();
    console.log(`[Performance] Starting extraction for ${url}`);
    // Helper to get content from meta tags more reliably
    const getMetaContent = async (page, selectors) => { // Added page argument
        for (const selector of selectors) {
            try {
                const content = await page.$eval(selector, el => el.content.trim());
                if (content) return content;
            } catch (e) { /* Selector not found or element has no content, try next */ }
        }
        return null;
    };

    // Helper to get text, preferring more specific selectors first
    const getTextFromSelectors = async (page, selectors) => { // Added page argument
        for (const selector of selectors) {
            try {
                const text = await page.$eval(selector, el => el.textContent.trim());
                if (text) return text;
            } catch (e) { /* Selector not found, try next */ }
        }
        return null;
    };

    // Helper to get an attribute, preferring more specific selectors first
    const getAttributeFromSelectors = async (page, selectors, attribute) => { // Added page argument
         for (const selector of selectors) {
            try {
                const attrVal = await page.$eval(selector, (el, attr) => el.getAttribute(attr), attribute);
                if (attrVal) return attrVal.trim();
            } catch (e) { /* Selector not found, try next */ }
        }
        return null;
    };

    // Helper to resolve a URL against a base URL
    const resolveUrl = (relativeOrAbsoluteUrl, baseUrl) => {
        if (!relativeOrAbsoluteUrl) return null;
        if (relativeOrAbsoluteUrl.startsWith('http')) return relativeOrAbsoluteUrl;
        try {
            return new URL(relativeOrAbsoluteUrl, baseUrl).href;
        } catch (e) {
            console.warn(`Invalid URL to resolve: ${relativeOrAbsoluteUrl} against base ${baseUrl}`);
            return null;
        }
    };

    // 3a. Extract Logo URLs
    const getLogoDetails = async (page, baseUrl) => {
        console.log(`[getLogoDetails] Starting extraction for ${baseUrl}`);

        let primaryLogoUrl = null;
        let iconUrl = null;
        let bannerUrl = null;
        let symbolUrl = null; // Keep trying for symbol, though hard

        // --- Evaluation within page context ---
        const extractedAssets = await page.evaluate((pageBaseUrl) => {
            const results = {
                metaLogo: null,
                metaIcon: null,
                metaBanner: null,
                imgLogo: null,
                linkIcon: null,
                svgLogo: null, // For linked SVG files or <use> tags
            };
            const consoleMessages = []; // For debugging inside evaluate

            const makeAbsolute = (url) => {
                if (!url || typeof url !== 'string') return null;
                try {
                    return new URL(url, pageBaseUrl).href;
                } catch (e) {
                    consoleMessages.push(`Invalid URL for new URL(url, pageBaseUrl): ${url}, ${pageBaseUrl}`);
                    return null;
                }
            };

            // 1. Meta tags for primary logo (most reliable)
            const ogLogo = document.querySelector('meta[property="og:logo"]');
            if (ogLogo && ogLogo.content) results.metaLogo = makeAbsolute(ogLogo.content);
            else {
                const itemPropLogo = document.querySelector('meta[itemprop="logo"]');
                if (itemPropLogo && itemPropLogo.content) results.metaLogo = makeAbsolute(itemPropLogo.content);
                else {
                    const twitterImage = document.querySelector('meta[name="twitter:image"]');
                    if (twitterImage && twitterImage.content && (twitterImage.content.includes('logo') || twitterImage.content.includes('brand'))) { // Heuristic for twitter image as logo
                        results.metaLogo = makeAbsolute(twitterImage.content);
                    }
                }
            }
            consoleMessages.push(`Meta Logo candidates: og: ${ogLogo?.content}, itemprop: ${document.querySelector('meta[itemprop="logo"]')?.content}, twitter: ${document.querySelector('meta[name="twitter:image"]')?.content}`);


            // 2. Meta tags for banner (often og:image)
            const ogImage = document.querySelector('meta[property="og:image"]');
            if (ogImage && ogImage.content) results.metaBanner = makeAbsolute(ogImage.content);
            else {
                 const twitterImageSrc = document.querySelector('meta[name="twitter:image:src"]');
                 if (twitterImageSrc && twitterImageSrc.content) results.metaBanner = makeAbsolute(twitterImageSrc.content);
            }
             consoleMessages.push(`Meta Banner candidates: og: ${ogImage?.content}, twitter:src: ${document.querySelector('meta[name="twitter:image:src"]')?.content}`);


            // 3. Link tags for icons (favicon, apple-touch-icon)
            const iconSelectors = [
                'link[rel="icon"]',
                'link[rel="shortcut icon"]',
                'link[rel="apple-touch-icon"]',
                'link[rel="apple-touch-icon-precomposed"]',
                'link[itemprop="image"]' // Less common for icon but possible
            ];
            for (const selector of iconSelectors) {
                const el = document.querySelector(selector);
                if (el && el.href) {
                    results.linkIcon = makeAbsolute(el.href);
                    if(results.linkIcon) break; // Take the first valid one
                }
            }
            consoleMessages.push(`Link Icon candidate: ${results.linkIcon}`);

            // 4. Image tags for primary logo (fallback if meta tags fail)
            if (!results.metaLogo) {
                const imgSelectors = [
                    'img[itemprop="logo"][src]', // Prioritize itemprop on img
                    'img[alt*="logo"i][src]',
                    'img[class*="logo"i][src]',
                    'img[id*="logo"i][src]',
                    'header img[src]',
                    'a[href="/"] img[src]', // Logo linked to homepage
                    'div[class*="logo"i] img[src]'
                ];
                for (const selector of imgSelectors) {
                    const el = document.querySelector(selector);
                    if (el && el.src) {
                        // Basic check to avoid tiny images / tracking pixels if possible from attributes
                        const width = parseInt(el.getAttribute('width') || '0', 10) || el.naturalWidth || 0;
                        const height = parseInt(el.getAttribute('height') || '0', 10) || el.naturalHeight || 0;
                        consoleMessages.push(`Img candidate: ${el.src}, w:${width}, h:${height}`);
                        if (width === 1 && height === 1) continue; // Skip 1x1 pixels

                        results.imgLogo = makeAbsolute(el.src);
                        if(results.imgLogo) break;
                    }
                }
            }
             consoleMessages.push(`Img Logo candidate: ${results.imgLogo}`);

            // 5. SVG specific search (basic: linked SVGs or <use>)
            const svgUseElements = document.querySelectorAll('svg use');
            let foundSvgHref = null;
            for (const svgUseEl of svgUseElements) {
                let href = svgUseEl.getAttribute('href');
                // If href is null or an internal fragment, try xlink:href
                if (!href || href.startsWith('#')) {
                    const xlinkHref = svgUseEl.getAttribute('xlink:href');
                    if (xlinkHref && !xlinkHref.startsWith('#')) {
                        href = xlinkHref; // Use xlink:href if it's external
                    } else if (xlinkHref && xlinkHref.startsWith('#') && (!href || href.startsWith('#'))) {
                        // Both are internal, or href was null and xlink:href is internal
                        consoleMessages.push(`Found internal SVG <use> reference (href: ${href}, xlink:href: ${xlinkHref}). Symbol extraction from sprites not implemented.`);
                        href = null; // Don't use internal fragments as a direct src
                    } else if (!href && !xlinkHref) {
                        href = null; // Neither attribute exists
                    }
                }

                if (href && !href.startsWith('#')) { // Ensure it's an external link
                    foundSvgHref = href;
                    consoleMessages.push(`Found external SVG <use> href: ${foundSvgHref}`);
                    break;
                } else if (href && href.startsWith('#')) { // Log internal references if not already logged
                     consoleMessages.push(`Found internal SVG <use> reference: ${href}. Symbol extraction from sprites not implemented.`);
                }
            }
            if (foundSvgHref) {
                results.svgLogo = makeAbsolute(foundSvgHref);
            }
             consoleMessages.push(`SVG Logo candidate from <use>: ${results.svgLogo || 'null'}`);
             console.log('Puppeteer evaluate console:', consoleMessages.join('\\n')); // Log messages from within evaluate

            return results;
        }, baseUrl); // Pass baseUrl to page.evaluate

        console.log('[getLogoDetails] Extracted assets from page:', JSON.stringify(extractedAssets, null, 2));

        // Prioritize sources for primaryLogoUrl
        primaryLogoUrl = extractedAssets.metaLogo || extractedAssets.imgLogo || extractedAssets.svgLogo;

        // Icon URL
        iconUrl = extractedAssets.linkIcon;

        // Banner URL (don't use logo as banner if they are the same)
        if (extractedAssets.metaBanner && extractedAssets.metaBanner !== primaryLogoUrl) {
            bannerUrl = extractedAssets.metaBanner;
        }

        // Symbol: still hard. If svgLogo was found and it's different from primaryLogo, maybe it's a symbol?
        if (extractedAssets.svgLogo && extractedAssets.svgLogo !== primaryLogoUrl) {
            // This is a weak heuristic. A true symbol is often part of a combined logo.
            // For now, we don't have a strong way to identify it.
        }

        return {
            Logo: primaryLogoUrl,
            Symbol: symbolUrl, // Remains null for now mostly
            Icon: iconUrl,
            Banner: bannerUrl
        };
    };

    // 3b. Extract Brand Colors
    const getBrandColors = async (page) => {
        console.log(`[getBrandColors] Starting color extraction.`);
        try {
            const colorsData = await page.evaluate(() => {
                const collectedColors = new Map(); // Use a Map to store unique colors and their sources/counts

                // Helper to parse color string "rgb(r, g, b)" or "rgba(r, g, b, a)" to {r, g, b}
                const parseRgb = (colorStr) => {
                    if (!colorStr || typeof colorStr !== 'string') return null;
                    const match = colorStr.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\)/);
                    if (match) return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
                    return null;
                };

                // Helper to convert {r, g, b} to hex #RRGGBB
                const rgbToHex = (r, g, b) => {
                    return '#' + [r, g, b].map(x => {
                        const hex = x.toString(16);
                        return hex.length === 1 ? '0' + hex : hex;
                    }).join('');
                };

                // Helper to calculate brightness (0-255)
                const calculateBrightness = (r, g, b) => Math.round((0.299 * r + 0.587 * g + 0.114 * b));

                // Helper to add color to map if it's significant
                const addColor = (rgbString, sourceHint) => {
                    if (!rgbString || rgbString === 'transparent' || rgbString === 'rgba(0, 0, 0, 0)') return;

                    const rgb = parseRgb(rgbString);
                    if (!rgb) return;

                    // Filter out pure white and black unless they are from very specific sources, or very dark/light grays
                    const brightness = calculateBrightness(rgb.r, rgb.g, rgb.b);
                    if ((brightness > 250 && !(sourceHint.includes('variable') && sourceHint.toLowerCase().includes('background'))) && // Allow very light bg from vars
                        (brightness < 10 && !(sourceHint.includes('variable') && sourceHint.toLowerCase().includes('text')))) { // Allow very dark text from vars
                        // Heuristic: avoid near white/black unless explicitly defined or contextually important
                        // This needs refinement based on how "brand" colors are defined vs utility colors
                         if (!sourceHint.toLowerCase().includes('primary') && !sourceHint.toLowerCase().includes('accent') && !sourceHint.toLowerCase().includes('brand')) {
                           // return; // Commented out to be more inclusive initially
                         }
                    }

                    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
                    if (!collectedColors.has(hex)) {
                        collectedColors.set(hex, {
                            hex: hex,
                            rgb: `rgb(${rgb.r},${rgb.g},${rgb.b})`,
                            brightness: brightness,
                            sources: [sourceHint],
                            count: 1
                        });
                    } else {
                        const existing = collectedColors.get(hex);
                        existing.sources.push(sourceHint);
                        existing.count++;
                    }
                };

                // 1. Scan CSS Custom Properties on :root
                const rootStyle = window.getComputedStyle(document.documentElement);
                for (let i = 0; i < rootStyle.length; i++) {
                    const propName = rootStyle[i];
                    if (propName.startsWith('--') && (propName.toLowerCase().includes('color') || propName.toLowerCase().includes('brand') || propName.toLowerCase().includes('primary') || propName.toLowerCase().includes('accent') || propName.toLowerCase().includes('secondary'))) {
                        const propValue = rootStyle.getPropertyValue(propName).trim();
                        addColor(propValue, `css_variable: ${propName}`);
                    }
                }

                // 2. Collect colors from key UI elements
                const keySelectors = [
                    { selector: 'button, [role="button"], .button, .btn', purpose: 'button_bg', prop: 'backgroundColor' },
                    { selector: 'button, [role="button"], .button, .btn', purpose: 'button_text', prop: 'color' },
                    { selector: 'a', purpose: 'link_text', prop: 'color' },
                    { selector: 'h1, .h1', purpose: 'h1_text', prop: 'color' },
                    { selector: 'h2, .h2', purpose: 'h2_text', prop: 'color' },
                    { selector: 'header, [role="banner"]', purpose: 'header_bg', prop: 'backgroundColor'},
                    { selector: '[class*="primary-bg"], [class*="accent-bg"]', purpose: 'primary_accent_bg', prop: 'backgroundColor'},
                    { selector: '[class*="primary-text"], [class*="accent-text"]', purpose: 'primary_accent_text', prop: 'color'}
                ];

                keySelectors.forEach(item => {
                    try {
                        const elements = Array.from(document.querySelectorAll(item.selector)).slice(0, 3); // Reduced from 5 to 3 elements per selector for speed
                        elements.forEach(el => {
                            const style = window.getComputedStyle(el);
                            addColor(style[item.prop], item.purpose);
                        });
                    } catch (e) { /* ignore selector errors */ }
                });

                // Convert Map to Array for easier processing/sorting later if needed
                return Array.from(collectedColors.values());
            });

            // Post-processing: Sort by brightness or count, select top N, etc.
            // For now, just take them as found, up to a limit.
            // A more sophisticated selection would involve frequency, source priority, contrast checks, etc.
            let finalColors = colorsData;

            // Sort by brightness (desc) then by count (desc) as a simple heuristic for "importance"
            finalColors.sort((a, b) => {
                if (a.brightness !== b.brightness) {
                    return b.brightness - a.brightness; // Darker colors first, then lighter
                }
                return b.count - a.count; // Then by how many times it was found
            });

            // Filter out very similar colors if too many are found (complex, skip for now)
            // Limit to a reasonable number, reduced for speed
            finalColors = finalColors.slice(0, 4); // Reduced from 6 to 4 colors for faster processing

            console.log(`[getBrandColors] Found ${finalColors.length} potential brand colors.`);
            return finalColors.map(c => ({
                hex: c.hex,
                rgb: c.rgb,
                brightness: c.brightness,
                // name: c.sources.join(', ').substring(0,50) // Use first source as a hint for name
                name: c.sources[0] // Simpler name from first source
            }));

        } catch (e) {
            console.warn("[getBrandColors] Error during color extraction:", e.message);
            return [];
        }
    };

    // 3c. Extract Key Fonts
    const getKeyFonts = async (page) => {
        console.log(`[getKeyFonts] Starting font extraction.`);
        try {
            // Helper function to parse the primary font name from a CSS font-family stack
            const parsePrimaryFont = (fontStack) => {
                if (!fontStack || typeof fontStack !== 'string') return null;
                // Split by comma, take the first part, remove quotes and trim
                const firstFont = fontStack.split(',')[0].trim();
                return firstFont.replace(/^['"]|['"]$/g, ''); // Remove surrounding quotes
            };

            const fontsInfo = await page.evaluate(() => {
                const getFontFamily = (selectors) => {
                    for (const selector of selectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            const ff = window.getComputedStyle(element).fontFamily;
                            if (ff) return ff;
                        }
                    }
                    return null;
                };

                // More targeted selectors for headings
                const headingSelectors = [
                    'h1', 'h2', 'h3', // Prioritize actual heading tags
                    '.h1', '.h2', '.h3', // Common heading classes
                    '[class*="headline"]', '[class*="heading"]', '[class*="title"]', // Class names indicating headings
                    '[role="heading"][aria-level="1"]', '[role="heading"][aria-level="2"]' // ARIA roles
                ];
                const headingFontStack = getFontFamily(headingSelectors);

                // More targeted selectors for body text
                const bodySelectors = [
                    'p', // Standard paragraph
                    'article p', 'main p', 'section p', // Paragraphs within semantic content areas
                    '.content p', '.text-block p', '[class*="body-text"] p', '[class*="content-text"] p', // Paragraphs within common content divs
                    'body' // Fallback to body itself if no specific p text found
                ];
                let bodyFontStack = getFontFamily(bodySelectors);

                // If body font is same as heading, try a more generic body selector as a last resort for differentiation
                if (bodyFontStack === headingFontStack) {
                    bodyFontStack = window.getComputedStyle(document.body).fontFamily;
                }

                return { headingFontStack, bodyFontStack };
            });

            const headingFontName = parsePrimaryFont(fontsInfo.headingFontStack);
            const bodyFontName = parsePrimaryFont(fontsInfo.bodyFontStack);

            const resultFonts = [];
            if (headingFontName) {
                resultFonts.push({
                    name: headingFontName,
                    type: 'heading', // Heuristic type
                    stack: fontsInfo.headingFontStack || ''
                });
            }
            if (bodyFontName) {
                // Avoid adding the same font entry if body font resolves to the same as heading
                if (!headingFontName || (headingFontName && bodyFontName !== headingFontName) ||
                    (bodyFontName === headingFontName && fontsInfo.bodyFontStack !== fontsInfo.headingFontStack)) {
                    resultFonts.push({
                        name: bodyFontName,
                        type: 'body', // Heuristic type
                        stack: fontsInfo.bodyFontStack || ''
                    });
                } else if (!headingFontName && bodyFontName) { // Only body font was found
                     resultFonts.push({
                        name: bodyFontName,
                        type: 'body',
                        stack: fontsInfo.bodyFontStack || ''
                    });
                }
            }

            console.log(`[getKeyFonts] Extracted fonts:`, JSON.stringify(resultFonts));
            return resultFonts; // Return array structure

        } catch (e) {
            console.warn("[getKeyFonts] Error during font extraction:", e.message);
            return []; // Return empty array on error
        }
    };

    // 3d. Extract General Images (e.g., a hero image, more illustrative)
    const getGeneralImages = async (page, baseUrl, existingLogoUrls = {}) => { // Added existingLogoUrls to avoid duplicates
        console.log(`[getGeneralImages] Starting image extraction for ${baseUrl}. Excluding known logos:`, existingLogoUrls);
        let images = await page.evaluate((pageBaseUrl, knownLogoSrcs) => {
            const collectedImages = new Map(); // Use Map to ensure unique src easily

            const resolveImgUrl = (imgSrc) => {
                if (!imgSrc || typeof imgSrc !== 'string') return null;
                try { return new URL(imgSrc, pageBaseUrl).href; }
                catch (e) { console.warn(`Invalid image URL to resolve: ${imgSrc} on base ${pageBaseUrl}`); return null; }
            };

            const addImage = (src, alt, typeHint = 'Page Image') => {
                const resolvedSrc = resolveImgUrl(src);
                if (resolvedSrc && !knownLogoSrcs.includes(resolvedSrc) && !collectedImages.has(resolvedSrc)) {
                    collectedImages.set(resolvedSrc, { src: resolvedSrc, alt: (alt || typeHint).trim() });
                }
            };

            // 1. Prioritize Open Graph images and Twitter card images (if not already used as main logo/banner)
            document.querySelectorAll('meta[property^="og:image"], meta[name^="twitter:image"]').forEach(meta => {
                if (meta.content) {
                    addImage(meta.content, meta.getAttribute('property') || meta.getAttribute('name'), 'Social Preview Image');
                }
            });

            // 2. Look for hero/banner images or significant images in main content areas
            // Enhanced selectors for typical hero/banner sections
            const mainContentSelectors = [
                'header img[src]', // Image directly in header (might be a banner)
                'main img[src]',    // Images within main content
                'article img[src]',
                'section[role="banner"] img[src]', 'section[class*="banner"i] img[src]', // Banner sections
                'figure img[src]', // Images within figure tags
                '.hero img[src]', '.hero-image img[src]', '[class*="hero"i] img[src]', // Common hero classes
                '.carousel img[src]', '.slider img[src]', // Images in carousels/sliders
                'div[data-hero] img[src]'
            ];

            for (const contentSelector of mainContentSelectors) {
                if (collectedImages.size >= 3) break; // Reduced from 5 to 3 for faster processing
                try {
                    const imgElements = Array.from(document.querySelectorAll(contentSelector));
                    for (const img of imgElements) {
                        if (collectedImages.size >= 3) break; // Reduced from 5 to 3
                        const imgSrc = img.getAttribute('src'); // Get attribute directly to resolve later
                        if (!imgSrc) continue;

                        const width = img.naturalWidth || parseInt(img.getAttribute('width') || '0', 10);
                        const height = img.naturalHeight || parseInt(img.getAttribute('height') || '0', 10);

                        // Filter for significant images:
                        // - Not too small (e.g., larger than 200px in one dimension, or area > 30000px)
                        // - Aspect ratio not extremely skewed (e.g., not a very thin line, unless very long)
                        const area = width * height;
                        const isSignificantSize = (width > 200 || height > 200) || (area > 30000);
                        const isNotASpacer = (width > 1 && height > 1); // Avoid 1x1 tracking pixels
                        // Avoid very narrow/short images unless they are very long/wide (potential banners)
                        const reasonableAspectRatio = (width > 0 && height > 0) ?
                                                    (Math.max(width,height) / Math.min(width,height) < 10) || (width > 400 || height > 400)
                                                    : false;

                        if (isSignificantSize && isNotASpacer && reasonableAspectRatio) {
                            addImage(imgSrc, img.alt, 'Content Image');
                        }
                    }
                } catch (e) { console.warn(`Error with selector ${contentSelector} in getGeneralImages: ${e.message}`); }
            }

            // Convert Map values to Array
            return Array.from(collectedImages.values());
        }, baseUrl, [existingLogoUrls.Logo, existingLogoUrls.Icon, existingLogoUrls.Banner].filter(Boolean));

        // Limit to max 2-3 images for faster processing
        return (images || []).slice(0, 2); // Reduced from 4 to 2
    };

    // 3e. Extract Company Information (Name, Description, etc.)
    const getCompanyInfo = async (page, inputUrl) => { // Added page argument
        let name = await getMetaContent(page, ['meta[property="og:site_name"]', 'meta[name="application-name"]', 'meta[name="twitter:title"]', 'meta[itemprop="name"]']);
        if (!name) name = await getTextFromSelectors(page, ['title']);

        let description = await getMetaContent(page, ['meta[property="og:description"]', 'meta[name="description"]', 'meta[name="twitter:description"]', 'meta[itemprop="description"]']);

        let website = await getMetaContent(page, ['meta[property="og:url"]']);
        if(!website) website = await getAttributeFromSelectors(page, ['link[rel="canonical"]'], 'href');
        website = resolveUrl(website, inputUrl) || inputUrl;


        let industry = null, location = null, founded = null, companyType = null, employees = null;
        let keywords = [];

        try {
            const jsonLdData = await page.evaluate(() => {
                const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                const allJson = [];
                scripts.forEach(script => {
                    try { allJson.push(JSON.parse(script.textContent || '{}')); }
                    catch (e) { console.warn("Error parsing individual JSON-LD script:", e.message); }
                });
                return allJson;
            });

            const processJsonLdObject = (obj) => {
                if (!obj || typeof obj !== 'object') return;

                const type = obj['@type'];
                const isOrg = type === 'Organization' || type === 'Corporation' || (Array.isArray(type) && (type.includes('Organization') || type.includes('Corporation')));

                if (isOrg) {
                    if (!name && obj.name) name = typeof obj.name === 'string' ? obj.name.trim() : String(obj.name).trim();
                    if (!description && obj.description) description = String(obj.description).trim();
                    if (!description && obj.disambiguatingDescription) description = String(obj.disambiguatingDescription).trim();

                    if (!industry && obj.industry) {
                        industry = Array.isArray(obj.industry) ? obj.industry.map(String).join(', ') : String(obj.industry);
                    }

                    if (!location && obj.address) {
                        const addr = obj.address;
                        let locParts = [];
                        if (addr.streetAddress) locParts.push(addr.streetAddress);
                        if (addr.addressLocality) locParts.push(addr.addressLocality);
                        if (addr.addressRegion) locParts.push(addr.addressRegion);
                        if (addr.postalCode) locParts.push(addr.postalCode);
                        if (addr.addressCountry) locParts.push(typeof addr.addressCountry === 'string' ? addr.addressCountry : addr.addressCountry.name);
                        if (locParts.length > 0) location = locParts.join(', ');
                        else if (typeof addr === 'string') location = addr;
                    }
                     if (!location && obj.location?.address) { // Nested location
                        const addr = obj.location.address;
                        let locParts = [];
                        if (addr.streetAddress) locParts.push(addr.streetAddress);
                        if (addr.addressLocality) locParts.push(addr.addressLocality);
                        // ... (similar address parsing as above)
                        if (locParts.length > 0) location = locParts.join(', ');
                        else if (typeof addr === 'string') location = addr;
                    }


                    if (!founded && obj.foundingDate) founded = String(obj.foundingDate);

                    if (!employees && obj.numberOfEmployees) {
                        const emp = obj.numberOfEmployees;
                        if (emp.value) employees = String(emp.value);
                        else if (emp.minValue && emp.maxValue) employees = `${emp.minValue}-${emp.maxValue}`;
                        else if (typeof emp === 'string' || typeof emp === 'number') employees = String(emp);
                    }
                    if (!website && obj.url && typeof obj.url === 'string' && obj.url.startsWith('http')) website = obj.url;
                    if (obj.keywords) {
                        const kw = typeof obj.keywords === 'string' ? obj.keywords.split(',') : (Array.isArray(obj.keywords) ? obj.keywords : []);
                        keywords.push(...kw.map(k => String(k).trim()));
                    }
                    if (obj.knowsAbout) {
                         const ka = Array.isArray(obj.knowsAbout) ? obj.knowsAbout : [obj.knowsAbout];
                         ka.forEach(item => {
                             if(typeof item === 'string') keywords.push(item.trim());
                             else if (item && item.name && typeof item.name === 'string') keywords.push(item.name.trim());
                         });
                    }
                }
                // Recursively search in properties if it's an object or array
                Object.values(obj).forEach(value => {
                    if (typeof value === 'object' || Array.isArray(value)) {
                        processJsonLdObject(value);
                    }
                });
            };

            if (Array.isArray(jsonLdData)) {
                jsonLdData.forEach(processJsonLdObject);
            } else if (typeof jsonLdData === 'object') {
                processJsonLdObject(jsonLdData);
            }

        } catch(e) {
            console.warn("Error processing JSON-LD for company info:", e.message);
        }

        // Fallback for name if still not found
        if (!name) name = await getTextFromSelectors(page, ['h1', '.site-title', 'header [class*="title"]', 'meta[name="title"]']);
        // Fallback for description
        if (!description) description = await getMetaContent(page, ['meta[name="abstract"]', 'meta[name="subject"]']);

        if (keywords.length > 0 && !industry) { // Use keywords as a fallback for industry
            industry = [...new Set(keywords)].slice(0, 3).join(', '); // Take unique keywords, up to 3
        }


        return {
            Name: name ? name.substring(0, 255) : null, // Max length
            Description: description ? description.substring(0, 1000) : null, // Max length
            Industry: industry, Location: location,
            Founded: founded, CompanyType: companyType, Employees: employees, Website: website
        };
    };

    // 3f. Extract Social Media Links
    const getSocialLinks = async (page, baseUrl) => { // Added page, baseUrl arguments
        let links = await page.evaluate((pageBaseUrl) => { // Renamed for clarity
            const foundLinks = {};
            const socialSelectors = { // More comprehensive selectors
                Twitter: [
                    'a[href*="twitter.com/"][href*="intent/"]', // Less likely to be the main profile
                    'a[href*="twitter.com/"]',
                    'a[aria-label*="Twitter"i]',
                    'meta[property="og:see_also"][content*="twitter.com"]',
                    'meta[name="twitter:site"]' // Content is often @handle
                ],
                LinkedIn: [
                    'a[href*="linkedin.com/company/"]', 'a[href*="linkedin.com/school/"]', 'a[href*="linkedin.com/showcase/"]', 'a[href*="linkedin.com/in/"]',
                    'a[aria-label*="LinkedIn"i]',
                    'meta[property="og:see_also"][content*="linkedin.com"]'
                ],
                Facebook: [
                    'a[href*="facebook.com/"]', 'a[href*="fb.me/"]',
                    'a[aria-label*="Facebook"i]',
                    'meta[property="og:see_also"][content*="facebook.com"]'
                ],
                YouTube: [
                    'a[href*="youtube.com/channel/"]', 'a[href*="youtube.com/user/"]', 'a[href*="youtube.com/c/"]',
                    'a[aria-label*="YouTube"i]',
                    'meta[property="og:see_also"][content*="youtube.com"]'
                ],
                Instagram: [
                    'a[href*="instagram.com/"]',
                    'a[aria-label*="Instagram"i]',
                    'meta[property="og:see_also"][content*="instagram.com"]'
                ],
            };

            const resolveSocialUrl = (link, platform) => {
                if (!link) return null;
                if (platform === 'Twitter' && link.startsWith('@')) {
                    return `https://twitter.com/${link.substring(1)}`;
                }
                try { return new URL(link, pageBaseUrl).href; }
                catch (e) { return null; }
            };

            for (const [socialName, selectors] of Object.entries(socialSelectors)) {
                if (foundLinks[socialName]) continue; // Already found a good one

                for (const selector of selectors) {
                    try {
                        if (selector.startsWith('meta[')) { // Handle meta tags
                            const metaElement = document.querySelector(selector);
                            if (metaElement && metaElement.content) {
                                const resolved = resolveSocialUrl(metaElement.content, socialName);
                                if (resolved) { foundLinks[socialName] = resolved; break; }
                            }
                        } else { // Handle anchor tags
                            const elements = Array.from(document.querySelectorAll(selector));
                            for (const el of elements) {
                                const href = el.href;
                                // Basic filter to avoid share links, mailto, etc.
                                if (href && !href.startsWith('mailto:') && !href.includes('share') && !href.includes('intent')) {
                                     const resolved = resolveSocialUrl(href, socialName);
                                     if (resolved) {foundLinks[socialName] = resolved; break;}
                                }
                            }
                        }
                    } catch (e) { /* ignore selector errors */ }
                    if (foundLinks[socialName]) break;
                }
            }
            return foundLinks;
        }, baseUrl);

        return links || {};
    };

    // Execute logo details first as its output is needed by getGeneralImages
    const logoData = await getLogoDetails(page, url);
    let colorAnalysis ={};
    let logoColors = {};
    let bannerColors = {};
    // Execute remaining extraction functions in parallel with timeout for each
    console.log('[Extraction] Starting parallel data extraction...');
    const [colorData, fontData, imageData, companyInfoData, socialLinkData] = await Promise.all([
        Promise.race([
            getBrandColors(page),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Color extraction timeout')), 30000))
        ]).catch(err => { console.warn('[Colors] Extraction failed:', err.message); return []; }),
        
        Promise.race([
            getKeyFonts(page),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Font extraction timeout')), 15000))
        ]).catch(err => { console.warn('[Fonts] Extraction failed:', err.message); return []; }),
        
        Promise.race([
            getGeneralImages(page, url, logoData),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Image extraction timeout')), 20000))
        ]).catch(err => { console.warn('[Images] Extraction failed:', err.message); return []; }),
        
        Promise.race([
            getCompanyInfo(page, url),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Company info extraction timeout')), 25000))
        ]).catch(err => { console.warn('[Company Info] Extraction failed:', err.message); return {}; }),
        
        Promise.race([
            getSocialLinks(page, url),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Social links extraction timeout')), 15000))
        ]).catch(err => { console.warn('[Social Links] Extraction failed:', err.message); return {}; })
    ]);
    console.log('[Extraction] Parallel data extraction completed');
colorAnalysis = colorData; // Use the colorData directly, no need to merge with logo colors
    let finalCompanyInfo = { ...companyInfoData, SocialLinks: socialLinkData };

    // Smart LinkedIn data extraction - run in parallel with main extraction, with timeout
    let linkedInDataPromise = null;
    let linkedInData = null;
    if (socialLinkData && socialLinkData.LinkedIn) {
        const linkedInUrl = socialLinkData.LinkedIn;
        // Basic validation for a LinkedIn company URL structure
        if (linkedInUrl.includes('linkedin.com/company')) {
            console.log(`[extractCompanyDetailsFromPage] Found LinkedIn URL: ${linkedInUrl}. Starting parallel extraction...`);
            
            // Start LinkedIn extraction in parallel with reduced timeout
            await fss.writeFile('urls.txt', linkedInUrl);
            // const newLogicData = scraperLink.main();
            // console.log('[extractCompanyDetailsFromPage] New logic data:', newLogicData);
            linkedInDataPromise = Promise.race([
                // extractCompanyDataFromLinkedIn(linkedInUrl),
                // extraction.scrapeLinkedInCompany(linkedInUrl),
                scraperLink.main(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('LinkedIn extraction timeout after 2 minutes')), 120000) // Reduced from 5 minutes to 2 minutes
                )
            ]).catch(error => {
                console.warn(`[LinkedIn] Extraction failed: ${error.message}`);
                return { error: error.message }; // Return error object instead of throwing
            });
        }
    }

    // If LinkedIn extraction was started, wait for it with a reasonable timeout
    if (linkedInDataPromise) {
        try {
            console.log('[LinkedIn] Waiting for LinkedIn data extraction to complete...');
            // const linkedInData = await linkedInDataPromise;
            // AWAIT this promise to get its resolved value.
        // Execution will pause here until the promise settles.
        linkedInData = await linkedInDataPromise;

            if (linkedInData && !linkedInData.error) {
                console.log("[extractCompanyDetailsFromPage] Merging LinkedIn data:", linkedInData);
                // **FIXED: Correct field mapping from LinkedIn scraper response**
                finalCompanyInfo.Name = linkedInData.name || finalCompanyInfo.Name; // LinkedIn uses lowercase 'name'
                finalCompanyInfo.Description = linkedInData.description || linkedInData.aboutUs || finalCompanyInfo.Description;
                finalCompanyInfo.Industry = linkedInData.industry || finalCompanyInfo.Industry;
                finalCompanyInfo.CompanySize = linkedInData.companySize || linkedInData.employees || finalCompanyInfo.Employees;
                finalCompanyInfo.Location = linkedInData.location || linkedInData.headquarters || finalCompanyInfo.Location;
                finalCompanyInfo.Headquarters = linkedInData.headquarters || linkedInData.location || finalCompanyInfo.Location;
                finalCompanyInfo.Type = linkedInData.type || finalCompanyInfo.CompanyType;
                finalCompanyInfo.Founded = linkedInData.founded || finalCompanyInfo.Founded;
                finalCompanyInfo.Website = linkedInData.website || finalCompanyInfo.Website;
                finalCompanyInfo.Employees = linkedInData.employees || linkedInData.companySize || finalCompanyInfo.Employees;
                
                // **NEW: Add LinkedIn-specific data fields**
                if (linkedInData.specialties && linkedInData.specialties.length > 0) {
                    finalCompanyInfo.Specialties = linkedInData.specialties.filter(s => s && s.trim() !== '');
                }
                if (linkedInData.locations && linkedInData.locations.length > 0) {
                    finalCompanyInfo.Locations = linkedInData.locations.filter(l => l && l.trim() !== '');
                }
                
                // **ENHANCED: Better logging**
                console.log("[LinkedIn] Successfully merged data:");
                console.log("- Name:", finalCompanyInfo.Name);
                console.log("- Description:", finalCompanyInfo.Description ? "✅ Found" : "❌ Missing");
                console.log("- Industry:", finalCompanyInfo.Industry || "❌ Missing");
                console.log("- Founded:", finalCompanyInfo.Founded || "❌ Missing");
                console.log("- Headquarters:", finalCompanyInfo.Headquarters || "❌ Missing");
                // Potentially add LinkedIn banner to Logo object if found and not already present
                if (linkedInData.bannerUrl) {
                    logoData.LinkedInBanner = linkedInData.bannerUrl; // Add as a new property or replace
                    bannerColors = await extractColorsFromImage(logoData.LinkedInBanner);
                    // colorData.LinkedInBannerColors = logoColors; // Store colors for LinkedIn banner
                    console.log("[extractCompanyDetailsFromPage] LinkedIn banner colors extracted:", bannerColors);
                    colorData.LinkedInBannerData = {
                        width: bannerColors.width,
                        height: bannerColors.height,
                        colors: bannerColors.colors // This is the array of hex colors
                    };
                }
                if (linkedInData.logoUrl) {
                    logoData.LinkedInLogo = linkedInData.logoUrl; // Add as a new property or replace
                    logoColors = await extractColorsFromImage(logoData.LinkedInLogo);
                    // colorData.LinkedInLogoColors = logoColors; // Store colors for LinkedIn logo
                    console.log("[extractCompanyDetailsFromPage] LinkedIn logo colors extracted:", logoColors);
                     colorData.LinkedInLogoData = {
                        width: logoColors.width,
                        height: logoColors.height,
                        colors: logoColors.colors
                    };
                }
                const colorAnalysis2 = [
                    bannerColors,
                     logoColors
                ]
                colorAnalysis = [...colorData, ...colorAnalysis2];
            } else if (linkedInData && linkedInData.error) {
                console.warn(`[extractCompanyDetailsFromPage] LinkedIn extraction failed: ${linkedInData.error}`);
                finalCompanyInfo.LinkedInError = linkedInData.error; // Add error info for debugging
            }
        } catch (liError) {
            console.error(`[extractCompanyDetailsFromPage] Exception while processing LinkedIn data:`, liError.message);
            finalCompanyInfo.LinkedInError = liError.message;
        }
    }


    const endTime = Date.now();
    const extractionTime = (endTime - startTime) / 1000;
    console.log(`[Performance] Extraction completed in ${extractionTime.toFixed(2)} seconds`);

    return {
        Logo: logoData, 
        Colors: colorAnalysis,  // New field for color analysis
        Fonts: fontData, 
        Images: imageData,
        Company: finalCompanyInfo, // Use the potentially updated finalCompanyInfo
        _performance: {
            extractionTimeSeconds: extractionTime,
            timestamp: new Date().toISOString()
        },
        _message: "Data extracted dynamically. Accuracy may vary based on website structure."
    };
}


// New endpoint for extracting specific company details
app.post('/api/extract-company-details', async (req, res) => {
    const { url } = req.body;
    
    // Check if URL is provided
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required and must be a string' });
    }
    
    const originalUrl = url.trim();
    
    // Check if URL is empty after trimming
    if (!originalUrl) {
        return res.status(400).json({ error: 'URL cannot be empty' });
    }
    
    // Normalize the URL (adds https:// if missing)
    const normalizedUrl = utils.normalizeUrl(originalUrl);
    
    // Check if normalization failed
    if (!normalizedUrl) {
        return res.status(400).json({ 
            error: 'Invalid URL format - unable to normalize',
            provided: originalUrl
        });
    }
    
    // Validate the normalized URL
    if (!utils.isValidUrl(normalizedUrl)) {
        console.log(`[DEBUG] URL validation failed for: "${originalUrl}" -> "${normalizedUrl}"`);
        return res.status(400).json({ 
            error: 'Invalid URL format',
            provided: originalUrl,
            normalized: normalizedUrl
        });
    }

    // Check cache first for performance
    const cacheKey = normalizedUrl.toLowerCase().trim();
    const cachedResult = extractionCache.get(cacheKey);
    if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_DURATION) {
        console.log(`[Cache] Returning cached result for ${url}`);
        return res.status(200).json({
            ...cachedResult.data,
            _cached: true,
            _cacheAge: Math.round((Date.now() - cachedResult.timestamp) / 1000)
        });
    }

    const isResolvable = await utils.isDomainResolvable(normalizedUrl);
    if (!isResolvable) {
        return res.status(400).json({ error: 'Domain name could not be resolved' });
    }

    let browser;
    try {
        const { browser: launchedBrowser, page } = await setupPuppeteerPageForCompanyDetails(normalizedUrl);
        browser = launchedBrowser;

        // Add timeout wrapper for the entire extraction process with smart timeout
        console.log('[Extraction] Starting company details extraction with 4-minute timeout...');
        const companyDetails = await Promise.race([
            extractCompanyDetailsFromPage(page, normalizedUrl, browser),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Company extraction timeout after 4 minutes')), 240000) // Balanced timeout - allows LinkedIn extraction but not too long
            )
        ]);

        // Cache the result for future requests
        extractionCache.set(cacheKey, {
            data: companyDetails,
            timestamp: Date.now()
        });

        // Clean old cache entries periodically
        if (extractionCache.size > 100) { // Limit cache size
            const oldestEntries = Array.from(extractionCache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)
                .slice(0, 20); // Remove oldest 20 entries
            
            oldestEntries.forEach(([key]) => extractionCache.delete(key));
        }

        res.status(200).json(companyDetails);

    } catch (error) {
        console.error(`[Error extracting company details for URL: ${normalizedUrl}]`, error);
        // Basic error handling, will be refined
        let errorMessage = 'Failed to extract company details. An unexpected error occurred.';
        let statusCode = 500;

        if (error.name === 'TimeoutError') {
            errorMessage = 'The extraction timed out. The page might be too complex or unresponsive.';
            statusCode = 504; // Gateway Timeout
        }
        // Add more specific error handling as developed

        res.status(statusCode).json({ error: errorMessage, details: error.message });
    } finally {
        if (browser) {
            try {
                await browser.close(); // Ensure browser is closed
                console.log('[Browser] Browser closed successfully');
            } catch (closeError) {
                console.error('[Browser] Error closing browser:', closeError.message);
            }
        }
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
    }
});
