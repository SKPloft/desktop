import { useState, useEffect } from "react";
import undent from "undent";
import AIBlockRegistry from "@/lib/ai/block_registry";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  ButtonGroup,
  Spinner,
  DropdownSection,
} from "@heroui/react";

import {
  ChevronDown,
  ChevronDownIcon,
  ClockIcon,
  CloudOffIcon,
  DatabaseIcon,
  FileTerminalIcon,
  LineChartIcon,
  LockIcon,
  RefreshCwIcon,
} from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { PromQLExtension } from "@prometheus-io/codemirror-promql";

// @ts-ignore
import { createReactBlockSpec, useBlockNoteEditor } from "@blocknote/react";

import { PromLineChart } from "./lineChart";
import { Settings } from "@/state/settings";
import { PrometheusBlock as PrometheusBlockType } from "@/lib/workflow/blocks/prometheus";
import { DependencySpec } from "@/lib/workflow/dependency";
import track_event from "@/tracking";
import useCodemirrorTheme from "@/lib/hooks/useCodemirrorTheme";
import { useCodeMirrorValue } from "@/lib/hooks/useCodeMirrorValue";
import ErrorCard from "@/lib/blocks/common/ErrorCard";
import PlayButton from "@/lib/blocks/common/PlayButton";
import Block from "@/lib/blocks/common/Block";
import { exportPropMatter, toSnakeCase } from "@/lib/utils";
import { useBlockExecution, useBlockOutput } from "@/lib/hooks/useDocumentBridge";
import { PrometheusQueryResult } from "@/rs-bindings/PrometheusQueryResult";
import MaskedInput from "@/components/MaskedInput/MaskedInput";
import { useInterval } from "usehooks-ts";
import { useTranslation, t } from "@/lib/i18n";

interface PromProps {
  setName: (name: string) => void;
  setQuery: (query: string) => void;
  setEndpoint: (endpoint: string) => void;
  setPeriod: (period: string) => void;
  setAutoRefresh: (autoRefresh: number) => void;
  setDependency: (dependency: DependencySpec) => void;

  isEditable: boolean;
  prometheus: PrometheusBlockType;
}

interface TimeFrame {
  name: string;
  seconds: number;
  short: string;
}

const timeOptions: TimeFrame[] = [
  { name: t("editor.blocks.prometheus.time_frame.last_5_mins"), seconds: 5 * 60, short: "5m" },  
  { name: t("editor.blocks.prometheus.time_frame.last_15_mins"), seconds: 15 * 60, short: "15m" }, 
  { name: t("editor.blocks.prometheus.time_frame.last_30_mins"), seconds: 30 * 60, short: "30m" }, 
  { name: t("editor.blocks.prometheus.time_frame.last_1_hr"), seconds: 60 * 60, short: "1h" }, 
  { name: t("editor.blocks.prometheus.time_frame.last_3_hrs"), seconds: 3 * 60 * 60, short: "3h" }, 
  { name: t("editor.blocks.prometheus.time_frame.last_6_hrs"), seconds: 6 * 60 * 60, short: "6h" }, 
  { name: t("editor.blocks.prometheus.time_frame.last_24_hrs"), seconds: 24 * 60 * 60, short: "24h" }, 
  { name: t("editor.blocks.prometheus.time_frame.last_2_days"), seconds: 2 * 24 * 60 * 60, short: "2d" }, 
  { name: t("editor.blocks.prometheus.time_frame.last_7_days"), seconds: 7 * 24 * 60 * 60, short: "7d" }, 
  { name: t("editor.blocks.prometheus.time_frame.last_30_days"), seconds: 30 * 24 * 60 * 60, short: "30d" }, 
  { name: t("editor.blocks.prometheus.time_frame.last_90_days"), seconds: 90 * 24 * 60 * 60, short: "90d" }, 
  { name: t("editor.blocks.prometheus.time_frame.last_180_days"), seconds: 180 * 24 * 60 * 60, short: "180d" }, 
];

