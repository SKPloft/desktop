#!/usr/bin/env node
/**
 * I18N TODO Tracker
 *
 * Scans src/, src-llmtools/, crates/, and backend/ for lines containing
 * "// I18N TODO" (case-insensitive) and records them in a TSV report at
 * .i18n-extract/i18n-todo-tracker.tsv.
 *
 * Behavior:
 *  - Never removes existing columns from the TSV; only appends new known columns.
 *  - Matches existing rows by file + line content similarity (Levenshtein ≥ 0.7).
 *    Also matches against the "Translated Line Content" column if present.
 *  - On match, updates the line number and line content while preserving all
 *    other column values (e.g. [Replaced with key?], [Translated?], key name).
 *  - If an existing row no longer matches any current TODO line, marks it with
 *    [X] in the [Missing?] column.
 *  - Classifies each TODO line by type (exception, console/log, rust-log, etc.)
 *    and appends a summary at the bottom of the report.
 *
 * Columns:
 *  - File                : relative path from project root
 *  - Line                : current line number in the source file
 *  - Line Content        : the full trimmed line containing the I18N TODO
 *  - Line Type           : auto-classified category of the line
 *  - [Replaced with key?]: manual mark, set [X] when replaced with t(key)
 *  - [Missing?]          : auto-set [X] when the line no longer exists in source
 *  - [Translated?]       : manual mark, set [X] when translation is complete
 *  - Translated Key Name : the i18n key assigned to this line
 *  - Translated Line Content : the translated version of the line (if any)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = process.cwd();
const outputDir = resolve(".i18n-extract");
const outputFile = resolve(outputDir, "i18n-todo-tracker.tsv");

const SCAN_ROOTS = ["src", "src-llmtools", "crates", "backend"];
const SKIP_DIRS = new Set(["node_modules", "dist", "target", ".git", "vendor"]);
const TODO_PATTERN = /\/\/\s*I18N\s+TODO/i;

const COL_FILE = "File";
const COL_LINE = "Line";
const COL_LINE_CONTENT = "Line Content";
const COL_LINE_TYPE = "Line Type";
const COL_REPLACED = "[Replaced with key?]";
const COL_MISSING = "[Missing?]";
const COL_TRANSLATED = "[Translated?]";
const COL_TRANSLATED_KEY = "Translated Key Name";
const COL_TRANSLATED_CONTENT = "Translated Line Content";

const KNOWN_COLUMNS = [
  COL_FILE, COL_LINE, COL_LINE_CONTENT, COL_LINE_TYPE,
  COL_REPLACED, COL_MISSING, COL_TRANSLATED,
  COL_TRANSLATED_KEY, COL_TRANSLATED_CONTENT,
];

function walk(dir) {
  const results = [];
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return results;

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full, { throwIfNoEntry: false });
    if (!stat) continue;

    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) results.push(...walk(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

function collectTodoLines() {
  const entries = [];

  for (const scanRoot of SCAN_ROOTS) {
    const dir = join(root, scanRoot);
    if (!existsSync(dir)) continue;

    const files = walk(dir);
    for (const file of files) {
      const relPath = relative(root, file);
      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (TODO_PATTERN.test(line)) {
          entries.push({
            file: relPath,
            line: i + 1,
            content: line.trim(),
          });
        }
      }
    }
  }

  return entries;
}

function classifyLineType(lineContent) {
  const lower = lineContent.toLowerCase();

  if (lower.includes("throw new error") || lower.includes("reject(new error")) return "exception";
  if (lower.includes("console.")) return "console/log";
  if (/\b(log|tracing)::(error|warn|info|debug|trace)!/.test(lineContent)) return "rust-log";
  if (/\b(eprintln!|println!|print!)\s*\(/.test(lineContent)) return "rust-print";
  if (/\b(panic!|todo!|unimplemented!|unreachable!)\s*\(/.test(lineContent)) return "rust-panic";
  if (/\b(assert!|assert_eq!|assert_ne!)\s*\(/.test(lineContent)) return "assertion";
  if (/\b(anyhow!|bail!|ensure!)\s*\(/.test(lineContent)) return "rust-error";
  if (lineContent.includes("displayName")) return "displayName";
  if (lineContent.includes("localStorage.")) return "storage";
  if (lineContent.includes("addToast") || lineContent.includes("setError") || lineContent.includes("setImportError")) return "ui-error";
  if (lineContent.includes("<h3") || lineContent.includes("<Button") || lineContent.includes("<p") || lineContent.includes("<span")) return "visible-ui";
  if (lineContent.includes("t(") || lineContent.includes("translate(")) return "i18n-call";
  if (lineContent.includes("tr(") || lineContent.includes(".i18n()")) return "rust-i18n-call";

  return "literal";
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

const SIMILARITY_THRESHOLD = 0.7;

function parseExistingTSV() {
  if (!existsSync(outputFile)) return null;

  const raw = readFileSync(outputFile, "utf8");
  const allLines = raw.split("\n");

  const headerLine = allLines[0];
  if (!headerLine) return null;

  const headers = headerLine.split("\t");
  const existingColumns = headers.map(h => h.trim());

  const dataRows = [];
  for (let i = 1; i < allLines.length; i++) {
    const line = allLines[i];
    if (!line || line.startsWith("##")) break;
    const cells = line.split("\t");
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[existingColumns[j]] = (cells[j] || "").trim();
    }
    dataRows.push(row);
  }

  return { headers: existingColumns, rows: dataRows };
}

function findMatchingRow(entry, existingRows, claimed) {
  const entryContentKey = entry.content.replace(/\s+/g, " ").toLowerCase();
  const entryContentNoTodo = entryContentKey.replace(/\/\/\s*i18n\s*todo\s*/i, "").trim();

  for (const row of existingRows) {
    if (claimed.has(row)) continue;
    if (row[COL_FILE] !== entry.file) continue;

    const existingLineContent = (row[COL_LINE_CONTENT] || "").replace(/\s+/g, " ").toLowerCase();
    const existingTranslatedContent = (row[COL_TRANSLATED_CONTENT] || "").replace(/\s+/g, " ").toLowerCase();

    if (existingLineContent === entryContentKey) {
      return row;
    }

    if (existingTranslatedContent && existingTranslatedContent === entryContentKey) {
      return row;
    }

    const existingNoTodo = existingLineContent.replace(/\/\/\s*i18n\s*todo\s*/i, "").trim();
    if (existingNoTodo === entryContentNoTodo) {
      return row;
    }

    if (similarity(existingLineContent, entryContentKey) >= SIMILARITY_THRESHOLD) {
      return row;
    }

    if (existingTranslatedContent && similarity(existingTranslatedContent, entryContentKey) >= SIMILARITY_THRESHOLD) {
      return row;
    }
  }

  return null;
}

