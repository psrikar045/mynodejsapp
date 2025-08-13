const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const { createWriteStream } = require('fs');
const { antiBotSystem } = require('./anti-bot-system');
const { performanceMonitor } = require('./performance-monitor');
const { enhancedFileOps } = require('./enhanced-file-operations');
const { extractionLogger } = require('./extraction-logger');
const { detailedFileLogger } = require('./detailed-file-logger');

// --- Logger Setup ---
const LOG_FILE = 'scraper.log';
let logger;
try {
  logger = createWriteStream(LOG_FILE, { flags: 'a' });
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  console.log = (message) => {
    logger.write(`${new Date().toISOString()} - INFO: ${message}\n`);
    originalConsoleLog(message);
  };

  console.warn = (message) => {
    logger.write(`${new Date().toISOString()} - WARN: ${message}\n`);
    originalConsoleWarn(message);
  };

  console.error = (message, error) => {
    const errorMessage = error ? `: ${error.stack || error}` : '';
    logger.write(`${new Date().toISOString()} - ERROR: ${message}${errorMessage}\n`);
    originalConsoleError(`${message}${errorMessage}`);
  };

} catch (err) {
  console.error("Failed to initialize logger:", err);
}

// Dynamic user agent function
function getUserAgent() {
    return antiBotSystem.getRandomUserAgent();
}

// --- Robots.txt check (overridden as requested) ---
async function isScrapingAllowed(url) {
  return true;
}

// --- Utility Delay Function ---
function delay(time) {
  return new Promise(function(resolve) {
      setTimeout(resolve, time)
  });
}

/**
 * Attempts to extract the banner image URL using Cheerio from the provided HTML.
 * This function focuses on 'src' attributes of <img> tags.
 * It cannot read CSS background-image properties.
 * @param {object} $ - The Cheerio loaded object for the page's HTML.
 * @returns {string|null} The banner image URL, or null if not found.
 */
const getImageFromBannerCheerio = ($) => {
  const selectors = [
    // Priority 1: Specific IMG tags
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

    // Priority 2: IMG tags within known banner/cover containers
    { selector: 'div.cover-photo img', type: 'src' },
    { selector: 'div.banner img', type: 'src' },
    { selector: 'figure[class*="banner"] img', type: 'src' },
    { selector: 'figure[class*="cover"] img', type: 'src' },

    // Fallback/Generic IMG selectors if others fail, keeping them last
    { selector: '.org-top-card-primary-content__banner-container img', type: 'src' },
    { selector: 'img[src*="cover"]', type: 'src' },
    { selector: 'img[src*="banner"]', type: 'src' },
  ];

  for (const item of selectors) {
    const element = $(item.selector);
    if (element.length > 0) {
      if (item.type === 'src') {
        const src = element.first().attr('src');
        if (src) {
          if (src.startsWith('http') || src.startsWith('//')) {
            return src;
          } else if (src.startsWith('data:image')) {
            // console.log(`[LinkedIn Scrape - getImageFromBannerCheerio] Found data URI src, skipping: via ${item.selector}`);
          }
        }
      }
    }
  }
  return null;
};


/**
 * Scrapes a single LinkedIn company profile URL and returns structured data.
 * This function is designed to be called individually for each URL.
 * It manages its own browser and page instances for isolation and robustness.
 * @param {string} url - The LinkedIn company profile URL to scrape.
 * @returns {Promise<object>} - A promise that resolves to an object containing scraped company data or an error status.
 */
