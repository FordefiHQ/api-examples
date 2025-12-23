import { ethers } from 'ethers';

async function main() {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');

  const sender = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
  const recipient = '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73';
  const amount = ethers.parseEther('100');

  await provider.send('hardhat_impersonateAccount', [sender]);

  const signer = await provider.getSigner(sender);

  const tx = await signer.sendTransaction({
    to: recipient,
    value: amount,
  });

  await provider.send('hardhat_stopImpersonatingAccount', [sender]);

  console.log(`Sent 100 ETH to ${recipient}`);
  console.log(`Transaction hash: ${tx.hash}`);
}

main().catch(console.error);