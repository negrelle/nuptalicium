import { API_BASE_URL } from '$lib/config';
import type { AuthSession, AuthUser } from '$lib/types';
import type { SignedNostrContractEvent } from '$lib/nostr';

interface ApiErrorBody {
	message?: string;
	details?: string;
	errors?: Record<string, string>;
}

export interface ChallengeResponse {
	challengeId: string;
	challenge: string;
	expiresAt: string;
}

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		message: string,
		public readonly body?: ApiErrorBody
	) {
		super(message);
		this.name = 'ApiError';
	}
}

async function request<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
	const headers = new Headers(init.headers);
	headers.set('Accept', 'application/json');
	if (init.body) headers.set('Content-Type', 'application/json');
	if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

	const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
	const body = response.status === 204 ? undefined : await response.json().catch(() => undefined);

	if (!response.ok) {
		const error = body as ApiErrorBody | undefined;
		throw new ApiError(
			response.status,
			error?.message || `A API respondeu com status ${response.status}.`,
			error
		);
	}

	return body as T;
}

export function register(npub: string, displayName?: string) {
	return request<ChallengeResponse>('/auth/register', {
		method: 'POST',
		body: JSON.stringify({ npub, displayName: displayName || null })
	});
}

export function createChallenge(publicKey: string) {
	return request<ChallengeResponse>('/auth/challenge', {
		method: 'POST',
		body: JSON.stringify({ publicKey })
	});
}

export function verifyChallenge(challenge: ChallengeResponse, event: SignedNostrContractEvent) {
	return request<AuthSession>('/auth/verify', {
		method: 'POST',
		body: JSON.stringify({
			challengeId: challenge.challengeId,
			challenge: challenge.challenge,
			event
		})
	});
}

export function getAuthenticatedUser(accessToken: string) {
	return request<AuthUser>('/auth/me', {}, accessToken);
}

export function revokeSession(accessToken: string) {
	return request<void>('/auth/logout', { method: 'POST' }, accessToken);
}
