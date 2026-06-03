const fs = require("fs");
const path = require("path");
const Vinyl = require("vinyl");
const { collectFrontendI18n } = require("./script/i18n-frontend-collector.cjs");

const extractedKeys = new Map();
const sourceLiterals = [];
const skippedLiterals = [];
const dynamicWarnings = [];
const extensions = new Set([".ts", ".tsx"]);

function yamlQuote(value) {
  return JSON.stringify(value);
}

function relativeFile(file) {
  return path.relative(process.cwd(), file);
}

function recordKey(record) {
  if (!extractedKeys.has(record.key)) {
    extractedKeys.set(record.key, record.defaultValue ?? record.key);
  }
}

module.exports = {
  input: [
    "src/**/*.{ts,tsx}",
    "src-llmtools/**/*.{ts,tsx}",
    "!**/*.test.{ts,tsx}",
    "!**/*.spec.{ts,tsx}",
    "!**/node_modules/**",
    "!**/dist/**",
  ],
  output: ".",
  options: {
    debug: false,
    defaultLng: "en",
    defaultNs: "translation",
    defaultValue: (lng, ns, key) => key,
    func: {
      list: ["t", "translate", "useTranslation().t"],
      extensions: [],
    },
    lngs: ["en"],
    ns: ["translation"],
    keySeparator: false,
    nsSeparator: false,
    interpolation: {
      prefix: "{{",
      suffix: "}}",
    },
    resource: {
      loadPath: ".i18n-extract/{{lng}}/{{ns}}.json",
      savePath: ".i18n-extract/{{lng}}/{{ns}}.json",
      jsonIndent: 2,
      lineEnding: "\n",
    },
  },
  transform(file, enc, done) {
    const parser = this.parser;
    const ext = path.extname(file.path);

    if (!extensions.has(ext)) {
      done();
      return;
    }

    const content = fs.readFileSync(file.path, enc);
    const result = collectFrontendI18n(content, file.path, {
      includeSourceLiterals: process.env.I18N_EXTRACT_SOURCE_LITERALS === "1",
      auditSourceLiterals: process.env.I18N_AUDIT === "1",
    });

    for (const record of result.keys) {
      recordKey(record);
      parser.set(record.key, {
        defaultValue: record.defaultValue ?? record.key,
        keySeparator: false,
        nsSeparator: false,
      });
    }

    sourceLiterals.push(...result.sourceLiterals);
    skippedLiterals.push(...result.skippedLiterals);
    dynamicWarnings.push(...result.dynamicWarnings);

    done();
  },
  flush(done) {
    const keys = Array.from(extractedKeys.entries()).sort(([left], [right]) => left.localeCompare(right));
    const lines = ["_version: 1", ...keys.map(([key, value]) => `${yamlQuote(key)}: ${yamlQuote(value)}`), ""];

    this.push(
      new Vinyl({
        path: ".i18n-extract/frontend.yml",
        contents: Buffer.from(lines.join("\n")),
      }),
    );

    console.log(`i18n frontend extractor: wrote ${keys.length} keys to .i18n-extract/frontend.yml`);

    if (process.env.I18N_AUDIT === "1") {
      console.log(`i18n frontend audit: ${sourceLiterals.length} source literals included`);
      for (const item of sourceLiterals.slice(0, 40)) {
        console.log(`- included ${relativeFile(item.file)}:${item.line} ${item.kind}: ${JSON.stringify(item.value)}`);
      }
      if (sourceLiterals.length > 40) {
        console.log(`- ...and ${sourceLiterals.length - 40} more included source literals`);
      }

      console.log(`i18n frontend audit: ${skippedLiterals.length} source literals skipped`);
      for (const item of skippedLiterals.slice(0, 40)) {
        console.log(
          `- skipped ${relativeFile(item.file)}:${item.line} ${item.kind}: ${JSON.stringify(item.value)} (${item.reason})`,
        );
      }
      if (skippedLiterals.length > 40) {
        console.log(`- ...and ${skippedLiterals.length - 40} more skipped source literals`);
      }

      console.log(`i18n frontend audit: ${dynamicWarnings.length} dynamic translation calls`);
      for (const warning of dynamicWarnings.slice(0, 40)) {
        console.log(
          `- dynamic ${relativeFile(warning.file)}:${warning.line} ${warning.call}: ${warning.expression} (${warning.reason})`,
        );
      }
      if (dynamicWarnings.length > 40) {
        console.log(`- ...and ${dynamicWarnings.length - 40} more dynamic translation calls`);
      }
    }

    done();
  },
};
