import { MEMPOOL_BASE_URL } from '$lib/config';

export interface MempoolUtxo {
	txid: string;
	vout: number;
	value: number;
	status: { confirmed: boolean };
}

export interface AddressSummary {
	address: string;
	chain_stats: { funded_txo_sum: number; spent_txo_sum: number };
	mempool_stats: { funded_txo_sum: number; spent_txo_sum: number };
}

export async function fetchAddressSummary(address: string) {
	const response = await fetch(`${MEMPOOL_BASE_URL}/address/${address}`);
	if (!response.ok) {
		throw new Error('Não foi possível consultar o saldo do endereço no mempool.space.');
	}

	return (await response.json()) as AddressSummary;
}

export async function fetchAddressBalance(address: string) {
	const summary = await fetchAddressSummary(address);
	const chain = summary.chain_stats.funded_txo_sum - summary.chain_stats.spent_txo_sum;
	const mempool = summary.mempool_stats.funded_txo_sum - summary.mempool_stats.spent_txo_sum;
	return chain + mempool;
}

export async function fetchAddressUtxos(address: string) {
	const response = await fetch(`${MEMPOOL_BASE_URL}/address/${address}/utxo`);
	if (!response.ok) {
		throw new Error('Não foi possível consultar os UTXOs do endereço.');
	}

	return (await response.json()) as MempoolUtxo[];
}
