import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];
const buildbearUrl =
  process.env.BUILDBEAR_RPC_URL || "https://rpc.buildbear.io/uninterested-jubilee-f6fb4294";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 800 },
      viaIR: true
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    buildbear: {
      type: "http",
      url: buildbearUrl,
      chainId: 31337,
      accounts: PRIVATE_KEY
    },
    baseSepolia: {
      type: "http",
      url: buildbearUrl,
      chainId: 31337,
      accounts: PRIVATE_KEY
    }
  }
};

export default config;
