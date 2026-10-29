<script lang="ts">
	import '../app.css';
	import '$lib/node-globals';
	import favicon from '$lib/assets/favicon.svg';
	import AlertDialog from '$lib/components/AlertDialog.svelte';
	import PageOrnaments from '$lib/components/PageOrnaments.svelte';
	import ToastHost from '$lib/components/ToastHost.svelte';
	import { initializeTheme } from '$lib/stores/theme';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(initializeTheme);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="site-frame">
	<PageOrnaments />
	<div class="site-content">
		{@render children()}
	</div>
</div>
<AlertDialog />
<ToastHost />

<style>
	.site-frame {
		position: relative;
		isolation: isolate;
		min-height: 100vh;
	}

	.site-content {
		position: relative;
		z-index: 1;
		min-height: 100vh;
	}
</style>
