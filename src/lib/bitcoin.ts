import type { Network, Signer, SignerAsync } from 'bitcoinjs-lib';
import * as bitcoin from 'bitcoinjs-lib';
import { payments, script } from 'bitcoinjs-lib';
import * as ECPairModule from 'ecpair';
import type { ECPairInterface } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';

bitcoin.initEccLib(ecc);

const resolvedECPairFactory =
	(ECPairModule as { ECPairFactory?: unknown }).ECPairFactory ??
	(ECPairModule as { default?: { ECPairFactory?: unknown } }).default?.ECPairFactory ??
	(ECPairModule as { default?: unknown }).default;

if (typeof resolvedECPairFactory !== 'function') {
	throw new Error('Não foi possível inicializar ECPairFactory a partir do pacote ecpair.');
}

const ECPair = (
	resolvedECPairFactory as (eccLib: typeof ecc) => ReturnType<typeof ECPairModule.ECPairFactory>
)(ecc);

const INVALID_INTERNAL_KEY = Buffer.from(
	'50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0',
	'hex'
);

export interface UTXO {
	txid: string;
	vout: number;
	value: number;
}

export interface ContractWallet {
	multisig: bitcoin.payments.Payment;
	multisigScripts: Array<{
		weight: number;
		leaf: { output: Buffer };
		combination: ECPairInterface[];
	}>;
	multisigAddress: string;
	multisigScriptHex: string;
	multisigRedeemHex: string;
	partyAddresses: [string, string];
}

export function pubkeyToECPair(pubkeyHex: string) {
	return ECPair.fromPublicKey(Buffer.from(`02${pubkeyHex}`, 'hex'));
}

function combine<T>(items: T[], size: number): T[][] {
	const intCombine = (acc: T[], rem: T[], curr: number): T[][] => {
		if (curr === 0) return [acc];
		return rem.flatMap((item, index) => intCombine([...acc, item], rem.slice(index + 1), curr - 1));
	};

	return intCombine([], items, size);
}

function createTaptreeFromLeaves(
	leaves: Array<{ output: Buffer }>
): bitcoin.payments.Payment['scriptTree'] {
	if (leaves.length === 0) {
		return undefined;
	}

	return leaves
		.slice(1)
		.reduce<
			bitcoin.payments.Payment['scriptTree']
		>((acc, leaf) => [acc as never, leaf as never], leaves[0] as never);
}

export function createBitcoinMultisig(
	publicPartsECPairs: ECPairInterface[],
	publicArbitratorsECPairs: ECPairInterface[],
	arbitratorsQuorum: number,
	network: Network
) {
	const eachChildNodeWithArbitratorsQuorum = publicPartsECPairs.flatMap((part) =>
		combine(publicArbitratorsECPairs, arbitratorsQuorum).map((arbitrators) => [
			part,
			...arbitrators
		])
	);

	const childNodesCombinations = [publicPartsECPairs, ...eachChildNodeWithArbitratorsQuorum];

	const multisigAsms = childNodesCombinations.map(
		(childNodes) =>
			childNodes
				.map((childNode) => toXOnly(childNode.publicKey).toString('hex'))
				.map((pubkey, index) => `${pubkey} ${index ? 'OP_CHECKSIGADD' : 'OP_CHECKSIG'}`)
				.join(' ') + ` OP_${childNodes.length} OP_NUMEQUAL`
	);

	const multisigScripts = multisigAsms.map((asm, index) => ({
		weight: index ? 1 : 5,
		leaf: { output: script.fromASM(asm) },
		combination: childNodesCombinations[index]!
	}));

	const scriptTree = createTaptreeFromLeaves(multisigScripts.map(({ leaf }) => leaf));

	const multisig = payments.p2tr({
		internalPubkey: toXOnly(INVALID_INTERNAL_KEY),
		scriptTree,
		network
	});

	return { multisigScripts, multisig };
}

