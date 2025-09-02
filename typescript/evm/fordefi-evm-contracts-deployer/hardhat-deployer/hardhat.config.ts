import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";

const config: HardhatUserConfig = {
  solidity: "0.8.30",
  networks: {
    hyperevm: { 
      url: " https://rpc.hyperlend.finance/archive",
      chainId: 999,
    }
  },
  etherscan: {
    apiKey: "YOUR_API_KEY_HERE"
  }
};

export default config;