#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname, extname } from "node:path";
import { parseArgs } from "node:util";

const root = process.cwd();

const BUILTIN_PRESETS = {
  "at-mark": {
    description: 'Comment mark: // @i18n:key.name',
    extractors: [{
      regex: "//\\s*@i18n:\\s*([^\\s]+)",
      keyGroup: 1,
      defaultValueGroup: null,
      description: '// @i18n:key.name'
    }]
  },
  "at-mark-with-value": {
    description: 'Comment mark with default: // @i18n:key.name "Default Value"',
    extractors: [{
      regex: '//\\s*@i18n:\\s*(\\S+)\\s*["\\x27]([^"\\x27]+)["\\x27]',
      keyGroup: 1,
      defaultValueGroup: 2,
      description: '// @i18n:key.name "Default Value"'
    }]
  },
  "js-t-function": {
    description: "JS/TS t() function calls",
    extractors: [
      {
        regex: "\\bt\\s*\\(\\s*[\"\\x27]([^\"\\x27]+)[\"\\x27]",
        keyGroup: 1,
        defaultValueGroup: null,
        description: 't("key") and t(\'key\')'
      },
      {
        regex: "\\btranslate\\s*\\(\\s*[\"\\x27]([^\"\\x27]+)[\"\\x27]",
        keyGroup: 1,
        defaultValueGroup: null,
        description: 'translate("key")'
      }
    ]
  },
  "rust-tr-function": {
    description: "Rust tr() and i18n().translate() calls",
    extractors: [
      {
        regex: '\\btr\\s*\\(\\s*[^,]+,\\s*["\\x27]([^"\\x27]+)["\\x27]',
        keyGroup: 1,
        defaultValueGroup: null,
        description: 'tr(handle, "key")'
      },
      {
        regex: '\\bi18n\\s*\\(\\)\\s*\\.\\s*translate\\s*\\(\\s*["\\x27]([^"\\x27]+)["\\x27]',
        keyGroup: 1,
        defaultValueGroup: null,
        description: 'app.i18n().translate("key")'
      }
    ]
  },
  "all-js": {
    description: "All JS/TS i18n calling conventions",
    extractors: [
      {
        regex: "\\bt\\s*\\(\\s*[\"\\x27]([^\"\\x27]+)[\"\\x27]",
        keyGroup: 1,
        defaultValueGroup: null,
        description: 't("key"), t(\'key\')'
      },
      {
        regex: "\\btranslate\\s*\\(\\s*[\"\\x27]([^\"\\x27]+)[\"\\x27]",
        keyGroup: 1,
        defaultValueGroup: null,
        description: 'translate("key")'
      }
    ]
  },
  "all-rust": {
    description: "All Rust i18n calling conventions",
    extractors: [
      {
        regex: '\\btr\\s*\\(\\s*[^,]+,\\s*["\\x27]([^"\\x27]+)["\\x27]',
        keyGroup: 1,
        defaultValueGroup: null,
        description: 'tr(handle, "key")'
      },
      {
        regex: '\\bi18n\\s*\\(\\)\\s*\\.\\s*translate\\s*\\(\\s*["\\x27]([^"\\x27]+)["\\x27]',
        keyGroup: 1,
        defaultValueGroup: null,
        description: '.i18n().translate("key")'
      }
    ]
  }
};

