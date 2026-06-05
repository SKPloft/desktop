import Runbook from "@/state/runbooks/runbook";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { save } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "@/lib/i18n";

interface ExportRunbookDropdownProps {
  runbook: Runbook;
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportRunbookDropdown({
  runbook,
  isOpen,
  onClose,
}: ExportRunbookDropdownProps) {
  const { t } = useTranslation();
  let exportTypes = [
    /*
    {
      name: t("export_runbook.type.atuin_markdown"), 
      extension: "atmd",
      action: async () => {
        let filePath = await save({
          defaultPath: runbook.name + ".atmd",
        });

        if (!filePath) return;

        runbook?.exportMarkdown(filePath);
      },
    },
    */
    {
      name: t("export_runbook.type.atuin_runbook"),
      extension: "atrb",
      action: async () => {
        let filePath = await save({
          defaultPath: runbook.name + ".atrb",
        });

        if (!filePath) return;

        // TODO
        // runbook?.export(filePath);
      },
    },
  ];

  return (
    <Dropdown
      isOpen={isOpen}
      placement="right-start"
      className="absolute left-[6.5rem] top-[-1rem]"
    >
      <DropdownTrigger title={t("export_runbook.export_as")}>
        <span className="w-full">{t("export_runbook.export_as")}</span>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={t("export_runbook.aria")}
        variant="flat"
        topContent={
          <div className="text-default-600 font-semibold">{t("export_runbook.title")}</div>
        }
        items={exportTypes}
      >
        {(exportType) => {
          return (
            <DropdownItem
              key={exportType.name}
              textValue={exportType.name}
              className="py-2"
              onPress={async () => {
                if (!exportType.action) return;
                await exportType.action();

                onClose();
              }}
            >
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <span className="text-small">{exportType.name}</span>
                  <span className="text-tiny text-default-400 font-semibold">
                    {exportType.extension}
                  </span>
                </div>
              </div>
            </DropdownItem>
          );
        }}
      </DropdownMenu>
    </Dropdown>
  );
}
