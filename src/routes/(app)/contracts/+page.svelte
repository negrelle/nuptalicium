<script lang="ts">
	import {
		listContracts,
		type ApiPage,
		type Contract,
		type ContractStatus,
		type ParticipantRole
	} from '$lib/api/contracts';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import ContractStatusBadge from '$lib/components/ContractStatusBadge.svelte';
	import { CONTRACT_STATUS_LABELS } from '$lib/contract-status';
	import { formatDateTime } from '$lib/date';
	import { pubkeyToNpub } from '$lib/nostr';
	import { authStore } from '$lib/stores/auth';
	import type { AuthSession } from '$lib/types';
	import { onMount } from 'svelte';

	const roleLabels: Record<ParticipantRole, string> = {
		SPOUSE_A: 'Cônjuge A',
		SPOUSE_B: 'Cônjuge B',
		ARBITRATOR_A: 'Árbitro A',
		ARBITRATOR_B: 'Árbitro B',
		ARBITRATOR_NEUTRAL: 'Árbitro neutro'
	};

	let session = $state<AuthSession | null>(null);
	let result = $state<ApiPage<Contract> | null>(null);
	let status = $state<ContractStatus | ''>('');
	let page = $state(0);
	let loading = $state(true);
	let error = $state('');

	onMount(() => {
		const unsubscribe = authStore.subscribe((value) => {
			session = value;
			if (value) void loadContracts(value);
		});
		return unsubscribe;
	});

	async function loadContracts(currentSession = session) {
		if (!currentSession) return;
		loading = true;
		error = '';
		try {
			result = await listContracts(currentSession.accessToken, { status, page, size: 10 });
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Não foi possível carregar os contratos.';
		} finally {
			loading = false;
		}
	}

	function changeStatus(event: Event) {
		status = (event.currentTarget as HTMLSelectElement).value as ContractStatus | '';
		page = 0;
		void loadContracts();
	}

	function changePage(nextPage: number) {
		page = nextPage;
		void loadContracts();
	}

	function currentParticipant(contract: Contract) {
		return contract.participants.find(
			(participant) => participant.publicKey.toLowerCase() === session?.user.publicKey.toLowerCase()
		);
	}

	function counterparty(contract: Contract) {
		return contract.participants.find(
			(participant) =>
				participant.role.startsWith('SPOUSE') &&
				participant.publicKey.toLowerCase() !== session?.user.publicKey.toLowerCase()
		);
	}
</script>

<svelte:head><title>Nuptalicium — Contratos</title></svelte:head>

<div class="stack-lg">
	<section class="row heading">
		<div class="stack compact">
			<h1>Seus Contratos</h1>
		</div>
		<Button href="/new">Novo contrato</Button>
	</section>

	<label class="filter">
		<span class="muted">Filtrar por situação</span>
		<select value={status} onchange={changeStatus}>
			<option value="">Todos</option>
			{#each Object.entries(CONTRACT_STATUS_LABELS) as [value, label] (value)}
				<option {value}>{label}</option>
			{/each}
		</select>
	</label>

	{#if loading}
		<Card><p>Carregando contratos…</p></Card>
	{:else if error}
		<Card>
			<div class="stack">
				<p class="error">{error}</p>
				<Button variant="ghost" onClick={() => loadContracts()}>Tentar novamente</Button>
			</div>
		</Card>
	{:else if !result?.content.length}
		<Card>
			<div class="stack">
				<h2>Nenhum contrato por aqui</h2>
				<p class="muted">Crie um rascunho e inclua as pessoas que participarão do acordo.</p>
				<Button href="/new">Criar o primeiro contrato</Button>
			</div>
		</Card>
	{:else}
		<div class="contract-list">
			{#each result.content as contract (contract.id)}
				<Card>
					<article class="contract-row">
						<div class="contract-identity stack compact">
							<h2>{contract.title || 'Contrato sem título'}</h2>
							{#if currentParticipant(contract)}
								<p class="muted">Seu papel: {roleLabels[currentParticipant(contract)!.role]}</p>
							{/if}
						</div>
						<div class="contract-counterparty">
							<span class="detail-label">Outro cônjuge</span>
							<strong class="technical truncate"
								>{counterparty(contract)?.displayName ||
									(counterparty(contract)
										? pubkeyToNpub(counterparty(contract)!.publicKey)
										: 'Não informado')}</strong
							>
						</div>
						<div class="contract-details" aria-label="Resumo do contrato">
							<div>
								<span class="detail-label">Cláusulas</span>
								<strong>{contract.clauses.length}</strong>
							</div>
							<div>
								<span class="detail-label">Aceites</span>
								<strong>{contract.acceptances.length}/{contract.participants.length}</strong>
							</div>
							<div>
								<span class="detail-label">Prazo</span>
								<strong
									>{contract.expiresAt ? formatDateTime(contract.expiresAt) : 'Sem prazo'}</strong
								>
							</div>
						</div>
						<ContractStatusBadge status={contract.status} />
						<Button href={`/contracts/${contract.id}`} size="small">Abrir</Button>
					</article>
				</Card>
			{/each}
		</div>
		{#if result.totalPages > 1}
			<nav class="row pagination" aria-label="Paginação">
				<Button variant="ghost" disabled={result.first} onClick={() => changePage(page - 1)}
					>Anterior</Button
				>
				<span class="muted">Página {page + 1} de {result.totalPages}</span>
				<Button variant="ghost" disabled={result.last} onClick={() => changePage(page + 1)}
					>Próxima</Button
				>
			</nav>
		{/if}
	{/if}
</div>

<style>
	.heading,
	.pagination {
		justify-content: space-between;
	}
	.compact {
		gap: 0.35rem;
	}
	.filter {
		display: grid;
		gap: 0.4rem;
	}
	.contract-list {
		display: grid;
		gap: 0.85rem;
	}
	.contract-row {
		display: grid;
		grid-template-columns: minmax(13rem, 1.4fr) minmax(10rem, 1fr) minmax(20rem, 1.65fr) auto auto;
		align-items: center;
		gap: 1.25rem;
	}
	.contract-identity h2 {
		font-size: 1.05rem;
	}
	.contract-counterparty,
	.contract-details > div {
		display: grid;
		gap: 0.25rem;
		min-width: 0;
	}
	.contract-details {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.8rem;
	}
	.detail-label {
		color: var(--gray-500);
		font-size: 0.73rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.contract-details strong,
	.contract-counterparty strong {
		color: var(--gray-800);
		font-size: 0.9rem;
		font-weight: 650;
	}
	.truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.error {
		color: var(--rose-text);
	}
	@media (max-width: 1050px) {
		.contract-row {
			grid-template-columns: minmax(14rem, 1.5fr) minmax(12rem, 1fr) auto auto;
		}
		.contract-details {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}
	@media (max-width: 680px) {
		.contract-row {
			grid-template-columns: 1fr auto;
			gap: 1rem;
		}
		.contract-counterparty {
			grid-column: 1 / -1;
		}
		.contract-details {
			grid-template-columns: 1fr;
			grid-column: 1 / -1;
			grid-row: auto;
		}
	}
</style>
