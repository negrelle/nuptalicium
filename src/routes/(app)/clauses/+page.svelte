<script lang="ts">
	import {
		CATEGORY_LABELS,
		listPublishedClauses,
		type MarketplaceFilters,
		type PublishedClause,
		type PublishedClauseCategory,
		type PublishedClauseType
	} from '$lib/api/published-clauses';
	import type { ApiPage } from '$lib/api/contracts';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import PublishedClauseCard from '$lib/components/PublishedClauseCard.svelte';
	import { authStore } from '$lib/stores/auth';
	import type { AuthSession } from '$lib/types';
	import { onMount } from 'svelte';

	let session = $state<AuthSession | null>(null);
	let result = $state<ApiPage<PublishedClause> | null>(null);
	let search = $state('');
	let type = $state<PublishedClauseType | ''>('');
	let category = $state<PublishedClauseCategory | ''>('');
	let sort = $state<MarketplaceFilters['sort']>('recent');
	let page = $state(0);
	let loading = $state(true);
	let error = $state('');

	onMount(() =>
		authStore.subscribe((value) => {
			session = value;
			if (value) void load(value);
		})
	);

	async function load(current = session) {
		if (!current) return;
		loading = true;
		error = '';
		try {
			result = await listPublishedClauses(current.accessToken, {
				search,
				type,
				category,
				sort,
				page,
				size: 12
			});
		} catch (caught) {
			error =
				caught instanceof Error
					? caught.message
					: 'Não foi possível carregar a biblioteca de cláusulas.';
		} finally {
			loading = false;
		}
	}

	function applyFilters() {
		page = 0;
		void load();
	}
</script>

<svelte:head><title>Nuptalicium — Biblioteca de cláusulas</title></svelte:head>

<div class="stack-lg">
	<section class="row heading">
		<div class="stack compact">
			<h1>Biblioteca de cláusulas</h1>
			<p class="muted">Encontre regras e conceitos publicados pela comunidade.</p>
		</div>
		<div class="row">
			<Button href="/clauses/mine" variant="ghost">Minha biblioteca</Button><Button
				href="/clauses/new">Criar cláusula</Button
			>
		</div>
	</section>

	<Card tone="subtle">
		<div class="filters">
			<label class="field search"
				><span class="label">Buscar</span><input
					class="control"
					bind:value={search}
					placeholder="Título da cláusula"
					onkeydown={(event) => event.key === 'Enter' && applyFilters()}
				/></label
			>
			<label class="field"
				><span class="label">Tipo</span><select bind:value={type}
					><option value="">Todos</option><option value="RULE">Regras</option><option
						value="CONCEPT">Conceitos</option
					></select
				></label
			>
			<label class="field"
				><span class="label">Categoria</span><select bind:value={category}
					><option value="">Todas</option
					>{#each Object.entries(CATEGORY_LABELS) as [value, label] (value)}<option {value}
							>{label}</option
						>{/each}</select
				></label
			>
			<label class="field"
				><span class="label">Ordenar</span><select bind:value={sort}
					><option value="recent">Mais recentes</option><option value="rating"
						>Melhor avaliadas</option
					><option value="ratingCount">Mais avaliadas</option></select
				></label
			>
			<Button onClick={applyFilters}>Aplicar</Button>
		</div>
	</Card>

	{#if loading}<Card><p>Carregando cláusulas…</p></Card>
	{:else if error}<Card><p class="error">{error}</p></Card>
	{:else if !result?.content.length}<Card
			><div class="stack">
				<h2>Nenhuma cláusula encontrada</h2>
				<p class="muted">Ajuste os filtros ou publique a primeira cláusula.</p>
			</div></Card
		>
	{:else}
		<div class="card-grid">
			{#each result.content as clause (clause.id)}<PublishedClauseCard {clause} />{/each}
		</div>
		<nav class="row pagination">
			<Button
				variant="ghost"
				disabled={result.first}
				onClick={() => {
					page -= 1;
					void load();
				}}>Anterior</Button
			><span>Página {result.number + 1} de {result.totalPages}</span><Button
				variant="ghost"
				disabled={result.last}
				onClick={() => {
					page += 1;
					void load();
				}}>Próxima</Button
			>
		</nav>
	{/if}
</div>

<style>
	.filters {
		display: grid;
		grid-template-columns: minmax(14rem, 2fr) repeat(3, minmax(9rem, 1fr)) auto;
		gap: 1rem;
		align-items: end;
	}
	.pagination {
		justify-content: center;
	}
	@media (max-width: 900px) {
		.filters {
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (max-width: 600px) {
		.filters {
			grid-template-columns: 1fr;
		}
	}
</style>
