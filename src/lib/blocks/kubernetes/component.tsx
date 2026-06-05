import { useState, useCallback, useRef } from "react";
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  ButtonGroup,
  Card,
  CardHeader,
  CardBody,
  Chip,
  Tooltip,
  Divider,
  Select,
  SelectItem,
  Input,
} from "@heroui/react";
import {
  RefreshCw,
  Container,
  CheckCircle,
  CircleXIcon,
  Clock,
  ChevronDown,
  ArrowDownToLineIcon,
  ArrowUpToLineIcon,
  TrashIcon,
  SettingsIcon,
  ChevronUpIcon,
} from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import ResultTable from "@/lib/blocks/common/ResultTable";
import { PRESET_COMMANDS, PresetCommand } from "./execution";
import { useInterval } from "usehooks-ts";
import useCodemirrorTheme from "@/lib/hooks/useCodemirrorTheme";
import { useCodeMirrorValue } from "@/lib/hooks/useCodeMirrorValue";
import PlayButton from "@/lib/blocks/common/PlayButton";
import Block from "@/lib/blocks/common/Block";
import { cn } from "@/lib/utils";
import { KubernetesBlock } from "./schema";
import InterpreterSelector from "../common/InterpreterSelector";
import { useTranslation } from "@/lib/i18n";
import { useBlockExecution, useBlockOutput } from "@/lib/hooks/useDocumentBridge";

type KubernetesMode = "preset" | "custom";

interface KubernetesComponentProps {
  kubernetes: KubernetesBlock;
  setName: (name: string) => void;
  setCommand: (command: string) => void;
  setMode: (mode: KubernetesMode) => void;
  setInterpreter: (interpreter: string) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;
  setNamespace: (namespace: string) => void;
  setContext: (context: string) => void;
  isEditable: boolean;
  onCodeMirrorFocus?: () => void;
}

interface KubernetesResult {
  data: any[];
  columns: { id: string; title: string; width?: number }[];
  rowCount: number;
  duration: number;
  time: Date;
}

const REFRESH_INTERVAL_KEYS: Record<number, string> = {
  0: "common.off",
  1000: "kubernetes.refresh.1s",
  5000: "kubernetes.refresh.5s",
  10000: "kubernetes.refresh.10s",
  30000: "kubernetes.refresh.30s",
  60000: "kubernetes.refresh.1m",
  120000: "kubernetes.refresh.2m",
  300000: "kubernetes.refresh.5m",
};

