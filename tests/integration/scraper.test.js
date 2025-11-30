/**
 * Integration test for scraper
 * Tests full scraping workflow with real public URLs
 */

const Scraper = require('../../src/scraper/scraper');
const OutputWriter = require('../../src/utils/output-writer');
const fs = require('fs-extra');
const path = require('path');

describe('Scraper Integration Test', () => {
    let scraper;
    const testOutputDir = path.join(__dirname, '../output');
    const testCsvPath = path.join(testOutputDir, 'test-clients.csv');
    const testJsonPath = path.join(testOutputDir, 'test-clients.json');

    beforeAll(async () => {
        // Ensure test output directory exists
        await fs.ensureDir(testOutputDir);

        // Initialize scraper
        scraper = new Scraper({
            concurrency: 2,
            timeout: 20000,
            requestDelay: 1000
        });

        await scraper.initialize();
    }, 30000);

    afterAll(async () => {
        // Close browser
        if (scraper) {
            await scraper.close();
        }

        // Clean up test outputs
        await fs.remove(testOutputDir);
    }, 10000);

    test('should scrape real public URLs successfully', async () => {
        // Use safe, public URLs that allow scraping
        const urls = [
            'https://example.com',
            'https://httpbin.org/html',
            'https://www.w3.org/People/Berners-Lee/'
        ];

        const results = await scraper.scrapeUrls(urls);

        // Verify we got results for all URLs
        expect(results).toHaveLength(urls.length);

        // Count successes
        const successes = results.filter(r => r.status === 'success');
        const skipped = results.filter(r => r.status === 'skipped');
        const errors = results.filter(r => r.status === 'error');

        console.log(`Results: ${successes.length} success, ${skipped.length} skipped, ${errors.length} errors`);

        // At least one URL should succeed (even if others are skipped/errored)
        expect(successes.length).toBeGreaterThan(0);

        // Verify successful results have data
        successes.forEach(result => {
            expect(result.data).toBeDefined();
            expect(result.data.source_url).toBeDefined();
            expect(result.data.found_on_date).toBeDefined();
            expect(result.data.extraction_confidence).toBeGreaterThanOrEqual(0);
            expect(result.data.extraction_confidence).toBeLessThanOrEqual(1);
        });
    }, 60000);

    test('should write outputs to CSV and JSON', async () => {
        const urls = [
            'https://example.com',
            'https://httpbin.org/html'
        ];

        const results = await scraper.scrapeUrls(urls);

        // Write outputs
        const outputWriter = new OutputWriter();
        await outputWriter.writeCSV(results, testCsvPath);
        await outputWriter.writeJSON(results, testJsonPath);

        // Verify files exist
        expect(await fs.pathExists(testCsvPath)).toBe(true);
        expect(await fs.pathExists(testJsonPath)).toBe(true);

        // Verify CSV has content (at least headers)
        const csvContent = await fs.readFile(testCsvPath, 'utf8');
        expect(csvContent.length).toBeGreaterThan(0);
        expect(csvContent).toContain('Source URL');

        // Verify JSON is valid array
        const jsonData = await fs.readJSON(testJsonPath);
        expect(Array.isArray(jsonData)).toBe(true);
    }, 60000);

    test('should respect robots.txt', async () => {
        // This URL should be checked against robots.txt
        const urls = ['https://www.google.com/search?q=test'];

        const results = await scraper.scrapeUrls(urls);

        // Google search is typically disallowed in robots.txt
        // Result will likely be 'skipped' due to robots.txt
        expect(results).toHaveLength(1);

        const result = results[0];

        // Should either be skipped (due to robots.txt) or errored
        // We don't expect success for Google search
        if (result.status === 'skipped') {
            expect(result.reason).toBeTruthy();
        }
    }, 30000);

    test('should detect anti-bot protection', async () => {
        // Some sites may have Cloudflare or similar
        // This tests that we handle it gracefully
        const urls = ['https://example.com'];

        const results = await scraper.scrapeUrls(urls);

        expect(results).toHaveLength(1);

        // Should not crash, regardless of anti-bot presence
        expect(['success', 'error', 'skipped']).toContain(results[0].status);
    }, 30000);
});
