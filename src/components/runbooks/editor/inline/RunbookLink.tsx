import { createReactInlineContentSpec } from "@blocknote/react";
import { cn } from "@/lib/utils";
import { useContext, useEffect, useState } from "react";
import RunbookContext from "@/context/runbook_context";
import { LinkIcon } from "lucide-react";
import Runbook from "@/state/runbooks/runbook";
import { t, useTranslation } from "@/lib/i18n";

export const RunbookLink = createReactInlineContentSpec(
  {
    type: "runbook-link",
    propSchema: {
      runbookId: {
        default: "",
      },
      runbookName: {
        default: t("runbooks.link.untitled_runbook"),
      },
    },
    content: "none",
  } as const,
  {
    render: (props) => {
      const { t } = useTranslation();
      const { runbookId, runbookName } = props.inlineContent.props;
      const { activateRunbook } = useContext(RunbookContext);
      const [linkedRunbook, setLinkedRunbook] = useState<Runbook | null>(null);

      useEffect(() => {
        if (runbookId) {
          Runbook.load(runbookId).then((runbook) => {
            setLinkedRunbook(runbook);
            if (runbookName !== runbook?.name) {
              props.updateInlineContent({
                type: "runbook-link",
                props: {
                  runbookId: props.inlineContent.props.runbookId,
                  runbookName: runbook?.name || t("runbooks.link.unknown_runbook"),
                },
              });
            }
          });
        }
      }, [runbookId]);

      const handleClick = () => {
        activateRunbook(runbookId);
      };

      return (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 px-1 py-0",
            "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900",
            "border border-blue-200 dark:border-blue-700",
            "rounded",
            "text-blue-600 dark:text-blue-400",
            "cursor-pointer transition-colors duration-150",
          )}
          onClick={handleClick}
          title={t("runbooks.link.tooltip", { name: linkedRunbook?.name || runbookName })}
        >
          <LinkIcon size={12} />
          <span>{runbookName}</span>
        </span>
      );
    },
  },
);