export function KubernetesComponent({
  kubernetes,
  setName,
  setCommand,
  setMode,
  setInterpreter,
  setAutoRefresh,
  setRefreshInterval,
  setNamespace,
  setContext,
  isEditable,
  onCodeMirrorFocus,
}: KubernetesComponentProps) {
  const { t } = useTranslation();
  const [results, setResults] = useState<KubernetesResult | null>(null);
  const [collapseQuery, setCollapseQuery] = useState<boolean>(false);
  const [expandedFooter, setExpandedFooter] = useState<boolean>(false);

  const elementRef = useRef<HTMLDivElement>(null);

  const themeObj = useCodemirrorTheme();
  const codeMirrorValue = useCodeMirrorValue(kubernetes.command, setCommand);

  // Get the refresh interval label
  const refreshLabel = t(REFRESH_INTERVAL_KEYS[kubernetes.refreshInterval] || "common.off");

  // Use the new hooks for execution and output
  const execution = useBlockExecution(kubernetes.id);
  useBlockOutput<any>(kubernetes.id, (output) => {
    console.log("kubernetes output", output); // I18N: no-translate - developer diagnostic

    if (output.object && output.object.type === "kubernetes") {
      const result: KubernetesResult = {
        data: output.object.data || [],
        columns: output.object.columns || [],
        rowCount: (output.object.data || []).length,
        duration: 0, // Duration is managed by backend now
        time: new Date(),
      };
      setResults(result);
    }
  });

  const isRunning = execution.isRunning;

  const handlePlay = useCallback(
    async (isAutoRefresh = false) => {
      // Only scroll into view if this is not an auto-refresh
      if (!isAutoRefresh && elementRef.current) {
        elementRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      // Execute using the backend execution system
      execution.execute();
    },
    [execution],
  );

  useInterval(
    () => {
      // Don't stack commands
      if (isRunning) return;

      (async () => {
        await handlePlay(true); // Pass true to indicate this is auto-refresh
      })();
    },
    kubernetes.refreshInterval > 0 ? kubernetes.refreshInterval : null,
  );

  const presetOptions = Object.entries(PRESET_COMMANDS).map(([key]) => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    value: key,
  }));

  // Find which preset matches the current command
  const getCurrentPresetKey = () => {
    const currentCommand = kubernetes.command.trim();
    for (const [key, command] of Object.entries(PRESET_COMMANDS)) {
      if (command === currentCommand) {
        return key;
      }
    }
    return null; // No preset matches
  };

  const currentPresetKey = getCurrentPresetKey();

  return (
    <Block
      name={kubernetes.name}
      block={kubernetes}
      type="kubernetes-get"
      setName={setName}
      setDependency={() => {}}
      topRightElement={
        <InterpreterSelector
          interpreter={kubernetes.interpreter}
          onInterpreterChange={setInterpreter}
          size="sm"
          variant="flat"
        />
      }
      header={
        <>
          {kubernetes.mode === "preset" ? (
            <div className="flex flex-row gap-2 w-full items-center">
              <PlayButton
                eventName="runbooks.block.execute"
                eventProps={{ type: "kubernetes-get" }}
                isRunning={isRunning}
                onPlay={() => handlePlay(false)}
                cancellable={false}
              />
              <Select
                selectedKeys={currentPresetKey ? [currentPresetKey] : []}
                onSelectionChange={(keys) => {
                  const selectedKey = Array.from(keys)[0] as string;
                  if (selectedKey && PRESET_COMMANDS[selectedKey as PresetCommand]) {
                    setCommand(PRESET_COMMANDS[selectedKey as PresetCommand]);
                  }
                }}
                className="flex-grow"
                placeholder={t("kubernetes.select_command")}
                startContent={<Container size={18} />}
                disabled={!isEditable}
              >
                {presetOptions.map((option) => (
                  <SelectItem
                    key={option.key}
                    description={PRESET_COMMANDS[option.key as PresetCommand]}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
          ) : (
            <div className="flex flex-row gap-2 w-full" ref={elementRef}>
              <PlayButton
                eventName="runbooks.block.execute"
                eventProps={{ type: "kubernetes-get" }}
                isRunning={isRunning}
                onPlay={() => handlePlay(false)}
                cancellable={false}
              />
              <CodeMirror
                placeholder={t("kubernetes.command_placeholder")}
                className={cn("!pt-0 max-w-full border border-gray-300 rounded flex-grow", {
                  "h-8 overflow-hidden": collapseQuery,
                })}
                basicSetup={true}
                value={codeMirrorValue.value}
                onChange={codeMirrorValue.onChange}
                editable={isEditable}
                theme={themeObj}
                maxHeight="100vh"
                onFocus={onCodeMirrorFocus}
              />
            </div>
          )}
        </>
      }
      footer={
        <div className="flex flex-col gap-2 w-full">
          {/* Compact footer row */}
          <div className="flex flex-row gap-2 items-center justify-between w-full">
            <ButtonGroup>
              <Button
                size="sm"
                variant="flat"
                onPress={() => {
                  if (kubernetes.mode === "preset") {
                    setMode("custom");// I18N: no-translate - internal state value
                  } else {
                    // When switching from custom to preset, set to default command if current isn't a preset
                    if (!currentPresetKey) {
                      setCommand(PRESET_COMMANDS.pods);
                    }
                    setMode("preset");
                  }
                }}
                disabled={!isEditable}
              >
                {kubernetes.mode === "preset" ? t("kubernetes.mode.custom") : t("kubernetes.mode.preset")}{/* I18N: translate - visible button label */}
              </Button>
              {kubernetes.mode === "custom" && (
                <Button
                  size="sm"
                  isIconOnly
                  variant="flat"
                  onPress={() => setCollapseQuery(!collapseQuery)}
                >
                  <Tooltip
                    content={
                      collapseQuery ? t("blocks.sql.expand_query") : t("blocks.sql.collapse_query")
                    }
                  >
                    {collapseQuery ? (
                      <ArrowDownToLineIcon size={16} />
                    ) : (
                      <ArrowUpToLineIcon size={16} />
                    )}
                  </Tooltip>
                </Button>
              )}
            </ButtonGroup>
            <Button
              size="sm"
              variant="flat"
              isIconOnly
              onPress={() => setExpandedFooter(!expandedFooter)}
            >
              <Tooltip
                content={
                  expandedFooter
                    ? t("blocks.common.hide_settings")
                    : t("blocks.common.show_settings")
                }
              >
                {expandedFooter ? <ChevronUpIcon size={16} /> : <SettingsIcon size={16} />}
              </Tooltip>
            </Button>
          </div>

          {/* Expanded footer row */}
          {expandedFooter && (
            <div className="flex flex-row gap-4 items-center justify-between w-full pt-2 border-t border-default-200">
              <div className="flex flex-row gap-2 items-center">
                <Input
                  size="sm"
                  placeholder="default"
                  label={t("kubernetes.namespace")}
                  value={kubernetes.namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  disabled={!isEditable}
                  className="w-32"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
                <Input
                  size="sm"
                  placeholder="current-context"
                  label={t("kubernetes.context")}
                  value={kubernetes.context}
                  onChange={(e) => setContext(e.target.value)}
                  disabled={!isEditable}
                  className="w-32"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
              </div>
              <Dropdown showArrow>
                <DropdownTrigger>
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<RefreshCw size={16} />}
                    endContent={<ChevronDown size={16} />}
                  >
                    {t("blocks.common.auto_refresh")}: {refreshLabel}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  variant="faded"
                  aria-label={t("blocks.common.select_refresh_interval")}
                  selectedKeys={refreshLabel ? [refreshLabel] : undefined}
                >
                  {Object.entries(REFRESH_INTERVAL_KEYS).map(([value, key]) => (
                    <DropdownItem
                      key={t(key)}
                      onPress={() => {
                        const numValue = parseInt(value);
                        if (numValue === 0) {
                          setAutoRefresh(false);
                          setRefreshInterval(0);
                        } else {
                          setAutoRefresh(true);
                          setRefreshInterval(numValue);
                        }
                      }}
                    >
                      {t(key)}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
            </div>
          )}
        </div>
      }
    >
      {(results || execution.error) && (
        <KubernetesResults
          results={results}
          error={execution.error}
          dismiss={() => {
            setResults(null);
          }}
        />
      )}
    </Block>
  );
}

interface KubernetesResultsProps {
  error: any;
  results: KubernetesResult | null;
  dismiss?: () => void;
}

function KubernetesResults({ results, error, dismiss }: KubernetesResultsProps) {
  const { t } = useTranslation();
  if (error) {
    return (
      <Card shadow="sm" className="w-full max-w-full border border-danger-200">
        <CardHeader className="flex justify-between items-center bg-danger-50">
          <div className="flex items-center gap-3">
            {dismiss && (
              <Button variant="flat" isIconOnly onClick={dismiss} size="sm">
                <TrashIcon size={16} />
              </Button>
            )}
            <Chip
              color="danger"
              variant="flat"
              startContent={<CircleXIcon size={14} />}
              className="pl-3 py-2"
            >
              {t("common.error")}
            </Chip>
            <span className="text-danger-700 font-semibold">{t("kubernetes.command_failed")}</span>
          </div>
        </CardHeader>
        <CardBody className="p-4">
          <p className="text-danger-600 select-text">
            {error || t("kubernetes.command_error_description")}
          </p>
        </CardBody>
      </Card>
    );
  }

  if (!results) return null;

  return (
    <Card shadow="sm" className="w-full max-w-full border border-default-200">
      <CardHeader className="flex justify-between items-center bg-default-50">
        <div className="flex items-center gap-3">
          {dismiss && (
            <Button variant="flat" isIconOnly onClick={dismiss} size="sm">
              <TrashIcon size={16} />
            </Button>
          )}
          <Chip
            color="success"
            variant="flat"
            startContent={<CheckCircle size={14} />}
            className="pl-3 py-2"
          >
            {t("common.success")}
          </Chip>
          {results.rowCount > 0 ? (
            <span className="text-success-700 font-semibold">
              {results.rowCount === 1
                ? t("kubernetes.resources_returned_one", { count: results.rowCount })
                : t("kubernetes.resources_returned_many", { count: results.rowCount })}
            </span>
          ) : (
            <span className="text-default-700 font-semibold">
              {t("kubernetes.command_successful")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Tooltip content="Request duration">
            <div className="flex items-center gap-1 text-default-500">
              <Clock size={14} />
              <span className="text-sm select-text">
                {parseFloat(results.duration.toFixed(3))}ms
              </span>
            </div>
          </Tooltip>

          <span className="text-sm text-default-400 select-text">
            {results.time.toLocaleString()}
          </span>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="p-0">
        {results && results.columns && (
          <div className="h-64 w-full">
            <ResultTable
              width={"100%"}
              columns={results.columns}
              results={results.data || []}
              setColumns={() => {}} // Read-only
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
