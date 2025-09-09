# PRCA Rodeo Results Scraper (Screenshot-Based)

An Apify actor that captures full-page screenshots of rodeo results from ProRodeo.com. This scraper handles JavaScript-rendered content using PuppeteerCrawler and outputs base64-encoded screenshots for processing in n8n workflows.

## Features

- ✅ Captures screenshots of completed rodeo events from ProRodeo.com
- ✅ Handles JavaScript-rendered content with Puppeteer
- ✅ Full-page screenshot capture of results and daysheet pages  
- ✅ Base64 encoding for direct n8n integration
- ✅ Automatic pagination handling ("Load More" button)
- ✅ Resource blocking for improved performance
- ✅ Configurable concurrency and filtering options

## Quick Start

### Local Development

Install dependencies:
npm install

Install Apify CLI (if not already installed):
npm install -g apify-cli

Run locally:
apify run
apify run --purge

### Deploy to Apify Platform

Login to Apify:
apify login

Push to platform:
apify push

## Configuration

The scraper accepts the following input parameters:
- startUrls: URLs to start scraping
- maxRequestsPerCrawl: Maximum pages to crawl (0 = unlimited)
- maxConcurrency: Max parallel page processing
- onlyCompleted: Only scrape Completed events
- includeDaysheets: Also scrape daysheet data
- debug: Enable debug logging

## Output Format

The scraper outputs screenshot data for each event:

```json
{
  "name": "Puyallup Rodeo",
  "status": "Completed",
  "resultsUrl": "https://www.prorodeo.com/result/2025/puyallup-rodeo/16140?resultsTab=text",
  "screenshot": "data:image/png;base64,iVBORw0KGgoAAAANSUhEU...",
  "screenshotSize": 1899041,
  "pageTitle": "Puyallup Rodeo | PRCA Sports News",
  "type": "results_screenshot",
  "extractedAt": "2025-01-09T17:36:12.000Z"
}
```

## Testing

Run screenshot functionality test:
```bash
node test-screenshots.js
```

Run comprehensive test:
```bash
node test-scraper.js
```

## Project Structure

- .actor/actor.json - Apify actor configuration
- src/main.js - Entry point and crawler setup
- src/routes.js - URL routing and page handlers
- src/extractors.js - Data extraction logic
- src/constants.js - Selectors and configuration
- package.json - Dependencies
- INPUT_SCHEMA.json - Input validation schema
- Dockerfile - Container configuration

## Development Progress Log

### 2025-09-09 - Initial Setup & Testing

#### ✅ Repository Setup
- **13:00** - Initialized git repository and connected to GitHub remote
- **13:01** - Merged with existing advanced PRCA scraper code from remote repository
- **13:02** - Successfully pushed to GitHub: https://github.com/duggiephresh/prca-scraper

#### ✅ Apify Platform Integration  
- **18:01** - First build attempt failed: `File ".actor/INPUT_SCHEMA.json" does not exist!`
- **18:02** - **FIXED**: Moved `INPUT_SCHEMA.json` to `.actor/` directory as required by Apify platform
- **18:07** - **SUCCESS**: Actor build succeeded on Apify platform

#### ⚠️ Initial Runtime Issues
- **18:07** - First run encountered selector timeout: `Waiting for selector 'a' failed`
- **18:08** - Issue: PRCA website requires JavaScript, scraper not waiting long enough for content load

#### ✅ Enhanced Results vs Daysheet Handling
- **18:10** - **IMPROVED**: Enhanced logging to distinguish Results (🎯) vs Daysheets (📋)
- **18:11** - **ADDED**: Multiple selector fallback strategy for better page loading
- **18:12** - **ENHANCED**: Detailed queue logging showing counts of each type
- **18:13** - **IMPLEMENTED**: Individual URL tracking and extraction metrics

#### Current Status
- **Build**: ✅ Successful on Apify platform
- **Structure**: ✅ Proper `.actor/` directory configuration
- **Logging**: ✅ Enhanced with visual indicators and detailed metrics
- **Testing**: 🔄 Ready for testing with both Results and Daysheet extraction

#### Next Steps
1. Test updated scraper with `includeDaysheets: true`
2. Monitor logs for improved selector handling
3. Verify both Results and Daysheet data extraction
4. Optimize for production workloads

#### Key Files Modified
- `src/routes.js` - Enhanced logging and selector strategies
- `.actor/INPUT_SCHEMA.json` - Moved to correct Apify directory
- `README.md` - Added progress tracking

---

## License

ISC
