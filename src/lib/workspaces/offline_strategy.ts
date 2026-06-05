import Workspace from "@/state/runbooks/workspace";
import WorkspaceStrategy, { DoFolderOp } from "./strategy";
import { exists, stat, readDir, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { join, resolve } from "@tauri-apps/api/path";
import { Option, Some, None, Result, Ok, Err } from "@binarymuse/ts-stdlib";
import { DialogBuilder } from "@/components/Dialogs/dialog";
import { uuidv7 } from "uuidv7";
import Runbook, { OfflineRunbook } from "@/state/runbooks/runbook";
import * as commands from "./commands";
import * as api from "@/api/api";
import { WorkspaceError } from "@/rs-bindings/WorkspaceError";
import { NodeApi } from "react-arborist";
import { TreeRowData } from "@/components/runbooks/List/TreeView";
import track_event from "@/tracking";
import { ydocToBlocknote } from "../ydoc_to_blocknote";
import * as Y from "yjs";
import { t } from "@/lib/i18n";
interface WorkspaceFolderError {
  fatal: boolean;
  type: "not_empty" | "not_directory" | "not_exist" | "not_writable" | "is_subdir_of_workspace";
  extra?: string;
}

export async function parentDir(folder: string): Promise<Option<string>> {
  const parent = await resolve(folder, "..");
  if (parent === folder) {
    return None;
  }
  return Some(parent);
}

export async function findParentWorkspace(folder: string): Promise<Option<string>> {
  try {
    const contents = await readDir(folder);
    if (
      // TODO[mkt]: Check for [workspace] section in the toml file???
      contents.some((file) => file.isFile && file.name.toLowerCase() === "atuin.toml")
    ) {
      return Some(folder);
    }
  } catch (err) {
    // Couldn't read the directory
  }

  const parent = await parentDir(folder);
  if (parent.isSome()) {
    return findParentWorkspace(parent.unwrap());
  }
  return None;
}

export async function checkWorkspaceFolder(folder: string): Promise<Option<WorkspaceFolderError>> {
  const doesExist = await exists(folder);
  if (!doesExist) {
    return Some<WorkspaceFolderError>({ fatal: true, type: "not_exist" });
  }

  const stats = await stat(folder);
  if (!stats.isDirectory) {
    return Some<WorkspaceFolderError>({ fatal: true, type: "not_directory" });
  }

  try {
    const testfile = "." + uuidv7();
    const testFilePath = await join(folder, testfile);
    await writeTextFile(testFilePath, testfile);
    const contents = await readTextFile(testFilePath);
    await remove(testFilePath);
    if (contents !== testfile) {
      return Some<WorkspaceFolderError>({ fatal: true, type: "not_writable" });
    }
  } catch (err) {
    return Some<WorkspaceFolderError>({ fatal: true, type: "not_writable" });
  }

  const dirContents = await readDir(folder);
  if (dirContents.length > 0) {
    return Some<WorkspaceFolderError>({
      fatal: false,
      type: "not_empty",
    });
  }

  const parentWorkspace = await findParentWorkspace(folder);
  if (parentWorkspace.isSome()) {
    return Some<WorkspaceFolderError>({
      fatal: false,
      type: "is_subdir_of_workspace",
      extra: parentWorkspace.unwrap(),
    });
  }

  return None;
}

export default class OfflineStrategy implements WorkspaceStrategy {
  constructor(private workspace: Workspace) {}

  async createWorkspace(): Promise<Result<Workspace, WorkspaceError>> {
    if (!this.workspace.get("folder")) {
      throw new Error(t("workspace.offline.error.no_folder_selected"));
    }

    const error = await checkWorkspaceFolder(this.workspace.get("folder")!);
    if (error.isSome()) {
      const type = error.unwrap().type;
      switch (type) {
        case "not_empty":
          if (this.workspace.get("id")) {
            // We'll be opening this existing workspace, so no need to prompt.
            break;
          }

          const notEmptyAnswer = await new DialogBuilder()
            .title(t("workspace.offline.dialog.not_empty.title"))
            .icon("warning")
            .message(t("workspace.offline.dialog.not_empty.message"))
            .action({ label: t("common.cancel"), value: "cancel", variant: "flat" })
            .action({ label: t("common.ok"), value: "ok", variant: "flat", color: "primary" })
            .build();
          if (notEmptyAnswer === "cancel") {
            return Err({
              type: "WorkspaceCreateError",
              data: {
                workspace_id: this.workspace.get("id")!,
                message: t("workspace.offline.error.creation_canceled"),
              },
            } as WorkspaceError);
          }
          break;
        case "is_subdir_of_workspace":
          const dir = error.unwrap().extra!;
          const parentAnswer = await new DialogBuilder()
            .title(t("workspace.offline.dialog.subdirectory.title"))
            .icon("warning")
            .message(t("workspace.offline.dialog.subdirectory.message", { dir }))
            .action({ label: t("common.cancel"), value: "cancel", variant: "flat" })
            .action({ label: t("common.ok"), value: "ok", variant: "flat", color: "primary" })
            .build();
          if (parentAnswer === "cancel") {
            return Err({
              type: "WorkspaceCreateError",
              data: {
                workspace_id: this.workspace.get("id")!,
                message: t("workspace.offline.error.creation_canceled"),
              },
            } as WorkspaceError);
          }
          break;
        case "not_directory":
          return Err({
            type: "WorkspaceCreateError",
            data: {
              workspace_id: this.workspace.get("id")!,
              message: t("workspace.offline.error.not_a_directory"),
            },
          } as WorkspaceError);
        case "not_exist":
          return Err({
            type: "WorkspaceCreateError",
            data: {
              workspace_id: this.workspace.get("id")!,
              message: t("workspace.offline.error.path_not_exist"),
            },
          } as WorkspaceError);
        case "not_writable":
          return Err({
            type: "WorkspaceCreateError",
            data: {
              workspace_id: this.workspace.get("id")!,
              message: t("workspace.offline.error.not_writable"),
            },
          } as WorkspaceError);
        default:
          exhaustiveCheck(type);
      }
    }

    try {
      await this.workspace.save();
    } catch (err) {
      if (err instanceof Error) {
        return Err({
          type: "WorkspaceCreateError",
          data: {
            workspace_id: this.workspace.get("id")!,
            message: err.message,
          },
        } as WorkspaceError);
      } else {
        return Err({
          type: "WorkspaceCreateError",
          data: {
            workspace_id: this.workspace.get("id")!,
            message: t("workspace.offline.error.unknown_save"),
          },
        } as WorkspaceError);
      }
    }

    let result = await commands.createWorkspace(
      this.workspace.get("folder")!,
      this.workspace.get("id")!,
      this.workspace.get("name")!,
    );

    if (result.isErr()) {
      return Err(result.unwrapErr());
    }

    track_event("workspace.create", {
      type: "offline",
    });

    return Ok(this.workspace);
  }

  async renameWorkspace(newName: string): Promise<Result<undefined, WorkspaceError>> {
    // Set the workspace name immediately as an "optimistic update."
    // TODO[mkt]: If a FS event comes through before we can flush to disk, the old name may briefly reappear.
    this.workspace.set("name", newName);
    await this.workspace.save();

    let result = await commands.renameWorkspace(this.workspace.get("id")!, newName);
    if (result.isErr()) {
      return Err(result.unwrapErr());
    }

    return Ok(undefined);
  }

  async deleteWorkspace(): Promise<void> {
    // `WorkspaceWatcher` unmount will handle unwatching the workspace
    this.workspace.del();
  }

  async importRunbookFromHub(
    runbookId: string,
    tag: string,
    activateRunbook: (runbookId: string) => Promise<void>,
  ): Promise<Result<string, WorkspaceError>> {
    const remoteRunbook = await api.getRunbookID(runbookId);

    let tagContent: any[];
    if (tag === "latest") {
      const yjsContent = await api.getRunbookYdoc(runbookId);
      const doc = new Y.Doc();
      if (yjsContent) {
        Y.applyUpdate(doc, yjsContent);
      }
      tagContent = await ydocToBlocknote(doc);
    } else {
      const snapshot = remoteRunbook.snapshots.find((s) => s.tag === tag);
      if (!snapshot) {
        return Err({
          type: "GenericWorkspaceError",
          data: {
            message: t("workspace.offline.error.tag_not_found", { tag }),
          },
        } as WorkspaceError);
      }
      const remoteSnapshot = await api.getSnapshotById(snapshot.id);
      tagContent = remoteSnapshot.content;
    }

    const rb = await OfflineRunbook.create(
      this.workspace,
      null,
      true,
      remoteRunbook.name,
      tagContent,
      runbookId,
    );
    if (rb === null) {
      return Err({
        type: "RunbookSaveError",
        data: {
          runbook_id: runbookId,
          message: t("workspace.offline.error.create_runbook_failed"),
        },
      } as WorkspaceError);
    }

    await activateRunbook(rb.id);

    track_event("runbooks.import", {
      workspaceType: "offline",
      forkedFrom: runbookId,
    });

    return Ok(rb.id);
  }

  async createRunbook(
    parentFolderId: string | null,
    activateRunbook: (runbookId: string) => Promise<void>,
  ): Promise<Result<string, WorkspaceError>> {
    let result = await Ok.from<Runbook | null, WorkspaceError>(
      OfflineRunbook.create(this.workspace, parentFolderId),
    );
    console.log("createRunbook result", result);
    if (result.isOk() && result.unwrap() === null) {
      result = Err({
        type: "WorkspaceCreateError",
        data: {
          workspace_id: this.workspace.get("id")!,
          message: t("workspace.offline.error.create_runbook_failed"),
        },
      } as WorkspaceError);
    }

    if (result.isErr()) {
      const err = result.unwrapErr();
      let message = t("workspace.offline.error.create_runbook_failed");
      if ("message" in err.data) {
        message = t("workspace.offline.error.create_runbook_failed_detail", {
          message: err.data.message,
        });
      }
      new DialogBuilder()
        .title(t("workspace.offline.dialog.create_runbook_error.title"))
        .message(message)
        .action({ label: t("common.ok"), value: "ok" })
        .build();
      return Err(err);
    }

    const runbook = result.unwrap();
    await activateRunbook(runbook!.id);

    track_event("runbooks.create", {
      workspaceType: "offline",
    });

    return Ok(runbook!.id);
  }

  async deleteRunbook(
    _doFolderOp: DoFolderOp,
    runbookId: string,
  ): Promise<Result<undefined, WorkspaceError>> {
    return commands.deleteRunbook(this.workspace.get("id")!, runbookId);
  }

  async createFolder(
    _doFolderOp: DoFolderOp,
    parentId: string | null,
    name: string,
  ): Promise<Result<string, WorkspaceError>> {
    return commands.createFolder(this.workspace.get("id")!, parentId, name);
  }

  async renameFolder(
    _doFolderOp: DoFolderOp,
    folderId: string,
    newName: string,
  ): Promise<Result<undefined, WorkspaceError>> {
    let result = await commands.renameFolder(this.workspace.get("id")!, folderId, newName);
    if (result.isErr()) {
      let err = result.unwrapErr();
      if (err.type === "FolderRenameError") {
        return Err({
          type: "FolderRenameError",
          data: {
            workspace_id: this.workspace.get("id")!,
            folder_id: folderId,
            message: t("workspace.offline.error.rename_folder_failed_detail", {
              message: err.data.message,
            }),
          },
        } as WorkspaceError);
      } else {
        return Err({
          type: "FolderRenameError",
          data: {
            workspace_id: this.workspace.get("id")!,
            folder_id: folderId,
            message: t("workspace.offline.error.rename_folder_failed"),
          },
        } as WorkspaceError);
      }
    }

    return Ok(undefined);
  }

  async deleteFolder(
    _doFolderOp: DoFolderOp,
    folderId: string,
    _descendents: NodeApi<TreeRowData>[],
  ): Promise<Result<undefined, WorkspaceError>> {
    const result = await commands.deleteFolder(this.workspace.get("id")!, folderId);
    if (result.isErr()) {
      let err = result.unwrapErr();
      if (err.type === "FolderDeleteError") {
        return Err({
          type: "FolderDeleteError",
          data: {
            workspace_id: this.workspace.get("id")!,
            folder_id: folderId,
            message: t("workspace.offline.error.delete_folder_failed_detail", {
              message: err.data.message,
            }),
          },
        } as WorkspaceError);
      } else {
        return Err({
          type: "FolderDeleteError",
          data: {
            workspace_id: this.workspace.get("id")!,
            folder_id: folderId,
            message: t("workspace.offline.error.delete_folder_failed"),
          },
        } as WorkspaceError);
      }
    }

    return Ok(undefined);
  }

  async moveItems(
    _doFolderOp: DoFolderOp,
    ids: string[],
    parentId: string | null,
    _index: number,
  ): Promise<Result<undefined, WorkspaceError>> {
    return commands.moveItems(this.workspace.get("id")!, ids, parentId);
  }
}

function exhaustiveCheck(value: never): never {
  throw new Error(`Unhandled value: ${value}`);
}
