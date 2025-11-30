const { chromium } = require('playwright');
const { createObjectCsvWriter } = require('csv-writer');
const FakeUserAgent = require('fake-useragent');
const config = require('./config');
const { logger, delay, cleanText } = require('./utils');

class ClientScraper {
    constructor() {
        this.browser = null;
        this.context = null;
        this.results = [];
        this.stats = {
            total: 0,
            success: 0,
            failed: 0,
            skipped: 0,
        };
    }

    async init() {
        const launchOptions = {
            headless: true,
        };

        if (config.proxy) {
            launchOptions.proxy = {
                server: config.proxy,
            };
        }

        this.browser = await chromium.launch(launchOptions);
    }

    async getContext() {
        const userAgent = config.userAgentRotation ? new FakeUserAgent().random : 'Mozilla/5.0';
        return await this.browser.newContext({
            userAgent: userAgent,
            viewport: { width: 1280, height: 720 },
        });
    }

    async scrapeUrl(url) {
        this.stats.total++;
        let context;
        let page;

        try {
            context = await this.getContext();
            page = await context.newPage();

            logger.info(`Processing: ${url}`);

            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.timeout });
            } catch (e) {
                logger.error(`Failed to load ${url}: ${e.message}`);
                this.stats.failed++;
                return;
            }

            // Anti-bot detection (Cloudflare/Captcha)
            const title = await page.title();
            const content = await page.content();

            if (
                title.includes('Just a moment...') ||
                title.includes('Attention Required!') ||
                content.includes('cf-challenge') ||
                content.includes('g-recaptcha')
            ) {
                logger.warn(`Cloudflare/Captcha detected on ${url}. Skipping.`);
                this.stats.skipped++;
                return;
            }

            // Extraction Logic
            const data = await this.extractData(page, url);

            if (data) {
                this.results.push(data);
                this.stats.success++;
                logger.info(`Successfully scraped ${url}`);
            } else {
                this.stats.failed++;
                logger.warn(`No data extracted from ${url}`);
            }

            await delay(config.minDelay, config.maxDelay);

        } catch (error) {
            logger.error(`Error processing ${url}: ${error.message}`);
            this.stats.failed++;
        } finally {
            if (page) await page.close();
            if (context) await context.close();
        }
    }

    async extractData(page, url) {
        // Heuristic extraction
        const extract = async (selectors) => {
            for (const selector of selectors) {
                try {
                    const el = await page.$(selector);
                    if (el) {
                        return cleanText(await el.innerText());
                    }
                } catch (e) { }
            }
            return '';
        };

        const name = await extract(['h1', '.profile-name', '.fullname', 'title']);
        const title = await extract(['.job-title', '.headline', 'h2']);
        const company = await extract(['.company', '.business-name', '.org']);
        const location = await extract(['.location', '.address', '.city']);

        // Email extraction (simple regex on body)
        const bodyText = await page.evaluate(() => document.body.innerText);
        const emailMatch = bodyText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
        const email = emailMatch ? emailMatch[0] : '';

        // Social links
        const socialLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            return links
                .map(a => a.href)
                .filter(href => href.includes('linkedin.com') || href.includes('twitter.com') || href.includes('github.com'))
                .join(', ');
        });

        return {
            source_url: url,
            name,
            title,
            company,
            location,
            email,
            website: '', // Hard to guess generically
            social_links: socialLinks,
            notes: '',
        };
    }

    async saveResults() {
        if (this.results.length === 0) {
            logger.warn('No results to save.');
            return;
        }

        const csvWriter = createObjectCsvWriter({
            path: config.outputFile,
            header: [
                { id: 'source_url', title: 'Source URL' },
                { id: 'name', title: 'Name' },
                { id: 'title', title: 'Title' },
                { id: 'company', title: 'Company' },
                { id: 'location', title: 'Location' },
                { id: 'email', title: 'Email' },
                { id: 'website', title: 'Website' },
                { id: 'social_links', title: 'Social Links' },
                { id: 'notes', title: 'Notes' },
            ],
        });

        await csvWriter.writeRecords(this.results);
        logger.info(`Results saved to ${config.outputFile}`);
    }

    async run(urls) {
        await this.init();

        for (const url of urls) {
            await this.scrapeUrl(url);
        }

        await this.browser.close();
        await this.saveResults();

        this.printSummary();
    }

    printSummary() {
        console.log('\n--- Scraper Summary ---');
        console.log(`Total URLs: ${this.stats.total}`);
        console.log(`Success: ${this.stats.success}`);
        console.log(`Failed: ${this.stats.failed}`);
        console.log(`Skipped: ${this.stats.skipped}`);
        console.log(`Output: ${config.outputFile}`);
        console.log('-----------------------\n');
    }
}

// Run if called directly
if (require.main === module) {
    // Example usage or CLI args could go here
    // For now, we expect a list of URLs or a file
    // This part is left simple as the test runner drives it mostly
    logger.info('Scraper loaded. Use test runner or import to use.');
}

module.exports = ClientScraper;
