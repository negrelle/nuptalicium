import { apiRequest } from '$lib/api/client';
import type { ContractRuleDefinition, ContractRulePayload } from '$lib/contract-rules';
import type { ApiPage, ContractClause } from '$lib/api/contracts';

export type PublishedClauseType = 'RULE' | 'CONCEPT';
export type PublishedClauseVisibility = 'PUBLIC' | 'PRIVATE';
export type PublishedClauseStatus = 'DRAFT' | 'PUBLISHED';
export type PublishedClauseCategory =
	| 'PATRIMONY'
	| 'RELATIONSHIP'
	| 'FINANCIAL'
	| 'SEPARATION'
	| 'RESPONSIBILITIES'
	| 'PRIVACY'
	| 'PROPERTY'
	| 'MARITAL_OBLIGATIONS'
	| 'CHILDREN'
	| 'SUCCESSION'
	| 'ARBITRATION'
	| 'OTHER';

export const CATEGORY_LABELS: Record<PublishedClauseCategory, string> = {
	PATRIMONY: 'Patrimônio',
	RELATIONSHIP: 'Relacionamento',
	FINANCIAL: 'Financeiro',
	SEPARATION: 'Separação',
	RESPONSIBILITIES: 'Responsabilidades',
	PRIVACY: 'Privacidade',
	PROPERTY: 'Patrimônio e bens',
	MARITAL_OBLIGATIONS: 'Compromissos matrimoniais',
	CHILDREN: 'Filhos e responsabilidades',
	SUCCESSION: 'Falecimento e sucessão',
	ARBITRATION: 'Arbitragem',
	OTHER: 'Outros'
};

export interface PublishedClauseAuthor {
	id: string;
	displayName: string | null;
	publicKey: string;
}

export interface PublishedClause {
	id: string;
	author: PublishedClauseAuthor;
	type: PublishedClauseType;
	visibility: PublishedClauseVisibility;
	status: PublishedClauseStatus;
	title: string;
	summary: string | null;
	category: PublishedClauseCategory;
	conceptText: string | null;
	ruleDefinition: ContractRuleDefinition | null;
	dslVersion: '1' | null;
	generatedDescription: string | null;
	ratingAverage: number;
	ratingCount: number;
	myRating: number | null;
	active: boolean;
	createdAt: string;
	updatedAt: string;
	publishedAt: string | null;
}

export interface PublishedClausePayload {
	type: PublishedClauseType;
	visibility: PublishedClauseVisibility;
	title: string;
	summary: string | null;
	category: PublishedClauseCategory;
	conceptText: string | null;
	rule: ContractRulePayload | null;
}

export interface MarketplaceFilters {
	search?: string;
	type?: PublishedClauseType | '';
	category?: PublishedClauseCategory | '';
	sort?: 'recent' | 'rating' | 'ratingCount';
	page?: number;
	size?: number;
}

export function listPublishedClauses(accessToken: string, filters: MarketplaceFilters = {}) {
	const search = new URLSearchParams();
	if (filters.search) search.set('search', filters.search);
	if (filters.type) search.set('type', filters.type);
	if (filters.category) search.set('category', filters.category);
	search.set('sort', filters.sort ?? 'recent');
	search.set('page', String(filters.page ?? 0));
	search.set('size', String(filters.size ?? 20));
	return apiRequest<ApiPage<PublishedClause>>(`/published-clauses?${search}`, {}, accessToken);
}

export function listMyPublishedClauses(accessToken: string, page = 0, size = 20) {
	return apiRequest<ApiPage<PublishedClause>>(
		`/published-clauses/mine?page=${page}&size=${size}`,
		{},
		accessToken
	);
}

export function getPublishedClause(accessToken: string, id: string) {
	return apiRequest<PublishedClause>(`/published-clauses/${id}`, {}, accessToken);
}

export function createPublishedClause(accessToken: string, payload: PublishedClausePayload) {
	return apiRequest<PublishedClause>(
		'/published-clauses',
		{ method: 'POST', body: JSON.stringify(payload) },
		accessToken
	);
}

export function updatePublishedClause(
	accessToken: string,
	id: string,
	payload: PublishedClausePayload
) {
	return apiRequest<PublishedClause>(
		`/published-clauses/${id}`,
		{ method: 'PUT', body: JSON.stringify(payload) },
		accessToken
	);
}

export function publishClause(accessToken: string, id: string) {
	return apiRequest<PublishedClause>(
		`/published-clauses/${id}/publish`,
		{ method: 'POST' },
		accessToken
	);
}

export function deletePublishedClause(accessToken: string, id: string) {
	return apiRequest<void>(`/published-clauses/${id}`, { method: 'DELETE' }, accessToken);
}

export function ratePublishedClause(accessToken: string, id: string, rating: number) {
	return apiRequest<PublishedClause>(
		`/published-clauses/${id}/rating`,
		{ method: 'PUT', body: JSON.stringify({ rating }) },
		accessToken
	);
}

export function removePublishedClauseRating(accessToken: string, id: string) {
	return apiRequest<void>(`/published-clauses/${id}/rating`, { method: 'DELETE' }, accessToken);
}

export function copyPublishedClauseToContract(
	accessToken: string,
	contractId: string,
	publishedClauseId: string,
	position: number
) {
	return apiRequest<ContractClause>(
		`/contracts/${contractId}/clauses/from-library/${publishedClauseId}`,
		{ method: 'POST', body: JSON.stringify({ position }) },
		accessToken
	);
}
