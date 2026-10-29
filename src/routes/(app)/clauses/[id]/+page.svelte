<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		CATEGORY_LABELS,
		copyPublishedClauseToContract,
		deletePublishedClause,
		getPublishedClause,
		publishClause,
		ratePublishedClause,
		removePublishedClauseRating,
		type PublishedClause
	} from '$lib/api/published-clauses';
	import { listContracts, type Contract } from '$lib/api/contracts';
	import { getRuleSchema } from '$lib/api/rules';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import RatingControl from '$lib/components/RatingControl.svelte';
	import RuleBuilder from '$lib/components/RuleBuilder.svelte';
	import { formatDateTime } from '$lib/date';
	import { cloneRule, type RuleSchema } from '$lib/contract-rules';
	import { confirmAlert } from '$lib/stores/alert';
	import { authStore } from '$lib/stores/auth';
	import type { AuthSession } from '$lib/types';
	import { onMount } from 'svelte';

	let { data }: { data: { clauseId: string } } = $props();
	let session = $state<AuthSession | null>(null);
	let clause = $state<PublishedClause | null>(null);
	let schema = $state<RuleSchema | null>(null);
	let contracts = $state<Contract[]>([]);
	let contractId = $state('');
	let loading = $state(true);
	let busy = $state(false);
	let error = $state('');
	let success = $state('');
	let isAuthor = $derived(Boolean(clause && session && clause.author.id === session.user.id));

	onMount(() =>
		authStore.subscribe((value) => {
			session = value;
			if (value) void load(value);
		})
	);

	async function load(current = session) {
		if (!current) return;
		loading = true;
		try {
			const [item, ruleSchema, drafts] = await Promise.all([
				getPublishedClause(current.accessToken, data.clauseId),
				getRuleSchema(current.accessToken),
				listContracts(current.accessToken, { status: 'DRAFT', page: 0, size: 100 })
			]);
			clause = item;
			schema = ruleSchema;
			contracts = drafts.content.filter((contract) =>
				contract.participants.some(
					(participant) =>
						participant.publicKey.toLowerCase() === current.user.publicKey.toLowerCase() &&
						(participant.role === 'SPOUSE_A' || participant.role === 'SPOUSE_B')
				)
			);
			contractId ||= contracts[0]?.id ?? '';
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Não foi possível carregar a cláusula.';
		} finally {
			loading = false;
		}
	}

	async function rate(value: number) {
		if (!session || !clause) return;
		busy = true;
		try {
			clause = await ratePublishedClause(session.accessToken, clause.id, value);
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Não foi possível avaliar.';
		} finally {
			busy = false;
		}
	}

	async function removeRating() {
		if (!session || !clause) return;
		busy = true;
		try {
			await removePublishedClauseRating(session.accessToken, clause.id);
			await load();
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Não foi possível remover a avaliação.';
		} finally {
			busy = false;
		}
	}

	async function copyToContract() {
		if (!session || !clause || !contractId) return;
		busy = true;
		success = '';
		error = '';
		try {
			const target = contracts.find((contract) => contract.id === contractId);
			await copyPublishedClauseToContract(
				session.accessToken,
				contractId,
				clause.id,
				target?.clauses.length ?? 0
			);
			success = 'Cláusula adicionada ao contrato como uma cópia independente.';
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Não foi possível adicionar ao contrato.';
		} finally {
			busy = false;
		}
	}

	async function publish() {
		if (!session || !clause || clause.status !== 'DRAFT' || busy) return;
		if (
			!(await confirmAlert({
				title: 'Publicar cláusula?',
				message: 'Depois de publicada, a cláusula não poderá mais ser editada.',
				confirmLabel: 'Publicar agora',
				cancelLabel: 'Voltar'
			}))
		)
			return;
		busy = true;
		error = '';
		try {
			clause = await publishClause(session.accessToken, clause.id);
			success = 'Cláusula publicada. O conteúdo agora está protegido contra edição.';
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Não foi possível publicar a cláusula.';
		} finally {
			busy = false;
		}
	}

	async function remove() {
		if (!session || !clause || !isAuthor || busy) return;
		if (
			!(await confirmAlert({
				title: 'Excluir cláusula?',
				message: 'Ela sairá da biblioteca, mas contratos que já a utilizaram não serão alterados.',
				variant: 'danger',
				confirmLabel: 'Excluir',
				cancelLabel: 'Cancelar'
			}))
		)
			return;
		busy = true;
		error = '';
		try {
			await deletePublishedClause(session.accessToken, clause.id);
			await goto(resolve('/(app)/clauses/mine'));
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Não foi possível excluir a cláusula.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Nuptalicium — {clause?.title ?? 'Cláusula'}</title></svelte:head>
<div class="stack-lg">
	<Button href="/clauses" variant="ghost">Voltar à biblioteca</Button>
	{#if clause && isAuthor}
		<div class="row clause-actions" aria-label="Ações da cláusula">
			{#if clause.status === 'DRAFT'}
				<Button href={`/clauses/${clause.id}/edit`} variant="secondary" disabled={busy}
					>Editar</Button
				>
				<Button disabled={busy} onClick={publish}>Publicar</Button>
			{/if}
			<Button variant="danger" disabled={busy} onClick={remove}>Excluir da biblioteca</Button>
		</div>
	{/if}
	{#if loading}<Card><p>Carregando cláusula…</p></Card>
	{:else if error && !clause}<Card><p class="error">{error}</p></Card>
	{:else if clause}
		<section class="detail-grid">
			<Card>
				<div class="stack-lg">
					<div class="stack compact">
						<div class="row badges">
							<span class="badge">{clause.type === 'RULE' ? 'Regra' : 'Conceito'}</span><span
								class="badge subtle">{CATEGORY_LABELS[clause.category]}</span
							>{#if clause.visibility === 'PRIVATE'}<span class="badge subtle">Privada</span>{/if}
						</div>
						<h1>{clause.title}</h1>
						<p class="muted">
							por {clause.author.displayName ||
								`${clause.author.publicKey.slice(0, 12)}…`}{#if clause.publishedAt}
								· {formatDateTime(clause.publishedAt)}{/if}
						</p>
					</div>
					{#if clause.summary}<p class="lead">{clause.summary}</p>{/if}
					{#if clause.type === 'CONCEPT'}<div class="concept">{clause.conceptText}</div>
					{:else if clause.ruleDefinition && schema}<p>{clause.generatedDescription}</p>
						<RuleBuilder
							value={cloneRule({
								dslVersion: clause.dslVersion ?? '1',
								definition: clause.ruleDefinition
							})}
							{schema}
							readonly
						/>{/if}
				</div>
			</Card>
			<aside class="stack">
				<Card
					><div class="stack">
						<h2>Avaliações</h2>
						<p class="score">
							★ {clause.ratingAverage.toFixed(2)}
							<small>em {clause.ratingCount} avaliação{clause.ratingCount === 1 ? '' : 'ões'}</small
							>
						</p>
						{#if clause.visibility === 'PUBLIC' && clause.status === 'PUBLISHED' && clause.author.id !== session?.user.id}<RatingControl
								value={clause.myRating}
								disabled={busy}
								onRate={rate}
								onRemove={removeRating}
							/>{/if}
					</div></Card
				>
				{#if clause.status === 'PUBLISHED'}<Card
						><div class="stack">
							<h2>Adicionar ao contrato</h2>
							{#if contracts.length}<label class="field"
									><span class="label">Contrato em rascunho</span><select bind:value={contractId}
										>{#each contracts as contract (contract.id)}<option value={contract.id}
												>{contract.title || 'Contrato sem título'}</option
											>{/each}</select
									></label
								><Button disabled={busy || !contractId} onClick={copyToContract}
									>Adicionar cópia</Button
								>{:else}<p class="muted">Você não possui contrato editável como cônjuge.</p>
								<Button href="/new">Criar contrato</Button>{/if}
						</div></Card
					>{/if}
			</aside>
		</section>
		{#if error}<p class="error">{error}</p>{/if}{#if success}<p class="success">{success}</p>{/if}
	{/if}
</div>

<style>
	.detail-grid {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(17rem, 0.8fr);
		gap: 1.5rem;
		align-items: start;
	}
	.badges {
		justify-content: flex-start;
		gap: 0.4rem;
	}
	.badge {
		padding: 0.3rem 0.6rem;
		border-radius: 999px;
		background: var(--rose-100);
		color: var(--rose-text);
		font-size: 0.78rem;
		font-weight: 700;
	}
	.badge.subtle {
		background: var(--surface-muted);
		color: var(--gray-700);
	}
	.lead {
		font-size: 1.08rem;
		color: var(--gray-700);
	}
	.concept {
		white-space: pre-wrap;
		line-height: 1.7;
	}
	.score {
		color: var(--warning);
		font-size: 1.6rem;
		font-weight: 700;
	}
	.score small {
		color: var(--gray-600);
		font-size: 0.85rem;
		font-weight: 500;
	}
	.clause-actions {
		flex-wrap: wrap;
	}
	@media (max-width: 850px) {
		.detail-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