export function deriveTaprootAddressFromPubkey(pubkeyHex: string, network: Network) {
	const payment = payments.p2tr({
		internalPubkey: toXOnly(Buffer.from(`02${pubkeyHex}`, 'hex')),
		network
	});

	if (!payment.address) {
		throw new Error('Não foi possível derivar o endereço Taproot.');
	}

	return payment.address;
}

export function createContractWallet(
	partyPubkeys: [string, string],
	arbitratorPubkeys: [string, string, string],
	arbitratorsQuorum: number,
	network: Network
): ContractWallet {
	const partyPairs = partyPubkeys.map(pubkeyToECPair);
	const arbitratorPairs = arbitratorPubkeys.map(pubkeyToECPair);
	const { multisigScripts, multisig } = createBitcoinMultisig(
		partyPairs,
		arbitratorPairs,
		arbitratorsQuorum,
		network
	);

	const multisigAddress = multisig.address || '';
	const multisigRedeemHex = multisigScripts[0]?.leaf.output.toString('hex') || '';
	const multisigScriptHex = multisig.output?.toString('hex') || '';
	const partyAddresses: [string, string] = [
		deriveTaprootAddressFromPubkey(partyPubkeys[0], network),
		deriveTaprootAddressFromPubkey(partyPubkeys[1], network)
	];

	return {
		multisig,
		multisigScripts,
		multisigAddress,
		multisigScriptHex,
		multisigRedeemHex,
		partyAddresses
	};
}

function createTapLeafScript(redeemOutputHex: string, multisig: bitcoin.payments.Payment) {
	if (!multisig.scriptTree) {
		throw new Error('Multisig Taproot inválido.');
	}

	const redeemOutput = Buffer.from(redeemOutputHex, 'hex');
	const multisigRedeem = {
		output: redeemOutput,
		redeemVersion: 192
	};

	const multisigP2tr = payments.p2tr({
		internalPubkey: toXOnly(INVALID_INTERNAL_KEY),
		scriptTree: multisig.scriptTree,
		redeem: multisigRedeem,
		network: multisig.network as Network
	});

	return {
		output: redeemOutput,
		tapLeafScript: {
			leafVersion: multisigRedeem.redeemVersion,
			script: redeemOutput,
			controlBlock: multisigP2tr.witness![multisigP2tr.witness!.length - 1]!
		}
	};
}

export async function buildSignedDissolutionPsbt(
	wallet: ContractWallet,
	redeemOutputHex: string,
	signer: Signer | SignerAsync,
	network: Network,
	utxos: UTXO[],
	receivingAddresses: { address: string; value: number }[],
	locktime?: number
) {
	const { tapLeafScript } = createTapLeafScript(redeemOutputHex, wallet.multisig);
	const psbt = new bitcoin.Psbt({ network });

	psbt.addInputs(
		utxos.map((utxo) => ({
			hash: utxo.txid,
			index: utxo.vout,
			witnessUtxo: { value: utxo.value, script: wallet.multisig.output! },
			tapLeafScript: [tapLeafScript]
		}))
	);

	if (locktime) {
		psbt.setLocktime(locktime);
		psbt.txInputs.forEach((_, index) => psbt.setInputSequence(index, 0));
	}

	psbt.addOutputs(receivingAddresses);
	await psbt.signAllInputsAsync(signer);
	return psbt;
}

export function createNip07TaprootSigner(pubkeyHex: string) {
	const signSchnorr = window.nostr?.signSchnorr;

	if (!signSchnorr) {
		throw new Error('Sua extensão não suporta assinatura Schnorr.');
	}

	return {
		publicKey: Buffer.from(`02${pubkeyHex}`, 'hex'),
		sign() {
			throw new Error('Assinatura ECDSA não suportada neste fluxo.');
		},
		async signSchnorr(hash: Buffer) {
			return Buffer.from(await signSchnorr(hash.toString('hex')), 'hex');
		}
	};
}
