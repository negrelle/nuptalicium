<script lang="ts">
	import { alertStore, dismissAlert, resolveAlert } from '$lib/stores/alert';
</script>

{#if $alertStore}
	<div
		class="alert-backdrop"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) {
				if ($alertStore?.cancelLabel) resolveAlert(false);
				else dismissAlert();
			}
		}}
	>
		<dialog
			open
			class:danger={$alertStore.variant === 'danger'}
			class:success={$alertStore.variant === 'success'}
			class="alert-dialog"
			aria-labelledby={`alert-title-${$alertStore.id}`}
			aria-describedby={`alert-message-${$alertStore.id}`}
		>
			<span class="alert-icon" aria-hidden="true">
				{$alertStore.variant === 'danger' ? '!' : $alertStore.variant === 'success' ? '✓' : 'i'}
			</span>
			<div class="stack compact alert-copy">
				<h2 id={`alert-title-${$alertStore.id}`}>{$alertStore.title}</h2>
				<p id={`alert-message-${$alertStore.id}`}>{$alertStore.message}</p>
			</div>
			<div class="row alert-actions">
				{#if $alertStore.cancelLabel}
					<button type="button" class="secondary" onclick={() => resolveAlert(false)}>
						{$alertStore.cancelLabel}
					</button>
				{/if}
				<button type="button" class="primary" onclick={() => resolveAlert(true)}>
					{$alertStore.confirmLabel}
				</button>
			</div>
		</dialog>
	</div>
{/if}

<style>
	.alert-backdrop {
		position: fixed;
		z-index: 1000;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: var(--overlay);
		backdrop-filter: blur(3px);
	}
	.alert-dialog {
		width: min(100%, 29rem);
		margin: 0;
		display: grid;
		justify-items: center;
		gap: 1.2rem;
		padding: 2rem;
		border: 1px solid var(--rose-300);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-card);
		text-align: center;
	}
	.alert-icon {
		display: grid;
		width: 3.4rem;
		height: 3.4rem;
		place-items: center;
		border-radius: 50%;
		background: var(--rose-100);
		color: var(--rose-text);
		font-size: 1.6rem;
		font-weight: 800;
	}
	.alert-dialog.danger .alert-icon {
		background: var(--danger);
		color: white;
	}
	.alert-dialog.success .alert-icon {
		background: var(--success-bg);
		color: var(--success-text);
	}
	.alert-copy {
		max-width: 25rem;
	}
	.alert-copy h2 {
		font-size: 1.35rem;
	}
	.alert-copy p {
		color: var(--gray-700);
		line-height: 1.55;
	}
	.alert-actions {
		justify-content: center;
		flex-wrap: wrap;
	}
	.alert-actions button {
		min-height: var(--control-height);
		padding: 0.72rem 1.15rem;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		font: inherit;
		font-size: 0.94rem;
		font-weight: 700;
		cursor: pointer;
	}
	.alert-actions .primary {
		background: var(--rose-400);
		color: white;
	}
	.alert-actions .secondary {
		border-color: var(--border-gray);
		background: var(--surface);
		color: var(--gray-700);
	}
	@media (max-width: 480px) {
		.alert-dialog {
			padding: 1.5rem;
		}
		.alert-actions {
			align-items: stretch;
			flex-direction: column-reverse;
			width: 100%;
		}
		.alert-actions button {
			width: 100%;
		}
	}
</style>