function usage() {
  const script = relative(root, process.argv[1] || "script/i18n-extract-marked.mjs");
  return `
USAGE
  node ${script} [options]

  Scan code files for i18n marks and extract translation keys.

OPTIONS
  --config <path>      JSON config file with mark definitions
  --preset <name>      Built-in preset name (or comma-separated list)
                       Available: ${Object.keys(BUILTIN_PRESETS).join(", ")}
  --regex <pattern>    Direct regex pattern for the mark
  --key-group <n>      Capture group index for the key (default: 1)
  --default-group <n>  Capture group index for the default value
  --files <glob...>    File patterns to scan (space-separated)
  --output <path>      Output file path (YAML)
  --format <fmt>       Output format: yaml, json, text (default: yaml)
  --list               List matching lines with file:line:key instead of
                       the normal extracted-keys output
  --verbose            Show per-file and per-line details
  --no-dedup           Don't deduplicate keys (useful for audit)
  --help               Show this help

EXAMPLES
  # Use the @i18n comment mark on frontend and backend
  node ${script} \\
    --preset at-mark \\
    --files 'src/**/*.{ts,tsx}' 'backend/src/**/*.rs'

  # Use a config file
  node ${script} --config .i18n-extract/mark-config.json

  # Ad-hoc regex: find all t("...") calls in src/
  node ${script} \\
    --regex '\\\\bt\\\\s*\\\\(\\\\s*["\\x27]([^"\\x27]+)["\\x27]' \\
    --files 'src/**/*.ts' 'src/**/*.tsx' \\
    --output .i18n-extract/ad-hoc.yml

  # List matched lines for audit (no dedup)
  node ${script} --preset at-mark --files 'src/**/*.{ts,tsx}' --list

  # Search both JS and Rust conventions
  node ${script} --preset all-js,all-rust

  # Text format to stdout
  node ${script} --preset at-mark --files 'src/**/*.ts' --format text

CONFIG FILE FORMAT
  A JSON file with a "marks" array:

  {
    "marks": [
      {
        "name": "my-frontend-marks",
        "filePatterns": ["src/**/*.ts", "src/**/*.tsx"],
        "exclude": ["**/node_modules/**", "**/dist/**"],
        "extractors": [
          {
            "regex": "//\\\\s*@i18n:\\\\s*(\\\\S+)",
            "keyGroup": 1,
            "defaultValueGroup": null,
            "description": "// @i18n:key.name"
          }
        ]
      }
    ],
    "output": ".i18n-extract/marked.yml"
  }
`.trim();
}

function buildRegex(pattern) {
  const re = new RegExp(pattern, "gm");
  if (!(re instanceof RegExp)) {
    throw new Error(`Invalid regex: ${pattern}`);
  }
  return re;
}

function globToRegex(glob) {
  let i = 0;
  let pattern = "";

  while (i < glob.length) {
    const ch = glob[i];

    if (ch === "/" && glob[i + 1] === "*" && glob[i + 2] === "*") {
      if (glob[i + 3] === "/") {
        pattern += ".*/";
        i += 4;
      } else {
        pattern += ".*";
        i += 3;
      }
    } else if (ch === "*" && glob[i + 1] === "*") {
      pattern += ".*";
      i += 2;
    } else if (ch === "*") {
      pattern += "[^/\\\\]*";
      i += 1;
    } else if (ch === "{") {
      const close = glob.indexOf("}", i);
      if (close !== -1) {
        const group = glob.slice(i + 1, close);
        const opts = group.split(",").map(s => s.replace(/[.+^$()|[\]\\]/g, "\\$&"));
        pattern += `(${opts.join("|")})`;
        i = close + 1;
      } else {
        pattern += "\\{";
        i += 1;
      }
    } else if (ch === ".") {
      pattern += "\\.";
      i += 1;
    } else if ("\\^$|[]".includes(ch)) {
      pattern += "\\" + ch;
      i += 1;
    } else {
      pattern += ch;
      i += 1;
    }
  }

  return new RegExp(`^${pattern}$`, "i");
}

function matchesGlob(filePath, patterns, excludePatterns = []) {
  const normalized = filePath.replace(/\\/g, "/");

  for (const exc of excludePatterns) {
    if (globToRegex(exc).test(normalized)) return false;
  }

  for (const pat of patterns) {
    if (globToRegex(pat).test(normalized)) return true;
  }

  return false;
}

function walk(dir, filePatterns, excludePatterns = []) {
  const results = [];
  const skips = new Set(["node_modules", "dist", "target", ".git", "vendor"]);

  function _walk(current) {
    if (!statSync(current, { throwIfNoEntry: false })?.isDirectory()) return;

    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      const stat = statSync(full, { throwIfNoEntry: false });
      if (!stat) continue;

      if (stat.isDirectory()) {
        if (!skips.has(entry)) _walk(full);
      } else {
        results.push(full);
      }
    }
  }

  _walk(dir);

  return results.filter(f => matchesGlob(f, filePatterns, excludePatterns));
}

