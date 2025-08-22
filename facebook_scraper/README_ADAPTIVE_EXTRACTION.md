# Adaptive Facebook Extraction System

## Overview

The enhanced Facebook scraper now implements a comprehensive adaptive extraction system with intelligent retry logic, fallback mechanisms, and best practices for robust data extraction across different browsers and page layouts.

## Key Features

### 🔄 Adaptive Navigation
- **Multi-Strategy Navigation**: Uses multiple selector strategies with automatic fallback
- **Visibility Detection**: Checks element visibility before attempting clicks
- **JavaScript Fallback**: Falls back to JavaScript-based navigation when DOM clicks fail
- **Scroll-and-Search**: Implements scroll-based element discovery for dynamic content

### 🎯 Intelligent Data Extraction
- **Selector-Based Extraction**: Primary extraction using optimized CSS selectors
- **Pattern Matching**: Regex-based fallback for contact information (email, phone, address)
- **Heuristic Detection**: Content-based heuristics for images and social metrics
- **Meta Tag Fallback**: Structured data and meta tag extraction as last resort

### 🛡️ Error Handling & Recovery
- **Circuit Breaker Pattern**: Prevents cascading failures with automatic recovery
- **Exponential Backoff**: Intelligent retry timing to avoid rate limiting
- **Graceful Degradation**: Continues extraction even when some components fail
- **Quality Validation**: Assesses extraction quality and triggers fallbacks when needed

### 📊 Quality Assessment
- **Data Quality Scoring**: Evaluates extraction completeness (0.0 - 1.0 scale)
- **Critical Field Detection**: Prioritizes essential data like company name
- **Missing Data Recovery**: Attempts comprehensive fallback for low-quality extractions

## Architecture

### Core Components

1. **AdaptiveExtractor** (`adaptive_extractor.js`)
   - Main extraction engine with multiple strategies
   - Implements timeout handling and retry logic
   - Provides circuit breaker functionality

2. **ExtractionConfig** (`extraction_config.js`)
   - Centralized configuration for all extraction parameters
   - Selector definitions for different page elements
   - Retry counts, timeouts, and quality thresholds

3. **Enhanced FacebookScraper** (`facebook_scraper.js`)
   - Integrates adaptive extraction system
   - Implements staged extraction process
   - Provides comprehensive error handling

### Extraction Stages

#### Stage 1: Posts Tab (Intro Section)
- Company name extraction with multiple selector strategies
- Social metrics (likes, followers) with pattern matching
- Basic contact information from intro cards
- Fallback to page title and meta tags

#### Stage 2: About Tab Navigation & Extraction
- Adaptive navigation with visibility checks
- Contact information extraction (email, phone, address)
- Business details (hours, price range, categories)
- Alternative extraction from current page if navigation fails

#### Stage 3: Page Transparency
- Administrative information extraction
- Page creation date and management details
- Advertising status detection
- Graceful handling of missing transparency sections

#### Stage 4: Image Extraction
- Profile image detection using multiple strategies
- Banner/cover image extraction with heuristics
- Fallback to meta tag images
- Size-based image classification (square = profile, wide = banner)

#### Stage 5: Quality Validation & Enhancement
- Data completeness assessment
- Comprehensive fallback for low-quality extractions
- Structured data (JSON-LD) parsing
- Pattern-based text extraction from page content

## Configuration Options

### Retry Settings
```javascript
retries: {
    navigation: 3,      // Navigation attempts per element
    extraction: 2,      // Data extraction attempts
    uiScrape: 2,       // Full UI scrape attempts
    apiCall: 3         // API call attempts
}
```

### Timeout Configuration
```javascript
timeouts: {
    navigation: 3000,   // Navigation timeout (ms)
    elementWait: 2000,  // Element wait timeout (ms)
    pageLoad: 15000,    // Page load timeout (ms)
    retryDelay: 1500,   // Base retry delay (ms)
    backoffBase: 1000   // Exponential backoff base (ms)
}
```

