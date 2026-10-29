<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import Arabesque from '$lib/components/Arabesque.svelte';
	import Card from '$lib/components/Card.svelte';
	import { authStore, loginWithNip07 } from '$lib/stores/auth';
	import { identityStore } from '$lib/stores/identity';
	import { showValidationToast } from '$lib/stores/toast';
	import type { AuthSession, Identity } from '$lib/types';
	import { onMount } from 'svelte';

	let identity = $state<Identity | null>(null);
	let session = $state<AuthSession | null>(null);
	let available = $state(false);
	let connecting = $state(false);
	let error = $state('');

	onMount(() => {
		if (!browser) return;

		available = Boolean(window.nostr);
		const unsubscribeIdentity = identityStore.subscribe((value) => {
			identity = value;
		});
		const unsubscribeAuth = authStore.subscribe((value) => {
			session = value;
			if (value) {
				goto(resolve('/contracts'));
			}
		});

		return () => {
			unsubscribeIdentity();
			unsubscribeAuth();
		};
	});

	async function connect() {
		if (!window.nostr) {
			showValidationToast('Instale uma extensão compatível com NIP-07, como Alby ou nos2x.');
			return;
		}

		connecting = true;
		error = '';

		try {
			await loginWithNip07();
			goto(resolve('/contracts'));
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Não foi possível conectar com Nostr.';
		} finally {
			connecting = false;
		}
	}
</script>

<svelte:head>
	<title>Nuptalicium</title>
	<meta
		name="description"
		content="Contratos nupciais privados com Nostr e Bitcoin Justice Protocol."
	/>
</svelte:head>

<main class="page-shell auth-shell">
	<section class="stack surface hero-panel">
		<div class="ornament ornament-top" aria-hidden="true">
			<Arabesque />
		</div>
		<div class="ornament ornament-bottom" aria-hidden="true">
			<Arabesque />
		</div>

		<div class="stack hero-copy">
			<p class="eyebrow">Nuptalicium</p>
			<Arabesque variant="divider" className="title-flourish" />
			<h1>Conectar identidade Nostr</h1>
			<p>
				Uma camada privada para contratos nupciais construída sobre Nostr e Bitcoin Justice
				Protocol.
			</p>
			<p class="muted">
				Sua extensão assinará um desafio para comprovar a identidade sem revelar a chave privada.
			</p>
		</div>

		{#if !available}
			<Card>
				<p>Este navegador ainda não expõe `window.nostr`.</p>
				<p class="muted">Instale uma extensão compatível, como Alby ou nos2x, e tente novamente.</p>
			</Card>
		{/if}

		{#if identity?.npub && !session}
			<Card>
				<p>Identidade selecionada: <span class="technical">{identity.npub}</span>.</p>
			</Card>
		{/if}

		{#if error}
			<Card>
				<p>{error}</p>
			</Card>
		{/if}

		<div class="row">
			<Button size="large" onClick={connect} disabled={connecting}>
				{connecting ? 'Conectando…' : 'Conectar com Nostr'}
			</Button>
			<Button variant="ghost" href="/contracts">Ver contratos</Button>
		</div>
	</section>
</main>

<style>
	.auth-shell {
		display: grid;
		place-items: center;
	}

	.hero-panel {
		position: relative;
		z-index: 1;
		isolation: isolate;
		overflow: hidden;
		width: min(100%, 52rem);
		padding: clamp(1.5rem, 4vw, 3.5rem);
	}

	.hero-panel > :not(.ornament) {
		position: relative;
		z-index: 1;
	}

	.hero-copy {
		gap: 0.75rem;
	}

	.ornament {
		position: absolute;
		z-index: 0;
		color: var(--rose-300);
		opacity: 0.32;
		pointer-events: none;
	}

	.ornament-top {
		top: -1px;
		right: -1px;
		transform: rotate(90deg);
		transform-origin: center;
	}

	.ornament-bottom {
		bottom: -1px;
		right: -1px;
		transform: rotate(180deg);
		transform-origin: center;
	}

	:global(.title-flourish) {
		margin: -0.2rem 0 0.15rem;
		opacity: 0.78;
	}

	.eyebrow {
		color: var(--rose-text);
		font-family: var(--font-display);
		font-size: 0.9rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	@media (max-width: 640px) {
		.ornament {
			opacity: 0.2;
			transform: scale(0.72) rotate(90deg);
		}

		.ornament-top {
			top: -1.3rem;
			right: -1.3rem;
		}

		.ornament-bottom {
			bottom: -1.3rem;
			right: -1.3rem;
			transform: scale(0.72) rotate(180deg);
		}
	}
</style>
