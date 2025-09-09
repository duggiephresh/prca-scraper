import puppeteer from 'puppeteer';

async function inspectSite() {
    console.log('🔍 Starting ProRodeo.com inspection...');
    const browser = await puppeteer.launch({ 
        headless: false,  // Show browser for debugging
        devtools: true    // Open DevTools
    });
    const page = await browser.newPage();
    
    try {
        console.log('📍 Navigating to https://www.prorodeo.com/results');
        await page.goto('https://www.prorodeo.com/results', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        console.log('⏳ Waiting 5 seconds for dynamic content...');
        await page.waitForTimeout(5000);
        
        // Check what's actually on the page
        const pageInfo = await page.evaluate(() => {
            const info = {
                title: document.title,
                hasEventLinks: false,
                eventLinkSelectors: [],
                possibleEventContainers: [],
                textWithStatus: [],
                loadMoreButton: null
            };
            
            // Find any links that might be events
            const allLinks = Array.from(document.querySelectorAll('a'));
            const eventLinks = allLinks.filter(a => {
                const href = a.href || '';
                return href.includes('/result/') || 
                       href.includes('/rodeo/') || 
                       href.includes('/event/');
            });
            
            if (eventLinks.length > 0) {
                info.hasEventLinks = true;
                info.eventLinkSelectors = eventLinks.slice(0, 3).map(a => ({
                    href: a.href,
                    text: a.textContent.trim(),
                    className: a.className,
                    id: a.id
                }));
            }
            
            // Find elements with status text
            const allElements = Array.from(document.querySelectorAll('*'));
            const statusElements = allElements.filter(el => {
                const text = el.textContent.trim();
                return text === 'Completed' || 
                       text === 'In Progress' || 
                       text === 'Upcoming' ||
                       text === 'COMPLETED' ||
                       text === 'IN PROGRESS' ||
                       text === 'UPCOMING';
            });
            
            info.textWithStatus = statusElements.slice(0, 3).map(el => ({
                text: el.textContent.trim(),
                tagName: el.tagName,
                className: el.className,
                parentClassName: el.parentElement?.className
            }));
            
            // Find elements that might be event containers
            const containersWithMoney = allElements.filter(el => {
                const text = el.textContent || '';
                return text.includes('Added Money') || text.includes('added money');
            });
            
            info.possibleEventContainers = containersWithMoney.slice(0, 3).map(el => ({
                text: el.textContent.substring(0, 200),
                tagName: el.tagName,
                className: el.className
            }));
            
            // Look for load more button
            const buttons = Array.from(document.querySelectorAll('button'));
            const loadMore = buttons.find(btn => {
                const text = btn.textContent.toLowerCase();
                return text.includes('load more') || text.includes('show more');
            });
            
            if (loadMore) {
                info.loadMoreButton = {
                    text: loadMore.textContent.trim(),
                    className: loadMore.className,
                    id: loadMore.id
                };
            }
            
            return info;
        });
        
        console.log('\n📊 Page Analysis Results:');
        console.log('========================');
        console.log(JSON.stringify(pageInfo, null, 2));
        
        // Take a screenshot
        await page.screenshot({ path: 'prorodeo-page.png', fullPage: false });
        console.log('\n📸 Screenshot saved as prorodeo-page.png');
        
        console.log('\n⚠️  Browser will stay open for manual inspection.');
        console.log('Press Ctrl+C when done inspecting.');
        
        // Keep browser open for manual inspection
        await new Promise(() => {});
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        await browser.close();
    }
}

inspectSite().catch(console.error);
