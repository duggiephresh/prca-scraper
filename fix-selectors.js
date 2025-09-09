// Based on the inspection, let's update our selectors
// This script will update the constants.js file with correct selectors

import fs from 'fs';

const updatedConstants = `// Crawler configuration
export const CRAWLER_CONFIG = {
    navigationTimeout: 60,  // Increased timeout
    maxRetries: 3,
    blockedResourceTypes: ['image', 'stylesheet', 'font', 'media'],
    blockedDomains: ['google-analytics.com', 'googletagmanager.com', 'facebook.com', 'doubleclick.net']
};

// URL patterns
export const URL_PATTERNS = {
    baseUrl: 'https://www.prorodeo.com',
    resultsPage: 'https://www.prorodeo.com/results',
    eventPattern: /\\/result\\/\\d{4}\\//,
    resultsTab: '?resultsTab=text',
    daysheetsTab: '?resultsTab=daysheets'
};

// Event status enum
export const EVENT_STATUS = {
    COMPLETED: 'Completed',
    IN_PROGRESS: 'In Progress',
    UPCOMING: 'Upcoming'
};

// Request labels for routing
export const LABELS = {
    LISTING: 'LISTING',
    EVENT_RESULTS: 'EVENT_RESULTS',
    EVENT_DAYSHEET: 'EVENT_DAYSHEET'
};

// Event categories
export const CATEGORIES = [
    'Bareback Riding',
    'Steer Wrestling',
    'Team Roping',
    'Saddle Bronc Riding',
    'Tie-Down Roping',
    'Barrel Racing',
    'Bull Riding',
    'Breakaway Roping',
    'All-Around'
];

// Updated selectors based on actual site inspection
export const SELECTORS = {
    listing: {
        // Wait for any anchor tag to ensure page is loaded
        initialWait: 'a',
        eventLinks: 'a[href*="/result/"]',
        loadMoreButton: 'button',  // Will filter by text content
        statusIndicators: ['Completed', 'In Progress', 'Upcoming']
    },
    eventPage: {
        eventTitle: 'h1',
        resultsContainer: 'main',
        categoryHeader: 'h2',
        resultsTable: 'table',
        contestantRow: 'tr'
    }
};

// Data extraction patterns
export const PATTERNS = {
    prizeMoney: /\\$[\\d,]+/g,
    dateRange: /[A-Za-z]+ \\d{1,2}(?:-\\d{1,2})?, \\d{4}/,
    score: /\\d+\\.?\\d*\\s*(?:points?)?/,
    time: /\\d+\\.?\\d*\\s*(?:seconds?|sec)/,
    round: /(?:First|Second|Third|Fourth|Fifth|\\d+(?:st|nd|rd|th))\\s+(?:round|Round|performance|Performance)/i
};`;

fs.writeFileSync('src/constants.js', updatedConstants);
console.log('✅ Updated constants.js with better selectors');
