use std::{future::Future, ops::Deref, pin::Pin, sync::Arc};

use genai::{
    adapter::AdapterKind,
    resolver::{AuthData, Endpoint, ServiceTargetResolver},
    ClientConfig, ModelIden, ServiceTarget,
};
use tokio::sync::RwLock;

use crate::secret_cache::{SecretCache, SecretCacheError};

#[derive(Debug, thiserror::Error)]
pub enum AtuinAIClientError {
    #[error("Failed to get credential: {0}")]
    CredentialError(#[from] SecretCacheError),
}

/// A wrapper around a genai::Client that includes Atuin's custom service target resolver
pub struct AtuinAIClient {
    client: genai::Client,
    #[allow(dead_code)] // kept for future use (e.g., key rotation); resolver uses a clone captured at construction
    secret_cache: Arc<SecretCache>,
    /// The current desktop username, used for looking up provider API keys.
    /// Set by the session before making requests.
    current_username: Arc<RwLock<String>>,
}

impl AtuinAIClient {
    pub fn new(secret_cache: Arc<SecretCache>) -> Self {
        let secret_cache_clone = secret_cache.clone();
        let current_username = Arc::new(RwLock::new(String::new()));
        let username_clone = current_username.clone();
        let target_resolver =
            ServiceTargetResolver::from_resolver_async_fn(move |service_target| {
                resolve_service_target(
                    service_target,
                    secret_cache_clone.clone(),
                    username_clone.clone(),
                )
            });
        let client = genai::Client::builder()
            .with_config(ClientConfig::default().with_service_target_resolver(target_resolver))
            .build();

        Self {
            client,
            secret_cache,
            current_username,
        }
    }

    /// Set the current desktop username for API key lookups.
    /// Must be called before making requests to non-Hub providers.
    pub async fn set_current_username(&self, username: String) {
        *self.current_username.write().await = username;
    }
}

impl Deref for AtuinAIClient {
    type Target = genai::Client;

    fn deref(&self) -> &genai::Client {
        &self.client
    }
}

fn resolve_service_target(
    mut service_target: ServiceTarget,
    secret_cache: Arc<SecretCache>,
    current_username: Arc<RwLock<String>>,
) -> Pin<Box<dyn Future<Output = Result<ServiceTarget, genai::resolver::Error>> + Send>> {
    Box::pin(async move {
        let model_name = service_target.model.model_name.to_string();
        let parts = model_name.splitn(3, "::").collect::<Vec<&str>>();

        if parts.len() != 3 {
            return Err(genai::resolver::Error::Custom(format!(
                "Invalid Atuin Desktop model identifier format: {}",
                model_name
            )));
        }

        // Set the adapter kind based on the provider
        let adapter_kind = match parts[0] {
            "atuinhub" => AdapterKind::Anthropic,
            "claude" => AdapterKind::Anthropic,
            "openai" => AdapterKind::OpenAI,
            "deepseek" => AdapterKind::DeepSeek,
            "ollama" => AdapterKind::Ollama,
            _ => {
                return Err(genai::resolver::Error::Custom(format!(
                    "Invalid provider identifier: {}",
                    parts[0]
                )))
            }
        };

        let is_hub = parts[0] == "atuinhub";

        // Set the API key, if any, for the provider
        // Provider API keys are stored per-OS-user for security isolation
        let username = current_username.read().await.clone();
        let key = get_api_key(&secret_cache, adapter_kind, is_hub, &username)
            .await
            .map_err(|e| genai::resolver::Error::Custom(e.to_string()))?;

        if let Some(key) = key {
            service_target.auth = AuthData::Key(key);
        } else if !is_hub && adapter_kind != AdapterKind::Ollama {
            log::warn!(
                "No API key found for provider '{}' (adapter {:?}). Requests will fail with auth error.",
                parts[0],
                adapter_kind
            );
            service_target.auth = AuthData::Key(String::new());
        } else {
            service_target.auth = AuthData::Key(String::new());
        }

        // Set the specific model
        let model_id = ModelIden::new(adapter_kind, parts[1]);
        service_target.model = model_id;

        // Set the endpoint, if any, for the model
        if parts[2] != "default" {
            service_target.endpoint = Endpoint::from_owned(parts[2].to_string());
        }

        Ok(service_target)
    })
}

async fn get_api_key(
    secret_cache: &SecretCache,
    adapter_kind: AdapterKind,
    is_hub: bool,
    username: &str,
) -> Result<Option<String>, AtuinAIClientError> {
    // Hub auth is handled separately via custom HTTP headers in session.rs
    if is_hub {
        return Ok(None);
    }

    // Map adapter kind to the secret storage service name
    let service = match adapter_kind {
        AdapterKind::Anthropic => "sh.atuin.runbooks.ai.claude",
        AdapterKind::OpenAI => "sh.atuin.runbooks.ai.openai",
        AdapterKind::DeepSeek => "sh.atuin.runbooks.ai.deepseek",
        AdapterKind::Ollama => "sh.atuin.runbooks.ai.ollama",
        _ => return Ok(None),
    };

    secret_cache.get(service, username).await.map_err(Into::into)
}
