/** @ts-ignore */

import { getGlobalOptions } from "@/lib/global_options";
import { MenuBuilder, ItemBuilder, AtuinMenuItem } from "@/lib/menu_builder";
import Workspace from "@/state/runbooks/workspace";
import { ArboristNode, ArboristTree } from "@/state/runbooks/workspace_folders";
import { Menu, MenuOptions } from "@tauri-apps/api/menu";
import { t } from "@/lib/i18n";

type Handler = () => void;

type Actions = {
  onNewRunbook: (workspaceId: string, parentFolderId: string | null) => void;
  onNewWorkspace: () => void;
};

type MenuActionsBuilder = (
  workspaceId: string,
  parentFolderId: string | null,
) => (AtuinMenuItem | ItemBuilder)[];

type OrgsWithWorkspaces = {
  name: string;
  id: string | null;
  workspaces: Array<{ workspace: Workspace; folder: ArboristTree }>;
};

export async function createNewRunbookMenu(
  workspaces: Array<{ workspace: Workspace; folder: ArboristTree }>,
  actions: Actions,
) {
  const workspaceItems = workspaces.map((ws) => {
    return new ItemBuilder()
      .text(ws.workspace.get("name")!)
      .items(
        buildWorkspaceItems(ws.workspace, ws.folder, (workspaceId, parentFolderId) => {
          return [
            new ItemBuilder()
              .text(t("runbooks.menu.new_runbook_here"))
              .action(() => actions.onNewRunbook(workspaceId, parentFolderId))
              .build(),
          ];
        }),
      )
      .build();
  });

  const menu = await new MenuBuilder()
    .items(workspaceItems)
    .separator()
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.new_workspace"))
        .action(() => actions.onNewWorkspace())
        .accelerator("CmdOrCtrl+N"),
    )
    .build();

  return menu;
}

function buildWorkspaceItems(
  workspace: Workspace,
  folder: ArboristTree,
  actions: MenuActionsBuilder,
): (AtuinMenuItem | ItemBuilder)[] {
  const items: MenuOptions["items"] = folder
    .filter((item) => item.type === "folder")
    .map((item) => {
      return new ItemBuilder()
        .text(item.name || item.id)
        .items(buildFolderItems(workspace, item, actions))
        .build();
    });

  const actionItems = actions(workspace.get("id")!, null);

  return [...(actionItems || []), { item: "Separator" }, ...items];
}

function buildFolderItems(
  workspace: Workspace,
  folder: ArboristNode,
  actions: MenuActionsBuilder,
): (AtuinMenuItem | ItemBuilder)[] {
  if (!folder.children) {
    return [];
  }

  const items = folder.children
    .filter((item) => item.type === "folder")
    .map((item) => {
      return new ItemBuilder()
        .text(item.name || item.id)
        .items(buildFolderItems(workspace, item, actions))
        .build();
    });

  const actionItems = actions(workspace.get("id")!, folder.id);

  return [...(actionItems || []), { item: "Separator" }, ...items];
}

/**
 * When right-clicking on a folder
 * @param orgs - list of orgs with workspaces and folders
 * @param currentOrgId - the current org id
 * @param sourceWorkspaceId - the workspace id of the workspace that was right-clicked
 * @param actions - the actions to perform when the menu is opened
 * @returns a menu with the actions for the folder
 */
export async function createFolderMenu(
  orgs: OrgsWithWorkspaces[],
  currentOrgId: string | null,
  sourceWorkspaceId: string,
  actions: {
    onNewFolder: Handler;
    onRenameFolder: Handler;
    onDeleteFolder: Handler;
    onNewRunbook: Handler;
    onMoveToWorkspace: (targetWorkspaceId: string, targetParentId: string | null) => void;
  },
) {
  const moveToItems = createMoveToMenu(
    orgs,
    currentOrgId,
    sourceWorkspaceId,
    actions.onMoveToWorkspace,
  );

  const menu = await new MenuBuilder()
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.new_runbook"))
        .action(() => actions.onNewRunbook())
        .accelerator("Shift+N"),
    )
    .separator()
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.new_folder"))
        .action(() => actions.onNewFolder())
        .accelerator("N"),
    )
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.rename_folder"))
        .action(() => actions.onRenameFolder())
        .accelerator("R"),
    )
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.delete_folder"))
        .action(() => actions.onDeleteFolder())
        .accelerator("CmdOrCtrl+Delete"),
    )
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.move_to"))
        .items(moveToItems as AtuinMenuItem[])
        .build(),
    )
    .build();

  return menu;
}

export async function createRunbookMenu(
  orgs: OrgsWithWorkspaces[],
  workspaceOrgId: string | null,
  workspaceId: string,
  actions: {
    onDeleteRunbook: Handler;
    onMoveToWorkspace: (targetWorkspaceId: string, targetParentId: string | null) => void;
  },
) {
  const moveToItems = createMoveToMenu(
    orgs,
    workspaceOrgId,
    workspaceId,
    actions.onMoveToWorkspace,
  );

  const menu = await new MenuBuilder()
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.delete_runbook"))
        .action(() => actions.onDeleteRunbook())
        .accelerator("D"),
    )
    .separator()
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.move_to"))
        .items(moveToItems as AtuinMenuItem[])
        .build(),
    )
    .build();

  return menu;
}

export async function createMultiItemMenu(
  _items: string[],
  orgs: OrgsWithWorkspaces[],
  currentOrgId: string | null,
  sourceWorkspaceId: string,
  actions: {
    onMoveToWorkspace: (targetWorkspaceId: string, targetParentId: string | null) => void;
  },
) {
  const moveToItems = createMoveToMenu(
    orgs,
    currentOrgId,
    sourceWorkspaceId,
    actions.onMoveToWorkspace,
  );

  const menu = await new MenuBuilder()
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.move_to"))
        .items(moveToItems as AtuinMenuItem[])
        .build(),
    )
    .build();

  return menu;
}

