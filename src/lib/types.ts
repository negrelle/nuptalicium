export type Frequency = 'monthly' | 'quarterly' | 'annual';
export type DurationType = 'indefinite' | 'fixed';
export type ContractStatus = 'draft' | 'active' | 'disputed' | 'resolved';

export interface CustomClause {
	title: string;
	description: string;
	proof_standard: string;
}

export interface ContractDraft {
	version: 1;
	contract_title: string;
	npub_a: string;
	npub_b: string;
	arbitrator_a: string;
	arbitrator_b: string;
	arbitrator_neutral: string;
	has_initial_collateral: boolean;
	collateral_sats_a: number;
	collateral_sats_b: number;
	has_periodic_contributions: boolean;
	frequency: Frequency;
	contribution_sats_a: number;
	contribution_sats_b: number;
	grace_days: number;
	duration_type: DurationType;
	duration_years: number;
	has_deadmans_switch: boolean;
	timeout_days: number;
	heir_address_a: string;
	heir_address_b: string;
	unilateral_dissolution_allowed: boolean;
	notice_days: number;
	penalty_sats: number;
	fidelity_clause: boolean;
	proof_standard: string;
	custom_clauses: CustomClause[];
}

export interface ContractDocumentBundle {
	document: string;
	hashHex: string;
	json: ContractDraft;
}

export interface ContractArtifact {
	eventId: string;
	contractHash: string;
	multisigAddress: string;
	multisigScriptHex: string;
	multisigRedeemHex: string;
	partyAddresses: [string, string];
	balanceSats: number;
	status: ContractStatus;
}

export interface Identity {
	pubkey: string;
	npub: string;
	relayUrl: string;
}

export interface AuthUser {
	id: string;
	publicKey: string;
}

export interface AuthSession {
	accessToken: string;
	expiresAt: string;
	user: AuthUser;
}

export interface ContractRecord {
	id: string;
	eventId: string;
	contractHash: string;
	title: string;
	counterparty: string;
	status: ContractStatus;
	balanceSats: number;
	multisigAddress: string;
	draft: ContractDraft;
}
