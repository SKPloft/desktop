import AtuinEnv from "@/atuin_env";
import { useSettingsState } from "@/components/Settings/Settings";
import { ModelSelection } from "@/rs-bindings/ModelSelection";
import { Settings } from "@/state/settings";
import { useStore } from "@/state/store";
import { invoke } from "@tauri-apps/api/core";

export interface OllamaSettings {
  enabled: boolean;
  endpoint: string;
  model: string;
}

export interface ClaudeSettings {
  enabled: boolean;
  model: string;
}

export interface OpenAISettings {
  enabled: boolean;
  endpoint: string;
  model: string;
}

export interface DeepSeekSettings {
  enabled: boolean;
  model: string;
}

export function useAIProviderSettings<T extends Record<string, any>>(provider: string, defaultValue: T): [T, (settings: T) => void, boolean] {
  const [settings, setSettings, isLoading] = useSettingsState(
    `ai.provider.${provider}.settings`,
    defaultValue as T,
    () => Settings.aiProviderSettings(provider),
    (settings: T) => Settings.aiProviderSettings(provider, settings),
  );
  return [settings, setSettings, isLoading];
};

export async function getAIProviderSettings<T extends Record<string, any>>(provider: string): Promise<T> {
  const value = await Settings.aiProviderSettings(provider);
  return value as T;
}

export async function getModelSelection(provider: string): Promise<Result<ModelSelection, string>> {
  // Use the actual OS username for keychain lookups — provider API keys are
  // stored per-OS-user so the keychain can enforce per-user isolation.
  const keychainUser = useStore.getState().user?.username || "default";

  if (provider === "atuinhub") {
    return Ok({
      type: "atuinHub",
      data: {
        model: "claude-opus-4-5-20251101",
        uri: AtuinEnv.url("/api/ai/proxy/"),
      }
    }) as Result<ModelSelection, string>
  } else if (provider === "ollama") {
    const settings = await getAIProviderSettings<OllamaSettings>("ollama");
    if (!settings.enabled) {
      return Err("Ollama is not enabled in settings");
    }
    if (!settings.model) {
      return Err("Ollama model is not set in settings");
    }

    return Ok({
      type: "ollama",
      data: {
        model: settings.model,
        uri: joinUrlParts([settings.endpoint, "v1/"], true),
      }
    }) as Result<ModelSelection, string>
  } else if (provider === "claude") {
    const settings = await getAIProviderSettings<ClaudeSettings>("claude");
    if (!settings.enabled) {
      return Err("Claude is not enabled in settings");
    }
    if (!settings.model) {
      return Err("Claude model is not set in settings");
    }
    // Verify API key exists in OS keychain
    const apiKey = await invoke<string | null>("load_password", {
      service: "sh.atuin.runbooks.ai.claude",
      user: keychainUser,
    });
    if (!apiKey) {
      return Err("Claude API key is not set in settings");
    }

    return Ok({
      type: "claude",
      data: {
        model: settings.model,
      }
    }) as Result<ModelSelection, string>
  } else if (provider === "openai") {
    const settings = await getAIProviderSettings<OpenAISettings>("openai");
    if (!settings.enabled) {
      return Err("OpenAI is not enabled in settings");
    }
    if (!settings.model) {
      return Err("OpenAI model is not set in settings");
    }
    // Verify API key exists in OS keychain
    const apiKey = await invoke<string | null>("load_password", {
      service: "sh.atuin.runbooks.ai.openai",
      user: keychainUser,
    });
    if (!apiKey) {
      return Err("OpenAI API key is not set in settings");
    }

    return Ok({
      type: "openAI",
      data: {
        model: settings.model,
        uri: settings.endpoint ? joinUrlParts([settings.endpoint, "v1/"], true) : null,
      }
    }) as Result<ModelSelection, string>
  } else if (provider === "deepseek") {
    const settings = await getAIProviderSettings<DeepSeekSettings>("deepseek");
    if (!settings.enabled) {
      return Err("DeepSeek is not enabled in settings");
    }
    if (!settings.model) {
      return Err("DeepSeek model is not set in settings");
    }
    // Verify API key exists in OS keychain
    const apiKey = await invoke<string | null>("load_password", {
      service: "sh.atuin.runbooks.ai.deepseek",
      user: keychainUser,
    });
    if (!apiKey) {
      return Err("DeepSeek API key is not set in settings");
    }

    return Ok({
      type: "deepSeek",
      data: {
        model: settings.model,
      }
    }) as Result<ModelSelection, string>
  } else {
    return Ok({
      type: "atuinHub",
      data: {
        model: "claude-opus-4-5-20251101",
        uri: AtuinEnv.url("/api/ai/proxy/"),
      }
    }) as Result<ModelSelection, string>
  }
}

function joinUrlParts(parts: string[], trailingSlash: boolean = false): string {
  parts = parts.filter(p => !!p);

  if (parts.length === 0) {
    return "";
  }

  let result = parts.map(p => p.replace(/\/+$/, '')).join('/');
  result = result.replace(/([^:]\/)\/+/g, '$1');

  if (trailingSlash && !result.endsWith("/")) {
    return result + "/";
  }

  console.info("joinUrlParts result", result);
  return result;
}
