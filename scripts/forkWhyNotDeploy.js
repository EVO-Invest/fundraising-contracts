const { ethers, upgrades } = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-network-helpers");



const main = async () => {
    const MSig = await ethers.getContractFactory("MultiSigWallet");
    const msig = await MSig.attach("0x0b80f01f2b739b188d70415542dd1b63625016e0");
    const julia = "0x4901d83f51853cfa467c7e156e0e1127d358c7d4";
    await helpers.impersonateAccount(julia);
    const impersonatedSigner = await ethers.getSigner(julia);
    const tx = await msig.connect(impersonatedSigner).confirmTransaction(74)

}

main()