function buildReport(entries) {
  const existing = parseExistingTSV();

  let columns;
  let existingRows;

  if (existing) {
    columns = [...existing.headers];
    existingRows = existing.rows;

    for (const newCol of KNOWN_COLUMNS) {
      if (!columns.includes(newCol)) {
        columns.push(newCol);
      }
    }
  } else {
    columns = [...KNOWN_COLUMNS];
    existingRows = [];
  }

  const matchedRows = new Set();
  const newRows = [];
  const logNew = [];
  const logMissing = [];
  const logMoved = [];

  for (const entry of entries) {
    const matchedRow = findMatchingRow(entry, existingRows, matchedRows);
    const lineType = classifyLineType(entry.content);
    const escapedContent = entry.content.replace(/\t/g, "    ").replace(/\n/g, " ");

    let row;
    if (matchedRow) {
      matchedRows.add(matchedRow);
      row = { ...matchedRow };
      const oldLine = parseInt(row[COL_LINE], 10);
      if (oldLine && oldLine !== entry.line) {
        logMoved.push(`${entry.file}:${oldLine} → ${entry.line}  ${escapedContent}`);
      }
      row[COL_LINE] = String(entry.line);
      row[COL_LINE_CONTENT] = escapedContent;
      row[COL_LINE_TYPE] = lineType;
      row[COL_FILE] = entry.file;
    } else {
      logNew.push(`${entry.file}:${entry.line}  ${escapedContent}`);
      row = {};
      row[COL_FILE] = entry.file;
      row[COL_LINE] = String(entry.line);
      row[COL_LINE_CONTENT] = escapedContent;
      row[COL_LINE_TYPE] = lineType;
    }

    if (!row[COL_REPLACED]) row[COL_REPLACED] = "[ ]";
    if (!row[COL_TRANSLATED]) row[COL_TRANSLATED] = "[ ]";
    if (!row[COL_TRANSLATED_KEY]) row[COL_TRANSLATED_KEY] = "";
    if (!row[COL_TRANSLATED_CONTENT]) row[COL_TRANSLATED_CONTENT] = "";

    newRows.push(row);
  }

  const unmatchedRows = existingRows.filter(r => !matchedRows.has(r));
  for (const unmatched of unmatchedRows) {
    const row = { ...unmatched };
    row[COL_MISSING] = "[X]";
    const file = row[COL_FILE] || "?";
    const line = row[COL_LINE] || "?";
    const content = (row[COL_LINE_CONTENT] || "").slice(0, 80);
    logMissing.push(`${file}:${line}  ${content}`);
    newRows.push(row);
  }

  const headerLine = columns.join("\t");
  const dataLines = newRows.map(row =>
    columns.map(col => row[col] ?? "").join("\t")
  );

  const typeCounts = entries.reduce((acc, entry) => {
    const type = classifyLineType(entry.content);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const typeSummary = [];
  typeSummary.push("");
  typeSummary.push("## Line Type Summary");
  typeSummary.push("");
  typeSummary.push(`Total I18N TODO lines found: ${entries.length}`);
  typeSummary.push(`Rows preserved from previous run: ${unmatchedRows.length} (marked missing)`);
  typeSummary.push("");
  typeSummary.push("Breakdown by line type:");
  for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    typeSummary.push(`  - ${type}: ${count}`);
  }

  return {
    report: [headerLine, ...dataLines, ...typeSummary].join("\n") + "\n",
    logNew,
    logMissing,
    logMoved,
  };
}

function main() {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const entries = collectTodoLines();
  const { report, logNew, logMissing, logMoved } = buildReport(entries);

  writeFileSync(outputFile, report);

  if (logNew.length > 0) {
    console.log(`NEW (${logNew.length}):`);
    for (const msg of logNew) console.log(`  + ${msg}`);
  }

  if (logMissing.length > 0) {
    console.log(`MISSING (${logMissing.length}):`);
    for (const msg of logMissing) console.log(`  - ${msg}`);
  }

  if (logMoved.length > 0) {
    console.log(`MOVED (${logMoved.length}):`);
    for (const msg of logMoved) console.log(`  ~ ${msg}`);
  }

  if (logNew.length === 0 && logMissing.length === 0 && logMoved.length === 0) {
    console.log("No changes.");
  }

  console.error(`Found ${entries.length} I18N TODO lines`);
  console.error(`Report written to ${relative(root, outputFile)}`);
}

main();
