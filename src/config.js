const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  // Proxy configuration
  // Format: 'http://user:pass@host:port'
  proxy: process.env.PROXY_URL || null,

  // Scraper settings
  userAgentRotation: true,
  minDelay: 1000,
  maxDelay: 5000,
  timeout: 30000,

  // Output settings
  outputFile: process.env.OUTPUT_FILE || 'clients.csv',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};
