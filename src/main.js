import { Actor } from 'apify';
import { PlaywrightCrawler, log } from 'crawlee';
import { router } from './routes.js';
import { CRAWLER_CONFIG } from './constants.js';

await Actor.init();

// Get input configuration
const input = await Actor.getInput() ?? {};
const {
    startUrls = ['https://www.prorodeo.com/results'],
    maxRequestsPerCrawl = 100,
    maxConcurrency = 5,
    onlyCompleted = true,
    includeDaysheets = false,
    debug = false,
    useProxy = true, // Enable for production
    proxyConfiguration = null,
    skipProcessedUrls = [] // Array of URLs to skip (from n8n)
} = input;

// Set logging level
if (debug) {
    log.setLevel(log.LEVELS.DEBUG);
}

log.info('Starting PRCA Rodeo Results Scraper', {
    startUrls,
    maxRequestsPerCrawl,
    maxConcurrency,
    onlyCompleted,
    includeDaysheets,
    useProxy,
    proxyConfig: proxyConfiguration ? 'configured' : 'none'
});

// 🕵️ Proxy configuration for human-like IP addresses
const proxyConfig = useProxy ? {
    proxyConfiguration: await Actor.createProxyConfiguration({
        groups: ['RESIDENTIAL'],
        countryCode: 'US',
    })
} : {};

if (useProxy) {
    log.info('🕵️ Using residential proxies for stealth (US-based)');
} else {
    log.warning('⚠️ Running without proxies - may be blocked by bot detection');
}

