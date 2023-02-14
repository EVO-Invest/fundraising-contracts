const { ethers, upgrades } = require("hardhat");

const getAccounts = require("./DEPLOYMENTS")


async function deploy() {
  const Ranking = await ethers.getContractFactory("Ranking");
  const Gateway = await ethers.getContractFactory("Gateway");
  const UnionWallet = await ethers.getContractFactory("UnionWallet");
  const RewardDistributor = await ethers.getContractFactory("RewardCalcs");

  /*
  const ranking = await Ranking.deploy();
  await ranking.deployed();
  console.log("Ranking deployed to:", ranking.address)
  */

  /*
  const gateway = await upgrades.deployProxy(Gateway, []);
  console.log("Gateway deployed to:", gateway.address)
  */
  /*
  const gateway = Gateway.attach(getAccounts("Gateway"))
  console.log("Gateway attached to:", gateway.address)
  */
  await upgrades.upgradeProxy(getAccounts("Gateway"), Gateway)
  console.log("Gateway updated")
  return

  /*
  const unionwallet = await upgrades.deployProxy(UnionWallet, []);
  console.log("UnionWallet deployed to:", unionwallet.address)
  */
  const unionwallet = UnionWallet.attach(getAccounts("UnionWallet"))
  console.log("UnionWallet attached to:", unionwallet.address)

  const rewarddistributor = await upgrades.deployProxy(RewardDistributor, [gateway.address, "0x0000000000000000000000000000000000000000", unionwallet.address]);
  console.log("RewardDistributor deployed to:", rewarddistributor.address)
/*
  const gateway = Gateway.attach("0xebFc95a305423318f77F64aE9475Ec147F9eDB18");
*/
  const tx = await gateway.setRewards(rewarddistributor.address)
  await tx.wait()
}

async function main(){
  await deploy();
}

main();