async function scrapeLinkedInCompany(url, sessionId = null) {
  let browser;
  let page;

  try {
    if (sessionId) {
      extractionLogger.step('LinkedIn Scraping Starting', { url }, sessionId);
    }
    
    if (!await isScrapingAllowed(url)) {
      console.warn(`Scraping disallowed by robots.txt for ${url}. Skipping.`);
      if (sessionId) {
        extractionLogger.warn('Scraping disallowed by robots.txt', { url }, sessionId);
      }
      return { url, status: 'Skipped', error: 'Scraping disallowed by robots.txt' };
    }

    console.log(`Launching browser for ${url}...`);
    if (sessionId) {
      extractionLogger.step('LinkedIn Browser Launch', { url }, sessionId);
    }
    const timer = performanceMonitor.startTimer('browser_launch');
    
    // Enhanced browser launch with anti-bot features
    const launchOptions = {
        headless: 'new',
        args: antiBotSystem.getAdvancedBrowserArgs(),
        defaultViewport: antiBotSystem.getRandomViewport(),
        ignoreDefaultArgs: ['--enable-automation'],
        ignoreHTTPSErrors: true
    };
    
    browser = await puppeteer.launch(launchOptions);
    performanceMonitor.endTimer(timer, true);
    
    page = await browser.newPage();
    
    // Advanced anti-detection setup
    await antiBotSystem.setupStealthMode(page);
    await page.setUserAgent(getUserAgent());
    await page.setExtraHTTPHeaders(antiBotSystem.getBrowserHeaders());
    await page.setBypassCSP(true);
    
    performanceMonitor.recordAntiBotEvent('stealth_activation', { context: 'extraction', url });

    console.log(`Navigating to ${url}...`);
    const navTimer = performanceMonitor.startTimer('navigation');
    
    let retries = 3;
    while (retries > 0) {
      try {
        // Human-like delay before navigation
        await antiBotSystem.humanDelay(1000, 3000);
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Simulate human behavior after successful navigation
        await antiBotSystem.simulateHumanBehavior(page, {
            enableMouseMovement: true,
            enableScrolling: true
        });
        
        performanceMonitor.endTimer(navTimer, true, { url, attempts: 4 - retries });
        break;
      } catch (error) {
        console.warn(`Error loading page, retrying... (${retries} retries left) for ${url}`);
        retries--;
        if (retries === 0) {
          performanceMonitor.recordError('navigation', error, { url, totalAttempts: 3 });
          performanceMonitor.endTimer(navTimer, false, { url, error: error.message });
          throw new Error(`Failed to load page after multiple retries for ${url}: ${error.message}`);
        }
        
        // Progressive delay with jitter and user agent rotation
        await delay(Math.random() * 2000 + 1000);
        await page.setUserAgent(getUserAgent(true)); // Rotate on retry
      }
    }
    
    // Human-like pause after navigation
    await antiBotSystem.humanDelay(2000, 5000);

    // --- JSON-LD Extraction (Priority) ---
    let jsonData = {};
    try {
      const jsonLdElements = await page.$$eval('script[type="application/ld+json"]', scripts => {
        return scripts.map(script => {
          try {
            return JSON.parse(script.textContent);
          } catch (e) {
            console.error("Failed to parse JSON-LD script:", e);
            return null;
          }
        }).filter(Boolean);
      });

      for (const parsedJson of jsonLdElements) {
        if (parsedJson['@type'] === 'Organization' || parsedJson.description || parsedJson.foundingDate || parsedJson.address) {
          jsonData = { ...jsonData, ...parsedJson };
        }
      }
      if (Object.keys(jsonData).length > 0) {
        console.log('Extracted some data from JSON-LD.');
      }
    } catch (error) {
      console.warn(`Error processing JSON-LD for ${url}: ${error.message}`);
    }

    // --- Get HTML Content for Cheerio Parsing (still useful for banner if needed) ---
    const content = await page.content();
    const $ = cheerio.load(content);

    const companyData = {
      url,
      status: 'Success',
      companyLogo: jsonData.logo || (await page.waitForSelector('.org-top-card-primary-content__logo-container img', {timeout: 3000}).then(el => page.$eval('.org-top-card-primary-content__logo-container img', img => img.src)).catch(() => '')),
      bannerImage: jsonData.image ? (typeof jsonData.image === 'string' ? jsonData.image : jsonData.image.contentUrl) : getImageFromBannerCheerio($),
      website: jsonData.url || (await page.waitForSelector('dt:contains("Website") + dd a', {timeout: 3000}).then(el => page.$eval('dt:contains("Website") + dd a', a => a.href)).catch(() => '')),
      verifiedPage: (await page.waitForSelector('.org-page-verified-badge', {timeout: 3000}).then(() => true).catch(() => false)),

      // Initialize these to null, they will be populated from description if not found in JSON-LD
      industry: null,
      type: null, // CompanyType mapping
      companySize: null,
      employees: null, // Employees mapping
      headquarters: null,
      location: null, // Duplicate of headquarters
      specialties: [],

      aboutUs: jsonData.description || '',
      description : jsonData.description || '',
      founded: jsonData.foundingDate || '',
      locations: [],
    };


    // --- HTML Fallback for aboutUs, founded, locations ---
    if (!companyData.aboutUs) {
      console.log('AboutUs not found in JSON-LD. Attempting HTML extraction...');
      try {
        const aboutTabSelector = 'a[data-control-name="about_tab"], button[data-control-name="about_tab"], a[href*="/about/"], a[aria-label*="About tab"]';
        const aboutTab = await page.waitForSelector(aboutTabSelector, { timeout: 5000 }).catch(() => null);

        if (aboutTab) {
          console.log('Found "About" tab. Simulating human click...');
          const boundingBox = await aboutTab.boundingBox();
          if (boundingBox) {
            const x = boundingBox.x + boundingBox.width / 2 + (Math.random() - 0.5) * 5;
            const y = boundingBox.y + boundingBox.height / 2 + (Math.random() - 0.5) * 5;
            await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 3 });
            await delay(Math.random() * 200 + 100);
            await page.mouse.click(x, y);
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => console.log('No full navigation after About tab click.'));
            await delay(Math.random() * 1000 + 500);
          }
        } else {
          console.log('Could not find a clear "About" tab. Proceeding with content scrape...');
        }

        const showMoreDescSelector = 'button.show-more-less-button[aria-expanded="false"], button.truncate-text-button[aria-expanded="false"], button[aria-label*="Show more"]';
        const showMoreDescButton = await page.waitForSelector(showMoreDescSelector, { timeout: 3000 }).catch(() => null);
        if (showMoreDescButton) {
          console.log('Found "Show more" button for description. Simulating human click...');
          const boundingBox = await showMoreDescButton.boundingBox();
          if (boundingBox) {
            const x = boundingBox.x + boundingBox.width / 2 + (Math.random() - 0.5) * 5;
            const y = boundingBox.y + boundingBox.height / 2 + (Math.random() - 0.5) * 5;
            await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 3 });
            await delay(Math.random() * 200 + 100);
            await page.mouse.click(x, y);
            await delay(Math.random() * 1000 + 500);
          }
        } else {
          console.log('No "Show more" button found for description or already expanded.');
        }

        companyData.aboutUs = await page.evaluate(() => {
          const overviewHeader = Array.from(document.querySelectorAll('h2, h3, span'))
            .find(el => el.textContent.trim().toLowerCase().includes('overview') || el.textContent.trim().toLowerCase().includes('about us') || el.textContent.trim().toLowerCase().includes('about the company'));

          if (overviewHeader) {
            let nextElement = overviewHeader.nextElementSibling;
            while (nextElement) {
              const potentialDesc = nextElement.querySelector('p.break-words.white-space-pre-wrap, p[class*="text-body-medium"]');
              if (potentialDesc && potentialDesc.textContent.trim().length > 50) {
                return potentialDesc.textContent.trim();
              }
              if (nextElement.tagName === 'DIV' && nextElement.textContent.trim().length > 50) {
                 return nextElement.textContent.trim();
              }
              nextElement = nextElement.nextElementSibling;
            }
          }
          const genericDesc = document.querySelector('p.break-words.white-space-pre-wrap, p[class*="text-body-medium"]');
          if (genericDesc && genericDesc.textContent.trim().length > 50) {
            return genericDesc.textContent.trim();
          }
          return '';
        }).catch(err => { console.error('Error in evaluate for aboutUs:', err); return ''; });

        if (companyData.aboutUs) {
            companyData.description = companyData.aboutUs;
            console.log('Successfully extracted "aboutUs" from HTML.');

            // --- Post-process description to extract fields ---
            const descriptionText = companyData.description;

            // Extract Industry
            const industryMatch = descriptionText.match(/Industry\s+(.*?)(?:\s+Company size|\s+Headquarters|\s+Type|\s+Founded|\s+Specialties|$)/i);
            if (industryMatch && industryMatch[1]) {
                companyData.industry = industryMatch[1].trim();
            }

            // Extract Company Size / Employees
            const companySizeMatch = descriptionText.match(/Company size\s+([\d,-]+\s+employees)/i);
            if (companySizeMatch && companySizeMatch[1]) {
                companyData.companySize = companySizeMatch[1].trim();
                // You can parse companyData.companySize to populate companyData.employees if needed
                companyData.employees = companyData.companySize; // Mapping for 'Employees' as per your output
            }

            // Extract Headquarters
            const headquartersMatch = descriptionText.match(/Headquarters\s+(.*?)(?:\s+Type|\s+Founded|\s+Specialties|$)/i);
            if (headquartersMatch && headquartersMatch[1]) {
                companyData.headquarters = headquartersMatch[1].trim();
                companyData.location = companyData.headquarters; // Mapping for 'Location' as per your output
            }

            // Extract Type
            const typeMatch = descriptionText.match(/Type\s+(.*?)(?:\s+Founded|\s+Specialties|$)/i);
            if (typeMatch && typeMatch[1]) {
                companyData.type = typeMatch[1].trim();
                // companyData.companyType = companyData.type; // Mapping for 'CompanyType' if needed
            }

            // Extract Specialties
            const specialtiesMatch = descriptionText.match(/Specialties\s+(.*)/i);
            if (specialtiesMatch && specialtiesMatch[1]) {
                // Split by ", and" or just "," and clean up
                companyData.specialties = specialtiesMatch[1].split(/,\s*and\s*|,/).map(s => s.trim()).filter(Boolean);
            }

        } else {
          console.log('Could not extract "aboutUs" from HTML using HTML selectors.');
        }
      } catch (error) {
        console.error('Error during HTML scraping of "aboutUs":', error);
      }
    }


    if (!companyData.founded) {
      console.log('Founded not found in JSON-LD. Attempting HTML extraction...');
      try {
        companyData.founded = await page.evaluate(() => {
          const foundedLabel = Array.from(document.querySelectorAll('dt, span, li'))
            .find(el => el.textContent.trim().toLowerCase().includes('founded'));
          if (foundedLabel) {
            if (foundedLabel.tagName === 'DT' && foundedLabel.nextElementSibling) {
                return foundedLabel.nextElementSibling.textContent.trim();
            } else if (foundedLabel.tagName === 'SPAN' && foundedLabel.nextElementSibling) {
                return foundedLabel.nextElementSibling.textContent.trim();
            } else if (foundedLabel.tagName === 'LI') {
                return foundedLabel.textContent.trim().replace(/founded[:-\s]*/i, '').trim();
            }
          }
          const aboutSection = document.querySelector('section[data-test-id*="about-us-module"]');
          if (aboutSection) {
            const aboutSectionText = aboutSection.innerText;
            const regexFounded = /(?:Founded|Established)\s*:\s*(\b(?:\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{4}|\d{4})\b)/i;
            const match = aboutSectionText.match(regexFounded);
            if (match && match[1]) {
              return match[1];
            }
          }
          return '';
        }).catch(err => { console.error('Error in evaluate for founded:', err); return ''; });

        if (companyData.founded) {
            const yearMatch = companyData.founded.match(/\b\d{4}\b/);
            const fullDateMatch = companyData.founded.match(/\b(?:\d{1,2}\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}\b/i);
            if (fullDateMatch) {
                companyData.founded = fullDateMatch[0];
            } else if (yearMatch) {
                companyData.founded = yearMatch[0];
            }
          console.log('Successfully extracted "founded" from HTML.');
        } else {
          console.log('Could not extract "founded" from HTML.');
        }
      } catch (error) {
        console.error('Error during HTML scraping of "founded":', error);
      }
    }

    if (companyData.locations.length === 0) {
      console.log('Locations not found in JSON-LD. Attempting HTML extraction...');
      try {
        const showAllLocationsSelector = 'button.org-company-location-card__show-all-button, button[aria-label*="Show all locations"]';
        const showAllLocationsButton = await page.waitForSelector(showAllLocationsSelector, { timeout: 3000 }).catch(() => null);

        if (showAllLocationsButton) {
          console.log('Found "Show all locations" button. Simulating human click...');
          const boundingBox = await showAllLocationsButton.boundingBox();
          if (boundingBox) {
            const x = boundingBox.x + boundingBox.width / 2 + (Math.random() - 0.5) * 5;
            const y = boundingBox.y + boundingBox.height / 2 + (Math.random() - 0.5) * 5;
            await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 3 });
            await delay(Math.random() * 200 + 100);
            await page.mouse.click(x, y);
            await delay(Math.random() * 1500 + 1000);
          }
        } else {
          console.log('No "Show all locations" button found or already expanded.');
        }

        companyData.locations = await page.evaluate(() => {
          const locations = [];
          const locationsHeader = Array.from(document.querySelectorAll('h2, h3, span'))
            .find(el => el.textContent.trim().toLowerCase().includes('locations'));

          if (locationsHeader) {
            let parentContainer = locationsHeader.closest('div[class*="artdeco-card"], section');
            if (parentContainer) {
              const locationElements = parentContainer.querySelectorAll('address, p[class*="text-body-small"], li[class*="org-company-location-card__location-entry"], div[class*="org-company-location-card__location-entry-point"]');
              locationElements.forEach(el => {
                const text = el.textContent.trim();
                if (text && text.length > 10 && text.split(',').length >= 2) {
                  locations.push(text.replace(/\s{2,}/g, ' ').trim());
                }
              });
            }
          }
          return locations.filter(Boolean);
        }).catch(err => { console.error('Error in evaluate for locations:', err); return []; });

        if (companyData.locations.length > 0) {
          console.log('Successfully extracted "locations" from HTML.');
        } else {
          console.log('Could not extract "locations" from HTML.');
        }
      } catch (error) {
        console.error('Error during HTML scraping of "locations":', error);
      }
    }

    console.log(`Finished scraping ${url}`);
    return companyData;

  } catch (error) {
    console.error(`Fatal error scraping ${url}:`, error);
    return { url, status: 'Failed', error: error.message };
  } finally {
    if (page) {
      await page.close();
      console.log(`Closed page for ${url}`);
    }
    if (browser) {
      await browser.close();
      console.log(`Closed browser for ${url}`);
    }
  }
}

module.exports = {scrapeLinkedInCompany};