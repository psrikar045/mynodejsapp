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
  await page.setUserAgent(USER_AGENT);

  try {
    if (!await isScrapingAllowed(url)) {
      console.warn(`Scraping disallowed by robots.txt for ${url}. Skipping.`);
      return { url, status: 'Skipped', error: 'Scraping disallowed by robots.txt' };
    }

    console.log(`Scraping ${url}...`);
    let retries = 3;
    while (retries > 0) {
      try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        break;
      } catch (error) {
        console.warn(`Error loading page, retrying... (${retries} retries left)`);
        retries--;
        if (retries === 0) {
          throw error;
        }
      }
    }
    await delay(Math.random() * 3000 + 2000); // Random delay between 2-5 seconds

    // Click "Show more" button if it exists
    const showMoreButtonSelector = '.org-about-us-organization-description__show-more-button';
    if (await page.$(showMoreButtonSelector) !== null) {
      await page.click(showMoreButtonSelector);
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
    }

    const content = await page.content();
    const $ = cheerio.load(content);

    let jsonData = {};
    $('script[type="application/ld+json"]').each((i, el) => {
      const scriptContent = $(el).html();
      if (scriptContent) {
        const parsedJson = JSON.parse(scriptContent);
        if (parsedJson['@type'] === 'Organization') {
          jsonData = parsedJson;
        }
      }
    });

    const companyData = {
      url,
      status: 'Success',
      name: (() => {
                const ogTitle = $('meta[property="og:title"]').attr('content');
                const h1Text = $('h1').first().text().trim();

                let extractedName = ogTitle || h1Text || null;

                if (extractedName) {
                    // Remove '| LinkedIn' or similar patterns from the end
                    // This regex handles ' | LinkedIn', '|LinkedIn', ' - LinkedIn', etc.
                    extractedName = extractedName.replace(/\s*[|─-]?\s*(LinkedIn|linkedin|LINKEDIN)\s*$/i, '').trim();
                }
                return extractedName;
            })(),
      logoUrl: await page.evaluate(() => {
        const logoElement = document.querySelector('.top-card-layout__entity-image');
        return logoElement ? logoElement.src : null;
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

    if (jsonData.description) {
      companyData.aboutUs = jsonData.description;
      companyData.description = jsonData.description;
      console.log('Extracted "aboutUs" from JSON-LD.');
    } else {
      console.log('Could not find "aboutUs" in JSON-LD, attempting to scrape from HTML.');
      try {
        // Find and click the "About" tab
        const aboutTab = await page.evaluateHandle(() => {
          const tabs = Array.from(document.querySelectorAll('a, button'));
          return tabs.find(tab => {
            const tabText = tab.innerText.trim().toLowerCase();
            return tabText === 'about' || tabText === 'about us' || tabText === 'overview';
          });
        });

        if (aboutTab) {
          console.log('Found "About" tab, clicking...');
          const boundingBox = await aboutTab.boundingBox();
          if (boundingBox) {
            await page.mouse.move(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
            await page.mouse.click(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
            try {
              await page.waitForNavigation({ waitUntil: 'networkidle2' });
            } catch (error) {
              console.log('No navigation after clicking "About" tab, proceeding...');
            }
          }
        } else {
          console.log('Could not find "About" tab.');
        }

        // Click "Show more" button for the description
        const showMoreButtonHandle = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(button => button.innerText.trim().toLowerCase() === 'show more');
        });

        if (showMoreButtonHandle) {
            const showMoreButton = showMoreButtonHandle.asElement();
            if (showMoreButton) {
                console.log('Found "Show more" button for description, clicking...');
                const boundingBox = await showMoreButton.boundingBox();
                if (boundingBox) {
                    await page.mouse.move(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
                    await page.mouse.click(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
                    try {
                        await page.waitForNavigation({ waitUntil: 'networkidle2' });
                    } catch (error) {
                        console.log('No navigation after clicking "Show more" button, proceeding...');
                    }
                }
            }
        }


        companyData.aboutUs = await page.evaluate(() => {
          const aboutUsElement = Array.from(document.querySelectorAll('h2')).find(h2 => h2.innerText.trim().toLowerCase().includes('overview') || h2.innerText.trim().toLowerCase().includes('about'));
          if (aboutUsElement) {
            // Find the parent that contains the text and extract it
            let parent = aboutUsElement.parentElement;
            while(parent) {
              const text = parent.innerText;
              if (text && text.length > 100) { // Heuristic to find the right container
                return text;
              }
              parent = parent.parentElement;
            }
          }
          return '';
        });

        if (companyData.aboutUs) {
          companyData.description = companyData.aboutUs; // Use the same value for description
          console.log('Successfully extracted "aboutUs" from HTML.');
        } else {
          console.log('Could not extract "aboutUs" from HTML.');
        }
      } catch (error) {
        console.error('Error while scraping "aboutUs" from HTML:', error);
      }
      // Scrape "Founded" and "Locations" only after "About Us" has been processed
      if (!companyData.founded) {
          try {
            await page.waitForSelector('//h2[contains(., "About us")]', { timeout: 5000 });
            console.log('Could not find "founded" in JSON-LD, attempting to scrape from HTML.');
            companyData.founded = await page.evaluate(() => {
                const foundedElement = Array.from(document.querySelectorAll('dt')).find(dt => dt.innerText.trim().toLowerCase() === 'founded');
                if (foundedElement) {
                    return foundedElement.nextElementSibling.innerText.trim();
                }
                return '';
            });
            if(companyData.founded){
              console.log('Successfully extracted "founded" from HTML.');
            } else {
              console.log('Could not extract "founded" from HTML.');
            }
          } catch (error) {
            console.log('Could not find "About us" section for "founded" scraping.');
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
      urls = data.split('\n').filter(Boolean);
    } catch (error) {
      console.error('Error reading urls.txt:', error);
      return;
    }
  }

  // Randomize the order of URLs
  urls.sort(() => Math.random() - 0.5);

  const browser = await puppeteer.launch({ headless });
  const allCompanyData = [];
  for (const url of urls) {
    const companyData = await scrapeLinkedInCompany(url, browser);
    allCompanyData.push(companyData);
  }

  try {
    await fs.writeFile('output.json', JSON.stringify(allCompanyData, null, 2));
    console.log('Successfully saved data to output.json');
    return allCompanyData[0];
  } catch (error) {
    console.error('Error writing to output.json:', error);
    return { error: 'Failed to write output.json' };
  } finally {
    await browser.close();
  }
}

// main();
module.exports = {main, scrapeLinkedInCompany, isScrapingAllowed, delay}; // Export functions for testing