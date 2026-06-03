import { useState, useEffect, useRef } from "react";
import {
  Button,
  Input,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  RadioGroup,
  Radio,
  Textarea,
  Select,
  SelectItem,
} from "@heroui/react";
import { GlobeIcon, SettingsIcon, FolderOpenIcon } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";
import undent from "undent";
import AIBlockRegistry from "@/lib/ai/block_registry";
import track_event from "@/tracking";
import { exportPropMatter } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useBlockKvValue } from "@/lib/hooks/useKvValue";
import { useTranslation } from "@/lib/i18n";
import { t as i18nT } from "@/lib/i18n";

interface SshKeyInfo {
  name: string;
  path: string;
  keyType: string | null;
  isStandard: boolean;
}

interface SshConnectProps {
  blockId: string;
  userHost: string;
  user: string;
  hostname: string;
  port: number;
  onUserHostChange: (userHost: string) => void;
  onSettingsChange: (settings: Partial<SshConnectSettings>) => void;
  isEditable: boolean;
}

interface SshConnectSettings {
  user: string;
  hostname: string;
  port: number;
}

// Local-only settings for identity key (not synced to other users)
interface IdentityKeySettings {
  mode: string;
  value: string;
}

// Local-only settings for SSH certificate (not synced to other users)
interface CertificateSettings {
  mode: string;
  value: string;
}

