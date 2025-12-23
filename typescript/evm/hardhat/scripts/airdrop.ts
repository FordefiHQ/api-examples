import { createTestClient, createWalletClient, http, parseEther } from 'viem';
import { hardhat } from 'viem/chains';

async function main() {
  const testClient = createTestClient({
    chain: hardhat,
    mode: 'hardhat',
    transport: http('http://127.0.0.1:8545'),
  });

  const walletClient = createWalletClient({
    chain: hardhat,
    transport: http('http://127.0.0.1:8545'),
  });

  const sender = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
  const recipient = '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73';
  const amount = parseEther('100');

  await testClient.impersonateAccount({ address: sender });

  const hash = await walletClient.sendTransaction({
    account: sender,
    to: recipient,
    value: amount,
  });

  await testClient.stopImpersonatingAccount({ address: sender });

  console.log(`Sent 100 ETH to ${recipient}`);
  console.log(`Transaction hash: ${hash}`);
}

main().catch(console.error);