/**
 * Unit tests for validators module
 */

const {
    normalizeUrl,
    extractEmails,
    extractPhones,
    isValidEmail,
    isValidUrl,
    calculateConfidence,
    cleanText
} = require('../../src/utils/validators');

describe('Validators', () => {
    describe('normalizeUrl', () => {
        test('should add https protocol if missing', () => {
            expect(normalizeUrl('example.com')).toBe('https://example.com');
        });

        test('should remove trailing slash', () => {
            expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
        });

        test('should preserve search params', () => {
            expect(normalizeUrl('https://example.com?foo=bar')).toBe('https://example.com?foo=bar');
        });

        test('should handle invalid URLs gracefully', () => {
            expect(normalizeUrl('not a url')).toBe('not a url');
        });
    });

    describe('extractEmails', () => {
        test('should extract valid emails from text', () => {
            const text = 'Contact us at john.doe@example.com or support@company.org';
            const emails = extractEmails(text);
            expect(emails).toContain('john.doe@example.com');
            expect(emails).toContain('support@company.org');
        });

        test('should filter out image extensions', () => {
            const text = 'Image at logo@image.png and contact@example.com';
            const emails = extractEmails(text);
            expect(emails).not.toContain('logo@image.png');
            expect(emails).toContain('contact@example.com');
        });

        test('should return empty array for no emails', () => {
            const text = 'No emails here!';
            const emails = extractEmails(text);
            expect(emails).toEqual([]);
        });
    });

    describe('extractPhones', () => {
        test('should extract US format phone numbers', () => {
            const text = 'Call us at (123) 456-7890 or 987-654-3210';
            const phones = extractPhones(text);
            expect(phones.length).toBeGreaterThan(0);
        });

        test('should extract international format', () => {
            const text = 'International: +1-234-567-8900';
            const phones = extractPhones(text);
            expect(phones.length).toBeGreaterThan(0);
        });

        test('should extract Indian format', () => {
            const text = 'Phone: +91 98765 43210';
            const phones = extractPhones(text);
            expect(phones.length).toBeGreaterThan(0);
        });

        test('should return empty array for no phones', () => {
            const text = 'No phone numbers here!';
            const phones = extractPhones(text);
            expect(phones).toEqual([]);
        });
    });

    describe('isValidEmail', () => {
        test('should validate correct email', () => {
            expect(isValidEmail('test@example.com')).toBe(true);
        });

        test('should reject invalid email', () => {
            expect(isValidEmail('not-an-email')).toBe(false);
            expect(isValidEmail('missing@domain')).toBe(false);
        });
    });

    describe('isValidUrl', () => {
        test('should validate correct URL', () => {
            expect(isValidUrl('https://example.com')).toBe(true);
        });

        test('should reject invalid URL', () => {
            expect(isValidUrl('not a url')).toBe(false);
        });
    });

    describe('calculateConfidence', () => {
        test('should return high confidence for complete data', () => {
            const data = {
                name: 'John Doe',
                email: 'john@example.com',
                company: 'Acme Inc',
                title: 'Engineer',
                website: 'https://example.com',
                phone: '123-456-7890',
                location: 'New York',
                about_snippet: 'About me...'
            };
            const confidence = calculateConfidence(data);
            expect(confidence).toBeGreaterThan(0.8);
        });

        test('should return low confidence for sparse data', () => {
            const data = {
                name: 'John Doe',
                email: '',
                company: '',
                title: '',
                website: '',
                phone: '',
                location: '',
                about_snippet: ''
            };
            const confidence = calculateConfidence(data);
            expect(confidence).toBeLessThan(0.5);
        });

        test('should be between 0 and 1', () => {
            const data = { name: 'Test' };
            const confidence = calculateConfidence(data);
            expect(confidence).toBeGreaterThanOrEqual(0);
            expect(confidence).toBeLessThanOrEqual(1);
        });
    });

    describe('cleanText', () => {
        test('should remove extra whitespace', () => {
            expect(cleanText('Hello    World')).toBe('Hello World');
        });

        test('should remove newlines', () => {
            expect(cleanText('Hello\nWorld')).toBe('Hello World');
        });

        test('should trim leading and trailing spaces', () => {
            expect(cleanText('  Hello World  ')).toBe('Hello World');
        });
    });
});
