import { Buffer } from 'buffer';
import process from 'process';

// Browser runtime shims required by bitcoin/crypto packages.
if (typeof globalThis !== 'undefined') {
	if (!('global' in globalThis)) {
		(globalThis as typeof globalThis & { global: typeof globalThis }).global = globalThis;
	}

	if (!('Buffer' in globalThis)) {
		(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;
	}

	if (!('process' in globalThis)) {
		(globalThis as typeof globalThis & { process: typeof process }).process = process;
	}
}
