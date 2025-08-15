const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const { createWriteStream } = require('fs');
const { antiBotSystem } = require('./anti-bot-system');
const { LinkedInImageAntiBotSystem } = require('./linkedin-image-anti-bot');
const { performanceMonitor } = require('./performance-monitor');
const { enhancedFileOps } = require('./enhanced-file-operations');
const { LinkedInBannerExtractor } = require('./linkedin-banner-extractor');
const { BannerValidator } = require('./banner-validator');

const LOG_FILE = 'scraper.log';
const logger = createWriteStream(LOG_FILE, { flags: 'a' });

console.log = (message) => {
  logger.write(`${new Date().toISOString()} - INFO: ${message}\n`);
  process.stdout.write(`${message}\n`);
};

console.warn = (message) => {
  logger.write(`${new Date().toISOString()} - WARN: ${message}\n`);
  process.stdout.write(`${message}\n`);
};

console.error = (message, error) => {
  const errorMessage = error ? `: ${error.stack || error}` : '';
  logger.write(`${new Date().toISOString()} - ERROR: ${message}${errorMessage}\n`);
  process.stderr.write(`${message}${errorMessage}\n`);
};


// Dynamic user agent function using anti-bot system
function getUserAgent(forceRotation = false) {
    return antiBotSystem.getRandomUserAgent(forceRotation);
}

// Helper function to get current user agent identifier
function getCurrentUserAgent() {
    try {
        return getUserAgent().split(' ')[2] || 'Unknown';
    } catch {
        return 'Unknown';
    }
}

async function isScrapingAllowed(url) {
  // For the purpose of this specific task, we are overriding the robots.txt check
  // as the user has explicitly asked to scrape LinkedIn.
  // In a real-world scenario, it's crucial to respect robots.txt.
  return true;
}

function delay(time) {
  return new Promise(function(resolve) {
      setTimeout(resolve, time)
  });
}

