import { Keypair } from "@stellar/stellar-sdk";

// One-shot helper: generate the keypair for the account that the Fordefi vault
// will sponsor. Prints to stdout only — nothing is written to disk and nothing
// is sent to Fordefi.
//
// This key is what makes the flow work at all: the sponsored account has to sign
// EndSponsoringFutureReserves, and because we hold its seed locally we can attach
// that signature ourselves after Fordefi has signed. It is NOT a second custodial
// signer, which is why the two-Fordefi-vault cosigning blocker doesn't apply here.

const kp = Keypair.random();

console.log("Stellar ed25519 keypair generated (the account to be sponsored).");
console.log();
console.log(`  Public key (G...):   ${kp.publicKey()}`);
console.log(`  Secret seed (S...):  ${kp.secret()}`);
console.log();
console.log("Next step:");
console.log(`  In sponsored-reserves/.env  ->  SPONSORED_ED25519_SECRET=${kp.secret()}`);
console.log();
console.log("The account does not exist on-chain yet — `npm run sponsor` creates it with a");
console.log("zero starting balance, with the vault paying its base reserves.");
console.log();
console.log("The secret seed is a real credential. Whoever holds it controls the sponsored");
console.log("account and any assets it comes to hold; the vault only pays its reserves.");
