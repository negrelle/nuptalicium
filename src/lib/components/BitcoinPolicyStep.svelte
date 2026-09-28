<script lang="ts">
	import Button from './Button.svelte';

	let {
		address,
		policyHash,
		ready,
		busy,
		onInitialize
	}: {
		address: string;
		policyHash: string;
		ready: boolean;
		busy: boolean;
		onInitialize: () => void | Promise<void>;
	} = $props();
</script>

<div class="stack">
	<h2>Política Bitcoin</h2>
	<p class="muted">
		A política Taproot será construída com os participantes deste contrato e fará parte do conteúdo
		assinado.
	</p>
	{#if address}
		<div class="surface-gray policy">
			<span class="label">Endereço Taproot Testnet4</span>
			<p class="technical break">{address}</p>
			<span class="label">Hash da política</span>
			<p class="technical break">{policyHash}</p>
		</div>
	{/if}
	<Button disabled={busy || ready} onClick={onInitialize}>
		{ready ? 'Política inicializada' : busy ? 'Inicializando…' : 'Inicializar política Bitcoin'}
	</Button>
</div>

<style>
	.policy {
		padding: 1rem;
	}
	.break {
		overflow-wrap: anywhere;
	}
</style>
