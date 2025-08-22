// Company Extraction Fixes
// This file contains the fixes for null value issues in company extraction

/**
 * ISSUE 1: LinkedIn URL Cleanup
 * Problem: LinkedIn URLs with /mycompany/ trigger bot detection
 * Solution: Clean the URL before processing
 */
function cleanLinkedInUrl(url) {
    if (!url) return url;
    return url.replace('/mycompany/', '/').replace('/mycompany', '').split('?')[0];
}

/**
 * ISSUE 2: Universal Company Name Extraction
 * Problem: Need a robust system that works for ANY website URL
 * Solution: Comprehensive extraction with multiple strategies and intelligent cleaning
 */
async function enhancedNameExtraction(page, inputUrl = null) {
    let extractedName = null;
    
    // STRATEGY 1: Meta tags (most reliable for company sites)
    extractedName = await page.evaluate(() => {
        const metaSelectors = [
            'meta[property="og:site_name"]',      // Facebook Open Graph
            'meta[name="application-name"]',      // PWA name
            'meta[property="og:title"]',          // Open Graph title
            'meta[name="twitter:title"]',         // Twitter card
            'meta[itemprop="name"]',              // Schema.org
            'meta[name="author"]',                // Author meta
            'meta[name="publisher"]',             // Publisher
            'meta[property="article:publisher"]'  // Article publisher
        ];
        
        for (const selector of metaSelectors) {
            const meta = document.querySelector(selector);
            if (meta && meta.content && meta.content.trim()) {
                const content = meta.content.trim();
                // Skip generic/invalid values
                if (!['Join', 'Sign in', 'LinkedIn', 'Facebook', 'Login', 'Home', 'Welcome'].includes(content)) {
                    return content;
                }
            }
        }
        return null;
    });
    
    // STRATEGY 2: Structured data (JSON-LD, Microdata)
    if (!extractedName) {
        extractedName = await page.evaluate(() => {
            // Check JSON-LD structured data
            const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of jsonLdScripts) {
                try {
                    const data = JSON.parse(script.textContent);
                    const findName = (obj) => {
                        if (obj && typeof obj === 'object') {
                            if (obj.name && typeof obj.name === 'string') return obj.name;
                            if (obj.legalName && typeof obj.legalName === 'string') return obj.legalName;
                            if (obj.alternateName && typeof obj.alternateName === 'string') return obj.alternateName;
                            if (Array.isArray(obj)) {
                                for (const item of obj) {
                                    const result = findName(item);
                                    if (result) return result;
                                }
                            }
                            for (const key in obj) {
                                if (typeof obj[key] === 'object') {
                                    const result = findName(obj[key]);
                                    if (result) return result;
                                }
                            }
                        }
                        return null;
                    };
                    const name = findName(data);
                    if (name) return name;
                } catch (e) {
                    // Invalid JSON, continue
                }
            }
            
            // Check microdata
            const microdataElements = document.querySelectorAll('[itemtype*="Organization"], [itemtype*="Corporation"], [itemtype*="LocalBusiness"]');
            for (const element of microdataElements) {
                const nameElement = element.querySelector('[itemprop="name"]');
                if (nameElement && nameElement.textContent.trim()) {
                    return nameElement.textContent.trim();
                }
            }
            
            return null;
        });
    }
    
    // STRATEGY 3: Page title with intelligent cleaning
    if (!extractedName) {
        const titleText = await page.evaluate(() => document.title);
        if (titleText && titleText.trim()) {
            let cleanTitle = titleText.trim();
            
            // Remove common separators and take the first part (usually company name)
            const separators = ['|', ' - ', ' – ', ' — ', ' :: ', ' • ', ' / '];
            for (const sep of separators) {
                if (cleanTitle.includes(sep)) {
                    cleanTitle = cleanTitle.split(sep)[0].trim();
                    break;
                }
            }
            
            // Remove common suffixes
            const suffixes = [
                /\s*-\s*(Home|Homepage|Official Site|Website|Welcome)$/i,
                /\s*\|\s*(Home|Homepage|Official Site|Website|Welcome)$/i,
                /\s*:\s*(Home|Homepage|Official Site|Website|Welcome)$/i
            ];
            
            for (const suffix of suffixes) {
                cleanTitle = cleanTitle.replace(suffix, '').trim();
            }
            
            // Skip if it's still generic
            if (!['Join', 'Sign in', 'LinkedIn', 'Facebook', 'Login', 'Home', 'Welcome', ''].includes(cleanTitle)) {
                extractedName = cleanTitle;
            }
        }
    }
    
    // STRATEGY 4: Logo alt text and brand elements
    if (!extractedName) {
        extractedName = await page.evaluate(() => {
            const brandSelectors = [
                'img[alt*="logo" i]:not([alt*="linkedin" i]):not([alt*="facebook" i])',
                '.logo img[alt]:not([alt*="linkedin" i]):not([alt*="facebook" i])',
                '.brand img[alt]:not([alt*="linkedin" i]):not([alt*="facebook" i])',
                '.navbar-brand img[alt]:not([alt*="linkedin" i]):not([alt*="facebook" i])',
                'header img[alt]:not([alt*="linkedin" i]):not([alt*="facebook" i])'
            ];
            
            for (const selector of brandSelectors) {
                const img = document.querySelector(selector);
                if (img && img.alt && img.alt.trim()) {
                    let altText = img.alt.trim();
                    // Clean up alt text
                    altText = altText.replace(/\s*(logo|Logo|LOGO)\s*/g, '').trim();
                    if (altText && altText.length > 2 && altText.length < 100) {
                        return altText;
                    }
                }
            }
            return null;
        });
    }
    
    // STRATEGY 5: Heading elements and text content
    if (!extractedName) {
        extractedName = await page.evaluate(() => {
            const headingSelectors = [
                'h1.company-name, h1.brand-name, h1.site-title',
                '.logo-text, .company-title, .brand-text',
                'header h1:first-of-type',
                '.navbar-brand:not(:has(img))',
                '.site-title, .header-title',
                'h1:first-of-type'
            ];
            
            for (const selector of headingSelectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent && element.textContent.trim()) {
                    let text = element.textContent.trim();
                    // Skip if it's too long (likely not a company name)
                    if (text.length > 100) continue;
                    // Skip generic text
                    if (['Join', 'Sign in', 'LinkedIn', 'Facebook', 'Login', 'Home', 'Welcome'].includes(text)) continue;
                    return text;
                }
            }
            return null;
        });
    }
    
    // STRATEGY 6: URL-based extraction as last resort
    if (!extractedName && inputUrl) {
        try {
            const url = new URL(inputUrl);
            let hostname = url.hostname.replace(/^www\./, '');
            
            // Extract company name from domain
            const domainParts = hostname.split('.');
            if (domainParts.length >= 2) {
                let companyPart = domainParts[0];
                
                // Clean up common patterns
                companyPart = companyPart.replace(/[-_]/g, ' ');
                companyPart = companyPart.split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
                
                // Only use if it looks reasonable
                if (companyPart.length > 2 && companyPart.length < 50) {
                    extractedName = companyPart;
                }
            }
        } catch (e) {
            // Invalid URL, skip
        }
    }
    
    // Final cleaning and validation
    if (extractedName) {
        extractedName = extractedName.trim();
        
        // Remove quotes and extra whitespace
        extractedName = extractedName.replace(/^["']|["']$/g, '').trim();
        
        // Limit length
        if (extractedName.length > 255) {
            extractedName = extractedName.substring(0, 255).trim();
        }
        
        // Final validation - reject if still generic or empty
        if (['Join', 'Sign in', 'LinkedIn', 'Facebook', 'Login', 'Home', 'Welcome', ''].includes(extractedName)) {
            extractedName = null;
        }
    }
    
    return extractedName;
}

/**
 * ISSUE 3: Better Facebook Data Merging
 * Problem: Facebook data not properly overriding null/invalid values
 * Solution: Proper conditional merging logic
 */
function mergeFacebookData(finalCompanyInfo, facebookData, originalUrl) {
    if (!facebookData || facebookData.error) {
        return finalCompanyInfo;
    }
    
    // Fix company name if it's invalid (like "Join" from LinkedIn bot detection)
    if (!finalCompanyInfo.Name || 
        finalCompanyInfo.Name === 'Join' || 
        finalCompanyInfo.Name === 'Sign in' ||
        finalCompanyInfo.Name === 'LinkedIn') {
        finalCompanyInfo.Name = facebookData.companyName || finalCompanyInfo.Name;
    }
    
    // Fix description if missing
    if (!finalCompanyInfo.Description) {
        finalCompanyInfo.Description = facebookData.description || finalCompanyInfo.Description;
    }
    
    // Fix website if it's just the original URL or missing
    if (!finalCompanyInfo.Website || finalCompanyInfo.Website === originalUrl) {
        // Don't use Facebook URL as website, look for external links in Facebook data
        if (facebookData.website && !facebookData.website.includes('facebook.com')) {
            finalCompanyInfo.Website = facebookData.website;
        }
    }
    
    return finalCompanyInfo;
}

/**
 * ISSUE 4: Enhanced Industry/Location Extraction
 * Problem: Many websites don't have structured data
 * Solution: Look for common patterns in page content
 */
async function enhancedCompanyDetailsExtraction(page) {
    return await page.evaluate(() => {
        const details = {
            industry: null,
            location: null,
            founded: null,
            employees: null
        };
        
        // Look for industry information
        const industryPatterns = [
            /industry[:\s]+([^<>\n]+)/i,
            /sector[:\s]+([^<>\n]+)/i,
            /business[:\s]+([^<>\n]+)/i,
            /specializes?\s+in[:\s]+([^<>\n]+)/i
        ];
        
        // Look for location information
        const locationPatterns = [
            /headquarters[:\s]+([^<>\n]+)/i,
            /located\s+in[:\s]+([^<>\n]+)/i,
            /based\s+in[:\s]+([^<>\n]+)/i,
            /office[:\s]+([^<>\n]+)/i
        ];
        
        // Look for founding information
        const foundedPatterns = [
            /founded[:\s]+(\d{4})/i,
            /established[:\s]+(\d{4})/i,
            /since[:\s]+(\d{4})/i
        ];
        
        // Look for employee information
        const employeePatterns = [
            /(\d+[\+\-\s]*\d*)\s*employees/i,
            /team\s+of\s+(\d+[\+\-\s]*\d*)/i,
            /(\d+[\+\-\s]*\d*)\s*people/i
        ];
        
        const pageText = document.body.innerText || '';
        
        // Extract industry
        for (const pattern of industryPatterns) {
            const match = pageText.match(pattern);
            if (match && match[1]) {
                details.industry = match[1].trim().substring(0, 100);
                break;
            }
        }
        
        // Extract location
        for (const pattern of locationPatterns) {
            const match = pageText.match(pattern);
            if (match && match[1]) {
                details.location = match[1].trim().substring(0, 100);
                break;
            }
        }
        
        // Extract founded year
        for (const pattern of foundedPatterns) {
            const match = pageText.match(pattern);
            if (match && match[1]) {
                details.founded = match[1].trim();
                break;
            }
        }
        
        // Extract employee count
        for (const pattern of employeePatterns) {
            const match = pageText.match(pattern);
            if (match && match[1]) {
                details.employees = match[1].trim();
                break;
            }
        }
        
        return details;
    });
}

module.exports = {
    cleanLinkedInUrl,
    enhancedNameExtraction,
    mergeFacebookData,
    enhancedCompanyDetailsExtraction
};