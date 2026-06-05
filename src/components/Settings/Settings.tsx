import { useState, useEffect, useMemo } from "react";
import { isAppleDevice } from "@react-aria/utils";
import { open } from "@tauri-apps/plugin-shell";
import { PlusIcon, TrashIcon, PlayIcon } from "lucide-react";
import {
  Autocomplete,
  AutocompleteItem,
  Input,
  Switch,
  Card,
  CardBody,
  Spinner,
  cn,
  Select,
  SelectItem,
  SharedSelection,
  Button,
  User,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalContent,
  Link,
  useDisclosure,
  addToast,
  Slider,
  Tabs,
  Tab,
} from "@heroui/react";
import { Settings } from "@/state/settings";
import { KVStore } from "@/state/kv";
import { relaunch } from "@tauri-apps/plugin-process";
import { useStore } from "@/state/store";
import { invoke } from "@tauri-apps/api/core";
import { useAsyncData } from "@/lib/utils";
import SocketManager from "@/socket";
import handleDeepLink from "@/routes/root/deep";
import * as api from "@/api/api";
import InterpreterSelector from "@/lib/blocks/common/InterpreterSelector";
import AtuinEnv from "@/atuin_env";
import {
  OllamaSettings,
  ClaudeSettings,
  OpenAISettings,
  DeepSeekSettings,
  useAIProviderSettings,
} from "@/state/settings_ai";
import { useTranslation } from "@/lib/i18n";

async function loadFonts(): Promise<string[]> {
  const fonts = await invoke<string[]>("list_fonts");
  fonts.push("Inter");
  fonts.push("FiraCode");
  fonts.sort();
  return fonts;
}

// Custom hook for managing settings
export const useSettingsState = (
  _key: any,
  initialValue: any,
  settingsGetter: any,
  settingsSetter: any,
) => {
  const [value, setValue] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSetting = async () => {
      const savedValue = await settingsGetter();
      setValue(savedValue || initialValue);
      setIsLoading(false);
    };
    loadSetting();
  }, [settingsGetter, initialValue]);

  const updateSetting = async (newValue: any) => {
    setValue(newValue);
    await settingsSetter(newValue);
  };

  return [value, updateSetting, isLoading];
};

interface SettingsInputProps {
  label: string;
  value: string;
  onChange: (e: string) => void;
  placeholder: string;
  description: string;
  type: string;
}

// Reusable setting components
const SettingInput = ({
  label,
  value,
  onChange,
  placeholder,
  description,
  type,
}: SettingsInputProps) => (
  <Input
    label={label}
    value={value}
    type={type}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    description={description}
  />
);

interface SettingsSwitchProps {
  label: string;
  isSelected: boolean;
  onValueChange: (e: boolean) => void;
  description: string;
  className?: string;
  isDisabled?: boolean;
}

const SettingSwitch = ({
  label,
  isSelected,
  onValueChange,
  description,
  className,
  isDisabled,
}: SettingsSwitchProps) => (
  <Switch
    isSelected={isSelected}
    onValueChange={onValueChange}
    className={cn("flex justify-between items-center w-full", className)}
    isDisabled={isDisabled || false}
  >
    <div className="flex flex-col">
      <span>{label}</span>
      {description && <span className="text-tiny text-default-400">{description}</span>}
    </div>
  </Switch>
);

