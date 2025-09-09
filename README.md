# PRCA Scraper

A web scraper built for the Apify platform that extracts rodeo results and event data from the Professional Rodeo Cowboys Association (PRCA) website.

## Features

- Scrapes rodeo results from prorodeo.com
- Extracts event information, contestant data, and results
- Supports pagination for comprehensive data collection
- Configurable output formats (JSON/CSV)
- Built for the Apify platform with Playwright

## Configuration

The scraper accepts the following input parameters:

- `startUrl`: The URL to begin scraping from (default: PRCA results page)
- `maxPages`: Maximum number of pages to scrape (1-100)
- `outputFormat`: Output format - json or csv

## Usage

### On Apify Platform

1. Deploy this scraper to your Apify account
2. Configure the input parameters
3. Run the scraper
4. Download the results from the dataset

### Local Development

1. Install dependencies: `npm install`
2. Set environment variables for Apify
3. Run: `npm start`

## Output Format

Each scraped item includes:
- `id`: Unique identifier
- `text`: Extracted text content
- `html`: Raw HTML snippet
- `timestamp`: When the data was scraped
- `type`: Classification of the data
- Additional fields based on content analysis

## Requirements

- Node.js 16+
- Playwright browser binaries
- Apify account (for platform deployment)

## Development

This scraper uses:
- Apify SDK for platform integration
- Playwright for browser automation
- Modern JavaScript (ES modules)

## License

ISC