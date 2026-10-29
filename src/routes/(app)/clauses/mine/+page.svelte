<script lang="ts">
	import {
		deletePublishedClause,
		listMyPublishedClauses,
		publishClause,
		type PublishedClause
	} from '$lib/api/published-clauses';
	import type { ApiPage } from '$lib/api/contracts';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import PublishedClauseCard from '$lib/components/PublishedClauseCard.svelte';
	import { confirmAlert } from '$lib/stores/alert';
	import { authStore } from '$lib/stores/auth';
	import type { AuthSession } from '$lib/types';
	import { onMount } from 'svelte';

	let session = $state<AuthSession | null>(null);
	let result = $state<ApiPage<PublishedClause> | null>(null);
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
		try {
			result = await listMyPublishedClauses(current.accessToken, page, 12);
		} catch (caught) {
			error =
				caught instanceof Error ? caught.message : 'Não foi possível carregar sua biblioteca.';
		} finally {
			loading = false;
		}
	}

	async function publish(item: PublishedClause) {
		if (!session) return;
		if (
			!(await confirmAlert({
				title: 'Publicar cláusula?',
				message: 'Depois de publicada, a cláusula não poderá mais ser editada.',
				confirmLabel: 'Publicar agora',
				cancelLabel: 'Voltar'
			}))
		)
			return;
		try {
			await publishClause(session.accessToken, item.id);
			await load();
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Não foi possível publicar.';
		}
	}

	async function remove(item: PublishedClause) {
		if (!session) return;
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
		try {
			await deletePublishedClause(session.accessToken, item.id);
			await load();
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Não foi possível excluir.';
		}
	}
</script>

<svelte:head><title>Nuptalicium — Minha biblioteca</title></svelte:head>
<div class="stack-lg">
	<section class="row heading">
		<div class="stack compact">
			<h1>Minha biblioteca</h1>
			<p class="muted">Rascunhos, publicações públicas e seu acervo privado.</p>
		</div>
		<div class="row">
			<Button href="/clauses" variant="ghost">Biblioteca</Button><Button href="/clauses/new"
				>Nova cláusula</Button
			>
		</div>
	</section>
	{#if error}<Card><p class="error">{error}</p></Card>{/if}
	{#if loading}<Card><p>Carregando biblioteca…</p></Card>
	{:else if !result?.content.length}<Card
			><div class="stack">
				<h2>Sua biblioteca está vazia</h2>
				<p class="muted">Crie um rascunho de regra ou conceito para começar.</p>
				<Button href="/clauses/new">Criar cláusula</Button>
			</div></Card
		>
	{:else}<div class="card-grid">
			{#each result.content as clause (clause.id)}<PublishedClauseCard
					{clause}
					mine
					onPublish={publish}
					onDelete={remove}
				/>{/each}
		</div>
		{#if result.totalPages > 1}
			<nav class="row pagination" aria-label="Paginação">
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
	{/if}
</div>

<style>
	.pagination {
		justify-content: center;
	}
</style>
