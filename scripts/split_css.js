import fs from 'fs';
import path from 'path';

const cssPath = path.resolve('style.css');
const scssDir = path.resolve('scss');

// Read the massive CSS file
const content = fs.readFileSync(cssPath, 'utf8');

// Regex to match section headers like: /* ===== Section Name ===== */
const sectionRegex = /\/\*\s*=====\s*(.*?)\s*=====\s*\*\//g;

let match;
let sections = [];
let lastIndex = 0;
let lastTitle = 'Base';

// Find all sections
while ((match = sectionRegex.exec(content)) !== null) {
    if (lastIndex < match.index) {
        sections.push({
            title: lastTitle,
            content: content.substring(lastIndex, match.index).trim()
        });
    }
    lastTitle = match[1].trim();
    lastIndex = match.index;
}

// Push the final section
if (lastIndex < content.length) {
    sections.push({
        title: lastTitle,
        content: content.substring(lastIndex).trim()
    });
}

console.log(`Found ${sections.length} sections!`);

// Map to store filename mappings to avoid duplicates
const filesCreated = new Set();
const importLines = [];

// For each section, write to a SCSS partial
sections.forEach(sec => {
    if (!sec.content) return;
    
    // Clean up filename
    let filename = sec.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
        
    if (!filename) filename = 'misc';
    
    // Handle duplicates
    let uniqueFilename = filename;
    let counter = 1;
    while (filesCreated.has(uniqueFilename)) {
        uniqueFilename = `${filename}-${counter}`;
        counter++;
    }
    filesCreated.add(uniqueFilename);
    
    const filePath = path.join(scssDir, `_${uniqueFilename}.scss`);
    fs.writeFileSync(filePath, sec.content);
    
    importLines.push(`@use '${uniqueFilename}';`);
    console.log(`Created: _${uniqueFilename}.scss`);
});

// Update style.scss with all imports
const styleScssPath = path.join(scssDir, 'style.scss');
let styleScssContent = fs.readFileSync(styleScssPath, 'utf8');

// Append new imports to the end of style.scss
styleScssContent += '\n\n// ─── Extracted from style.css ───\n' + importLines.join('\n');
fs.writeFileSync(styleScssPath, styleScssContent);

console.log('Successfully split style.css into SCSS partials and updated style.scss!');
