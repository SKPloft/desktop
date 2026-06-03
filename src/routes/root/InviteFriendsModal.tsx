import { inviteFriends } from "@/api/user";
import { useStore } from "@/state/store";
import { ConnectionState } from "@/state/store/user_state";
import {
  addToast,
  Alert,
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";

type Invite = {
  email: string;
};

const BASIC_EMAIL_REGEX = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

function isValidEmail(email: string) {
  if (email === "") return false;
  if (BASIC_EMAIL_REGEX.test(email)) return true;

  const possibleSplit = email
    .split(/[\s,]+/)
    .map((e) => e.trim())
    .filter((e) => e !== "");
  return possibleSplit.every((e) => BASIC_EMAIL_REGEX.test(e));
}

type InviteFriendsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function InviteFriendsModal(props: InviteFriendsModalProps) {
  const { t } = useTranslation();
  const connectionState = useStore((state) => state.connectionState);
  const [emails, setEmails] = useState<Invite[]>([]);
  const [newEmailValid, setNewEmailValid] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>("");

  function closeAndReset() {
    props.onClose();
    setEmails([]);
    setNewEmail("");
    setNewEmailValid(false);
  }

  function handleNewEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const email = e.target.value;
    setNewEmail(email);
    setNewEmailValid(isValidEmail(email));
  }

  function handleAddEmail() {
    const email = newEmail.trim();
    const newEmails = email
      .split(/[\s,]+/)
      .map((e) => e.trim())
      .filter((e) => {
        if (e === "") return false;
        if (emails.some((e2) => e2.email === e)) return false;
        if (!BASIC_EMAIL_REGEX.test(e)) return false;
        return true;
      });

    setEmails((emails) => [...emails, ...newEmails.map((e) => ({ email: e }))]);
    setNewEmail("");
  }

  function handleRemoveEmail(email: Invite) {
    setEmails((emails) => emails.filter((e) => e.email !== email.email));
  }

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    handleAddEmail();
  }

  async function handleSend() {
    if (connectionState !== ConnectionState.Online) {
      addToast({
        title: t("common.error"),
        description: t("invite_friends.connection_error"),
        color: "danger",
      });
      return;
    }

    const emailsToSend = emails.map((e) => e.email);
    try {
      const result = await inviteFriends(emailsToSend);
      console.log(result);
      addToast({
        title: t("common.success"),
        description: t("invite_friends.sent_success"),
        color: "success",
        shouldShowTimeoutProgress: true,
      });
      closeAndReset();
    } catch (error) {
      addToast({
        title: t("common.error"),
        description: t("invite_friends.sent_error"),
        color: "danger",
        shouldShowTimeoutProgress: true,
      });
    }
  }

  return (
    <Modal isOpen={props.isOpen} onClose={closeAndReset}>
      <ModalContent>
        <ModalHeader>{t("invite_friends.title")}</ModalHeader>
        <ModalBody>
          <p>{t("invite_friends.description")}</p>
          {connectionState !== ConnectionState.Online && (
            <Alert color="danger" className="my-4">
              {t("invite_friends.offline")}
            </Alert>
          )}
          <form className="flex flex-row gap-2 items-center" onSubmit={handleFormSubmit}>
            <Input
              label={t("invite_friends.add_invite")}
              placeholder="email@domain.com"
              value={newEmail}
              onChange={handleNewEmailChange}
            />
            <Button onPress={handleAddEmail} isDisabled={!newEmailValid}>
              {t("common.add")}
            </Button>
          </form>
          <div>
            {emails.map((email, index) => (
              <Chip key={index} className="m-1" onClose={() => handleRemoveEmail(email)}>
                {email.email}
              </Chip>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onPress={closeAndReset} variant="flat">
            {t("common.cancel")}
          </Button>
          <Button
            onPress={handleSend}
            color="primary"
            isDisabled={emails.length === 0 || connectionState !== ConnectionState.Online}
          >
            {emails.length > 0
              ? t(emails.length === 1 ? "invite_friends.send_one" : "invite_friends.send_many", { count: emails.length })
              : t("invite_friends.add_emails")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
