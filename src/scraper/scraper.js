const { chromium } = require('playwright');
const path = require('path');
const robotsChecker = require('./robots-checker');
const DataExtractor = require('./extractor');
const RateLimiter = require('../utils/rate-limiter');
const { logger, logUrlStatus } = require('../utils/logger');
require('dotenv').config();

/**
 * Main scraper class
 * Coordinates Playwright browser, rate limiting, robots.txt compliance,
 * anti-bot detection, and data extraction
 */

class Scraper {
    constructor(options = {}) {
        this.options = {
            concurrency: options.concurrency || parseInt(process.env.CONCURRENCY) || 3,
            timeout: options.timeout || parseInt(process.env.TIMEOUT_MS) || 30000,
            requestDelay: options.requestDelay || parseInt(process.env.REQUEST_DELAY_MS) || 2000,
            useProxy: options.useProxy || process.env.USE_PROXY === 'true',
            proxyUrl: options.proxyUrl || process.env.PROXY_URL,
            ...options
        };

        this.rateLimiter = new RateLimiter({
            concurrency: this.options.concurrency,
            perDomainConcurrency: parseInt(process.env.PER_DOMAIN_CONCURRENCY) || 1,
            requestDelay: this.options.requestDelay,
            maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
            backoffBase: parseInt(process.env.EXPONENTIAL_BACKOFF_BASE) || 2
        });

        this.extractor = new DataExtractor();
        this.browser = null;
        this.context = null;

        // User agents for rotation
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
        ];

