import * as kit from '@solana/kit';
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';

const TOKEN_2022_PROGRAM_ADDRESS = kit.address('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

/**
 * The token program that owns a mint is part of the associated token account's seeds and must be
 * passed to every token instruction, so resolve it from the mint itself rather than assuming the
 * classic SPL Token program (USDG, for example, is a Token-2022 mint).
 */
export async function getTokenProgramForMint(rpc: kit.Rpc<kit.GetAccountInfoApi>, mint: kit.Address): Promise<kit.Address> {
  const { value } = await rpc.getAccountInfo(mint, { encoding: 'base64' }).send();
  if (!value) {
    throw new Error(`Mint ${mint} not found - check the mint and RPC URL in config.ts`);
  }
  if (value.owner !== TOKEN_PROGRAM_ADDRESS && value.owner !== TOKEN_2022_PROGRAM_ADDRESS) {
    throw new Error(`Mint ${mint} is not owned by a token program (owner: ${value.owner})`);
  }
  return value.owner;
}