### Quality Thresholds
```javascript
quality: {
    minScore: 0.3,                    // Minimum acceptable quality score
    criticalFields: ['companyName'],   // Must-have fields
    importantFields: ['description', 'email', 'phone', 'address', 'website'],
    optionalFields: ['likes', 'followers', 'businessHours', 'priceRange']
}
```

## Best Practices Implemented

### 1. **Browser Compatibility**
- Multiple selector strategies for different Facebook layouts
- User agent rotation and stealth measures
- Viewport randomization for bot detection avoidance

### 2. **Rate Limiting & Anti-Bot**
- Exponential backoff for failed requests
- Random delays between actions
- Cookie persistence for session continuity
- Request interception for GraphQL parameter discovery

### 3. **Data Validation**
- Pattern matching for contact information validation
- Content length checks for meaningful data
- Duplicate detection and deduplication
- URL validation for external links

### 4. **Error Recovery**
- Page state assessment before extraction
- Automatic page refresh on low-quality results
- Alternative extraction paths for blocked content
- Comprehensive logging for debugging

### 5. **Performance Optimization**
- Parallel extraction where possible
- Early termination on sufficient data quality
- Selective element waiting to reduce timeouts
- Memory-efficient DOM querying

## Usage Examples

### Basic Extraction
```javascript
const { scrapeFacebookCompany } = require('./facebook_scraper');

const result = await scrapeFacebookCompany('https://facebook.com/company', sessionId);
console.log('Extraction Quality:', result.dataQuality.score);
console.log('Company Name:', result.companyName);
```

### Quality Assessment
```javascript
// Check if extraction meets quality standards
if (result.dataQuality.score >= 0.7) {
    console.log('High quality extraction');
} else if (result.dataQuality.score >= 0.3) {
    console.log('Acceptable quality extraction');
} else {
    console.log('Low quality extraction - may need manual review');
}
```

### Error Handling
```javascript
if (result.status === 'Blocked') {
    console.log('Page access was blocked');
} else if (result.extractionErrors?.length > 0) {
    console.log('Partial extraction with errors:', result.extractionErrors);
}
```

## Monitoring & Debugging

### Extraction Logs
- Detailed step-by-step extraction logging
- Performance timing for each stage
- Error categorization and recovery attempts
- Quality score tracking

### Metrics Tracked
- Success/failure rates per extraction stage
- Average extraction time per component
- Circuit breaker activation frequency
- Data quality distribution

### Debug Information
- Selector success/failure rates
- Navigation path taken
- Fallback strategy usage
- Page state assessments

## Future Enhancements

1. **Machine Learning Integration**
   - Selector effectiveness learning
   - Dynamic timeout adjustment
   - Predictive quality scoring

2. **Advanced Anti-Bot Measures**
   - Behavioral pattern simulation
   - Dynamic selector generation
   - Proxy rotation support

3. **Performance Improvements**
   - Parallel stage execution
   - Intelligent caching
   - Predictive prefetching

4. **Enhanced Quality Control**
   - Content similarity detection
   - Cross-validation with multiple sources
   - Automated data cleaning

## Troubleshooting

### Common Issues

1. **Low Quality Scores**
   - Check if page layout has changed
   - Verify selector effectiveness
   - Review extraction logs for failed stages

2. **Navigation Failures**
   - Ensure page is fully loaded
   - Check for dynamic content loading
   - Verify element visibility

3. **Circuit Breaker Activation**
   - Review recent extraction failures
   - Check for rate limiting or blocking
   - Consider adjusting retry parameters

### Configuration Tuning

- Increase retry counts for unstable networks
- Adjust timeouts for slower pages
- Lower quality thresholds for acceptable results
- Enable additional fallback strategies

This adaptive extraction system provides robust, reliable Facebook data extraction that gracefully handles the dynamic nature of social media platforms while maintaining high data quality standards.