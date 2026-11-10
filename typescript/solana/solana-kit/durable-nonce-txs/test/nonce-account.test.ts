import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import bs58 from 'bs58';
import { parseNonceAccountData } from '../utils/nonce-account';

test('parses an initialized nonce account', () => {
  const authority = bs58.decode('11111111111111111111111111111112');
  const durableNonce = bs58.encode(crypto.randomBytes(32));
  const data = new Uint8Array(80);
  data[0] = 1; // version
  data[4] = 1; // state: initialized
  data.set(authority, 8);
  data.set(bs58.decode(durableNonce), 40);

  const parsed = parseNonceAccountData(data);
  assert.equal(parsed.authority, '11111111111111111111111111111112');
  assert.equal(parsed.durableNonce, durableNonce);
});

test('rejects a non-80-byte account', () => {
  assert.throws(() => parseNonceAccountData(new Uint8Array(79)), /80-byte/);
});

test('rejects an uninitialized or wrong-version account', () => {
  const data = new Uint8Array(80);
  assert.throws(() => parseNonceAccountData(data), /initialized/); // version 0
  data[0] = 1;
  assert.throws(() => parseNonceAccountData(data), /initialized/); // state 0 (uninitialized)
});
