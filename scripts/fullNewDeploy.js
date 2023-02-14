const { ethers, upgrades } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");
const getAccounts = require("./DEPLOYMENTS")


const main = async () => {
    //Addresses of MultiSignature owners
/*
    const owners = ["0x4901d83F51853CfA467C7E156E0E1127d358c7D4",
                    "0xc05A5747613847F9E070F307d1cBA6261A830Dd5"];

    const MSig = await ethers.getContractFactory("MultiSigWallet");
    const msig = await MSig.deploy(owners, owners.length);
    await msig.deployed();
    console.log("MSig deployed", msig.address);
*/
    const Ranks = await ethers.getContractFactory("Ranking");
/*
    const ranks = await Ranks.deploy();
*/
    const ranks = Ranks.attach("0x76f7E12A54b0733B9A63354c0F33678048DCD8B1")
    console.log("Ranks deployed to", ranks.address);
    const ranksChangeOwnerShipTx = await ranks.transferOwnership("0x0B80F01f2B739b188d70415542Dd1B63625016E0")
    await ranksChangeOwnerShipTx.wait()
return

    const createRank0 = await ranks.createRank(
        "Common",
        ["Min", "Max", "Commission"],
        [100, 500, 1500],
        true
    );
    await createRank0.wait()
      
    const createRank1 = await ranks.createRank(
        "Twitter",
        ["Min", "Max", "Commission"],
        [100, 500, 1350],
        true
    );
    await createRank1.wait()

    const createRank2 = await ranks.createRank(
        "Alex",
        ["Min", "Max", "Commission"],
        [100, 500, 600],
        true
    );
    await createRank2.wait()

    const createRank3 = await ranks.createRank(
        "Admin",
        ["Min", "Max", "Commission"],
        [0, 1000000, 0],
        true
    );
    await createRank2.wait()

    await ranks.giveRanks([msig.address], "Admin");

    // deploy usdt
    const USDT = await ethers.getContractFactory("BEP20Token");
    const usdt = await USDT.deploy(6);
    console.log("USDT deployed:", usdt.address)

    // deploy token
    const TOKEN = USDT;  // shortcut
    const token = await TOKEN.deploy(9);
    console.log("TestToken deployed:", token.address)

    // deploy unionwallet
    const UnionWallet = await ethers.getContractFactory("UnionWallet");
    unionwallet = await upgrades.deployProxy(UnionWallet);
    console.log("UnionWallet deployed to ", unionwallet.address);
         
    // deploy rop
    const ROP = await ethers.getContractFactory("RootOfPools_v2");
    const rop = await upgrades.deployProxy(ROP, [usdt.address, ranks.address], {
          initializer: "initialize",
    });
    console.log("ROP deployed:", rop.address);
    const ropSetUnionwalletTx = await rop.changeUnionWallet(unionwallet.address)
    await ropSetUnionwalletTx.wait()
    const changeOwnerShipTx = await rop.transferOwnership("0x0B80F01f2B739b188d70415542Dd1B63625016E0")
    
    const Gateway = await ethers.getContractFactory("Gateway");
    const gateway = await upgrades.deployProxy(Gateway, []);
    console.log("Gateway deployed to:", gateway.address)

    // deploy reward calcs
    const RewardCalcs = await ethers.getContractFactory("RewardCalcs");
    rewardCalcs = await upgrades.deployProxy(RewardCalcs, [gateway.address, rop.address, unionwallet.address])
    const setRewardsContractInRopTx = await rop.changeRewardCalcs(rewardCalcs.address);
    await setRewardsContractInRopTx.wait()
    console.log("RewardCalcs deployed:", rewardCalcs.address);

    const setRewardCalcInGwTx = await gateway.setRewards(rewardCalcs.address)
    await setRewardsContractInRopTx.wait()

    // deploy bop image
    const BOP = await ethers.getContractFactory("BranchOfPools");
    bopImage = await BOP.deploy();
    await bopImage.deployed();
    console.log("BOP image", bopImage.address);

    // Add deployed BOP as an image
    //const addBopToRopTx = await rop.addImage(bopImage.address);
    //await addBopToRopTx.wait();

    // Check
    //let imageNum = 0;
    //while (true) {
   //     const imageAddr = await rop.Images(imageNum);
     //   if (imageAddr == bopImage.address)
       //     break;
     //   ++imageNum;
    //}

    // Some other preparations
    // await setSalaries();
    // await generateWalletsAndFundThem();
    // await overrideCommissionsForSomeReferrals();
        
    // And deploy BOP from ROP.
    // const createBopTx = await rop.createPool("First Pool", imageNum, 
    //     (await bopImage.populateTransaction.init(
    //            rop.address,
    //            100000,
    //            100,
    //            dev.address,
    //            usdt.address,
    //            2524608000 /* somewhat 2050/1/1 */
    //        )).data);
    //    const createBopEffects = await createBopTx.wait()
    //    const responseLogs = createBopEffects.events.filter(e => e.event === "Response");
    //    expect(responseLogs).to.have.length(1)
    //    expect(responseLogs[0].args.success).to.be.true
}

main()
