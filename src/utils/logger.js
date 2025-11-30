const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

// Ensure data directory exists
fs.ensureDirSync(path.join(__dirname, '../../data'));

// Generate timestamp for log filename
const timestamp = () => {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
};

const logFilename = `run-${timestamp()}.log`;
const logPath = path.join(__dirname, '../../data', logFilename);

// Create Winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    transports: [
        // Write all logs to file
        new winston.transports.File({
            filename: logPath,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        // Console output with colors
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'HH:mm:ss' }),
                winston.format.printf(({ level, message, timestamp, ...meta }) => {
                    let msg = `${timestamp} ${level}: ${message}`;
                    if (Object.keys(meta).length > 0 && meta.stack) {
                        msg += `\n${meta.stack}`;
                    }
                    return msg;
                })
            )
        })
    ]
});

// Export logger and utilities
module.exports = {
    logger,
    logPath,

    /**
     * Log URL processing status
     * @param {string} url - The URL being processed
     * @param {string} status - Status: 'success', 'error', 'skipped'
     * @param {Object} data - Additional data (extracted fields, error, etc.)
     */
    logUrlStatus(url, status, data = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            url,
            status,
            ...data
        };

        if (status === 'success') {
            logger.info(`✓ ${url}`, logEntry);
        } else if (status === 'error') {
            logger.error(`✗ ${url}`, logEntry);
        } else if (status === 'skipped') {
            logger.warn(`⊘ ${url}`, logEntry);
        }
    },

    /**
     * Log final summary
     * @param {Object} summary - { total, successes, failures, skipped, duration, outputPaths }
     */
    logSummary(summary) {
        logger.info('='.repeat(60));
        logger.info('SCRAPING SUMMARY');
        logger.info('='.repeat(60));
        logger.info(`Total URLs: ${summary.total}`);
        logger.info(`Successes: ${summary.successes}`);
        logger.info(`Failures: ${summary.failures}`);
        logger.info(`Skipped: ${summary.skipped}`);
        logger.info(`Duration: ${summary.duration}ms (${(summary.duration / 1000).toFixed(2)}s)`);
        logger.info(`CSV Output: ${summary.outputPaths.csv}`);
        logger.info(`JSON Output: ${summary.outputPaths.json}`);
        logger.info(`Log File: ${logPath}`);
        logger.info('='.repeat(60));

        // Also write summary to log file
        fs.appendFileSync(logPath, '\n\n' + JSON.stringify({ summary }, null, 2));
    }
};
