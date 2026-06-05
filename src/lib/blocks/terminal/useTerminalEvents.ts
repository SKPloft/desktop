import { useEffect, useState } from "react";
import { addToast } from "@heroui/react";
import { logExecution } from "@/lib/exec_log.ts";
import { TerminalBlock } from "./schema.ts";
import { useTranslation } from "@/lib/i18n";

export const useTerminalEvents = (terminalData: any, terminal: TerminalBlock) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [commandDuration, setCommandDuration] = useState<number | null>(null);

  useEffect(() => {
    if (!terminalData) return;

    // Sync initial state
    setIsRunning(terminalData.isRunning || false);
    setExitCode(terminalData.exitCode || null);
    setCommandDuration(terminalData.commandDuration || null);

    const handleExecutionStarted = () => {
      console.log("Terminal execution started"); // I18N: no-translate - developer diagnostic
      setIsLoading(false);
      setIsRunning(true);
    };

    const handleExecutionFinished = ({ exitCode, duration }: any) => {
      console.log("Terminal execution finished", { exitCode, duration }); // I18N: no-translate - developer diagnostic
      setIsRunning(false);
      setExitCode(exitCode);
      setCommandDuration(duration);

      // Log execution for history
      if (duration) {
        const startTime = Date.now() * 1000000 - duration * 1000;
        logExecution(terminal, terminal.typeName, startTime, Date.now() * 1000000, "");
      }
    };

    const handleExecutionCancelled = () => {
      console.log("Terminal execution cancelled"); // I18N: no-translate - developer diagnostic
      setIsRunning(false);
    };

    const handleExecutionError = ({ message }: any) => {
      console.log("Terminal execution error", message); // I18N: no-translate - developer diagnostic
      setIsRunning(false);
      addToast({
        title: t("editor.blocks.terminal.error_title"),
        description: message,
        color: "danger",
      });
    };

    // Set up event listeners
    terminalData.on("execution_started", handleExecutionStarted);
    terminalData.on("execution_finished", handleExecutionFinished);
    terminalData.on("execution_cancelled", handleExecutionCancelled);
    terminalData.on("execution_error", handleExecutionError);

    return () => {
      // Clean up event listeners
      terminalData.off("execution_started", handleExecutionStarted);
      terminalData.off("execution_finished", handleExecutionFinished);
      terminalData.off("execution_cancelled", handleExecutionCancelled);
      terminalData.off("execution_error", handleExecutionError);
    };
  }, [terminalData, terminal]);

  return { isLoading, setIsLoading, isRunning, exitCode, commandDuration };
};
