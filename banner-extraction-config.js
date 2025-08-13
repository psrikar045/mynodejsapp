/**
 * Banner Extraction Configuration
 * Centralized configuration for LinkedIn banner extraction patterns, timeouts, and settings
 * Allows for easy maintenance and updates when LinkedIn changes their structure
 */

const BANNER_EXTRACTION_CONFIG = {
    // Network interception patterns (primary method)
    networkPatterns: {
        // Static API patterns (baseline)
        staticApiPatterns: [
            '/voyager/api/',
            '/voyagerapi/',
            '/api/v2/',
            '/api/graphql',
            '/feed-api/',
            '/organization-api/',
            '/company-api/',
            'linkedin.com/deco-api/',
            'linkedin.com/li/api/',
            'linkedin.com/voyager/',
            '/deco/api/',
            '/li/api/'
        ],
        
        // Content-based patterns
        contentPatterns: [
            'companyUpdates',
            'organizationDashCompanies',
            'companyProfile',
            'organization',
            'company'
        ],
        
        // Banner-specific JSON patterns
        bannerJsonPatterns: [
            // LinkedIn CDN patterns
            /https:\/\/media\.licdn\.com\/dms\/image\/[^"'\s]+/g,
            /https:\/\/static\.licdn\.com\/[^"'\s]+/g,
            /https:\/\/dms\.licdn\.com\/[^"'\s]+/g,
            
            // Background image patterns
            /"backgroundImage":\s*"([^"]+)"/g,
            /"coverPhoto":\s*"([^"]+)"/g,
            /"bannerImage":\s*"([^"]+)"/g,
            /"heroImage":\s*"([^"]+)"/g,
            /"coverImage":\s*"([^"]+)"/g,
            
            // Nested image objects
            /"image":\s*{\s*"[^"]*":\s*"([^"]+)"/g,
            /"backgroundImageUrl":\s*"([^"]+)"/g,
            /"companyBackgroundImage":\s*"([^"]+)"/g
        ],
        
        // Banner-related key names
        bannerKeys: [
            'backgroundimage', 'background_image', 'backgroundImage',
            'coverphoto', 'cover_photo', 'coverPhoto', 'coverImage',
            'bannerimage', 'banner_image', 'bannerImage',
            'heroimage', 'hero_image', 'heroImage',
            'companybackground', 'company_background', 'companyBackground',
            'organizationbackground', 'organization_background',
            'profilebackground', 'profile_background',
            'headerimage', 'header_image', 'headerImage'
        ]
    },
    
    // Direct API endpoints (fallback method)
    apiEndpoints: {
        // Base endpoint templates (replace {companyId} with actual ID)
        templates: [
            'https://www.linkedin.com/voyager/api/organization/companies?q=universalName&universalName={companyId}',
            'https://www.linkedin.com/voyager/api/organization/company/{companyId}',
            'https://www.linkedin.com/deco-api/identity/dash/companyProfile?q=universalName&universalName={companyId}',
            'https://www.linkedin.com/li/api/v1/organization/{companyId}',
            'https://www.linkedin.com/voyager/api/organization/companies/{companyId}',
            'https://www.linkedin.com/voyager/api/organization/company/{companyId}/companyProfile'
        ]
    },
    
    // DOM selectors (final fallback method)
    domSelectors: {
        // Priority-ordered selectors for banner extraction
        prioritized: [
            // Highest priority: LinkedIn-specific company banner selectors
            { selector: 'img[src*="media.licdn.com/dms/image/"][src*="company-background"]', type: 'src', priority: 10 },
            { selector: 'div.org-top-card-primary-content__hero-image', type: 'bg', priority: 9 },
            { selector: 'div.org-top-card-module__hero', type: 'bg', priority: 8 },
            { selector: 'img.org-top-card-primary-content__cover', type: 'src', priority: 8 },
            { selector: 'img[data-test-id*="cover-photo"]', type: 'src', priority: 7 },
            { selector: 'img[data-test-id*="banner-img"]', type: 'src', priority: 7 },
            { selector: 'div.profile-background-image__image', type: 'bg', priority: 6 },
            { selector: 'section[class*="artdeco-card"] div[class*="ivm-image-view-model__background-img"]', type: 'bg', priority: 6 },
            
            // Medium priority: Generic banner patterns
            { selector: 'div[class*="cover-img"]', type: 'bg', priority: 5 },
            { selector: 'div[class*="profile-cover-image"]', type: 'bg', priority: 5 },
            { selector: 'div[class*="banner-image"]', type: 'bg', priority: 5 },
            { selector: 'img[alt*="Cover photo"i]', type: 'src', priority: 4 },
            { selector: 'img[alt*="Banner"i]', type: 'src', priority: 4 },
            { selector: 'img[class*="cover-image"]', type: 'src', priority: 4 },
            { selector: 'img[class*="banner-image"]', type: 'src', priority: 4 },
            
            // Lower priority: Container-based searches
            { selector: 'div.cover-photo img', type: 'src', priority: 3 },
            { selector: 'div.banner img', type: 'src', priority: 3 },
            { selector: 'figure[class*="banner"] img', type: 'src', priority: 3 },
            { selector: 'figure[class*="cover"] img', type: 'src', priority: 3 }
        ],
        
        // Enhanced selectors for page source analysis
        enhanced: {
            metaTags: ['meta[property*="image"]', 'meta[name*="image"]', 'meta[property*="banner"]', 'meta[name*="banner"]'],
            dataAttributes: ['[data-background-image]', '[data-banner-url]', '[data-cover-photo]'],
            scriptTypes: ['script[type="application/ld+json"]', 'script:contains("backgroundImage")'],
            styleElements: ['style:contains("background-image")']
        }
    },
    
    // URL validation patterns
    validation: {
        // Valid LinkedIn CDN domains
        validDomains: [
            'media.licdn.com',
            'static.licdn.com',
            'dms.licdn.com',
            'cdn.lynda.com'
        ],
        
        // Dummy/placeholder patterns to exclude
        dummyPatterns: [
            'placeholder',
            'default',
            'blank',
            'empty',
            '1x1',
            'pixel',
            'transparent',
            'spacer',
            'dummy',
            'fake',
            'test'
        ],
        
        // Banner-related path patterns
        bannerPatterns: [
            'company-background',
            'organization-background',
            'profile-background',
            'cover-photo',
            'banner-image',
            'hero-image'
        ],
        
        // Dimension patterns for banners (wide aspect ratios)
        dimensionPatterns: [
            /\d{3,4}x\d{2,3}/, // Wide aspect ratio like 1200x300
            /w_\d{3,4}.*h_\d{2,3}/, // Width/height parameters
            /width=\d{3,4}.*height=\d{2,3}/
        ],
        
        // Quality thresholds
        quality: {
            minWidth: 100,
            minHeight: 50,
            minFileSize: 1000, // 1KB
            maxFileSize: 10 * 1024 * 1024, // 10MB
            minAspectRatio: 1.5, // Banners should be wider than tall
            preferredAspectRatio: 3.0 // Ideal banner aspect ratio
        }
    },
    
    // Timing and rate limiting configuration
    timing: {
        // Network interception timeouts
        networkInterception: {
            initialWait: 4000, // Wait for initial API calls
            maxWait: 12000, // Maximum wait for API calls
            apiCallGap: 3000, // Time to wait for new API calls
            triggerDelay: 2000 // Delay between trigger actions
        },
        
        // Rate limiting for API calls
        rateLimiting: {
            baseDelay: 1000, // Base delay between requests (ms)
            randomDelay: 1000, // Additional random delay (ms)
            backoffDelay: 5000, // Backoff delay when rate limited (ms)
            maxRequestsPerMinute: 10, // Maximum requests per minute
            windowSize: 60000 // Rate limiting window (ms)
        },
        
        // Validation timeouts
        validation: {
            headRequest: 10000, // Timeout for HEAD requests (ms)
            imageDownload: 15000, // Timeout for image downloads (ms)
            maxContentLength: 10 * 1024 * 1024, // Max image size to download
            validationDelay: 1000 // Delay between validations (ms)
        }
    },
    
    // Session health monitoring
    sessionHealth: {
        checkInterval: 5 * 60 * 1000, // Check every 5 minutes
        indicators: {
            positive: ['.global-nav', '.top-card-layout', '.org-top-card-summary-info-list', 'main[role="main"]'],
            negative: ['Join LinkedIn', 'Sign in to LinkedIn', 'Access denied', 'Rate limit exceeded', 'Temporarily blocked']
        }
    },
    
    // Popup and interference handling
    popupHandling: {
        closeSelectors: [
            '[data-test-id="login-form"] button[aria-label="Dismiss"]',
            '[data-test-id="cold-signup-dismiss"]',
            '.artdeco-modal__dismiss',
            'button[data-test-id="modal-close-button"]',
            '.artdeco-modal-overlay',
            'button[aria-label="Dismiss"]',
            'button[aria-label="Close"]',
            'button[aria-label="Not now"]',
            'button[aria-label="Skip"]',
            'button[aria-label="Maybe later"]'
        ],
        
        skipTextPatterns: [
            'not now',
            'skip',
            'maybe later',
            'dismiss'
        ]
    },
    
    // Logging and debugging
    logging: {
        enableDetailedLogging: false, // Disable detailed logging for production
        logNetworkRequests: false, // Reduce network request logging noise
        logValidationDetails: true, // Keep validation logging for debugging
        logPerformanceMetrics: true, // Keep performance metrics
        logBannerFinds: true, // Log when actual banners are found
        logExclusions: false, // Don't log excluded logos/images
        maxLogEntries: 1000 // Prevent memory leaks
    }
};

/**
 * Get configuration for a specific component
 */
function getConfig(component) {
    return BANNER_EXTRACTION_CONFIG[component] || {};
}

/**
 * Update configuration patterns (for maintenance)
 */
function updatePatterns(component, newPatterns) {
    if (BANNER_EXTRACTION_CONFIG[component]) {
        BANNER_EXTRACTION_CONFIG[component] = { ...BANNER_EXTRACTION_CONFIG[component], ...newPatterns };
        console.log(`✅ [Config] Updated ${component} patterns`);
    } else {
        console.warn(`⚠️ [Config] Component ${component} not found`);
    }
}

/**
 * Validate configuration integrity
 */
function validateConfig() {
    const requiredComponents = ['networkPatterns', 'apiEndpoints', 'domSelectors', 'validation', 'timing'];
    const missingComponents = requiredComponents.filter(component => !BANNER_EXTRACTION_CONFIG[component]);
    
    if (missingComponents.length > 0) {
        console.error(`❌ [Config] Missing components: ${missingComponents.join(', ')}`);
        return false;
    }
    
    console.log('✅ [Config] Configuration validation passed');
    return true;
}

module.exports = {
    BANNER_EXTRACTION_CONFIG,
    getConfig,
    updatePatterns,
    validateConfig
};