import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import dotenv from 'dotenv';

dotenv.config()

const config: HardhatUserConfig = {
  solidity: "0.8.30",
  networks: {
    hyperevm: { 
      url: " https://rpc.hyperlend.finance/archive",
      chainId: 999,
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  sourcify: {
    enabled: true
  }
};

export default config;