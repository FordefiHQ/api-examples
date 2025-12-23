import { createPublicClient, http } from 'viem';
import { hardhat } from 'viem/chains';

async function main() {
    const publicClient = createPublicClient({
    chain: hardhat,
    transport: http('http://127.0.0.1:8545'),
    });

    const tx = await publicClient.getTransaction({
    hash: '0x4f4d53bf4e20cfb2f13a7abb714fefa552259539b87fe0504af01b53b3c13684',
    });

    console.log(tx);
} main().catch(console.error);