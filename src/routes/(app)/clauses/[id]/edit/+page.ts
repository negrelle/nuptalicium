export function load({ params }: { params: { id: string } }) {
	return { clauseId: params.id };
}
