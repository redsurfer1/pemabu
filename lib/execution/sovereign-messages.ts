/** Shared copy for sovereign / vault-only execution boundaries. */
export const VAULT_REQUIRED_CODE = "VAULT_REQUIRED" as const;

export const VAULT_REQUIRED_MESSAGE =
  "Autonomous execution requires local-first Vault deployment mode. " +
  "Deploy with docker-compose and set USE_LOCAL_VAULT=true in your environment. " +
  "Pemabu does not run trade approval or store exchange credentials in cloud infrastructure.";

export const EXCHANGE_CREDENTIALS_VAULT_ONLY_MESSAGE =
  "Exchange credentials require local vault mode. " +
  "Deploy with docker-compose and set USE_LOCAL_VAULT=true in your environment. " +
  "Pemabu does not store exchange credentials in cloud infrastructure.";