// Settings sections
const GeneralSettings = () => {
  const { t, locale, setLocale, availableLocales } = useTranslation();
  const [showingPromptToRestart, setShowingPromptToRestart] = useState(false);

  function promptToRestart() {
    if (showingPromptToRestart) return;
    setShowingPromptToRestart(true);

    addToast({
      title: t("settings.general.restart_required.title"),
      description: t("settings.general.restart_required.description"),
      color: "primary",
      radius: "sm",
      timeout: Infinity,
      shouldShowTimeoutProgress: false,
      onClose: () => {
        setShowingPromptToRestart(false);
      },
      endContent: (
        <Button size="sm" variant="flat" color="primary" className="p-2" onPress={() => relaunch()}>
          {t("common.restart")}
        </Button>
      ),
    });
  }

  const fonts = useAsyncData(loadFonts, []);

  const [trackingOptIn, setTrackingOptIn, isLoading] = useSettingsState(
    "usage_tracking",
    false,
    async () => {
      const db = await KVStore.open_default();
      return await db.get("usage_tracking");
    },
    async (value: boolean) => {
      const db = await KVStore.open_default();
      await db.set("usage_tracking", value);
      promptToRestart();
    },
  );

  const colorMode = useStore((state) => state.colorMode);
  const fontSize = useStore((state) => state.fontSize);
  const fontFamily = useStore((state) => state.fontFamily);
  const sidebarClickStyle = useStore((state) => state.sidebarClickStyle);
  const lightModeEditorTheme = useStore((state) => state.lightModeEditorTheme);
  const darkModeEditorTheme = useStore((state) => state.darkModeEditorTheme);
  const backgroundSync = useStore((state) => state.backgroundSync);
  const syncConcurrency = useStore((state) => state.syncConcurrency);
  const uiScale = useStore((state) => state.uiScale);
  const setUiScale = useStore((state) => state.setUiScale);
  const [localUiScale, setLocalUiScale] = useState(uiScale);

  useEffect(() => {
    setLocalUiScale(uiScale);
  }, [uiScale]);

  const [vimModeEnabled, setVimModeEnabledState, vimModeLoading] = useSettingsState(
    "editor_vim_mode",
    false,
    Settings.editorVimMode,
    Settings.editorVimMode,
  );

  function setVimModeEnabled(enabled: boolean) {
    setVimModeEnabledState(enabled);
    useStore.getState().setVimModeEnabled(enabled);
  }

  const [shellCheckEnabled, setShellCheckEnabledState, shellCheckEnabledLoading] = useSettingsState(
    "shellcheck_enabled",
    false,
    Settings.shellCheckEnabled,
    Settings.shellCheckEnabled,
  );

  const [shellCheckPath, setShellCheckPathState, shellCheckPathLoading] = useSettingsState(
    "shellcheck_path",
    "",
    Settings.shellCheckPath,
    Settings.shellCheckPath,
  );

  function setShellCheckEnabled(enabled: boolean) {
    setShellCheckEnabledState(enabled);
    useStore.getState().setShellCheckEnabled(enabled);
  }

  function setShellCheckPath(path: string) {
    setShellCheckPathState(path);
    useStore.getState().setShellCheckPath(path);
  }

  const themes = [
    ["Abcdef", "abcdef"],
    ["Abyss", "abyss"],
    ["Androidstudio", "androidstudio"],
    ["Andromeda", "andromeda"],
    ["Atomone", "atomone"],
    ["Aura", "aura"],
    ["Basic Light", "basicLight"],
    ["Basic Dark", "basicDark"],
    ["Bbedit", "bbedit"],
    ["Bespin", "bespin"],
    ["Console Dark", "consoleDark"],
    ["Console Light", "consoleLight"],
    ["Copilot", "copilot"],
    ["Darcula", "darcula"],
    ["Dracula", "dracula"],
    ["Duotone Light", "duotoneLight"],
    ["Duotone Dark", "duotoneDark"],
    ["Eclipse", "eclipse"],
    ["GitHub Light", "githubLight"],
    ["GitHub Dark", "githubDark"],
    ["Gruvbox Dark", "gruvboxDark"],
    ["Gruvbox Light", "gruvboxLight"],
    ["Kimbie", "kimbie"],
    ["Material Light", "materialLight"],
    ["Material Dark", "materialDark"],
    ["Monokai", "monokai"],
    ["Monokai Dimmed", "monokaiDimmed"],
    ["Noctis Lilac", "noctisLilac"],
    ["Nord", "nord"],
    ["Okaidia", "okaidia"],
    ["Red", "red"],
    ["Quietlight", "quietlight"],
    ["Solarized Light", "solarizedLight"],
    ["Solarized Dark", "solarizedDark"],
    ["Sublime", "sublime"],
    ["Tokyo Night", "tokyoNight"],
    ["Tokyo Night Storm", "tokyoNightStorm"],
    ["Tokyo Night Day", "tokyoNightDay"],
    ["Tomorrow Night Blue", "tomorrowNightBlue"],
    ["VS Code Dark", "vscodeDark"],
    ["VS Code Light", "vscodeLight"],
    ["White Light", "whiteLight"],
    ["White Dark", "whiteDark"],
    ["Xcode Light", "xcodeLight"],
    ["Xcode Dark", "xcodeDark"],
  ];

  function setColorMode(keys: SharedSelection) {
    useStore.getState().setColorMode(keys.currentKey as "light" | "dark" | "system");
  }

  function setSidebarClickStyle(keys: SharedSelection) {
    useStore.getState().setSidebarClickStyle(keys.currentKey as "link" | "explorer");
  }

  function setFontSize(fontSize: number) {
    useStore.getState().setFontSize(fontSize);
  }

  function setFontFamily(fontFamily: any) {
    useStore.getState().setFontFamily(fontFamily);
  }

  function setLightModeEditorTheme(keys: SharedSelection) {
    useStore.getState().setLightModeEditorTheme(keys.currentKey as string);
  }

  function setDarkModeEditorTheme(keys: SharedSelection) {
    useStore.getState().setDarkModeEditorTheme(keys.currentKey as string);
  }

  function setBackgroundSync(backgroundSync: boolean) {
    useStore.getState().setBackgroundSync(backgroundSync);
    promptToRestart();
  }

  function setSyncConcurrency(keys: SharedSelection) {
    const syncConcurrency = parseInt(keys.currentKey as string, 10);
    useStore.getState().setSyncConcurrency(syncConcurrency);
    promptToRestart();
  }

  if (isLoading || vimModeLoading || shellCheckEnabledLoading || shellCheckPathLoading)
    return <Spinner />;

  return (
    <>
      <Card shadow="sm" className="w-full">
        <CardBody>
          <h2 className="text-xl font-semibold">{t("settings.general.title")}</h2>

          <SettingSwitch
            className="mt-4"
            label={t("settings.general.usage_tracking.label")}
            isSelected={trackingOptIn}
            onValueChange={setTrackingOptIn}
            description={t("settings.general.usage_tracking.description")}
          />
          <Select
            label={t("language.label")}
            selectedKeys={[locale]}
            onSelectionChange={(keys) => {
              const key = keys.currentKey as string;
              if (key) setLocale(key);
            }}
            className="mt-8"
            placeholder={t("language.placeholder")}
            items={availableLocales.map((l) => ({
              key: l,
              label: l === "en" ? "English" : l === "zh-CN" ? "中文" : l,
            }))}
          >
            {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
          </Select>
          <Select
            label={t("settings.general.color_mode.label")}
            value={colorMode}
            onSelectionChange={setColorMode}
            className="mt-8"
            placeholder={t("settings.general.color_mode.placeholder")}
            selectedKeys={[colorMode]}
          >
            <SelectItem key="light" textValue={t("settings.general.color_mode.light")}>
              {t("settings.general.color_mode.light")}
            </SelectItem>
            <SelectItem key="dark" textValue={t("settings.general.color_mode.dark")}>
              {t("settings.general.color_mode.dark")}
            </SelectItem>
            <SelectItem key="system" textValue={t("settings.general.color_mode.system")}>
              {t("settings.general.color_mode.system")}
            </SelectItem>
          </Select>

          <div className="mt-6">
            <div className="flex items-end gap-6">
              <Slider
                label={t("settings.general.ui_scale.label")}
                size="md"
                step={10}
                minValue={50}
                maxValue={150}
                value={localUiScale}
                onChange={(val: number | number[]) => {
                  const numVal = Array.isArray(val) ? val[0] : val;
                  setLocalUiScale(numVal);
                }}
                onChangeEnd={(val: number | number[]) => {
                  const numVal = Array.isArray(val) ? val[0] : val;
                  setUiScale(numVal);
                }}
                marks={[
                  { value: 50, label: t("settings.general.ui_scale.percent", { value: 50 }) },
                  { value: 100, label: t("settings.general.ui_scale.percent", { value: 100 }) },
                  { value: 150, label: t("settings.general.ui_scale.percent", { value: 150 }) },
                ]}
                hideValue
                className="flex-1"
              />
              <Input
                type="number"
                size="sm"
                min={50}
                max={150}
                step={10}
                value={localUiScale.toString()}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) {
                    setLocalUiScale(val);
                  }
                }}
                onBlur={() => {
                  const clampedVal = Math.min(150, Math.max(50, localUiScale));
                  setLocalUiScale(clampedVal);
                  setUiScale(clampedVal);
                }}
                endContent={<span className="text-default-400 text-small">%</span>}
                classNames={{
                  base: "w-24",
                  input: "text-right",
                }}
              />
            </div>
            <p className="text-tiny text-default-400 mt-1">
              {t("settings.general.ui_scale.description", {
                modifier: isAppleDevice() ? "Cmd" : "Ctrl",
              })}
            </p>
          </div>

          <div className="flex flex-row gap-4 mt-4">
            <Autocomplete
              label={t("settings.general.font.label")}
              value={fontFamily}
              selectedKey={fontFamily}
              onSelectionChange={setFontFamily}
              description={t("settings.general.font.description")}
              defaultItems={fonts?.map((font) => ({ label: font, key: font })) || []}
            >
              {(item) => <AutocompleteItem key={item.key}>{item.label}</AutocompleteItem>}
            </Autocomplete>

            <div>
              <Input
                label={t("settings.general.font_size.label")}
                type="number"
                value={fontSize.toString()}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
              />
            </div>
          </div>
          <Select
            label={t("settings.general.runbook_selection_style.label")}
            value={sidebarClickStyle}
            onSelectionChange={setSidebarClickStyle}
            className="mt-2"
            placeholder={t("settings.general.runbook_selection_style.placeholder")}
            selectedKeys={[sidebarClickStyle]}
          >
            <SelectItem key="link" textValue={t("settings.general.runbook_selection_style.link")}>
              {t("settings.general.runbook_selection_style.link")}
            </SelectItem>
            <SelectItem
              key="explorer"
              textValue={t("settings.general.runbook_selection_style.explorer")}
            >
              {t("settings.general.runbook_selection_style.explorer")}
            </SelectItem>
          </Select>

          <div className="mt-4 flex flex-row gap-4">
            <SettingSwitch
              label={t("settings.general.background_sync.label")}
              isSelected={backgroundSync}
              onValueChange={setBackgroundSync}
              description={t("settings.general.background_sync.description")}
            />
            <Select
              label={t("settings.general.sync_concurrency.label")}
              value={syncConcurrency.toString()}
              onSelectionChange={setSyncConcurrency}
              className="mt-4"
              placeholder={t("settings.general.sync_concurrency.placeholder")}
              selectedKeys={[syncConcurrency.toString()]}
              disabled={!backgroundSync}
              items={[
                { label: t("settings.general.sync_concurrency.one"), key: "1" },
                { label: "2", key: "2" }, //TODO I18N - numeric label, not user-facing text
                { label: "5", key: "5" }, //TODO I18N - numeric label, not user-facing text
                { label: "10", key: "10" }, //TODO I18N - numeric label, not user-facing text
              ]}
            >
              {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card shadow="sm">
        <CardBody>
          <h2 className="text-xl font-semibold">{t("settings.editor.title")}</h2>

          <Select
            label={t("settings.editor.light_theme.label")}
            value={lightModeEditorTheme}
            onSelectionChange={setLightModeEditorTheme}
            className="mt-4"
            placeholder={t("settings.editor.light_theme.placeholder")}
            selectedKeys={[lightModeEditorTheme]}
            items={themes.map((theme) => ({ label: theme[0], key: theme[1] }))}
          >
            {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
          </Select>

          <Select
            label={t("settings.editor.dark_theme.label")}
            value={darkModeEditorTheme}
            onSelectionChange={setDarkModeEditorTheme}
            className="mt-4"
            placeholder={t("settings.editor.dark_theme.placeholder")}
            selectedKeys={[darkModeEditorTheme]}
            items={themes.map((theme) => ({ label: theme[0], key: theme[1] }))}
          >
            {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
          </Select>

          <SettingSwitch
            className="mt-4"
            label={t("settings.editor.vim_mode.label")}
            isSelected={vimModeEnabled}
            onValueChange={setVimModeEnabled}
            description={t("settings.editor.vim_mode.description")}
          />

          <SettingSwitch
            className="mt-4"
            label={t("settings.editor.shellcheck.label")}
            isSelected={shellCheckEnabled}
            onValueChange={setShellCheckEnabled}
            description={t("settings.editor.shellcheck.description")}
          />

          {shellCheckEnabled && (
            <div className="mt-4">
              <SettingInput
                type="text"
                label={t("settings.editor.shellcheck_path.label")}
                value={shellCheckPath || ""}
                onChange={setShellCheckPath}
                placeholder=""
                description={t("settings.editor.shellcheck_path.description")}
              />
            </div>
          )}

          <div className="mt-2 ml-1">
            <Link
              isExternal
              href="https://uiwjs.github.io/react-codemirror/#/theme/home"
              className="text-sm text-blue-500 underline"
              onPress={() => open("https://uiwjs.github.io/react-codemirror/#/theme/home")}
            >
              {t("settings.editor.preview_themes")}
            </Link>
          </div>
        </CardBody>
      </Card>
    </>
  );
};

const RunbookSettings = () => {
  const { t } = useTranslation();
  const fonts = useAsyncData(loadFonts, []);
  const [scriptInterpreters, setScriptInterpreters] = useState<
    Array<{ command: string; name: string }>
  >([]);
  const [newInterpreterName, setNewInterpreterName] = useState("");
  const [newInterpreterCommand, setNewInterpreterCommand] = useState("");
  const [systemDefaultShell, setSystemDefaultShell] = useState<string>("bash");

  // Load script interpreters and system default shell
  useEffect(() => {
    Settings.scriptInterpreters().then((interpreters) => {
      setScriptInterpreters(interpreters);
    });
    Settings.getSystemDefaultShell().then((shell) => {
      setSystemDefaultShell(shell);
    });
  }, []);

  // Save script interpreters
  const saveScriptInterpreters = (interpreters: Array<{ command: string; name: string }>) => {
    setScriptInterpreters(interpreters);
    Settings.setScriptInterpreters(interpreters);
  };

  const addScriptInterpreter = () => {
    if (!newInterpreterCommand || !newInterpreterName) return;

    const newInterpreters = [
      ...scriptInterpreters,
      {
        name: newInterpreterName,
        command: newInterpreterCommand,
      },
    ];

    saveScriptInterpreters(newInterpreters);
    setNewInterpreterCommand("");
    setNewInterpreterName("");
  };

  const removeScriptInterpreter = (command: string) => {
    const newInterpreters = scriptInterpreters.filter((i) => i.command !== command);
    saveScriptInterpreters(newInterpreters);
  };

  const [terminalFont, setTerminalFont, fontLoading] = useSettingsState(
    "terminal_font",
    "",
    Settings.terminalFont,
    Settings.terminalFont,
  );
  const [terminalFontSize, setTerminalFontSize, fontSizeLoading] = useSettingsState(
    "terminal_font_size",
    "",
    Settings.terminalFontSize,
    Settings.terminalFontSize,
  );
  const [terminalGl, setTerminalGl, glLoading] = useSettingsState(
    "terminal_gl",
    false,
    Settings.terminalGL,
    Settings.terminalGL,
  );
  const [terminalGhostty, setTerminalGhostty, ghosttyLoading] = useSettingsState(
    "terminal_ghostty",
    false,
    Settings.terminalGhostty,
    Settings.terminalGhostty,
  );
  const [terminalShell, setTerminalShell, shellLoading] = useSettingsState(
    "terminal_shell",
    "",
    Settings.terminalShell,
    Settings.terminalShell,
  );
  const [scriptShell, setScriptShell, scriptShellLoading] = useSettingsState(
    "script_shell",
    "",
    Settings.scriptShell,
    Settings.scriptShell,
  );
  const [prometheusUrl, setPrometheusUrl, urlLoading] = useSettingsState(
    "prometheus_url",
    "http://localhost:9090",
    Settings.runbookPrometheusUrl,
    Settings.runbookPrometheusUrl,
  );

  if (
    fontLoading ||
    glLoading ||
    ghosttyLoading ||
    urlLoading ||
    fontSizeLoading ||
    shellLoading ||
    scriptShellLoading ||
    !fonts
  )
    return <Spinner />;

  return (
    <>
      <Card shadow="sm">
        <CardBody className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">{t("settings.runbooks.terminal.title")}</h2>
          <div className="flex flex-row gap-4">
            <Autocomplete
              label={t("settings.runbooks.terminal.font.label")}
              selectedKey={terminalFont}
              onSelectionChange={setTerminalFont}
              description={t("settings.runbooks.terminal.font.description")}
              defaultItems={fonts.map((font) => ({ label: font, key: font }))}
            >
              {(item) => <AutocompleteItem key={item.key}>{item.label}</AutocompleteItem>}
            </Autocomplete>
            <div>
              <Input
                type="number"
                value={terminalFontSize || Settings.DEFAULT_FONT_SIZE}
                onChange={(e) => setTerminalFontSize(parseInt(e.target.value))}
                label={t("settings.general.font_size.label")}
              />
            </div>
          </div>
          <SettingSwitch
            label={t("settings.runbooks.terminal.ghostty.label")}
            isSelected={terminalGhostty}
            onValueChange={setTerminalGhostty}
            description={t("settings.runbooks.terminal.ghostty.description")}
          />
          {!terminalGhostty && (
            <SettingSwitch
              label={t("settings.runbooks.terminal.webgl.label")}
              isSelected={terminalGl}
              onValueChange={setTerminalGl}
              description={t("settings.runbooks.terminal.webgl.description")}
            />
          )}
          <SettingInput
            type="text"
            label={t("settings.runbooks.terminal.custom_shell.label")}
            value={terminalShell || ""}
            onChange={setTerminalShell}
            placeholder={t("settings.runbooks.terminal.custom_shell.placeholder")}
            description={t("settings.runbooks.terminal.custom_shell.description")}
          />
        </CardBody>
      </Card>

      <Card shadow="sm">
        <CardBody className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">{t("settings.runbooks.script.title")}</h2>
          <p className="text-sm text-default-500">{t("settings.runbooks.script.description")}</p>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">
                  {t("settings.runbooks.script.default_shell.label")}
                </label>
                <p className="text-xs text-default-500">
                  {t("settings.runbooks.script.default_shell.description")}
                </p>
              </div>
              <InterpreterSelector
                interpreter={scriptShell || systemDefaultShell}
                onInterpreterChange={setScriptShell}
                size="sm"
                variant="flat"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-default-500 mb-3">
              {t("settings.runbooks.script.custom_interpreters.description")}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {scriptInterpreters.map((interpreter) => (
              <div
                key={interpreter.command}
                className="flex items-center justify-between p-2 border rounded-md"
              >
                <div>
                  <div className="font-medium">{interpreter.name}</div>
                  <div className="text-small text-default-500">{interpreter.command}</div>
                </div>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="danger"
                  onPress={() => removeScriptInterpreter(interpreter.command)}
                >
                  <TrashIcon size={16} />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-row gap-2 mt-2">
            <Input
              placeholder={t("settings.runbooks.script.display_name.placeholder")}
              value={newInterpreterName}
              onValueChange={setNewInterpreterName}
              size="sm"
            />
            <Input
              placeholder={t("settings.runbooks.script.command.placeholder")}
              value={newInterpreterCommand}
              onValueChange={setNewInterpreterCommand}
              size="sm"
            />
            <Button
              isIconOnly
              color="primary"
              onPress={addScriptInterpreter}
              isDisabled={!newInterpreterCommand || !newInterpreterName}
            >
              <PlusIcon size={16} />
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card shadow="sm">
        <CardBody className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">{t("settings.runbooks.prometheus.title")}</h2>
          <SettingInput
            type="url"
            label={t("settings.runbooks.prometheus.default_url.label")}
            value={prometheusUrl}
            onChange={setPrometheusUrl}
            placeholder="http://localhost:9090"
            description={t("settings.runbooks.prometheus.default_url.description")}
          />
        </CardBody>
      </Card>
    </>
  );
};

type AuthTokenModalProps = {
  onSubmit: (token: string) => void;
  onClose: () => void;
  open: boolean;
};

const AuthTokenModal = (props: AuthTokenModalProps) => {
  const { t } = useTranslation();
  const [token, setToken] = useState("");
  const [validToken, setValidToken] = useState(false);

  useEffect(() => {
    const trimmed = token.trim();
    const valid = trimmed.startsWith("atapi_") && trimmed.length >= 20;
    setValidToken(valid);
  }, [token]);

  return (
    <Modal isOpen={props.open} onClose={() => props.onClose()} size="lg">
      <ModalContent>
        <ModalHeader>{t("settings.user.login_token")}</ModalHeader>
        <ModalBody>
          <Input
            type="password"
            label={t("settings.auth_token.input.label")}
            value={token}
            onValueChange={setToken}
          />
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={!validToken}
            color="success"
            variant="flat"
            onPress={() => props.onSubmit(token.trim())}
          >
            {t("common.submit")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

// Sound types and helpers
interface SoundInfo {
  id: string;
  name: string;
}

async function loadSounds(): Promise<SoundInfo[]> {
  try {
    return await invoke<SoundInfo[]>("list_sounds");
  } catch (e) {
    console.warn("Failed to load sounds:", e);
    return [];
  }
}

type SoundOption = "none" | "chime" | string;
type OsOption = "always" | "not_focused" | "never";

interface NotificationRowProps {
  label: string;
  durationLabel: string;
  duration: number;
  onDurationChange: (val: number) => void;
  sound: SoundOption;
  onSoundChange: (val: SoundOption) => void;
  os: OsOption;
  onOsChange: (val: OsOption) => void;
  sounds: SoundInfo[];
  volume: number;
}

const NotificationRow = ({
  label,
  durationLabel,
  duration,
  onDurationChange,
  sound,
  onSoundChange,
  os,
  onOsChange,
  sounds,
  volume,
}: NotificationRowProps) => {
  const { t } = useTranslation();
  const playSound = (soundId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (soundId === "none") return;

    console.log("Playing sound", soundId, "at volume", volume, "->", volume / 100);
    invoke("play_sound", { soundId, volume: volume / 100 }).catch((err) => {
      console.error("Failed to play sound:", err);
    });
  };

  const allSounds = [{ id: "none", name: t("settings.notifications.sound.none") }, ...sounds];

  return (
    <div className="flex flex-col gap-2 py-3 border-b last:border-b-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm">{label}</span>
        <Input
          type="number"
          size="sm"
          className="w-16"
          value={duration.toString()}
          onChange={(e) => onDurationChange(parseInt(e.target.value) || 0)}
          min={0}
          max={3600}
          aria-label={durationLabel}
        />
        <span className="text-sm text-default-500">{t("settings.notifications.seconds")}</span>
      </div>
      <div className="flex items-center gap-4 pl-4">
        <Select
          label={t("settings.notifications.sound.label")}
          size="sm"
          className="w-48"
          selectedKeys={[sound]}
          onSelectionChange={(keys) => {
            const key = keys.currentKey as SoundOption;
            if (key) onSoundChange(key);
          }}
          items={allSounds}
        >
          {(item) => (
            <SelectItem
              key={item.id}
              endContent={
                item.id !== "none" ? (
                  <button
                    className="p-1 hover:bg-default-200 rounded"
                    onClick={(e) => playSound(item.id, e)}
                  >
                    <PlayIcon size={14} />
                  </button>
                ) : null
              }
            >
              {item.name}
            </SelectItem>
          )}
        </Select>
        <Select
          label={t("settings.notifications.system.label")}
          size="sm"
          className="w-52"
          selectedKeys={[os]}
          onSelectionChange={(keys) => {
            const key = keys.currentKey as OsOption;
            if (key) onOsChange(key);
          }}
        >
          <SelectItem key="always">{t("settings.notifications.system.always")}</SelectItem>
          <SelectItem key="not_focused">
            {t("settings.notifications.system.not_focused")}
          </SelectItem>
          <SelectItem key="never">{t("settings.notifications.system.never")}</SelectItem>
        </Select>
      </div>
    </div>
  );
};

const NotificationSettings = () => {
  const { t } = useTranslation();
  const sounds = useAsyncData(loadSounds);

  const [notificationsEnabled, setNotificationsEnabled, enabledLoading] = useSettingsState(
    "notifications_enabled",
    true,
    Settings.notificationsEnabled,
    Settings.notificationsEnabled,
  );

  const [volume, setVolume, volumeLoading] = useSettingsState(
    "notifications_volume",
    80,
    Settings.notificationsVolume,
    Settings.notificationsVolume,
  );

  // Block finished settings
  const [blockFinishedDuration, setBlockFinishedDuration, bfDurationLoading] = useSettingsState(
    "block_finished_duration",
    5,
    Settings.notificationsBlockFinishedDuration,
    Settings.notificationsBlockFinishedDuration,
  );
  const [blockFinishedSound, setBlockFinishedSound, bfSoundLoading] = useSettingsState(
    "block_finished_sound",
    "that_was_quick",
    Settings.notificationsBlockFinishedSound,
    Settings.notificationsBlockFinishedSound,
  );
  const [blockFinishedOs, setBlockFinishedOs, bfOsLoading] = useSettingsState(
    "block_finished_os",
    "not_focused",
    Settings.notificationsBlockFinishedOs,
    Settings.notificationsBlockFinishedOs,
  );

  // Block failed settings
  const [blockFailedDuration, setBlockFailedDuration, bxDurationLoading] = useSettingsState(
    "block_failed_duration",
    1,
    Settings.notificationsBlockFailedDuration,
    Settings.notificationsBlockFailedDuration,
  );
  const [blockFailedSound, setBlockFailedSound, bxSoundLoading] = useSettingsState(
    "block_failed_sound",
    "out_of_nowhere",
    Settings.notificationsBlockFailedSound,
    Settings.notificationsBlockFailedSound,
  );
  const [blockFailedOs, setBlockFailedOs, bxOsLoading] = useSettingsState(
    "block_failed_os",
    "always",
    Settings.notificationsBlockFailedOs,
    Settings.notificationsBlockFailedOs,
  );

  // Serial finished settings
  const [serialFinishedDuration, setSerialFinishedDuration, sfDurationLoading] = useSettingsState(
    "serial_finished_duration",
    0,
    Settings.notificationsSerialFinishedDuration,
    Settings.notificationsSerialFinishedDuration,
  );
  const [serialFinishedSound, setSerialFinishedSound, sfSoundLoading] = useSettingsState(
    "serial_finished_sound",
    "gracefully",
    Settings.notificationsSerialFinishedSound,
    Settings.notificationsSerialFinishedSound,
  );
  const [serialFinishedOs, setSerialFinishedOs, sfOsLoading] = useSettingsState(
    "serial_finished_os",
    "not_focused",
    Settings.notificationsSerialFinishedOs,
    Settings.notificationsSerialFinishedOs,
  );

  // Serial failed settings
  const [serialFailedDuration, setSerialFailedDuration, sxDurationLoading] = useSettingsState(
    "serial_failed_duration",
    0,
    Settings.notificationsSerialFailedDuration,
    Settings.notificationsSerialFailedDuration,
  );
  const [serialFailedSound, setSerialFailedSound, sxSoundLoading] = useSettingsState(
    "serial_failed_sound",
    "unexpected",
    Settings.notificationsSerialFailedSound,
    Settings.notificationsSerialFailedSound,
  );
  const [serialFailedOs, setSerialFailedOs, sxOsLoading] = useSettingsState(
    "serial_failed_os",
    "always",
    Settings.notificationsSerialFailedOs,
    Settings.notificationsSerialFailedOs,
  );

  // Serial paused settings
  const [serialPausedDuration, setSerialPausedDuration, spDurationLoading] = useSettingsState(
    "serial_paused_duration",
    0,
    Settings.notificationsSerialPausedDuration,
    Settings.notificationsSerialPausedDuration,
  );
  const [serialPausedSound, setSerialPausedSound, spSoundLoading] = useSettingsState(
    "serial_paused_sound",
    "to_the_point",
    Settings.notificationsSerialPausedSound,
    Settings.notificationsSerialPausedSound,
  );
  const [serialPausedOs, setSerialPausedOs, spOsLoading] = useSettingsState(
    "serial_paused_os",
    "not_focused",
    Settings.notificationsSerialPausedOs,
    Settings.notificationsSerialPausedOs,
  );

  const isLoading =
    sounds === null ||
    enabledLoading ||
    volumeLoading ||
    bfDurationLoading ||
    bfSoundLoading ||
    bfOsLoading ||
    bxDurationLoading ||
    bxSoundLoading ||
    bxOsLoading ||
    sfDurationLoading ||
    sfSoundLoading ||
    sfOsLoading ||
    sxDurationLoading ||
    sxSoundLoading ||
    sxOsLoading ||
    spDurationLoading ||
    spSoundLoading ||
    spOsLoading;

  if (isLoading) return <Spinner />;

  return (
    <Card shadow="sm">
      <CardBody className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{t("settings.notifications.title")}</h2>
        <p className="text-sm text-default-500">{t("settings.notifications.description")}</p>

        <SettingSwitch
          label={t("settings.notifications.enable.label")}
          isSelected={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
          description={t("settings.notifications.enable.description")}
        />

        {notificationsEnabled && (
          <>
            <Slider
              label={t("settings.notifications.volume.label")}
              size="sm"
              step={1}
              minValue={0}
              maxValue={100}
              value={volume}
              onChange={(val: number | number[]) => {
                const numVal = Array.isArray(val) ? val[0] : val;
                setVolume(numVal);
              }}
              className="max-w-md"
            />

            <div className="border-t pt-4 mt-2">
              <p className="text-sm font-medium mb-2">{t("settings.notifications.block.title")}</p>
              <NotificationRow
                label={t("settings.notifications.finished_after")}
                durationLabel={t("settings.notifications.block_finished_duration")}
                duration={blockFinishedDuration}
                onDurationChange={setBlockFinishedDuration}
                sound={blockFinishedSound}
                onSoundChange={setBlockFinishedSound}
                os={blockFinishedOs}
                onOsChange={setBlockFinishedOs}
                sounds={sounds}
                volume={volume}
              />
              <NotificationRow
                label={t("settings.notifications.failed_after")}
                durationLabel={t("settings.notifications.block_failed_duration")}
                duration={blockFailedDuration}
                onDurationChange={setBlockFailedDuration}
                sound={blockFailedSound}
                onSoundChange={setBlockFailedSound}
                os={blockFailedOs}
                onOsChange={setBlockFailedOs}
                sounds={sounds}
                volume={volume}
              />
            </div>

            <div className="border-t pt-4 mt-2">
              <p className="text-sm font-medium mb-2">{t("settings.notifications.serial.title")}</p>
              <NotificationRow
                label={t("settings.notifications.workflow_finished_after")}
                durationLabel={t("settings.notifications.serial_finished_duration")}
                duration={serialFinishedDuration}
                onDurationChange={setSerialFinishedDuration}
                sound={serialFinishedSound}
                onSoundChange={setSerialFinishedSound}
                os={serialFinishedOs}
                onOsChange={setSerialFinishedOs}
                sounds={sounds}
                volume={volume}
              />
              <NotificationRow
                label={t("settings.notifications.workflow_failed_after")}
                durationLabel={t("settings.notifications.serial_failed_duration")}
                duration={serialFailedDuration}
                onDurationChange={setSerialFailedDuration}
                sound={serialFailedSound}
                onSoundChange={setSerialFailedSound}
                os={serialFailedOs}
                onOsChange={setSerialFailedOs}
                sounds={sounds}
                volume={volume}
              />
              <NotificationRow
                label={t("settings.notifications.workflow_paused_after")}
                durationLabel={t("settings.notifications.serial_paused_duration")}
                duration={serialPausedDuration}
                onDurationChange={setSerialPausedDuration}
                sound={serialPausedSound}
                onSoundChange={setSerialPausedSound}
                os={serialPausedOs}
                onOsChange={setSerialPausedOs}
                sounds={sounds}
                volume={volume}
              />
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
};

const AISettings = () => {
  const { t } = useTranslation();
  const aiEnabled = useStore((state) => state.aiEnabled);
  const aiShareContext = useStore((state) => state.aiShareContext);
  const setAiEnabled = useStore((state) => state.setAiEnabled);
  const setAiShareContext = useStore((state) => state.setAiShareContext);

  return (
    <>
      <Card shadow="sm">
        <CardBody className="flex flex-col gap-4 mb-4">
          <h2 className="text-xl font-semibold">{t("settings.ai.title")}</h2>
          <p className="text-sm text-default-500">{t("settings.ai.description")}</p>

          <SettingSwitch
            label={t("settings.ai.enable.label")}
            isSelected={aiEnabled}
            onValueChange={setAiEnabled}
            description={t("settings.ai.enable.description")}
          />

          {aiEnabled && (
            <SettingSwitch
              className="ml-4"
              label={t("settings.ai.share_context.label")}
              isSelected={aiShareContext}
              onValueChange={setAiShareContext}
              description={t("settings.ai.share_context.description")}
            />
          )}
        </CardBody>
      </Card>
      {aiEnabled && (
        <>
          <AgentSettings />
          <AIOllamaSettings />
          <AIClaudeSettings />
          <AIOpenAISettings />
          <AIDeepSeekSettings />
        </>
      )}
    </>
  );
};

const AgentSettings = () => {
  const { t } = useTranslation();
  const providers = [
    ["Atuin Hub", "atuinhub"],
    ["Claude", "claude"],
    ["OpenAI", "openai"],
    ["DeepSeek", "deepseek"],
    ["Ollama", "ollama"],
  ];

  const [aiProvider, setAiProvider, aiProviderLoading] = useSettingsState(
    "ai_provider",
    "atuinhub",
    Settings.aiAgentProvider,
    Settings.aiAgentProvider,
  );

  const handleProviderChange = (keys: SharedSelection) => {
    const key = keys.currentKey as string;
    if (key) {
      setAiProvider(key);
    }
  };

  return (
    <Card shadow="sm">
      <CardBody className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{t("settings.ai.agent.title")}</h2>

        <Select
          label={t("settings.ai.agent.default_provider.label")}
          value={aiProvider}
          onSelectionChange={handleProviderChange}
          className="mt-4"
          placeholder={t("settings.ai.agent.default_provider.placeholder")}
          selectedKeys={[aiProvider]}
          items={providers.map(([name, id]) => ({ label: name, key: id }))}
          isDisabled={aiProviderLoading}
        >
          {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
        </Select>
      </CardBody>
    </Card>
  );
};

const AIOllamaSettings = () => {
  const { t } = useTranslation();
  const [ollamaSettings, setOllamaSettings, isLoading] = useAIProviderSettings<OllamaSettings>(
    "ollama",
    {
      enabled: false,
      endpoint: "http://localhost:11434",
      model: "",
    },
  );

  const user = useStore((state) => state.user);
  const keychainUser = user?.username || "default";

  const [apiKey, setApiKey] = useState("");
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Load API key from OS keychain on mount
  useEffect(() => {
    invoke<string | null>("load_password", {
      service: "sh.atuin.runbooks.ai.ollama",
      user: keychainUser,
    })
      .then((key) => {
        if (key) setApiKey(key);
        setApiKeyLoaded(true);
      })
      .catch((e) => {
        console.error("Failed to load Ollama API key:", e);
        setApiKeyLoaded(true);
      });
  }, []);

  const handleApiKeyChange = async (value: string) => {
    setApiKey(value);
    try {
      if (value) {
        await invoke("save_password", {
          service: "sh.atuin.runbooks.ai.ollama",
          user: keychainUser,
          value,
        });
      } else {
        await invoke("delete_password", {
          service: "sh.atuin.runbooks.ai.ollama",
          user: keychainUser,
        });
      }
    } catch (e) {
      console.error("Failed to save Ollama API key:", e);
    }
  };

  return (
    <Card shadow="sm">
      <CardBody className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Ollama</h2>

        <SettingSwitch
          label={t("settings.ai.provider.enable", { provider: "Ollama" })}
          isSelected={ollamaSettings.enabled}
          onValueChange={(enabled) => setOllamaSettings({ ...ollamaSettings, enabled })}
          description={t("settings.ai.provider.toggle", { provider: "Ollama" })}
        />

        {ollamaSettings.enabled && (
          <div className="flex flex-col gap-4">
            <Input
              label={t("settings.ai.provider.ollama_endpoint")}
              placeholder={t("settings.ai.provider.endpoint_placeholder")}
              value={ollamaSettings.endpoint}
              onValueChange={(value) => setOllamaSettings({ ...ollamaSettings, endpoint: value })}
              isDisabled={isLoading}
            />

            <Input
              label={t("settings.ai.provider.ollama_model")}
              placeholder={t("settings.ai.provider.model_placeholder")}
              value={ollamaSettings.model}
              onValueChange={(value) => setOllamaSettings({ ...ollamaSettings, model: value })}
              isDisabled={isLoading}
            />

            <Input
              label={t("settings.ai.provider.api_key_optional")}
              placeholder={t("settings.ai.provider.remote_ollama_api_key_placeholder")}
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onValueChange={handleApiKeyChange}
              isDisabled={isLoading || !apiKeyLoaded}
              description={t("settings.ai.provider.ollama_api_key_description")}
              endContent={
                <button
                  className="text-default-400 text-sm hover:text-default-600"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowApiKey(!showApiKey);
                  }}
                >
                  {showApiKey ? t("common.hide") : t("common.show")}
                </button>
              }
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
};

const AIClaudeSettings = () => {
  const { t } = useTranslation();
  const [claudeSettings, setClaudeSettings, isLoading] = useAIProviderSettings<ClaudeSettings>(
    "claude",
    {
      enabled: false,
      model: "claude-sonnet-4-5-20250929",
    },
  );

  const user = useStore((state) => state.user);
  const keychainUser = user?.username || "default";

  const [apiKey, setApiKey] = useState("");
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Load API key from OS keychain on mount
  useEffect(() => {
    invoke<string | null>("load_password", {
      service: "sh.atuin.runbooks.ai.claude",
      user: keychainUser,
    })
      .then((key) => {
        if (key) setApiKey(key);
        setApiKeyLoaded(true);
      })
      .catch((e) => {
        console.error("Failed to load Claude API key:", e);
        setApiKeyLoaded(true);
      });
  }, []);

  const handleApiKeyChange = async (value: string) => {
    setApiKey(value);
    try {
      if (value) {
        await invoke("save_password", {
          service: "sh.atuin.runbooks.ai.claude",
          user: keychainUser,
          value,
        });
      } else {
        await invoke("delete_password", {
          service: "sh.atuin.runbooks.ai.claude",
          user: keychainUser,
        });
      }
    } catch (e) {
      console.error("Failed to save Claude API key:", e);
    }
  };

  return (
    <Card shadow="sm">
      <CardBody className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Claude (Anthropic)</h2>

        <SettingSwitch
          label={t("settings.ai.provider.enable", { provider: "Claude" })}
          isSelected={claudeSettings.enabled}
          onValueChange={(enabled) => setClaudeSettings({ ...claudeSettings, enabled })}
          description={t("settings.ai.provider.toggle", {
            provider: "Claude (Anthropic direct API)",
          })}
        />

        {claudeSettings.enabled && (
          <div className="flex flex-col gap-4">
            <Input
              label={t("settings.ai.provider.model")}
              placeholder={t("settings.ai.provider.claude_model_placeholder")}
              value={claudeSettings.model}
              onValueChange={(value) => setClaudeSettings({ ...claudeSettings, model: value })}
              isDisabled={isLoading}
              description={t("settings.ai.provider.model_description", { provider: "Anthropic" })}
            />

            <Input
              label={t("settings.ai.provider.api_key")}
              placeholder={t("settings.ai.provider.claude_api_key_placeholder")}
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onValueChange={handleApiKeyChange}
              isDisabled={isLoading || !apiKeyLoaded}
              description={t("settings.ai.provider.api_key_description", { provider: "Anthropic" })}
              endContent={
                <button
                  className="text-default-400 text-sm hover:text-default-600"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowApiKey(!showApiKey);
                  }}
                >
                  {showApiKey ? t("common.hide") : t("common.show")}
                </button>
              }
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
};

const AIOpenAISettings = () => {
  const { t } = useTranslation();
  const [openaiSettings, setOpenaiSettings, isLoading] = useAIProviderSettings<OpenAISettings>(
    "openai",
    {
      enabled: false,
      endpoint: "",
      model: "gpt-4o",
    },
  );

  const user = useStore((state) => state.user);
  const keychainUser = user?.username || "default";

  const [apiKey, setApiKey] = useState("");
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Load API key from OS keychain on mount
  useEffect(() => {
    invoke<string | null>("load_password", {
      service: "sh.atuin.runbooks.ai.openai",
      user: keychainUser,
    })
      .then((key) => {
        if (key) setApiKey(key);
        setApiKeyLoaded(true);
      })
      .catch((e) => {
        console.error("Failed to load OpenAI API key:", e);
        setApiKeyLoaded(true);
      });
  }, []);

  const handleApiKeyChange = async (value: string) => {
    setApiKey(value);
    try {
      if (value) {
        await invoke("save_password", {
          service: "sh.atuin.runbooks.ai.openai",
          user: keychainUser,
          value,
        });
      } else {
        await invoke("delete_password", {
          service: "sh.atuin.runbooks.ai.openai",
          user: keychainUser,
        });
      }
    } catch (e) {
      console.error("Failed to save OpenAI API key:", e);
    }
  };

  return (
    <Card shadow="sm">
      <CardBody className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">OpenAI</h2>

        <SettingSwitch
          label={t("settings.ai.provider.enable", { provider: "OpenAI" })}
          isSelected={openaiSettings.enabled}
          onValueChange={(enabled) => setOpenaiSettings({ ...openaiSettings, enabled })}
          description={t("settings.ai.provider.toggle", { provider: "OpenAI (direct API)" })}
        />

        {openaiSettings.enabled && (
          <div className="flex flex-col gap-4">
            <Input
              label={t("settings.ai.provider.endpoint_optional")}
              placeholder={t("settings.ai.provider.openai_endpoint_placeholder")}
              value={openaiSettings.endpoint}
              onValueChange={(value) => setOpenaiSettings({ ...openaiSettings, endpoint: value })}
              isDisabled={isLoading}
              description={t("settings.ai.provider.openai_endpoint_description")}
            />

            <Input
              label={t("settings.ai.provider.model")}
              placeholder={t("settings.ai.provider.openai_model_placeholder")}
              value={openaiSettings.model}
              onValueChange={(value) => setOpenaiSettings({ ...openaiSettings, model: value })}
              isDisabled={isLoading}
              description={t("settings.ai.provider.model_description", { provider: "OpenAI" })}
            />

            <Input
              label={t("settings.ai.provider.api_key")}
              placeholder={t("settings.ai.provider.openai_api_key_placeholder")}
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onValueChange={handleApiKeyChange}
              isDisabled={isLoading || !apiKeyLoaded}
              description={t("settings.ai.provider.api_key_description", { provider: "OpenAI" })}
              endContent={
                <button
                  className="text-default-400 text-sm hover:text-default-600"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowApiKey(!showApiKey);
                  }}
                >
                  {showApiKey ? t("common.hide") : t("common.show")}
                </button>
              }
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
};

const AIDeepSeekSettings = () => {
  const { t } = useTranslation();
  const [deepseekSettings, setDeepseekSettings, isLoading] =
    useAIProviderSettings<DeepSeekSettings>("deepseek", {
      enabled: false,
      model: "deepseek-chat",
    });

  const user = useStore((state) => state.user);
  const keychainUser = user?.username || "default";

  const [apiKey, setApiKey] = useState("");
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Load API key from OS keychain on mount
  useEffect(() => {
    invoke<string | null>("load_password", {
      service: "sh.atuin.runbooks.ai.deepseek",
      user: keychainUser,
    })
      .then((key) => {
        if (key) setApiKey(key);
        setApiKeyLoaded(true);
      })
      .catch((e) => {
        console.error("Failed to load DeepSeek API key:", e);
        setApiKeyLoaded(true);
      });
  }, []);

  const handleApiKeyChange = async (value: string) => {
    setApiKey(value);
    try {
      if (value) {
        await invoke("save_password", {
          service: "sh.atuin.runbooks.ai.deepseek",
          user: keychainUser,
          value,
        });
      } else {
        await invoke("delete_password", {
          service: "sh.atuin.runbooks.ai.deepseek",
          user: keychainUser,
        });
      }
    } catch (e) {
      console.error("Failed to save DeepSeek API key:", e);
    }
  };

  return (
    <Card shadow="sm">
      <CardBody className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">DeepSeek</h2>

        <SettingSwitch
          label={t("settings.ai.provider.enable", { provider: "DeepSeek" })}
          isSelected={deepseekSettings.enabled}
          onValueChange={(enabled) => setDeepseekSettings({ ...deepseekSettings, enabled })}
          description={t("settings.ai.provider.toggle", { provider: "DeepSeek (direct API)" })}
        />

        {deepseekSettings.enabled && (
          <div className="flex flex-col gap-4">
            <Input
              label={t("settings.ai.provider.model")}
              placeholder={t("settings.ai.provider.deepseek_model_placeholder")}
              value={deepseekSettings.model}
              onValueChange={(value) => setDeepseekSettings({ ...deepseekSettings, model: value })}
              isDisabled={isLoading}
              description={t("settings.ai.provider.model_description", { provider: "DeepSeek" })}
            />

            <Input
              label={t("settings.ai.provider.api_key")}
              placeholder={t("settings.ai.provider.deepseek_api_key_placeholder")}
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onValueChange={handleApiKeyChange}
              isDisabled={isLoading || !apiKeyLoaded}
              description={t("settings.ai.provider.api_key_description", { provider: "DeepSeek" })}
              endContent={
                <button
                  className="text-default-400 text-sm hover:text-default-600"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowApiKey(!showApiKey);
                  }}
                >
                  {showApiKey ? t("common.hide") : t("common.show")}
                </button>
              }
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
};

const UserSettings = () => {
  const { t } = useTranslation();
  const user = useStore((state) => state.user);
  const refreshUser = useStore((state) => state.refreshUser);
  const { isOpen: modalOpen, onOpen: openModal, onClose: closeModal } = useDisclosure();

  async function logOut() {
    await api.clearHubApiToken();
    SocketManager.setApiToken(null);
    refreshUser();
  }

  function handleTokenSubmit(token: string) {
    closeModal();
    const deepLink = `atuin://register-token/${token}`;
    // token submit deep link doesn't require a runbook activation,
    // so passing an empty function for simplicity
    handleDeepLink(deepLink, () => {});
  }

  let content;
  if (!user || !user.isLoggedIn()) {
    content = (
      <>
        <p>{t("settings.user.not_logged_in")}</p>
        <div className="flex flex-row gap-2 items-center">
          <Button
            onPress={() => open(AtuinEnv.url("/settings/desktop-connect"))}
            color="success"
            variant="flat"
            className="grow"
          >
            {t("settings.user.login_hub")}
          </Button>
          {t("common.or")}
          <Button onPress={() => openModal()} color="primary" variant="flat" className="grow">
            {t("settings.user.login_token")}
          </Button>
        </div>
      </>
    );
  } else {
    content = (
      <>
        <User
          name={""}
          avatarProps={{ src: user.avatar_url || undefined }}
          description={
            <Link
              isExternal
              href={AtuinEnv.url(`/${user.username}`)}
              onPress={() => {
                open(AtuinEnv.url(`/${user.username}`));
              }}
            >
              {user.username}
            </Link>
          }
          classNames={{ base: "mt-2 justify-start" }}
        />
        <Button onPress={logOut} color="danger" variant="flat">
          {t("settings.user.sign_out")}
        </Button>
      </>
    );
  }

  return (
    <Card shadow="sm">
      <CardBody>
        <h2 className="text-xl font-semibold">{t("settings.user.title")}</h2>
        <div className="flex flex-col gap-4">{content}</div>
        {modalOpen && (
          <AuthTokenModal onSubmit={handleTokenSubmit} onClose={closeModal} open={modalOpen} />
        )}
      </CardBody>
    </Card>
  );
};

// Main Settings component
const SettingsPanel = () => {
  const { t, locale } = useTranslation();
  const [selectedTab, setSelectedTab] = useState<string>("general");

  const tabs = useMemo(
    () => [
      {
        key: "general",
        title: t("settings.tabs.general"),
        content: <GeneralSettings />,
      },
      {
        key: "runbook",
        title: t("settings.tabs.runbooks"),
        content: <RunbookSettings />,
      },
      {
        key: "notification",
        title: t("settings.tabs.notifications"),
        content: <NotificationSettings />,
      },
      {
        key: "ai",
        title: t("settings.tabs.ai"),
        content: <AISettings />,
      },
      {
        key: "user",
        title: t("settings.tabs.user"),
        content: <UserSettings />,
      },
    ],
    [locale, t],
  );

  return (
    <div className="flex flex-col gap-4 p-4 pt-2 w-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <p className="text-small text-default-400 uppercase font-semibold">
          {t("settings.subtitle")}
        </p>
      </div>
      <Tabs
        key={locale}
        aria-label={t("settings.title")}
        color="primary"
        selectedKey={`${selectedTab}-${locale}`}
        onSelectionChange={(key) => setSelectedTab(String(key).replace(`-${locale}`, ""))}
        classNames={{
          tabList: "sticky top-4 start-0 z-20 pt-2 pb-4",
          panel: "w-full",
        }}
        isVertical
      >
        {tabs.map((tab) => (
          <Tab key={`${tab.key}-${locale}`} title={tab.title}>
            <div className="flex flex-col gap-4">{tab.content}</div>
          </Tab>
        ))}
      </Tabs>
    </div>
  );
};

export default SettingsPanel;
