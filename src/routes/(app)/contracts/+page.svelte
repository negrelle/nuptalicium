<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		listContracts,
		type ApiPage,
		type Contract,
		type ContractStatus,
		type ParticipantRole
	} from '$lib/api/contracts';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import { pubkeyToNpub } from '$lib/nostr';
	import { authStore } from '$lib/stores/auth';
	import type { AuthSession } from '$lib/types';
	import { onMount } from 'svelte';

	const statusLabels: Record<ContractStatus, string> = {
		DRAFT: 'Rascunho',
		PENDING_ACCEPTANCE: 'Aguardando aceite',
		AWAITING_FUNDING: 'Aguardando depósito',
		ACTIVE: 'Ativo',
		CLOSED: 'Encerrado',
		CANCELLED: 'Cancelado',
		EXPIRED: 'Expirado'
	};
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

	function formatDate(value: string | null) {
		return value
			? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value))
			: 'Sem prazo';
	}
</script>

<svelte:head><title>Nuptalicium — Contratos</title></svelte:head>

<div class="stack-lg">
	<section class="row heading">
		<div class="stack compact">
			<p class="muted">Contratos</p>
			<h1>Seus acordos</h1>
		</div>
		<Button href="/new">Novo contrato</Button>
	</section>

	<label class="filter">
		<span class="muted">Filtrar por situação</span>
		<select value={status} onchange={changeStatus}>
			<option value="">Todos</option>
			{#each Object.entries(statusLabels) as [value, label] (value)}
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
		<div class="card-grid">
			{#each result.content as contract (contract.id)}
				<Card>
					<div class="stack">
						<div class="row card-heading">
							<div class="stack compact">
								<h2>{contract.title || 'Contrato sem título'}</h2>
								{#if currentParticipant(contract)}
									<p class="muted">Seu papel: {roleLabels[currentParticipant(contract)!.role]}</p>
								{/if}
							</div>
							<span class="pill">{statusLabels[contract.status]}</span>
						</div>
						{#if counterparty(contract)}
							<p class="mono truncate">
								Outro cônjuge: {counterparty(contract)!.displayName ||
									pubkeyToNpub(counterparty(contract)!.publicKey)}
							</p>
						{/if}
						<div class="summary">
							<span>{contract.clauses.length} cláusula(s)</span>
							<span>{contract.acceptances.length}/{contract.participants.length} aceites</span>
							<span>{formatDate(contract.expiresAt)}</span>
						</div>
						<a class="open-link" href={resolve('/(app)/contracts/[id]', { id: contract.id })}
							>Abrir contrato</a
						>
					</div>
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
	.card-heading,
	.pagination {
		justify-content: space-between;
	}
	.card-heading {
		align-items: start;
	}
	.compact {
		gap: 0.35rem;
	}
	.filter {
		display: grid;
		gap: 0.4rem;
	}
	select {
		padding: 0.75rem 1rem;
		border: 1px solid var(--border-gray);
		border-radius: 12px;
		background: var(--surface);
		color: var(--gray-700);
	}
	.summary {
		display: flex;
		gap: 0.5rem 1rem;
		flex-wrap: wrap;
		color: var(--gray-500);
		font-size: 0.95rem;
	}
	.truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.open-link {
		display: inline-flex;
		width: fit-content;
		padding: 0.75rem 1rem;
		border-radius: 999px;
		background: var(--rose-400);
		color: white;
	}
	.error {
		color: var(--rose-text);
	}
</style>
