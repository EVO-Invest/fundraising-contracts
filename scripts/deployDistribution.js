const { ethers, upgrades } = require("hardhat");


async function deploy() {
  const Distribution = await ethers.getContractFactory("Distribution");
  const distribution = await Distribution.deploy();
  await distribution.deployed();
  console.log("Distribution deployed to:", distribution.address)

  const chownTx = await distribution.transferOwnership("")
  await chownTx.wait()
}

async function main(){
  await deploy();
}

main();
