import { BlockInfo } from "@/rs-bindings/BlockInfo";
import { t } from "@/lib/i18n";

export interface BlockRegistryDefinition {
  typeName: string;
  friendlyName: string | (() => string);
  shortDescription: string | (() => string);
  description: string | (() => string);
}

function resolve(value: string | (() => string)): string {
  return typeof value === "function" ? value() : value;
}

export default class AIBlockRegistry {
  private static instance: AIBlockRegistry;
  private blocks: Map<string, BlockRegistryDefinition> = new Map();

  private constructor() {}

  public static getInstance(): AIBlockRegistry {
    if (!AIBlockRegistry.instance) {
      AIBlockRegistry.instance = new AIBlockRegistry();
    }
    return AIBlockRegistry.instance;
  }

  public addBlock(block: BlockRegistryDefinition) {
    this.blocks.set(block.typeName, block);
  }

  public getBlockDocs(blockType: string): string {
    const block = this.blocks.get(blockType);
    if (!block) {
      return t("ai.agent.block_documentation_not_found", { blockType }); // I18N: translate - AI-visible block documentation text
    }

    return t("ai.agent.block_documentation", {
      blockType,
      friendlyName: resolve(block.friendlyName),
      description: resolve(block.description),
    }); // I18N: translate - AI-visible block documentation text
  }

  public getBlockInfos(): Array<BlockInfo> {
    return Array.from(this.blocks.values()).map((block) => ({
      typeName: block.typeName,
      friendlyName: resolve(block.friendlyName),
      summary: resolve(block.shortDescription),
      docs: resolve(block.description),
    }));
  }
}
