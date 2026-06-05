import { useEffect, useState } from "react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Tooltip,
} from "@heroui/react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderIcon } from "lucide-react";
import { Option, Some } from "@binarymuse/ts-stdlib";
import { cn } from "@/lib/utils";
import { useStore } from "@/state/store";
import { ConnectionState } from "@/state/store/user_state";
import { readDir } from "@tauri-apps/plugin-fs";
import * as commands from "@/lib/workspaces/commands";
import { findParentWorkspace } from "@/lib/workspaces/offline_strategy";
import { useTranslation } from "@/lib/i18n";

interface NewWorkspaceDialogProps {
  onAccept: (name: string, online: boolean, folder: Option<string>) => void;
  onCancel: () => void;
}

export default function NewWorkspaceDialog({ onAccept, onCancel }: NewWorkspaceDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(() => t("workspace.default_name"));
  const [isOnline, setIsOnline] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderHasContents, setFolderHasContents] = useState(false);
  const [existingWorkspaceId, setExistingWorkspaceId] = useState<string | null>(null);
  const [isChildOfWorkspace, setIsChildOfWorkspace] = useState(false);
  const connectionState = useStore((state) => state.connectionState);

  useEffect(() => {
    if (!selectedFolder) return;
    let active = true;
    setFolderHasContents(false);
    setExistingWorkspaceId(null);
    setIsChildOfWorkspace(false);

    readDir(selectedFolder).then(async (dir) => {
      if (dir.length > 0 && active) {
        setFolderHasContents(true);

        const result = await commands.getWorkspaceIdByFolder(selectedFolder);
        if (result.isOk() && active) {
          setExistingWorkspaceId(result.unwrap());
        }
      }

      const parentWorkspace = await findParentWorkspace(selectedFolder);
      if (parentWorkspace.isSome() && parentWorkspace.unwrap() !== selectedFolder && active) {
        setIsChildOfWorkspace(true);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedFolder]);

  function closeAndReset() {
    onCancel();
    setName(t("workspace.default_name"));
    setIsOnline(true);
    setSelectedFolder(null);
  }

  function handleSubmit() {
    onAccept(name, isOnline, Some(selectedFolder));
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setName(e.target.value);
  }

  function handleSelectOnline() {
    setIsOnline(true);
  }

  function handleSelectOffline() {
    setIsOnline(false);
  }

  function handleSelectFolder() {
    open({
      directory: true,
    }).then((folder) => {
      setSelectedFolder(folder);
    });
  }

  return (
    <Modal isOpen={true} onClose={closeAndReset}>
      <ModalContent>
        <ModalHeader>{t("workspace.create_or_open")}</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Input label={t("workspace.name")} value={name} onChange={handleNameChange} autoFocus />

            <div>
              <label className="block text-sm font-medium mb-2">{t("workspace.type")}</label>
              <div className="space-y-2">
                <div>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={isOnline}
                      onChange={handleSelectOnline}
                      className="mr-2"
                    />
                    <span>{t("workspace.online")}</span>
                  </label>
                </div>
                {isOnline && (
                  <div className="ml-6 text-sm">
                    {connectionState === ConnectionState.Offline && (
                      <span className="text-red-500">
                        {t("workspace.online_requires_connection")}
                      </span>
                    )}
                    {connectionState === ConnectionState.LoggedOut && (
                      <span className="text-red-500">{t("workspace.online_requires_login")}</span>
                    )}
                    {connectionState === ConnectionState.OutOfDate && (
                      <span className="text-red-500">{t("workspace.online_requires_update")}</span>
                    )}
                  </div>
                )}
                <div>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={!isOnline}
                      onChange={handleSelectOffline}
                      className="mr-2"
                    />
                    <div>{t("workspace.offline")}</div>
                  </label>
                </div>
                <div className="flex items-center">
                  <Tooltip content={t("workspace.select_folder_tooltip")}>
                    <Button
                      isIconOnly
                      isDisabled={isOnline}
                      className="mr-2"
                      onPress={handleSelectFolder}
                    >
                      <FolderIcon />
                    </Button>
                  </Tooltip>
                  <span
                    className={cn(
                      !isOnline ? "text-foreground" : "text-muted",
                      "overflow-x-auto",
                      "whitespace-nowrap",
                      "flex-grow",
                    )}
                  >
                    {!selectedFolder && t("workspace.no_folder_selected")}
                    {selectedFolder && selectedFolder}
                  </span>
                </div>
                {selectedFolder && isChildOfWorkspace && (
                  <div className="text-danger-500 mt-2">{t("workspace.child_folder_warning")}</div>
                )}
                {selectedFolder &&
                  folderHasContents &&
                  !existingWorkspaceId &&
                  !isChildOfWorkspace && (
                    <div className="text-danger-500 mt-2">{t("workspace.not_empty_warning")}</div>
                  )}
                {selectedFolder && folderHasContents && existingWorkspaceId && (
                  <div className="text-warning-500 mt-2">
                    {t("workspace.existing_workspace_notice")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onPress={closeAndReset} variant="flat">
            {t("common.cancel")}
          </Button>
          <Button
            onPress={handleSubmit}
            color="primary"
            isDisabled={
              !name ||
              (!isOnline && (!selectedFolder || isChildOfWorkspace)) ||
              (isOnline && connectionState !== ConnectionState.Online)
            }
          >
            {t("workspace.create")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
