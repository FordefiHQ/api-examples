import { ethers } from 'ethers';

async function main() {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');

  const tx = await provider.getTransaction(
    '0xa5dad0319e5dba60c0f8d7f6f387269a1f41ba5932f05f90fb901b33f21f4a42'
  );

  console.log(tx);
}

main().catch(console.error);