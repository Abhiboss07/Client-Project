/**
 * Validation and normalization utilities
 */

/**
 * Normalize URL to consistent format
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
    if (!url) return '';

    try {
        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        const urlObj = new URL(url);

        // Remove trailing slash
        let normalized = urlObj.origin + urlObj.pathname.replace(/\/$/, '');

        // Add search params if they exist
        if (urlObj.search) {
            normalized += urlObj.search;
        }

        return normalized;
    } catch (error) {
        return url; // Return original if parsing fails
    }
}

/**
 * Extract email addresses from text using regex
 * @param {string} text - Text to search
 * @returns {Array<string>} Array of email addresses
 */
function extractEmails(text) {
    if (!text) return [];

    // Comprehensive email regex pattern
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const matches = text.match(emailPattern) || [];

    // Filter out common false positives
    return matches.filter(email => {
        const domain = email.split('@')[1];
        // Exclude image extensions and common false positives
        if (domain && (domain.endsWith('.png') || domain.endsWith('.jpg') ||
            domain.endsWith('.svg') || domain.endsWith('.gif'))) {
            return false;
        }
        return true;
    });
}

/**
 * Extract phone numbers from text using regex
 * Supports international formats and common patterns
 * @param {string} text - Text to search
 * @returns {Array<string>} Array of phone numbers
 */
function extractPhones(text) {
    if (!text) return [];

    const phonePatterns = [
        // International format: +1-234-567-8900
        /\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
        // US format: (123) 456-7890
        /\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}/g,
        // Simple format: 123-456-7890
        /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g,
        // Indian format: +91 98765 43210
        /\+91[\s]?\d{5}[\s]?\d{5}/g,
    ];

    const phones = new Set();

    phonePatterns.forEach(pattern => {
        const matches = text.match(pattern) || [];
        matches.forEach(phone => phones.add(phone.trim()));
    });

    return Array.from(phones);
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
    if (!email) return false;
    const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
    return emailPattern.test(email);
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
function isValidUrl(url) {
    if (!url) return false;

    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Calculate extraction confidence score (0-1)
 * Based on number of fields successfully extracted
 * @param {Object} data - Extracted data object
 * @returns {number} Confidence score between 0 and 1
 */
function calculateConfidence(data) {
    const fields = [
        'name', 'title', 'company', 'location',
        'email', 'website', 'phone', 'about_snippet'
    ];

    let filledFields = 0;
    let totalWeight = 0;

    // Different fields have different weights
    const weights = {
        name: 2,        // Name is most important
        email: 2,       // Email is very important
        company: 1.5,
        title: 1.5,
        website: 1,
        phone: 1,
        location: 1,
        about_snippet: 0.5
    };

    fields.forEach(field => {
        const weight = weights[field] || 1;
        totalWeight += weight;

        if (data[field] && data[field].trim().length > 0) {
            filledFields += weight;
        }
    });

    return parseFloat((filledFields / totalWeight).toFixed(2));
}

/**
 * Clean and normalize text
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
function cleanText(text) {
    if (!text) return '';

    return text
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .replace(/\n+/g, ' ')   // Replace newlines with space
        .trim();
}

module.exports = {
    normalizeUrl,
    extractEmails,
    extractPhones,
    isValidEmail,
    isValidUrl,
    calculateConfidence,
    cleanText
};
