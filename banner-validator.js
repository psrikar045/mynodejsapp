/**
 * Banner Image Validator
 * Validates banner URLs to ensure they're real images, not dummy placeholders
 * Checks image dimensions, content, and other quality indicators
 */

const axios = require('axios');
const sharp = require('sharp');

class BannerValidator {
    constructor(antiBot) {
        this.antiBot = antiBot;
    }

    /**
     * Validate if a banner URL points to a real image (not a dummy/placeholder)
     */
    async validateBannerUrl(url, refererUrl = null) {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) {
            return { isValid: false, reason: 'Invalid URL format' };
        }

        console.log('🔍 [Banner Validator] Validating banner URL:', String(url));

        try {
            // Step 1: Check URL patterns for obvious dummies
            const urlValidation = this.validateUrlPattern(url);
            if (!urlValidation.isValid) {
                return urlValidation;
            }

            // Step 2: Fetch image headers to check basic properties
            const headersValidation = await this.validateImageHeaders(url, refererUrl);
            if (!headersValidation.isValid) {
                return headersValidation;
            }

            // Step 3: Download and analyze image content
            const contentValidation = await this.validateImageContent(url, refererUrl);
            return contentValidation;

        } catch (error) {
            console.warn('⚠️ [Banner Validator] Validation error for', String(url) + ':', error.message);
            return { 
                isValid: false, 
                reason: 'Validation error: ' + String(error.message),
                error: error.message 
            };
        }
    }

    /**
     * Validate URL pattern for obvious dummy indicators
     */
    validateUrlPattern(url) {
        // Check for dummy/placeholder patterns
        const dummyPatterns = [
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
        ];

        const lowerUrl = url.toLowerCase();
        for (const pattern of dummyPatterns) {
            if (lowerUrl.includes(pattern)) {
                return { 
                    isValid: false, 
                    reason: 'URL contains dummy pattern: ' + String(pattern) 
                };
            }
        }

        // Check for valid LinkedIn CDN domains
        const validDomains = [
            'media.licdn.com',
            'static.licdn.com',
            'dms.licdn.com',
            'cdn.lynda.com'
        ];

        const hasValidDomain = validDomains.some(domain => url.includes(domain));
        if (!hasValidDomain) {
            return { 
                isValid: false, 
                reason: 'URL is not from a valid LinkedIn CDN domain' 
            };
        }

        // Check for banner-like dimensions in URL
        const dimensionPatterns = [
            /\d{3,4}x\d{2,3}/, // Wide aspect ratio like 1200x300
            /w_\d{3,4}.*h_\d{2,3}/, // Width/height parameters
            /width=\d{3,4}.*height=\d{2,3}/
        ];

        const hasBannerDimensions = dimensionPatterns.some(pattern => pattern.test(url));
        
        return { 
            isValid: true, 
            hasBannerDimensions,
            reason: 'URL pattern validation passed' 
        };
    }

    /**
     * Validate image by checking HTTP headers
     */
    async validateImageHeaders(url, refererUrl) {
        try {
            const headers = this.antiBot ? 
                this.antiBot.getLinkedInImageHeaders(url, refererUrl) : 
                {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': refererUrl || 'https://www.linkedin.com/',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                };

            const response = await axios.head(url, {
                headers,
                timeout: 10000,
                validateStatus: (status) => status < 500 // Accept redirects
            });

            // Check content type
            const contentType = response.headers['content-type'] || '';
            if (!contentType.startsWith('image/')) {
                return { 
                    isValid: false, 
                    reason: 'Invalid content type: ' + String(contentType) 
                };
            }

            // Check content length (very small images are likely dummies)
            const contentLength = parseInt(response.headers['content-length'] || '0');
            if (contentLength > 0 && contentLength < 1000) { // Less than 1KB
                return { 
                    isValid: false, 
                    reason: 'Image too small: ' + String(contentLength) + ' bytes (likely a dummy)' 
                };
            }

            // Check for cache headers (real images usually have proper caching)
            const cacheControl = response.headers['cache-control'] || '';
            const expires = response.headers['expires'] || '';
            const lastModified = response.headers['last-modified'] || '';

            return { 
                isValid: true, 
                contentType,
                contentLength,
                cacheControl,
                expires,
                lastModified,
                reason: 'Headers validation passed' 
            };

        } catch (error) {
            if (error.response && error.response.status === 403) {
                return { 
                    isValid: false, 
                    reason: 'Access forbidden (403) - likely bot detection' 
                };
            }
            
            if (error.response && error.response.status === 404) {
                return { 
                    isValid: false, 
                    reason: 'Image not found (404)' 
                };
            }

            throw error; // Re-throw other errors
        }
    }

    /**
     * Validate image by downloading and analyzing content
     */
    async validateImageContent(url, refererUrl) {
        try {
            const headers = this.antiBot ? 
                this.antiBot.getLinkedInImageHeaders(url, refererUrl) : 
                {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': refererUrl || 'https://www.linkedin.com/',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                };

            // Download image with size limit to avoid huge downloads
            const response = await axios.get(url, {
                headers,
                timeout: 15000,
                responseType: 'arraybuffer',
                maxContentLength: 10 * 1024 * 1024, // 10MB limit
                validateStatus: (status) => status === 200
            });

            const imageBuffer = Buffer.from(response.data);
            
            // Use Sharp to analyze image properties
            const metadata = await sharp(imageBuffer).metadata();
            
            const { width, height, format, size } = metadata;
            
            console.log('📏 [Banner Validator] Image dimensions:', String(width) + 'x' + String(height) + ', format:', String(format) + ', size:', String(size), 'bytes');

            // Validate dimensions for banner images
            if (!width || !height) {
                return { 
                    isValid: false, 
                    reason: 'Could not determine image dimensions' 
                };
            }

            // Check if dimensions are too small (likely dummy)
            if (width < 100 || height < 50) {
                return { 
                    isValid: false, 
                    reason: 'Image too small: ' + String(width) + 'x' + String(height) + ' (likely a dummy)' 
                };
            }

            // Check aspect ratio (banners are typically wide)
            const aspectRatio = width / height;
            if (aspectRatio < 1.5) {
                console.warn('⚠️ [Banner Validator] Unusual aspect ratio for banner:', String(aspectRatio.toFixed(2)));
            }

            // Check for single-color images (common dummy pattern)
            const colorAnalysis = await this.analyzeImageColors(imageBuffer);
            if (colorAnalysis.isSingleColor) {
                return { 
                    isValid: false, 
                    reason: 'Single color image detected (likely dummy): ' + String(colorAnalysis.dominantColor) 
                };
            }

            // All validations passed
            return { 
                isValid: true, 
                width,
                height,
                format,
                size,
                aspectRatio: aspectRatio.toFixed(2),
                colorAnalysis,
                reason: 'Image content validation passed' 
            };

        } catch (error) {
            if (error.message.includes('Input buffer contains unsupported image format')) {
                return { 
                    isValid: false, 
                    reason: 'Unsupported image format or corrupted image' 
                };
            }
            
            throw error; // Re-throw other errors
        }
    }

    /**
     * Analyze image colors to detect single-color dummy images
     */
    async analyzeImageColors(imageBuffer) {
        try {
            // Resize to small size for faster color analysis
            const smallImage = await sharp(imageBuffer)
                .resize(50, 50, { fit: 'fill' })
                .raw()
                .toBuffer({ resolveWithObject: true });

            const { data, info } = smallImage;
            const { width, height, channels } = info;

            // Sample colors from the image
            const colors = new Map();
            const sampleSize = Math.min(100, width * height); // Sample up to 100 pixels
            
            for (let i = 0; i < sampleSize; i++) {
                const pixelIndex = Math.floor(Math.random() * (width * height)) * channels;
                const r = data[pixelIndex];
                const g = data[pixelIndex + 1];
                const b = data[pixelIndex + 2];
                
                // Group similar colors (tolerance of 10)
                const tolerance = 10;
                const rValue = Math.floor(Number(r) / tolerance) * tolerance;
                const gValue = Math.floor(Number(g) / tolerance) * tolerance;
                const bValue = Math.floor(Number(b) / tolerance) * tolerance;
                const colorKey = `${rValue},${gValue},${bValue}`;
                colors.set(colorKey, (colors.get(colorKey) || 0) + 1);
            }

            const uniqueColors = colors.size;
            const dominantColor = Array.from(colors.entries())
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

            // Consider it a single color if less than 3 unique color groups
            const isSingleColor = uniqueColors < 3;

            const getColorVariety = (count) => {
                if (count > 10) return 'high';
                if (count > 5) return 'medium';
                return 'low';
            };

            return {
                uniqueColors,
                dominantColor,
                isSingleColor,
                colorVariety: getColorVariety(uniqueColors)
            };

        } catch (error) {
            console.warn('⚠️ [Banner Validator] Color analysis failed:', error.message);
            return {
                uniqueColors: 0,
                dominantColor: 'unknown',
                isSingleColor: false,
                colorVariety: 'unknown',
                error: error.message
            };
        }
    }

    /**
     * Validate multiple banner URLs and return the best one
     */
    async validateMultipleBannerUrls(urls, refererUrl = null) {
        if (!Array.isArray(urls) || urls.length === 0) {
            return { bestUrl: null, validations: [] };
        }

        console.log('🔍 [Banner Validator] Validating', String(urls.length), 'banner URLs...');

        const validations = [];
        
        for (const url of urls) {
            const validation = await this.validateBannerUrl(url, refererUrl);
            validations.push({ url, ...validation });
            
            // Add delay between validations to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Find the best valid URL
        const validUrls = validations.filter(v => v.isValid);
        
        if (validUrls.length === 0) {
            console.log('❌ [Banner Validator] No valid banner URLs found');
            return { bestUrl: null, validations };
        }

        // Score valid URLs and pick the best one
        const scoredUrls = validUrls.map(validation => ({
            ...validation,
            score: this.scoreValidatedUrl(validation)
        }));

        scoredUrls.sort((a, b) => b.score - a.score);
        const bestUrl = scoredUrls[0].url;

        console.log('✅ [Banner Validator] Best banner URL selected:', String(bestUrl));
        
        return { bestUrl, validations };
    }

    /**
     * Score a validated URL based on quality indicators
     */
    scoreValidatedUrl(validation) {
        let score = 0;

        if (!validation.isValid) return 0;

        // Size scoring
        if (validation.width && validation.height) {
            const aspectRatio = validation.width / validation.height;
            
            // Prefer banner-like aspect ratios
            if (aspectRatio > 3) score += 30;
            else if (aspectRatio > 2) score += 20;
            else if (aspectRatio > 1.5) score += 10;
            
            // Prefer larger images
            if (validation.width > 1000) score += 20;
            else if (validation.width > 500) score += 10;
        }

        // File size scoring (not too small, not too large)
        if (validation.size) {
            if (validation.size > 50000 && validation.size < 2000000) score += 15; // 50KB - 2MB
            else if (validation.size > 10000) score += 5; // At least 10KB
        }

        // Color variety scoring
        if (validation.colorAnalysis) {
            if (validation.colorAnalysis.colorVariety === 'high') score += 15;
            else if (validation.colorAnalysis.colorVariety === 'medium') score += 10;
        }

        // Format scoring
        if (validation.format) {
            if (validation.format === 'webp') score += 10;
            else if (validation.format === 'jpeg' || validation.format === 'jpg') score += 5;
        }

        return score;
    }
}

module.exports = { BannerValidator };