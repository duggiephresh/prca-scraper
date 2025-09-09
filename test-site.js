import puppeteer from 'puppeteer';

console.log('🔍 ProRodeo.com Site Structure Test');
console.log('=====================================\n');

async function testSite() {
    const browser = await puppeteer.launch({ 
        headless: false, // Show browser for debugging
        devtools: true   // Open DevTools
    });
    
    const page = await browser.newPage();
    
    try {
        console.log('📍 Step 1: Loading ProRodeo.com/results...');
        await page.goto('https://www.prorodeo.com/results', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        console.log('✅ Page loaded\n');
        
        // Test 1: Find any event links
        console.log('📍 Step 2: Looking for event links...');
        const eventLinks = await page.evaluate(() => {
            const links = document.querySelectorAll('a[href*="/result/"]');
            return {
                count: links.length,
                sample: Array.from(links).slice(0, 3).map(l => ({
                    text: l.textContent.trim(),
                    href: l.href
                }))
            };
        });
        console.log(`Found ${eventLinks.count} event links`);
        console.log('Sample:', JSON.stringify(eventLinks.sample, null, 2));
        
        // Test 2: Find event containers
        console.log('\n📍 Step 3: Looking for event containers...');
        const containers = await page.evaluate(() => {
            // Try different strategies
            const strategies = [
                { selector: '*', filter: el => el.textContent.includes('Added Money:') },
                { selector: 'div', filter: el => el.textContent.includes('Completed') },
                { selector: 'article', filter: () => true },
                { selector: '[class*="event"]', filter: () => true },
                { selector: '[class*="card"]', filter: () => true }
            ];
            
            const results = {};
            strategies.forEach(({ selector, filter }) => {
                try {
                    const elements = Array.from(document.querySelectorAll(selector)).filter(filter);
                    if (elements.length > 0) {
                        results[selector] = {
                            count: elements.length,
                            firstClass: elements[0].className,
                            sample: elements[0].textContent.substring(0, 100)
                        };
                    }
                } catch (e) {}
            });
            return results;
        });
        console.log('Container strategies found:', JSON.stringify(containers, null, 2));
        
        // Test 3: Find status indicators
        console.log('\n📍 Step 4: Looking for status indicators...');
        const statuses = await page.evaluate(() => {
            const statusTexts = ['Completed', 'In Progress', 'Upcoming'];
            const found = {};
            
            statusTexts.forEach(status => {
                const elements = Array.from(document.querySelectorAll('*')).filter(
                    el => el.textContent.trim() === status && el.children.length === 0
                );
                if (elements.length > 0) {
                    found[status] = {
                        count: elements.length,
                        tagName: elements[0].tagName,
                        className: elements[0].className
                    };
                }
            });
            return found;
        });
        console.log('Status indicators:', JSON.stringify(statuses, null, 2));
        
        // Test 4: Check for Load More button
        console.log('\n📍 Step 5: Looking for pagination...');
        const pagination = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const loadMore = buttons.filter(b => 
                b.textContent.toLowerCase().includes('load') || 
                b.textContent.toLowerCase().includes('more')
            );
            return {
                totalButtons: buttons.length,
                loadMoreFound: loadMore.length > 0,
                loadMoreText: loadMore[0]?.textContent.trim()
            };
        });
        console.log('Pagination:', JSON.stringify(pagination, null, 2));
        
        // Test 5: Get page structure
        console.log('\n📍 Step 6: Analyzing page structure...');
        const structure = await page.evaluate(() => {
            const main = document.querySelector('main');
            const divs = document.querySelectorAll('div');
            return {
                hasMain: !!main,
                totalDivs: divs.length,
                bodyClasses: document.body.className,
                distinctClasses: [...new Set(Array.from(document.querySelectorAll('*'))
                    .map(el => el.className)
                    .filter(c => c && c.includes('event')))].slice(0, 10)
            };
        });
        console.log('Page structure:', JSON.stringify(structure, null, 2));
        
        console.log('\n✅ Test complete! Check browser window for visual inspection.');
        console.log('Press Ctrl+C to close the browser and exit.\n');
        
        // Keep browser open for manual inspection
        await new Promise(() => {});
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        await browser.close();
    }
}

testSite().catch(console.error);
