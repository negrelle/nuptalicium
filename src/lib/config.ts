export const DEFAULT_RELAY_URL = 'wss://relay.damus.io';
export const RELAY_STORAGE_KEY = 'nuptalicium:relay-url';
export const IDENTITY_STORAGE_KEY = 'nuptalicium:identity';
export const WIZARD_STORAGE_KEY = 'nuptalicium:wizard';
export const CONTRACTS_STORAGE_KEY = 'nuptalicium:contracts';
export const AUTH_SESSION_STORAGE_KEY = 'nuptalicium:auth-session';
export const API_BASE_URL = (
	import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:8080/api'
).replace(/\/$/, '');
export const MEMPOOL_BASE_URL = 'https://mempool.space/api';
export const DEFAULT_BITCOIN_NETWORK = 'bitcoin';
