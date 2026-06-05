import { createContext } from "react";

function stub() {
  throw new Error("context not initialized"); // I18N: no-translate - internal exception
}

interface API {
  activateRunbook: (runbookId: string | null) => void;
  promptDeleteRunbook: (runbookId: string) => void;
  // runbookDeleted: (workspaceId: string, runbookId: string) => void;
  runbookMoved: (
    runbookId: string,
    newWorkspaceId: string,
    newParentFolderId: string | null,
  ) => void;
}

const RunbookContext = createContext<API>({
  activateRunbook: stub,
  promptDeleteRunbook: stub,
  // runbookDeleted: stub,
  runbookMoved: stub,
});

export default RunbookContext;
