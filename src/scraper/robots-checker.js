const robotsParser = require('robots-parser');
const axios = require('axios');
const { logger } = require('../utils/logger');

/**
 * Robots.txt checker and compliance module
 * Fetches and caches robots.txt for domains and checks if URLs are allowed
 */

class RobotsChecker {
    constructor() {
        // Cache robots.txt parsers by domain
        this.robotsCache = new Map();
        this.fetchTimeout = 5000; // 5 seconds timeout for fetching robots.txt
    }

    /**
     * Get domain from URL
     * @param {string} url 
     * @returns {string} Domain
     */
    getDomain(url) {
        try {
            const urlObj = new URL(url);
            return `${urlObj.protocol}//${urlObj.hostname}`;
        } catch (error) {
            logger.warn(`Invalid URL for domain extraction: ${url}`);
            return null;
        }
    }

    /**
     * Fetch robots.txt for a domain
     * @param {string} domain - Domain URL (e.g., https://example.com)
     * @returns {Promise<string>} robots.txt content
     */
    async fetchRobotsTxt(domain) {
        const robotsUrl = `${domain}/robots.txt`;

        try {
            logger.debug(`Fetching robots.txt from ${robotsUrl}`);

            const response = await axios.get(robotsUrl, {
                timeout: this.fetchTimeout,
                validateStatus: (status) => status < 500, // Accept 404, but not 5xx
                headers: {
                    'User-Agent': 'ClientDataAggregator/1.0 (+https://github.com/scraper-bot)'
                }
            });

            if (response.status === 200) {
                return response.data;
            } else {
                // If robots.txt doesn't exist (404), return empty string (allow all)
                logger.debug(`No robots.txt found at ${robotsUrl} (status: ${response.status})`);
                return '';
            }
        } catch (error) {
            // On error (timeout, network issue), be conservative and allow
            logger.warn(`Error fetching robots.txt from ${robotsUrl}: ${error.message}`);
            return ''; // Empty = allow all
        }
    }

    /**
     * Get or create robots parser for domain
     * @param {string} domain - Domain URL
     * @returns {Promise<Object>} Robots parser instance
     */
    async getRobotsParser(domain) {
        // Check cache first
        if (this.robotsCache.has(domain)) {
            return this.robotsCache.get(domain);
        }

        // Fetch and parse robots.txt
        const robotsTxt = await this.fetchRobotsTxt(domain);
        const parser = robotsParser(`${domain}/robots.txt`, robotsTxt);

        // Cache the parser
        this.robotsCache.set(domain, parser);

        return parser;
    }

    /**
     * Check if URL is allowed to be scraped
     * @param {string} url - URL to check
     * @param {string} userAgent - User agent string (default: '*')
     * @returns {Promise<boolean>} True if allowed, false if disallowed
     */
    async isAllowed(url, userAgent = '*') {
        try {
            const domain = this.getDomain(url);

            if (!domain) {
                logger.warn(`Cannot determine domain for URL: ${url}`);
                return false; // Reject invalid URLs
            }

            const parser = await this.getRobotsParser(domain);
            const allowed = parser.isAllowed(url, userAgent);

            if (!allowed) {
                logger.info(`robots.txt disallows: ${url}`);
            }

            return allowed;
        } catch (error) {
            logger.error(`Error checking robots.txt for ${url}:`, error);
            // On error, be conservative and disallow
            return false;
        }
    }

    /**
     * Check if URL is allowed and return reason if not
     * @param {string} url 
     * @param {string} userAgent 
     * @returns {Promise<{allowed: boolean, reason: string}>}
     */
    async checkUrl(url, userAgent = '*') {
        const allowed = await this.isAllowed(url, userAgent);

        return {
            allowed,
            reason: allowed ? '' : 'Disallowed by robots.txt'
        };
    }

    /**
     * Get crawl delay for domain (in milliseconds)
     * @param {string} domain - Domain URL
     * @param {string} userAgent - User agent string
     * @returns {Promise<number>} Crawl delay in ms (0 if not specified)
     */
    async getCrawlDelay(domain, userAgent = '*') {
        try {
            const parser = await this.getRobotsParser(domain);
            const delay = parser.getCrawlDelay(userAgent);

            // Convert seconds to milliseconds
            return delay ? delay * 1000 : 0;
        } catch (error) {
            logger.error(`Error getting crawl delay for ${domain}:`, error);
            return 0;
        }
    }

    /**
     * Clear cache (useful for testing or long-running processes)
     */
    clearCache() {
        this.robotsCache.clear();
        logger.debug('Robots.txt cache cleared');
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getCacheStats() {
        return {
            cachedDomains: this.robotsCache.size,
            domains: Array.from(this.robotsCache.keys())
        };
    }
}

// Export singleton instance
module.exports = new RobotsChecker();
