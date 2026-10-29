import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import {
	ApiError,
	createChallenge,
	getAuthenticatedUser,
	refreshAuthentication,
	register,
	revokeSession,
	verifyChallenge
} from '$lib/api/auth';
import { AUTH_SESSION_STORAGE_KEY } from '$lib/config';
import { configureAuthLifecycle } from '$lib/api/client';
import { signAuthenticationChallenge } from '$lib/nostr';
import { clearIdentity, connectWithNip07, getIdentitySnapshot } from '$lib/stores/identity';
import { showValidationToast } from '$lib/stores/toast';
import type { AuthSession, AuthUser } from '$lib/types';

const REFRESH_THRESHOLD_MS = 60_000;
let refreshInFlight: Promise<AuthSession | null> | null = null;

function readSession(): AuthSession | null {
	if (!browser) return null;

	const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
	if (!raw) return null;

	try {
		const session = JSON.parse(raw) as AuthSession;
		if (!session.accessToken || Date.parse(session.expiresAt) <= Date.now()) {
			localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
			return null;
		}
		return session;
	} catch {
		localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
		return null;
	}
}

const authSession = writable<AuthSession | null>(readSession());

if (browser) {
	authSession.subscribe((value) => {
		if (value) localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(value));
		else localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
	});
	window.addEventListener('storage', (event) => {
		if (event.key !== AUTH_SESSION_STORAGE_KEY) return;
		authSession.set(readSession());
	});
}

export const authStore = {
	subscribe: authSession.subscribe
};

export function getAuthSnapshot() {
	return get(authSession);
}

export function updateAuthenticatedUser(user: AuthUser) {
	authSession.update((session) => (session ? { ...session, user } : session));
}

function clearAuthentication() {
	authSession.set(null);
	clearIdentity();
}

function expiresSoon(session: AuthSession) {
	return Date.parse(session.expiresAt) - Date.now() <= REFRESH_THRESHOLD_MS;
}

export async function refreshSession(): Promise<AuthSession | null> {
	if (refreshInFlight) return refreshInFlight;

	refreshInFlight = (async () => {
		const shouldNotifyExpiration = Boolean(getAuthSnapshot() || getIdentitySnapshot());
		try {
			const session = await refreshAuthentication();
			authSession.set(session);
			return session;
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				clearAuthentication();
				if (shouldNotifyExpiration) {
					showValidationToast('Sua sessão expirou. Conecte novamente com sua identidade Nostr.');
				}
				return null;
			}
			throw error;
		} finally {
			refreshInFlight = null;
		}
	})();

	return refreshInFlight;
}

async function getValidAccessToken(forceRefresh: boolean, rejectedToken?: string) {
	const current = getAuthSnapshot();
	if (
		current &&
		(!forceRefresh || (rejectedToken && current.accessToken !== rejectedToken)) &&
		!expiresSoon(current)
	) {
		return current.accessToken;
	}

	return (await refreshSession())?.accessToken ?? null;
}

export async function loginWithNip07() {
	const identity = await connectWithNip07();
	let challenge;

	try {
		challenge = await createChallenge(identity.pubkey);
	} catch (error) {
		if (!(error instanceof ApiError) || error.status !== 404) throw error;
		challenge = await register(identity.npub);
	}

	const event = await signAuthenticationChallenge(challenge.challenge);
	const session = await verifyChallenge(challenge, event);

	if (session.user.publicKey.toLowerCase() !== identity.pubkey.toLowerCase()) {
		throw new Error('A API autenticou uma chave diferente da identidade conectada.');
	}

	authSession.set(session);
	return session;
}

export async function restoreSession() {
	const session = getAuthSnapshot();
	if (!session) {
		try {
			return Boolean(await refreshSession());
		} catch {
			return false;
		}
	}

	try {
		const user = await getAuthenticatedUser(session.accessToken);
		authSession.set({ ...session, user });
		return true;
	} catch (error) {
		if (error instanceof ApiError && error.status === 401) {
			clearAuthentication();
			return false;
		}
		return true;
	}
}

export async function logout() {
	try {
		await revokeSession();
	} catch {
		// Local logout must still succeed if the API is unavailable or the token already expired.
	} finally {
		clearAuthentication();
	}
}

export async function refreshSessionIfNeeded() {
	const session = getAuthSnapshot();
	if (session && !expiresSoon(session)) return true;
	return Boolean(await refreshSession());
}

configureAuthLifecycle({
	getAccessToken: getValidAccessToken,
	onAuthenticationFailed: clearAuthentication
});
