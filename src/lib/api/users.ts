import { apiRequest } from '$lib/api/client';
import type { AuthUser } from '$lib/types';

export interface UserSearchResult {
	id: string;
	publicKey: string;
	displayName: string | null;
}

export function searchUsers(accessToken: string, query: string, limit = 8) {
	const search = new URLSearchParams({ q: query, limit: String(limit) });
	return apiRequest<UserSearchResult[]>(`/users/search?${search}`, {}, accessToken);
}

export function updateProfile(accessToken: string, displayName: string | null) {
	return apiRequest<AuthUser>(
		'/users/me',
		{
			method: 'PUT',
			body: JSON.stringify({ displayName })
		},
		accessToken
	);
}
