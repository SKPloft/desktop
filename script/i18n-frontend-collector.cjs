const path = require("path");
const ts = require("typescript");

const TRANSLATION_FUNCTIONS = new Set(["t", "translate"]);
const SOURCE_LITERAL_PROPS = new Set([
  "aria-label",
  "content",
  "description",
  "emptyContent",
  "label",
  "placeholder",
  "subtext",
  "title",
  "tooltip",
]);
const TEXT_VALUE_COMPONENTS = new Set([
  "AutocompleteItem",
  "CommandItem",
  "DropdownItem",
  "ListboxItem",
  "MenuItem",
  "SelectItem",
  "Tab",
  "TabsTrigger",
]);
const SOURCE_LITERAL_OBJECT_KEYS = new Set([
  "content",
  "description",
  "emptyContent",
  "header",
  "label",
  "message",
  "placeholder",
  "subtext",
  "title",
  "tooltip",
]);

function isStringKey(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function isNamedCall(expression, names) {
  return ts.isIdentifier(expression) && names.has(expression.text);
}

function isUseTranslationTCall(expression) {
  return (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === "t" &&
    ts.isCallExpression(expression.expression) &&
    ts.isIdentifier(expression.expression.expression) &&
    expression.expression.expression.text === "useTranslation"
  );
}

function normalizeDisplayText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function nodeLocation(sourceFile, node) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    file: sourceFile.fileName,
    line: position.line + 1,
    column: position.character + 1,
  };
}

function getNodeText(sourceFile, node, maxLength = 120) {
  const text = node.getText(sourceFile).replace(/\s+/g, " ");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function collectStaticStringKeys(node) {
  const keys = [];

  function visit(child) {
    if (isStringKey(child)) {
      keys.push(child.text);
      return;
    }

    ts.forEachChild(child, visit);
  }

  visit(node);
  return keys;
}

function getJsxTagName(node) {
  if (!node) return "";

  if (ts.isJsxElement(node)) {
    return getJsxName(node.openingElement.tagName);
  }
  if (ts.isJsxSelfClosingElement(node)) {
    return getJsxName(node.tagName);
  }
  if (ts.isJsxOpeningElement(node)) {
    return getJsxName(node.tagName);
  }

  return "";
}

function getJsxName(name) {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isJsxNamespacedName(name)) return `${name.namespace.text}:${name.name.text}`;
  if (ts.isPropertyAccessExpression(name)) return name.name.text;
  return "";
}

function getPropertyName(name) {
  if (!name) return "";
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return "";
}

function jsxTextParentSkips(parent) {
  const tagName = getJsxTagName(parent);
  return ["code", "pre", "script", "style"].includes(tagName);
}

