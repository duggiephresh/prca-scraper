import { createPuppeteerRouter, Dataset } from 'crawlee';
import { extractCompletedEvents, extractEventResults, extractDaysheetData } from './extractors.js';
import { SELECTORS, LABELS, URL_PATTERNS } from './constants.js';

export const router = createPuppeteerRouter();

// Default handler - route to listing page handler
router.addDefaultHandler(async (context) => {
    const { request, log } = context;
    log.info(`Default handler processing: ${request.url}`);
    
    // Set label and handle as listing page
    request.userData.label = LABELS.LISTING;
    return router.handleRequest(context);
});

// Handle main results listing page
router.addHandler(LABELS.LISTING, async ({ page, request, enqueueLinks, log, crawler }) => {
    log.info('Processing results listing page', { url: request.url });
    
    try {
        // Wait for initial content to load - comprehensive approach
        log.debug('Waiting for page content to load...');
        
        try {
            // First try to wait for body content to load
            await page.waitForSelector('body', { timeout: 10000 });
            log.debug('Page body loaded');
            
            // Try to achieve network idle state
            try {
                await page.waitForLoadState('networkidle', { timeout: 10000 });
                log.debug('Network idle achieved');
            } catch (error) {
                log.debug('Network idle timeout, continuing...');
            }
            
            // Give the page some time to render JavaScript content
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Try different selectors that might indicate the page has loaded
            const selectors = [
                'a[href*="/result/"]',  // Specific result links (most important)
                'main',                 // Main content area
                'h1, h2, h3',          // Any heading
                '[data-testid]',       // React/Vue components often use data-testid
                '.container'           // Common CSS class
            ];
            
            let selectorFound = false;
            for (const selector of selectors) {
                try {
                    const elements = await page.$$(selector);
                    if (elements.length > 0) {
                        log.debug(`Found content using selector: ${selector} (${elements.length} elements)`);
                        selectorFound = true;
                        break;
                    }
                } catch (error) {
                    log.debug(`Selector ${selector} failed, trying next...`);
                }
            }
            
            if (!selectorFound) {
                log.warning('No expected selectors found, but continuing with extraction attempt');
                // Additional wait for JavaScript content
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
            
        } catch (error) {
            log.warning('Page loading timeout, proceeding anyway', { error: error.message });
        }
        
        // Handle pagination - click "Load More" if needed
        let hasMore = true;
        let loadCount = 0;
        const maxLoads = 10; // Safety limit
        
        while (hasMore && loadCount < maxLoads) {
            try {
                const loadMoreButton = await page.$(SELECTORS.listing.loadMoreButton);
                
                if (loadMoreButton) {
                    const isVisible = await loadMoreButton.isVisible();
                    
                    if (isVisible) {
                        log.debug(`Clicking "Load More" button (${loadCount + 1}/${maxLoads})`);
                        await loadMoreButton.click();
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        loadCount++;
                    } else {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            } catch (error) {
                log.debug('No more "Load More" button found or error clicking', { error: error.message });
                hasMore = false;
            }
        }
        
        log.info(`Loaded ${loadCount} additional pages of events`);
        
        // Extract completed events
        const events = await extractCompletedEvents(page, request.userData.config);
        log.info(`Found ${events.length} events to process`);
        
        // Enqueue event URLs
        const requests = [];
        
        for (const event of events) {
            if (request.userData.config.onlyCompleted && event.status !== 'Completed') {
                log.debug(`Skipping non-completed event: ${event.name} (${event.status})`);
                continue;
            }
            
            if (event.resultsUrl) {
                requests.push({
                    url: event.resultsUrl,
                    userData: {
                        label: LABELS.EVENT_RESULTS,
                        eventData: event,
                        config: request.userData.config
                    }
                });
            }
            
            if (request.userData.config.includeDaysheets && event.daysheetUrl) {
                requests.push({
                    url: event.daysheetUrl,
                    userData: {
                        label: LABELS.EVENT_DAYSHEET,
                        eventData: event,
                        config: request.userData.config
                    }
                });
            }
        }
        
        if (requests.length > 0) {
            await crawler.addRequests(requests);
            
            // Count and log different types separately
            const resultRequests = requests.filter(r => r.userData.label === LABELS.EVENT_RESULTS);
            const daysheetRequests = requests.filter(r => r.userData.label === LABELS.EVENT_DAYSHEET);
            
            log.info(`Enqueued ${requests.length} total event pages:`, {
                results: resultRequests.length,
                daysheets: daysheetRequests.length,
                details: requests.map(r => ({
                    type: r.userData.label,
                    event: r.userData.eventData.name,
                    url: r.url
                }))
            });
        }
        
    } catch (error) {
        log.error('Error processing listing page', {
            error: error.message,
            url: request.url
        });
        throw error;
    }
});

// Handle individual event results page
router.addHandler(LABELS.EVENT_RESULTS, async ({ page, request, log }) => {
    const eventData = request.userData.eventData;
    log.info(`🎯 Processing EVENT RESULTS: ${eventData.name}`, { 
        url: request.url,
        type: 'RESULTS',
        eventStatus: eventData.status,
        location: eventData.location
    });
    
    try {
        await page.waitForSelector('h1', { timeout: 30000 });
        
        const results = await extractEventResults(page, eventData);
        
        if (results) {
            await Dataset.pushData({
                ...results,
                type: 'results',
                dataType: 'EVENT_RESULTS',
                url: page.url(),
                extractedAt: new Date().toISOString()
            });
            
            log.info(`✅ RESULTS extraction successful: ${eventData.name}`, {
                categoriesFound: results.categories?.length || 0,
                totalResults: results.results?.length || 0
            });
        } else {
            log.warning(`⚠️  No results data found for: ${eventData.name}`);
        }
        
    } catch (error) {
        log.error(`Error processing event results: ${eventData.name}`, {
            error: error.message,
            url: request.url
        });
        
        await Dataset.pushData({
            ...eventData,
            error: error.message,
            extractedAt: new Date().toISOString()
        });
    }
});

// Handle individual event daysheet page
router.addHandler(LABELS.EVENT_DAYSHEET, async ({ page, request, log }) => {
    const eventData = request.userData.eventData;
    log.info(`📋 Processing EVENT DAYSHEET: ${eventData.name}`, { 
        url: request.url,
        type: 'DAYSHEET',
        eventStatus: eventData.status,
        location: eventData.location
    });
    
    try {
        await page.waitForSelector('h1', { timeout: 30000 });
        
        const daysheetData = await extractDaysheetData(page, eventData);
        
        if (daysheetData) {
            await Dataset.pushData({
                ...daysheetData,
                type: 'daysheet',
                dataType: 'EVENT_DAYSHEET',
                url: page.url(),
                extractedAt: new Date().toISOString()
            });
            
            log.info(`✅ DAYSHEET extraction successful: ${eventData.name}`, {
                entriesFound: daysheetData.entries?.length || 0,
                categories: daysheetData.categories?.length || 0
            });
        } else {
            log.warning(`⚠️  No daysheet data found for: ${eventData.name}`);
        }
        
    } catch (error) {
        log.error(`Error processing event daysheet: ${eventData.name}`, {
            error: error.message,
            url: request.url
        });
        
        await Dataset.pushData({
            ...eventData,
            type: 'daysheet',
            error: error.message,
            extractedAt: new Date().toISOString()
        });
    }
});
