import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		wasm(),
		nodePolyfills({
			exclude: ['module'],
			globals: {
				Buffer: true,
				process: true,
				global: true
			}
		}),
		tailwindcss(),
		sveltekit()
	]
});
