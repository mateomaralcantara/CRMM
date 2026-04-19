const fs = require("fs");
const path = require("path");

const root = path.join(process.cwd(), "app");

function getPageFiles(dir) {
  const files = [];

  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getPageFiles(fullPath));
    } else if (item === "page.tsx") {
      files.push(fullPath);
    }
  }

  return files;
}

function findMatchingBracket(source, startIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let i = startIndex; i < source.length; i++) {
    const char = source[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "[") depth++;
    if (char === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function wrapArrayProp(source, propName) {
  let search = `${propName}=[`;
  let index = 0;

  while (true) {
    const start = source.indexOf(search, index);
    if (start === -1) break;

    const arrayStart = start + `${propName}=`.length;
    const arrayEnd = findMatchingBracket(source, arrayStart);

    if (arrayEnd === -1) {
      console.warn(`No pude cerrar ${propName} en este archivo.`);
      break;
    }

    source =
      source.slice(0, start) +
      `${propName}={` +
      source.slice(arrayStart, arrayEnd + 1) +
      `}` +
      source.slice(arrayEnd + 1);

    index = arrayEnd + 3;
  }

  return source;
}

const files = getPageFiles(root);

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  const original = content;

  content = wrapArrayProp(content, "columns");
  content = wrapArrayProp(content, "fields");

  if (content !== original) {
    fs.writeFileSync(file, content, "utf8");
    console.log(`Corregido: ${path.relative(process.cwd(), file)}`);
  }
}

console.log("Listo. JSX arrays corregidos.");