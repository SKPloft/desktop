import { useCallback } from "react";
import { AIPopupBase } from "./ui/AIPopupBase";
import track_event from "@/tracking";
import { useTranslation } from "@/lib/i18n";

interface AIGeneratePopupProps {
  isVisible: boolean;
  position: { x: number; y: number };
  onSubmit: (prompt: string) => void;
  onClose: () => void;
}

/**
 * Popup for collecting a prompt to generate blocks.
 * The actual generation is handled by the parent via onSubmit callback.
 */
export function AIGeneratePopup({ isVisible, position, onSubmit, onClose }: AIGeneratePopupProps) {
  const { t } = useTranslation();
  const handleSubmit = useCallback(
    async (prompt: string) => {
      track_event("runbooks.ai.generate_popup", { prompt_length: prompt.length });
      onSubmit(prompt);
      // Close immediately - generation UI is handled by the inline generation hook
    },
    [onSubmit],
  );

  return (
    <AIPopupBase
      isVisible={isVisible}
      position={position}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={t("editor.ai.generate_block")}
      placeholder={t("editor.ai.generate_placeholder")}
      submitButtonText={t("editor.ai.generate")}
      submitButtonLoadingText={t("editor.ai.generating")}
      showSuggestions={false}
    />
  );
}