const { ethers, upgrades } = require("hardhat");
const readline = require("readline-sync");
const getAccounts = require("./DEPLOYMENTS")

async function main() {
  const RewardCalcs = await ethers.getContractFactory("RewardCalcs");
  await upgrades.upgradeProxy(getAccounts("RewardCalcs"), RewardCalcs);

  console.log("RewardsCalc successfully upgraded!");
}

main();
