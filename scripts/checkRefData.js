const { ethers } = require("hardhat")

const CONTRACT_ADDRESS = "0xB112D80f9E61c8A76160A4E43a89B07806E52Cd5";
const BOP_CONTRACT_ADDRESS = "0x1774D1B6E1735cf9b68a45a20adD4a473A94aD63"
const MAPPING_SLOT = ethers.BigNumber.from(105);
const REFOVOD_SALARY_SLOT = ethers.BigNumber.from(118);

const REFERAL_TO_CHECK = "0xE33bDcd4b0E620B4d2A1f194448A91f552551DD0";


const main = async () => {
  console.log("Getting Refovod for ", REFERAL_TO_CHECK)

  const abiCoder = new ethers.utils.AbiCoder();

  // ABI Encode the first level of the mapping
  // abi.encode(address(TOKEN0), uint256(MAPPING_SLOT))
  // The keccak256 of this value will be the "slot" of the inner mapping
  const firstLevelEncoded = abiCoder.encode(
    ["address", "uint256"],
    [REFERAL_TO_CHECK, MAPPING_SLOT]
  );

  const slot = ethers.utils.keccak256(firstLevelEncoded)

  const refovodInfo = await ethers.provider.getStorageAt(CONTRACT_ADDRESS, slot);
  const refovod = `0x${refovodInfo.substr(22, 40)}`
  console.log("Refovod for ", REFERAL_TO_CHECK, "is", refovod)

  const refSalarySlot = ethers.utils.keccak256(abiCoder.encode(
    ["address", "uint256"],
    [refovod, REFOVOD_SALARY_SLOT]
  ));
  
 const refovodEarnings = ethers.BigNumber.from(await ethers.provider.getStorageAt(BOP_CONTRACT_ADDRESS, refSalarySlot));
 console.log("Refovod", refovod, "earnings are", refovodEarnings);
}

main()
