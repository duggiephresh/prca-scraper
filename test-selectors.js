import puppeteer from 'puppeteer';

async function testSelectors() {
    console.log('Starting selector test...');
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        console.log('Navigating to ProRodeo.com...');
        await page.goto('https://www.prorodeo.com/results', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        console.log('Page loaded, waiting for content...');
        await page.waitForSelector('a[href*="/result/"]', { timeout: 10000 });
        
        console.log('Finding event links...');
        const eventLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/result/"]'));
            return links.slice(0, 5).map(link => ({
                text: link.textContent.trim(),
                href: link.href
            }));
        });
        
        console.log('Found events:', eventLinks);
        
        console.log('Looking for status indicators...');
        const statuses = await page.evaluate(() => {
            const all = Array.from(document.querySelectorAll('*'));
            return all.filter(el => 
                ['Completed', 'In Progress', 'Upcoming'].includes(el.textContent.trim())
            ).slice(0, 5).map(el => el.textContent.trim());
        });
        
        console.log('Found statuses:', statuses);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
    
    await browser.close();
}

testSelectors();
