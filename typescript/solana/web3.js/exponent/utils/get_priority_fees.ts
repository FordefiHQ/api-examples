import { Connection, TransactionInstruction } from "@solana/web3.js";

export async function getPriorityFees(instructions: TransactionInstruction[], mainnetRpc: Connection): Promise<number> {
    const accounts = instructions.flatMap(ix => ix.keys.map(key => key.pubkey));
    
    const response = await mainnetRpc
    .getRecentPrioritizationFees({ lockedWritableAccounts: accounts })

    const fees = response;
    
    if (!fees || !Array.isArray(fees)) {
        console.error('Invalid response format:', response);
        return 1000; // fallback fee
    }
    const nonZeroFees: number[] = fees
        .map((item: { slot: number, prioritizationFee: number }) => item.prioritizationFee)
        .filter(fee => fee > 0);
    if (nonZeroFees.length === 0) {
        return 1000;
    }
    const sum: number = nonZeroFees.reduce((acc: number, fee: number) => acc + fee, 0);
    const average: number = Math.ceil(sum / nonZeroFees.length);
    const buffer: number = 1000;
    const finalFee: number = average + buffer;
    console.log("Priority fee:", finalFee)

    return finalFee;
}