function skipReason(value, context = {}) {
  const text = normalizeDisplayText(value);

  if (!text) return "empty";
  if (text.length < 2) return "too short";
  if (!/[\p{L}\p{N}]/u.test(text)) return "punctuation only";
  if (/^https?:\/\//i.test(text)) return "URL";
  if (/^(mailto|tel|file|atuin):/i.test(text)) return "URI";
  if (/^#[0-9a-f]{3,8}$/i.test(text)) return "color value";
  if (/^[-_a-z0-9]+(\.[-_a-z0-9]+)+$/i.test(text)) return "i18n key or dotted identifier";
  if (/^[-_a-z0-9]+:[-_a-z0-9./]+$/i.test(text)) return "protocol or event value";
  if (/^[./~]?[A-Za-z0-9_-]+\/[A-Za-z0-9_./-]+$/.test(text)) return "file path";
  if (/^[A-Za-z]:\\/.test(text) || /^[A-Za-z0-9_./-]+\\[A-Za-z0-9_./\\-]+$/.test(text)) {
    return "file path";
  }
  if (/^\$?\w+(\s+[-\w./:=]+){2,}$/.test(text) && /[-/]/.test(text)) return "shell or code snippet";
  if (/^[-_a-z0-9]+$/.test(text) && !/[A-Z]/.test(text) && context.kind !== "jsx-text") {
    return "identifier";
  }
  if (/^[A-Za-z0-9_-]+(\s+[A-Za-z0-9_-]+){2,}$/.test(text) && /(^|\s)(flex|grid|items|justify|text|bg|border|rounded|mt|mb|ml|mr|px|py)-/.test(text)) {
    return "CSS class list";
  }
  if (text.length > 240) return "long literal";

  return null;
}

function collectFrontendI18n(sourceText, filePath, options = {}) {
  const ext = path.extname(filePath);
  const scriptKind = ext === ".tsx" || ext === ".jsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
  const includeSourceLiterals = options.includeSourceLiterals === true;
  const auditSourceLiterals = includeSourceLiterals || options.auditSourceLiterals === true;
  const keys = new Map();
  const sourceLiterals = [];
  const skippedLiterals = [];
  const dynamicWarnings = [];

  function recordKey(node, key, kind, defaultValue = key) {
    if (!keys.has(key)) {
      keys.set(key, { key, defaultValue, kind, ...nodeLocation(sourceFile, node) });
    }
  }

  function recordSourceLiteral(node, rawValue, kind, context = {}) {
    if (!auditSourceLiterals) return;

    const value = normalizeDisplayText(rawValue);
    const reason = skipReason(value, { ...context, kind });
    const location = nodeLocation(sourceFile, node);

    if (reason) {
      skippedLiterals.push({
        ...location,
        value,
        kind,
        reason,
      });
      return;
    }

    if (includeSourceLiterals) {
      recordKey(node, value, kind, value);
    }
    sourceLiterals.push({
      ...location,
      value,
      kind,
    });
  }

  function recordDynamicWarning(node, firstArg, calleeKind) {
    dynamicWarnings.push({
      ...nodeLocation(sourceFile, firstArg ?? node),
      call: calleeKind,
      expression: firstArg ? getNodeText(sourceFile, firstArg) : "<missing>",
      reason: firstArg ? "dynamic translation key" : "missing translation key",
    });
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const firstArg = node.arguments[0];
      const isTranslationCall = isNamedCall(expression, TRANSLATION_FUNCTIONS) || isUseTranslationTCall(expression);

      if (isTranslationCall) {
        if (firstArg && isStringKey(firstArg)) {
          recordKey(firstArg, firstArg.text, "translation-call");
        } else {
          if (firstArg) {
            for (const key of collectStaticStringKeys(firstArg)) {
              recordKey(firstArg, key, "dynamic-translation-literal");
            }
          }
          recordDynamicWarning(node, firstArg, getNodeText(sourceFile, expression));
        }
      }
    }

    if (ts.isJsxText(node) && !jsxTextParentSkips(node.parent)) {
      recordSourceLiteral(node, node.getText(sourceFile), "jsx-text");
    }

    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.text;
      const tagName = getJsxTagName(node.parent?.parent);
      const shouldCollect =
        SOURCE_LITERAL_PROPS.has(attrName) || (attrName === "textValue" && TEXT_VALUE_COMPONENTS.has(tagName));

      if (shouldCollect && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) {
          recordSourceLiteral(node.initializer, node.initializer.text, "jsx-prop", { prop: attrName, tagName });
        } else if (
          ts.isJsxExpression(node.initializer) &&
          node.initializer.expression &&
          isStringKey(node.initializer.expression)
        ) {
          recordSourceLiteral(node.initializer.expression, node.initializer.expression.text, "jsx-prop", {
            prop: attrName,
            tagName,
          });
        }
      }
    }

    if (ts.isPropertyAssignment(node) && isStringKey(node.initializer)) {
      const propName = getPropertyName(node.name);
      if (SOURCE_LITERAL_OBJECT_KEYS.has(propName)) {
        recordSourceLiteral(node.initializer, node.initializer.text, "object-prop", { prop: propName });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    keys: Array.from(keys.values()).sort((a, b) => a.key.localeCompare(b.key)),
    sourceLiterals,
    skippedLiterals,
    dynamicWarnings,
  };
}

module.exports = {
  collectFrontendI18n,
  isStringKey,
  isUseTranslationTCall,
  skipReason,
};
