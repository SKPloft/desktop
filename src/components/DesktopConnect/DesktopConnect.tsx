import { useStore } from "@/state/store";
import { Modal, ModalContent, Button, Card, CardBody } from "@heroui/react";
import { setHubApiToken } from "@/api/api";
import SocketManager from "@/socket";
import { useTranslation } from "@/lib/i18n";

const DesktopConnect = () => {
  const { t } = useTranslation();
  let setProposedDesktopConnectUser = useStore((state) => state.setProposedDesktopConnectuser);
  let proposedUser = useStore((state) => state.proposedDesktopConnectUser);

  const confirm = async () => {
    if (proposedUser) {
      await setHubApiToken(proposedUser.username, proposedUser.token);
      SocketManager.setApiToken(proposedUser.token);
      useStore.getState().refreshUser();
    }

    setProposedDesktopConnectUser(undefined);
  };

  const cancel = async () => {
    setProposedDesktopConnectUser(undefined);
  };

  return (
    <Modal
      disableAnimation
      isDismissable={false}
      hideCloseButton
      isOpen={true}
      className="w-full select-none"
      size="2xl"
    >
      <ModalContent className="w-full">
        {(_onClose) => (
          <div className="max-w-[900px] mx-auto p-6 space-y-6">
            <h1 className="text-4xl text-center">{t("desktop_connect.title")}</h1>
            <Card>
              <CardBody className="gap-4">
                <h2 className="text-xl">{t("desktop_connect.request_title")}</h2>
                <h3 className="text-l">
                  {t("desktop_connect.username", { username: proposedUser!.username })}
                </h3>
                <p className="text-gray-600">{t("desktop_connect.description")}</p>
                <p className="text-gray-600">{t("desktop_connect.keychain")}</p>
              </CardBody>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="flat" color="default" onClick={cancel}>
                {t("common.cancel")}
              </Button>

              <Button variant="flat" color="success" onClick={confirm}>
                {t("desktop_connect.accept")}
              </Button>
            </div>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};

export default DesktopConnect;
