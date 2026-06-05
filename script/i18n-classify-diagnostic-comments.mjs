#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["src", "src-llmtools", "script"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const manualMarkers = [
  {
    file: "src/routes/root/DesktopImportModal.tsx",
    find: 'throw new Error("Not able to load target workspace");',
    replace: 'throw new Error("Not able to load target workspace"); // I18N: translate - rendered import error',
  },
  {
    file: "src/routes/root/DesktopImportModal.tsx",
    find: 'throw new Error("You do not have permission to manage runbooks in the target workspace");',
    replace:
      'throw new Error("You do not have permission to manage runbooks in the target workspace"); // I18N: translate - rendered import error',
  },
  {
    file: "src/routes/root/DesktopImportModal.tsx",
    find: 'throw new Error("Failed to create runbook in the target workspace");',
    replace:
      'throw new Error("Failed to create runbook in the target workspace"); // I18N: translate - rendered import error',
  },
  {
    file: "src/routes/root/DesktopImportModal.tsx",
    find: ': "An unknown error occurred",',
    replace: ': "An unknown error occurred", // I18N: translate - rendered import error fallback',
  },
  {
    file: "src/routes/runbooks/Runbooks.tsx",
    find: 'throw new Error("Tried to create a new tag with no runbook selected");',
    replace:
      'throw new Error("Tried to create a new tag with no runbook selected"); // I18N: translate - shown by tag selector form error',
  },
  {
    file: "src/routes/runbooks/Runbooks.tsx",
    find: 'throw new Error("Tried to delete a tag with no runbook selected");',
    replace:
      'throw new Error("Tried to delete a tag with no runbook selected"); // I18N: translate - shown by tag selector form error',
  },
  {
    file: "src/components/runbooks/editor/hooks/useAIInlineGeneration.ts",
    find: 'const message = event.message || "Unknown error";',
    replace: 'const message = event.message || "Unknown error"; // I18N: translate - toast fallback',
  },
  {
    file: "src/components/runbooks/editor/hooks/useAIInlineGeneration.ts",
    find: 'const message = error instanceof Error ? error.message : "Failed to start generation";',
    replace:
      'const message = error instanceof Error ? error.message : "Failed to start generation"; // I18N: translate - toast fallback',
  },
  {
    file: "src/components/runbooks/editor/hooks/useAIInlineGeneration.ts",
    find: 'const message = error instanceof Error ? error.message : "Failed to edit block";',
    replace:
      'const message = error instanceof Error ? error.message : "Failed to edit block"; // I18N: translate - toast fallback',
  },
];

const jsxReplacements = [
  {
    file: "src/components/runbooks/List/PendingInvitations.tsx",
    find: "Pending invitations:// I18N: no-translate - developer/internal string",
    replace: "Pending invitations:{/* I18N: translate - visible UI text */}",
  },
  {
    file: "src/lib/blocks/kubernetes/spec.tsx",
    find: '<h3>Kubernetes Get {block?.props?.mode === "preset" ? "Command" : "Custom Command"}</h3>// I18N: translate - exported HTML heading',
    replace:
      '<h3>Kubernetes Get {block?.props?.mode === "preset" ? "Command" : "Custom Command"}</h3>{/* I18N: translate - exported HTML heading */}',
  },
  {
    file: "src/lib/blocks/kubernetes/component.tsx",
    find: '{kubernetes.mode === "preset" ? "Custom" : "Preset"}// I18N: no-translate - developer/internal string',
    replace: '{kubernetes.mode === "preset" ? "Custom" : "Preset"}{/* I18N: translate - visible button label */}',
  },
];

function walk(dir) {
  const entries = [];
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return entries;

  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!["node_modules", "dist", "target"].includes(entry)) entries.push(...walk(full));
    } else if (extensions.has(path.extname(entry))) {
      entries.push(full);
    }
  }
  return entries;
}

function classify(file, line) {
  const rel = path.relative(root, file);

  if (line.includes("displayName")) return ["no-translate", "React component displayName"];
  if (/label:\s*"[0-9]+"/.test(line)) return ["no-translate", "numeric option value"];
  if (line.includes("localStorage.")) return ["no-translate", "storage key"];
  if (line.includes('setMode("custom")')) return ["no-translate", "internal state value"];
  if (line.includes('source: "ShellCheck"')) return ["no-translate", "tool/source name"];
  if (line.includes("console.")) return ["no-translate", "developer diagnostic"];
  if (line.includes("reject(new Error")) return ["no-translate", "internal async guard"];

  if (rel === "src/components/Settings/Settings.tsx" && line.includes("Claude (Anthropic direct API)")) {
    return ["translate", "visible provider label"];
  }
  if (rel.includes("/CodeEditor/extensions.ts")) return ["translate", "visible completion/help label"];
  if (rel === "src/lib/ai/block_registry.ts") return ["translate", "AI-visible block documentation text"];
  if (rel === "src/lib/ai/useAIChat.ts" && line.includes("User cancelled this operation")) {
    return ["translate", "AI-visible tool result"];
  }
  if (rel === "src/lib/ai/tools.ts") return ["translate", "AI-visible tool result/error"];
  if (rel.includes("-preview/api.ts")) return ["translate", "rendered preview error"];
  if (rel.includes("-preview/components/") && line.includes("Failed to fetch data")) {
    return ["translate", "rendered preview fallback"];
  }
  if (rel.includes("-preview/components/") && line.includes("Unknown URL type")) {
    return ["translate", "rendered preview error"];
  }
  if (rel === "src/components/runbooks/List/ConvertWorkspaceDialog.tsx") {
    if (line.includes("Selected path is required")) return ["translate", "rendered conversion validation"];
    return ["no-translate", "developer diagnostic"];
  }
  if (rel === "src/components/runbooks/List/Workspace.tsx" && line.includes("throw new Error")) {
    return ["translate", "rendered workspace validation"];
  }
  if (rel === "src/lib/blocks/kubernetes/spec.tsx" && line.includes("<h3>")) {
    return ["translate", "exported HTML heading"];
  }

  if (line.includes("throw new Error")) return ["no-translate", "internal exception"];
  return ["no-translate", "developer/internal string"];
}

