import { useBlockNoteEditor, useComponentsContext, useExtensionState } from "@blocknote/react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { TrashIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

// Custom Side Menu button to remove the hovered block.
export function DeleteBlockItem() {
  const { t } = useTranslation();
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext()!;
  const hoveredBlock = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block,
  });

  if (!hoveredBlock) {
    return null;
  }

  return (
    <Components.Generic.Menu.Item
      icon={<TrashIcon size={16} />}
      onClick={() => {
        editor.removeBlocks([hoveredBlock]);
      }}
    >
      {t("common.delete")}
    </Components.Generic.Menu.Item>
  );
}
