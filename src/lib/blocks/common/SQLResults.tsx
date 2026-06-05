import { useEffect, useState } from "react";
import ResultTable from "./ResultTable";
import { Card, CardBody, CardHeader, Chip, Tooltip, Button, Divider } from "@heroui/react";
import { CheckCircle, CircleXIcon, Clock, HardDriveIcon, Rows4Icon } from "lucide-react";
import { SqlBlockExecutionResult } from "@/rs-bindings/SqlBlockExecutionResult";
import { formatBytes } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

interface SQLProps {
  error: any;
  results: SqlBlockExecutionResult | null;
  dismiss?: () => void;
  isFullscreen?: boolean;
}

const SQLResults = ({ results, error, dismiss, isFullscreen = false }: SQLProps) => {
  const { t } = useTranslation();
  const [columns, setColumns] = useState<
    { id: string; title: string; grow?: number; width?: number }[] | null
  >(null);

  useEffect(() => {
    if (!results) return;
    if (results?.type !== "Query") return;
    if (!results?.data?.columns) return;

    let cols = results.data.columns.map((key: any) => {
      return {
        id: key,
        title: key,
        grow: 1,
      };
    });

    setColumns(cols);
  }, [results]);

  let rows = null;
  let rowsAffected = null;
  let rowsRead = null;
  let bytesRead = null;
  if (results?.type === "Query") {
    rows = results.data.rows;
    rowsRead = results.data.rowsRead;
    bytesRead = results.data.bytesRead;
  } else if (results?.type === "Statement") {
    rowsAffected = results.data.rowsAffected;
  }

  if (error) {
    return (
      <Card shadow="sm" className="w-full max-w-full border border-danger-200">
        <CardHeader className="flex justify-between items-center bg-danger-50">
          <div className="flex items-center gap-3">
            {dismiss && (
              <Button variant="flat" isIconOnly onClick={dismiss} size="sm">
                <CircleXIcon size={16} />
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
            <span className="text-danger-700 font-semibold">{t("blocks.sql.database_error")}</span>
          </div>
        </CardHeader>
        <CardBody className="p-4">
          <p className="text-danger-600 select-text">{error || t("blocks.common.request_error")}</p>
        </CardBody>
      </Card>
    );
  }

  if (!results) return null;

  return (
    <Card
      shadow="sm"
      className={
        isFullscreen
          ? "w-full h-full border border-default-200 flex flex-col"
          : "w-full max-w-full border border-default-200"
      }
    >
      <CardHeader className="flex justify-between items-center bg-default-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          {dismiss && (
            <Button variant="flat" isIconOnly onClick={dismiss} size="sm">
              <CircleXIcon size={16} />
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
          {rows && rows.length > 0 ? (
            <span className="text-success-700 font-semibold">
              {rows!.length === 1
                ? t("blocks.sql.rows_returned_one", { count: rows!.length })
                : t("blocks.sql.rows_returned_many", { count: rows!.length })}
            </span>
          ) : (rowsAffected ?? null) != null ? (
            <span className="text-success-700 font-semibold">
              {rowsAffected === 1
                ? t("blocks.sql.rows_affected_one", { count: rowsAffected! })
                : t("blocks.sql.rows_affected_many", { count: rowsAffected! })}
            </span>
          ) : (
            <span className="text-default-700 font-semibold">
              {t("blocks.sql.query_successful")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {rowsRead && (
            <Tooltip content={t("blocks.sql.rows_read")}>
              <div className="flex items-center gap-1 text-default-500">
                <Rows4Icon size={14} />

                <span className="text-sm select-text">
                  {rowsRead > 1
                    ? t("blocks.sql.row_count_many", { count: rowsRead })
                    : t("blocks.sql.row_count_one", { count: rowsRead })}
                </span>
              </div>
            </Tooltip>
          )}

          {bytesRead && (
            <Tooltip content={t("blocks.common.bytes_read")}>
              <div className="flex items-center gap-1 text-default-500">
                <HardDriveIcon size={14} />

                <span className="text-sm select-text">{formatBytes(bytesRead)}</span>
              </div>
            </Tooltip>
          )}

          <Tooltip content={t("blocks.common.request_duration")}>
            <div className="flex items-center gap-1 text-default-500">
              <Clock size={14} />
              <span className="text-sm select-text">
                {secondsToTimeDisplay(results.data.duration)}
              </span>
            </div>
          </Tooltip>

          <span className="text-sm text-default-400 select-text">
            {new Date(results.data.time).toLocaleString()}
          </span>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className={isFullscreen ? "p-0 flex-1 min-h-0" : "p-0"}>
        {error && <div className="bg-red-100 text-red-600 p-2 rounded">{error}</div>}

        {results && columns && (
          <div
            className={isFullscreen ? "h-full w-full overflow-auto" : "h-64 w-full overflow-auto"}
          >
            <ResultTable
              width={"100%"}
              columns={columns}
              results={rows || []}
              setColumns={setColumns}
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
};

function secondsToTimeDisplay(seconds: number) {
  if (seconds >= 10) {
    return `${seconds.toFixed(3)}s`;
  } else {
    return `${(seconds * 1000).toFixed(3)}ms`;
  }
}

export default SQLResults;
