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
		border-color: #d6d6df;
		background: #eeeef2;
		color: #555665;
	}

	.status-pending-acceptance {
		border-color: #e5c9c9;
		background: #f7eaea;
		color: #875050;
	}

	.status-awaiting-funding {
		border-color: #e2d3b8;
		background: #f5efe4;
		color: #765e3d;
	}

	.status-active {
		border-color: #c8dccb;
		background: #eaf2eb;
		color: #386641;
	}

	.status-closed {
		border-color: #c9d5dd;
		background: #e9eef2;
		color: #49616e;
	}

	.status-cancelled {
		border-color: #e4bebe;
		background: #f5e7e7;
		color: #8e4545;
	}

	.status-expired {
		border-color: #d7c8da;
		background: #eee8ef;
		color: #6f5574;
	}
</style>
