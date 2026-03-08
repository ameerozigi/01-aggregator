import { ethers } from "hardhat";

async function main() {
  const Factory = await ethers.getContractFactory("O1DexAggregator");
  const aggregator = await Factory.deploy();
  await aggregator.waitForDeployment();
  console.log("O1DexAggregator deployed to:", await aggregator.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
