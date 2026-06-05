import { BlockInfo } from "@/rs-bindings/BlockInfo";

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
      return `No documentation found for block type: ${blockType}`; // I18N: translate - AI-visible block documentation text
    }

    return (
      "Docs for '" + // I18N: translate - AI-visible block documentation text
      blockType + // I18N: translate - AI-visible block documentation text
      "' block (known to users as: " + // I18N: translate - AI-visible block documentation text
      resolve(block.friendlyName) + // I18N: translate - AI-visible block documentation text
      "):\n" + // I18N: translate - AI-visible block documentation text
      resolve(block.description) // I18N: translate - AI-visible block documentation text
    );
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
