import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const tokenAddress = process.argv[2] || "0x5dEaC602762362FE5f135FA5904351916053cF70";
const holderAddress = process.argv[3] || "0x1b698976bbfbb33266351f294929ec6edd7bd7a9";
const rpcUrl = process.argv[4] || process.env.BUILDBEAR_RPC_URL;

if (!rpcUrl) {
  console.error("Missing RPC URL. Set BUILDBEAR_RPC_URL in .env or pass as 4th arg.");
  process.exit(1);
}

const abi = ["function balanceOf(address) view returns (uint256)"];

async function main() {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(tokenAddress, abi, provider);
  const bal = await contract.balanceOf(holderAddress);
  console.log(`balanceOf(${holderAddress}) at ${tokenAddress}: ${bal.toString()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
