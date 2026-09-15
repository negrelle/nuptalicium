import { API_BASE_URL } from '$lib/config';

export interface ApiErrorBody {
	message?: string;
	details?: string;
	errors?: Record<string, string>;
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

export async function apiRequest<T>(
	path: string,
	init: RequestInit = {},
	accessToken?: string
): Promise<T> {
	const headers = new Headers(init.headers);
	headers.set('Accept', 'application/json');
	if (init.body) headers.set('Content-Type', 'application/json');
	if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

	const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
	const body = response.status === 204 ? undefined : await response.json().catch(() => undefined);

	if (!response.ok) {
		const error = body as ApiErrorBody | undefined;
		const validationMessage = error?.errors ? Object.values(error.errors).join(' ') : '';
		throw new ApiError(
			response.status,
			validationMessage || error?.message || `A API respondeu com status ${response.status}.`,
			error
		);
	}

	return body as T;
}