function replaceTodoComments(file, content) {
  return content
    .split("\n")
    .map((line) => {
      if (!/\/\/\s*TODO I18N/.test(line)) return line;
      const [decision, reason] = classify(file, line);
      return line.replace(/\/\/\s*TODO I18N(?:\s*-\s*.*)?/, `// I18N: ${decision} - ${reason}`);
    })
    .join("\n");
}

function applyExactReplacements(replacements) {
  for (const item of replacements) {
    const file = path.join(root, item.file);
    let content = readFileSync(file, "utf8");
    if (content.includes(item.replace)) continue;
    if (!content.includes(item.find)) {
      throw new Error(`Could not find expected text in ${item.file}: ${item.find}`);
    }
    content = content.replace(item.find, item.replace);
    writeFileSync(file, content);
  }
}

function markerType(line) {
  if (line.includes("console.")) return "console/log";
  if (line.includes("throw new Error") || line.includes("reject(new Error")) return "exception";
  if (line.includes("displayName")) return "displayName";
  if (line.includes("localStorage.")) return "storage";
  if (line.includes("setMode(")) return "state";
  if (line.includes("addToast") || line.includes("setError") || line.includes("setImportError")) return "ui-error";
  if (line.includes("result:")) return "tool-result";
  if (line.includes("<h3") || line.includes("<Button") || line.includes("Pending invitations")) return "visible-ui";
  return "literal";
}

function writeReport() {
  const rows = [];
  for (const rootName of scanRoots) {
    for (const file of walk(path.join(root, rootName))) {
      const rel = path.relative(root, file);
      if (rel === "script/i18n-classify-diagnostic-comments.mjs") continue;
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        const marker = line.match(/I18N:\s*(translate|no-translate)\s*-\s*(.*)$/);
        if (!marker) return;
        rows.push({
          file: rel,
          line: index + 1,
          type: markerType(line),
          worth: marker[1] === "translate" ? "worth i18n" : "not for i18n",
          reason: marker[2].replace(/\s*\*\/\}?$/, "").trim(),
          source: line.trim().replace(/\|/g, "\\|"),
        });
      });
    }
  }

  rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  const summary = rows.reduce(
    (acc, row) => {
      if (row.worth === "worth i18n") acc.translate += 1;
      else acc.noTranslate += 1;
      return acc;
    },
    { translate: 0, noTranslate: 0 },
  );

  const output = [
    "# I18N String Audit",
    "",
    "This file is generated by `node script/i18n-classify-diagnostic-comments.mjs`.",
    "",
    `- Worth i18n: ${summary.translate}`,
    `- Not for i18n: ${summary.noTranslate}`,
    "",
    "## Annotated Strings",
    "",
    "| File | Line | Type | Decision | Reason | Source |",
    "| --- | ---: | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.file} | ${row.line} | ${row.type} | ${row.worth} | ${row.reason} | \`${row.source}\` |`,
    ),
    "",
    "## Bulk No-Translate Rules",
    "",
    "These categories should be treated as not for i18n unless their message is explicitly rendered into UI:",
    "",
    "- `console.*(...)`, `console` callbacks, and script CLI diagnostics",
    "- Rust `log::*`, `tracing::*`, `println!`, `eprintln!`",
    "- Rust `assert!`, `assert_eq!`, `assert_ne!`, `panic!`, `todo!`, `.unwrap(...)`, `.expect(...)`",
    "- JS/TS internal invariant exceptions and test expectations",
    "",
  ].join("\n");

  writeFileSync(path.join(root, "I18N_STRING_AUDIT.md"), output);
}

for (const rootName of scanRoots) {
  for (const file of walk(path.join(root, rootName))) {
    const content = readFileSync(file, "utf8");
    const next = replaceTodoComments(file, content);
    if (next !== content) writeFileSync(file, next);
  }
}

applyExactReplacements(jsxReplacements);
applyExactReplacements(manualMarkers);
writeReport();