const autoRefreshChoices = [
  { label: t("common.off"), value: 0 }, 
  { label: t("blocks.common.refresh.1s"), value: 1000 }, 
  { label: t("blocks.common.refresh.5s"), value: 5000 }, 
  { label: t("blocks.common.refresh.10s"), value: 10000 }, 
  { label: t("blocks.common.refresh.30s"), value: 30000 }, 
  { label: t("blocks.common.refresh.1m"), value: 60000 }, 
  { label: t("blocks.common.refresh.2m"), value: 120000 }, 
  { label: t("blocks.common.refresh.5m"), value: 300000 }, 
  { label: t("blocks.common.refresh.10m"), value: 600000 }, 
  { label: t("blocks.common.refresh.30m"), value: 1800000 }, 
];

// Note: calculateStepSize is now handled by the backend

const Prometheus = ({
  prometheus,
  isEditable,
  setName,
  setQuery,
  setEndpoint,
  setPeriod,
  setAutoRefresh,
  setDependency,
}: PromProps) => {
  const { t } = useTranslation();
  let editor = useBlockNoteEditor();
  const [value, setValue] = useState<string>(prometheus.query);
  const [data, setData] = useState<Array<Array<number>>>([]);
  const [seriesNames, setSeriesNames] = useState<string[]>([]);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>(
    timeOptions.find((t) => t.short === prometheus.period) || timeOptions[3],
  );

  const [prometheusUrl, setPrometheusUrl] = useState<string | null>(null);
  const [promExtension, setPromExtension] = useState<PromQLExtension | null>(null);

  const execution = useBlockExecution(prometheus.id);
  const isRunning = execution.isRunning;

  useBlockOutput<PrometheusQueryResult>(prometheus.id, (output) => {
    if (output.object) {
      // Backend returns PrometheusQueryResult in the object field
      const result = output.object as PrometheusQueryResult;
      setData(result.data);
      setSeriesNames(result.seriesNames);
    }
  });

  useInterval(
    () => {
      // let's not stack queries
      if (execution.isRunning) return;

      (async () => {
        await execution.execute();
      })();
    },
    prometheus.autoRefresh > 0 ? prometheus.autoRefresh : null,
  );

  // Set up Prometheus URL and extension for autocomplete
  useEffect(() => {
    (async () => {
      // if have passed in an endpoint via props directly, use it
      if (prometheus.endpoint) {
        setPrometheusUrl(prometheus.endpoint);
        return;
      }

      // otherwise fetch the default endpoint from settings
      let url = await Settings.runbookPrometheusUrl();
      setPrometheusUrl(url);
    })();
  }, [prometheus.endpoint]);

  useEffect(() => {
    if (!prometheusUrl) return;

    // Set up PromQL extension for autocomplete
    let promExt = new PromQLExtension().setComplete({
      remote: { url: prometheusUrl },
    });

    setPromExtension(promExt);
  }, [prometheusUrl]);

  const themeObj = useCodemirrorTheme();
  const codeMirrorValue = useCodeMirrorValue(value, (val) => {
    setValue(val);
    setQuery(val);
  });

  const addLocalVar = () => {
    let blockName = toSnakeCase(prometheus.name);

    editor.insertBlocks(
      [
        {
          // @ts-ignore
          type: "local-var",
          props: {
            name: `${blockName}`,
          },
        },
      ],
      prometheus.id,
      "before",
    );

    setEndpoint(`{{ var.${blockName} }}`);
  };

  const addScriptForUri = () => {
    let blockName = toSnakeCase(prometheus.name);

    // TODO: register custom schema type for typescript blocknote
    editor.insertBlocks(
      [
        {
          // @ts-ignore
          type: "script",
          props: {
            name: `uri for ${prometheus.name}`,
            // @ts-ignore
            outputVariable: blockName,
            outputVisible: false,
            code: `# Output the uri for ${prometheus.name}`,
          },
        },
      ],
      prometheus.id,
      "before",
    );

    setEndpoint(`{{ var.${blockName} }}`);
  };

  return (
    <Block
      block={prometheus}
      hasDependency
      setDependency={setDependency}
      name={prometheus.name}
      type={"Prometheus"}
      setName={setName}
      header={
        <>
          <div className="flex flex-row gap-2 w-full items-center">
            <MaskedInput
              size="sm"
              maskRegex={/(?<=:\/\/).*(?=@[^@]*$)/}
              placeholder={t("editor.blocks.prometheus.endpoint_placeholder")}
              label={t("editor.blocks.prometheus.endpoint")}
              isRequired
              startContent={<DatabaseIcon size={18} />}
              value={prometheus.endpoint}
              onChange={(val: string) => {
                setEndpoint(val);
              }}
              disabled={!isEditable}
            />

            <Dropdown>
              <DropdownTrigger>
                <Button isIconOnly variant="flat">
                  <LockIcon size={16} />
                </Button>
              </DropdownTrigger>
              <DropdownMenu disabledKeys={["secret"]}>
                <DropdownSection title={t("blocks.common.variable_or_script")}>
                  <DropdownItem
                    key="local-var"
                    description={t("blocks.common.local_variable_description")}
                    startContent={<CloudOffIcon size={16} />}
                    onPress={addLocalVar}
                  >
                    {t("blocks.common.variable")}
                  </DropdownItem>
                  <DropdownItem
                    key="template"
                    description={t("blocks.common.script_description")}
                    startContent={<FileTerminalIcon size={16} />}
                    onPress={addScriptForUri}
                  >
                    {t("blocks.common.script")}
                  </DropdownItem>
                  <DropdownItem
                    key="secret"
                    description={t("blocks.common.secret_description")}
                    startContent={<LockIcon size={16} />}
                  >
                    {t("blocks.common.secret")}
                  </DropdownItem>
                </DropdownSection>
              </DropdownMenu>
            </Dropdown>
          </div>
          <div className="w-full !max-w-full !outline-none overflow-none flex flex-row gap-2">
            <PlayButton
              eventName="runbooks.block.execute"
              eventProps={{ type: "prometheus" }}
              onPlay={async () => {
                execution.execute();
              }}
              isRunning={isRunning}
              cancellable={true}
            />
            <CodeMirror
              placeholder={t("blocks.sql.query_placeholder")}
              className="!pt-0 max-w-full border border-gray-300 rounded flex-grow"
              value={codeMirrorValue.value}
              onChange={codeMirrorValue.onChange}
              extensions={promExtension ? [promExtension.asExtension()] : []}
              basicSetup={true}
              editable={isEditable}
              theme={themeObj}
            />
          </div>
        </>
      }
      footer={
        <div className="flex justify-between p-3 border-t w-full">
          <div className="flex-row content-center items-center justify-center">
            <ButtonGroup className="mr-2">
              <Dropdown showArrow>
                <DropdownTrigger>
                  <Button
                    variant="flat"
                    size="sm"
                    startContent={<ClockIcon />}
                    endContent={<ChevronDownIcon />}
                  >
                    {timeFrame.short}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu variant="faded" aria-label={t("editor.blocks.prometheus.select_time_frame")}>
                  {timeOptions.map((timeOption) => {
                    return (
                      <DropdownItem
                        key={timeOption.name}
                        onPress={() => {
                          setTimeFrame(timeOption);
                          setPeriod(timeOption.short);
                        }}
                      >
                        {timeOption.name}
                      </DropdownItem>
                    );
                  })}
                </DropdownMenu>
              </Dropdown>
            </ButtonGroup>
          </div>

          <ButtonGroup>
            <Dropdown showArrow>
              <DropdownTrigger>
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<RefreshCwIcon size={16} />}
                  endContent={<ChevronDown size={16} />}
                >
                  {t("blocks.common.auto_refresh")}:{" "}
                  {prometheus.autoRefresh == 0
                    ? t("common.off")
                    : (
                        autoRefreshChoices.find((a) => a.value == prometheus.autoRefresh) || {
                          label: t("common.off"),
                        }
                      ).label}
                </Button>
              </DropdownTrigger>
              <DropdownMenu variant="faded" aria-label={t("blocks.common.select_refresh_interval")}>
                {autoRefreshChoices.map((setting) => {
                  return (
                    <DropdownItem
                      key={setting.label}
                      onPress={() => {
                        setAutoRefresh(setting.value);
                      }}
                    >
                      {setting.label}
                    </DropdownItem>
                  );
                })}
              </DropdownMenu>
            </Dropdown>
          </ButtonGroup>
        </div>
      }
    >
      <div className="min-h-64 overflow-x-scroll">
        {!prometheusUrl ? (
          <ErrorCard error="No Prometheus endpoint set" />
        ) : execution.isError ? (
          <ErrorCard error={execution.error} />
        ) : isRunning && data.length === 0 ? (
          <div className="flex items-center justify-center h-full w-full">
            <Spinner />
          </div>
        ) : (
          <PromLineChart data={data} seriesNames={seriesNames} />
        )}
      </div>
    </Block>
  );
};

