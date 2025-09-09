import { Dataset, log } from 'crawlee';
import { EVENT_STATUS, PATTERNS, CATEGORIES, URL_PATTERNS } from './constants.js';

/**
 * Extract completed events from the listing page
 */
export async function extractCompletedEvents(page, config) {
    log.debug('Extracting events from listing page');
    
    const events = await page.evaluate((statuses) => {
        const extractedEvents = [];
        
        // Find all links to event result pages, excluding "See Results" and "Daysheet" text
        const eventLinks = Array.from(document.querySelectorAll('a[href*="/result/"]'))
            .filter(link => {
                const text = link.textContent.trim();
                return !text.includes('See Results') && !text.includes('Daysheet');
            });
        
        // Create a map to avoid duplicates
        const eventMap = new Map();
        
        eventLinks.forEach(link => {
            const href = link.href;
            const text = link.textContent.trim();
            
            if (!href || eventMap.has(href)) return;
            
            // Try to find the parent container with event information
            let container = link.parentElement;
            let maxDepth = 10;
            
            while (container && maxDepth > 0) {
                const containerText = container.textContent || '';
                
                if (containerText.includes('Added Money:')) {
                    const eventData = {
                        name: text || 'Unknown Event',
                        url: href,
                        resultsUrl: href.includes('?') ? href : `${href}?resultsTab=text`,
                        daysheetUrl: href.includes('?') ? href.replace(/\?.*/, '?resultsTab=daysheets') : `${href}?resultsTab=daysheets`,
                        status: 'Unknown',
                        location: '',
                        date: '',
                        addedMoney: '',
                        circuit: ''
                    };
                    
                    // Extract status - try multiple approaches
                    let foundStatus = 'Unknown';
                    
                    // Approach 1: Look for status elements within this container
                    const statusElements = Array.from(container.querySelectorAll('*')).filter(el => 
                        statuses.includes(el.textContent.trim()) &&
                        el.childNodes.length === 1 && 
                        el.childNodes[0].nodeType === 3
                    );
                    
                    if (statusElements.length > 0) {
                        foundStatus = statusElements[0].textContent.trim();
                    } else {
                        // Approach 2: Search for status text directly in container text
                        for (const status of statuses) {
                            if (containerText.includes(status)) {
                                foundStatus = status;
                                break;
                            }
                        }
                        
                        // Approach 3: Search in nearby elements (siblings/parent)
                        if (foundStatus === 'Unknown') {
                            let searchContainer = container.parentElement || container;
                            for (let depth = 0; depth < 3 && foundStatus === 'Unknown'; depth++) {
                                const nearbyStatusElements = Array.from(searchContainer.querySelectorAll('*')).filter(el => 
                                    statuses.includes(el.textContent.trim()) &&
                                    el.childNodes.length === 1 && 
                                    el.childNodes[0].nodeType === 3
                                );
                                
                                if (nearbyStatusElements.length > 0) {
                                    // Find the closest status element to our event link
                                    const eventLinkRect = link.getBoundingClientRect ? link.getBoundingClientRect() : null;
                                    if (eventLinkRect) {
                                        let closestDistance = Infinity;
                                        let closestStatus = null;
                                        
                                        nearbyStatusElements.forEach(statusEl => {
                                            const statusRect = statusEl.getBoundingClientRect();
                                            const distance = Math.sqrt(
                                                Math.pow(statusRect.left - eventLinkRect.left, 2) + 
                                                Math.pow(statusRect.top - eventLinkRect.top, 2)
                                            );
                                            if (distance < closestDistance) {
                                                closestDistance = distance;
                                                closestStatus = statusEl.textContent.trim();
                                            }
                                        });
                                        
                                        if (closestStatus) {
                                            foundStatus = closestStatus;
                                        }
                                    } else {
                                        // Fallback: just use first found status
                                        foundStatus = nearbyStatusElements[0].textContent.trim();
                                    }
                                }
                                searchContainer = searchContainer.parentElement;
                                if (!searchContainer) break;
                            }
                        }
                    }
                    
                    eventData.status = foundStatus;
                    
                    // Extract added money
                    const moneyMatch = containerText.match(/Added Money:\s*\$?([\d,]+)/);
                    if (moneyMatch) {
                        eventData.addedMoney = moneyMatch[1];
                    }
                    
                    // Extract location
                    const lines = containerText.split('\n').map(l => l.trim()).filter(l => l);
                    const nameIndex = lines.findIndex(l => l.includes(text));
                    if (nameIndex >= 0 && nameIndex < lines.length - 1) {
                        for (let i = nameIndex + 1; i < lines.length; i++) {
                            const line = lines[i];
                            if (line.includes(',') && !line.match(/\d{4}/) && !line.includes('Added Money')) {
                                eventData.location = line;
                                break;
                            }
                        }
                    }
                    
                    // Extract dates
                    const dateMatch = containerText.match(/([A-Za-z]+\s+\d{1,2}(?:-\d{1,2})?,\s+\d{4})/);
                    if (dateMatch) {
                        eventData.date = dateMatch[1];
                    }
                    
                    eventMap.set(href, eventData);
                    break;
                }
                
                container = container.parentElement;
                maxDepth--;
            }
            
            if (!eventMap.has(href)) {
                eventMap.set(href, {
                    name: text || 'Unknown Event',
                    url: href,
                    resultsUrl: href.includes('?') ? href : `${href}?resultsTab=text`,
                    daysheetUrl: href.includes('?') ? href.replace(/\?.*/, '?resultsTab=daysheets') : `${href}?resultsTab=daysheets`,
                    status: 'Unknown',
                    location: '',
                    date: '',
                    addedMoney: '',
                    circuit: ''
                });
            }
        });
        
        return Array.from(eventMap.values());
        
    }, Object.values(EVENT_STATUS));
    
    log.debug(`Extracted ${events.length} events from page`);
    return events;
}

