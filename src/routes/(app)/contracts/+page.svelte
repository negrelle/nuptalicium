<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import { createContractWallet } from '$lib/bitcoin';
	import { fetchAddressBalance } from '$lib/mempool';
	import { fetchContractsForIdentity, npubToPubkey, parseContractContent } from '$lib/nostr';
	import { identityStore } from '$lib/stores/identity';
	import type { ContractRecord, Identity } from '$lib/types';
	import { onMount } from 'svelte';
	import { networks } from 'bitcoinjs-lib';

	let identity = $state<Identity | null>(null);
	let contracts = $state<ContractRecord[]>([]);
	let loading = $state(true);
	let error = $state('');

	onMount(() => {
		const unsub = identityStore.subscribe((value) => {
			identity = value;
			if (value) void loadContracts(value);
		});

		const timer = setInterval(() => {
			if (identity) void loadContracts(identity);
		}, 30000);

		return () => {
			unsub();
			clearInterval(timer);
		};
	});

	async function loadContracts(currentIdentity: Identity) {
		loading = true;
		error = '';

		try {
			const events = await fetchContractsForIdentity(
				currentIdentity.npub,
				currentIdentity.relayUrl
			);
			const records = await Promise.all(
				events.map(async (event) => {
					const draft = parseContractContent(event.content);
					if (!draft) return null;

					const wallet = createContractWallet(
						[npubToPubkey(draft.npub_a), npubToPubkey(draft.npub_b)],
						[
							npubToPubkey(draft.arbitrator_a),
							npubToPubkey(draft.arbitrator_b),
							npubToPubkey(draft.arbitrator_neutral)
						],
						2,
						networks.bitcoin
					);
					const balanceSats = await fetchAddressBalance(wallet.multisigAddress).catch(() => 0);

					return {
						id: event.id,
						eventId: event.id,
						contractHash: event.id,
						title: draft.contract_title || 'Contrato nupcial privado',
						counterparty: draft.npub_a === currentIdentity.npub ? draft.npub_b : draft.npub_a,
						status: 'active',
						balanceSats,
						multisigAddress: wallet.multisigAddress,
						draft
					} as ContractRecord;
				})
			);

			contracts = records.filter((value): value is ContractRecord => Boolean(value));
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Não foi possível carregar os contratos.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Nupatalicium — Contratos</title>
</svelte:head>

<main class="stack-lg">
	<section class="row" style="justify-content: space-between;">
		<div class="stack" style="gap: 0.75rem;">
			<p class="muted">Contratos</p>
			<h1>Lista de contratos</h1>
		</div>
		<Button href="/new">Novo contrato</Button>
	</section>

	{#if loading}
		<Card><p>Carregando contratos…</p></Card>
	{:else if error}
		<Card><p>{error}</p></Card>
	{:else if contracts.length === 0}
		<Card>
			<div class="stack">
				<p>Nenhum contrato encontrado para a identidade conectada.</p>
				<Button href="/new">Criar o primeiro contrato</Button>
			</div>
		</Card>
	{:else}
		<div class="card-grid">
			{#each contracts as contract (contract.id)}
				<Card>
					<div class="stack">
						<div class="row" style="justify-content: space-between; align-items: start;">
							<div class="stack" style="gap: 0.35rem;">
								<h3>{contract.title}</h3>
								<p class="muted">{contract.counterparty}</p>
							</div>
							<span class="pill">{contract.status}</span>
						</div>
						<p class="muted">Saldo multisig: {contract.balanceSats} sats</p>
						<div class="row">
							<Button href={`/contracts/${contract.id}`}>Abrir dashboard</Button>
							<Button variant="ghost" href="/new">Novo contrato</Button>
						</div>
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</main>
