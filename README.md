# Client Data Aggregator

A production-ready web scraping tool that aggregates publicly available client data from URLs using Playwright. Built with comprehensive testing, robots.txt compliance, anti-bot detection, and ethical scraping practices.

## 🚀 Features

- **Robust Data Extraction**: Extracts name, title, company, location, email, phone, website, and social links
- **Multi-Strategy Extraction**: CSS selectors with fallbacks + regex patterns for reliable data capture
- **Robots.txt Compliance**: Automatically checks and respects robots.txt before scraping
- **Anti-Bot Detection**: Detects and skips Cloudflare, reCAPTCHA, and other anti-bot measures
- **Rate Limiting**: Per-domain concurrency control with exponential backoff
- **Retry Logic**: Automatic retries for 429/5xx errors with intelligent backoff
- **Confidence Scoring**: Each extraction includes a 0-1 confidence score
- **Multiple Output Formats**: CSV, JSON, and Excel export
- **Comprehensive Logging**: Detailed per-URL logs and final summary reports
- **CLI Interface**: Full-featured command-line interface with multiple options
- **Production-Ready**: Proxy support, user-agent rotation, and configurable delays

## 📦 Installation

### Prerequisites
- Node.js >= 18
- npm or yarn

### Install Dependencies

```bash
npm install
```

This will install:
- `playwright` - Browser automation
- `winston` - Logging
- `csv-writer` & `xlsx` - Output formats
- `commander` - CLI framework
- `robots-parser` - Robots.txt parsing
- `jest` - Testing framework
- Other utilities

## 🎯 Quick Start

### 1. Prepare Input URLs

Create a JSON file with URLs to scrape (or use the default `data/test_urls.json`):

```json
[
  "https://example.com/profile1",
  "https://example.com/profile2"
]
```

### 2. Run the Scraper

```bash
npm run scrape
```

Or with custom options:

```bash
node scripts/run-scraper.js --input data/my_urls.json --concurrency 5
```

### 3. View Results

Outputs will be saved to:
- `data/clients.csv` - CSV format
- `data/clients.json` - JSON format  
- `data/run-YYYYMMDD-HHMMSS.log` - Detailed execution log

## ⚙️ Configuration

### Environment Variables

Copy the example configuration:

```bash
cp config/.env.example .env
```

Then edit `.env` with your settings:

```env
# Scraping Configuration
CONCURRENCY=3
REQUEST_DELAY_MS=2000
MAX_RETRIES=3
TIMEOUT_MS=30000

# Rate Limiting
PER_DOMAIN_CONCURRENCY=1
EXPONENTIAL_BACKOFF_BASE=2

# Logging
LOG_LEVEL=info

# Proxy Configuration (optional)
# USE_PROXY=true
# PROXY_URL=http://username:password@proxy-host:port
```

### CLI Options

```bash
node scripts/run-scraper.js [options]

Options:
  -i, --input <path>          Input JSON file with URLs (default: data/test_urls.json)
  -c, --output-csv <path>     Output CSV file path (default: data/clients.csv)
  -j, --output-json <path>    Output JSON file path (default: data/clients.json)
  -n, --concurrency <number>  Concurrency level (default: 3)
  -p, --use-proxy <boolean>   Use proxy true/false (default: false)
  -h, --help                  Display help
```

### Proxy Setup

For high-volume scraping, configure proxies in `.env`:

```env
USE_PROXY=true
PROXY_URL=http://username:password@proxy-host:port
```

**NOTE**: Never commit `.env` file to version control. Secrets should only be in your local `.env` file.

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run Unit Tests Only

```bash
npm run test:unit
```

### Run Integration Tests Only

```bash
npm run test:integration
```

### Test Coverage

The test suite includes:
- **Unit Tests**: Validators, robots.txt checker, utility functions
- **Integration Tests**: Full scraping workflow with real public URLs
- **Fixtures**: Safe public URLs (example.com, httpbin.org, w3.org)

## 📖 Usage Examples

### Basic Usage

```bash
node scripts/run-scraper.js
```

### Custom Input and Output

```bash
node scripts/run-scraper.js \
  --input my_leads.json \
  --output-csv results/leads.csv \
  --output-json results/leads.json
```

### High Concurrency with Proxy

```bash
node scripts/run-scraper.js \
  --concurrency 10 \
  --use-proxy true
```

## 🏗️ Architecture

### Project Structure

```
client-data-aggregator/
├── src/
│   ├── scraper/
│   │   ├── scraper.js         # Main scraper class
│   │   ├── extractor.js       # Data extraction logic
│   │   └── robots-checker.js  # Robots.txt compliance
│   └── utils/
│       ├── logger.js          # Winston logging
│       ├── validators.js      # Email/phone extraction, validation
│       ├── rate-limiter.js    # Rate limiting and retry logic
│       └── output-writer.js   # CSV/JSON/Excel writers
├── scripts/
│   └── run-scraper.js         # CLI entry point
├── tests/
│   ├── unit/                  # Unit tests
│   └── integration/           # Integration tests
├── config/
│   └── .env.example           # Configuration template
├── data/                      # Input URLs and outputs
└── docs/                      # Additional documentation
```

