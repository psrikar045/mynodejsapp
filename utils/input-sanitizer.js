/**
 * Input sanitization utilities for security
 */

/**
 * Sanitizes input for logging to prevent log injection attacks
 * @param {any} input - Input to sanitize
 * @returns {string} - Sanitized input safe for logging
 */
function sanitizeForLogging(input) {
    if (input === null || input === undefined) {
        return 'null';
    }
    
    return encodeURIComponent(String(input).replace(/[\r\n\t]/g, ''));
}

/**
 * Sanitizes URL input
 * @param {string} url - URL to sanitize
 * @returns {string} - Sanitized URL
 */
function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') {
        return '';
    }
    
    return url.trim().replace(/[\r\n\t]/g, '');
}

/**
 * Sanitizes object for logging by sanitizing all string values
 * @param {object} obj - Object to sanitize
 * @returns {object} - Sanitized object
 */
function sanitizeObjectForLogging(obj) {
    if (!obj || typeof obj !== 'object') {
        return sanitizeForLogging(obj);
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeForLogging(value);
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObjectForLogging(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

module.exports = {
    sanitizeForLogging,
    sanitizeUrl,
    sanitizeObjectForLogging
};