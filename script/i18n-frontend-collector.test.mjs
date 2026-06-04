import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const { collectFrontendI18n } = require("./i18n-frontend-collector.cjs");

function collect(source) {
  return collectFrontendI18n(source, "/fixture.tsx", { includeSourceLiterals: true });
}

function keys(source) {
  return collect(source).keys.map((item) => item.key);
}

describe("i18n frontend collector", () => {
  test("collects explicit translation calls", () => {
    expect(
      keys(`
        t("common.save");
        translate("editor.blocks.terminal.title");
        useTranslation().t("settings.title");
      `),
    ).toEqual(["common.save", "editor.blocks.terminal.title", "settings.title"]);
  });

  test("collects JSX text in native and custom components", () => {
    expect(
      keys(`
        export function Fixture() {
          return (
            <>
              <button>Save runbook</button> 
              <CommandItem>Open command palette</CommandItem> 
            </>
          );
        }
      `),
    ).toEqual(["Open command palette", "Save runbook"]); 
  });

  test("collects user-facing JSX string props", () => {
    expect(
      keys(`
        export function Fixture() {
          return (
            <>
              <Input label="Workspace name" placeholder="Choose a workspace" /> 
              <Tooltip content={"Run selected block"} /> 
              <SelectItem textValue="Personal workspace">Personal</SelectItem> 
            </>
          );
        }
      `),
    ).toEqual(["Choose a workspace", "Personal", "Personal workspace", "Run selected block", "Workspace name"]); 
  });

  test("collects BlockNote and custom block metadata", () => {
    expect(
      keys(`
        export const blockSpec = {
          title: "Terminal",  
          subtext: "Run shell commands", 
          type: "terminal",
        };
      `),
    ).toEqual(["Run shell commands", "Terminal"]); 
  });

  test("warns on dynamic translation calls", () => {
    const result = collect(`
      const key = condition ? "common.save" : "common.cancel";
      t(condition ? "common.save" : "common.cancel");
      t(key);
    `);

    expect(result.keys.map((item) => item.key)).toEqual(["common.cancel", "common.save"]);
    expect(result.dynamicWarnings).toHaveLength(2);
    expect(result.dynamicWarnings[1]).toMatchObject({
      expression: "key",
      reason: "dynamic translation key",
    });
  });

  test("ignores non-user-facing literals", () => {
    const result = collect(`
      export function Fixture() {
        return (
          <>
            <pre>git status --short</pre>
            <div className="flex items-center text-sm" data-testid="save-button">Save</div>
          </>
        );
      }
      const block = { label: "terminal", id: "terminal-block" }; 
    `);

    expect(result.keys.map((item) => item.key)).toEqual(["Save"]);
    expect(result.skippedLiterals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "terminal", reason: "identifier" }),
      ]),
    );
  });
});
