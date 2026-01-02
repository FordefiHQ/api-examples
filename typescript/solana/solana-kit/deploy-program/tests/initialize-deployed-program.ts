import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import fs from "fs";
import path from "path";

const PROGRAM_ID = new PublicKey("Prg1GzogBqdvQTx2fNBBcdVnRKUQYCWP73CcQrjYcr7");
const INITIALIZE_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

(async () => {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    // Load wallet from default Solana CLI location
    const walletPath = path.join(process.env.HOME!, ".config/solana/id.json");
    const walletKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
    );

    console.log("Wallet:", walletKeypair.publicKey.toBase58());
    console.log("Program ID:", PROGRAM_ID.toBase58());

    const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [],
        data: INITIALIZE_DISCRIMINATOR,
    });

    const tx = new Transaction().add(instruction);

    const signature = await sendAndConfirmTransaction(connection, tx, [walletKeypair]);
    console.log("Transaction signature:", signature);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
})();
