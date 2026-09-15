<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Input from '$lib/components/Input.svelte';
	import {
		fetchContractEvent,
		fetchVerdictEvents,
		parseContractContent,
		publishDisputeEvent
	} from '$lib/nostr';
	import { identityStore } from '$lib/stores/identity';
	import type { ContractDraft, Identity } from '$lib/types';
	import { onMount } from 'svelte';

	let { data }: { data: { contractId: string } } = $props();

	let identity = $state<Identity | null>(null);
	let draft = $state<ContractDraft | null>(null);
	let selectedClause = $state('');
	let clauseProofStandard = $state('');
	let evidence = $state('');
	let disputeId = $state('');
	let verdictEvents = $state<Array<{ pubkey: string; created_at: number; content: string }>>([]);
	let loading = $state(true);
	let submitting = $state(false);
	let error = $state('');
	let success = $state('');

	onMount(() => {
		const unsub = identityStore.subscribe((value) => {
			identity = value;
			if (value) {
				void load(value);
			}
		});

		return unsub;
	});

	async function load(currentIdentity: Identity) {
		loading = true;
		error = '';

		try {
			const event = await fetchContractEvent(data.contractId, currentIdentity.relayUrl);
			if (!event) throw new Error('Contrato não encontrado.');

			const parsed = parseContractContent(event.content);
			if (!parsed) throw new Error('Não foi possível interpretar o contrato.');

			draft = parsed;
			if (parsed.custom_clauses.length > 0) {
				selectedClause = parsed.custom_clauses[0]!.title;
				clauseProofStandard = parsed.custom_clauses[0]!.proof_standard;
			} else {
				selectedClause = parsed.fidelity_clause ? 'Fidelity clause' : 'Cláusula geral';
				clauseProofStandard = parsed.fidelity_clause
					? parsed.proof_standard
					: 'Descrever evidência objetiva, verificável e vinculada às obrigações pactuadas.';
			}

			await refreshVerdicts(currentIdentity.relayUrl);
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Erro ao carregar a disputa.';
		}

		loading = false;
	}

	function onClauseChange(value: string) {
		selectedClause = value;
		const clause = draft?.custom_clauses.find((item) => item.title === value);
		if (clause) {
			clauseProofStandard = clause.proof_standard;
			return;
		}

		if (value === 'Fidelity clause') {
			clauseProofStandard = draft?.proof_standard || '';
		} else {
			clauseProofStandard =
				'Descrever evidência objetiva, verificável e vinculada às obrigações pactuadas.';
		}
	}

	async function publishDispute() {
		if (!identity) return;
		submitting = true;
		error = '';
		success = '';

		try {
			const event = await publishDisputeEvent(
				{
					contractId: data.contractId,
					clauseTitle: selectedClause,
					proofStandard: clauseProofStandard,
					evidence
				},
				identity.relayUrl
			);
			disputeId = event.id;
			success = 'Disputa publicada com sucesso no relay.';
			await refreshVerdicts(identity.relayUrl);
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Não foi possível publicar a disputa.';
		}

		submitting = false;
	}

	async function refreshVerdicts(relayUrl: string) {
		if (!disputeId) {
			verdictEvents = [];
			return;
		}

		const events = await fetchVerdictEvents(disputeId, relayUrl);
		verdictEvents = events
			.map((item) => ({ pubkey: item.pubkey, created_at: item.created_at, content: item.content }))
			.sort((a, b) => b.created_at - a.created_at);
	}
</script>

<main class="stack-lg">
	{#if loading}
		<Card><p>Carregando disputa...</p></Card>
	{:else if error && !draft}
		<Card><p>{error}</p></Card>
	{:else if draft}
		<section class="stack">
			<p class="muted">Disputa do contrato</p>
			<h1>{draft.contract_title || 'Contrato nupcial privado'}</h1>
		</section>

		<Card>
			<div class="stack">
				<label class="field">
					<span class="label">Cláusula invocada</span>
					<select
						class="control"
						value={selectedClause}
						onchange={(event) => onClauseChange((event.currentTarget as HTMLSelectElement).value)}
					>
						{#if draft.fidelity_clause}
							<option value="Fidelity clause">Fidelity clause</option>
						{/if}
						{#each draft.custom_clauses as clause (clause)}
							<option value={clause.title}>{clause.title}</option>
						{/each}
						{#if !draft.fidelity_clause && draft.custom_clauses.length === 0}
							<option value="Cláusula geral">Cláusula geral</option>
						{/if}
					</select>
				</label>

				<Card>
					<div class="stack">
						<h3>Padrão de prova</h3>
						<p>{clauseProofStandard}</p>
					</div>
				</Card>

				<Input textarea label="Evidência" bind:value={evidence} rows={8} />

				{#if error}
					<p>{error}</p>
				{/if}
				{#if success}
					<p>{success}</p>
				{/if}

				<Button onClick={publishDispute} disabled={submitting || !evidence.trim()}>
					{submitting ? 'Publicando...' : 'Publicar disputa'}
				</Button>
			</div>
		</Card>

		<Card>
			<div class="stack">
				<h3>Status dos árbitros</h3>
				{#if disputeId}
					<p class="mono">Disputa: {disputeId}</p>
				{/if}

				{#if verdictEvents.length === 0}
					<p class="muted">Nenhum veredito publicado até o momento.</p>
				{:else}
					{#each verdictEvents as verdict (verdict)}
						<div class="surface-gray verdict-item">
							<p class="mono">{verdict.pubkey}</p>
							<p class="muted">{new Date(verdict.created_at * 1000).toLocaleString('pt-BR')}</p>
						</div>
					{/each}
				{/if}
			</div>
		</Card>

		<div class="row">
			<Button variant="ghost" href={`/contracts/${data.contractId}`}>Voltar ao contrato</Button>
		</div>
	{/if}
</main>

<style>
	.field {
		display: grid;
		gap: 0.4rem;
	}

	.label {
		color: var(--gray-500);
		font-size: 0.69rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.control {
		width: 100%;
		padding: 0.9rem 1rem;
		border-radius: 12px;
		border: 1px solid var(--border-gray);
		background: var(--gray-bg);
		color: var(--gray-900);
		outline: none;
	}

	.verdict-item {
		padding: 0.9rem 1rem;
		border-radius: 12px;
	}
</style>
