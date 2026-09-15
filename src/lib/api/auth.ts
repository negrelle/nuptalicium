import type { AuthSession, AuthUser } from '$lib/types';
import type { SignedNostrContractEvent } from '$lib/nostr';
import { apiRequest } from '$lib/api/client';

export interface ChallengeResponse {
	challengeId: string;
	challenge: string;
	expiresAt: string;
}

export { ApiError } from '$lib/api/client';

export function register(npub: string, displayName?: string) {
	return apiRequest<ChallengeResponse>('/auth/register', {
		method: 'POST',
		body: JSON.stringify({ npub, displayName: displayName || null })
	});
}

export function createChallenge(publicKey: string) {
	return apiRequest<ChallengeResponse>('/auth/challenge', {
		method: 'POST',
		body: JSON.stringify({ publicKey })
	});
}

export function verifyChallenge(challenge: ChallengeResponse, event: SignedNostrContractEvent) {
	return apiRequest<AuthSession>('/auth/verify', {
		method: 'POST',
		body: JSON.stringify({
			challengeId: challenge.challengeId,
			challenge: challenge.challenge,
			event
		})
	});
}

export function getAuthenticatedUser(accessToken: string) {
	return apiRequest<AuthUser>('/auth/me', {}, accessToken);
}

export function revokeSession(accessToken: string) {
	return apiRequest<void>('/auth/logout', { method: 'POST' }, accessToken);
}
