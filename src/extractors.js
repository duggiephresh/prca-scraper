import { Dataset, log } from 'crawlee';
import { EVENT_STATUS, PATTERNS, CATEGORIES, URL_PATTERNS } from './constants.js';

/**
 * Extract completed events from the listing page
 */
export async function extractCompletedEvents(page, config) {
    log.debug('Extracting events from listing page');
    
    const events = await page.evaluate((statuses) => {
        const extractedEvents = [];
        
        // Find all links to event result pages
        const eventLinks = Array.from(document.querySelectorAll('a[href*="/result/"]'));
        
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
                    
                    // Extract status
                    statuses.forEach(status => {
                        if (containerText.includes(status)) {
                            eventData.status = status;
                        }
                    });
                    
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
 * Extract results data from an event page
 */
export async function extractEventResults(page, eventData) {
    log.debug(`Extracting results for event: ${eventData.name}`);
    
    try {
        const results = await page.evaluate((baseEventData) => {
            const data = {
                ...baseEventData,
                categories: [],
                extractedAt: new Date().toISOString()
            };
            
            const h1 = document.querySelector('h1');
            if (h1) {
                data.eventName = h1.textContent.trim();
            }
            
            // Look for results content
            const possibleResultsElements = Array.from(document.querySelectorAll('p, div'))
                .filter(el => {
                    const text = el.textContent || '';
                    return text.length > 100 && 
                           (text.includes('First round') || 
                            text.includes('Second round') || 
                            text.includes('Finals') ||
                            text.includes('points') ||
                            text.includes('seconds'));
                });
            
            if (possibleResultsElements.length > 0) {
                const resultsText = possibleResultsElements[0].textContent;
                
                const categoryNames = [
                    'Bareback Riding',
                    'Steer Wrestling',
                    'Team Roping',
                    'Saddle Bronc Riding',
                    'Tie-Down Roping',
                    'Barrel Racing',
                    'Bull Riding',
                    'Breakaway Roping'
                ];
                
                categoryNames.forEach(categoryName => {
                    if (resultsText.includes(categoryName)) {
                        const categoryData = {
                            name: categoryName,
                            results: []
                        };
                        
                        data.categories.push(categoryData);
                    }
                });
            }
            
            return data;
            
        }, eventData);
        
        return results;
        
    } catch (error) {
        log.error('Error extracting event results', {
            error: error.message,
            event: eventData.name
        });
        return null;
    }
}

/**
 * Extract daysheet data from an event page
 */
export async function extractDaysheetData(page, eventData) {
    log.debug(`Extracting daysheet for event: ${eventData.name}`);
    
    try {
        const daysheetData = await page.evaluate((baseEventData) => {
            const data = {
                ...baseEventData,
                performances: [],
                extractedAt: new Date().toISOString()
            };
            
            const h1 = document.querySelector('h1');
            if (h1) {
                data.eventName = h1.textContent.trim();
            }
            
            const performanceElements = Array.from(document.querySelectorAll('a'))
                .filter(a => {
                    const text = a.textContent || '';
                    return text.includes('Performance') || 
                           text.match(/\d+(?:st|nd|rd|th)\s+Performance/i);
                });
            
            performanceElements.forEach(perfElement => {
                const performance = {
                    name: perfElement.textContent.trim(),
                    url: perfElement.href,
                    contestants: []
                };
                
                const dateMatch = performance.name.match(/\(([^)]+)\)/);
                if (dateMatch) {
                    performance.date = dateMatch[1];
                }
                
                data.performances.push(performance);
            });
            
            return data;
            
        }, eventData);
        
        return daysheetData;
        
    } catch (error) {
        log.error('Error extracting daysheet data', {
            error: error.message,
            event: eventData.name
        });
        return null;
    }
}
