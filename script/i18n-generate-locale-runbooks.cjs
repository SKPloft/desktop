/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Build-time script: generates locale-specific .atrb files for preset runbooks.
 *
 * Reads English source .atrb files, translates text content and names via the
 * locale catalog, and writes locale-specific copies with new UUIDs.
 *
 * Usage: node script/i18n-generate-locale-runbooks.cjs [locale]
 *   locale: optional, defaults to "zh-CN"
 */

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const { uuidv7 } = require("uuidv7");

const ROOT = path.resolve(__dirname, "..");
const LOCALES_DIR = path.join(ROOT, "locales", "runbooks");

function normalize(str) {
  return str
    .trim()
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "--");
}

function normalizeCatalog(catalog) {
  const normalized = {};
  for (const [key, value] of Object.entries(catalog)) {
    normalized[normalize(key)] = value;
  }
  return normalized;
}

function loadCatalog(locale) {
  const catalogPath = path.join(LOCALES_DIR, `${locale}.json`);
  if (!fs.existsSync(catalogPath)) {
    console.warn(`[warn] No catalog found for ${locale} at ${catalogPath}`);
    return {};
  }
  const raw = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
  return normalizeCatalog(raw);
}

function translateInlineContent(item, catalog) {
  const translated = { ...item };

  if (item.type === "text" && typeof item.text === "string") {
    const lookupKey = normalize(item.text);
    translated.text =
      catalog[lookupKey] !== undefined ? catalog[lookupKey] : item.text;
  }

  if (Array.isArray(item.content)) {
    translated.content = item.content.map((child) =>
      translateInlineContent(child, catalog),
    );
  }

  return translated;
}

function translateBlock(block, catalog) {
  const translated = { ...block };

  if (Array.isArray(block.content)) {
    translated.content = block.content.map((item) =>
      translateInlineContent(item, catalog),
    );
  }

  if (Array.isArray(block.children)) {
    translated.children = block.children.map((child) =>
      translateBlock(child, catalog),
    );
  }

  if (block.props && typeof block.props.name === "string") {
    const lookupKey = normalize(block.props.name);
    translated.props = {
      ...block.props,
      name:
        catalog[lookupKey] !== undefined
          ? catalog[lookupKey]
          : block.props.name,
    };
  }

  return translated;
}

function translateContent(content, catalog) {
  if (!Array.isArray(content)) return content;
  return content.map((block) => translateBlock(block, catalog));
}

function translateRunbookName(name, catalog) {
  const lookupKey = normalize(name);
  return catalog[lookupKey] !== undefined ? catalog[lookupKey] : name;
}

function processAtrbFile(filePath, locale, catalog) {
  const raw = fs.readFileSync(filePath, "utf-8");

  let doc;
  try {
    doc = YAML.parse(raw);
  } catch (e) {
    console.warn(`[warn] Failed to parse ${filePath}: ${e.message}`);
    return;
  }

  if (!doc || typeof doc !== "object") {
    console.warn(`[warn] Failed to parse document from ${filePath}`);
    return;
  }

  const originalName = doc.name || "";
  doc.id = uuidv7();
  doc.name = translateRunbookName(originalName, catalog);

  if (Array.isArray(doc.content)) {
    doc.content = translateContent(doc.content, catalog);
  }

  const nameBase = path.basename(filePath, ".atrb");
  const localeFile = `${nameBase}.${locale}.atrb`;
  const outputPath = path.join(path.dirname(filePath), localeFile);

  const outYaml = YAML.stringify(doc, {
    lineWidth: 0,
    doubleQuotedMinLength: 9999,
  });

  fs.writeFileSync(outputPath, outYaml, "utf-8");
  console.log(`[${locale}] ${nameBase}.atrb → ${localeFile} (${doc.name})`);
}

function findAtrbFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAtrbFiles(fullPath));
    } else if (entry.name.endsWith(".atrb")) {
      if (/\.[a-z]{2}(-[A-Z]{2})?\.atrb$/.test(entry.name)) {
        continue;
      }
      results.push(fullPath);
    }
  }
  return results;
}

function main() {
  const locale = process.argv[2] || "zh-CN";
  const catalog = loadCatalog(locale);

  if (Object.keys(catalog).length === 0) {
    console.error(`[error] Empty catalog for ${locale}. Aborting.`);
    process.exit(1);
  }

  const presetDirs = [
    path.join(ROOT, "resources", "welcome"),
    path.join(ROOT, "runbooks"),
  ];

  let total = 0;

  for (const dir of presetDirs) {
    const files = findAtrbFiles(dir);
    for (const file of files) {
      processAtrbFile(file, locale, catalog);
      total++;
    }
  }

  console.log(
    `\n[${locale}] Generated ${total} locale-specific .atrb files.`,
  );
}

main();
