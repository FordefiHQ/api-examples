import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');

  const deployer = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

  await provider.send('hardhat_impersonateAccount', [deployer]);
  const signer = await provider.getSigner(deployer);

  const tokenName = 'MyToken';
  const tokenSymbol = 'MTK';
  const initialSupply = 1000000;

  const artifactPath = join(process.cwd(), 'artifacts/contracts/Token.sol/Token.json');
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const token = await factory.deploy(tokenName, tokenSymbol, initialSupply);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();

  const fordefiWallet = '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73';
  const airdropAmount = 10000;
  const tokenContract = new ethers.Contract(tokenAddress, artifact.abi, signer);
  await tokenContract.transfer(fordefiWallet, ethers.parseUnits(airdropAmount.toString(), 18));

  await provider.send('hardhat_stopImpersonatingAccount', [deployer]);

  console.log(`Token deployed!`);
  console.log(`  Name: ${tokenName}`);
  console.log(`  Symbol: ${tokenSymbol}`);
  console.log(`  Initial Supply: ${initialSupply.toLocaleString()} ${tokenSymbol}`);
  console.log(`  Address: ${tokenAddress}`);
  console.log(`  Deployer: ${deployer}`);
  console.log(`  Airdropped: ${airdropAmount.toLocaleString()} ${tokenSymbol} to ${fordefiWallet}`);
}

main().catch(console.error);
