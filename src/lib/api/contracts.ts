import { apiRequest } from '$lib/api/client';
import type { SignedNostrContractEvent } from '$lib/nostr';

export type ContractStatus =
	| 'DRAFT'
	| 'PENDING_ACCEPTANCE'
	| 'AWAITING_FUNDING'
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

export interface FundingTransaction {
	id: string;
	txid: string;
	vout: number;
	amountSats: number;
	confirmations: number;
	status: 'PENDING' | 'CONFIRMED' | 'SPENT' | 'REPLACED' | 'FAILED';
}

export interface BitcoinWallet {
	contractId: string;
	walletId: string;
	network: string;
	address: string;
	scriptPubKey: string;
	policyHash: string;
	policyDocument: string;
	arbitratorsQuorum: 2;
	status: 'PROPOSED' | 'AWAITING_FUNDING' | 'FUNDED' | 'CLOSED';
	confirmedBalanceSats: number;
	requiredConfirmations: number;
	platformFeePercent: number;
	platformFeeAddress: string;
	fundingTransactions: FundingTransaction[];
}

export type DecisionState =
	| 'AWAITING_SPOUSE'
	| 'ARBITRATION'
	| 'APPROVED'
	| 'REJECTED'
	| 'SETTLING'
	| 'SETTLED'
	| 'CANCELLED';

export interface DecisionClause {
	id: string;
	decisionId: string;
	clauseId: string;
	violated: boolean;
	note: string | null;
	calculatedPenaltySats: number;
}

export interface Decision {
	id: string;
	contractId: string;
	userId: string;
	reason: string;
	result: string | null;
	status: DecisionState;
	beneficiaryAddress: string;
	calculationBaseSats: number;
	totalPenaltySats: number;
	spendRequestEventId: string | null;
	createdAt: string;
	updatedAt: string;
	clauses: DecisionClause[];
}

export interface DecisionVote {
	id: string;
	decisionId: string;
	voterId: string;
	outcome: 'APPROVE' | 'REJECT';
	rationale: string | null;
	createdAt: string;
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

export function initializeMultisig(
	accessToken: string,
	contractId: string,
	payload: {
		network: 'testnet4';
		address: string;
		scriptPubKey: string;
		policyHash: string;
		policyDocument: string;
		arbitratorsQuorum: 2;
	}
) {
	return apiRequest<BitcoinWallet>(
		`/contracts/${contractId}/multisig`,
		{ method: 'POST', body: JSON.stringify(payload) },
		accessToken
	);
}

export function getMultisig(accessToken: string, contractId: string) {
	return apiRequest<BitcoinWallet>(`/contracts/${contractId}/multisig`, {}, accessToken);
}

export function registerFunding(
	accessToken: string,
	contractId: string,
	txid: string,
	vout: number
) {
	return apiRequest<BitcoinWallet>(
		`/contracts/${contractId}/funding`,
		{ method: 'POST', body: JSON.stringify({ txid, vout }) },
		accessToken
	);
}

export function refreshFunding(accessToken: string, contractId: string) {
	return apiRequest<BitcoinWallet>(`/contracts/${contractId}/funding`, {}, accessToken);
}

export function createDecision(
	accessToken: string,
	contractId: string,
	payload: { reason: string; beneficiaryAddress: string; clauseIds: string[] }
) {
	return apiRequest<Decision>(
		`/contracts/${contractId}/decisions`,
		{ method: 'POST', body: JSON.stringify(payload) },
		accessToken
	);
}

export function listDecisions(accessToken: string, contractId: string) {
	return apiRequest<Decision[]>(`/contracts/${contractId}/decisions`, {}, accessToken);
}

export function getDecision(accessToken: string, decisionId: string) {
	return apiRequest<Decision>(`/decisions/${decisionId}`, {}, accessToken);
}

export function listDecisionVotes(accessToken: string, decisionId: string) {
	return apiRequest<DecisionVote[]>(`/decisions/${decisionId}/votes`, {}, accessToken);
}

export function voteOnDecision(
	accessToken: string,
	decisionId: string,
	outcome: 'APPROVE' | 'REJECT',
	rationale: string
) {
	return apiRequest<DecisionVote>(
		`/decisions/${decisionId}/votes`,
		{ method: 'POST', body: JSON.stringify({ outcome, rationale }) },
		accessToken
	);
}

export function startDecisionSettlement(accessToken: string, decisionId: string, eventId: string) {
	return apiRequest<Decision>(
		`/decisions/${decisionId}/resolve`,
		{ method: 'POST', body: JSON.stringify({ note: eventId }) },
		accessToken
	);
}

export function broadcastDecision(
	accessToken: string,
	decisionId: string,
	rawTransactionHex: string
) {
	return apiRequest<{ decisionId: string; txid: string; status: string }>(
		`/decisions/${decisionId}/broadcast`,
		{ method: 'POST', body: JSON.stringify({ rawTransactionHex }) },
		accessToken
	);
}
