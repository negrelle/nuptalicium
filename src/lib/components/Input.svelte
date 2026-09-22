<script lang="ts">
	type InputType = 'text' | 'email' | 'number' | 'password' | 'url' | 'tel' | 'datetime-local';
	type InputMode = 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';

	let {
		label,
		value = $bindable('' as string | number),
		textarea = false,
		type = 'text',
		placeholder = '',
		rows = 4,
		description = '',
		required = false,
		min,
		max,
		step,
		inputmode,
		id = `input-${Math.random().toString(36).slice(2, 10)}`
	}: {
		label: string;
		value?: string | number;
		textarea?: boolean;
		type?: InputType;
		placeholder?: string;
		rows?: number;
		description?: string;
		required?: boolean;
		min?: number;
		max?: number;
		step?: number;
		inputmode?: InputMode;
		id?: string;
	} = $props();
</script>

<label class="field" for={id}>
	<span class="label">{label}</span>
	{#if textarea}
		<textarea {id} bind:value {rows} {placeholder} {required} class="control"></textarea>
	{:else}
		<input
			{id}
			bind:value
			{type}
			{placeholder}
			{required}
			{min}
			{max}
			{step}
			{inputmode}
			class="control"
		/>
	{/if}
	{#if description}
		<small>{description}</small>
	{/if}
</label>

<style>
	.field {
		display: grid;
		gap: 0.4rem;
	}

	.label {
		color: var(--gray-700);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.055em;
		line-height: 1.25;
		text-transform: uppercase;
	}

	.control {
		width: 100%;
		min-height: var(--control-height);
		padding: 0.78rem 0.95rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-gray);
		background: var(--surface);
		color: var(--gray-900);
		font-size: 0.98rem;
		font-weight: 400;
		outline: none;
		transition:
			border-color 160ms ease,
			box-shadow 160ms ease,
			background-color 160ms ease;
	}

	.control:focus {
		border-color: var(--rose-400);
		background: white;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	textarea.control {
		min-height: 7rem;
		resize: vertical;
	}
</style>