export default createReactBlockSpec(
  {
    type: "prometheus",
    propSchema: {
      name: { default: "Prometheus" },
      query: { default: "" },
      endpoint: { default: "" },
      period: { default: "" },
      autoRefresh: { default: 0 },
      dependency: { default: "{}" },
    },
    content: "none",
  },
  {
    toExternalHTML: ({ block }) => {
      let propMatter = exportPropMatter("prometheus", block.props, ["name", "endpoint", "period"]);
      return (
        <pre lang="prometheus">
          <code>
            {propMatter}
            {block.props.query}
          </code>
        </pre>
      );
    },
    // @ts-ignore
    render: ({ block, editor }) => {
      const setName = (name: string) => {
        editor.updateBlock(block, {
          props: { ...block.props, name: name },
        });
      };

      const setQuery = (query: string) => {
        editor.updateBlock(block, {
          props: { ...block.props, query: query },
        });
      };

      const setEndpoint = (endpoint: string) => {
        editor.updateBlock(block, {
          props: { ...block.props, endpoint: endpoint },
        });
      };

      const setPeriod = (period: string) => {
        editor.updateBlock(block, {
          props: { ...block.props, period: period },
        });
      };

      const setAutoRefresh = (autoRefresh: number) => {
        editor.updateBlock(block, {
          props: { ...block.props, autoRefresh: autoRefresh },
        });
      };

      const setDependency = (dependency: DependencySpec) => {
        editor.updateBlock(block, {
          props: { ...block.props, dependency: dependency.serialize() },
        });
      };

      let dependency = DependencySpec.deserialize(block.props.dependency);
      let prometheus = new PrometheusBlockType(
        block.id,
        block.props.name,
        dependency,
        block.props.query,
        block.props.endpoint,
        block.props.period,
        block.props.autoRefresh,
      );

      return (
        <Prometheus
          prometheus={prometheus}
          setName={setName}
          setQuery={setQuery}
          setEndpoint={setEndpoint}
          setPeriod={setPeriod}
          setAutoRefresh={setAutoRefresh}
          setDependency={setDependency}
          isEditable={editor.isEditable}
        />
      );
    },
  },
);

