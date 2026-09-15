import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { nip19 } from 'nostr-tools';
import { DEFAULT_RELAY_URL, IDENTITY_STORAGE_KEY } from '$lib/config';
import type { Identity } from '$lib/types';

function readIdentity(): Identity | null {
	if (!browser) return null;

	const raw = localStorage.getItem(IDENTITY_STORAGE_KEY);
	if (!raw) return null;

	try {
		return JSON.parse(raw) as Identity;
	} catch {
		return null;
	}
}

const identity = writable<Identity | null>(readIdentity());

if (browser) {
	identity.subscribe((value) => {
		if (value) {
			localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(value));
		} else {
			localStorage.removeItem(IDENTITY_STORAGE_KEY);
		}
	});
}

export const identityStore = {
	subscribe: identity.subscribe,
	set: identity.set,
	update: identity.update
};

export function getIdentitySnapshot() {
	return get(identity);
}

export function clearIdentity() {
	identity.set(null);
}

export function updateRelayUrl(relayUrl: string) {
	identity.update((current) => {
		if (!current) {
			return {
				pubkey: '',
				npub: '',
				relayUrl: relayUrl || DEFAULT_RELAY_URL
			};
		}

		return {
			...current,
			relayUrl: relayUrl || DEFAULT_RELAY_URL
		};
	});
}

export async function connectWithNip07() {
	if (!browser || !window.nostr) {
		throw new Error('NIP-07 não está disponível neste navegador.');
	}

	const pubkey = await window.nostr.getPublicKey();
	const npub = nip19.npubEncode(pubkey);
	const current = getIdentitySnapshot();

	const nextIdentity: Identity = {
		pubkey,
		npub,
		relayUrl: current?.relayUrl || DEFAULT_RELAY_URL
	};

	identity.set(nextIdentity);
	return nextIdentity;
}

export function ensureIdentityRelayUrl() {
	const current = getIdentitySnapshot();

	if (current) return current.relayUrl;
	return DEFAULT_RELAY_URL;
}
