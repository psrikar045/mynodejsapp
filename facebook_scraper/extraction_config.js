// Adaptive Facebook Extraction Configuration
// This file contains all configurable parameters for robust data extraction

const EXTRACTION_CONFIG = {
    // Retry and timeout settings - OPTIMIZED for faster processing
    retries: {
        navigation: 2,  // Reduced from 3 to 2
        extraction: 2,  // Keep at 2
        uiScrape: 1,    // Reduced from 2 to 1
        apiCall: 2      // Reduced from 3 to 2
    },
    
    timeouts: {
        navigation: 3000,
        elementWait: 2000,
        pageLoad: 15000,
        retryDelay: 1500,
        backoffBase: 1000
    },
    
    // Quality thresholds
    quality: {
        minScore: 0.3,
        criticalFields: ['companyName'],
        importantFields: ['description', 'email', 'phone', 'address', 'website'],
        optionalFields: ['likes', 'followers', 'businessHours', 'priceRange']
    },
    
    // Selector strategies for different page elements
    selectors: {
        navigation: {
            about: [
                'a[href*="/about"]',
                'div[role="tab"]:contains("About")',
                'a:contains("About")',
                '[data-testid="about_tab"]',
                'div[aria-label="About"]',
                'span:contains("About")',
                'div[data-overlaycontent*="about"]',
                'a[aria-label*="About"]'
            ],
            transparency: [
                'a[href*="transparency"]',
                'div:contains("Page transparency")',
                'a:contains("Page transparency")',
                '[data-testid="page_transparency"]',
                'div[aria-label*="transparency"]',
                'span:contains("transparency")',
                'a[aria-label*="transparency"]',
                'div[role="button"]:contains("transparency")'
            ]
        },
        
        companyName: [
            'h1[data-testid="page-header-title"]',
            'h1[role="heading"]',
            'h1',
            '[data-testid="page_profile_name"] h1',
            'span[dir="auto"] h1',
            'div[role="main"] h1'
        ],
        
        socialMetrics: {
            likes: [
                '[data-testid="page_social_context"] span',
                'a[href*="likes"] span',
                'div[aria-label*="like"] span',
                'span[title*="like"]'
            ],
            followers: [
                '[data-testid="page_followers"] span',
                'a[href*="followers"] span',
                'div[aria-label*="follow"] span',
                'span[title*="follow"]'
            ]
        },
        
        contactInfo: {
            email: ['a[href^="mailto:"]'],
            phone: ['a[href^="tel:"]'],
            website: ['a[href^="http"]:not([href*="facebook.com"]):not([href*="instagram.com"])']
        },
        
        images: {
            profile: [
                'image[data-testid="page_profile_pic"]',
                'img[data-testid="page_profile_pic"]',
                'svg image[data-testid="page_profile_pic"]',
                'div[data-testid="page_profile_pic"] img',
                'a[data-testid="page_profile_pic"] img',
                'img[alt*="profile"]',
                '.profilePicThumb img',
                'div[role="img"] image',
                'img[class*="profile"]',
                'a[href*="profile"] img'
            ],
            banner: [
                'image[data-testid="page_cover_photo"]',
                'img[data-testid="page_cover_photo"]',
                'div[data-testid="page_cover_photo"] img',
                'img[alt*="cover"]',
                'img[alt*="banner"]',
                '.coverPhotoImg img',
                'img[class*="cover"]',
                'div[class*="cover"] img'
            ]
        }
    },
    
    // Pattern matching for fallback extraction
    patterns: {
        email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        phone: /\+?1?[-\s]?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}/g,
        address: /\d+.*(?:street|road|avenue|way|blvd|drive|lane|court|place)/gi,
        zipCode: /\b\d{5}(-\d{4})?\b/g,
        stateZip: /\b[A-Z]{2}\s+\d{5}\b/g,
        likes: /\d+[KMB]?\s*(people\s+)?likes?/gi,
        followers: /\d+[KMB]?\s*(people\s+)?followers?/gi,
        businessHours: /(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\s*:?\s*\d{1,2}:\d{2}/gi,
        priceRange: /\$+|\$\d+[-–]\$?\d+|budget|expensive|moderate/gi
    },
    
    // Fallback strategies configuration
    fallback: {
        enableMetaTags: true,
        enableStructuredData: true,
        enablePatternMatching: true,
        enableImageHeuristics: true,
        minContentLength: 100
    },
    
    // Browser and navigation settings
    browser: {
        enableStealth: true,
        enableInterception: true,
        enableCookies: true,
        userAgentRotation: true,
        viewportRandomization: true
    },
    
    // Error handling configuration
    errorHandling: {
        enableCircuitBreaker: true,
        enableGracefulDegradation: true,
        enableErrorRecovery: true,
        maxConsecutiveFailures: 3,
        recoveryStrategies: ['refresh', 'navigate', 'fallback']
    }
};

// Helper functions for configuration access
const getRetryConfig = (type) => EXTRACTION_CONFIG.retries[type] || 2;
const getTimeoutConfig = (type) => EXTRACTION_CONFIG.timeouts[type] || 3000;
const getSelectors = (category, subcategory = null) => {
    if (subcategory) {
        return EXTRACTION_CONFIG.selectors[category]?.[subcategory] || [];
    }
    return EXTRACTION_CONFIG.selectors[category] || [];
};
const getPattern = (type) => EXTRACTION_CONFIG.patterns[type];
const getQualityThreshold = () => EXTRACTION_CONFIG.quality.minScore;

module.exports = {
    EXTRACTION_CONFIG,
    getRetryConfig,
    getTimeoutConfig,
    getSelectors,
    getPattern,
    getQualityThreshold
};