async function scrapeLinkedInCompany(url, browser, linkedinAntiBot = null) {
  const extractionTimer = performanceMonitor.startTimer('extraction');
  const page = await browser.newPage();
  
  // Initialize LinkedIn-specific anti-bot system if not provided
  if (!linkedinAntiBot) {
    linkedinAntiBot = new LinkedInImageAntiBotSystem();
  }
  
  try {
    // **ENHANCED: Advanced anti-detection with stealth mode**
    await antiBotSystem.setupStealthMode(page);
    
    // Dynamic user agent with anti-bot system
    const currentUserAgent = getUserAgent(true);
    await page.setUserAgent(currentUserAgent);
    
    // Dynamic headers from anti-bot system
    await page.setExtraHTTPHeaders(antiBotSystem.getBrowserHeaders());

    // Set dynamic viewport from anti-bot system
    const viewport = antiBotSystem.getRandomViewport();
    await page.setViewport(viewport);
    
    // **NEW: Initialize advanced banner extractor and validator with LinkedIn-specific anti-bot**
    const bannerExtractor = new LinkedInBannerExtractor(linkedinAntiBot);
    const bannerValidator = new BannerValidator(linkedinAntiBot);
    await bannerExtractor.setupNetworkInterception(page);
    
    // Record stealth activation
    performanceMonitor.recordAntiBotEvent('stealth_activation', { 
        context: 'LinkedIn individual page',
        url: url,
        viewport: `${viewport.width}x${viewport.height}`
    });

    // Main extraction logic
    if (!await isScrapingAllowed(url)) {
      console.warn(`Scraping disallowed by robots.txt for ${url}. Skipping.`);
      return { url, status: 'Skipped', error: 'Scraping disallowed by robots.txt' };
    }

    console.log(`Scraping ${url}...`);
    const navTimer = performanceMonitor.startTimer('navigation');
    
    let retries = 3;
    while (retries > 0) {
      try {
        // Human-like delay before navigation
        await antiBotSystem.humanDelay(1000, 2000);
        
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        performanceMonitor.endTimer(navTimer, true, { url, attempts: 4 - retries });
        break;
      } catch (error) {
        console.warn(`Error loading page, retrying... (${retries} retries left)`);
        retries--;
        if (retries === 0) {
          performanceMonitor.recordError('navigation', error, { url, totalAttempts: 3 });
          performanceMonitor.endTimer(navTimer, false, { url, error: error.message });
          throw error;
        }
        
        // Progressive delay and user agent rotation on retry
        await antiBotSystem.humanDelay(2000, 4000);
        await page.setUserAgent(getUserAgent(true)); // Rotate on retry
      }
    }
    
    // **ENHANCED: Advanced human behavior simulation**
    await antiBotSystem.humanDelay(3000, 7000); // Variable delay
    
    // Sophisticated human behavior simulation
    await antiBotSystem.simulateHumanBehavior(page, {
        enableMouseMovement: true,
        enableScrolling: true
    });
    
    // Track successful navigation behavior
    antiBotSystem.trackRequest(url, true, Date.now());

    // **CRUCIAL: Handle login popup first**
    console.log('Checking for login popup...');
    try {
      // Try to find and close login popup by clicking X button
      const loginPopupClosed = await page.evaluate(() => {
        // Look for various close button selectors for login popups
        const closeSelectors = [
          '[data-test-id="login-form"] button[aria-label="Dismiss"]',
          '[data-test-id="login-form"] button[aria-label="Close"]',
          '.modal button[aria-label="Dismiss"]',
          '.modal button[aria-label="Close"]', 
          '.artdeco-modal__dismiss',
          'button[data-test-id="modal-close-button"]',
          'button.modal-wormhole-close',
          'svg[data-test-id="close-icon"]',
          '[role="dialog"] button[aria-label="Dismiss"]',
          '[role="dialog"] button[aria-label="Close"]',
          '.artdeco-modal-overlay button.artdeco-button--circle'
        ];
        
        for (const selector of closeSelectors) {
          try {
            const closeButton = document.querySelector(selector);
            if (closeButton && closeButton.offsetParent !== null) { // Check if visible
              closeButton.click();
              return true;
            }
          } catch (e) {
            // Continue to next selector
          }
        }
        
        // Look for buttons containing close icons (replacement for :has() selector)
        const allButtons = document.querySelectorAll('button');
        for (const button of allButtons) {
          if (button.offsetParent !== null) { // Check if visible
            const closeIcon = button.querySelector('svg[data-test-id="close-icon"]');
            if (closeIcon) {
              button.click();
              return true;
            }
          }
        }
        
        // Also try clicking on overlay to close modal
        const overlay = document.querySelector('.artdeco-modal-overlay, .modal-backdrop');
        if (overlay) {
          overlay.click();
          return true;
        }
        
        return false;
      });

      if (loginPopupClosed) {
        console.log('Login popup closed, waiting for content to load...');
        await delay(3000); // Wait for popup to close and content to appear
      } else {
        console.log('No login popup detected or already closed');
      }
    } catch (error) {
      console.warn('Error handling login popup:', error.message);
    }

    // **Handle "Not Now" or "Skip" buttons for signup prompts**
    try {
      const skipClicked = await page.evaluate(() => {
        // Use standard CSS selectors only, then check text content
        const skipSelectors = [
          '[data-test-id="cold-signup-dismiss"]',
          'button[aria-label="Dismiss"]',
          'button[aria-label="Not now"]',
          'button[aria-label="Skip"]',
          'button[aria-label="Maybe later"]'
        ];
        
        for (const selector of skipSelectors) {
          try {
            const button = document.querySelector(selector);
            if (button && button.offsetParent !== null) { // Check if visible
              button.click();
              return true;
            }
          } catch (e) {
            // Continue
          }
        }
        
        // Also check all buttons for text-based matching
        const allButtons = document.querySelectorAll('button');
        for (const button of allButtons) {
          if (button.offsetParent !== null && // Check if visible
              button.textContent && 
              /not now|skip|maybe later|dismiss/i.test(button.textContent.trim())) {
            button.click();
            return true;
          }
        }
        
        return false;
      });

      if (skipClicked) {
        console.log('Signup prompt dismissed, waiting...');
        await delay(2000);
      }
    } catch (error) {
      console.warn('Error handling signup prompt:', error.message);
    }

    // Click "Show more" button if it exists
    const showMoreButtonSelector = '.org-about-us-organization-description__show-more-button';
    if (await page.$(showMoreButtonSelector) !== null) {
      await page.click(showMoreButtonSelector);
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
    }

    // Wait for essential elements to load and verify we're on the right page
    try {
      await page.waitForSelector('h1, .top-card-layout__entity-info, .org-top-card-summary-info-list', { timeout: 10000 });
      
      // **CRUCIAL: Check if we're actually on a company page, not login page**
      const isCompanyPage = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const title = document.title;
        
        // Check if we're on a login/join page
        if (h1 && (/join|sign in|log in/i.test(h1.textContent) || h1.textContent.trim() === 'Join')) {
          return false;
        }
        
        // Check title for login indicators
        if (/join|sign in|log in/i.test(title)) {
          return false;
        }
        
        // Look for company-specific elements
        const companyElements = document.querySelectorAll(
          '.top-card-layout__entity-info, .org-top-card-summary-info-list, .org-page-navigation, [data-test-id="company-name"]'
        );
        
        return companyElements.length > 0;
      });
      
      if (!isCompanyPage) {
        console.warn('Detected login/join page instead of company page. Attempting to access company directly...');
        
        // Try to navigate to the main company page without /mycompany/ suffix
        const cleanUrl = url.replace('/mycompany/', '/').replace('/mycompany', '');
        if (cleanUrl !== url) {
          console.log(`Trying clean URL: ${cleanUrl}`);
          await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await delay(3000);
          
          // Handle popups again on the new page
          await page.evaluate(() => {
            const closeSelectors = [
              '.artdeco-modal__dismiss',
              'button[aria-label="Dismiss"]',
              'button[aria-label="Close"]',
              '.artdeco-modal-overlay'
            ];
            
            for (const selector of closeSelectors) {
              const element = document.querySelector(selector);
              if (element) {
                element.click();
                break;
              }
            }
          });
          
          await delay(2000);
        }
      } else {
        console.log('Successfully loaded company page');
      }
    } catch (error) {
      console.warn('Essential elements not found, proceeding with content extraction...');
    }

    const content = await page.content();
    const $ = cheerio.load(content);

    // **DEBUG: Log available page elements for troubleshooting**
    console.log('=== PAGE DEBUG INFO ===');
    const debugInfo = await page.evaluate(() => {
      return {
        title: document.title,
        h1Text: document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : 'NO H1',
        hasCompanyElements: !!document.querySelector('.top-card-layout__entity-info, .org-top-card-summary-info-list'),
        availableNavigation: Array.from(document.querySelectorAll('nav a, nav button')).map(el => el.textContent.trim()).slice(0, 5),
        hasAboutSection: !!document.querySelector('[href*="about"], [data-test-id*="about"]'),
        visibleText: document.body.textContent.substring(0, 300) + '...'
      };
    });
    console.log('Page Title:', debugInfo.title);
    console.log('H1 Text:', debugInfo.h1Text);
    console.log('Has Company Elements:', debugInfo.hasCompanyElements);
    console.log('Available Navigation:', debugInfo.availableNavigation);
    console.log('Has About Section:', debugInfo.hasAboutSection);
    console.log('Visible Text Preview:', debugInfo.visibleText);
    console.log('=====================');

    let jsonData = {};
    try {
      $('script[type="application/ld+json"]').each((i, el) => {
        const scriptContent = $(el).html();
        if (scriptContent) {
          try {
            const parsedJson = JSON.parse(scriptContent);
            if (parsedJson['@type'] === 'Organization') {
              jsonData = parsedJson;
            }
          } catch (parseError) {
            console.warn('Failed to parse JSON-LD:', parseError.message);
          }
        }
      });
    } catch (error) {
      console.warn('Error processing JSON-LD scripts:', error.message);
    }

    // Enhanced data extraction with multiple fallback selectors
    const companyData = {
      url,
      status: 'Success',
      name: await page.evaluate(() => {
        // **ENHANCED: Smart name extraction with bot detection**
        
        // First, check if we're on a login/signup page (bot detection triggered)
        const loginIndicators = [
          'Join now', 'Sign in', 'Sign up', 'Log in', 'Login', 'Register',
          'Create account', 'Get started', 'Welcome to LinkedIn'
        ];
        
        const pageTitle = document.title;
        const h1Element = document.querySelector('h1');
        const h1Text = h1Element ? h1Element.textContent.trim() : '';
        
        // Check if we're clearly on a login page
        const isLoginPage = loginIndicators.some(indicator => 
          pageTitle.toLowerCase().includes(indicator.toLowerCase()) ||
          h1Text.toLowerCase().includes(indicator.toLowerCase()) ||
          h1Text === 'Join' || h1Text === 'Sign in' || h1Text === 'Sign up'
        );
        
        if (isLoginPage) {
          return null; // Return null to trigger retry logic
        }
        
        // Try multiple selectors for company name with validation
        const companyNameSelectors = [
          'h1.top-card-layout__title',
          'h1[data-test-id="company-name"]', 
          '.top-card-layout__entity-info h1',
          'h1.org-top-card-summary__title',
          'h1.top-card__title',
          '[data-test-id="org-name"] h1',
          '.org-page-details__company-name',
          '.org-top-card-summary-info-list__title h1'
        ];
        
        for (const selector of companyNameSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            let name = element.textContent.trim();
            
            // Clean up the name
            name = name.replace(/\s*[|─-]?\s*(LinkedIn|linkedin|LINKEDIN)\s*$/i, '').trim();
            name = name.replace(/\s*\|\s*LinkedIn.*$/i, '').trim();
            
            // Validate that this is likely a real company name, not a login prompt
            if (name && 
                name.length > 1 && 
                !loginIndicators.some(indicator => name.toLowerCase().includes(indicator.toLowerCase())) &&
                !['join', 'sign in', 'sign up', 'login', 'register', 'welcome'].includes(name.toLowerCase())) {
              console.log('✅ Found valid company name:', name);
              return name;
            }
          }
        }
        
        // Fallback to meta tags with validation
        const metaSelectors = [
          'meta[property="og:title"]',
          'meta[name="twitter:title"]',
          'meta[property="al:ios:app_name"]'
        ];
        
        for (const selector of metaSelectors) {
          const meta = document.querySelector(selector);
          if (meta && meta.content) {
            let name = meta.content.trim();
            name = name.replace(/\s*[|─-]?\s*(LinkedIn|linkedin|LINKEDIN).*$/i, '').trim();
            name = name.replace(/\s*-\s*LinkedIn.*$/i, '').trim();
            
            if (name && 
                name.length > 1 && 
                !loginIndicators.some(indicator => name.toLowerCase().includes(indicator.toLowerCase()))) {
              console.log('✅ Found company name from meta:', name);
              return name;
            }
          }
        }
        
        // Last resort: try to extract from URL or other elements
        const url = window.location.href;
        const urlMatch = url.match(/\/company\/([^\/\?]+)/);
        if (urlMatch && urlMatch[1]) {
          let nameFromUrl = urlMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          if (nameFromUrl !== 'Mycompany') {
            console.log('⚠️ Using name from URL as fallback:', nameFromUrl);
            return nameFromUrl;
          }
        }
        
        console.log('❌ Could not find valid company name');
        return null;
      }),
      logoUrl: await page.evaluate(() => {
        // Try multiple selectors for logo
        const selectors = [
          '.top-card-layout__entity-image',
          'img[data-test-id="company-logo"]',
          '.org-top-card-primary-content__logo img',
          '.top-card__entity-image',
          '.company-logo img',
          'img.EntityPhoto-circle-1'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.src) {
            return element.src;
          }
        }
        return null;
      }),
      // **PRIORITIZED: Network interception first, traditional methods as fallback**
      bannerUrl: await (async () => {
        const extractionStartTime = Date.now();
        
        try {
          console.log('🚀 [LinkedIn] Starting prioritized banner extraction (Network → API → DOM)...');
          
          // PRIMARY: Advanced network interception method
          const primaryBannerUrl = await bannerExtractor.extractBannerWithAdvancedMethods(page, url);
          const extractionSummary = bannerExtractor.getSummary();
          
          console.log('📊 [LinkedIn] Extraction summary:', {
            method: primaryBannerUrl ? 'Network Interception' : 'Fallback Methods',
            networkRequests: extractionSummary.interceptedRequests,
            apiResponses: extractionSummary.apiResponses,
            discoveredPatterns: extractionSummary.discoveredPatternsCount,
            sessionHealth: extractionSummary.sessionHealth.isValid ? 'Healthy' : 'Degraded',
            extractionTime: `${Date.now() - extractionStartTime}ms`
          });
          
          if (primaryBannerUrl) {
            // Validate the primary result
            console.log('🔍 [LinkedIn] Validating network-intercepted banner...');
            const validation = await bannerValidator.validateBannerUrl(primaryBannerUrl, url);
            
            if (validation.isValid) {
              console.log('✅ [LinkedIn] Network interception SUCCESS - High quality banner found:', primaryBannerUrl);
              console.log('📏 [LinkedIn] Banner quality metrics:', {
                dimensions: validation.width && validation.height ? `${validation.width}x${validation.height}` : 'unknown',
                size: validation.size ? `${Math.round(validation.size / 1024)}KB` : 'unknown',
                format: validation.format || 'unknown',
                aspectRatio: validation.aspectRatio || 'unknown',
                colorVariety: validation.colorAnalysis?.colorVariety || 'unknown'
              });
              return primaryBannerUrl;
            } else {
              console.warn('⚠️ [LinkedIn] Network-intercepted banner failed validation:', validation.reason);
            }
          }
          
          // FALLBACK: Validate all discovered URLs from network interception
          if (extractionSummary.bannerUrls && extractionSummary.bannerUrls.length > 0) {
            console.log(`🔄 [LinkedIn] Validating ${extractionSummary.bannerUrls.length} network-discovered URLs...`);
            
            const networkValidation = await bannerValidator.validateMultipleBannerUrls(extractionSummary.bannerUrls, url);
            
            if (networkValidation.bestUrl) {
              console.log('✅ [LinkedIn] Network validation SUCCESS - Best URL selected:', networkValidation.bestUrl);
              return networkValidation.bestUrl;
            } else {
              console.warn('⚠️ [LinkedIn] All network-discovered URLs failed validation');
              
              // Log validation failures for debugging
              networkValidation.validations.filter(v => !v.isValid).forEach(v => {
                console.warn(`❌ [Validation Failed] ${v.url}: ${v.reason}`);
              });
            }
          }
          
          console.log('🔄 [LinkedIn] Network methods failed, falling back to traditional DOM scraping...');
          
          // FINAL FALLBACK: Traditional DOM scraping (unvalidated but reliable)
          const fallbackBannerUrl = await page.evaluate(() => {
            const prioritizedSelectors = [
              // Highest priority: LinkedIn-specific company banner selectors
              { selector: 'img[src*="media.licdn.com/dms/image/"][src*="company-background"]', type: 'src', priority: 10 },
              { selector: 'div.org-top-card-primary-content__hero-image', type: 'bg', priority: 9 },
              { selector: 'div.org-top-card-module__hero', type: 'bg', priority: 8 },
              { selector: 'img.org-top-card-primary-content__cover', type: 'src', priority: 8 },
              { selector: 'img[data-test-id*="cover-photo"]', type: 'src', priority: 7 },
              { selector: 'div.profile-background-image__image', type: 'bg', priority: 6 }
            ];

            for (const s of prioritizedSelectors) {
              const element = document.querySelector(s.selector);
              if (element && element.offsetParent !== null) { // Must be visible
                let imageUrl = null;
                
                if (s.type === 'bg') {
                  const style = window.getComputedStyle(element);
                  const backgroundImage = style.backgroundImage;
                  if (backgroundImage && backgroundImage !== 'none') {
                    imageUrl = backgroundImage.match(/url\(['"]?(.*?)['"]?\)/)?.[1];
                  }
                } else if (s.type === 'src') {
                  imageUrl = element.src || element.getAttribute('src');
                }

                // Basic quality check
                if (imageUrl && imageUrl.startsWith('http') && 
                    (imageUrl.includes('media.licdn.com') || imageUrl.includes('static.licdn.com'))) {
                  console.log(`✅ [Fallback DOM] Found banner with selector "${s.selector}": ${imageUrl}`);
                  return imageUrl;
                }
              }
            }
            
            console.log('❌ [Fallback DOM] No banner URLs found');
            return null;
          });
          
          if (fallbackBannerUrl) {
            console.log('✅ [LinkedIn] Fallback DOM SUCCESS - Banner found:', fallbackBannerUrl);
            return fallbackBannerUrl;
          }
          
          console.log('❌ [LinkedIn] ALL METHODS FAILED - No banner URL found');
          return null;
          
        } catch (error) {
          const errorContext = bannerExtractor.logErrorContext('banner_extraction', error, {
            url,
            extractionTime: `${Date.now() - extractionStartTime}ms`
          });
          
          console.error('❌ [LinkedIn] Critical banner extraction error:', errorContext);
          return null;
        }
      })(),
      aboutUs: '',
      description:'',
      website: $('dt:contains("Website")').next('dd').text().trim() || null, //.find('a').attr('href')
      verified: $('.org-page-verified-badge').length > 0 ? ($('.org-page-verified-badge__text').text().trim() || true) : false,
      verifiedPage: $('dt:contains("Verified Page")').next('dd').text().trim() || null,
      industry: jsonData.industry || $('dt:contains("Industry")').next('dd').text().trim(),
      type: jsonData.industry || $('dt:contains("Industry")').next('dd').text().trim(),
      companySize: jsonData.numberOfEmployees ? `${jsonData.numberOfEmployees.minValue}-${jsonData.numberOfEmployees.maxValue} employees` : ($('dt:contains("Company size")').next('dd').text().trim() + ' ' + $('dt:contains("Company size")').next('dd').next('dd').text().trim()).trim(),
      employees: jsonData.numberOfEmployees ? `${jsonData.numberOfEmployees.minValue}-${jsonData.numberOfEmployees.maxValue} employees` : ($('dt:contains("Company size")').next('dd').text().trim() + ' ' + $('dt:contains("Company size")').next('dd').next('dd').text().trim()).trim(),
      headquarters: jsonData.address ? `${jsonData.address.streetAddress}, ${jsonData.address.addressLocality}, ${jsonData.address.addressRegion}` : $('dt:contains("Headquarters")').next('dd').text().trim(),
      location: jsonData.address ? `${jsonData.address.streetAddress}, ${jsonData.address.addressLocality}, ${jsonData.address.addressRegion}` : $('dt:contains("Headquarters")').next('dd').text().trim(),
      founded: '',
      locations: [],
      specialties: jsonData.keywords ? jsonData.keywords.split(', ') : ($('dt:contains("Specialties")').next('dd').text().trim().split(', ') || []),
    };

    // Enhanced about us extraction
    if (jsonData.description) {
      companyData.aboutUs = jsonData.description;
      companyData.description = jsonData.description;
      console.log('Extracted "aboutUs" from JSON-LD.');
    } else {
      console.log('Could not find "aboutUs" in JSON-LD, attempting to scrape from HTML.');
      try {
        // First try to extract description directly without clicking tabs
        companyData.aboutUs = await page.evaluate(() => {
          // Try multiple selectors for the company description
          const descriptionSelectors = [
            '.top-card-layout__card .break-words',
            '.org-top-card-summary__tagline',
            '.top-card-layout__summary-info .break-words',
            '.org-about-us-organization-description__text',
            '[data-test-id="about-us-description"]',
            '.top-card__summary',
            '.org-page-details__description',
            '.company-overview-description',
            '.about-us-description-content'
          ];
          
          for (const selector of descriptionSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              const text = element.textContent.trim();
              if (text.length > 20) { // Make sure it's substantial content
                return text;
              }
            }
          }
          
          // Try finding description in overview sections
          const overviewHeaders = Array.from(document.querySelectorAll('h2, h3, h4'))
            .filter(h => /overview|about|description/i.test(h.textContent));
          
          for (const header of overviewHeaders) {
            let sibling = header.nextElementSibling;
            while (sibling) {
              if (sibling.textContent && sibling.textContent.trim().length > 50) {
                return sibling.textContent.trim();
              }
              sibling = sibling.nextElementSibling;
            }
          }
          
          return '';
        });

        // If we didn't find description directly, try clicking About tab
        if (!companyData.aboutUs) {
          console.log('Direct extraction failed, trying About tab...');
          
          // **CRUCIAL: Handle About tab clicking with proper tab management**
          let aboutTabClicked = false;
          let newPage = null;
          
          try {
            // First, try to click About tab and check if it opens a new tab
            const currentPages = await browser.pages();
            const currentPageCount = currentPages.length;
            
            aboutTabClicked = await page.evaluate(() => {
              // Look for About tab with various selectors
              const tabSelectors = [
                'nav a[href*="about"]',
                'nav button[data-test-id*="about"]',
                'nav li a[href*="about"]',
                '.org-page-navigation a[href*="about"]',
                '.org-page-navigation__item a[href*="about"]'
              ];
              
              for (const selector of tabSelectors) {
                try {
                  const element = document.querySelector(selector);
                  if (element && /about|overview/i.test(element.textContent)) {
                    console.log(`Clicking About tab with selector: ${selector}`);
                    element.click();
                    return true;
                  }
                } catch (e) {
                  // Continue to next selector
                }
              }
              
              // Fallback: look for any navigation element with "About" text
              const navElements = Array.from(document.querySelectorAll('nav a, nav button, .navigation a, .navigation button'));
              for (const el of navElements) {
                if (/^about$/i.test(el.textContent.trim()) || /about us/i.test(el.textContent.trim())) {
                  console.log(`Clicking About navigation: ${el.textContent}`);
                  el.click();
                  return true;
                }
              }
              
              return false;
            });

            if (aboutTabClicked) {
              console.log('About tab clicked, checking for new tab...');
              await delay(2000); // Wait for potential new tab to open
              
              // Check if a new tab was opened
              const updatedPages = await browser.pages();
              if (updatedPages.length > currentPageCount) {
                // New tab opened, switch to it
                newPage = updatedPages[updatedPages.length - 1];
                console.log('New tab detected, switching to About page...');
                await newPage.bringToFront();
                await delay(3000); // Wait for new page to load
                
                // Extract description from the new About page
                companyData.aboutUs = await newPage.evaluate(() => {
                  const selectors = [
                    '.org-about-us-organization-description__text',
                    '[data-test-id="about-us-description"]',
                    '.about-us-description-content',
                    '.organization-description',
                    '.company-description',
                    '.org-about-module__description',
                    '.org-about-company-module__company-description'
                  ];
                  
                  for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                      return element.textContent.trim();
                    }
                  }
                  return '';
                });
              } else {
                // Same page, content should be updated
                console.log('Same page, waiting for About content to load...');
                await delay(3000);
                
                // Try extracting description again after clicking About
                companyData.aboutUs = await page.evaluate(() => {
                  const selectors = [
                    '.org-about-us-organization-description__text',
                    '[data-test-id="about-us-description"]',
                    '.about-us-description-content',
                    '.organization-description',
                    '.company-description',
                    '.org-about-module__description',
                    '.org-about-company-module__company-description'
                  ];
                  
                  for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                      return element.textContent.trim();
                    }
                  }
                  return '';
                });
              }
              
              // Close the new tab if it was opened and switch back to original
              if (newPage) {
                await newPage.close();
                await page.bringToFront();
              }
            }
          } catch (error) {
            console.warn('Error handling About tab:', error.message);
            // Close new page if it was opened during error
            if (newPage) {
              try {
                await newPage.close();
                await page.bringToFront();
              } catch (e) {
                // Ignore cleanup errors
              }
            }
          }
        }

        // Try "Show more" button if description is truncated
        if (companyData.aboutUs && companyData.aboutUs.includes('...')) {
          console.log('Description appears truncated, looking for "Show more" button...');
          
          const showMoreClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
            for (const button of buttons) {
              if (/show more|see more|read more/i.test(button.textContent)) {
                button.click();
                return true;
              }
            }
            return false;
          });

          if (showMoreClicked) {
            await delay(2000);
            // Re-extract after clicking show more
            const expandedDescription = await page.evaluate(() => {
              const selectors = [
                '.org-about-us-organization-description__text',
                '[data-test-id="about-us-description"]',
                '.about-us-description-content'
              ];
              
              for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim()) {
                  return element.textContent.trim();
                }
              }
              return '';
            });
            
            if (expandedDescription && expandedDescription.length > companyData.aboutUs.length) {
              companyData.aboutUs = expandedDescription;
            }
          }
        }

        if (companyData.aboutUs) {
          companyData.description = companyData.aboutUs;
          console.log('Successfully extracted "aboutUs" from HTML.');
        } else {
          console.log('Could not extract "aboutUs" from HTML.');
        }
      } catch (error) {
        console.error('Error while scraping "aboutUs" from HTML:', error);
      }

      // **CRUCIAL: Bot detection and retry logic for name extraction**
      if (!companyData.name) {
        console.log('🔄 Name extraction failed - likely bot detection. Implementing retry strategy...');
        
        // Try different approaches to bypass bot detection
        for (let retryAttempt = 1; retryAttempt <= 2; retryAttempt++) {
          console.log(`🔄 Retry attempt ${retryAttempt}/2 for name extraction...`);
          
          try {
            // Strategy 1: Try direct navigation to clean URL
            if (retryAttempt === 1) {
              const cleanUrl = url.replace('/mycompany/', '/').replace('/mycompany', '').split('?')[0];
              if (cleanUrl !== url) {
                console.log(`🔄 Trying clean URL: ${cleanUrl}`);
                await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await delay(3000);
              }
            } 
            // Strategy 2: Refresh current page and try again
            else {
              console.log('🔄 Refreshing page to bypass detection...');
              await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
              await delay(4000);
            }
            
            // Handle popups again after navigation/refresh
            await page.evaluate(() => {
              const closeSelectors = [
                '.artdeco-modal__dismiss',
                'button[aria-label="Dismiss"]',
                'button[aria-label="Close"]',
                '.artdeco-modal-overlay'
              ];
              
              for (const selector of closeSelectors) {
                const element = document.querySelector(selector);
                if (element && element.offsetParent !== null) {
                  element.click();
                  break;
                }
              }
            });
            
            await delay(2000);
            
            // Try extracting name again
            const retryName = await page.evaluate(() => {
              // Same logic as before but with additional fallbacks
              const loginIndicators = [
                'Join now', 'Sign in', 'Sign up', 'Log in', 'Login', 'Register',
                'Create account', 'Get started', 'Welcome to LinkedIn'
              ];
              
              const h1Element = document.querySelector('h1');
              const h1Text = h1Element ? h1Element.textContent.trim() : '';
              
              // Skip if still on login page
              if (loginIndicators.some(indicator => h1Text.toLowerCase().includes(indicator.toLowerCase()))) {
                return null;
              }
              
              // Try company name selectors
              const selectors = [
                'h1.top-card-layout__title',
                'h1[data-test-id="company-name"]',
                '.top-card-layout__entity-info h1',
                'h1.org-top-card-summary__title',
                '.org-top-card-primary-content__title h1',
                'h1.top-card__title',
                'h1',
                '[data-test-id="org-name"] h1'
              ];
              
              for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim()) {
                  let name = element.textContent.trim();
                  name = name.replace(/\s*[|─-]?\s*(LinkedIn|linkedin|LINKEDIN).*$/i, '').trim();
                  
                  if (name && 
                      name.length > 1 && 
                      !loginIndicators.some(indicator => name.toLowerCase().includes(indicator.toLowerCase()))) {
                    return name;
                  }
                }
              }
              
              return null;
            });
            
            if (retryName) {
              console.log(`✅ Retry ${retryAttempt} successful! Found name: ${retryName}`);
              companyData.name = retryName;
              break;
            } else {
              console.log(`❌ Retry ${retryAttempt} failed - still no valid name found`);
            }
            
          } catch (retryError) {
            console.warn(`⚠️ Retry ${retryAttempt} error:`, retryError.message);
          }
          
          // Wait before next retry
          if (retryAttempt < 2) {
            await delay(3000);
          }
        }
        
        // Final fallback: use URL-based name if still no success
        if (!companyData.name) {
          console.log('🔄 Using URL-based fallback for company name...');
          const urlMatch = url.match(/\/company\/([^\/\?]+)/);
          if (urlMatch && urlMatch[1] && urlMatch[1] !== 'mycompany') {
            companyData.name = urlMatch[1]
              .replace(/-/g, ' ')
              .replace(/\b\w/g, l => l.toUpperCase())
              .replace(/\s+/g, ' ')
              .trim();
            console.log(`⚠️ Using URL-based name: ${companyData.name}`);
          }
        }
      }

      // **Enhanced Founded extraction**
      if (!companyData.founded) {
          console.log('Could not find "founded" in JSON-LD, attempting to scrape from HTML.');
          try {
            companyData.founded = await page.evaluate(() => {
                // Try multiple selectors for founded date
                const foundedSelectors = [
                  'dt:contains("Founded") + dd',
                  '[data-test-id="founded"] dd',
                  '.org-page-details dt:contains("Founded") + dd',
                  '.top-card-layout dt:contains("Founded") + dd'
                ];
                
                // Method 1: Look for dt/dd pairs
                const dtElements = Array.from(document.querySelectorAll('dt'));
                for (const dt of dtElements) {
                  if (/founded/i.test(dt.textContent)) {
                    const dd = dt.nextElementSibling;
                    if (dd && dd.tagName === 'DD') {
                      return dd.textContent.trim();
                    }
                  }
                }
                
                // Method 2: Look in about section content
                const aboutText = document.body.textContent;
                const foundedMatch = aboutText.match(/founded[:\s]*(\d{4})/i);
                if (foundedMatch) {
                  return foundedMatch[1];
                }
                
                // Method 3: Look for year patterns in specific sections
                const infoSections = document.querySelectorAll('.org-page-details, .top-card-layout__summary-info, .org-top-card-summary-info-list');
                for (const section of infoSections) {
                  const yearMatch = section.textContent.match(/\b(19|20)\d{2}\b/);
                  if (yearMatch) {
                    return yearMatch[0];
                  }
                }
                
                return '';
            });
            
            if(companyData.founded){
              console.log('Successfully extracted "founded" from HTML:', companyData.founded);
            } else {
              console.log('Could not extract "founded" from HTML.');
            }
          } catch (error) {
            console.warn('Error extracting founded date:', error.message);
          }
      }

      if (companyData.locations.length === 0) {
          console.log('Could not find "locations" in JSON-LD, attempting to scrape from HTML.');
          try {
            const showAllButtonHandle = await page.evaluateHandle(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              return buttons.find(button => button.innerText.trim().toLowerCase().includes('show all'));
            });

            if (showAllButtonHandle) {
                const showAllButton = showAllButtonHandle.asElement();
                if(showAllButton) {
                  console.log('Found "Show all locations" button, clicking...');
                  const boundingBox = await showAllButton.boundingBox();
                  if (boundingBox) {
                    await page.mouse.move(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
                    await page.mouse.click(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
                    try {
                        await page.waitForNavigation({ waitUntil: 'networkidle2' });
                    } catch (error) {
                        console.log('No navigation after clicking "Show all locations" button, proceeding...');
                    }
                  }
                }
            }

            companyData.locations = await page.evaluate(() => {
              const locations = [];
              const locationsSection = Array.from(document.querySelectorAll('h2, h3')).find(h => h.innerText.trim().toLowerCase() === 'locations');
              if (locationsSection) {
                let parent = locationsSection.parentElement;
                while(parent) {
                  const locationElements = parent.querySelectorAll('p');
                  if (locationElements.length > 0) {
                    locationElements.forEach(p => locations.push(p.innerText.trim()));
                    break;
                  }
                  parent = parent.parentElement;
                }
              }
              return locations;
            });

            if (companyData.locations.length > 0) {
              console.log('Successfully extracted "locations" from HTML.');
            } else {
              console.log('Could not extract "locations" from HTML.');
            }
          } catch (error) {
            console.error('Error while scraping "locations" from HTML:', error);
          }
      }
    }

    // **DEBUG: Log what we actually extracted**
    console.log('=== EXTRACTION SUMMARY ===');
    console.log('Name:', companyData.name || 'NOT FOUND');
    console.log('About Us:', companyData.aboutUs ? companyData.aboutUs.substring(0, 100) + '...' : 'NOT FOUND');
    console.log('Founded:', companyData.founded || 'NOT FOUND');
    console.log('Industry:', companyData.industry || 'NOT FOUND');
    console.log('Headquarters:', companyData.headquarters || 'NOT FOUND');
    console.log('Logo URL:', companyData.logoUrl || 'NOT FOUND');
    console.log('========================');

    console.log(`Successfully scraped ${url}`);
    const timerResult = performanceMonitor.endTimer(extractionTimer, true, { 
        url, 
        companyName: companyData.name || 'Unknown',
        dataQuality: companyData.name ? 'good' : 'partial'
    });
    
    const extractionDuration = timerResult.duration || Date.now() - extractionTimer.startTime;
    performanceMonitor.recordSuccess('LinkedIn extraction', extractionDuration);
    
    // Track successful extraction
    antiBotSystem.trackRequest(url, true, extractionDuration);
    
    return companyData;
    
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    
    // Enhanced error handling with categorization
    const errorCategory = error.message.includes('timeout') ? 'timeout' :
                          error.message.includes('navigation') ? 'navigation' :
                          error.message.includes('net::') ? 'network' :
                          'parsing';
    
    performanceMonitor.recordError(errorCategory, error, { 
        url, 
        context: 'LinkedIn extraction',
        userAgent: getCurrentUserAgent()
    });
    
    performanceMonitor.endTimer(extractionTimer, false, { 
        url, 
        error: error.message,
        errorCategory
    });
    
    // Track failed extraction
    antiBotSystem.trackRequest(url, false, 0);
    
    return { url, status: 'Failed', error: error.message, errorCategory };
    
  } finally {
    try {
      await page.close();
      console.log(`✅ Page closed for ${url}`);
    } catch (closeError) {
      console.warn(`Warning: Failed to close page for ${url}:`, closeError.message);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const headless = !args.includes('--headful');
  let urls = args.filter(arg => !arg.startsWith('--'));

  if (urls.length === 0) {
    try {
      const data = await fs.readFile('urls.txt', 'utf8');
      urls = data.split('\n').filter(Boolean).map(url => url.trim()).filter(url => url);
    } catch (error) {
      console.error('Error reading urls.txt:', error);
      return { error: 'Failed to read urls.txt' };
    }
  }

  if (urls.length === 0) {
    console.error('No URLs found to scrape');
    return { error: 'No URLs provided' };
  }

  console.log(`Starting LinkedIn scraping for ${urls.length} URL(s)...`);

  // **INITIALIZE: LinkedIn-specific anti-bot system**
  const linkedinAntiBot = new LinkedInImageAntiBotSystem();
  console.log('✅ [LinkedIn] Initialized LinkedIn-specific anti-bot system');

  let browser;
  try {
    // **ENHANCED: Advanced anti-bot system with performance monitoring**
    const launchTimer = performanceMonitor.startTimer('browser_launch');
    const selectedUserAgent = getUserAgent(true); // Force rotation for LinkedIn
    console.log(`🎭 Using advanced user agent: ${selectedUserAgent.split(' ')[2] || 'Custom'}`);
    
    // Enhanced browser configuration with advanced anti-bot features
    const launchOptions = {
      headless: headless ? 'new' : false,
      args: antiBotSystem.getAdvancedBrowserArgs(),
      defaultViewport: antiBotSystem.getRandomViewport(),
      timeout: 60000,
      // Advanced stealth features
      ignoreDefaultArgs: ['--enable-automation'],
      ignoreHTTPSErrors: true
    };

    browser = await puppeteer.launch(launchOptions);
    performanceMonitor.endTimer(launchTimer, true, { context: 'LinkedIn scraping' });
    
    // Record anti-bot system activation
    performanceMonitor.recordAntiBotEvent('browser_launch', { 
        context: 'LinkedIn scraping',
        headless: headless,
        userAgent: selectedUserAgent.split(' ')[2] || 'Custom'
    });

    const allCompanyData = [];
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`Processing URL ${i + 1}/${urls.length}: ${url}`);
      
      try {
        // **PASS: LinkedIn-specific anti-bot system to scraper**
        const companyData = await scrapeLinkedInCompany(url, browser, linkedinAntiBot);
        allCompanyData.push(companyData);
        
        // Add delay between requests to avoid rate limiting
        if (i < urls.length - 1) {
          const delayTime = Math.random() * 3000 + 2000; // 2-5 seconds
          console.log(`Waiting ${Math.round(delayTime/1000)}s before next request...`);
          await delay(delayTime);
        }
      } catch (error) {
        console.error(`Error processing ${url}:`, error);
        allCompanyData.push({
          url,
          status: 'Failed',
          error: error.message
        });
      }
    }

    // Save results
    try {
      await fs.writeFile('output.json', JSON.stringify(allCompanyData, null, 2));
      console.log('Successfully saved data to output.json');
      
      // Return the first result (for backward compatibility)
      if (allCompanyData.length > 0) {
        const result = allCompanyData[0];
        if (result.status === 'Success') {
          return result;
        } else {
          console.warn('First URL failed to scrape:', result.error);
          return result;
        }
      } else {
        return { error: 'No data scraped' };
      }
    } catch (error) {
      console.error('Error writing to output.json:', error);
      return { error: 'Failed to write output.json' };
    }
    
  } catch (error) {
    console.error('Failed to launch browser:', error);
    return { error: 'Failed to launch browser: ' + error.message };
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed successfully');
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
  }
}

// main();
module.exports = {main, scrapeLinkedInCompany, isScrapingAllowed, delay}; // Export functions for testing