<script lang="ts">
	import { onMount } from 'svelte';
	import QRCode from 'qrcode';

	let {
		value,
		size = 208
	}: {
		value: string;
		size?: number;
	} = $props();

	let dataUrl = $state('');
	let error = $state('');

	onMount(async () => {
		try {
			dataUrl = await QRCode.toDataURL(value, {
				type: 'image/png',
				margin: 1,
				width: size,
				color: {
					dark: '#3d3e50',
					light: '#fdfcfc'
				}
			});
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Não foi possível gerar o QR code.';
		}
	});
</script>

{#if error}
	<p class="muted">{error}</p>
{:else if dataUrl}
	<div class="qr">
		<img src={dataUrl} width={size} height={size} alt="QR code do endereço" />
	</div>
{:else}
	<div class="qr placeholder" aria-hidden="true"></div>
{/if}

<style>
	.qr {
		width: fit-content;
		padding: 0.75rem;
		border-radius: 12px;
		background: var(--surface);
		border: 0.5px solid var(--border-gray);
	}

	.placeholder {
		width: 208px;
		height: 208px;
	}
</style>
