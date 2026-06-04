import zhCN from "../../locales/runbooks/zh-CN.json";

type InlineContent = {
  type: string;
  text?: string;
  styles?: Record<string, unknown>;
  content?: InlineContent[];
  href?: string;
};

type BlockNode = {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: InlineContent[];
  children?: BlockNode[];
};

type RunbookCatalog = Record<string, string>;

const catalogs: Record<string, RunbookCatalog> = {
  "zh-CN": zhCN as RunbookCatalog,
};

function stripTodo(text: string): string {
  return text.replace(/\/\/TODO I18N$/, "").trimEnd();
}

function translateInlineContent(item: InlineContent, catalog: RunbookCatalog): InlineContent {
  const translated: InlineContent = { ...item };

  if (item.type === "text" && item.text) {
    const clean = stripTodo(item.text);
    translated.text = catalog[clean] ?? clean;
  }

  if (item.content) {
    translated.content = item.content.map((child) => translateInlineContent(child, catalog));
  }

  return translated;
}

function translateBlock(block: BlockNode, catalog: RunbookCatalog): BlockNode {
  const translated: BlockNode = { ...block };

  if (block.content) {
    translated.content = block.content.map((item) => translateInlineContent(item, catalog));
  }

  if (block.children) {
    translated.children = block.children.map((child) => translateBlock(child, catalog));
  }

  return translated;
}

export function translateBlockContent(content: BlockNode[], catalog: RunbookCatalog): BlockNode[] {
  if (!content || !Array.isArray(content)) return content;
  return content.map((block) => translateBlock(block, catalog));
}

export function translateRunbookName(name: string, catalog: RunbookCatalog): string {
  const clean = stripTodo(name);
  return catalog[clean] ?? clean;
}

export function getLoadedCatalog(locale: string): RunbookCatalog {
  return catalogs[locale] ?? {};
}

export function translateDisplayName(name: string, locale: string): string {
  if (locale === "en") return stripTodo(name);
  const catalog = catalogs[locale];
  if (!catalog || Object.keys(catalog).length === 0) return stripTodo(name);
  return translateRunbookName(name, catalog);
}
