import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { IDENTITY_STORAGE_KEY, WIZARD_STORAGE_KEY } from '$lib/config';
import type { ContractDraft, ContractArtifact, DurationType, Frequency } from '$lib/types';

export interface WizardState {
	step: number;
	draft: ContractDraft;
	contractArtifact: ContractArtifact | null;
	publishError: string;
	publishing: boolean;
}

function defaultDraft(npub = ''): ContractDraft {
	return {
		version: 1,
		contract_title: '',
		npub_a: npub,
		npub_b: '',
		arbitrator_a: '',
		arbitrator_b: '',
		arbitrator_neutral: '',
		has_initial_collateral: false,
		collateral_sats_a: 0,
		collateral_sats_b: 0,
		has_periodic_contributions: false,
		frequency: 'monthly',
		contribution_sats_a: 0,
		contribution_sats_b: 0,
		grace_days: 7,
		duration_type: 'indefinite',
		duration_years: 0,
		has_deadmans_switch: false,
		timeout_days: 7,
		heir_address_a: '',
		heir_address_b: '',
		unilateral_dissolution_allowed: false,
		notice_days: 7,
		penalty_sats: 0,
		fidelity_clause: false,
		proof_standard: '',
		custom_clauses: []
	};
}

function createDefaultWizardState(): WizardState {
	let npub = '';

	if (browser) {
		const identity = localStorage.getItem(IDENTITY_STORAGE_KEY);
		if (identity) {
			try {
				npub = (JSON.parse(identity) as { npub?: string }).npub || '';
			} catch {
				npub = '';
			}
		}
	}

	return {
		step: 0,
		draft: defaultDraft(npub),
		contractArtifact: null,
		publishError: '',
		publishing: false
	};
}

function readWizardState(): WizardState {
	if (!browser) return createDefaultWizardState();

	const raw = localStorage.getItem(WIZARD_STORAGE_KEY);
	if (!raw) return createDefaultWizardState();

	try {
		const parsed = JSON.parse(raw) as WizardState;
		return {
			...createDefaultWizardState(),
			...parsed,
			draft: {
				...defaultDraft(parsed.draft?.npub_a || ''),
				...parsed.draft
			}
		};
	} catch {
		return createDefaultWizardState();
	}
}

const wizard = writable<WizardState>(readWizardState());

if (browser) {
	wizard.subscribe((value) => {
		localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(value));
	});
}

export const wizardStore = {
	subscribe: wizard.subscribe,
	set: wizard.set,
	update: wizard.update
};

export function resetWizard(npub = '') {
	wizard.set({
		...createDefaultWizardState(),
		draft: defaultDraft(npub)
	});
}

export function setWizardStep(step: number) {
	wizard.update((value) => ({ ...value, step }));
}

export function setWizardDraft(updater: (draft: ContractDraft) => ContractDraft) {
	wizard.update((value) => ({ ...value, draft: updater(value.draft) }));
}

export function patchWizardDraft(patch: Partial<ContractDraft>) {
	wizard.update((value) => ({
		...value,
		draft: {
			...value.draft,
			...patch
		}
	}));
}

export function setFrequency(frequency: Frequency) {
	patchWizardDraft({ frequency });
}

export function setDurationType(duration_type: DurationType) {
	patchWizardDraft({ duration_type });
}

export function setPublishingState(publishing: boolean, publishError = '') {
	wizard.update((value) => ({ ...value, publishing, publishError }));
}

export function setPublishedArtifact(contractArtifact: ContractArtifact | null) {
	wizard.update((value) => ({ ...value, contractArtifact, publishing: false, publishError: '' }));
}

export function setWizardError(message: string) {
	wizard.update((value) => ({ ...value, publishError: message, publishing: false }));
}
