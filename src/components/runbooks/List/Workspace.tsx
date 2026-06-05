import Workspace from "@/state/runbooks/workspace";
import useWorkspaceFolder from "@/lib/hooks/useWorkspaceFolder";
import TreeView, { SortBy, TreeRowData } from "./TreeView";
import { JSX, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { NodeApi, TreeApi } from "react-arborist";
import { useStore } from "@/state/store";
import {
  createFolderMenu,
  createMultiItemMenu,
  createRunbookMenu,
  createWorkspaceMenu,
} from "./menus";
import { cn } from "@/lib/utils";
import { DialogBuilder } from "@/components/Dialogs/dialog";
import InlineInput from "./TreeView/InlineInput";
import { SharedStateManager } from "@/lib/shared_state/manager";
import WorkspaceFolder, { ArboristTree, Folder } from "@/state/runbooks/workspace_folders";
import { AtuinSharedStateAdapter } from "@/lib/shared_state/adapter";
import { useDrop } from "react-dnd";
import { actions } from "react-arborist/dist/module/state/dnd-slice";
import { ChevronDownIcon, ChevronRightIcon, CircleAlertIcon, CloudOffIcon } from "lucide-react";
import { DirEntry } from "@/lib/workspaces/commands";
import { getWorkspaceStrategy } from "@/lib/workspaces/strategy";
import { useQuery } from "@tanstack/react-query";
import { localWorkspaceInfo } from "@/lib/queries/workspaces";
import { WorkspaceRunbook } from "@/rs-bindings/WorkspaceRunbook";
import { Button } from "@heroui/react";
import ConvertWorkspaceDialog from "./ConvertWorkspaceDialog";
import { useRunbook } from "@/lib/useRunbook";
import { useCurrentTabRunbookId } from "@/lib/hooks/useCurrentTab";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import * as commands from "@/lib/workspaces/commands";
import WorkspaceManager from "@/lib/workspaces/manager";
import { useTranslation, t as i18n_t } from "@/lib/i18n";
//there is a standalone function cannot simply use t type, so create a alias

interface WorkspaceProps {
  workspace: Workspace;
  focused: boolean;
  sortBy: SortBy;
  onActivateRunbook: (runbookId: string) => void;
  onStartCreateRunbook: (workspaceId: string, parentFolderId: string | null) => void;
  onStartCreateWorkspace: () => void;
  onStartDeleteRunbook: (workspaceId: string, runbookId: string) => void;
  onStartMoveItemsToWorkspace: (
    items: string[],
    oldWorkspaceId: string,
    newWorkspaceId: string,
    newParentFolderId: string | null,
  ) => void;
}

type WorkspaceRenameAction =
  | {
      type: "start_rename";
      currentName: string;
    }
  | {
      type: "cancel_rename";
    }
  | {
      type: "confirm_rename";
      newName: string;
    };

type WorkspaceRenameState = {
  isEditing: boolean;
  newName: string;
};

function workspaceNameReducer(
  state: WorkspaceRenameState,
  action: WorkspaceRenameAction,
): WorkspaceRenameState {
  switch (action.type) {
    case "start_rename":
      return {
        ...state,
        isEditing: true,
        newName: action.currentName,
      };
    case "cancel_rename":
      return {
        ...state,
        isEditing: false,
      };
    case "confirm_rename":
      return {
        ...state,
        isEditing: false,
        newName: action.newName,
      };
  }
}

function transformDirEntriesToArboristTree(
  entries: DirEntry[],
  basePath: string,
  runbooks: { [key in string]?: WorkspaceRunbook },
): ArboristTree {
  entries = entries.filter((entry) => {
    if (entry.is_dir) {
      return true;
    }

    return entry.path.endsWith(".atrb");
  });

  // folders first, then files
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.is_dir && !b.is_dir) return -1;
    if (!a.is_dir && b.is_dir) return 1;
    return a.name.localeCompare(b.name);
  });

  const rootItems: ArboristTree = [];

  function findOrCreateFolder(pathParts: string[]): {
    id: string;
    name: string;
    type: "folder";
    children: ArboristTree;
  } {
    if (pathParts.length === 0) {
      throw new Error("Cannot create folder with empty path");
    }

    // Start from root and traverse down the path
    let currentLevel = rootItems;
    let currentPath = "";

    for (let i = 0; i < pathParts.length; i++) {
      const folderName = pathParts[i];
      currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

      // Look for existing folder at this level
      let folder = currentLevel.find(
        (item) => item.type === "folder" && item.name === folderName,
      ) as { id: string; name: string; type: "folder"; children: ArboristTree } | undefined;

      if (!folder) {
        // Create new folder
        const folderId = `${basePath}/${currentPath}`;
        folder = {
          id: folderId,
          name: folderName,
          type: "folder",
          children: [],
        };
        currentLevel.push(folder);
      }

      // If this is the last part, return the folder
      if (i === pathParts.length - 1) {
        return folder;
      }

      // Move to next level (children of this folder)
      currentLevel = folder.children;
    }

    throw new Error("Unexpected end of path traversal");
  }

  for (const entry of sortedEntries) {
    // Calculate relative path from base path
    const relativePath = entry.path.replace(basePath, "").replace(/^\/+/, "");
    const pathParts = relativePath.split("/").filter((part) => part.length > 0);

    if (entry.is_dir) {
      // Check if folder already exists
      const existingFolder = findOrCreateFolder(pathParts);
      if (existingFolder.id === entry.path) {
        // This is the same folder we're trying to create, skip
        continue;
      }

      // Create folder entry
      const folder = {
        id: entry.path,
        name: entry.name,
        type: "folder" as const,
        children: [],
      };

      // Add to parent folder if it exists
      if (pathParts.length > 1) {
        const parentPathParts = pathParts.slice(0, -1);
        const parentFolder = findOrCreateFolder(parentPathParts);
        parentFolder.children.push(folder);
      } else {
        rootItems.push(folder);
      }
    } else {
      // Find runbook with matching path
      const runbook = Object.values(runbooks).find((r) => r!.path === entry.path);
      if (!runbook) {
        continue;
      }

      const file = {
        id: runbook.id,
        name: runbook.name,
        type: "runbook" as const,
      };

      // Add to parent folder if it exists
      if (pathParts.length > 1) {
        const parentPathParts = pathParts.slice(0, -1);
        const parentFolder = findOrCreateFolder(parentPathParts);
        parentFolder.children.push(file);
      } else {
        rootItems.push(file);
      }
    }
  }

  return rootItems;
}

