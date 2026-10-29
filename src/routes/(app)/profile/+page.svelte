<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import NpubDisplay from '$lib/components/NpubDisplay.svelte';
	import { ApiError } from '$lib/api/client';
	import { updateProfile } from '$lib/api/users';
	import { authStore, getAuthSnapshot, updateAuthenticatedUser } from '$lib/stores/auth';
	import { getIdentitySnapshot } from '$lib/stores/identity';
	import { showValidationToast } from '$lib/stores/toast';
	import { onMount } from 'svelte';

	let displayName = $state('');
	let npub = $state('');
	let saving = $state(false);
	let success = $state('');
	let error = $state('');
	let hasEdited = $state(false);

	onMount(() => {
		const unsubscribe = authStore.subscribe((session) => {
			if (!hasEdited) displayName = session?.user.displayName ?? '';
		});
		npub = getIdentitySnapshot()?.npub ?? '';

		return unsubscribe;
	});

	async function saveProfile(event: SubmitEvent) {
		event.preventDefault();
		const session = getAuthSnapshot();
		if (!session || saving) return;

		saving = true;
		success = '';
		error = '';

		try {
			const user = await updateProfile(session.accessToken, displayName.trim() || null);
			updateAuthenticatedUser(user);
			displayName = user.displayName ?? '';
			hasEdited = false;
			success = 'Perfil atualizado com sucesso.';
		} catch (caught) {
			if (caught instanceof ApiError && caught.status === 409) {
				showValidationToast('Esse nome de exibição já está sendo usado.');
			} else {
				error = caught instanceof Error ? caught.message : 'Não foi possível atualizar o perfil.';
			}
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Perfil · Nuptalicium</title>
</svelte:head>

<section class="profile-page stack-lg">
	<header class="stack profile-heading">
		<span class="eyebrow">Sua conta</span>
		<div class="stack heading-copy">
			<h1>Perfil</h1>
			<p class="muted">Escolha como seu nome aparece no Nuptalicium.</p>
		</div>
	</header>

	<form class="surface profile-card stack" onsubmit={saveProfile}>
		<div class="field">
			<label for="display-name">Nome de exibição</label>
			<input
				class="control"
				id="display-name"
				name="displayName"
				bind:value={displayName}
				oninput={() => (hasEdited = true)}
				maxlength="50"
				autocomplete="name"
				placeholder="Como você quer ser chamado"
			/>
			<small>Até 50 caracteres. Deixe vazio para usar sua npub.</small>
		</div>

		{#if npub}
			<div class="identity-row">
				<div class="stack identity-copy">
					<span class="field-label">Identidade Nostr</span>
					<small>Sua chave pública continua sendo a identidade da conta.</small>
				</div>
				<NpubDisplay value={npub} />
			</div>
		{/if}

		{#if success}
			<p class="message success" role="status">{success}</p>
		{/if}
		{#if error}
			<p class="message error" role="alert">{error}</p>
		{/if}

		<div class="form-actions">
			<Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar perfil'}</Button>
		</div>
	</form>
</section>

<style>
	.profile-page {
		width: min(100%, 46rem);
		margin: 0 auto;
	}

	.profile-heading {
		gap: 0.65rem;
	}

	.heading-copy {
		gap: 0.55rem;
	}

	.eyebrow {
		color: var(--rose-text);
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.profile-card {
		padding: clamp(1.25rem, 4vw, 2.25rem);
	}

	.identity-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid var(--border-gray);
		border-radius: var(--radius-md);
		background: var(--gray-bg);
	}

	.identity-copy {
		gap: 0.2rem;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
	}

	@media (max-width: 560px) {
		.identity-row {
			align-items: flex-start;
			flex-direction: column;
		}

		.form-actions :global(.button) {
			width: 100%;
		}
	}
</style>
