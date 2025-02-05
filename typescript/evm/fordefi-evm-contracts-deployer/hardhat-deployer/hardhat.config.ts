import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    polygon: { 
      url: "https://polygon.llamarpc.com", // Fallback JSON-RPC URL
      chainId: 137, // Decimal value of the chain id
    }
  }
};

export default config;