function yamlQuote(value) {
  const s = String(value);
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(s)) return JSON.stringify(s);

  if (/[:"{}[\]&*#?|>%@`!,\-]|^\s|[\s]$|^[\d]/.test(s) && !/^[_a-zA-Z][_a-zA-Z0-9.]*["\x27]/.test(s)) {
    return JSON.stringify(s);
  }

  if (!/^[_a-zA-Z][_a-zA-Z0-9.]*$/.test(s)) {
    return JSON.stringify(s);
  }

  return JSON.stringify(s);
}

function loadConfig(configPath) {
  const absPath = resolve(configPath);
  if (!existsSync(absPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  const raw = readFileSync(absPath, "utf8");
  return JSON.parse(raw);
}

function collectKeys(markConfig) {
  const { name, filePatterns, exclude = [], extractors } = markConfig;

  const results = [];

  for (const fileRoot of filePatterns) {
    const dir = join(root, fileRoot.split("/")[0]);
    if (!existsSync(dir)) {
      console.warn(`Warning: directory not found, skipping: ${dir}`);
      continue;
    }

    const files = walk(dir, filePatterns, exclude)
      .filter(f => {
        const ext = extname(f);
        return ext === ".ts" || ext === ".tsx" || ext === ".js" ||
               ext === ".jsx" || ext === ".mjs" || ext === ".cjs" ||
               ext === ".rs" || ext === ".toml" || ext === ".json";
      });

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");

      for (const extractor of extractors) {
        const re = buildRegex(extractor.regex);
        let match;
        let lineNumber = 1;
        let lastIndex = 0;

        const contentCopy = content;

        while ((match = re.exec(contentCopy)) !== null) {
          const lineIndex = contentCopy.substring(0, match.index).split("\n").length;

          const key = match[extractor.keyGroup] || "";
          const defaultValue = extractor.defaultValueGroup
            ? match[extractor.defaultValueGroup] || null
            : null;

          if (key) {
            const line = lines[lineIndex - 1].trim();
            results.push({
              key,
              defaultValue,
              file: relative(root, file),
              line: lineIndex,
              lineContent: line,
              description: extractor.description || "",
              markName: name,
            });
          }
        }
      }
    }
  }

  return results;
}

function formatYaml(records) {
  const lines = ["_version: 1"];
  const seen = new Map();

  for (const r of records) {
    if (!seen.has(r.key)) {
      seen.set(r.key, r.defaultValue ?? r.key);
    }
  }

  const sorted = [...seen.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [key, value] of sorted) {
    lines.push(`${yamlQuote(key)}: ${yamlQuote(value)}`);
  }

  return lines.join("\n") + "\n";
}

function formatJson(records) {
  const seen = new Map();
  for (const r of records) {
    if (!seen.has(r.key)) {
      seen.set(r.key, r.defaultValue ?? r.key);
    }
  }
  const sorted = [...seen.entries()].sort(([a], [b]) => a.localeCompare(b));
  const obj = { _version: 1 };
  for (const [key, value] of sorted) {
    obj[key] = value;
  }
  return JSON.stringify(obj, null, 2) + "\n";
}

function formatText(records) {
  const seen = new Map();
  for (const r of records) {
    if (!seen.has(r.key)) {
      seen.set(r.key, r);
    }
  }

  const sorted = [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b));

  let output = "";
  for (const [key, r] of sorted) {
    output += `${key}`;
    if (r.defaultValue && r.defaultValue !== key) {
      output += ` = ${JSON.stringify(r.defaultValue)}`;
    }
    output += "\n";
  }
  return output;
}

function formatList(records, { verbose = false } = {}) {
  const entries = records.sort((a, b) =>
    a.file.localeCompare(b.file) || a.line - b.line
  );

  let output = "";
  for (const r of entries) {
    if (verbose) {
      output += `${r.file}:${r.line} [${r.description}] ${r.key}`;
      if (r.defaultValue) output += ` = ${JSON.stringify(r.defaultValue)}`;
      output += `\n  > ${r.lineContent}\n`;
    } else {
      output += `${r.file}:${r.line}: ${r.key}\n`;
    }
  }
  return output;
}

function resolvePresets(presetNames) {
  const names = presetNames.split(",").map(s => s.trim());
  const marks = [];
  for (const name of names) {
    if (!BUILTIN_PRESETS[name]) {
      throw new Error(
        `Unknown preset: "${name}". Available: ${Object.keys(BUILTIN_PRESETS).join(", ")}`
      );
    }
    marks.push({ name, ...BUILTIN_PRESETS[name] });
  }
  return marks;
}

