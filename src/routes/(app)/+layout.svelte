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
				<span class="brand-mark" aria-hidden="true">N</span>
				<span>Nuptalicium</span>
			</a>

			<nav class="primary-nav" aria-label="Navegação principal">
				<a href={resolve('/contracts')}>Contratos</a>
				<a href={resolve('/new')}>Novo contrato</a>
			</nav>

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
		position: sticky;
		z-index: 20;
		top: 0;
		background: rgba(251, 243, 243, 0.9);
		border-bottom: 1px solid var(--border);
		backdrop-filter: blur(14px);
	}

	.topbar-inner {
		width: min(100%, var(--page-max));
		margin: 0 auto;
		min-height: 4.5rem;
		padding: 0.75rem clamp(1rem, 4vw, 4rem);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		color: var(--rose-text);
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	.brand-mark {
		display: grid;
		width: 2.1rem;
		height: 2.1rem;
		place-items: center;
		border: 1px solid var(--rose-300);
		border-radius: 50%;
		background: var(--surface);
		font-size: 1.25rem;
	}

	.primary-nav {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-right: auto;
	}

	.primary-nav a {
		padding: 0.55rem 0.75rem;
		border-radius: var(--radius-sm);
		color: var(--gray-700);
		font-size: 0.92rem;
		font-weight: 600;
	}

	.primary-nav a:hover {
		background: var(--rose-100);
		color: var(--rose-text);
	}

	.topbar-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	@media (max-width: 760px) {
		.topbar-inner {
			min-height: 4rem;
		}

		.brand span:last-child,
		.primary-nav {
			display: none;
		}

		.topbar-actions {
			margin-left: auto;
		}
	}
</style>