export default function WorkspaceComponent(props: WorkspaceProps) {
  const { t } = useTranslation();
  const treeRef = useRef<TreeApi<TreeRowData> | null>(null);
  const [showConvertWorkspaceDialog, setShowConvertWorkspaceDialog] = useState(false);

  const currentWorkspaceId = useStore((state) => state.currentWorkspaceId);
  const currentTabRunbookId = useCurrentTabRunbookId();
  const currentTabRunbook = useRunbook(currentTabRunbookId || undefined);
  const setCurrentWorkspaceId = useStore((state) => state.setCurrentWorkspaceId);
  const toggleFolder = useStore((state) => state.toggleFolder);
  const toggleWorkspaceVisibility = useStore((state) => state.toggleWorkspaceVisibility);
  const folderState = useStore((state) => state.folderState);
  const hiddenWorkspaces = useStore((state) => state.hiddenWorkspaces);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [workspaceNameState, dispatchWorkspaceName] = useReducer(workspaceNameReducer, {
    isEditing: false,
    newName: props.workspace.get("name")!,
  });

  const { data: workspaceInfo } = useQuery(localWorkspaceInfo(props.workspace.get("id")!));
  const isError = useMemo(() => {
    return workspaceInfo.map((info) => info.isErr()).unwrapOr(false);
  }, [workspaceInfo]);

  const [workspaceFolder, doFolderOp] = useWorkspaceFolder(props.workspace.get("id")!);

  const arboristData = useMemo(() => {
    if (props.workspace.isOnline() || props.workspace.isLegacyHybrid()) {
      return workspaceFolder.toArborist();
    } else {
      if (workspaceInfo.isNone() || workspaceInfo.unwrap().isErr()) {
        return [];
      }

      const info = workspaceInfo.unwrap().unwrap();
      return transformDirEntriesToArboristTree(
        info.entries,
        props.workspace.get("folder")!,
        info.runbooks,
      );
    }
  }, [workspaceFolder, workspaceInfo]);

  useEffect(() => {
    // Update offline workspaces from the FS info
    if (
      workspaceInfo.isNone() ||
      workspaceInfo.unwrap().isErr() ||
      props.workspace.get("id") !== workspaceInfo.unwrap().unwrap().id ||
      props.workspace.isOnline() ||
      props.workspace.isLegacyHybrid()
    ) {
      return;
    }

    const info = workspaceInfo.unwrap().unwrap();
    if (props.workspace.get("name") !== info.name) {
      props.workspace.set("name", info.name);
      props.workspace.save();
    }
  }, [workspaceInfo, props.workspace.get("id")]);

  useEffect(() => {
    // If the current runbook ID changes, update the selection.
    if (!treeRef.current) return;
    if (!currentTabRunbook) return;
    if (currentTabRunbook.workspaceId !== props.workspace.get("id")) return;

    setCurrentItemId(currentTabRunbook.id);
    const element = document.getElementById(`${currentTabRunbook.id}-runbook-tree-row`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentTabRunbook?.id]);

  // ***** UTILITIES *****

  function focusWorkspace() {
    setCurrentWorkspaceId(props.workspace.get("id")!);
  }

  function folderInfo(folderId: string | null): {
    node: NodeApi<TreeRowData> | null;
    descendents: {
      nodes: NodeApi<TreeRowData>[];
      folders: number;
      runbooks: number;
      total: number;
    };
  } {
    let node = treeRef.current!.get(folderId);

    if (props.workspace.isOnline() || props.workspace.isLegacyHybrid()) {
      const descendants = workspaceFolder.getDescendants(folderId);
      const descendantsCount = descendants.reduce(
        (acc, child) => {
          if (child.getData().unwrap().type === "folder") {
            acc.folders++;
          } else {
            acc.runbooks++;
          }

          return acc;
        },
        { folders: 0, runbooks: 0 },
      );

      return {
        node: node,
        descendents: {
          nodes: descendants
            .map((child) => treeRef.current!.get(child.id() as string))
            .filter((item) => !!item),
          folders: descendantsCount.folders,
          runbooks: descendantsCount.runbooks,
          total: descendantsCount.folders + descendantsCount.runbooks,
        },
      };
    } else {
      const getDescendentInfo = (node: NodeApi<TreeRowData> | null) => {
        if (!node) {
          return {
            nodes: [],
            folders: 0,
            runbooks: 0,
            total: 0,
          };
        }

        const info = {
          nodes: [] as NodeApi<TreeRowData>[],
          folders: 0,
          runbooks: 0,
          total: 0,
        };

        for (const child of node.children || []) {
          info.nodes.push(child);
          if (child.data.type === "folder") {
            info.folders++;
            const childInfo = getDescendentInfo(child);
            info.nodes.push(...childInfo.nodes);
            info.folders += childInfo.folders;
            info.runbooks += childInfo.runbooks;
            info.total += childInfo.total;
          } else {
            info.runbooks++;
          }
          info.total++;
        }

        return info;
      };

      if (!node) {
        node = treeRef.current!.root;
      }

      return {
        node: node,
        descendents: getDescendentInfo(node),
      };
    }
  }

  // **** HANDLERS *****

  async function handleActivateItem(itemId: string) {
    setCurrentItemId(itemId);
    const node = treeRef.current!.get(itemId);

    if (node?.data.type === "runbook") {
      props.onActivateRunbook(itemId);
    }
  }

  async function handleNewRunbook(parentFolderId: string | null) {
    props.onStartCreateRunbook(props.workspace.get("id")!, parentFolderId);
  }

  async function handleRenameFolder(folderId: string, newName: string) {
    const strategy = getWorkspaceStrategy(props.workspace);
    let result = await strategy.renameFolder(doFolderOp, folderId, newName);

    let message;
    if (result.isErr()) {
      const err = result.unwrapErr();
      if (err.type === "FolderRenameError") {
        message = err.data.message;
      }
    } else {
      message = t("workspace.error.unknown_rename_folder");
    }

    if (result.isErr()) {
      new DialogBuilder()
        .title(t("workspace.error.rename_folder"))
        .icon("error")
        .message(message)
        .action({ label: t("common.ok"), value: "ok" })
        .build();
    }
  }

  async function handleNewFolder(parentId: string | null) {
    const strategy = getWorkspaceStrategy(props.workspace);
    let result = await strategy.createFolder(doFolderOp, parentId, "New Folder");

    if (result.isErr()) {
      const err = result.unwrapErr();
      let message = t("workspace.error.unknown_create_folder");
      if ("message" in err.data) {
        message = err.data.message;
      }

      new DialogBuilder()
        .title(t("workspace.error.create_folder"))
        .message(message)
        .action({ label: t("common.ok"), value: "ok" })
        .build();
      return;
    }

    const id = result.unwrap();
    let node: NodeApi<TreeRowData> | null = null;
    const start = Date.now();
    // Wait up to 2 seconds for the folder to appear in the tree
    // and automatically start the rename when it does.
    while (!node && Date.now() - start < 2000) {
      node = treeRef.current!.get(id);
      if (!node) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    if (node) {
      node.edit();
    }
  }

  /**
   * If the folder has descendents, prompt the user before deletion.
   */
  async function onStartDeleteFolder(folderId: string) {
    const { node, descendents } = folderInfo(folderId);
    const folderName = node?.data.name;
    const snippet = (
      <span>
        {t("delete.folder_ref")} <b>{folderName}</b>
      </span>
    );

    if (descendents.total > 0) {
      const confirm = await confirmDeleteFolder(
        !props.workspace.isOnline(),
        { node, descendents },
        snippet,
        true,
      );
      if (confirm === "yes") {
        handleDeleteFolder(folderId, descendents.nodes);
      }
    } else {
      handleDeleteFolder(folderId, descendents.nodes);
    }
  }

  async function handleDeleteFolder(folderId: string, descendents: NodeApi<TreeRowData>[]) {
    const strategy = getWorkspaceStrategy(props.workspace);
    const result = await strategy.deleteFolder(doFolderOp, folderId, descendents);

    if (result.isErr()) {
      const err = result.unwrapErr();
      if (err.type === "FolderDeleteError") {
        new DialogBuilder()
          .title(t("workspace.error.delete_folder"))
          .message(err.data.message)
          .action({ label: t("common.ok"), value: "ok" })
          .build();
      } else {
        new DialogBuilder()
          .title(t("workspace.error.delete_folder"))
          .message(
            t("workspace.error.unknown_delete_folder"),
          )
          .action({ label: t("common.ok"), value: "ok" })
          .build();
      }
    }
  }

  async function handleMoveItems(
    ids: string[],
    sourceWorkspaceId: string,
    parentId: string | null,
    index: number,
  ) {
    if (ids.length === 0) {
      return;
    }

    if (sourceWorkspaceId === props.workspace.get("id")!) {
      let selectedItemNodes = ids.map((id) => {
        return treeRef.current!.get(id)!;
      });

      const offset = selectedItemNodes.filter(
        (node) => node.childIndex <= index && node.parent?.id === parentId,
      ).length;
      index -= offset;

      const strategy = getWorkspaceStrategy(props.workspace);
      const result = await strategy.moveItems(doFolderOp, ids, parentId, index);

      if (result.isErr()) {
        const err = result.unwrapErr();
        let message = t("workspace.error.unknown_move_items");
        if ("message" in err.data) {
          message = err.data.message;
        }

        new DialogBuilder()
          .title(t("workspace.error.move_items"))
          .message(message)
          .action({ label: t("common.ok"), value: "ok" })
          .build();
      }
    } else {
      // Moving items between workspaces via drag and drop currently disabled
      return;
    }
  }

  async function handleDeleteWorkspace() {
    const strategy = getWorkspaceStrategy(props.workspace);
    await strategy.deleteWorkspace();
  }

  async function handleRenameWorkspace(newName: string) {
    dispatchWorkspaceName({ type: "confirm_rename", newName });

    const strategy = getWorkspaceStrategy(props.workspace);
    await strategy.renameWorkspace(newName);
  }

  function handleToggleFolder(nodeId: string) {
    toggleFolder(props.workspace.get("id")!, nodeId);
  }

  // ***** CONTEXT MENUS *****

  async function handleContextMenu(evt: React.MouseEvent<HTMLDivElement>, itemId: string) {
    evt.preventDefault();
    evt.stopPropagation();

    focusWorkspace();

    if (props.workspace.isLegacyHybrid()) {
      return;
    }

    let workspaces = await Workspace.all();
    workspaces = workspaces.filter((ws) => ws.get("online") === props.workspace.get("online"));

    let workspaceFolders: { id: string; folder: ArboristTree }[] = [];
    if (props.workspace.isOnline()) {
      workspaceFolders = await Promise.all(
        workspaces.map(async (ws) => {
          const stateId = `workspace-folder:${ws.get("id")}`;
          const manager = SharedStateManager.getInstance<Folder>(
            stateId,
            new AtuinSharedStateAdapter(stateId),
          );
          const data = await manager.getDataOnce();
          const folder = WorkspaceFolder.fromJS(data);
          Rc.dispose(manager);
          return { id: ws.get("id")!, folder: folder.toArborist() };
        }),
      );
    } else {
      const manager = WorkspaceManager.getInstance();
      workspaceFolders = workspaces.map((ws) => {
        const infoOpt = manager.getWorkspaceInfo(ws.get("id")!);
        if (infoOpt.isNone() || infoOpt.unwrap().isErr()) {
          return { id: ws.get("id")!, folder: [] };
        }

        const info = infoOpt.unwrap().unwrap();

        return {
          id: ws.get("id")!,
          folder: transformDirEntriesToArboristTree(info.entries, ws.get("folder")!, info.runbooks),
        };
      });
    }
    const userOrgs = useStore.getState().userOrgs.map((org) => ({
      name: org.name,
      id: org.id,
      workspaces: workspaces
        .filter((ws) => ws.get("orgId") === org.id)
        .map((ws) => ({
          workspace: ws,
          folder: workspaceFolders.find((folder) => folder.id === ws.get("id"))?.folder ?? [],
        })),
    }));
    let orgs = [
      {
        name: i18n_t("common.personal"),
        id: null,
        workspaces: workspaces
          .filter((ws) => ws.get("orgId") === null)
          .map((ws) => ({
            workspace: ws,
            folder: workspaceFolders.find((folder) => folder.id === ws.get("id"))?.folder ?? [],
          })),
      },
      ...userOrgs,
    ];

    if (props.workspace.get("orgId") !== null) {
      orgs = orgs.filter((org) => org.id === props.workspace.get("orgId"));
    }

    // If only one item is selected, we show the menu for the item that was right clicked.
    // If multiple items are selected, we show the menu for the whole selection, no matter which node was right clicked.
    const selectedNodes = treeRef.current!.selectedNodes;
    if (selectedNodes.length <= 1) {
      const node = treeRef.current!.get(itemId);
      if (node?.data.type === "folder") {
        const menu = await createFolderMenu(
          orgs,
          props.workspace.get("orgId")!,
          props.workspace.get("id")!,
          {
            onNewFolder: () => handleNewFolder(node.data.id),
            onRenameFolder: () => node.edit(),
            onDeleteFolder: () => onStartDeleteFolder(node.data.id),
            onNewRunbook: () => handleNewRunbook(node.data.id),
            onMoveToWorkspace: (newWorkspaceId, newParentId) => {
              props.onStartMoveItemsToWorkspace(
                [node.id],
                props.workspace.get("id")!,
                newWorkspaceId,
                newParentId,
              );
            },
          },
        );
        await menu.popup();
        menu.close();
      } else if (node?.data.type === "runbook") {
        const menu = await createRunbookMenu(
          orgs,
          props.workspace.get("orgId")!,
          props.workspace.get("id")!,
          {
            onDeleteRunbook: () =>
              props.onStartDeleteRunbook(props.workspace.get("id")!, node.data.id),
            onMoveToWorkspace: (targetWorkspaceId, targetParentId) => {
              props.onStartMoveItemsToWorkspace(
                [node.id],
                props.workspace.get("id")!,
                targetWorkspaceId,
                targetParentId,
              );
            },
          },
        );
        await menu.popup();
        menu.close();
      }
    } else {
      // more than 1 item selected
      const menu = await createMultiItemMenu(
        selectedNodes.map((node) => node.id),
        orgs,
        props.workspace.get("orgId")!,
        props.workspace.get("id")!,
        {
          onMoveToWorkspace: (targetWorkspaceId, targetParentId) => {
            props.onStartMoveItemsToWorkspace(
              selectedNodes.map((node) => node.id),
              props.workspace.get("id")!,
              targetWorkspaceId,
              targetParentId,
            );
          },
        },
      );
      await menu.popup();
      menu.close();
    }
  }

  const handleBaseContextMenu = async (evt: React.MouseEvent<HTMLDivElement>) => {
    evt.preventDefault();
    evt.stopPropagation();

    if (isError || props.workspace.isLegacyHybrid()) {
      return;
    }

    focusWorkspace();

    const menu = await createWorkspaceMenu({
      onNewFolder: () => {
        handleNewFolder(null);
      },
      onNewRunbook: () => {
        handleNewRunbook(null);
      },
      onNewWorkspace: () => {
        props.onStartCreateWorkspace();
      },
      onRenameWorkspace: () => {
        dispatchWorkspaceName({ type: "start_rename", currentName: props.workspace.get("name")! });
      },
      onDeleteWorkspace: async () => {
        const { node, descendents } = folderInfo(null);
        const snippet = (
          <span>
            {t("delete.workspace_ref")} <b>{props.workspace.get("name")}</b>
          </span>
        );

        if (descendents.total > 0) {
          const confirm = await confirmDeleteFolder(
            !props.workspace.isOnline(),
            { node, descendents },
            snippet,
          );
          if (confirm === "yes") {
            handleDeleteWorkspace();
          }
        } else {
          handleDeleteWorkspace();
        }
      },
      onOpenFolder: props.workspace.get("folder")
        ? () => {
            if (props.workspace.get("folder")) {
              openPath(props.workspace.get("folder")!);
            }
          }
        : undefined,
    });

    await menu.popup();
    menu.close();
  };

  const [_collectedProps, dropRef] = useDrop(() => ({
    accept: "NODE", // this is what react-arborist uses to tag its nodes
    drop: (_item, _monitor) => {
      const { lastSidebarDragInfo, setLastSidebarDragInfo } = useStore.getState();

      // When react-arborist handles a drag and drop operation, we clear the lastSidebarDragInfo
      // immediately; so, if we make it this far, it means it was dropped onto an empty tree or some
      // non-valid dom element that is still within this workspace.
      if (lastSidebarDragInfo) {
        setLastSidebarDragInfo(undefined);
        const { itemIds, sourceWorkspaceId } = lastSidebarDragInfo;
        // HACK [mkt]: We need to manually dispatch a dragEnd to stop the drag indicator from showing.
        treeRef.current?.store.dispatch(actions.dragEnd());
        handleMoveItems(itemIds, sourceWorkspaceId, null, 0);
      }
    },
  }));

  async function handleLocateWorkspace() {
    const folder = await open({
      directory: true,
    });

    if (!folder) {
      return;
    }

    const id = await commands.getWorkspaceIdByFolder(folder);
    if (id.isOk() && id.unwrap() === props.workspace.get("id")!) {
      props.workspace.set("folder", folder);
      props.workspace.save();
    } else if (!id.isOk()) {
      let err = id.unwrapErr();
      let message = t("workspace.error.unknown_read_directory");
      if ("message" in err.data) {
        message = err.data.message;
      }

      await new DialogBuilder()
        .title(t("workspace.error.directory_read_error"))
        .message(message)
        .action({ label: t("common.ok"), value: "ok" })
        .build();
    } else if (id.isOk() && id.unwrap() !== props.workspace.get("id")!) {
      await new DialogBuilder()
        .title(t("workspace.error.id_mismatch"))
        .message(t("workspace.error.id_mismatch_message"))
        .action({ label: t("common.ok"), value: "ok" })
        .build();
    }
  }

  function showWorkspaceError(errorType: string, errorText: string, helpText?: string) {
    new DialogBuilder()
      .title(errorType)
      .icon("error")
      .message(
        <div>
          <p>{errorText}</p>
          {helpText && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("workspace.error.tip", { helpText })}
            </p>
          )}
        </div>,
      )
      .action({ label: t("common.ok"), value: "ok" })
      .build();
  }

  let errorElem = <></>;
  if (!props.workspace.isOnline() && workspaceInfo.map((info) => info.isErr()).unwrapOr(false)) {
    let error = workspaceInfo.unwrap().unwrapErr();
    let errorType;
    let errorText;
    let helpText: string | undefined;

    switch (error.type) {
      case "WorkspaceReadError":
        errorType = t("workspace.error.read_error");
        errorText = t("workspace.error.read_error_description", {
          path: error.data.path,
          message: error.data.message,
        });
        helpText = t("workspace.error.read_error_help");
        break;
      case "WorkspaceNotWatched":
        errorType = t("workspace.error.not_watched");
        errorText = t("workspace.error.not_watched_description", {
          workspace_id: error.data.workspace_id,
        });
        break;
      case "WorkspaceAlreadyWatched": {
        errorType = t("workspace.error.already_watched");
        errorText = t("workspace.error.already_watched_description", {
          workspace_id: error.data.workspace_id,
        });
        break;
      }
      case "WatchError":
        errorType = t("workspace.error.watch_error");
        errorText = t("workspace.error.watch_error_description", {
          message: error.data.message,
        });
        helpText = t("workspace.error.watch_error_help");
        break;
      default:
        errorType = t("common.unknown_error");
        errorText = t("workspace.error.unknown_description", {
          message: "message" in error.data ? error.data.message : error.type,
        });
    }

    async function confirmDeleteWorkspace() {
      const answer = await new DialogBuilder<"yes" | "no">()
        .title(t("workspace.delete.title"))
        .message(t("workspace.delete.confirm"))
        .action({ label: i18n_t("common.delete"), value: "yes", variant: "flat", color: "danger" })
        .action({ label: i18n_t("common.cancel"), value: "no", variant: "flat" })
        .build();

      if (answer === "yes") {
        handleDeleteWorkspace();
      }
    }

    if (error.type === "WorkspaceReadError") {
      errorElem = (
        <div className="flex flex-col gap-2 items-center mb-2">
          <div
            className="border rounded-md w-full p-3 flex gap-2 cursor-pointer"
            onClick={() => showWorkspaceError(errorType, errorText, helpText)}
          >
            <div>
              <CircleAlertIcon className="w-8 h-8 stroke-gray-500 dark:stroke-gray-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("workspace.error.folder_unreadable")}
            </p>
          </div>
          <div className="flex flex-row flex-wrap gap-2 justify-center">
            <Button variant="flat" size="sm" color="primary" onPress={handleLocateWorkspace}>
              {t("workspace.error.locate_workspace")}
            </Button>
            <Button variant="flat" size="sm" color="danger" onPress={confirmDeleteWorkspace}>
              {t("workspace.delete.title")}
            </Button>
          </div>
        </div>
      );
    } else {
      errorElem = (
        <div className="flex flex-col gap-2 mb-2">
          <div
            className="border rounded-md w-full p-3 flex gap-2 cursor-pointer"
            onClick={() => showWorkspaceError(errorType, errorText, helpText)}
          >
            <div>
              <CircleAlertIcon className="w-8 h-8 stroke-gray-500 dark:stroke-gray-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("workspace.error.details_prompt")}
            </p>
          </div>
          <div className="flex flex-row flex-wrap gap-2 justify-center">
            <Button variant="flat" size="sm" color="danger" onPress={confirmDeleteWorkspace}>
              {t("workspace.delete.title")}
            </Button>
          </div>
        </div>
      );
    }
  }

  let migrationElem = <></>;
  if (props.workspace.isLegacyHybrid()) {
    migrationElem = (
      <div className="border rounded-md w-full p-3 flex flex-col gap-2 cursor-pointer">
        <div className="flex flex-row gap-2">
          <CircleAlertIcon className="w-8 h-8 stroke-gray-500 dark:stroke-gray-400 min-w-8" />
          <p className="text-sm text-muted-foreground">
            {t("workspace.legacy_hybrid.description")}
          </p>
        </div>

        <Button
          variant="flat"
          size="sm"
          color="primary"
          onPress={() => {
            setShowConvertWorkspaceDialog(true);
          }}
        >
          {t("workspace.legacy_hybrid.convert")}
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={dropRef as any}
      className={cn("border rounded-md w-full", {
        "border-1 border-blue-500": currentWorkspaceId === props.workspace.get("id"),
      })}
      onClick={focusWorkspace}
      onContextMenu={handleBaseContextMenu}
    >
      {workspaceNameState.isEditing ? (
        <div className="p-1 mb-2">
          <InlineInput
            value={workspaceNameState.newName}
            onSubmit={handleRenameWorkspace}
            onCancel={() => dispatchWorkspaceName({ type: "cancel_rename" })}
            className="w-full"
          />
        </div>
      ) : (
        <div
          className="flex justify-between p-1 mb-2 bg-muted text-sm font-semibold whitespace-nowrap text-ellipsis overflow-x-hidden rounded-t-md"
          title={`${props.workspace.get("name")}${
            props.workspace.isOnline() ? "" : " (Offline Workspace)"
          }`}
          onDoubleClick={() => {
            if (!isError) {
              dispatchWorkspaceName({
                type: "start_rename",
                currentName: props.workspace.get("name")!,
              });
            }
          }}
        >
          <span className="shrink whitespace-nowrap text-ellipsis overflow-x-hidden">
            {hiddenWorkspaces[props.workspace.get("id")!] ? (
              <ChevronRightIcon
                className="w-4 h-4 mt-[2px] mr-1 inline-block"
                onClick={() => toggleWorkspaceVisibility(props.workspace.get("id")!)}
              />
            ) : (
              <ChevronDownIcon
                className="w-4 h-4 mt-[2px] mr-1 inline-block"
                onClick={() => toggleWorkspaceVisibility(props.workspace.get("id")!)}
              />
            )}
            <span className="">{props.workspace.get("name")}</span>
          </span>
          {props.workspace.get("online") === 1 ? (
            <span />
          ) : (
            <CloudOffIcon className="w-4 h-4 mt-[2px] flex-none" />
          )}
        </div>
      )}
      {hiddenWorkspaces[props.workspace.get("id")!] ? null : isError ? (
        errorElem
      ) : (
        <>
          {migrationElem}
          {showConvertWorkspaceDialog && (
            <ConvertWorkspaceDialog
              workspace={props.workspace}
              onClose={() => setShowConvertWorkspaceDialog(false)}
            />
          )}
          <TreeView
            workspaceId={props.workspace.get("id")!}
            workspaceOnline={props.workspace.isOnline()}
            workspaceLegacyHybrid={props.workspace.isLegacyHybrid()}
            onTreeApiReady={(api) => (treeRef.current = api)}
            data={arboristData as any}
            sortBy={props.sortBy}
            selectedItemId={currentItemId}
            initialOpenState={folderState[props.workspace.get("id")!] || {}}
            onActivateItem={handleActivateItem}
            onRenameFolder={handleRenameFolder}
            onNewFolder={handleNewFolder}
            onMoveItems={handleMoveItems}
            onContextMenu={handleContextMenu}
            onToggleFolder={handleToggleFolder}
          />
        </>
      )}
    </div>
  );
}

async function confirmDeleteFolder(
  isFsWorkspace: boolean,
  info: {
    node: NodeApi<TreeRowData> | null;
    descendents: {
      folders: number;
      runbooks: number;
      total: number;
    };
  },
  idSnippet: JSX.Element,
  willDeleteFiles: boolean = false,
): Promise<"yes" | "no"> {
  const { descendents } = info;

  let countSnippet: React.ReactNode | null = null;
  if (descendents.folders === 0 && descendents.runbooks > 0) {
    countSnippet = (
      <strong className="text-danger">
        {descendents.runbooks}{" "}
        {descendents.runbooks === 1
          ? i18n_t("root.move_items.runbook")
          : i18n_t("root.move_items.runbooks")}
      </strong>
    );
  } else if (descendents.folders > 0 && descendents.runbooks === 0) {
    countSnippet = (
      <strong className="text-danger">
        {descendents.folders}{" "}
        {descendents.folders === 1
          ? i18n_t("workspace_tree.count.subfolder_one", { count: 1 }).replace("{{count}}", "1")
          : i18n_t("workspace_tree.count.subfolder_many", { count: descendents.folders })}
      </strong>
    );
  } else if (descendents.folders > 0 && descendents.runbooks > 0) {
    countSnippet = (
      <>
        <strong className="text-danger">
          {descendents.folders}{" "}
          {descendents.folders === 1
            ? i18n_t("workspace_tree.count.subfolder_one", { count: 1 }).replace("{{count}}", "1")
            : i18n_t("workspace_tree.count.subfolder_many", { count: descendents.folders })}
        </strong>{" "}
        {i18n_t("common.and")}{" "}
        <strong className="text-danger">
          {descendents.runbooks}{" "}
          {descendents.runbooks === 1
            ? i18n_t("root.move_items.runbook")
            : i18n_t("root.move_items.runbooks")}
        </strong>
      </>
    );
  }

  const message = (
    <div>
      <p>
        {i18n_t("workspace_tree.delete_confirm_prefix")} {idSnippet}?
      </p>
      {countSnippet && (
        <p>
          {i18n_t("workspace_tree.delete_count_prefix")} {countSnippet}.
        </p>
      )}
      {isFsWorkspace && willDeleteFiles && (
        <p className="mt-2">
          <span className="text-warning">{i18n_t("workspace_tree.note")}</span>{" "}
          {i18n_t("workspace_tree.will_delete_files_prefix")}{" "}
          <strong>{i18n_t("workspace_tree.will")}</strong>{" "}
          {i18n_t("workspace_tree.delete_files_suffix")}
        </p>
      )}
      {isFsWorkspace && !willDeleteFiles && (
        <p className="mt-2">
          <span className="text-warning">{i18n_t("workspace_tree.note")}</span>{" "}
          {i18n_t("workspace_tree.will_delete_files_prefix")}{" "}
          <strong>{i18n_t("workspace_tree.will_not")}</strong>{" "}
          {i18n_t("workspace_tree.delete_files_suffix")}
        </p>
      )}
    </div>
  );

  return new DialogBuilder<"yes" | "no">()
    .title(i18n_t("workspace_tree.confirm_deletion"))
    .icon("warning")
    .message(message)
    .action({ label: i18n_t("common.cancel"), value: "no", variant: "flat" })
    .action({
      label: i18n_t("common.delete"),
      value: "yes",
      color: "danger",
      confirmWith:
        descendents.total > 0
          ? descendents.total === 1
            ? i18n_t("workspace_tree.confirm_delete_one", { count: descendents.total })
            : i18n_t("workspace_tree.confirm_delete_many", { count: descendents.total })
          : undefined,
    })
    .build();
}
