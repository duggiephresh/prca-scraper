# PRCA Rodeo Results Scraper

An Apify actor that scrapes completed rodeo results from ProRodeo.com. This scraper handles JavaScript-rendered content using PuppeteerCrawler and outputs structured JSON data suitable for n8n workflow processing.

## Features

- Scrapes completed rodeo events from ProRodeo.com
- Handles JavaScript-rendered content with Puppeteer
- Extracts contestant results with scores and prize money
- Optional daysheet data extraction
- Automatic pagination handling
- Resource blocking for improved performance
- Configurable concurrency and filtering options

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

The scraper outputs structured JSON data for each event with eventName, location, status, categories, and results.

## Project Structure

- .actor/actor.json - Apify actor configuration
- src/main.js - Entry point and crawler setup
- src/routes.js - URL routing and page handlers
- src/extractors.js - Data extraction logic
- src/constants.js - Selectors and configuration
- package.json - Dependencies
- INPUT_SCHEMA.json - Input validation schema
- Dockerfile - Container configuration

## License

ISC
