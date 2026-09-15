import { browser } from '$app/environment';
import { DEFAULT_RELAY_URL } from '$lib/config';
import type { ContractDraft } from '$lib/types';
import { nip19, SimplePool, type Event as NostrEvent, type Filter } from 'nostr-tools';

export const relayPool = new SimplePool();

export interface SignedNostrContractEvent extends NostrEvent {
	content: string;
}

export interface DisputePayload {
	contractId: string;
	clauseTitle: string;
	proofStandard: string;
	evidence: string;
}

export interface VerdictPayload {
	contractId: string;
	disputeId: string;
	verdict: string;
}

export const AUTH_EVENT_KIND = 27235;
export const AUTH_DOMAIN = 'nuptalicium';

export function getRelayUrl(preferredRelayUrl?: string) {
	return preferredRelayUrl || DEFAULT_RELAY_URL;
}

export function npubToPubkey(npub: string) {
	const decoded = nip19.decode(npub);
	if (decoded.type !== 'npub') {
		throw new Error('Formato de npub inválido.');
	}

	return decoded.data;
}

export function pubkeyToNpub(pubkey: string) {
	return nip19.npubEncode(pubkey);
}

export function makeContractTags(draft: ContractDraft, contractHash: string) {
	return [
		['d', contractHash],
		['p', npubToPubkey(draft.npub_a)],
		['p', npubToPubkey(draft.npub_b)],
		['p', npubToPubkey(draft.arbitrator_a)],
		['p', npubToPubkey(draft.arbitrator_b)],
		['p', npubToPubkey(draft.arbitrator_neutral)]
	];
}

export async function signEvent(content: string, kind: number, tags: string[][]) {
	if (!browser || !window.nostr) {
		throw new Error('NIP-07 não está disponível neste navegador.');
	}

	const draftEvent = {
		content,
		created_at: Math.floor(Date.now() / 1000),
		kind,
		tags,
		pubkey: await window.nostr.getPublicKey()
	};

	return (await window.nostr.signEvent(draftEvent)) as SignedNostrContractEvent;
}

export function signAuthenticationChallenge(challenge: string) {
	return signEvent('', AUTH_EVENT_KIND, [
		['challenge', challenge],
		['domain', AUTH_DOMAIN]
	]);
}

export async function publishEvent(event: SignedNostrContractEvent, relayUrl = DEFAULT_RELAY_URL) {
	await relayPool.publish([relayUrl], event);
	return event;
}

export async function signAndPublishEvent(
	content: string,
	kind: number,
	tags: string[][],
	relayUrl = DEFAULT_RELAY_URL
) {
	const signed = await signEvent(content, kind, tags);
	await publishEvent(signed, relayUrl);
	return signed;
}

export async function queryEvents(filter: Filter, relayUrl = DEFAULT_RELAY_URL) {
	return relayPool.querySync([relayUrl], filter);
}

export function parseContractContent(content: string) {
	try {
		return JSON.parse(content) as ContractDraft;
	} catch {
		return null;
	}
}

export async function fetchContractEvent(contractId: string, relayUrl = DEFAULT_RELAY_URL) {
	const events = await queryEvents({ kinds: [30000], ids: [contractId], limit: 1 }, relayUrl);
	return events[0] ?? null;
}

export async function fetchContractEvents(contractId: string, relayUrl = DEFAULT_RELAY_URL) {
	return queryEvents({ kinds: [30000, 30001, 30002, 30003], '#e': [contractId] }, relayUrl);
}

export async function fetchContractsForIdentity(npub: string, relayUrl = DEFAULT_RELAY_URL) {
	const events = await queryEvents({ kinds: [30000], limit: 200 }, relayUrl);
	return events.filter((event) => {
		const parsed = parseContractContent(event.content);
		if (!parsed) return false;
		return parsed.npub_a === npub || parsed.npub_b === npub;
	});
}

export async function publishPresenceEvent(contractId: string, relayUrl = DEFAULT_RELAY_URL) {
	return signAndPublishEvent(
		JSON.stringify({ contractId, type: 'presence' }),
		30001,
		[['e', contractId]],
		relayUrl
	);
}

export async function publishDisputeEvent(payload: DisputePayload, relayUrl = DEFAULT_RELAY_URL) {
	return signAndPublishEvent(
		JSON.stringify(payload),
		30002,
		[
			['e', payload.contractId],
			['d', payload.clauseTitle]
		],
		relayUrl
	);
}

export async function publishVerdictEvent(payload: VerdictPayload, relayUrl = DEFAULT_RELAY_URL) {
	return signAndPublishEvent(
		JSON.stringify(payload),
		30003,
		[
			['e', payload.contractId],
			['d', payload.disputeId]
		],
		relayUrl
	);
}

export async function fetchVerdictEvents(disputeId: string, relayUrl = DEFAULT_RELAY_URL) {
	return queryEvents({ kinds: [30003], '#d': [disputeId] }, relayUrl);
}

export async function fetchPresenceEvents(
	contractId: string,
	pubkey: string,
	relayUrl = DEFAULT_RELAY_URL
) {
	return queryEvents({ kinds: [30001], authors: [pubkey], '#e': [contractId] }, relayUrl);
}
