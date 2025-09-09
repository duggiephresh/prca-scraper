// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/)
import { Actor } from 'apify';
// Playwright - library to control Chromium/Safari/Firefox browsers (Read more at https://playwright.dev)
import { chromium } from 'playwright';

// The init() call configures the Actor for its environment. It's recommended to start every Actor with an init().
await Actor.init();

// Structure of input is defined in input_schema.json
const input = await Actor.getInput();
const {
    startUrl = 'https://www.prorodeo.com/prorodeo/rodeos/results',
    maxPages = 10,
    outputFormat = 'json'
} = input;

console.log('Input:', input);

// Launch Playwright browser
console.log('Launching browser...');
const browser = await chromium.launch({
    headless: Actor.isAtHome(), // Use headless mode when running on Apify platform
});

const context = await browser.newContext();
const page = await context.newPage();

try {
    // Navigate to the start URL
    console.log(`Navigating to: ${startUrl}`);
    await page.goto(startUrl);

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Extract rodeo results data
    console.log('Extracting rodeo results...');
    
    // Look for rodeo results on the page
    const results = await page.evaluate(() => {
        const rodeos = [];
        
        // Try to find rodeo result elements (this will need to be adjusted based on actual PRCA website structure)
        const resultElements = document.querySelectorAll('.result-item, .rodeo-result, .event-result, tr');
        
        resultElements.forEach((element, index) => {
            try {
                // Extract text content and try to parse rodeo information
                const text = element.textContent?.trim();
                if (text && text.length > 10) {
                    // Basic extraction - this would need to be refined based on actual website structure
                    const rodeoData = {
                        id: index,
                        text: text,
                        html: element.outerHTML.substring(0, 500), // First 500 chars of HTML
                        timestamp: new Date().toISOString()
                    };
                    
                    // Try to extract more specific data if patterns match
                    if (text.includes('$') || text.includes('points') || text.includes('time')) {
                        rodeoData.type = 'result';
                        rodeoData.containsMoney = text.includes('$');
                        rodeoData.containsPoints = text.includes('points');
                        rodeoData.containsTime = text.includes('time');
                    }
                    
                    rodeos.push(rodeoData);
                }
            } catch (error) {
                console.log(`Error processing element ${index}:`, error.message);
            }
        });
        
        return rodeos;
    });

    console.log(`Found ${results.length} potential rodeo results`);

    // Save results to dataset
    if (results.length > 0) {
        await Actor.pushData(results);
        console.log(`Saved ${results.length} results to dataset`);
    }

    // Look for pagination or additional pages
    let currentPage = 1;
    while (currentPage < maxPages) {
        // Try to find and click next page button
        const nextButton = page.locator('a[href*="page"], .next, .pagination a').first();
        
        if (await nextButton.count() > 0) {
            try {
                await nextButton.click();
                await page.waitForLoadState('networkidle');
                currentPage++;
                
                console.log(`Processing page ${currentPage}...`);
                
                // Extract data from current page (reuse the same logic)
                const pageResults = await page.evaluate(() => {
                    const rodeos = [];
                    const resultElements = document.querySelectorAll('.result-item, .rodeo-result, .event-result, tr');
                    
                    resultElements.forEach((element, index) => {
                        try {
                            const text = element.textContent?.trim();
                            if (text && text.length > 10) {
                                const rodeoData = {
                                    id: `page${currentPage}_${index}`,
                                    text: text,
                                    html: element.outerHTML.substring(0, 500),
                                    timestamp: new Date().toISOString(),
                                    page: currentPage
                                };
                                
                                if (text.includes('$') || text.includes('points') || text.includes('time')) {
                                    rodeoData.type = 'result';
                                    rodeoData.containsMoney = text.includes('$');
                                    rodeoData.containsPoints = text.includes('points');
                                    rodeoData.containsTime = text.includes('time');
                                }
                                
                                rodeos.push(rodeoData);
                            }
                        } catch (error) {
                            console.log(`Error processing element ${index}:`, error.message);
                        }
                    });
                    
                    return rodeos;
                });
                
                if (pageResults.length > 0) {
                    await Actor.pushData(pageResults);
                    console.log(`Saved ${pageResults.length} results from page ${currentPage}`);
                }
            } catch (error) {
                console.log(`Error navigating to page ${currentPage + 1}:`, error.message);
                break;
            }
        } else {
            console.log('No more pages found');
            break;
        }
    }

} catch (error) {
    console.error('Error during scraping:', error);
    throw error;
} finally {
    // Close browser
    await browser.close();
}

// Gracefully exit the Actor process. It's recommended to quit all Actors with an exit().
await Actor.exit();