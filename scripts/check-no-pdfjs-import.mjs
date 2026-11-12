// Fails (exit 1) when library sources or build output import pdfjs-dist.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const pattern = /(?:from\s*|import\s*\(?\s*|require\s*\(\s*)["']pdfjs-dist/;
const offenders = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(name) && pattern.test(readFileSync(path, "utf8"))) offenders.push(path);
  }
}

for (const dir of ["src", "dist"]) {
  if (existsSync(join(root, dir))) walk(join(root, dir));
}

if (offenders.length > 0) {
  console.error("pdfjs-dist is imported by:\n" + offenders.join("\n"));
  process.exit(1);
}
console.log("no pdfjs-dist imports");
