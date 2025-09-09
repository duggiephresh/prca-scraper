import { chromium } from 'playwright';
import { extractCompletedEvents, extractEventResults } from './src/extractors.js';
import { writeFileSync } from 'fs';

console.log('📸 PRCA Screenshot Test');
console.log('=======================\n');

async function testScreenshots() {
    const browser = await chromium.launch({ 
        headless: true
    });
    
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    
    try {
        console.log('📍 Step 1: Loading ProRodeo.com/results...');
        
        await page.goto('https://www.prorodeo.com/results', {
            waitUntil: 'domcontentloaded',
            timeout: 45000
        });
        
        console.log('✅ Page loaded');
        
        // Wait for content
        await page.waitForSelector('a[href*="/result/"]', { timeout: 15000 });
        console.log('✅ Event links found');
        
        // Extract events
        const events = await extractCompletedEvents(page, { onlyCompleted: false });
        console.log(`Found ${events.length} events`);
        
        if (events.length > 0) {
            // Test screenshot on first event
            const testEvent = events[0];
            console.log(`\n📍 Step 2: Testing screenshot for "${testEvent.name}"`);
            console.log(`URL: ${testEvent.resultsUrl}`);
            
            await page.goto(testEvent.resultsUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });
            
            console.log('✅ Results page loaded');
            
            // Take screenshot using our extractor
            const result = await extractEventResults(page, testEvent);
            
            if (result && result.screenshot) {
                console.log('✅ Screenshot captured successfully!');
                console.log(`   Event: ${result.eventName || result.name}`);
                console.log(`   Page Title: ${result.pageTitle}`);
                console.log(`   Screenshot Size: ${(result.screenshotSize / 1024).toFixed(1)} KB`);
                console.log(`   Type: ${result.type}`);
                
                // Save a sample screenshot to file for verification
                const base64Data = result.screenshot.replace(/^data:image\/png;base64,/, '');
                const screenshotBuffer = Buffer.from(base64Data, 'base64');
                writeFileSync('sample_screenshot.png', screenshotBuffer);
                console.log('✅ Sample screenshot saved as sample_screenshot.png');
                
                // Test daysheet screenshot if available
                if (testEvent.daysheetUrl) {
                    console.log(`\n📍 Step 3: Testing daysheet screenshot`);
                    console.log(`URL: ${testEvent.daysheetUrl}`);
                    
                    const { extractDaysheetData } = await import('./src/extractors.js');
                    
                    await page.goto(testEvent.daysheetUrl, { 
                        waitUntil: 'domcontentloaded',
                        timeout: 30000 
                    });
                    
                    const daysheetResult = await extractDaysheetData(page, testEvent);
                    
                    if (daysheetResult && daysheetResult.screenshot) {
                        console.log('✅ Daysheet screenshot captured successfully!');
                        console.log(`   Screenshot Size: ${(daysheetResult.screenshotSize / 1024).toFixed(1)} KB`);
                        console.log(`   Type: ${daysheetResult.type}`);
                        
                        // Save daysheet screenshot
                        const daysheetBase64 = daysheetResult.screenshot.replace(/^data:image\/png;base64,/, '');
                        const daysheetBuffer = Buffer.from(daysheetBase64, 'base64');
                        writeFileSync('sample_daysheet.png', daysheetBuffer);
                        console.log('✅ Sample daysheet saved as sample_daysheet.png');
                    } else {
                        console.log('❌ Failed to capture daysheet screenshot');
                    }
                }
                
            } else {
                console.log('❌ Failed to capture screenshot');
                console.log('Result:', result);
            }
            
        } else {
            console.log('❌ No events found to test screenshots');
        }
        
        console.log('\n✅ Screenshot test completed!');
        console.log('\n📝 The scraper is now configured to:');
        console.log('   • Find event links from the listing page');
        console.log('   • Take full-page screenshots of results pages');  
        console.log('   • Take screenshots of daysheet pages (if enabled)');
        console.log('   • Store screenshots as base64 in the dataset');
        console.log('   • Include metadata (event name, URL, page title, etc.)');
        
    } catch (error) {
        console.error('❌ Screenshot test failed:', error.message);
    } finally {
        await browser.close();
    }
}

testScreenshots().catch(console.error);