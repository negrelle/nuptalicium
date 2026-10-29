<script lang="ts">
	import { dismissToast, toastStore } from '$lib/stores/toast';
</script>

<div class="toast-region" aria-live="assertive" aria-atomic="true">
	{#if $toastStore}
		{#key $toastStore.id}
			<div class="toast" role="alert">
				<span class="toast-icon" aria-hidden="true">!</span>
				<p>{$toastStore.message}</p>
				<button type="button" aria-label="Fechar aviso" onclick={dismissToast}>×</button>
			</div>
		{/key}
	{/if}
</div>

<style>
	.toast-region {
		position: fixed;
		z-index: 100;
		top: 5.5rem;
		right: clamp(1rem, 4vw, 4rem);
		width: min(calc(100vw - 2rem), 26rem);
		pointer-events: none;
	}

	.toast {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--rose-300);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--rose-text);
		box-shadow: var(--shadow-card);
		pointer-events: auto;
		animation: toast-lifecycle 3s ease-out both;
	}

	.toast p {
		margin: 0;
		font-size: 0.92rem;
		font-weight: 600;
		line-height: 1.4;
	}

	.toast-icon {
		display: grid;
		width: 1.6rem;
		height: 1.6rem;
		place-items: center;
		border-radius: 50%;
		background: var(--rose-100);
		font-weight: 800;
	}

	.toast button {
		padding: 0.2rem;
		border: 0;
		background: transparent;
		color: var(--gray-500);
		font-size: 1.3rem;
		line-height: 1;
		cursor: pointer;
	}

	@keyframes toast-lifecycle {
		0% {
			opacity: 0;
			transform: translateY(-0.75rem);
		}
		8%,
		82% {
			opacity: 1;
			transform: translateY(0);
		}
		100% {
			opacity: 0;
			transform: translateY(-0.5rem);
		}
	}

	@media (max-width: 760px) {
		.toast-region {
			top: 4.75rem;
			right: 1rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.toast {
			animation: none;
		}
	}
</style>
