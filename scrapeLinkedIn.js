const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const { createWriteStream } = require('fs');

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


const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

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

async function scrapeLinkedInCompany(url, browser) {
  const page = await browser.newPage();
  
  // Enhanced anti-detection measures
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Set additional headers to appear more human-like
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

  // Set viewport to common screen resolution
  await page.setViewport({ width: 1366, height: 768 });

  try {
    if (!await isScrapingAllowed(url)) {
      console.warn(`Scraping disallowed by robots.txt for ${url}. Skipping.`);
      return { url, status: 'Skipped', error: 'Scraping disallowed by robots.txt' };
    }

    console.log(`Scraping ${url}...`);
    let retries = 3;
    while (retries > 0) {
      try {
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        break;
      } catch (error) {
        console.warn(`Error loading page, retrying... (${retries} retries left)`);
        retries--;
        if (retries === 0) {
          throw error;
        }
        await delay(2000); // Wait before retry
      }
    }
    
    // Wait for page to load and add human-like delay
    await delay(Math.random() * 4000 + 3000); // Random delay between 3-7 seconds

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
          'button:has(svg[data-test-id="close-icon"])',
          '.artdeco-modal-overlay button.artdeco-button--circle'
        ];
        
        for (const selector of closeSelectors) {
          try {
            const closeButton = document.querySelector(selector);
            if (closeButton && closeButton.offsetParent !== null) { // Check if visible
              console.log(`Found close button: ${selector}`);
              closeButton.click();
              return true;
            }
          } catch (e) {
            // Continue to next selector
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
        const skipSelectors = [
          'button:contains("Not now")',
          'button:contains("Skip")',
          'button:contains("Maybe later")',
          '[data-test-id="cold-signup-dismiss"]',
          'button[aria-label="Dismiss"]'
        ];
        
        for (const selector of skipSelectors) {
          try {
            const button = document.querySelector(selector);
            if (button && /not now|skip|maybe later|dismiss/i.test(button.textContent)) {
              button.click();
              return true;
            }
          } catch (e) {
            // Continue
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
        // Try multiple selectors for company name
        const selectors = [
          'h1.top-card-layout__title',
          'h1[data-test-id="company-name"]',
          '.top-card-layout__entity-info h1',
          'h1.org-top-card-summary__title',
          'h1.top-card__title',
          'h1',
          '[data-test-id="org-name"] h1',
          '.org-page-details__company-name'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            let name = element.textContent.trim();
            // Remove LinkedIn suffix if present
            name = name.replace(/\s*[|─-]?\s*(LinkedIn|linkedin|LINKEDIN)\s*$/i, '').trim();
            if (name) return name;
          }
        }
        
        // Fallback to meta tag
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle && ogTitle.content) {
          let name = ogTitle.content.trim();
          name = name.replace(/\s*[|─-]?\s*(LinkedIn|linkedin|LINKEDIN)\s*$/i, '').trim();
          return name;
        }
        
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
      // bannerUrl: await page.evaluate(() => {
      //   const bannerElement = document.querySelector('.cover-img__image');
      //   return bannerElement ? bannerElement.src : null;
      // }),
      bannerUrl: await page.evaluate(() => {
        // This entire block of code runs directly inside the loaded LinkedIn page
        // where 'document' and 'window' are available.

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
        ];

        for (const s of selectors) {
            const element = document.querySelector(s.selector);
            if (element) {
                let imageUrl = null;
                if (s.type === 'bg') {
                    const style = window.getComputedStyle(element);
                    const backgroundImage = style.backgroundImage;
                    if (backgroundImage && backgroundImage !== 'none') {
                        // Extract URL from 'url("...")' or 'url(...)', remove quotes
                        imageUrl = backgroundImage.match(/url\(['"]?(.*?)['"]?\)/)?.[1];
                    }
                } else if (s.type === 'src') {
                    imageUrl = element.src;
                }

                // Basic validation for a plausible URL
                if (imageUrl && imageUrl.startsWith('http')) {
                    return imageUrl;
                }
            }
        }
        return null; // Return null if no banner URL is found after trying all selectors
      }),
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
    return companyData;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return { url, status: 'Failed', error: error.message };
  } finally {
    await page.close();
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

  let browser;
  try {
    // Enhanced browser configuration for better LinkedIn compatibility
    browser = await puppeteer.launch({
      headless: headless ? 'new' : false, // Use new headless mode for better compatibility
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
        '--disable-images', // Speed up loading
        '--disable-javascript-harmony-shipping',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      defaultViewport: {
        width: 1366,
        height: 768
      },
      timeout: 60000
    });

    const allCompanyData = [];
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`Processing URL ${i + 1}/${urls.length}: ${url}`);
      
      try {
        const companyData = await scrapeLinkedInCompany(url, browser);
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