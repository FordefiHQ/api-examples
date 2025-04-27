import { VersionedTransaction, Transaction, Connection } from '@solana/web3.js'


export async function getCuLimit(tippingTx : Transaction, connection: Connection){
    const versionedTx = new VersionedTransaction(
        tippingTx.compileMessage()
    );
    const simulation = await connection.simulateTransaction(versionedTx, {
        sigVerify: false,
    });
    const targetComputeUnitsAmount = simulation.value.unitsConsumed;
    console.log(`Target compute unit limit -> ${targetComputeUnitsAmount}`)

    return targetComputeUnitsAmount;
}