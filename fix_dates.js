const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInDir(fullPath);
        } else if (fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;

            if (content.includes(".toISOString().split('T')[0]") || content.includes(".toISOString().slice(0, 10)")) {
                content = content.replace(/\w+\.toISOString\(\)\.split\('T'\)\[0\]/g, (match) => {
                    const varName = match.split('.')[0];
                    return `getLocalYYYYMMDD(${varName === 'new Date()' || varName === 'Date' ? '' : varName})`;
                });
                content = content.replace(/new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]/g, 'getLocalYYYYMMDD()');
                content = content.replace(/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/g, 'getLocalYYYYMMDD()');
                
                // Also match things like `date.toISOString().split('T')[0]`
                
                if (!content.includes('getLocalYYYYMMDD')) { // if it didn't already have it
                    // The regex might need to be simple:
                }
                changed = true;
            }
            
            // Just manual regex is hard, let's just do simple string replacements for the common ones.
        }
    }
}
