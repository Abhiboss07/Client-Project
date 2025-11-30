#!/usr/bin/env node

/**
 * CLI Script for Client Data Aggregator
 * Usage: node scripts/run-scraper.js [options]
 */

const { Command } = require('commander');
const path = require('path');
const fs = require('fs-extra');
const Scraper = require('../src/scraper/scraper');
const OutputWriter = require('../src/utils/output-writer');
const { logger, logSummary } = require('../src/utils/logger');

const program = new Command();

program
    .name('client-data-aggregator')
    .description('Scrape client data from public URLs')
    .version('1.0.0')
    .option('-i, --input <path>', 'Input JSON file with URLs', 'data/test_urls.json')
    .option('-c, --output-csv <path>', 'Output CSV file path', 'data/clients.csv')
    .option('-j, --output-json <path>', 'Output JSON file path', 'data/clients.json')
    .option('-n, --concurrency <number>', 'Concurrency level', '3')
    .option('-p, --use-proxy <boolean>', 'Use proxy (true/false)', 'false')
    .parse(process.argv);

const options = program.opts();

/**
 * Load URLs from input file
 * @param {string} filepath - Path to JSON file
 * @returns {Promise<Array<string>>} Array of URLs
 */
async function loadUrls(filepath) {
    try {
        const absolutePath = path.resolve(filepath);

        if (!await fs.pathExists(absolutePath)) {
            throw new Error(`Input file not found: ${absolutePath}`);
        }

        const data = await fs.readJSON(absolutePath);

        // Support different JSON formats
        if (Array.isArray(data)) {
            return data;
        } else if (data.urls && Array.isArray(data.urls)) {
            return data.urls;
        } else {
            throw new Error('Invalid input format. Expected array of URLs or {urls: [...]}');
        }
    } catch (error) {
        logger.error(`Error loading input file: ${error.message}`);
        throw error;
    }
}

/**
 * Calculate statistics from results
 * @param {Array<Object>} results 
 * @returns {Object} Statistics
 */
function calculateStats(results) {
    const stats = {
        total: results.length,
        successes: 0,
        failures: 0,
        skipped: 0,
        skippedReasons: {}
    };

    results.forEach(result => {
        if (result.status === 'success') {
            stats.successes++;
        } else if (result.status === 'error') {
            stats.failures++;
        } else if (result.status === 'skipped') {
            stats.skipped++;
            const reason = result.reason || 'Unknown';
            stats.skippedReasons[reason] = (stats.skippedReasons[reason] || 0) + 1;
        }
    });

    return stats;
}

/**
 * Main execution function
 */
async function main() {
    const startTime = Date.now();

    logger.info('='.repeat(60));
    logger.info('CLIENT DATA AGGREGATOR');
    logger.info('='.repeat(60));
    logger.info(`Input: ${options.input}`);
    logger.info(`Output CSV: ${options.outputCsv}`);
    logger.info(`Output JSON: ${options.outputJson}`);
    logger.info(`Concurrency: ${options.concurrency}`);
    logger.info(`Use Proxy: ${options.useProxy}`);
    logger.info('='.repeat(60));

    try {
        // Load URLs
        logger.info('Loading URLs from input file...');
        const urls = await loadUrls(options.input);
        logger.info(`Loaded ${urls.length} URLs`);

        if (urls.length === 0) {
            logger.warn('No URLs to scrape');
            process.exit(0);
        }

        // Initialize scraper
        const scraper = new Scraper({
            concurrency: parseInt(options.concurrency),
            useProxy: options.useProxy === 'true'
        });

        await scraper.initialize();

        // Scrape URLs
        logger.info('Starting scraping process...');
        const results = await scraper.scrapeUrls(urls);

        // Close browser
        await scraper.close();

        // Write outputs
        logger.info('Writing outputs...');
        const outputWriter = new OutputWriter();
        const outputPaths = await outputWriter.writeAll(results, {
            csvPath: options.outputCsv,
            jsonPath: options.outputJson
        });

        // Calculate statistics
        const duration = Date.now() - startTime;
        const stats = calculateStats(results);

        // Log summary
        const summary = {
            ...stats,
            duration,
            outputPaths
        };

        logSummary(summary);

        // Print skipped reasons if any
        if (stats.skipped > 0) {
            logger.info('\nSkipped URLs breakdown:');
            Object.entries(stats.skippedReasons).forEach(([reason, count]) => {
                logger.info(`  - ${reason}: ${count}`);
            });
        }

        // Exit with appropriate code
        process.exit(stats.failures > 0 ? 1 : 0);

    } catch (error) {
        logger.error('Fatal error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main, loadUrls, calculateStats };
