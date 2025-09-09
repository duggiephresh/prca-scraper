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
        // Wait for initial content to load
        log.debug('Waiting for page content...');
        await page.waitForSelector('a[href*="/result/"]', { 
            timeout: 30000,
            visible: true 
        });
        
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
                        await page.waitForTimeout(2000);
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
            log.info(`Enqueued ${requests.length} event pages for processing`);
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
    log.info(`Processing event results: ${eventData.name}`, { url: request.url });
    
    try {
        await page.waitForSelector('h1', { timeout: 30000 });
        
        const results = await extractEventResults(page, eventData);
        
        if (results) {
            await Dataset.pushData({
                ...results,
                type: 'results',
                url: page.url()
            });
            
            log.info(`Successfully extracted results for: ${eventData.name}`);
        } else {
            log.warning(`No results data found for: ${eventData.name}`);
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
    log.info(`Processing event daysheet: ${eventData.name}`, { url: request.url });
    
    try {
        await page.waitForSelector('h1', { timeout: 30000 });
        
        const daysheetData = await extractDaysheetData(page, eventData);
        
        if (daysheetData) {
            await Dataset.pushData({
                ...daysheetData,
                type: 'daysheet',
                url: page.url()
            });
            
            log.info(`Successfully extracted daysheet for: ${eventData.name}`);
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