export const insertPrometheus = (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
  title: t("editor.blocks.prometheus.title"), 
  onItemClick: () => {
    track_event("runbooks.block.create", { type: "prometheus" });

    let prometheusBlocks = editor.document.filter((block: any) => block.type === "prometheus");
    let name = t("editor.blocks.prometheus.default_name", { count: prometheusBlocks.length + 1 }); 

    // fetch the default endpoint from the old settings
    Settings.runbookPrometheusUrl().then((url) => {
      editor.insertBlocks(
        [
          {
            type: "prometheus",
            // @ts-ignore
            props: {
              name: name,
              endpoint: url,
            },
          },
        ],
        editor.getTextCursorPosition().block.id,
        "before",
      );
    });
  },
  icon: <LineChartIcon size={18} />,
  aliases: ["prom", "promql", "grafana"], 
  group: t("editor.blocks.group.monitor"), 
});

AIBlockRegistry.getInstance().addBlock({
  typeName: "prometheus",
  friendlyName: () => t("editor.blocks.prometheus.title"),
  shortDescription: () => t("editor.blocks.prometheus.short_desc"),
  description: () => undent`
    Prometheus blocks execute PromQL queries against a Prometheus server and display the results as interactive line charts.

    The available props are:
    - name (string): The display name of the block
    - query (string): The PromQL query to execute
    - endpoint (string): The Prometheus server URL
    - period (string): Time range for the query (e.g., "5m", "1h", "24h")
    - autoRefresh (number): Auto-refresh interval in milliseconds (0 to disable)

    You can reference template variables in the endpoint and query: {{ var.variable_name }}.

    OUTPUT ACCESS (requires block to have a name):
    - output.series (array): Time series data
    - output.total_series (number): Number of series returned
    - output.time_range (object): Query time range

    AUTHENTICATION:
    Supports basic auth via URL (e.g., https://user:pass@prometheus.example.com).

    Example: {
      "type": "prometheus",
      "props": {
        "name": "CPU Usage",
        "query": "rate(node_cpu_seconds_total{mode='user'}[5m])",
        "endpoint": "{{ var.prometheus_url }}",
        "period": "1h"
      }
    }
  `,
});