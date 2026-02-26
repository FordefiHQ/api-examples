import { AccountAddress } from "@aptos-labs/ts-sdk";

export interface RotationChallengeArgs {
  sequenceNumber: bigint;
  originator: AccountAddress;
  currentAuthKey: AccountAddress;
  newPublicKeyBytes: Uint8Array;
}

export interface RotateAuthKeyPayloadArgs {
  fromScheme: number;
  fromPublicKey: Uint8Array;
  toScheme: number;
  toPublicKey: Uint8Array;
  proofSignedByCurrentKey: Uint8Array;
  proofSignedByNewKey: Uint8Array;
}
