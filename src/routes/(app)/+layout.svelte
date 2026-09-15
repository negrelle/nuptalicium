<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import NpubDisplay from '$lib/components/NpubDisplay.svelte';
	import { authStore, logout, restoreSession } from '$lib/stores/auth';
	import { identityStore } from '$lib/stores/identity';
	import type { AuthSession } from '$lib/types';
	import type { Identity } from '$lib/types';
	import { onMount } from 'svelte';

	let { children } = $props();
	let identity = $state<Identity | null>(null);
	let session = $state<AuthSession | null>(null);
	let checkingSession = $state(true);

	onMount(() => {
		const unsubscribeIdentity = identityStore.subscribe((value) => {
			identity = value;
		});
		const unsubscribeAuth = authStore.subscribe((value) => (session = value));

		void restoreSession().then((authenticated) => {
			checkingSession = false;
			if (!authenticated) goto(resolve('/'));
		});

		return () => {
			unsubscribeIdentity();
			unsubscribeAuth();
		};
	});

	async function signOut() {
		await logout();
		await goto(resolve('/'));
	}
</script>

<svelte:head>
	<title>Nuptalicium</title>
</svelte:head>

{#if !checkingSession && session}
	<header class="topbar">
		<div class="topbar-inner">
			<a class="brand" href={resolve('/contracts')}>
				<em>Nuptalicium</em>
			</a>

			<div class="topbar-actions">
				{#if identity?.npub}
					<NpubDisplay value={identity.npub} />
				{/if}
				<Button variant="ghost" onClick={signOut}>Sair</Button>
			</div>
		</div>
	</header>

	<main class="page-shell">{@render children()}</main>
{/if}

<style>
	.topbar {
		background: var(--rose-bg);
		border-bottom: 0.5px solid var(--border);
	}

	.topbar-inner {
		max-width: 640px;
		margin: 0 auto;
		padding: 1rem 1.25rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.brand {
		font-size: 1.7rem;
		font-style: italic;
		color: var(--rose-text);
	}

	.topbar-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
</style>
