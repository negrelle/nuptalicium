<script lang="ts">
	import { searchUsers, type UserSearchResult } from '$lib/api/users';
	import { pubkeyToNpub } from '$lib/nostr';
	import { onDestroy } from 'svelte';

	let {
		label,
		value = $bindable<UserSearchResult | null>(null),
		accessToken,
		excludePublicKeys = [],
		required = false,
		description = ''
	}: {
		label: string;
		value?: UserSearchResult | null;
		accessToken: string;
		excludePublicKeys?: string[];
		required?: boolean;
		description?: string;
	} = $props();

	let query = $state('');
	let results = $state<UserSearchResult[]>([]);
	let loading = $state(false);
	let error = $state('');
	let requestSequence = 0;
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	onDestroy(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
	});

	function handleInput(event: Event) {
		query = (event.currentTarget as HTMLInputElement).value;
		const sequence = ++requestSequence;
		error = '';
		if (debounceTimer) clearTimeout(debounceTimer);
		if (query.trim().length < 2) {
			results = [];
			loading = false;
			return;
		}
		loading = true;
		debounceTimer = setTimeout(() => void runSearch(query, sequence), 250);
	}

	async function runSearch(searchQuery: string, sequence: number) {
		try {
			const matches = await searchUsers(accessToken, searchQuery.trim());
			if (sequence !== requestSequence) return;
			const excluded = new Set(excludePublicKeys.map((key) => key.toLowerCase()));
			results = matches.filter((user) => !excluded.has(user.publicKey.toLowerCase()));
		} catch (caught) {
			if (sequence !== requestSequence) return;
			error = caught instanceof Error ? caught.message : 'Não foi possível pesquisar usuários.';
			results = [];
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	function selectUser(user: UserSearchResult) {
		requestSequence++;
		if (debounceTimer) clearTimeout(debounceTimer);
		value = user;
		query = '';
		results = [];
		error = '';
	}

	function clearSelection() {
		requestSequence++;
		if (debounceTimer) clearTimeout(debounceTimer);
		value = null;
		query = '';
		results = [];
	}

	function shortNpub(publicKey: string) {
		const npub = pubkeyToNpub(publicKey);
		return `${npub.slice(0, 14)}…${npub.slice(-8)}`;
	}
</script>

<div class="picker">
	<span class="label">{label}{required ? ' *' : ''}</span>
	{#if value}
		<div class="selected surface-gray">
			<div class="identity">
				<strong>{value.displayName || 'Usuário sem nome'}</strong>
				<span class="mono">{shortNpub(value.publicKey)}</span>
			</div>
			<button type="button" onclick={clearSelection}>Trocar</button>
		</div>
	{:else}
		<div class="search-wrap">
			<input
				class="control"
				type="search"
				value={query}
				oninput={handleInput}
				placeholder="Pesquise pelo nome ou cole um npub"
				aria-label={label}
				aria-describedby={description ? `${label}-description` : undefined}
				autocomplete="off"
			/>
			{#if loading}<span class="feedback">Pesquisando…</span>{/if}
			{#if error}<span class="feedback error">{error}</span>{/if}
			{#if !loading && query.trim().length >= 2}
				<div class="results surface" role="listbox" aria-label={`Resultados para ${label}`}>
					{#each results as user (user.id)}
						<button
							type="button"
							role="option"
							aria-selected="false"
							onclick={() => selectUser(user)}
						>
							<strong>{user.displayName || 'Usuário sem nome'}</strong>
							<span class="mono">{shortNpub(user.publicKey)}</span>
						</button>
					{:else}
						<p>Nenhum usuário ativo encontrado.</p>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
	{#if description}<small id={`${label}-description`}>{description}</small>{/if}
</div>

<style>
	.picker {
		display: grid;
		gap: 0.4rem;
	}
	.label {
		color: var(--gray-500);
		font-size: 0.69rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.search-wrap {
		position: relative;
		display: grid;
		gap: 0.35rem;
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
	.control:focus {
		border-color: var(--rose-300);
		background: white;
	}
	.selected {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.85rem 1rem;
	}
	.identity {
		min-width: 0;
		display: grid;
		gap: 0.15rem;
	}
	.identity .mono {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.selected button {
		border: 0;
		background: transparent;
		color: var(--rose-text);
	}
	.feedback {
		color: var(--gray-500);
		font-size: 0.9rem;
	}
	.feedback.error {
		color: var(--rose-text);
	}
	.results {
		position: absolute;
		z-index: 10;
		top: calc(100% + 0.35rem);
		left: 0;
		right: 0;
		max-height: 18rem;
		overflow-y: auto;
		padding: 0.35rem;
		box-shadow: 0 12px 30px rgba(80, 50, 50, 0.12);
	}
	.results button {
		width: 100%;
		display: grid;
		gap: 0.15rem;
		padding: 0.75rem;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--gray-700);
		text-align: left;
	}
	.results button:hover,
	.results button:focus {
		background: var(--gray-bg);
	}
	.results p {
		padding: 0.75rem;
		color: var(--gray-500);
	}
</style>
