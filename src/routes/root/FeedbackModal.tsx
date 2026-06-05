import { useStore } from "@/state/store";
import { ConnectionState } from "@/state/store/user_state";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  ModalFooter,
  Textarea,
  Input,
} from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";
import { useReducer } from "react";
import { useTranslation } from "@/lib/i18n";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackModalState = {
  feedback: string;
  email: string;
  sending: boolean;
  sent: boolean;
  error: string | null;
};

type FeedbackModalAction =
  | { type: "set_feedback"; feedback: string }
  | { type: "set_email"; email: string }
  | { type: "set_sending"; sending: boolean }
  | { type: "set_sent" }
  | { type: "set_error"; error: string | null }
  | { type: "reset" };

function reducer(state: FeedbackModalState, action: FeedbackModalAction) {
  switch (action.type) {
    case "set_feedback":
      return { ...state, feedback: action.feedback };
    case "set_email":
      return { ...state, email: action.email };
    case "set_sending":
      return { ...state, sending: action.sending };
    case "set_sent":
      return { ...state, sent: true };
    case "set_error":
      return { ...state, error: action.error };
    case "reset":
      return { ...state, feedback: "", email: "", sending: false, sent: false, error: null };
    default:
      const x: never = action;
      console.error("Unknown action", x);
      return state;
  }
}

export default function FeedbackModal(props: FeedbackModalProps) {
  const { t } = useTranslation();
  const connectionState = useStore((state) => state.connectionState);
  const [state, dispatch] = useReducer(reducer, {
    feedback: "",
    email: "",
    sending: false,
    sent: false,
    error: null,
  });

  async function handleSendFeedback() {
    dispatch({ type: "set_sending", sending: true });
    try {
      await invoke("send_feedback", { feedback: state.feedback, email: state.email });
      dispatch({ type: "set_sent" });
    } catch (e) {
      dispatch({ type: "set_error", error: e as string });
    } finally {
      dispatch({ type: "set_sending", sending: false });
    }
  }

  function handleClose() {
    props.onClose();
    if (state.sent) {
      dispatch({ type: "reset" });
    } else {
      dispatch({ type: "set_error", error: null });
    }
  }

  function handleFeedbackChange(e: React.ChangeEvent<HTMLInputElement>) {
    dispatch({ type: "set_feedback", feedback: e.target.value });
  }

  function handleEmailChange(value: string) {
    dispatch({ type: "set_email", email: value });
  }

  return (
    <Modal isOpen={props.isOpen} onClose={handleClose}>
      <ModalContent>
        <ModalHeader>{t("feedback.title")}</ModalHeader>
        <ModalBody>
          {state.sent && <p>{t("feedback.sent")}</p>}
          {!state.sent && (
            <form className="flex flex-col gap-2">
              <Textarea
                placeholder={t("feedback.placeholder")}
                value={state.feedback}
                onChange={handleFeedbackChange}
              />
              <Input
                placeholder={t("feedback.email_placeholder")}
                value={state.email}
                onValueChange={handleEmailChange}
              />
              {state.error && <div className="text-danger-600">{t("feedback.error")}</div>}
            </form>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onPress={handleClose} variant="flat">
            {state.sent ? t("common.close") : t("common.cancel")}
          </Button>
          <Button
            type="submit"
            color="primary"
            isDisabled={
              state.feedback.length === 0 ||
              connectionState !== ConnectionState.Online ||
              state.sent ||
              state.sending
            }
            isLoading={state.sending}
            onPress={handleSendFeedback}
          >
            {state.sending ? t("feedback.sending") : t("feedback.send")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
