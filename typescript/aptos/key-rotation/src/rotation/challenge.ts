import {
  RotationProofChallenge,
  AccountAddress,
  Ed25519PublicKey,
} from "@aptos-labs/ts-sdk";
import { RotationChallengeArgs } from "./types";

/**
 * Build the BCS-serialized RotationProofChallenge bytes.
 *
 * These bytes must be signed by both the current (old) key and the new key
 * to prove ownership of both during `0x1::account::rotate_authentication_key`.
 */
export function buildRotationChallenge(args: RotationChallengeArgs): Uint8Array {
  const challenge = new RotationProofChallenge({
    sequenceNumber: args.sequenceNumber,
    originator: args.originator,
    currentAuthKey: args.currentAuthKey,
    newPublicKey: new Ed25519PublicKey(args.newPublicKeyBytes),
  });

  return challenge.bcsToBytes();
}
