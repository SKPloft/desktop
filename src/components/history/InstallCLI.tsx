import { Modal, ModalContent, Button, useDisclosure, Card, CardBody } from "@heroui/react";

import { useEffect, useState } from "react";
import { installAtuinCLI } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

const InstallCLI = () => {
  const { t } = useTranslation();
  let {
    isOpen: isInstallCLIOpen,
    onOpen: onInstallCLIOpen,
    onOpenChange: onInstallCLIOpenChange,
  } = useDisclosure();

  const [installing, setInstalling] = useState<boolean>(false);

  useEffect(() => {
    onInstallCLIOpen();
  }, []);

  return (
    <Modal
      disableAnimation
      isDismissable={true}
      isOpen={isInstallCLIOpen}
      onOpenChange={onInstallCLIOpenChange}
      className="w-full select-none"
      size="2xl"
    >
      <ModalContent className="w-full">
        {(onClose) => (
          <div className="max-w-[900px] mx-auto p-6 space-y-6">
            <h1 className="text-4xl font-bold text-center">{t("history.install_cli.title")}</h1>

            <h3 className="text-xl font-semibold text-center">
              {t("history.install_cli.subtitle")}
            </h3>

            <div style={{ position: "relative", paddingTop: "56.25%" }}>
              <iframe
                src="https://iframe.mediadelivery.net/embed/207337/2e21ead8-7c95-4ee8-b3a4-ffa5efaaecca?autoplay=true&loop=true&muted=true&preload=true&responsive=true"
                loading="lazy"
                style={{
                  border: 0,
                  position: "absolute",
                  top: 0,
                  height: "100%",
                  width: "100%",
                }}
                allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;"
                allowFullScreen
              ></iframe>
            </div>

            <Card>
              <CardBody>
                <ul className="list-disc pl-6 space-y-2">
                  <li>{t("history.install_cli.not_required")}</li>
                  <li>{t("history.install_cli.open_source")}</li>
                  <li>{t("history.install_cli.single_binary")}</li>
                  <li>{t("history.install_cli.encrypted_sync")}</li>
                </ul>
              </CardBody>
            </Card>

            <Button
              isLoading={installing}
              color="success"
              className="w-full"
              onPress={async () => {
                setInstalling(true);
                await installAtuinCLI();
                setInstalling(false);
                onClose();
              }}
            >
              {t("history.install_cli.install")}
            </Button>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};

export default InstallCLI;
