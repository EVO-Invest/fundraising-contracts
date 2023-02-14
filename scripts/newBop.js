const { ethers, upgrades } = require("hardhat");


const main = async () => {
    const BOP = await ethers.getContractFactory("BranchOfPools");
    bopImage = await BOP.deploy();
    await bopImage.deployed();
    console.log("BOP image", bopImage.address);
}

main()