        // Anti-bot detection patterns
        this.antiBotPatterns = [
            /cloudflare/i,
            /recaptcha/i,
            /hcaptcha/i,
            /captcha/i,
            /access denied/i,
            /blocked/i,
            /security check/i,
            /verify you are human/i,
            /ray id/i, // Cloudflare Ray ID
            /cf-ray/i,
            /challenge-platform/i
        ];
    }

    /**
     * Initialize browser and context
     */
    async initialize() {
        logger.info('Initializing browser...');

        const launchOptions = {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };

        // Add proxy if configured
        if (this.options.useProxy && this.options.proxyUrl) {
            // Parse proxy URL
            const proxyUrl = new URL(this.options.proxyUrl);
            launchOptions.proxy = {
                server: `${proxyUrl.protocol}//${proxyUrl.host}`,
            };

            if (proxyUrl.username && proxyUrl.password) {
                launchOptions.proxy.username = proxyUrl.username;
                launchOptions.proxy.password = proxyUrl.password;
            }

            logger.info(`Using proxy: ${proxyUrl.host}`);
        }

        this.browser = await chromium.launch(launchOptions);
        this.context = await this.browser.newContext({
            userAgent: this.getRandomUserAgent(),
            viewport: { width: 1920, height: 1080 },
            locale: 'en-US',
            timezoneId: 'America/New_York'
        });

        logger.info('Browser initialized successfully');
    }

    /**
     * Get random user agent from list
     * @returns {string} User agent string
     */
    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    /**
     * Detect if page has anti-bot protection
     * @param {Object} page - Playwright page
     * @returns {Promise<{detected: boolean, type: string}>}
     */
    async detectAntiBot(page) {
        try {
            // Get page content
            const content = await page.content();
            const title = await page.title();
            const url = page.url();

            // Check content against patterns
            for (const pattern of this.antiBotPatterns) {
                if (pattern.test(content) || pattern.test(title) || pattern.test(url)) {
                    const type = pattern.source.replace(/\\/gi, '').replace(/\^|\$/g, '');
                    logger.warn(`Anti-bot detected: ${type} on ${url}`);
                    return { detected: true, type };
                }
            }

            // Check for specific anti-bot elements
            const cloudflareCheck = await page.$('.cf-browser-verification');
            if (cloudflareCheck) {
                return { detected: true, type: 'Cloudflare challenge' };
            }

            const recaptchaCheck = await page.$('.g-recaptcha');
            if (recaptchaCheck) {
                return { detected: true, type: 'reCAPTCHA' };
            }

            return { detected: false, type: '' };
        } catch (error) {
            logger.warn(`Error during anti-bot detection: ${error.message}`);
            return { detected: false, type: '' };
        }
    }

    /**
     * Scrape a single URL
     * @param {string} url - URL to scrape
     * @returns {Promise<Object>} Scraped data or error
     */
    async scrapeUrl(url) {
        logger.info(`Starting scrape: ${url}`);

        // Check robots.txt
        const robotsCheck = await robotsChecker.checkUrl(url);
        if (!robotsCheck.allowed) {
            logUrlStatus(url, 'skipped', { reason: robotsCheck.reason });
            return {
                url,
                status: 'skipped',
                reason: robotsCheck.reason,
                data: null
            };
        }

        // Use rate limiter to execute scraping
        try {
            const result = await this.rateLimiter.execute(url, async () => {
                const page = await this.context.newPage();

                try {
                    // Set random user agent for this page
                    await page.setExtraHTTPHeaders({
                        'User-Agent': this.getRandomUserAgent()
                    });

                    // Navigate to URL with timeout
                    logger.debug(`Navigating to: ${url}`);
                    const response = await page.goto(url, {
                        waitUntil: 'domcontentloaded',
                        timeout: this.options.timeout
                    });

                    // Check HTTP status
                    const status = response?.status();
                    if (!status || status >= 400) {
                        throw new Error(`HTTP ${status || 'unknown'}`);
                    }

                    // Wait a bit for dynamic content
                    await page.waitForTimeout(1000);

                    // Detect anti-bot measures
                    const antiBotCheck = await this.detectAntiBot(page);
                    if (antiBotCheck.detected) {
                        logUrlStatus(url, 'skipped', {
                            reason: `Anti-bot detected: ${antiBotCheck.type}`,
                            httpStatus: status
                        });
                        return {
                            url,
                            status: 'skipped',
                            reason: `Anti-bot detected: ${antiBotCheck.type}`,
                            data: null
                        };
                    }

                    // Extract data
                    const data = await this.extractor.extract(page, url);

                    logUrlStatus(url, 'success', {
                        httpStatus: status,
                        confidence: data.extraction_confidence,
                        fieldsExtracted: Object.keys(data).filter(k => data[k] && data[k].toString().trim().length > 0).length
                    });

                    return {
                        url,
                        status: 'success',
                        reason: '',
                        data
                    };

                } catch (error) {
                    logger.error(`Error scraping ${url}:`, error);
                    logUrlStatus(url, 'error', {
                        error: error.message,
                        stack: error.stack
                    });

                    return {
                        url,
                        status: 'error',
                        reason: error.message,
                        data: null
                    };
                } finally {
                    await page.close();
                }
            });

            return result;
        } catch (error) {
            // Rate limiter error (max retries exceeded)
            logger.error(`Rate limiter error for ${url}:`, error);
            logUrlStatus(url, 'error', {
                error: error.message,
                stack: error.stack
            });

            return {
                url,
                status: 'error',
                reason: error.message,
                data: null
            };
        }
    }

    /**
     * Scrape multiple URLs
     * @param {Array<string>} urls - Array of URLs to scrape
     * @returns {Promise<Array<Object>>} Array of results
     */
    async scrapeUrls(urls) {
        logger.info(`Starting batch scrape of ${urls.length} URLs`);

        const startTime = Date.now();
        const results = [];

        // Process URLs with rate limiting
        for (const url of urls) {
            try {
                const result = await this.scrapeUrl(url);
                results.push(result);
            } catch (error) {
                logger.error(`Fatal error scraping ${url}:`, error);
                results.push({
                    url,
                    status: 'error',
                    reason: error.message,
                    data: null
                });
            }
        }

        const duration = Date.now() - startTime;
        logger.info(`Batch scrape completed in ${duration}ms (${(duration / 1000).toFixed(2)}s)`);

        return results;
    }

    /**
     * Close browser and cleanup
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            logger.info('Browser closed');
        }
    }

    /**
     * Get scraper statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            rateLimiter: this.rateLimiter.getStats(),
            robotsCache: robotsChecker.getCacheStats()
        };
    }
}

module.exports = Scraper;
