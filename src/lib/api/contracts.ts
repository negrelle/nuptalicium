import { apiRequest } from '$lib/api/client';
import type { SignedNostrContractEvent } from '$lib/nostr';

export type ContractStatus =
	| 'DRAFT'
	| 'PENDING_ACCEPTANCE'
	| 'ACTIVE'
	| 'CLOSED'
	| 'CANCELLED'
	| 'EXPIRED';
export type ParticipantRole =
	| 'SPOUSE_A'
	| 'SPOUSE_B'
	| 'ARBITRATOR_A'
	| 'ARBITRATOR_B'
	| 'ARBITRATOR_NEUTRAL';
export type ClauseKind = 'CONCEPT' | 'RULE';
export type PenaltyType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface ContractParticipant {
	id: string;
	publicKey: string;
	displayName: string | null;
	role: ParticipantRole;
	accepted: boolean;
}

export interface ClausePenalty {
	id: string;
	type: PenaltyType;
	value: number;
	condition: string | null;
	description: string;
}

export interface ContractClause {
	id: string;
	title: string;
	contractId: string;
	kind: ClauseKind;
	description: string;
	position: number;
	penalties: ClausePenalty[];
}

export interface ContractAcceptance {
	id: string;
	userId: string;
	contractId: string;
	decisionId: string | null;
	role: string;
	purpose: string;
	payloadHash: string;
	signedAt: string;
	createdAt: string;
}

export interface Contract {
	id: string;
	title: string | null;
	issuedAt: string;
	status: ContractStatus;
	expiresAt: string | null;
	feePercArbitratorA: number;
	feePercArbitratorB: number;
	feePercArbitratorNeutral: number | null;
	platformFeePerc: number;
	payloadHash: string;
	allRequiredAcceptances: boolean;
	participants: ContractParticipant[];
	clauses: ContractClause[];
	acceptances: ContractAcceptance[];
}

export interface ContractPayload {
	title: string | null;
	spouseBPublicKey: string;
	arbitratorAPublicKey: string;
	arbitratorBPublicKey: string;
	arbitratorNeutralPublicKey: string | null;
	feePercArbitratorA: number;
	feePercArbitratorB: number;
	feePercArbitratorNeutral: number | null;
	expiresAt: string | null;
}

export interface ClausePayload {
	title: string;
	kind: ClauseKind;
	description: string;
	position: number;
}

export interface PenaltyPayload {
	type: PenaltyType;
	value: number;
	condition: string | null;
	description: string;
}

export interface ApiPage<T> {
	content: T[];
	totalElements: number;
	totalPages: number;
	number: number;
	size: number;
	first: boolean;
	last: boolean;
}

export function listContracts(
	accessToken: string,
	filters: { status?: ContractStatus | ''; page?: number; size?: number } = {}
) {
	const search = new URLSearchParams();
	if (filters.status) search.set('status', filters.status);
	search.set('page', String(filters.page ?? 0));
	search.set('size', String(filters.size ?? 10));
	return apiRequest<ApiPage<Contract>>(`/contracts?${search}`, {}, accessToken);
}

export function getContract(accessToken: string, contractId: string) {
	return apiRequest<Contract>(`/contracts/${contractId}`, {}, accessToken);
}

export function createContract(accessToken: string, payload: ContractPayload) {
	return apiRequest<Contract>(
		'/contracts',
		{ method: 'POST', body: JSON.stringify(payload) },
		accessToken
	);
}

export function updateContract(accessToken: string, contractId: string, payload: ContractPayload) {
	return apiRequest<Contract>(
		`/contracts/${contractId}`,
		{ method: 'PUT', body: JSON.stringify(payload) },
		accessToken
	);
}

export function submitContract(accessToken: string, contractId: string) {
	return apiRequest<Contract>(`/contracts/${contractId}/submit`, { method: 'POST' }, accessToken);
}

export function cancelContract(accessToken: string, contractId: string) {
	return apiRequest<Contract>(`/contracts/${contractId}/cancel`, { method: 'POST' }, accessToken);
}

export function acceptContract(
	accessToken: string,
	contractId: string,
	event: SignedNostrContractEvent
) {
	return apiRequest<Contract>(
		`/contracts/${contractId}/accept`,
		{ method: 'POST', body: JSON.stringify({ event }) },
		accessToken
	);
}

export function createClause(accessToken: string, contractId: string, payload: ClausePayload) {
	return apiRequest<ContractClause>(
		`/contracts/${contractId}/clauses`,
		{ method: 'POST', body: JSON.stringify(payload) },
		accessToken
	);
}

export function updateClause(
	accessToken: string,
	contractId: string,
	clauseId: string,
	payload: ClausePayload
) {
	return apiRequest<ContractClause>(
		`/contracts/${contractId}/clauses/${clauseId}`,
		{ method: 'PUT', body: JSON.stringify(payload) },
		accessToken
	);
}

export function deleteClause(accessToken: string, contractId: string, clauseId: string) {
	return apiRequest<void>(
		`/contracts/${contractId}/clauses/${clauseId}`,
		{ method: 'DELETE' },
		accessToken
	);
}

export function createPenalty(
	accessToken: string,
	contractId: string,
	clauseId: string,
	payload: PenaltyPayload
) {
	return apiRequest<ClausePenalty>(
		`/contracts/${contractId}/clauses/${clauseId}/penalties`,
		{ method: 'POST', body: JSON.stringify(payload) },
		accessToken
	);
}

export function updatePenalty(
	accessToken: string,
	contractId: string,
	clauseId: string,
	penaltyId: string,
	payload: PenaltyPayload
) {
	return apiRequest<ClausePenalty>(
		`/contracts/${contractId}/clauses/${clauseId}/penalties/${penaltyId}`,
		{ method: 'PUT', body: JSON.stringify(payload) },
		accessToken
	);
}

export function deletePenalty(
	accessToken: string,
	contractId: string,
	clauseId: string,
	penaltyId: string
) {
	return apiRequest<void>(
		`/contracts/${contractId}/clauses/${clauseId}/penalties/${penaltyId}`,
		{ method: 'DELETE' },
		accessToken
	);
}
