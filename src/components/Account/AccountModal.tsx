import { Modal, ModalContent, Button, Card, CardBody } from "@heroui/react";
import { open } from "@tauri-apps/plugin-shell";
import { KVStore } from "@/state/kv";
import AtuinEnv from "@/atuin_env";
import { useTranslation } from "@/lib/i18n";

const completeOnboarding = async () => {
  let db = await KVStore.open_default();
  await db.set("onboarding_complete", true);
};

const AccountModal = ({ close, isOpen }: { close: () => void; isOpen: boolean }) => {
  const { t } = useTranslation();
  const handleClose = async () => {
    close();
    await completeOnboarding();
  };

  function handleConnectWithHub() {
    handleClose();
    open(AtuinEnv.url("/settings/desktop-connect"));
  }

  return (
    <Modal
      disableAnimation
      isDismissable={false}
      hideCloseButton
      isOpen={isOpen}
      className="select-none"
      size="xl"
    >
      <ModalContent>
        {() => (
          <div className="p-4 space-y-4">
            <h1 className="text-3xl font-bold text-center">{t("account.create_title")}</h1>
            <i className="text-center">{t("account.hub_note")}</i>
            <Card>
              <CardBody>
                <h2 className="text-xl font-semibold mb-2">{t("account.why_signup")}</h2>
                <ul className="text-gray-700 space-y-1 list-disc pl-4 pt-2">
                  <li>{t("account.benefit.sync")}</li>
                  <li>{t("account.benefit.share")}</li>
                  <li>{t("account.benefit.backup")}</li>
                </ul>
              </CardBody>
            </Card>
            <div>
              <Button
                color="primary"
                className="w-full text-lg font-semibold"
                onPress={handleConnectWithHub}
              >
                {t("account.connect_hub")}
              </Button>
              <Button
                color="default"
                variant="flat"
                className="w-full text-lg font-semibold opacity-60"
                onPress={handleClose}
              >
                {t("account.use_offline")}
              </Button>
            </div>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};

export default AccountModal;
