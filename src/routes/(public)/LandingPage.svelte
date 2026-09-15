<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import { authStore, loginWithNip07 } from '$lib/stores/auth';
	import { identityStore } from '$lib/stores/identity';
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
			error = 'Instale uma extensão compatível com NIP-07, como Alby ou nos2x.';
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
	<title>Nupatalicium</title>
	<meta
		name="description"
		content="Contratos nupciais privados com Nostr e Bitcoin Justice Protocol."
	/>
</svelte:head>

<main class="page-shell stack-lg">
	<section class="stack surface" style="padding: 2rem;">
		<div class="stack" style="gap: 0.75rem;">
			<p class="muted">Nupatalicium</p>
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
				<p>Identidade selecionada: <span class="mono">{identity.npub}</span>.</p>
			</Card>
		{/if}

		{#if error}
			<Card>
				<p>{error}</p>
			</Card>
		{/if}

		<div class="row">
			<Button onClick={connect} disabled={connecting}>
				{connecting ? 'Conectando…' : 'Conectar com Nostr'}
			</Button>
			<Button variant="ghost" href="/contracts">Ver contratos</Button>
		</div>
	</section>
</main>
