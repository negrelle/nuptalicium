// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface PageData {
			contractId?: string;
		}
	}

	interface Window {
		nostr?: {
			getPublicKey(): Promise<string>;
			signEvent<
				T extends {
					content: string;
					created_at: number;
					kind: number;
					tags: string[][];
					pubkey: string;
				}
			>(
				event: T
			): Promise<T>;
			signSchnorr?(hashHex: string): Promise<string>;
			nip04?: {
				encrypt(pubkey: string, text: string): Promise<string>;
				decrypt(pubkey: string, text: string): Promise<string>;
			};
		};
	}
}

export {};