const SshConnect = ({
  blockId,
  userHost,
  user,
  hostname,
  port,
  onUserHostChange,
  onSettingsChange,
  isEditable,
}: SshConnectProps) => {
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [availableKeys, setAvailableKeys] = useState<SshKeyInfo[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);

  // Identity key settings are stored locally per-user (not synced)
  // Uses KV store so the backend runtime can access the value
  const [identityKey, setIdentityKey] = useBlockKvValue<IdentityKeySettings>(
    blockId,
    "identityKey",
    { mode: "none", value: "" },
  );

  // Certificate settings are stored locally per-user (not synced)
  // Uses KV store so the backend runtime can access the value
  const [certificate, setCertificate] = useBlockKvValue<CertificateSettings>(
    blockId,
    "certificate",
    { mode: "none", value: "" },
  );

  const hasExplicitConfig = user || hostname;

  const displayValue = hasExplicitConfig
    ? `${user ? user + "@" : ""}${hostname || ""}${port ? ":" + port : ""}`
    : userHost;

  // Avoids useEffect dependency on availableKeys triggering reload
  const keysLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    if (settingsOpen && !keysLoadedRef.current) {
      const loadKeys = async () => {
        setKeysLoading(true);
        try {
          const keys = await invoke<SshKeyInfo[]>("list_ssh_keys");
          if (!cancelled) {
            setAvailableKeys(keys);
            keysLoadedRef.current = true;
          }
        } catch (err) {
          if (!cancelled) {
            console.error("Failed to load SSH keys:", err);
          }
        } finally {
          if (!cancelled) {
            setKeysLoading(false);
          }
        }
      };
      loadKeys();
    }

    return () => {
      cancelled = true;
    };
  }, [settingsOpen]);

  const selectKeyFile = async () => {
    if (!isEditable) return;
    try {
      const selectedPath = await open({
        multiple: false,
        directory: false,
      });
      if (selectedPath) {
        await setIdentityKey({ ...identityKey, value: selectedPath });
      }
    } catch (err) {
      console.error("Failed to select key file:", err);
    }
  };

  const selectCertFile = async () => {
    if (!isEditable) return;
    try {
      const selectedPath = await open({
        multiple: false,
        directory: false,
      });
      if (selectedPath) {
        await setCertificate({ ...certificate, value: selectedPath });
      }
    } catch (err) {
      console.error("Failed to select certificate file:", err);
    }
  };

  const hasIncompleteConfig = (user && !hostname) || (!user && hostname);

  return (
    <>
      <Tooltip
        content={t("editor.blocks.ssh_connect.tooltip")}
        delay={1000}
        className="outline-none"
      >
        <div className="flex flex-col w-full bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
              ssh-connect
            </span>
            <Tooltip content={t("common.settings")} delay={500}>
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <SettingsIcon className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>

          <div className="flex flex-row items-center space-x-3">
            <div className="flex items-center">
              <Button
                isIconOnly
                variant="light"
                className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <GlobeIcon className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1">
              <Input
                placeholder={
                  hasExplicitConfig
                    ? t("editor.blocks.ssh_connect.configured_via_settings")
                    : t("editor.blocks.ssh_connect.quick_input_placeholder")
                }
                value={displayValue}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
                className="flex-1 border-slate-200 dark:border-slate-700 focus:ring-slate-500"
                onValueChange={hasExplicitConfig ? undefined : onUserHostChange}
                isDisabled={!isEditable}
                isReadOnly={!!hasExplicitConfig}
              />
            </div>
          </div>
        </div>
      </Tooltip>

      <Modal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="text-base font-medium">{t("editor.blocks.ssh_connect.settings_title")}</ModalHeader>
          <ModalBody className="pb-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Left column: Connection */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("editor.blocks.ssh_connect.connection")}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("editor.blocks.ssh_connect.connection_description")}
                </p>

                <Input
                  label={t("editor.blocks.ssh_connect.user")}
                  placeholder="root"
                  value={user}
                  onValueChange={(v) => onSettingsChange({ user: v })}
                  isDisabled={!isEditable}
                  size="sm"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                <Input
                  label={t("editor.blocks.ssh_connect.hostname")}
                  placeholder="example.com"
                  value={hostname}
                  onValueChange={(v) => onSettingsChange({ hostname: v })}
                  isDisabled={!isEditable}
                  size="sm"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                <Input
                  label={t("editor.blocks.ssh_connect.port")}
                  placeholder="22"
                  type="number"
                  value={port ? String(port) : ""}
                  onValueChange={(v) => {
                    const num = parseInt(v, 10);
                    onSettingsChange({ port: isNaN(num) ? 0 : num });
                  }}
                  isDisabled={!isEditable}
                  size="sm"
                  className="w-32"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />

                {hasIncompleteConfig && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                    {t("editor.blocks.ssh_connect.incomplete_config", {
                      field: user ? t("editor.blocks.ssh_connect.user_lower") : t("editor.blocks.ssh_connect.hostname_lower"),
                    })}
                  </p>
                )}
              </div>

              {/* Right column: Identity Key & Certificate */}
              <div className="space-y-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("editor.blocks.ssh_connect.identity_key")}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("editor.blocks.ssh_connect.identity_key_description")}
                  </p>

                  <RadioGroup
                    value={identityKey.mode}
                    onValueChange={async (v) => {
                      await setIdentityKey({ mode: v, value: "" });
                    }}
                    isDisabled={!isEditable}
                    size="sm"
                  >
                    <Radio value="none">{t("editor.blocks.ssh_connect.identity_key_use_config")}</Radio>
                    <Radio value="path">{t("editor.blocks.ssh_connect.identity_key_path")}</Radio>
                    <Radio value="paste">{t("editor.blocks.ssh_connect.identity_key_paste")}</Radio>
                  </RadioGroup>

                  {identityKey.mode === "path" && (
                    <div className="mt-3 space-y-2">
                      <Select
                        label={t("editor.blocks.ssh_connect.select_from_ssh")}
                        placeholder={keysLoading ? t("editor.blocks.ssh_connect.loading_keys") : t("editor.blocks.ssh_connect.select_key")}
                        selectedKeys={identityKey.value ? [identityKey.value] : []}
                        onSelectionChange={async (keys) => {
                          const selected = Array.from(keys)[0] as string;
                          if (selected) {
                            await setIdentityKey({ ...identityKey, value: selected });
                          }
                        }}
                        isDisabled={!isEditable || keysLoading}
                        size="sm"
                      >
                        {availableKeys.map((key) => (
                          <SelectItem key={key.path} textValue={key.name}>
                            <div className="flex flex-col">
                              <span className="text-sm">{key.name}</span>
                              <span className="text-xs text-gray-500">
                                {key.keyType || t("editor.blocks.ssh_connect.private_key")}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </Select>
                      <p className="text-xs text-gray-500">{t("editor.blocks.ssh_connect.custom_key_path")}</p>
                      <div className="flex flex-row items-center space-x-2">
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                          className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                          aria-label={t("editor.blocks.ssh_connect.browse_key_file")}
                          onPress={selectKeyFile}
                          isDisabled={!isEditable}
                        >
                          <FolderOpenIcon className="h-4 w-4" />
                        </Button>
                        <Input
                          placeholder="/path/to/private/key"
                          value={identityKey.value}
                          onValueChange={async (v) => {
                            await setIdentityKey({ ...identityKey, value: v });
                          }}
                          isDisabled={!isEditable}
                          size="sm"
                          className="flex-1"
                          autoComplete="off"
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck="false"
                        />
                      </div>
                    </div>
                  )}

                  {identityKey.mode === "paste" && (
                    <Textarea
                      label={t("editor.blocks.ssh_connect.private_key_content")}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..."
                      value={identityKey.value}
                      onValueChange={async (v) => {
                        await setIdentityKey({ ...identityKey, value: v });
                      }}
                      isDisabled={!isEditable}
                      minRows={4}
                      maxRows={10}
                      size="sm"
                      classNames={{
                        input: "font-mono text-xs",
                      }}
                      autoComplete="off"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck="false"
                    />
                  )}
                </div>

                <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("editor.blocks.ssh_connect.certificate")}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("editor.blocks.ssh_connect.certificate_description")}
                  </p>

                  <RadioGroup
                    value={certificate.mode}
                    onValueChange={async (v) => {
                      await setCertificate({ mode: v, value: "" });
                    }}
                    isDisabled={!isEditable}
                    size="sm"
                  >
                    <Radio value="none">{t("editor.blocks.ssh_connect.certificate_auto_detect")}</Radio>
                    <Radio value="path">{t("editor.blocks.ssh_connect.certificate_path")}</Radio>
                    <Radio value="paste">{t("editor.blocks.ssh_connect.certificate_paste")}</Radio>
                  </RadioGroup>

                  {certificate.mode === "path" && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-gray-500">{t("editor.blocks.ssh_connect.certificate_path_description")}</p>
                      <div className="flex flex-row items-center space-x-2">
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                          className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                          aria-label={t("editor.blocks.ssh_connect.browse_certificate_file")}
                          onPress={selectCertFile}
                          isDisabled={!isEditable}
                        >
                          <FolderOpenIcon className="h-4 w-4" />
                        </Button>
                        <Input
                          placeholder="/path/to/certificate-cert.pub"
                          value={certificate.value}
                          onValueChange={async (v) => {
                            await setCertificate({ ...certificate, value: v });
                          }}
                          isDisabled={!isEditable}
                          size="sm"
                          className="flex-1"
                          autoComplete="off"
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck="false"
                        />
                      </div>
                    </div>
                  )}

                  {certificate.mode === "paste" && (
                    <Textarea
                      label={t("editor.blocks.ssh_connect.certificate_content")}
                      placeholder="ssh-ed25519-cert-v01@openssh.com AAAA..."
                      value={certificate.value}
                      onValueChange={async (v) => {
                        await setCertificate({ ...certificate, value: v });
                      }}
                      isDisabled={!isEditable}
                      minRows={3}
                      maxRows={8}
                      size="sm"
                      classNames={{
                        input: "font-mono text-xs",
                      }}
                      autoComplete="off"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck="false"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Full-width footer with Clear button */}
            {(hasExplicitConfig || identityKey.mode !== "none" || certificate.mode !== "none") && (
              <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  size="sm"
                  variant="flat"
                  color="danger"
                  className="w-full"
                  isDisabled={!isEditable}
                  onPress={async () => {
                    onSettingsChange({
                      user: "",
                      hostname: "",
                      port: 0,
                    });
                    await setIdentityKey({ mode: "none", value: "" });
                    await setCertificate({ mode: "none", value: "" });
                  }}
                >
                  {t("editor.blocks.ssh_connect.clear_all_settings")}
                </Button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  {t("editor.blocks.ssh_connect.clear_all_description")}
                </p>
              </div>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

export default createReactBlockSpec(
  {
    type: "ssh-connect",
    propSchema: {
      userHost: { default: "" },
      user: { default: "" },
      hostname: { default: "" },
      port: { default: 0 },
      // Note: identityKeyMode and identityKeyValue are stored in block local storage
      // (per-user, not synced) because different users authenticate differently
    },
    content: "none",
  },
  {
    toExternalHTML: ({ block }) => {
      return (
        <pre lang="ssh-connect">
          <code>
            {exportPropMatter("ssh-connect", block.props, ["userHost", "user", "hostname", "port"])}
          </code>
        </pre>
      );
    },
    // @ts-ignore
    render: ({ block, editor }) => {
      const onUserHostChange = (val: string) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, userHost: val },
        });
      };

      const onSettingsChange = (settings: Partial<SshConnectSettings>) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, ...settings },
        });
      };

      return (
        <SshConnect
          blockId={block.id}
          userHost={block.props.userHost}
          user={block.props.user}
          hostname={block.props.hostname}
          port={block.props.port}
          onUserHostChange={onUserHostChange}
          onSettingsChange={onSettingsChange}
          isEditable={editor.isEditable}
        />
      );
    },
  },
);

