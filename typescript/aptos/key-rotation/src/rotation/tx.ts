import {
  InputEntryFunctionData,
  MoveVector,
  U8,
  SigningSchemeInput,
} from "@aptos-labs/ts-sdk";
import { RotateAuthKeyPayloadArgs } from "./types";

/**
 * Build the entry function payload for `0x1::account::rotate_authentication_key`.
 *
 * Arguments (in order):
 *   from_scheme:                u8
 *   from_public_key_bytes:      vector<u8>
 *   to_scheme:                  u8
 *   to_public_key_bytes:        vector<u8>
 *   cap_rotate_key:             vector<u8>  (proof signed by current/old key)
 *   cap_update_table:           vector<u8>  (proof signed by new key)
 */
export function buildRotateAuthKeyPayload(
  args: RotateAuthKeyPayloadArgs
): InputEntryFunctionData {
  return {
    function: "0x1::account::rotate_authentication_key",
    functionArguments: [
      new U8(args.fromScheme),
      MoveVector.U8(args.fromPublicKey),
      new U8(args.toScheme),
      MoveVector.U8(args.toPublicKey),
      MoveVector.U8(args.proofSignedByCurrentKey),
      MoveVector.U8(args.proofSignedByNewKey),
    ],
  };
}

/**
 * Convenience: Ed25519 scheme constant (0).
 */
export const ED25519_SCHEME = SigningSchemeInput.Ed25519;
