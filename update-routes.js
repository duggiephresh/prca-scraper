// Quick fix for routes.js to be more flexible
import fs from 'fs';

const content = fs.readFileSync('src/routes.js', 'utf8');

// Replace the strict selector wait with a more flexible approach
const updated = content.replace(
    'await page.waitForSelector(\'a[href*="/result/"]\'',
    'await page.waitForSelector(\'a\'',
);

fs.writeFileSync('src/routes.js', updated);
console.log('✅ Updated routes.js with more flexible waiting');
