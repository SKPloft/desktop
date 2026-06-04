import { vi } from "vitest";

(globalThis as unknown as Record<string, unknown>).self = globalThis;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  convertFileSrc: vi.fn((s: string) => s),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  once: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: {
    load: vi.fn().mockResolvedValue({
      execute: vi.fn(),
      select: vi.fn().mockResolvedValue([]),
      close: vi.fn(),
    }),
  },
}));

const enTranslations: Record<string, string> = {
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.next": "Next",
  "common.or": "or",
  "common.submit": "Submit",
  "common.restart": "Restart",
  "common.hide": "Hide",
  "common.show": "Show",
  "common.ok": "OK",
  "common.retry": "Retry",
  "common.close": "Close",
  "common.anonymous": "Anonymous",
  "editor.blocks.markdown_render.title": "Markdown Render",
  "editor.blocks.markdown_render.tooltip": "Render markdown content from a variable",
  "editor.blocks.markdown_render.insert_subtext": "Render markdown content from a variable",
  "editor.blocks.group.content": "Content",
};

vi.mock("@razein97/tauri-plugin-i18n", () => ({
  default: class {
    static instance: unknown;
    translations: unknown = {};
    locale = "en";

    static getInstance() {
      if (!this.instance) this.instance = new this();
      return this.instance;
    }

    translate(key: string) {
      return enTranslations[key] ?? key;
    }

    load() {
      this.locale = "en";
      return Promise.resolve();
    }

    static setLocale() {
      return Promise.resolve();
    }

    static getLocale() {
      return Promise.resolve("en");
    }

    static getAvailableLocales() {
      return Promise.resolve(["en", "zh-CN"]);
    }
  },
}));
