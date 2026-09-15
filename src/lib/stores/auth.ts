import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import {
	ApiError,
	createChallenge,
	getAuthenticatedUser,
	register,
	revokeSession,
	verifyChallenge
} from '$lib/api/auth';
import { AUTH_SESSION_STORAGE_KEY } from '$lib/config';
import { signAuthenticationChallenge } from '$lib/nostr';
import { clearIdentity, connectWithNip07 } from '$lib/stores/identity';
import type { AuthSession } from '$lib/types';

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
}

export const authStore = {
	subscribe: authSession.subscribe
};

export function getAuthSnapshot() {
	return get(authSession);
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
	if (!session) return false;

	try {
		const user = await getAuthenticatedUser(session.accessToken);
		authSession.set({ ...session, user });
		return true;
	} catch {
		authSession.set(null);
		clearIdentity();
		return false;
	}
}

export async function logout() {
	const session = getAuthSnapshot();
	try {
		if (session) await revokeSession(session.accessToken);
	} catch {
		// Local logout must still succeed if the API is unavailable or the token already expired.
	} finally {
		authSession.set(null);
		clearIdentity();
	}
}
