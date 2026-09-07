import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
let foundErrors = false;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('.')) {
      const resolvedPath = path.resolve(path.dirname(file), importPath);
      let possibleFiles = [
        resolvedPath,
        resolvedPath + '.js',
        resolvedPath + '.jsx',
        path.join(resolvedPath, 'index.js'),
        path.join(resolvedPath, 'index.jsx')
      ];

      let matchedFile = null;
      for (const p of possibleFiles) {
        if (fs.existsSync(p)) {
          matchedFile = p;
          break;
        }
      }

      if (matchedFile) {
        const basename = path.basename(matchedFile);
        const dirname = path.dirname(matchedFile);
        const actualFiles = fs.readdirSync(dirname);
        if (!actualFiles.includes(basename)) {
          console.error(`Case mismatch in ${file}:\n  Imported: ${importPath}\n  Expected: ${actualFiles.find(f => f.toLowerCase() === basename.toLowerCase())}`);
          foundErrors = true;
        }
      } else {
         console.error(`File not found: ${importPath} in ${file}`);
         foundErrors = true;
      }
    }
  }
});

if (!foundErrors) console.log("No case mismatches found.");
