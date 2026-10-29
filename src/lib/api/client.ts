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

interface AuthLifecycle {
	getAccessToken(forceRefresh: boolean, rejectedToken?: string): Promise<string | null>;
	onAuthenticationFailed(): void;
}

let authLifecycle: AuthLifecycle | null = null;

export function configureAuthLifecycle(lifecycle: AuthLifecycle) {
	authLifecycle = lifecycle;
}

async function executeRequest(path: string, init: RequestInit, accessToken?: string) {
	const headers = new Headers(init.headers);
	headers.set('Accept', 'application/json');
	if (init.body) headers.set('Content-Type', 'application/json');
	if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
	else headers.delete('Authorization');

	return fetch(`${API_BASE_URL}${path}`, {
		...init,
		headers,
		credentials: init.credentials ?? 'include'
	});
}

async function parseResponse<T>(response: Response): Promise<T> {
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

export async function apiRequest<T>(
	path: string,
	init: RequestInit = {},
	accessToken?: string
): Promise<T> {
	let requestToken = accessToken;
	if (requestToken && authLifecycle) {
		requestToken = (await authLifecycle.getAccessToken(false, requestToken)) ?? undefined;
		if (!requestToken) {
			authLifecycle.onAuthenticationFailed();
			throw new ApiError(401, 'Sua sessão expirou. Entre novamente para continuar.');
		}
	}

	let response = await executeRequest(path, init, requestToken);
	if (response.status === 401 && requestToken && authLifecycle) {
		const refreshedToken = await authLifecycle.getAccessToken(true, requestToken);
		if (refreshedToken) {
			response = await executeRequest(path, init, refreshedToken);
		}
		if (response.status === 401 || !refreshedToken) authLifecycle.onAuthenticationFailed();
	}

	return parseResponse<T>(response);
}
