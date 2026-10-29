<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PublishedClause } from '$lib/api/published-clauses';
	import { CATEGORY_LABELS } from '$lib/api/published-clauses';
	import Card from './Card.svelte';
	import Button from './Button.svelte';
	import { formatDateTime } from '$lib/date';

	let {
		clause,
		mine = false,
		onPublish,
		onDelete
	}: {
		clause: PublishedClause;
		mine?: boolean;
		onPublish?: (clause: PublishedClause) => void;
		onDelete?: (clause: PublishedClause) => void;
	} = $props();

	let authorName = $derived(
		clause.author.displayName || `${clause.author.publicKey.slice(0, 10)}…`
	);
</script>

<Card>
	<article class="stack card-content">
		<div class="row card-heading">
			<div class="stack compact">
				<div class="row badges">
					<span class="badge">{clause.type === 'RULE' ? 'Regra' : 'Conceito'}</span>
					<span class="badge subtle">{CATEGORY_LABELS[clause.category]}</span>
					{#if mine}<span class="badge subtle"
							>{clause.status === 'DRAFT'
								? 'Rascunho'
								: clause.visibility === 'PRIVATE'
									? 'Privada'
									: 'Pública'}</span
						>{/if}
				</div>
				<h2>{clause.title}</h2>
			</div>
			{#if clause.status === 'PUBLISHED'}
				<span class="rating" aria-label={`Nota ${clause.ratingAverage} de 5`}>
					★ {clause.ratingAverage.toFixed(2)} <small>({clause.ratingCount})</small>
				</span>
			{/if}
		</div>

		<p class="summary">{clause.summary || 'Sem resumo informado.'}</p>
		<div class="row meta">
			<span>por {authorName}</span>
			{#if clause.publishedAt}<span>{formatDateTime(clause.publishedAt)}</span>{/if}
		</div>

		<div class="row actions">
			<a class="open-link" href={resolve('/(app)/clauses/[id]', { id: clause.id })}>Ver detalhes</a>
			{#if mine && clause.status === 'DRAFT'}
				<Button href={`/clauses/${clause.id}/edit`} variant="ghost" size="small">Editar</Button>
				<Button size="small" onClick={() => onPublish?.(clause)}>Publicar</Button>
			{/if}
			{#if mine}<Button size="small" variant="danger" onClick={() => onDelete?.(clause)}
					>Excluir</Button
				>{/if}
		</div>
	</article>
</Card>

<style>
	.card-content {
		height: 100%;
	}
	.card-heading {
		align-items: flex-start;
	}
	.badges {
		justify-content: flex-start;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.badge {
		padding: 0.28rem 0.55rem;
		border-radius: 999px;
		background: var(--rose-100);
		color: var(--rose-text);
		font-size: 0.75rem;
		font-weight: 700;
	}
	.badge.subtle {
		background: var(--surface-muted);
		color: var(--gray-700);
	}
	.rating {
		white-space: nowrap;
		color: var(--warning);
		font-weight: 700;
	}
	.rating small {
		color: var(--gray-600);
		font-weight: 500;
	}
	.summary {
		color: var(--gray-700);
		flex: 1;
	}
	.meta {
		color: var(--gray-600);
		font-size: 0.85rem;
	}
	.actions {
		justify-content: flex-start;
		flex-wrap: wrap;
		margin-top: auto;
	}
	.open-link {
		color: var(--rose-text);
		font-weight: 700;
		padding: 0.55rem 0;
	}
</style>
