import { chromium } from 'playwright';
import { extractCompletedEvents, extractEventResults } from './src/extractors.js';

console.log('🧪 PRCA Scraper Test - Based on Technical Reference');
console.log('==================================================\n');

async function testScraper() {
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
        
        // Wait for content based on technical reference findings
        console.log('📍 Step 2: Waiting for dynamic content to load...');
        try {
            // Wait for event links as per technical reference
            await page.waitForSelector('a[href*="/result/"]', { timeout: 15000 });
            console.log('✅ Event result links found');
            
            // Analyze page structure based on technical reference patterns
            const pageAnalysis = await page.evaluate(() => {
                const eventLinks = document.querySelectorAll('a[href*="/result/"]');
                const addedMoneyElements = Array.from(document.querySelectorAll('*'))
                    .filter(el => el.textContent && el.textContent.includes('Added Money:'));
                
                // Status elements are simple text nodes (from tech reference)
                const statusElements = Array.from(document.querySelectorAll('*')).filter(el => 
                    ['Completed', 'In Progress', 'Upcoming'].includes(el.textContent.trim()) &&
                    el.childNodes.length === 1 && 
                    el.childNodes[0].nodeType === 3
                );
                
                // Look for Load More button
                const buttons = Array.from(document.querySelectorAll('button'));
                const loadMoreButton = buttons.find(b => 
                    b.textContent.toLowerCase().includes('load') || 
                    b.textContent.toLowerCase().includes('more')
                );
                
                return {
                    eventLinksCount: eventLinks.length,
                    addedMoneyCount: addedMoneyElements.length,
                    statusElementsCount: statusElements.length,
                    statusTexts: statusElements.map(el => el.textContent.trim()).slice(0, 10),
                    loadMoreFound: !!loadMoreButton,
                    loadMoreText: loadMoreButton?.textContent.trim(),
                    sampleEventLinks: Array.from(eventLinks).slice(0, 3).map(link => ({
                        text: link.textContent.trim(),
                        href: link.href
                    }))
                };
            });
            
            console.log('📊 Page Analysis Results:');
            console.log(`  - Event Links: ${pageAnalysis.eventLinksCount}`);
            console.log(`  - Added Money Elements: ${pageAnalysis.addedMoneyCount}`);
            console.log(`  - Status Elements: ${pageAnalysis.statusElementsCount}`);
            console.log(`  - Status Types Found: ${pageAnalysis.statusTexts.join(', ')}`);
            console.log(`  - Load More Button: ${pageAnalysis.loadMoreFound} (${pageAnalysis.loadMoreText || 'N/A'})`);
            
            if (pageAnalysis.sampleEventLinks.length > 0) {
                console.log('  - Sample Event Links:');
                pageAnalysis.sampleEventLinks.forEach((link, i) => {
                    console.log(`    ${i+1}. "${link.text}"`);
                });
            }
            
        } catch (error) {
            console.log('⚠️ Timeout waiting for elements, proceeding anyway...');
        }
        
        // Test event extraction
        console.log('\n📍 Step 3: Testing event extraction...');
        const events = await extractCompletedEvents(page, { onlyCompleted: true });
        console.log(`Found ${events.length} events`);
        
        if (events.length > 0) {
            console.log('\n📋 Sample Events:');
            events.slice(0, 3).forEach((event, i) => {
                console.log(`${i+1}. ${event.name || 'Unknown Event'}`);
                console.log(`   Status: ${event.status}`);
                console.log(`   Location: ${event.location || 'N/A'}`);
                console.log(`   Date: ${event.date || 'N/A'}`);
                console.log(`   Added Money: $${event.addedMoney || 'N/A'}`);
                console.log(`   Results URL: ${event.resultsUrl}`);
                console.log('');
            });
            
            // Test results extraction on first completed event
            const completedEvents = events.filter(e => e.status === 'Completed');
            if (completedEvents.length > 0) {
                const testEvent = completedEvents[0];
                console.log(`📍 Step 4: Testing results extraction for "${testEvent.name}"...`);
                
                await page.goto(testEvent.resultsUrl, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 30000 
                });
                
                console.log('✅ Results page loaded');
                
                // Check for results content based on technical reference
                const resultsPageAnalysis = await page.evaluate(() => {
                    const h1 = document.querySelector('h1');
                    const paragraphs = document.querySelectorAll('p');
                    const specificPattern = document.querySelectorAll('p[ref^="e130"]');
                    const longParagraphs = Array.from(paragraphs).filter(p => p.textContent.length > 100);
                    
                    // Look for category names
                    const categories = ['Bareback Riding', 'Steer Wrestling', 'Team Roping', 
                                     'Saddle Bronc Riding', 'Tie-Down Roping', 'Barrel Racing', 
                                     'Bull Riding', 'Breakaway Roping'];
                    
                    const foundCategories = categories.filter(cat => 
                        document.body.textContent.includes(cat)
                    );
                    
                    return {
                        title: h1?.textContent.trim() || 'No title',
                        totalParagraphs: paragraphs.length,
                        specificPatternCount: specificPattern.length,
                        longParagraphs: longParagraphs.length,
                        foundCategories: foundCategories,
                        hasResultsText: document.body.textContent.includes('First round') ||
                                       document.body.textContent.includes('Finals'),
                        sampleLongText: longParagraphs[0]?.textContent.substring(0, 200) + '...'
                    };
                });
                
                console.log('📊 Results Page Analysis:');
                console.log(`  - Title: ${resultsPageAnalysis.title}`);
                console.log(`  - Total Paragraphs: ${resultsPageAnalysis.totalParagraphs}`);
                console.log(`  - Specific Pattern (p[ref^="e130"]): ${resultsPageAnalysis.specificPatternCount}`);
                console.log(`  - Long Paragraphs: ${resultsPageAnalysis.longParagraphs}`);
                console.log(`  - Categories Found: ${resultsPageAnalysis.foundCategories.join(', ')}`);
                console.log(`  - Has Results Text: ${resultsPageAnalysis.hasResultsText}`);
                
                if (resultsPageAnalysis.sampleLongText && resultsPageAnalysis.sampleLongText.length > 10) {
                    console.log(`  - Sample Text: "${resultsPageAnalysis.sampleLongText}"`);
                }
                
                const results = await extractEventResults(page, testEvent);
                
                if (results && results.categories && results.categories.length > 0) {
                    console.log(`\n✅ Successfully extracted results with ${results.categories.length} categories`);
                    
                    results.categories.forEach(category => {
                        console.log(`  ${category.name}: ${category.results.length} results`);
                        if (category.results.length > 0) {
                            const firstResult = category.results[0];
                            console.log(`    Winner: ${firstResult.contestant}`);
                            if (firstResult.score) console.log(`    Score: ${firstResult.score}`);
                            if (firstResult.time) console.log(`    Time: ${firstResult.time}`);
                            if (firstResult.prizeMoney) console.log(`    Prize: $${firstResult.prizeMoney}`);
                        }
                        console.log('');
                    });
                } else {
                    console.log('⚠️ No structured results extracted from current extraction logic');
                    console.log('   This may require adjusting the results parsing patterns.');
                }
            } else {
                console.log('⚠️ No completed events found for results testing');
            }
        } else {
            console.log('❌ No events extracted - selectors may need adjustment');
        }
        
        console.log('\n✅ Test completed!');
        console.log('\n📝 Next steps:');
        console.log('   1. If events found: Run limited Apify test');
        console.log('   2. If no events: Check network connectivity or adjust selectors');
        console.log('   3. If results parsing failed: Update extraction patterns');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        // Try to get debug info if possible
        try {
            const debugInfo = await page.evaluate(() => {
                return {
                    title: document.title,
                    url: window.location.href,
                    bodyLength: document.body?.textContent.length || 0,
                    hasAddedMoney: document.body?.textContent.includes('Added Money') || false,
                    linkCount: document.querySelectorAll('a').length,
                    resultLinks: document.querySelectorAll('a[href*="/result/"]').length
                };
            });
            console.log('🔍 Debug Info:', debugInfo);
        } catch (debugError) {
            console.log('Could not retrieve debug info');
        }
    } finally {
        await browser.close();
    }
}

testScraper().catch(console.error);