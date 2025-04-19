export async function getPriorityFees(): Promise<number> {
    const response = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getRecentPrioritizationFees'
        }),
    });
    
    const data = await response.json();
    
    // Calculate average of prioritization fees for the last 150 blocks
    const fees: number[] = data.result.map((item: { slot: number, prioritizationFee: number }) => item.prioritizationFee);
    const sum: number = fees.reduce((acc: number, fee: number) => acc + fee, 0);
    const average: number = Math.ceil(sum / fees.length);
    const buffer: number = 1000
    const finalFee: number = average + buffer
   
    console.log(`Priority fee -> ${finalFee}`)

    return finalFee;
}