const { extractEmails, extractPhones, cleanText, calculateConfidence } = require('../utils/validators');
const { logger } = require('../utils/logger');

/**
 * Data extraction module
 * Extracts client information from page content using multiple strategies:
 * - CSS selectors with fallbacks
 * - Regex patterns
 * - Heuristic analysis
 */

class DataExtractor {
    constructor() {
        // Common CSS selectors for different fields
        this.selectors = {
            name: [
                'h1[class*="name"]',
                '[class*="profile-name"]',
                '[itemprop="name"]',
                '.name',
                '#name',
                'h1',
                'h2'
            ],
            title: [
                '[class*="title"]',
                '[class*="headline"]',
                '[itemprop="jobTitle"]',
                '.job-title',
                '.position',
                '.role'
            ],
            company: [
                '[class*="company"]',
                '[itemprop="worksFor"]',
                '[class*="organization"]',
                '.employer',
                '.org'
            ],
            location: [
                '[class*="location"]',
                '[itemprop="address"]',
                '[class*="locality"]',
                '.address',
                '.city'
            ],
            about: [
                '[class*="about"]',
                '[class*="bio"]',
                '[class*="summary"]',
                '[class*="description"]',
                '.about',
                '.bio',
                'p'
            ],
            email: [
                'a[href^="mailto:"]',
                '[itemprop="email"]',
                '[class*="email"]'
            ],
            phone: [
                'a[href^="tel:"]',
                '[itemprop="telephone"]',
                '[class*="phone"]'
            ],
            website: [
                'a[class*="website"]',
                'a[rel="me"]',
                '[itemprop="url"]'
            ]
        };

        // Social media domains
        this.socialDomains = [
            'linkedin.com',
            'twitter.com',
            'facebook.com',
            'github.com',
            'instagram.com',
            'youtube.com'
        ];
    }

    /**
     * Try multiple selectors and return first match
     * @param {Object} page - Playwright page object
     * @param {Array<string>} selectors - Array of CSS selectors
     * @returns {Promise<string|null>} Text content or null
     */
    async trySelectors(page, selectors) {
        for (const selector of selectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    if (text && text.trim().length > 0) {
                        return cleanText(text);
                    }
                }
            } catch (error) {
                // Selector failed, try next one
                continue;
            }
        }
        return null;
    }

    /**
     * Extract email from page
     * @param {Object} page - Playwright page
     * @param {string} pageText - Full page text
     * @returns {Promise<string>} Email address
     */
    async extractEmail(page, pageText) {
        // Try mailto links first
        try {
            const mailtoLinks = await page.$$eval('a[href^="mailto:"]', links =>
                links.map(l => l.href.replace('mailto:', ''))
            );
            if (mailtoLinks.length > 0) {
                return mailtoLinks[0];
            }
        } catch (error) {
            // Continue to regex extraction
        }

        // Try CSS selectors
        const selectorEmail = await this.trySelectors(page, this.selectors.email);
        if (selectorEmail && selectorEmail.includes('@')) {
            return selectorEmail;
        }

        // Fall back to regex extraction from page text
        const emails = extractEmails(pageText);
        return emails.length > 0 ? emails[0] : '';
    }

    /**
     * Extract phone from page
     * @param {Object} page - Playwright page
     * @param {string} pageText - Full page text
     * @returns {Promise<string>} Phone number
     */
    async extractPhone(page, pageText) {
        // Try tel links first
        try {
            const telLinks = await page.$$eval('a[href^="tel:"]', links =>
                links.map(l => l.href.replace('tel:', '').replace(/\+/g, ''))
            );
            if (telLinks.length > 0) {
                return telLinks[0];
            }
        } catch (error) {
            // Continue to regex extraction
        }

        // Try CSS selectors
        const selectorPhone = await this.trySelectors(page, this.selectors.phone);
        if (selectorPhone) {
            return selectorPhone;
        }

        // Fall back to regex extraction from page text
        const phones = extractPhones(pageText);
        return phones.length > 0 ? phones[0] : '';
    }

    /**
     * Extract social media links
     * @param {Object} page - Playwright page
     * @returns {Promise<Array<string>>} Array of social media URLs
     */
    async extractSocialLinks(page) {
        try {
            const links = await page.$$eval('a[href]', anchors =>
                anchors.map(a => a.href)
            );

            const socialLinks = links.filter(link => {
                try {
                    const url = new URL(link);
                    return this.socialDomains.some(domain => url.hostname.includes(domain));
                } catch {
                    return false;
                }
            });

            return [...new Set(socialLinks)]; // Remove duplicates
        } catch (error) {
            logger.warn(`Error extracting social links: ${error.message}`);
            return [];
        }
    }

    /**
     * Extract website URL (excluding social media)
     * @param {Object} page - Playwright page
     * @param {string} sourceUrl - Original source URL
     * @returns {Promise<string>} Website URL
     */
    async extractWebsite(page, sourceUrl) {
        try {
            const links = await page.$$eval('a[href]', anchors =>
                anchors.map(a => ({ href: a.href, text: a.textContent.toLowerCase() }))
            );

            // Look for links labeled as "website", "homepage", etc.
            const websiteLink = links.find(link =>
                link.text.includes('website') ||
                link.text.includes('homepage') ||
                link.text.includes('portfolio')
            );

            if (websiteLink) {
                return websiteLink.href;
            }

            // Try selector-based extraction
            const selectorWebsite = await this.trySelectors(page, this.selectors.website);
            if (selectorWebsite) {
                return selectorWebsite;
            }

            // Default to source URL if no specific website found
            return sourceUrl;
        } catch (error) {
            return sourceUrl;
        }
    }

    /**
     * Extract all data from page
     * @param {Object} page - Playwright page
     * @param {string} sourceUrl - Original URL
     * @returns {Promise<Object>} Extracted data
     */
    async extract(page, sourceUrl) {
        try {
            // Get full page text for regex-based extraction
            const pageText = await page.textContent('body').catch(() => '');

            // Extract all fields
            const name = await this.trySelectors(page, this.selectors.name) || '';
            const title = await this.trySelectors(page, this.selectors.title) || '';
            const company = await this.trySelectors(page, this.selectors.company) || '';
            const location = await this.trySelectors(page, this.selectors.location) || '';
            const email = await this.extractEmail(page, pageText);
            const phone = await this.extractPhone(page, pageText);
            const website = await this.extractWebsite(page, sourceUrl);
            const socialLinks = await this.extractSocialLinks(page);

            // Extract about snippet (first 200 chars)
            const about = await this.trySelectors(page, this.selectors.about) || '';
            const aboutSnippet = about.substring(0, 200);

            // Get raw text snippet (first 500 chars of page text)
            const rawTextSnippet = cleanText(pageText).substring(0, 500);

            // Prepare data object
            const data = {
                source_url: sourceUrl,
                name,
                title,
                company,
                location,
                email,
                website,
                social_links: socialLinks.join(', '),
                phone,
                about_snippet: aboutSnippet,
                found_on_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
                raw_text_snippet: rawTextSnippet
            };

            // Calculate confidence score
            data.extraction_confidence = calculateConfidence(data);

            logger.debug(`Extracted data from ${sourceUrl}:`, {
                name,
                email,
                confidence: data.extraction_confidence
            });

            return data;
        } catch (error) {
            logger.error(`Error extracting data from ${sourceUrl}:`, error);
            throw error;
        }
    }
}

module.exports = DataExtractor;
