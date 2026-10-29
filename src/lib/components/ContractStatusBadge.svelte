<script lang="ts">
	import type { ContractStatus } from '$lib/api/contracts';
	import { CONTRACT_STATUS_LABELS } from '$lib/contract-status';

	let { status }: { status: ContractStatus } = $props();
</script>

<span class="contract-status status-{status.toLowerCase().replaceAll('_', '-')}">
	{CONTRACT_STATUS_LABELS[status]}
</span>

<style>
	.contract-status {
		display: inline-flex;
		align-items: center;
		width: fit-content;
		padding: 0.38rem 0.58rem;
		border: 1px solid;
		border-radius: 5px;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.025em;
		line-height: 1.15;
		white-space: nowrap;
	}

	.status-draft {
		border-color: var(--status-draft-border);
		background: var(--status-draft-bg);
		color: var(--status-draft-text);
	}

	.status-pending-acceptance {
		border-color: var(--status-pending-border);
		background: var(--status-pending-bg);
		color: var(--status-pending-text);
	}

	.status-awaiting-funding {
		border-color: var(--status-funding-border);
		background: var(--status-funding-bg);
		color: var(--status-funding-text);
	}

	.status-active {
		border-color: var(--status-active-border);
		background: var(--status-active-bg);
		color: var(--status-active-text);
	}

	.status-closed {
		border-color: var(--status-closed-border);
		background: var(--status-closed-bg);
		color: var(--status-closed-text);
	}

	.status-cancelled {
		border-color: var(--danger-border);
		background: var(--danger-bg);
		color: var(--danger);
	}

	.status-expired {
		border-color: var(--status-expired-border);
		background: var(--status-expired-bg);
		color: var(--status-expired-text);
	}
</style>
