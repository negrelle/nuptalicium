<script lang="ts">
	import { networks } from 'bitcoinjs-lib';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import QRCode from '$lib/components/QRCode.svelte';
	import {
		buildSignedDissolutionPsbt,
		createContractWallet,
		createNip07TaprootSigner
	} from '$lib/bitcoin';
	import { fetchAddressBalance, fetchAddressUtxos } from '$lib/mempool';
	import {
		fetchContractEvent,
		fetchContractEvents,
		fetchPresenceEvents,
		npubToPubkey,
		parseContractContent,
		publishPresenceEvent
	} from '$lib/nostr';
	import { identityStore } from '$lib/stores/identity';
	import type { ContractDraft, Identity } from '$lib/types';
	import { onMount } from 'svelte';

	let { data }: { data: { contractId: string } } = $props();
	let identity = $state<Identity | null>(null);
	let draft = $state<ContractDraft | null>(null);
	let balanceSats = $state(0);
	let address = $state('');
	let status = $state<'active' | 'disputed' | 'resolved'>('active');
	let recentEvents = $state<Array<{ id: string; kind: number; created_at: number }>>([]);
	let deadmanCountdown = $state('');
	let partialPsbt = $state('');
	let loading = $state(true);
	let error = $state('');

	onMount(() => {
		const unsub = identityStore.subscribe((value) => {
			identity = value;
			if (value) {
				void load(value);
			}
		});

		const timer = setInterval(() => {
			if (address) {
				void refreshBalance();
			}
		}, 30000);

		return () => {
			unsub();
			clearInterval(timer);
		};
	});

	async function load(currentIdentity: Identity) {
		loading = true;
		error = '';

		try {
			const event = await fetchContractEvent(data.contractId, currentIdentity.relayUrl);
			if (!event) throw new Error('Contrato não encontrado no relay configurado.');

			const parsed = parseContractContent(event.content);
			if (!parsed) throw new Error('O conteúdo do contrato não é válido.');

			draft = parsed;
			const wallet = createContractWallet(
				[npubToPubkey(parsed.npub_a), npubToPubkey(parsed.npub_b)],
				[
					npubToPubkey(parsed.arbitrator_a),
					npubToPubkey(parsed.arbitrator_b),
					npubToPubkey(parsed.arbitrator_neutral)
				],
				2,
				networks.bitcoin
			);

			address = wallet.multisigAddress;
			balanceSats = await fetchAddressBalance(address).catch(() => 0);

			const events = await fetchContractEvents(data.contractId, currentIdentity.relayUrl);
			recentEvents = events
				.map((item) => ({ id: item.id, kind: item.kind, created_at: item.created_at }))
				.sort((a, b) => b.created_at - a.created_at);

			status = recentEvents.some((item) => item.kind === 30003)
				? 'resolved'
				: recentEvents.some((item) => item.kind === 30002)
					? 'disputed'
					: 'active';

			await updateDeadmanCountdown();
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Falha ao carregar o contrato.';
		}

		loading = false;
	}

	async function refreshBalance() {
		if (!address) return;
		balanceSats = await fetchAddressBalance(address).catch(() => balanceSats);
	}

	async function updateDeadmanCountdown() {
		if (!identity || !draft?.has_deadmans_switch) {
			deadmanCountdown = '';
			return;
		}

		const presenceEvents = await fetchPresenceEvents(
			data.contractId,
			identity.pubkey,
			identity.relayUrl
		);
		if (presenceEvents.length === 0) {
			deadmanCountdown = 'presença ainda não confirmada';
			return;
		}

		const latest = presenceEvents.sort((a, b) => b.created_at - a.created_at)[0]!;
		const expiresAt = latest.created_at + draft.timeout_days * 24 * 60 * 60;
		const remaining = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
		const days = Math.floor(remaining / 86400);
		const hours = Math.floor((remaining % 86400) / 3600);
		deadmanCountdown = remaining === 0 ? 'timeout expirado' : `${days}d ${hours}h restantes`;
	}

	async function confirmPresence() {
		if (!identity) return;
		await publishPresenceEvent(data.contractId, identity.relayUrl);
		await updateDeadmanCountdown();
	}

	async function buildPartialPsbt() {
		if (!draft || !identity) return;

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

		const utxos = await fetchAddressUtxos(wallet.multisigAddress);
		if (utxos.length === 0) throw new Error('Não há UTXOs para criar a PSBT.');

		const total = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
		const signer = createNip07TaprootSigner(identity.pubkey);
		const splitA = Math.floor(total / 2);
		const splitB = total - splitA;

		const psbt = await buildSignedDissolutionPsbt(
			wallet,
			wallet.multisigRedeemHex,
			signer,
			networks.bitcoin,
			utxos.map((item) => ({ txid: item.txid, vout: item.vout, value: item.value })),
			[
				{ address: wallet.partyAddresses[0], value: splitA },
				{ address: wallet.partyAddresses[1], value: splitB }
			]
		);

		partialPsbt = psbt.toBase64();
	}
</script>

<main class="stack-lg">
	{#if loading}
		<Card><p>Carregando contrato...</p></Card>
	{:else if error}
		<Card><p>{error}</p></Card>
	{:else if draft}
		<section class="stack">
			<div class="row" style="justify-content: space-between; align-items: start;">
				<div class="stack" style="gap: 0.35rem;">
					<p class="muted">Contrato</p>
					<h1>{draft.contract_title || 'Contrato nupcial privado'}</h1>
				</div>
				<span class="pill">{status}</span>
			</div>
		</section>

		<Card>
			<div class="stack">
				<h3>Multisig</h3>
				<p class="mono">{address}</p>
				<p>Saldo: {balanceSats} sats</p>
				<QRCode value={address} />
			</div>
		</Card>

		{#if draft.has_deadmans_switch}
			<Card>
				<div class="stack">
					<h3>Dead man's switch</h3>
					<p>{deadmanCountdown}</p>
					<Button onClick={confirmPresence}>Confirmar presença</Button>
				</div>
			</Card>
		{/if}

		<Card>
			<div class="stack">
				<div class="row" style="justify-content: space-between;">
					<h3>Dissolução por mútuo acordo</h3>
					<Button onClick={buildPartialPsbt}>Gerar PSBT parcial</Button>
				</div>
				{#if partialPsbt}
					<pre class="document">{partialPsbt}</pre>
				{/if}
			</div>
		</Card>

		<Card>
			<div class="stack">
				<h3>Últimos eventos</h3>
				{#each recentEvents as event (event.id)}
					<div class="surface-gray event-item">
						<p class="mono">kind: {event.kind}</p>
						<p class="muted">{new Date(event.created_at * 1000).toLocaleString('pt-BR')}</p>
					</div>
				{/each}
			</div>
		</Card>

		<div class="row">
			<Button href={`/contracts/${data.contractId}/dispute`}>Abrir disputa</Button>
			<Button variant="ghost" href="/contracts">Voltar</Button>
		</div>
	{/if}
</main>

<style>
	.event-item {
		padding: 0.9rem 1rem;
		border-radius: 12px;
		display: grid;
		gap: 0.3rem;
	}

	.document {
		margin: 0;
		white-space: pre-wrap;
		font-family: var(--font-mono);
		font-size: 0.85rem;
	}
</style>
