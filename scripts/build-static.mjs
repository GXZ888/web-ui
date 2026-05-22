import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const outputDir = resolve(root, "public");

const entriesToCopy = [
  "index.html",
  "favicon.ico",
  "config.json",
  "assets",
  "loaders",
];

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const entry of entriesToCopy) {
  const source = resolve(root, entry);
  const target = resolve(outputDir, entry);

  if (!existsSync(source)) {
    throw new Error(`Missing required static entry: ${entry}`);
  }

  cpSync(source, target, { recursive: true });
}

console.log(`Built static site into ${outputDir}`);

