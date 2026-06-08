// Constants
export const TESTNET_GUARDIAN_NODES = [
  {
    nodeId: 'node-1',
    publicKey: '04bab844e8620c4a1ec304df6284cd6fdffcde79b3330a7bffb1e4cecfee72d02a7c1f3a4415b253dc8d6ca2146db170e1617605cc8a4160f539890b8a24712152',
  },
  {
    nodeId: 'hl-node-testnet',
    publicKey: '04502d20a0d8d8aaea9395eb46d50ad2d8278c1b3a3bcdc200d531253612be23f5f2e9709bf3a3a50d1447281fa81aca0bf2ac2a6a3cb8a12978381d73c24bb2d9',
  },
  {
    nodeId: 'field-node',
    publicKey: '04e674a796ff01d6b74f4ee4079640729797538cdb4926ec333ce1bd18414ef7f22c1a142fd76dca120614045273f30338cd07d79bc99872c76151756aaec0f8e8',
  },
];

export const MAINNET_GUARDIAN_NODES = [
  {
    nodeId: 'unit-node',
    publicKey: '04dc6f89f921dc816aa69b687be1fcc3cc1d48912629abc2c9964e807422e1047e0435cb5ba0fa53cb9a57a9c610b4e872a0a2caedda78c4f85ebafcca93524061',
  },
  {
    nodeId: 'hl-node',
    publicKey: '048633ea6ab7e40cdacf37d1340057e84bb9810de0687af78d031e9b07b65ad4ab379180ab55075f5c2ebb96dab30d2c2fab49d5635845327b6a3c27d20ba4755b',
  },
  {
    nodeId: 'field-node',
    publicKey: '04ae2ab20787f816ea5d13f36c4c4f7e196e29e867086f3ce818abb73077a237f841b33ada5be71b83f4af29f333dedc5411ca4016bd52ab657db2896ef374ce99',
  },
];

export const GUARDIAN_SIGNATURE_THRESHOLD = 2;

// Unit protocol minimum BTC deposit. Per Unit's own policy, any deposit below
// this amount (or sent from the wrong network) is LOST — not credited, not
// refunded. 0.0003 BTC = 30_000 satoshis.
export const MIN_BTC_DEPOSIT_SATS = 30_000;