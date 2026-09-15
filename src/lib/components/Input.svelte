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
		color: var(--gray-500);
		font-size: 0.69rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.control {
		width: 100%;
		padding: 0.9rem 1rem;
		border-radius: 12px;
		border: 1px solid var(--border-gray);
		background: var(--gray-bg);
		color: var(--gray-900);
		outline: none;
		transition:
			border-color 200ms ease,
			background-color 200ms ease;
	}

	.control:focus {
		border-color: var(--rose-300);
		background: white;
	}

	textarea.control {
		resize: vertical;
	}
</style>
