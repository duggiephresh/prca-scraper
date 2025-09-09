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
    debug = false
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
    includeDaysheets
});

// Create the crawler
const crawler = new PlaywrightCrawler({
    requestHandler: router,
    maxRequestsPerCrawl,
    maxConcurrency,
    navigationTimeoutSecs: CRAWLER_CONFIG.navigationTimeout,
    maxRequestRetries: CRAWLER_CONFIG.maxRetries,
    requestHandlerTimeoutSecs: 120, // Increase timeout for Playwright
    
    // Performance optimization: block unnecessary resources
    preNavigationHooks: [
        async ({ page, request, log }) => {
            log.debug(`Pre-navigation hook for ${request.url}`);
            
            // Block images, stylesheets, and fonts to speed up loading with Playwright
            await page.route('**/*', async (route) => {
                const resourceType = route.request().resourceType();
                const url = route.request().url();
                
                // Block non-essential resources
                if (CRAWLER_CONFIG.blockedResourceTypes.includes(resourceType)) {
                    await route.abort();
                } 
                // Also block specific domains
                else if (CRAWLER_CONFIG.blockedDomains.some(domain => url.includes(domain))) {
                    await route.abort();
                }
                else {
                    await route.continue();
                }
            });
            
            // Set viewport (Playwright syntax)
            await page.setViewportSize({
                width: 1920,
                height: 1080
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