// Create the crawler
const crawler = new PlaywrightCrawler({
    requestHandler: async ({ page, request, crawler }) => {
        const { label } = request.userData;
        
        if (label === 'LISTING') {
            log.info('🔍 Processing main results page...');
            
            // Wait for page to load
            await page.waitForSelector('body');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Take screenshot of main page
            const screenshot = await page.screenshot({ fullPage: true });
            await Actor.pushData({
                url: request.url,
                screenshot: `data:image/png;base64,${screenshot.toString('base64')}`,
                screenshotSize: screenshot.length,
                timestamp: new Date().toISOString(),
                type: 'listing_page'
            });
            
            // Find event URLs to screenshot
            const eventUrls = await page.evaluate(() => {
                const resultLinks = Array.from(document.querySelectorAll('a[href*="/result/"]'));
                const uniqueUrls = new Set();
                
                resultLinks.forEach(link => {
                    const href = link.href;
                    if (href && !href.includes('?')) {
                        uniqueUrls.add(href);
                    }
                });
                
                return Array.from(uniqueUrls);
            });
            
            log.info(`📋 Found ${eventUrls.length} unique event URLs to screenshot`);
            
            // Filter out already processed URLs
            const skipUrls = new Set(skipProcessedUrls.map(url => url.replace(/\?.*/, ''))); // Remove query params for comparison
            const newEventUrls = eventUrls.filter(url => !skipUrls.has(url));
            
            log.info(`📊 Filtering: ${eventUrls.length} total events, ${newEventUrls.length} new events to process`);
            
            // Limit number of events if specified
            const eventsToProcess = newEventUrls.slice(0, maxRequestsPerCrawl - 1); // -1 for main page
            
            // Enqueue event pages for screenshots
            const eventRequests = eventsToProcess.map(url => ({
                url: `${url}?resultsTab=text`,
                userData: { label: 'EVENT_RESULTS', baseUrl: url }
            }));
            
            await crawler.addRequests(eventRequests);
            
            if (includeDaysheets) {
                const daysheetRequests = eventsToProcess.map(url => ({
                    url: `${url}?resultsTab=daysheets`, 
                    userData: { label: 'EVENT_DAYSHEET', baseUrl: url }
                }));
                
                await crawler.addRequests(daysheetRequests);
            }
            
        } else if (label === 'EVENT_RESULTS') {
            log.info('📸 Taking screenshot of event results page...');
            
            await page.waitForSelector('body');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const screenshot = await page.screenshot({ fullPage: true });
            
            // Extract event ID from URL for easier tracking
            const eventId = request.userData.baseUrl.match(/\/(\d+)$/)?.[1] || 'unknown';
            
            await Actor.pushData({
                url: request.url,
                baseUrl: request.userData.baseUrl,
                eventId: eventId,
                screenshot: `data:image/png;base64,${screenshot.toString('base64')}`,
                screenshotSize: screenshot.length,
                timestamp: new Date().toISOString(),
                type: 'event_results'
            });
            
        } else if (label === 'EVENT_DAYSHEET') {
            log.info('📸 Taking screenshot of event daysheet page...');
            
            await page.waitForSelector('body');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const screenshot = await page.screenshot({ fullPage: true });
            
            // Extract event ID from URL for easier tracking
            const eventId = request.userData.baseUrl.match(/\/(\d+)$/)?.[1] || 'unknown';
            
            await Actor.pushData({
                url: request.url,
                baseUrl: request.userData.baseUrl,
                eventId: eventId,
                screenshot: `data:image/png;base64,${screenshot.toString('base64')}`,
                screenshotSize: screenshot.length,
                timestamp: new Date().toISOString(),
                type: 'event_daysheet'
            });
        }
    },
    maxRequestsPerCrawl,
    maxConcurrency,
    navigationTimeoutSecs: 60,
    maxRequestRetries: 1,
    requestHandlerTimeoutSecs: 60,
    ...proxyConfig, // Add proxy configuration if enabled
    
    // Human-like browser simulation
    preNavigationHooks: [
        async ({ page, request, log }) => {
            log.debug(`Pre-navigation hook for ${request.url}`);
            
            // 🎭 HUMAN SIMULATION: Realistic browser fingerprinting
            
            // Set realistic user agent (recent Chrome on Windows)
            await page.setExtraHTTPHeaders({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            });
            
            // Set realistic viewport (common 1920x1080 with some variance)
            await page.setViewportSize({
                width: 1920,
                height: 1080
            });
            
            // 🎭 STEALTH: Override automation detection
            await page.addInitScript(() => {
                // Remove webdriver property
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                
                // Mock realistic browser properties
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
                
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
                
                // Mock realistic screen properties
                Object.defineProperty(screen, 'availWidth', {
                    get: () => 1920,
                });
                Object.defineProperty(screen, 'availHeight', {
                    get: () => 1040,
                });
            });
            
            // 🎭 SELECTIVE RESOURCE BLOCKING (don't block everything - too suspicious)
            await page.route('**/*', async (route) => {
                const resourceType = route.request().resourceType();
                const url = route.request().url();
                
                // Only block the most bandwidth-heavy resources
                if (['image', 'media', 'font'].includes(resourceType)) {
                    await route.abort();
                } 
                // Block known tracking/analytics (but not all - some expected)
                else if (url.includes('googletagmanager.com') || url.includes('facebook.com/tr')) {
                    await route.abort();
                }
                else {
                    // Add realistic headers to requests
                    const headers = route.request().headers();
                    headers['sec-ch-ua'] = '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"';
                    headers['sec-ch-ua-mobile'] = '?0';
                    headers['sec-ch-ua-platform'] = '"Windows"';
                    
                    await route.continue({ headers });
                }
            });
            
            // Pass configuration to handlers via userData
            request.userData = {
                ...request.userData,
                config: {
                    onlyCompleted,
                    includeDaysheets
                }
            };
        }
    ],
    
    // Error handling
    failedRequestHandler: async ({ request, error }) => {
        log.error(`Request ${request.url} failed after ${request.retryCount} retries`, {
            error: error.message,
            url: request.url,
            label: request.userData.label
        });
    },
    
    // Browser configuration for Playwright
    launchContext: {
        launchOptions: {
            headless: true,
            args: [
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-default-browser-check'
            ]
        }
    }
});

// Prepare start URLs with proper labels
const requests = startUrls.map(url => ({
    url,
    userData: {
        label: 'LISTING',
        config: {
            onlyCompleted,
            includeDaysheets
        }
    }
}));

// Run the crawler
log.info('Starting crawler...');
await crawler.run(requests);

// Get final statistics
const stats = await crawler.requestQueue?.getInfo();
log.info('Crawler finished', {
    totalRequests: stats?.totalRequestCount,
    handledRequests: stats?.handledRequestCount,
    pendingRequests: stats?.pendingRequestCount
});

await Actor.exit();
