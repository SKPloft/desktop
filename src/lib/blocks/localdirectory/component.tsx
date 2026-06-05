import { Input, Tooltip, Button } from "@heroui/react";
import { FolderInputIcon } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useBlockKvValue } from "@/lib/hooks/useKvValue";
import { useTranslation } from "@/lib/i18n";

interface LocalDirectoryComponentProps {
  blockId: string;
  isEditable: boolean;
}

export const LocalDirectoryComponent = ({ blockId, isEditable }: LocalDirectoryComponentProps) => {
  const { t } = useTranslation();
  const [path, setPath] = useBlockKvValue(blockId, "path", "");

  const selectFolder = async () => {
    if (isEditable) {
      const selectedPath = await open({
        multiple: false,
        directory: true,
      });

      if (selectedPath) {
        setPath(selectedPath);
      }
    }
  };

  const handleInputChange = async (newPath: string) => {
    setPath(newPath);
  };

  return (
    <div className="w-full !max-w-full !outline-none overflow-none">
      <Tooltip content={t("local_directory.tooltip")} delay={1000}>
        <div className="flex flex-row items-center space-x-3 w-full bg-gradient-to-r from-orange-50 to-amber-50 dark:from-slate-800 dark:to-orange-950 rounded-lg p-3 border border-orange-200 dark:border-orange-900 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center">
            <Button
              isIconOnly
              variant="light"
              className="bg-orange-100 dark:bg-orange-800 text-orange-600 dark:text-orange-300"
              aria-label={t("local_directory.select_folder")}
              onPress={selectFolder}
              disabled={!isEditable}
            >
              <FolderInputIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1">
            <Input
              placeholder={t("local_directory.placeholder")}
              value={path}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              onValueChange={handleInputChange}
              disabled={!isEditable}
              className="flex-1 border-orange-200 dark:border-orange-800 focus:ring-orange-500"
            />
          </div>
        </div>
      </Tooltip>
    </div>
  );
};