### Key Modules

1. **Scraper** (`src/scraper/scraper.js`): Coordinates browser, rate limiting, and extraction
2. **Extractor** (`src/scraper/extractor.js`): CSS selectors + regex for data extraction
3. **RobotsChecker** (`src/scraper/robots-checker.js`): Fetches and parses robots.txt
4. **RateLimiter** (`src/utils/rate-limiter.js`): Per-domain queuing and exponential backoff
5. **OutputWriter** (`src/utils/output-writer.js`): Exports to CSV, JSON, Excel

## ⚖️ Ethical & Legal Compliance

### ✅ What This Tool Does

- Scrapes **only publicly visible** data from web pages
- Respects `robots.txt` directives
- Implements polite delays and rate limiting
- Detects and skips anti-bot protection (no bypassing)
- Provides detailed logging for transparency

### ❌ What This Tool Does NOT Do

- Does **not** attempt to bypass login/authentication
- Does **not** access paywalled or private content
- Does **not** bypass CAPTCHAs using third-party services
- Does **not** violate Terms of Service

### Legal Considerations

- **India DPDP Act 2023**: Only collect data that is publicly available and lawful to process
- **GDPR (EU)**: Be aware of data protection regulations if processing EU personal data
- **Terms of Service**: Review ToS of target sites; skip domains that explicitly prohibit scraping
- **Robots.txt**: This tool automatically respects robots.txt; do not disable this feature

### Best Practices

1. **Start Small**: Test on a few URLs before scaling
2. **Respect Rate Limits**: Use appropriate delays (default: 2000ms)
3. **Use Proxies Responsibly**: Only use legitimate proxy services
4. **Monitor Logs**: Check for blocked/skipped URLs and adjust accordingly
5. **Data Minimization**: Only extract what you need
6. **Secure Storage**: Protect scraped data; do not share publicly without consent

## 🚀 Production Deployment

### Scaling Considerations

1. **Queue System**: For 1000+ URLs, use Redis + Bull for job queuing
2. **Distributed Scraping**: Deploy multiple instances with shared queue
3. **Proxy Rotation**: Use residential proxy service (Bright Data, Smartproxy, etc.)
4. **Database Storage**: Store results in PostgreSQL or MongoDB instead of CSV
5. **Monitoring**: Use Prometheus + Grafana for metrics and alerts

### CAPTCHA Handling

This tool **does not** attempt to solve CAPTCHAs. Options:

- **Skip**: Log and skip CAPTCHA-protected URLs (default behavior)
- **Manual Review**: Flag CAPTCHA URLs for manual processing
- **Alternative Sources**: Find alternative public sources for the same data
- **Legitimate APIs**: Use official APIs where available (preferred)

### Recommended Infrastructure

- **VPS**: DigitalOcean, AWS EC2, GCP Compute Engine
- **Proxy**: Residential proxies for high-volume scraping
- **Storage**: Cloud storage (S3, GCS) for outputs
- **Monitoring**: CloudWatch, Datadog, or self-hosted Prometheus

## 🐛 Troubleshooting

### Common Issues

**Tests Failing**

```bash
# Install Playwright browsers
npx playwright install chromium
```

**Timeout Errors**

Increase timeout in `.env`:
```env
TIMEOUT_MS=60000
```

**Proxy Not Working**

Verify proxy URL format:
```env
PROXY_URL=http://username:password@host:port
```

**Anti-Bot Detection**

Reduce concurrency and increase delays:
```env
CONCURRENCY=1
REQUEST_DELAY_MS=5000
```

## 📝 License

ISC

## 🤝 Contributing

Contributions welcome! Please ensure:
- All tests pass (`npm test`)
- Code follows existing style
- Ethical guidelines are maintained
- No secrets in commits

## 📧 Support

For issues or questions:
1. Check logs in `data/run-*.log`
2. Review test results (`npm test`)
3. Check configuration in `.env`

## 🔧 Development Notes

### Adding New Selectors

Edit `src/scraper/extractor.js` and add to the `selectors` object:

```javascript
this.selectors = {
  newField: [
    '[class*="new-field"]',
    '[itemprop="newField"]',
    '.new-field'
  ]
};
```

### Custom Output Formats

Create a new writer in `src/utils/output-writer.js`:

```javascript
async writeCustomFormat(results, filepath) {
  // Your custom logic
}
```

### Rate Limit Tuning

Adjust in `src/utils/rate-limiter.js` or via environment variables.

---

**⚠️ IMPORTANT**: This tool is for educational and legitimate business purposes only. Always ensure compliance with local laws and site Terms of Service. The developers are not responsible for misuse of this tool.
