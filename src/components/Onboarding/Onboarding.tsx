import {
  Modal,
  ModalContent,
  Button,
  Switch,
  useDisclosure,
  Card,
  CardBody,
  CardHeader,
  Divider,
} from "@heroui/react";

import { useEffect, useState } from "react";

import { KVStore } from "@/state/kv";
import AccountModal from "../Account/AccountModal";
import { init_tracking } from "@/tracking";
import { useTranslation } from "@/lib/i18n";

const FeatureCard = ({ title, description }: any) => (
  <Card>
    <CardBody>
      <h4 className="text-lg font-semibold mb-2">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </CardBody>
  </Card>
);

const Onboarding = () => {
  const { t } = useTranslation();
  let {
    isOpen: isOnboardingOpen,
    onOpen: onOnboardingOpen,
    onOpenChange: onOnboardingOpenChange,
  } = useDisclosure();

  const [trackingOptIn, setTrackingOptIn] = useState(true);
  const [showAccountModal, setShowAccountModal] = useState(false);

  useEffect(() => {
    // On first mount, if there is no tracking in the kv, we should set it to true in order to match the above default.
    (async () => {
      let db = await KVStore.open_default();
      let track = await db.get<boolean>("usage_tracking");
      if (track === null) {
        await db.set("usage_tracking", true);
      }
    })();

    onOnboardingOpen();
  }, []);

  const close = async (onClose: any) => {
    onClose();

    setShowAccountModal(true);
  };

  return (
    <>
      <Modal
        disableAnimation
        isDismissable={false}
        hideCloseButton
        isOpen={isOnboardingOpen}
        onOpenChange={onOnboardingOpenChange}
        className="w-full select-none"
        size="2xl"
        onClose={async () => {
          await init_tracking();
        }}
      >
        <ModalContent className="w-full">
          {(onClose) => (
            <div className="max-w-[900px] mx-auto p-6 space-y-6">
              <h1 className="text-4xl font-bold text-center">{t("onboarding.title")}</h1>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FeatureCard
                  title={t("onboarding.features.runbooks.title")}
                  description={t("onboarding.features.runbooks.description")}
                />
                <FeatureCard
                  title={t("onboarding.features.history.title")}
                  description={t("onboarding.features.history.description")}
                />
              </div>

              <Card>
                <CardHeader className="flex gap-3">
                  <div className="flex flex-col">
                    <p className="text-md">{t("onboarding.getting_started.title")}</p>
                  </div>
                </CardHeader>
                <Divider />
                <CardBody>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>{t("onboarding.getting_started.select_runbook")}</li>
                    <li>{t("onboarding.getting_started.history")}</li>
                    <li>
                      {t("onboarding.getting_started.community_prefix")}{" "}
                      <a
                        href="https://dub.sh/atuin-desktop-beta"
                        target="_blank"
                        className="text-blue-400 underline"
                      >
                        {t("onboarding.getting_started.community_link")}
                      </a>{" "}
                      {t("onboarding.getting_started.community_suffix")}
                    </li>
                    <li>
                      {t("onboarding.getting_started.docs_prefix")}{" "}
                      <a
                        href="https://docs.atuin.sh/desktop"
                        target="_blank"
                        className="text-blue-400 underline"
                      >
                        docs.atuin.sh/desktop
                      </a>
                    </li>
                  </ul>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="gap-4">
                  <h2 className="text-xl font-bold">{t("onboarding.tracking.title")}</h2>
                  <p className="text-gray-600">{t("onboarding.tracking.description")}</p>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{t("onboarding.tracking.enable")}</p>
                    <Switch
                      isSelected={trackingOptIn}
                      onValueChange={(value) => {
                        (async () => {
                          let db = await KVStore.open_default();
                          await db.set("usage_tracking", value);
                        })();

                        setTrackingOptIn(value);
                      }}
                      aria-label={t("onboarding.tracking.toggle")}
                    />
                  </div>
                  {trackingOptIn && (
                    <p className="text-sm text-gray-500">
                      {t("onboarding.tracking.enabled_message")}
                    </p>
                  )}
                  {!trackingOptIn && (
                    <p className="text-sm text-gray-500">
                      {t("onboarding.tracking.disabled_message")}
                    </p>
                  )}
                </CardBody>
              </Card>

              <Button color="success" className="w-full" onClick={() => close(onClose)}>
                {t("common.next")}
              </Button>
            </div>
          )}
        </ModalContent>
      </Modal>
      <AccountModal close={() => setShowAccountModal(false)} isOpen={showAccountModal} />
    </>
  );
};

export default Onboarding;