/**
 * Extract results data and take screenshots from an event page
 */
export async function extractEventResults(page, eventData) {
    log.debug(`Taking screenshot for event: ${eventData.name}`);
    
    try {
        // Wait for content to load
        await page.waitForTimeout(3000);
        
        // Get basic event information
        const basicInfo = await page.evaluate((baseEventData) => {
            const data = {
                ...baseEventData,
                extractedAt: new Date().toISOString()
            };
            
            const h1 = document.querySelector('h1');
            if (h1) {
                data.eventName = h1.textContent.trim();
            }
            
            // Get page title and URL for reference
            data.pageTitle = document.title;
            data.currentUrl = window.location.href;
            
            return data;
        }, eventData);
        
        // Take full page screenshot
        const screenshotBuffer = await page.screenshot({
            fullPage: true,
            type: 'png'
        });
        
        // Convert screenshot to base64 for storage
        const screenshotBase64 = screenshotBuffer.toString('base64');
        
        return {
            ...basicInfo,
            screenshot: `data:image/png;base64,${screenshotBase64}`,
            screenshotSize: screenshotBuffer.length,
            type: 'results_screenshot'
        };
        
    } catch (error) {
        log.error('Error taking screenshot for event results', {
            error: error.message,
            event: eventData.name
        });
        return {
            ...eventData,
            error: error.message,
            extractedAt: new Date().toISOString(),
            type: 'results_error'
        };
    }
}

/**
 * Extract daysheet data and take screenshots from an event page
 */
export async function extractDaysheetData(page, eventData) {
    log.debug(`Taking daysheet screenshot for event: ${eventData.name}`);
    
    try {
        // Wait for content to load
        await page.waitForTimeout(3000);
        
        // Get basic event information
        const basicInfo = await page.evaluate((baseEventData) => {
            const data = {
                ...baseEventData,
                extractedAt: new Date().toISOString()
            };
            
            const h1 = document.querySelector('h1');
            if (h1) {
                data.eventName = h1.textContent.trim();
            }
            
            // Get page title and URL for reference
            data.pageTitle = document.title;
            data.currentUrl = window.location.href;
            
            return data;
        }, eventData);
        
        // Take full page screenshot
        const screenshotBuffer = await page.screenshot({
            fullPage: true,
            type: 'png'
        });
        
        // Convert screenshot to base64 for storage
        const screenshotBase64 = screenshotBuffer.toString('base64');
        
        return {
            ...basicInfo,
            screenshot: `data:image/png;base64,${screenshotBase64}`,
            screenshotSize: screenshotBuffer.length,
            type: 'daysheet_screenshot'
        };
        
    } catch (error) {
        log.error('Error taking daysheet screenshot', {
            error: error.message,
            event: eventData.name
        });
        return {
            ...eventData,
            error: error.message,
            extractedAt: new Date().toISOString(),
            type: 'daysheet_error'
        };
    }
}
