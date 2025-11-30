const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const XLSX = require('xlsx');
const fs = require('fs-extra');
const path = require('path');
const { logger } = require('../utils/logger');

/**
 * Output writer module
 * Writes scraped data to CSV and JSON formats
 */

class OutputWriter {
    constructor() {
        this.csvHeaders = [
            { id: 'source_url', title: 'Source URL' },
            { id: 'name', title: 'Name' },
            { id: 'title', title: 'Title' },
            { id: 'company', title: 'Company' },
            { id: 'location', title: 'Location' },
            { id: 'email', title: 'Email' },
            { id: 'website', title: 'Website' },
            { id: 'social_links', title: 'Social Links' },
            { id: 'phone', title: 'Phone' },
            { id: 'about_snippet', title: 'About' },
            { id: 'found_on_date', title: 'Found On' },
            { id: 'raw_text_snippet', title: 'Raw Text Snippet' },
            { id: 'extraction_confidence', title: 'Confidence' }
        ];
    }

    /**
     * Extract data records from scrape results
     * @param {Array<Object>} results - Scrape results
     * @returns {Array<Object>} Data records
     */
    extractRecords(results) {
        return results
            .filter(result => result.status === 'success' && result.data)
            .map(result => result.data);
    }

    /**
     * Write data to CSV file
     * @param {Array<Object>} results - Scrape results
     * @param {string} filepath - Output file path
     * @returns {Promise<number>} Number of records written
     */
    async writeCSV(results, filepath) {
        try {
            // Ensure output directory exists
            const dir = path.dirname(filepath);
            await fs.ensureDir(dir);

            const records = this.extractRecords(results);

            if (records.length === 0) {
                logger.warn('No successful records to write to CSV');
                // Create empty file with headers
                const csvWriter = createCsvWriter({
                    path: filepath,
                    header: this.csvHeaders
                });
                await csvWriter.writeRecords([]);
                return 0;
            }

            const csvWriter = createCsvWriter({
                path: filepath,
                header: this.csvHeaders
            });

            await csvWriter.writeRecords(records);
            logger.info(`CSV written: ${filepath} (${records.length} records)`);

            return records.length;
        } catch (error) {
            logger.error(`Error writing CSV to ${filepath}:`, error);
            throw error;
        }
    }

    /**
     * Write data to JSON file
     * @param {Array<Object>} results - Scrape results
     * @param {string} filepath - Output file path
     * @returns {Promise<number>} Number of records written
     */
    async writeJSON(results, filepath) {
        try {
            // Ensure output directory exists
            const dir = path.dirname(filepath);
            await fs.ensureDir(dir);

            const records = this.extractRecords(results);

            await fs.writeJSON(filepath, records, { spaces: 2 });
            logger.info(`JSON written: ${filepath} (${records.length} records)`);

            return records.length;
        } catch (error) {
            logger.error(`Error writing JSON to ${filepath}:`, error);
            throw error;
        }
    }

    /**
     * Write data to Excel file (optional, bonus format)
     * @param {Array<Object>} results - Scrape results
     * @param {string} filepath - Output file path
     * @returns {Promise<number>} Number of records written
     */
    async writeExcel(results, filepath) {
        try {
            // Ensure output directory exists
            const dir = path.dirname(filepath);
            await fs.ensureDir(dir);

            const records = this.extractRecords(results);

            if (records.length === 0) {
                logger.warn('No successful records to write to Excel');
                return 0;
            }

            // Create workbook and worksheet
            const worksheet = XLSX.utils.json_to_sheet(records);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');

            // Write file
            XLSX.writeFile(workbook, filepath);
            logger.info(`Excel written: ${filepath} (${records.length} records)`);

            return records.length;
        } catch (error) {
            logger.error(`Error writing Excel to ${filepath}:`, error);
            throw error;
        }
    }

    /**
     * Write all output formats
     * @param {Array<Object>} results - Scrape results
     * @param {Object} options - Output options
     * @returns {Promise<Object>} Paths to output files
     */
    async writeAll(results, options = {}) {
        const csvPath = options.csvPath || './data/clients.csv';
        const jsonPath = options.jsonPath || './data/clients.json';
        const excelPath = options.excelPath;

        await this.writeCSV(results, csvPath);
        await this.writeJSON(results, jsonPath);

        const outputPaths = {
            csv: path.resolve(csvPath),
            json: path.resolve(jsonPath)
        };

        if (excelPath) {
            await this.writeExcel(results, excelPath);
            outputPaths.excel = path.resolve(excelPath);
        }

        return outputPaths;
    }
}

module.exports = OutputWriter;
