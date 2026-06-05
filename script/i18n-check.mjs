#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import YAML from "yaml";

const require = createRequire(import.meta.url);
const { collectFrontendI18n } = require("./i18n-frontend-collector.cjs");

const root = process.cwd();
const writeMissing = process.argv.includes("--write");
const auditMode = process.argv.includes("--audit");

const localeFiles = {
  en: path.join(root, "locales", "en.yml"),
  zh: path.join(root, "locales", "zh-CN.yml"),
};

const extractedFiles = {
  frontend: path.join(root, ".i18n-extract", "frontend.yml"),
  backend: path.join(root, ".i18n-extract", "backend.yml"),
};

function yamlQuote(value) {
  return JSON.stringify(value);
}

function readYamlMap(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`${label} is missing at ${path.relative(root, filePath)}`); // I18N: no-translate - internal exception
  }

  const content = readFileSync(filePath, "utf8");
  const parsed = YAML.parse(content);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must parse to a YAML mapping`); // I18N: no-translate - internal exception
  }

  if (parsed._version !== 1) {
    throw new Error(`${label} must contain _version: 1`); // I18N: no-translate - internal exception
  }

  return parsed;
}

function translationKeys(map) {
  return Object.keys(map)
    .filter((key) => key !== "_version")
    .sort();
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((key) => !rightSet.has(key)).sort();
}

function union(...lists) {
  return Array.from(new Set(lists.flat())).sort();
}

function sample(keys, limit = 25) {
  if (keys.length === 0) {
    return "none";
  }

  const visible = keys.slice(0, limit);
  const suffix = keys.length > limit ? `, ...and ${keys.length - limit} more` : "";
  return `${visible.join(", ")}${suffix}`;
}

function appendEntries(filePath, entries, fallbackMap) {
  if (entries.length === 0) {
    return;
  }

  let content = readFileSync(filePath, "utf8");
  if (!content.endsWith("\n")) {
    content += "\n";
  }
  if (!content.endsWith("\n\n")) {
    content += "\n";
  }

  content += "# Added by i18n extraction. Replace fallback values with localized copy.\n";
  for (const key of entries) {
    const fallback = fallbackMap.get(key) ?? key;
    content += `${yamlQuote(key)}: ${yamlQuote(fallback)}\n`;
  }

  writeFileSync(filePath, content);
}

function collectFiles(dir, predicate) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    return [];
  }

  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath, predicate));
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function collectFrontendAudit() {
  const files = [
    ...collectFiles(path.join(root, "src"), (filePath) => /\.(ts|tsx)$/.test(filePath)),
    ...collectFiles(path.join(root, "src-llmtools"), (filePath) => /\.(ts|tsx)$/.test(filePath)),
  ];
  const result = {
    dynamicWarnings: [],
    sourceLiterals: [],
    skippedLiterals: [],
  };

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf8");
    const collected = collectFrontendI18n(content, filePath, { auditSourceLiterals: true });
    result.dynamicWarnings.push(...collected.dynamicWarnings);
    result.sourceLiterals.push(...collected.sourceLiterals);
    result.skippedLiterals.push(...collected.skippedLiterals);
  }

  return result;
}

function main() {
  const frontend = readYamlMap(extractedFiles.frontend, "frontend extraction output");
  const backend = readYamlMap(extractedFiles.backend, "backend extraction output");
  const en = readYamlMap(localeFiles.en, "locales/en.yml");
  const zh = readYamlMap(localeFiles.zh, "locales/zh-CN.yml");

  const frontendKeys = translationKeys(frontend);
  const backendKeys = translationKeys(backend);
  const extractedKeys = union(frontendKeys, backendKeys);
  const enKeys = translationKeys(en);
  const zhKeys = translationKeys(zh);
  const expectedZhKeys = union(enKeys, extractedKeys);

  const missingEn = difference(extractedKeys, enKeys);
  const staleEn = difference(enKeys, extractedKeys);
  const missingZh = difference(expectedZhKeys, zhKeys);
  const frontendAudit = collectFrontendAudit();
  const dynamicWarnings = frontendAudit.dynamicWarnings;

  if (writeMissing) {
    const enFallbacks = new Map(enKeys.map((key) => [key, en[key]]));
    for (const key of missingEn) {
      enFallbacks.set(key, key);
    }

    appendEntries(localeFiles.en, missingEn, new Map());
    appendEntries(localeFiles.zh, missingZh, enFallbacks);

    if (missingEn.length > 0 || missingZh.length > 0) {
      mkdirSync(path.dirname(localeFiles.en), { recursive: true });
      console.log(`i18n merge: appended ${missingEn.length} en keys and ${missingZh.length} zh-CN keys`); // I18N: no-translate - developer diagnostic
    }
  }

  console.log("i18n check:"); // I18N: no-translate - developer diagnostic
  console.log(`- frontend extracted keys: ${frontendKeys.length}`); // I18N: no-translate - developer diagnostic
  console.log(`- backend extracted keys: ${backendKeys.length}`); // I18N: no-translate - developer diagnostic
  console.log(`- combined extracted keys: ${extractedKeys.length}`); // I18N: no-translate - developer diagnostic
  console.log(`- locales/en.yml keys: ${enKeys.length}`); // I18N: no-translate - developer diagnostic
  console.log(`- locales/zh-CN.yml keys: ${zhKeys.length}`); // I18N: no-translate - developer diagnostic
  console.log(`- missing in locales/en.yml: ${missingEn.length}${missingEn.length ? ` (${sample(missingEn)})` : ""}`); // I18N: no-translate - developer diagnostic
  console.log(`- stale in locales/en.yml: ${staleEn.length}${staleEn.length ? ` (${sample(staleEn)})` : ""}`); // I18N: no-translate - developer diagnostic
  console.log(`- missing in locales/zh-CN.yml: ${missingZh.length}${missingZh.length ? ` (${sample(missingZh)})` : ""}`); // I18N: no-translate - developer diagnostic
  console.log(`- dynamic frontend calls: ${dynamicWarnings.length}`); // I18N: no-translate - developer diagnostic

  if (dynamicWarnings.length > 0) {
    for (const warning of dynamicWarnings.slice(0, 20)) {
      console.log( // I18N: no-translate - developer diagnostic
        `  - ${path.relative(root, warning.file)}:${warning.line} ${warning.expression} (${warning.reason})`,
      );
    }
    if (dynamicWarnings.length > 20) {
      console.log(`  - ...and ${dynamicWarnings.length - 20} more`); // I18N: no-translate - developer diagnostic
    }
  }

  if (auditMode) {
    console.log(`- included source literals: ${frontendAudit.sourceLiterals.length}`); // I18N: no-translate - developer diagnostic
    for (const item of frontendAudit.sourceLiterals.slice(0, 30)) {
      console.log(`  - ${path.relative(root, item.file)}:${item.line} ${item.kind}: ${JSON.stringify(item.value)}`); // I18N: no-translate - developer diagnostic
    }
    if (frontendAudit.sourceLiterals.length > 30) {
      console.log(`  - ...and ${frontendAudit.sourceLiterals.length - 30} more`); // I18N: no-translate - developer diagnostic
    }

    console.log(`- skipped source literals: ${frontendAudit.skippedLiterals.length}`); // I18N: no-translate - developer diagnostic
    for (const item of frontendAudit.skippedLiterals.slice(0, 50)) {
      console.log( // I18N: no-translate - developer diagnostic
        `  - ${path.relative(root, item.file)}:${item.line} ${item.kind}: ${JSON.stringify(item.value)} (${item.reason})`,
      );
    }
    if (frontendAudit.skippedLiterals.length > 50) {
      console.log(`  - ...and ${frontendAudit.skippedLiterals.length - 50} more`); // I18N: no-translate - developer diagnostic
    }
  }

  if (!writeMissing && (missingEn.length > 0 || missingZh.length > 0)) {
    console.error("i18n check failed: run `bun run i18n:merge` to append missing fallback keys."); // I18N: no-translate - developer diagnostic
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(`i18n check failed: ${error.message}`); // I18N: no-translate - developer diagnostic
  process.exitCode = 1;
}
