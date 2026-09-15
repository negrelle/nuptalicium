import { apiRequest } from '$lib/api/client';

export interface UserSearchResult {
	id: string;
	publicKey: string;
	displayName: string | null;
}

export function searchUsers(accessToken: string, query: string, limit = 8) {
	const search = new URLSearchParams({ q: query, limit: String(limit) });
	return apiRequest<UserSearchResult[]>(`/users/search?${search}`, {}, accessToken);
}
