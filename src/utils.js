const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple(),
        }),
        new winston.transports.File({ filename: 'scraper.log' }),
    ],
});

// Random delay
const delay = (min, max) => {
    const time = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, time));
};

// Text cleaner
const cleanText = (text) => {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
};

module.exports = {
    logger,
    delay,
    cleanText,
};
