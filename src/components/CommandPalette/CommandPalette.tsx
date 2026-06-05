import { useEffect, useState, useCallback } from "react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandGroup,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@heroui/react";
import { commandRegistry, registerBuiltinCommands, resolve } from "@/lib/commands/registry";
import { CommandSearchResult } from "@/lib/commands/types";
import { useStore } from "@/state/store";
import { LucideIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function CommandPalette() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const isOpen = useStore((store: any) => store.commandPaletteOpen);
  const setOpen = useStore((store: any) => store.setCommandPaletteOpen);
  const [results, setResults] = useState<CommandSearchResult[]>([]);

  const onClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const onOpen = useCallback(() => {
    setOpen(true);
  }, [setOpen]);

  // Register builtin commands on mount
  useEffect(() => {
    registerBuiltinCommands();
  }, []);

  // Search commands when query changes
  useEffect(() => {
    const searchResults = commandRegistry.search(query);
    setResults(searchResults);
  }, [query]);

  // Keyboard shortcut handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.toLowerCase().includes("mac");
      const hotkey = isMac ? "metaKey" : "ctrlKey";

      if (e?.key?.toLowerCase() === "p" && e[hotkey] && e.shiftKey) {
        e.preventDefault();
        isOpen ? onClose() : onOpen();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onOpen, onClose]);

  const onItemSelect = useCallback(
    async (item: CommandSearchResult) => {
      onClose();
      setQuery("");

      try {
        await commandRegistry.executeCommand(item.command.id, {});
      } catch (error) {
        console.error("Failed to execute command:", error);
      }
    },
    [onClose],
  );

  const groupCommandsByCategory = (results: CommandSearchResult[]) => {
    const grouped: Record<string, CommandSearchResult[]> = {};

    results.forEach((result) => {
      const category = resolve(result.command.category ?? "") || "General";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(result);
    });

    return grouped;
  };

  const groupedResults = groupCommandsByCategory(results);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setQuery("");
    }
    setOpen(open);
  }

  return (
    <Dialog modal={false} open={isOpen} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogContent className="overflow-hidden p-0 data-[state=open]:animate-none data-[state=closed]:animate-none">
          <VisuallyHidden>
            <DialogTitle>{t("command_palette.title")}</DialogTitle>
          </VisuallyHidden>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("command_palette.placeholder")}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                <div className="py-6 text-center text-sm">
                  {query.length === 0 ? (
                    <p>{t("command_palette.empty")}</p>
                  ) : (
                    <div>
                      <p>{t("command_palette.no_results", { query })}</p>
                      <p className="text-muted-foreground">
                        {query.length === 1
                          ? t("command_palette.add_more")
                          : t("command_palette.search_else")}
                      </p>
                    </div>
                  )}
                </div>
              </CommandEmpty>
              {Object.entries(groupedResults).map(([category, categoryResults]) => (
                <CommandGroup key={category} heading={category}>
                  {categoryResults.map((result) => (
                    <CommandItem
                      key={result.command.id}
                      value={result.command.id}
                      onSelect={() => onItemSelect(result)}
                      className="flex items-center gap-2"
                    >
                      {result.command.icon &&
                        (() => {
                          const Icon =
                            typeof result.command.icon === "function"
                              ? (result.command.icon as () => LucideIcon)()
                              : result.command.icon;
                          return <Icon className="h-4 w-4" />;
                        })()}
                      <div className="flex-1">
                        <div className="font-medium">{resolve(result.command.title)}</div>
                        {result.command.description && (
                          <div className="text-sm text-muted-foreground">
                            {resolve(result.command.description)}
                          </div>
                        )}
                      </div>
                      {result.command.shortcut && (
                        <div className="text-xs text-muted-foreground">
                          {result.command.shortcut.join(" ")}
                        </div>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
