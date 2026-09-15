<script lang="ts">
	let { value }: { value: string } = $props();

	const shortValue = $derived(
		value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
	);
</script>

<output class="pill" title={value}>{shortValue}</output>