export async function createWorkspaceMenu(actions: {
  onNewFolder: Handler;
  onNewRunbook: Handler;
  onNewWorkspace: Handler;
  onRenameWorkspace: Handler;
  onDeleteWorkspace: Handler;
  onOpenFolder?: Handler;
}) {
  const menu = await new MenuBuilder()
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.new_runbook"))
        .action(() => actions.onNewRunbook())
        .accelerator("Shift+N"),
    )
    .separator()
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.new_folder"))
        .action(() => actions.onNewFolder())
        .accelerator("N"),
    )
    .separator()
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.rename_workspace"))
        .action(() => actions.onRenameWorkspace())
        .accelerator("R"),
    )
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.delete_workspace"))
        .action(() => actions.onDeleteWorkspace())
        .accelerator("CmdOrCtrl+Delete"),
    );

  if (actions.onOpenFolder) {
    const opts = getGlobalOptions();

    menu.separator().item(
      new ItemBuilder()
        .text(opts.os === "macos" ? t("runbooks.menu.show_in_finder") : t("runbooks.menu.show_in_file_explorer"))
        .action(() => actions.onOpenFolder!())
        .accelerator("CmdOrCtrl+O"),
    );
  }

  return menu.build();
}

function createMoveToMenu(
  orgs: OrgsWithWorkspaces[],
  currentOrgId: string | null,
  sourceWorkspaceId: string,
  onSelectMove: (workspaceId: string, parentFolderId: string | null) => void,
): (AtuinMenuItem | ItemBuilder)[] {
  const currentOrg = orgs.find((org) => org.id === currentOrgId)!;
  const otherOrgs = orgs.filter((org) => org.id !== currentOrgId);

  let currentOrgMoveToChoices = currentOrg?.workspaces
    // can only move to a different workspace
    .filter((ws) => ws.workspace.get("id") !== sourceWorkspaceId)
    .map((ws) => {
      return new ItemBuilder()
        .text(ws.workspace.get("name")!)
        .items(
          buildWorkspaceItems(ws.workspace, ws.folder, (workspaceId, parentFolderId) => {
            return [
              new ItemBuilder()
                .text(t("runbooks.menu.move_here"))
                .action(() => onSelectMove(workspaceId, parentFolderId))
                .build(),
            ];
          }),
        )
        .build();
    });

  if (currentOrgMoveToChoices.length === 0) {
    currentOrgMoveToChoices = [
      new ItemBuilder()
        .text(t("runbooks.menu.no_workspaces"))
        .action(() => {})
        .enabled(false)
        .build(),
    ];
  }

  const currentOrgMoveToItem = new ItemBuilder()
    .text(currentOrg?.name || t("common.personal"))
    .items(currentOrgMoveToChoices)
    .build();

  return [
    currentOrgMoveToItem,
    ...(otherOrgs.length > 0 ? ([{ item: "Separator" }] as const) : []),
    ...otherOrgs.map((org) => {
      return new ItemBuilder()
        .text(org.name)
        .items(
          org.workspaces.map((ws) => {
            return new ItemBuilder()
              .text(ws.workspace.get("name")!)
              .items(
                buildWorkspaceItems(ws.workspace, ws.folder, (workspaceId, parentFolderId) => {
                  return [
                    new ItemBuilder()
                      .text(t("runbooks.menu.move_here"))
                      .action(() => onSelectMove(workspaceId, parentFolderId))
                      .build(),
                  ];
                }),
              )
              .build();
          }),
        )
        .build();
    }),
  ];
}

export async function createRootMenu(actions: { onNewWorkspace: Handler }) {
  const menu = await new MenuBuilder()
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.new_workspace"))
        .action(() => actions.onNewWorkspace())
        .accelerator("CmdOrCtrl+N"),
    )
    .build();

  return menu;
}

export type TabMenuActions = {
  type:
    | "close_tab"
    | "close_other_tabs"
    | "close_left_tabs"
    | "close_right_tabs"
    | "undo_close_tab"
    | "close_all_tabs";
};

export async function createTabMenu(callback: (action: TabMenuActions) => void): Promise<Menu> {
  const menu = await new MenuBuilder()
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.close_tab"))
        .action(() => callback({ type: "close_tab" }))
        .accelerator("CmdOrCtrl+W"),
    )
    .separator()
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.close_all_tabs"))
        .action(() => callback({ type: "close_all_tabs" }))
        .accelerator("CmdOrCtrl+Shift+W"),
    )
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.close_other_tabs"))
        .action(() => callback({ type: "close_other_tabs" })),
    )
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.close_tabs_left"))
        .action(() => callback({ type: "close_left_tabs" })),
    )
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.close_tabs_right"))
        .action(() => callback({ type: "close_right_tabs" })),
    )
    .separator()
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.undo_close_tab"))
        .action(() => callback({ type: "undo_close_tab" }))
        .accelerator("CmdOrCtrl+Shift+T"),
    )
    .build();

  return menu;
}

export type TabBarMenuActions = {
  type: "undo_close_tab" | "close_all_tabs";
};

export async function createTabBarMenu(
  callback: (action: TabBarMenuActions) => void,
): Promise<Menu> {
  const menu = await new MenuBuilder()
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.close_all_tabs"))
        .action(() => callback({ type: "close_all_tabs" }))
        .accelerator("CmdOrCtrl+W"),
    )
    .separator()
    .item(
      new ItemBuilder()
        .text(t("runbooks.menu.undo_close_tab"))
        .action(() => callback({ type: "undo_close_tab" }))
        .accelerator("CmdOrCtrl+Shift+T"),
    )
    .build();

  return menu;
}
