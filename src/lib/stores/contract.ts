import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { CONTRACTS_STORAGE_KEY } from '$lib/config';
import type { ContractRecord } from '$lib/types';

function readContracts(): ContractRecord[] {
	if (!browser) return [];

	const raw = localStorage.getItem(CONTRACTS_STORAGE_KEY);
	if (!raw) return [];

	try {
		return JSON.parse(raw) as ContractRecord[];
	} catch {
		return [];
	}
}

const contracts = writable<ContractRecord[]>(readContracts());
const activeContractId = writable<string | null>(null);

if (browser) {
	contracts.subscribe((value) => {
		localStorage.setItem(CONTRACTS_STORAGE_KEY, JSON.stringify(value));
	});
}

export const contractStore = {
	subscribe: contracts.subscribe,
	set: contracts.set,
	update: contracts.update
};

export const activeContractStore = {
	subscribe: activeContractId.subscribe,
	set: activeContractId.set,
	update: activeContractId.update
};

export function upsertContract(contract: ContractRecord) {
	contracts.update((current) => {
		const index = current.findIndex((item) => item.id === contract.id);
		if (index === -1) return [contract, ...current];
		const next = current.slice();
		next[index] = contract;
		return next;
	});
}

export function setContracts(nextContracts: ContractRecord[]) {
	contracts.set(nextContracts);
}

export function setActiveContract(id: string | null) {
	activeContractId.set(id);
}
