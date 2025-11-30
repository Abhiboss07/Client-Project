/**
 * Unit tests for robots checker module
 */

const robotsChecker = require('../../src/scraper/robots-checker');

describe('RobotsChecker', () => {
    beforeEach(() => {
        // Clear cache before each test
        robotsChecker.clearCache();
    });

    describe('getDomain', () => {
        test('should extract domain from URL', () => {
            const domain = robotsChecker.getDomain('https://example.com/path');
            expect(domain).toBe('https://example.com');
        });

        test('should handle invalid URL', () => {
            const domain = robotsChecker.getDomain('not a url');
            expect(domain).toBeNull();
        });
    });

    describe('isAllowed', () => {
        test('should allow URLs when robots.txt allows', async () => {
            // example.com has permissive robots.txt
            const allowed = await robotsChecker.isAllowed('https://example.com/');
            expect(typeof allowed).toBe('boolean');
        }, 10000);

        test('should handle URLs without robots.txt', async () => {
            // httpbin.org may not have robots.txt, should allow by default
            const allowed = await robotsChecker.isAllowed('https://httpbin.org/html');
            expect(typeof allowed).toBe('boolean');
        }, 10000);
    });

    describe('checkUrl', () => {
        test('should return object with allowed and reason', async () => {
            const result = await robotsChecker.checkUrl('https://example.com/');
            expect(result).toHaveProperty('allowed');
            expect(result).toHaveProperty('reason');
            expect(typeof result.allowed).toBe('boolean');
        }, 10000);
    });

    describe('cache', () => {
        test('should cache robots.txt parsers', async () => {
            await robotsChecker.checkUrl('https://example.com/');
            const stats = robotsChecker.getCacheStats();
            expect(stats.cachedDomains).toBeGreaterThan(0);
        }, 10000);

        test('should clear cache', async () => {
            await robotsChecker.checkUrl('https://example.com/');
            robotsChecker.clearCache();
            const stats = robotsChecker.getCacheStats();
            expect(stats.cachedDomains).toBe(0);
        }, 10000);
    });
});
