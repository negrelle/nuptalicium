<script lang="ts">
	import Arabesque from './Arabesque.svelte';
</script>

<div class="page-ornament page-ornament-top-left" aria-hidden="true">
	<Arabesque />
</div>
<div class="page-ornament page-ornament-top-right" aria-hidden="true">
	<Arabesque />
</div>
<div class="page-ornament page-ornament-bottom-right" aria-hidden="true">
	<Arabesque />
</div>
<div class="page-ornament page-ornament-bottom-left" aria-hidden="true">
	<Arabesque />
</div>

<style>
	.page-ornament {
		position: fixed;
		z-index: 2;
		opacity: 0.16;
		pointer-events: none;
	}

	.page-ornament-top-left {
		top: -2.75rem;
		left: -2.75rem;
		transform: scale(1.35);
	}

	.page-ornament-top-right {
		top: -2.75rem;
		right: -2.75rem;
		transform: scale(1.35) rotate(90deg);
	}

	.page-ornament-bottom-right {
		right: -2.75rem;
		bottom: -2.75rem;
		transform: scale(1.35) rotate(180deg);
	}

	.page-ornament-bottom-left {
		bottom: -2.75rem;
		left: -2.75rem;
		transform: scale(1.35) rotate(-90deg);
	}

	@media (max-width: 640px) {
		.page-ornament {
			display: none;
		}
	}
</style>
