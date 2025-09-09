import { Actor } from 'apify';
import { PlaywrightCrawler, log } from 'crawlee';

await Actor.init();

log.info('🔍 MINIMAL TEST: Just load page and screenshot');

const crawler = new PlaywrightCrawler({
    requestHandler: async ({ page, request }) => {
        log.info('📄 Loading page...');
        
        // Wait for page to load
        await page.waitForSelector('body');
        log.info('✅ Page loaded');
        
        // Take screenshot immediately
        const screenshot = await page.screenshot({ fullPage: true });
        log.info(`📸 Screenshot taken: ${screenshot.length} bytes`);
        
        // Save to dataset
        await Actor.pushData({
            url: request.url,
            screenshot: `data:image/png;base64,${screenshot.toString('base64')}`,
            screenshotSize: screenshot.length,
            timestamp: new Date().toISOString(),
            test: 'minimal'
        });
        
        log.info('✅ Done - no parsing, no clicking, just screenshot');
    },
    
    maxRequestsPerCrawl: 1,
    maxConcurrency: 1,
    
    // Use residential proxies
    proxyConfiguration: Actor.createProxyConfiguration({
        groups: ['RESIDENTIAL'],
        countryCode: 'US',
    }),
    
    launchContext: {
        launchOptions: {
            headless: true,
        }
    }
});

const requests = [{
    url: 'https://www.prorodeo.com/results',
    userData: { label: 'MINIMAL_TEST' }
}];

await crawler.run(requests);

log.info('🎯 Minimal test complete - check dataset for screenshot');

await Actor.exit();