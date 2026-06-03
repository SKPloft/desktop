import { Card, CardBody, CardHeader, Chip } from "@heroui/react";
import { CircleXIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const ErrorCard = ({ error }: any) => {
  const { t } = useTranslation();

  return (
    <Card shadow="sm" className="w-full max-w-full border border-danger-200">
      <CardHeader className="flex justify-between items-center bg-danger-50">
        <div className="flex items-center gap-3">
          <Chip
            color="danger"
            variant="flat"
            startContent={<CircleXIcon size={14} />}
            className="pl-3 py-2"
          >
            {t("common.error")}
          </Chip>
          <span className="text-danger-700 font-semibold">{t("editor.blocks.prometheus.error")}</span>
        </div>
      </CardHeader>
      <CardBody className="p-4">
        <p className="text-danger-600 select-text">
          {error || t("blocks.common.request_error")}
        </p>
      </CardBody>
    </Card>
  );
};

export default ErrorCard;