function main() {
  const options = {
    config: { type: "string" },
    preset: { type: "string" },
    regex: { type: "string" },
    "key-group": { type: "string" },
    "default-group": { type: "string" },
    files: { type: "string", multiple: true },
    output: { type: "string" },
    format: { type: "string" },
    list: { type: "boolean" },
    verbose: { type: "boolean" },
    "no-dedup": { type: "boolean" },
    help: { type: "boolean" },
  };

  let args;
  try {
    args = parseArgs({ options, allowPositionals: true });
  } catch (e) {
    console.error(`Error: ${e.message}\n${usage()}`);
    process.exit(2);
  }

  if (args.values.help) {
    console.log(usage());
    process.exit(0);
  }

  let markDefs = [];

  if (args.values.config) {
    const config = loadConfig(args.values.config);
    if (!config.marks || !Array.isArray(config.marks)) {
      throw new Error("Config file must have a 'marks' array");
    }
    markDefs = config.marks;
  } else if (args.values.preset) {
    markDefs = resolvePresets(args.values.preset);
  } else if (args.values.regex) {
    markDefs = [{
      name: "ad-hoc",
      filePatterns: args.values.files || ["src/**/*.{ts,tsx}", "backend/src/**/*.rs"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/target/**"],
      extractors: [{
        regex: args.values.regex,
        keyGroup: parseInt(args.values["key-group"] || "1", 10),
        defaultValueGroup: args.values["default-group"]
          ? parseInt(args.values["default-group"], 10)
          : null,
        description: `ad-hoc regex: ${args.values.regex}`
      }]
    }];
  } else {
    console.error("Error: specify --config, --preset, or --regex\n");
    console.log(usage());
    process.exit(2);
  }

  if (!markDefs.length) {
    console.error("Error: no mark definitions resolved");
    process.exit(2);
  }

  for (const mark of markDefs) {
    if (!mark.extractors || !mark.extractors.length) {
      throw new Error(
        `Mark definition "${mark.name}" has no extractors. ` +
        `Ensure the preset/config includes extractor definitions.`
      );
    }
    if (args.values.files) {
      mark.filePatterns = args.values.files;
    }
    if (!mark.filePatterns || !mark.filePatterns.length) {
      console.warn(`Warning: mark "${mark.name}" has no file patterns, using defaults`);
      mark.filePatterns = ["src/**/*.{ts,tsx}", "backend/src/**/*.rs"];
    }
  }

  let allRecords = [];
  for (const mark of markDefs) {
    if (args.values.verbose) {
      console.error(`Scanning: ${mark.name} (${mark.filePatterns.join(", ")})`);
    }
    const records = collectKeys(mark);
    if (args.values.verbose) {
      console.error(`  Found ${records.length} matches`);
    }
    allRecords.push(...records);
  }

  if (args.values["no-dedup"]) {
    // keep duplicates but sort
    allRecords.sort((a, b) => a.key.localeCompare(b.key) || a.file.localeCompare(b.file));
  } else {
    const seen = new Map();
    const unique = [];
    for (const r of allRecords) {
      if (!seen.has(r.key)) {
        seen.set(r.key, true);
        unique.push(r);
      }
    }
    allRecords = unique.sort((a, b) => a.key.localeCompare(b.key));
  }

  const fmt = args.values.format || "yaml";
  let output = "";

  if (args.values.list) {
    output = formatList(allRecords, { verbose: args.values.verbose });
  } else {
    switch (fmt) {
      case "json":
        output = formatJson(allRecords);
        break;
      case "text":
        output = formatText(allRecords);
        break;
      case "yaml":
      default:
        output = formatYaml(allRecords);
        break;
    }
  }

  if (args.values.output) {
    const outPath = resolve(args.values.output);
    const dir = dirname(outPath);
    if (!existsSync(dir)) {
      writeFileSync(join(root, ".placeholder"), "");
    }
    writeFileSync(outPath, output);
    const keyCount = args.values["no-dedup"]
      ? allRecords.length
      : new Set(allRecords.map(r => r.key)).size;
    console.error(`Wrote ${keyCount} keys to ${relative(root, outPath)}`);
  } else {
    process.stdout.write(output);
  }
}

main();
