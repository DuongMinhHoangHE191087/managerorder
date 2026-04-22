/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(srcDir);
const regex1 = /\.toLocaleDateString\('vi-VN'\)/g;
const regex2 = /\.toLocaleDateString\("vi-VN"\)/g;

let changed = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(regex1, ".toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })");
  newContent = newContent.replace(regex2, ".toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })");
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    changed++;
    console.log('Updated', file);
  }
});

console.log(`Done. Updated ${changed} files.`);
