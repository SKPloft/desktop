#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const backendSrc = path.join(root, "backend", "src");
const outputPath = path.join(root, ".i18n-extract", "backend.yml");
const helperNames = ["tr", "tr_ui", "translate_ui"];

function yamlQuote(value) {
  return JSON.stringify(value);
}

function decodeRustString(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value;
  }
}

function lineFor(content, index) {
  return content.slice(0, index).split("\n").length;
}

function helperCallPattern(name) {
  return new RegExp(`\\b${name}\\s*\\(\\s*[^,]+,\\s*"((?:\\\\.|[^"\\\\])*)"`, "gs");
}

function dynamicHelperCallPattern(name) {
  return new RegExp(`\\b${name}\\s*\\(\\s*[^,]+,(?!\\s*")`, "gs");
}

function isTranslateCallInsideHelper(content, index) {
  const before = content.slice(0, index);
  const helperStart = before.lastIndexOf("fn tr");
  const previousFunctionStart = before.lastIndexOf("\nfn ");

  return helperStart !== -1 && helperStart >= previousFunctionStart;
}

function collectRustFiles(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    return [];
  }

  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...collectRustFiles(fullPath));
    } else if (entry.endsWith(".rs")) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractFromFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  const keys = [];
  const warnings = [];
  const patterns = [
    { label: ".translate", regex: /\.translate\s*\(\s*"((?:\\.|[^"\\])*)"/gs },
    ...helperNames.map((name) => ({ label: name, regex: helperCallPattern(name) })),
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.regex.exec(content))) {
      keys.push(decodeRustString(match[1]));
    }
  }

  const dynamicPatterns = [
    { label: ".translate", regex: /\.translate\s*\((?!\s*")/gs },
    ...helperNames.map((name) => ({ label: name, regex: dynamicHelperCallPattern(name) })),
  ];

  for (const pattern of dynamicPatterns) {
    let match;
    while ((match = pattern.regex.exec(content))) {
      if (pattern.label === ".translate" && isTranslateCallInsideHelper(content, match.index)) {
        continue;
      }

      warnings.push({
        file: path.relative(root, filePath),
        line: lineFor(content, match.index),
        call: pattern.label,
      });
    }
  }

  return { keys, warnings };
}

const keys = new Set();
const warnings = [];

for (const filePath of collectRustFiles(backendSrc)) {
  const result = extractFromFile(filePath);
  result.keys.forEach((key) => keys.add(key));
  warnings.push(...result.warnings);
}

const sortedKeys = Array.from(keys).sort();
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  ["_version: 1", ...sortedKeys.map((key) => `${yamlQuote(key)}: ${yamlQuote(key)}`), ""].join("\n"),
);

console.log(`i18n backend extractor: wrote ${sortedKeys.length} keys to .i18n-extract/backend.yml`);

if (warnings.length > 0) {
  console.warn("i18n backend extractor: dynamic translation calls need manual review:");
  for (const warning of warnings.slice(0, 20)) {
    console.warn(`- ${warning.file}:${warning.line} ${warning.call}(...)`);
  }
  if (warnings.length > 20) {
    console.warn(`- ...and ${warnings.length - 20} more`);
  }
}
