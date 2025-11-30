/**
 * Rate limiter with per-domain queues and exponential backoff
 * Ensures polite scraping with configurable delays and retry logic
 */

class RateLimiter {
    constructor(options = {}) {
        this.globalConcurrency = options.concurrency || 3;
        this.perDomainConcurrency = options.perDomainConcurrency || 1;
        this.requestDelay = options.requestDelay || 2000; // ms
        this.maxRetries = options.maxRetries || 3;
        this.backoffBase = options.backoffBase || 2;

        // Track active requests per domain
        this.domainQueues = new Map();
        this.domainActive = new Map();
        this.lastRequestTime = new Map();
        this.globalActive = 0;
    }

    /**
     * Get domain from URL
     * @param {string} url 
     * @returns {string} Domain name
     */
    getDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return 'unknown';
        }
    }

    /**
     * Wait for specified duration
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise}
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Calculate backoff delay for retries
     * @param {number} attempt - Current attempt number (0-indexed)
     * @returns {number} Delay in milliseconds
     */
    calculateBackoff(attempt) {
        return this.requestDelay * Math.pow(this.backoffBase, attempt);
    }

    /**
     * Check if domain can accept new request
     * @param {string} domain 
     * @returns {boolean}
     */
    canRequestDomain(domain) {
        const active = this.domainActive.get(domain) || 0;
        return active < this.perDomainConcurrency;
    }

    /**
     * Check if enough time has passed since last request to domain
     * @param {string} domain 
     * @returns {boolean}
     */
    async enforceDelay(domain) {
        const lastTime = this.lastRequestTime.get(domain);
        if (lastTime) {
            const elapsed = Date.now() - lastTime;
            if (elapsed < this.requestDelay) {
                await this.sleep(this.requestDelay - elapsed);
            }
        }
    }

    /**
     * Execute function with rate limiting and retry logic
     * @param {string} url - URL being requested
     * @param {Function} fn - Async function to execute
     * @param {number} attempt - Current attempt number
     * @returns {Promise} Result of function
     */
    async execute(url, fn, attempt = 0) {
        const domain = this.getDomain(url);

        // Wait if global concurrency limit reached
        while (this.globalActive >= this.globalConcurrency) {
            await this.sleep(100);
        }

        // Wait if domain concurrency limit reached
        while (!this.canRequestDomain(domain)) {
            await this.sleep(100);
        }

        // Enforce delay between requests to same domain
        await this.enforceDelay(domain);

        // Increment counters
        this.globalActive++;
        this.domainActive.set(domain, (this.domainActive.get(domain) || 0) + 1);
        this.lastRequestTime.set(domain, Date.now());

        try {
            const result = await fn();
            return result;
        } catch (error) {
            // Check if we should retry
            if (attempt < this.maxRetries && this.shouldRetry(error)) {
                const backoffDelay = this.calculateBackoff(attempt);
                console.log(`Retry ${attempt + 1}/${this.maxRetries} for ${url} after ${backoffDelay}ms`);
                await this.sleep(backoffDelay);

                // Retry recursively
                return this.execute(url, fn, attempt + 1);
            }

            // Max retries exceeded or non-retryable error
            throw error;
        } finally {
            // Decrement counters
            this.globalActive--;
            this.domainActive.set(domain, (this.domainActive.get(domain) || 1) - 1);
        }
    }

    /**
     * Determine if error is retryable
     * @param {Error} error 
     * @returns {boolean}
     */
    shouldRetry(error) {
        // Retry on network errors, timeouts, and 5xx/429 status codes
        if (error.message.includes('timeout')) return true;
        if (error.message.includes('ECONNRESET')) return true;
        if (error.message.includes('ETIMEDOUT')) return true;

        // Check for HTTP status codes in error
        const statusMatch = error.message.match(/(\d{3})/);
        if (statusMatch) {
            const status = parseInt(statusMatch[1]);
            return status === 429 || status >= 500;
        }

        return false;
    }

    /**
     * Get current statistics
     * @returns {Object} Stats object
     */
    getStats() {
        return {
            globalActive: this.globalActive,
            domainsTracked: this.domainActive.size,
            domainBreakdown: Object.fromEntries(this.domainActive)
        };
    }
}

module.exports = RateLimiter;
