const fs = require('fs');
const path = require('path');
const ClientScraper = require('../src/scraper');
const config = require('../src/config');
const { logger } = require('../src/utils');

async function runTest() {
    try {
        const urlsPath = path.join(__dirname, '../test_urls.json');
        const urls = JSON.parse(fs.readFileSync(urlsPath, 'utf8'));

        logger.info(`Loaded ${urls.length} test URLs.`);

        const scraper = new ClientScraper();
        await scraper.run(urls);

        // Verify CSV
        if (fs.existsSync(config.outputFile)) {
            const stats = fs.statSync(config.outputFile);
            if (stats.size > 0) {
                logger.info('TEST PASSED: clients.csv created and not empty.');
            } else {
                logger.error('TEST FAILED: clients.csv is empty.');
                process.exit(1);
            }
        } else {
            logger.error('TEST FAILED: clients.csv not found.');
            process.exit(1);
        }

    } catch (error) {
        logger.error(`TEST FAILED: ${error.message}`);
        process.exit(1);
    }
}

runTest();