export const insertSshConnect = (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
  title: i18nT("editor.blocks.ssh_connect.title"),
  onItemClick: () => {
    track_event("runbooks.block.create", { type: "ssh-connect" });

    editor.insertBlocks(
      [
        {
          type: "ssh-connect",
        },
      ],
      editor.getTextCursorPosition().block.id,
      "before",
    );
  },
  icon: <GlobeIcon size={18} />,
  group: i18nT("editor.blocks.group.network"),
});

AIBlockRegistry.getInstance().addBlock({
  typeName: "ssh-connect",
  friendlyName: "SSH Connect",
  shortDescription: "Establishes an SSH connection for subsequent blocks.",
  description: undent`
    SSH Connect blocks establish an SSH connection to a remote server. Subsequent Terminal and Script blocks will execute on the connected host until another SSH Connect or Host block is encountered. To switch back to local execution, insert a Host block with host set to "local".

    The available props are:
    - userHost (string): Quick connection string in format "user@host:port" or just "host" (uses SSH config)
    - user (string): Override username (when set with hostname, takes precedence over userHost)
    - hostname (string): Override hostname (when set with user, takes precedence over userHost)
    - port (number): Override port number (default: 22)

    QUICK vs MANUAL CONFIGURATION:
    - Quick mode: Set only "userHost" for simple connections using SSH config aliases or user@host format
    - Manual mode: Set "user" and "hostname" together to override connection details explicitly
    - When user/hostname are set, they take precedence over userHost

    AUTHENTICATION:
    Authentication works like the standard ssh command, trying methods in this order:
    1. SSH Agent - All keys loaded in your SSH agent
    2. SSH Config - Identity files specified in ~/.ssh/config
    3. Default Keys - Standard SSH keys in ~/.ssh/: id_rsa, id_ecdsa, id_ecdsa_sk (FIDO/U2F), id_ed25519, id_ed25519_sk (FIDO/U2F), id_xmss, id_dsa
    4. Interactive password prompt (if key auth fails)

    Password-protected keys must be added to your SSH agent with ssh-add, or users can specify a key path in the settings modal.

    SSH CONFIG SUPPORT:
    Your ~/.ssh/config is fully respected, including:
    - Host aliases
    - ProxyJump and ProxyCommand for bastion/jump hosts
    - IdentityFile and IdentityAgent
    - Other standard SSH config options
    Tailscale SSH also works as expected.

    MANUAL AUTHENTICATION (via Settings UI):
    Users can configure identity keys and certificates through the block's settings modal. These settings are stored locally per-user (not synced with collaborators) since different users authenticate differently:
    - Identity Key: Specify a private key by selecting from ~/.ssh, browsing for a file, or pasting content directly. When configured, this key is tried first before other methods.
    - Certificate: Specify an SSH certificate by path or pasting content directly

    Note: Identity key and certificate settings cannot be set via props - they must be configured through the UI by each user.

    CONNECTION LIFECYCLE:
    - Connections are pooled globally with multiplexed sessions for low latency
    - Connection persists until another SSH Connect or Host block is encountered
    - HTTP, SQL, Kubernetes, Prometheus blocks always run locally regardless of SSH context

    Example (quick mode with SSH config alias): {
      "type": "ssh-connect",
      "props": {
        "userHost": "production-server"
      }
    }

    Example (quick mode with full address): {
      "type": "ssh-connect",
      "props": {
        "userHost": "admin@production-server.example.com"
      }
    }

    Example (manual mode): {
      "type": "ssh-connect",
      "props": {
        "user": "admin",
        "hostname": "production-server.example.com",
        "port": 22
      }
    }
  `,
});
