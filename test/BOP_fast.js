const { expect, assert } = require("chai");
const { BigNumber, utils } = require("ethers");
const { ethers, upgrades } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");


class Investor {
    constructor() {
        this.wallets = [];
        this.amountInvested = 0;
    }

    addWallet(wallet) {
        this.wallets.push(wallet)
    }
}


describe("BOP QuickCheck", function () {
    let rop, ranks, usdt, unionwallet, rewardCalcs, bopImage, token;
    let admin, dev;
    let getDirectPoolAccess;

    let investors = []
    let team = []

    // eslint-disable-next-line no-undef
    before(async () => {
        [admin, dev] = await ethers.getSigners();

        // deploy ranking

        const Ranks = await ethers.getContractFactory("Ranking");
        ranks = await Ranks.deploy();

        ranks.createRank(
            "Common",
            ["Min", "Max", "Commission"],
            [100, 500, 2000],
            true
        );
      
        ranks.createRank(
            "Rare",
            ["Min", "Max", "Commission"],
            [100, 1000, 1000],
            true
        );
      
        ranks.createRank(
            "Legendary",
            ["Min", "Max", "Commission"],
            [100, 1000, 0],
            true
        );
      
        ranks.createRank(
            "Admin",
            ["Min", "Max", "Commission"],
            [0, 10000, 0],
            true
        );
      
        await ranks.giveRanks([admin.address], "Admin");

        // deploy usdt

        const USDT = await ethers.getContractFactory("BEP20Token");
        usdt = await USDT.deploy(6);

        // deploy token

        const TOKEN = USDT;  // shortcut
        token = await TOKEN.deploy(9);

        // deploy unionwallet
        
        const UnionWallet = await ethers.getContractFactory("UnionWallet");
        unionwallet = await upgrades.deployProxy(UnionWallet);
         
        // deploy rop

        const ROP = await ethers.getContractFactory("RootOfPools_v2");
        rop = await upgrades.deployProxy(ROP, [usdt.address, ranks.address], {
             initializer: "initialize",
        });
        const ropSetUnionwalletTx = await rop.changeUnionWallet(unionwallet.address)
        await ropSetUnionwalletTx.wait()

        // deploy reward calcs

        const RewardCalcs = await ethers.getContractFactory("RewardCalcs");
        rewardCalcs = await upgrades.deployProxy(RewardCalcs, [admin.address, rop.address, unionwallet.address])
        const setRewardsContractInRopTx = await rop.changeRewardCalcs(rewardCalcs.address);
        await setRewardsContractInRopTx.wait()

        // deploy bop image
        
        const BOP = await ethers.getContractFactory("BranchOfPools");
        bopImage = await BOP.deploy();
        await bopImage.deployed();

        // Add deployed BOP as an image
        const addBopToRopTx = await rop.addImage(bopImage.address);
        await addBopToRopTx.wait();

        // Check
        let imageNum = 0;
        while (true) {
            const imageAddr = await rop.Images(imageNum);
            if (imageAddr == bopImage.address)
            break;
            ++imageNum;
        }

        // Some other preparations
        await setSalaries();
        await generateWalletsAndFundThem();
        await overrideCommissionsForSomeReferrals();
        
        // And deploy BOP from ROP.
        const createBopTx = await rop.createPool("First Pool", imageNum, 
            (await bopImage.populateTransaction.init(
                rop.address,
                1000,
                100,
                dev.address,
                usdt.address,
                2524608000 /* somewhat 2050/1/1 */
            )).data);
        const createBopEffects = await createBopTx.wait()
        const responseLogs = createBopEffects.events.filter(e => e.event === "Response");
        expect(responseLogs).to.have.length(1)
        expect(responseLogs[0].args.success).to.be.true

        getDirectPoolAccess = async () => {
            const poolAddress = (await rop.Pools(0)).pool
            return BOP.attach(poolAddress)
        }

        const startFundraisingTxData = (await bopImage.populateTransaction.startFundraising()).data
        const startFundraisingTx = await rop.Calling("First Pool", startFundraisingTxData)
        await startFundraisingTx.wait()
    });

    const setSalaries = async () => {
        for (let prc of [10, 50, 100]) {  // 0.1%, 0.5%, 1%.
            const wallet = ethers.Wallet.createRandom().connect(admin.provider)
            team.push(wallet)
            const tx = await rewardCalcs.addTeamMember(wallet.address, prc, 1);
            await tx.wait()
            await fundWallet(wallet.address)
        }

        const tx = await rewardCalcs.connect(team[1]).updateMyRewardTypeChoice(0);
        await tx.wait()
    }

    const fundWallet = async (address) => {
        const fundWithEthers = await admin.sendTransaction({from: admin.address, to: address, value: "100000000000000000"})
        await fundWithEthers.wait()

        const fundWithBUSD = await usdt.transfer(address, "1500000000") // 1500 USD
        await fundWithBUSD.wait()
    }

    const overrideCommissionsForSomeReferrals = async () => {
        const tx = await rewardCalcs.setCommissionForReferrer(investors[1].wallets[0].address, 500);
        await tx.wait()
    }

    const generateWalletsAndFundThem = async () => {
        for (let investorID = 0; investorID < 16; ++investorID) {
            if (investorID % 100 == 0) console.log(`Generated ${investors.length} investors`);
            const newInvestor = new Investor();
            const mainWallet = ethers.Wallet.createRandom().connect(admin.provider)
            await fundWallet(mainWallet.address)
            newInvestor.addWallet(mainWallet)
            investors.push(newInvestor)

            const extraWallets = investorID % 2;
            let lastExtraWallet = mainWallet
            if (extraWallets > 0) {
                for (let i = 0; i < extraWallets; ++i) {
                    const extraWallet = ethers.Wallet.createRandom().connect(admin.provider)
                    await fundWallet(extraWallet.address)
                    newInvestor.addWallet(extraWallet)
                    const attachTx = await unionwallet.connect(lastExtraWallet).attachToIdentity(extraWallet.address)
                    await attachTx.wait()
                    lastExtraWallet = extraWallet
                }
            }

            // first 3 people are acting as referals. Some people don't have referals.
            const referalId = investorID % 3;
            if (investorID >= 3) {
                if (investorID % 5 == 0) continue;
                const setReferalTx = await rewardCalcs.setReferral(investors[investorID].wallets[0].address, `ref${referalId}`)
                await setReferalTx.wait()
                console.log("Attached ref", investorID, "to", referalId);
            } else {
                const setAliasTx = await rewardCalcs.connect(investors[investorID].wallets[0]).setReferralAlias(`ref${investorID}`)
                await setAliasTx.wait()
                console.log("Generated Ref", investorID)
            }

            // Assign ranks
            const ranker = investorID % 5;
            let rankTx;
            if (ranker < 3) {
                rankTx = await ranks.giveRanks([mainWallet.address], "Common")
                console.log("Assigned rank Common to", investorID)
            } else if (ranker === 3) {
                rankTx = await ranks.giveRanks([mainWallet.address], "Rare")
                console.log("Assigned rank Rare to", investorID)
            } else if (ranker === 4) {
                rankTx = await ranks.giveRanks([mainWallet.address], "Legendary")
                console.log("Assigned rank Legendary to", investorID)
            }
            if (rankTx) await rankTx.wait()
        }
    }

    it ("Should be Unpaused successfully", async () => {
        const dep = async (index, amount) => {
            const pool = await getDirectPoolAccess()
            amount = ethers.BigNumber.from(amount + "000000")
            const approveTx = await usdt.connect(investors[index].wallets[0]).approve(pool.address, amount)
            await approveTx.wait()
            const tx = await rop.connect(investors[index].wallets[0]).deposit("First Pool", amount)
            await tx
        }
        const expectRemains = async (amount) => {
            const pool = await getDirectPoolAccess()
            const rem = await pool.requiredAmountToCloseFundraising()
            expect(rem).to.be.eq(ethers.BigNumber.from(amount).toString())
        }
        const expectAllocated = async (expected_ag) => {
            const pool = await getDirectPoolAccess()
            const ag = await pool._CURRENT_VALUE()
            expect(ag).to.be.eq(ethers.BigNumber.from(expected_ag).toString())
        }
        const sendToTeam = async (amount) => {
            const presend1TxData = await bopImage.populateTransaction.preSend(amount + "000000")
            await rop.Calling("First Pool", presend1TxData.data)
        }
        const takeAndCheckCommission = async (index, expectedAmount, isTeam) => {
            const wallet = (!isTeam) ? investors[index].wallets[0] : team[index]
            const balanceBefore = await usdt.balanceOf(wallet.address);
            await (await getDirectPoolAccess()).connect(wallet).getCommission();
            const balanceAfter = await usdt.balanceOf(wallet.address);
            expect(balanceAfter.sub(balanceBefore).toString()).to.be.eq(expectedAmount);
        }
        const claimTokenAndCheck = async (index, expectedAmount, isTeam) => {
            const wallet = (!isTeam) ? investors[index].wallets[0] : team[index]
            const balanceBefore = await token.balanceOf(wallet.address);
            await rop.connect(wallet).claimName("First Pool")
            const balanceAfter = await token.balanceOf(wallet.address);
            expect(balanceAfter.sub(balanceBefore).toString()).to.be.eq(expectedAmount);
        }
        const claimFails = async (index, isTeam) => {
            const wallet = (!isTeam) ? investors[index].wallets[0] : team[index]
            await expect(rop.connect(wallet).claimName("First Pool")).to.be.revertedWith('CLAIM: You have no unredeemed tokens!')
        }


        let totalCollected = 0;
        let totalLiabilities = 5 + 1000;

        // Team: 0.1% token, 0.5% stable, 1% token.
        //       So, the minimal amount to collect should be 1000 + 5 = $1005.
        //       And we are starting with 10 + 1 already allocated to the team.
        await expectRemains("1005000000")
        await expectAllocated("11000000")

        await dep(0, 100)  // 0 -> Rank common, commission 20%. No referers.
        await expectRemains("905000000")
        await expectAllocated("91000000")
        totalCollected += 100;

        await dep(1, 100)  // 1 -> Rank common, commission 20%. No referers.
        await expectRemains("805000000")
        await expectAllocated("171000000")
        totalCollected += 100;

        await dep(2, 200)  // 2 -> Rank common, commission 20%. No referers.
        await expectRemains("605000000")
        await expectAllocated("331000000")
        totalCollected += 200;

        await dep(3, 300)  // 3 -> Rank rare, commission 10%. Referer is 0.
                           //      Referer 0 is a usual one. So they get 3% => $9.
        await expectRemains("314000000")
        await expectAllocated("601000000")
        totalCollected += 300;
        totalLiabilities += 9;

        await dep(7, 100)  // 7 -> Rank common, commission 20%. Referrer is 1.
                           //      Referrer 1 is unusual with commission 5%.
        await expectRemains("219000000")
        await expectAllocated("681000000")
        totalCollected += 100;
        totalLiabilities += 5;

        await dep(13, 200)  // 13 -> Rank rare, commission 10%. Referer is 1.
                            //       Referrer 1 is unusual with commission 5%.
                            //       Discount that rare got, $20, is subtracted from
                            //       Referrer 1's commission $10. And they got nothing.
        await expectRemains("19000000")
        await expectAllocated("861000000")
        totalCollected += 200;

        await dep(10, 100)  // 10 -> Rank common, commission 20%. No referrer.
        await expectRemains("0")
        await expectAllocated("941000000")
        totalCollected += 100;

        // Let's send a bit to the team.
        await sendToTeam("300");

        const expectedRefPayments = await (await getDirectPoolAccess()).connect(investors[0].wallets[0]).claimableSalary();
        expect(expectedRefPayments[0]).to.be.false
        expect(expectedRefPayments[1].toString()).to.be.eq("9000000")

        const abiCoder = new ethers.utils.AbiCoder();
        const salariesSlot = 3
        const firstLevelEncoded = abiCoder.encode(
            ["address", "uint256"],
            [investors[0].wallets[0].address, salariesSlot]
        )
        console.log(firstLevelEncoded)
        const slot = ethers.utils.keccak256(firstLevelEncoded)
        console.log(slot)
        const provider = (await getDirectPoolAccess()).provider
        console.log(investors[0].wallets[0].address, 
            await provider.getStorageAt((await getDirectPoolAccess()).address, 0));

        // No one can add any more at this point. Time to close pool.
        const stopFundraisingTxData = await bopImage.populateTransaction.stopFundraising()
        await rop.Calling("First Pool", stopFundraisingTxData.data)

	await sendToTeam("700");

	const ownerBalanceBeforeOwnersCommissions = await usdt.balanceOf(admin.address);
	await (await getDirectPoolAccess()).getCommission();
	const ownerBalanceAfterOwnersCommissions = await usdt.balanceOf(admin.address);
	expect(ownerBalanceAfterOwnersCommissions.sub(ownerBalanceBeforeOwnersCommissions).toString())
	    .to.be.eq((totalCollected - totalLiabilities) + "000000");

        // Refovod and team can't.
        await takeAndCheckCommission(0, "0")
        await takeAndCheckCommission(0, "0", true)


        // Now team sends tokens.
        const entrustTxData = await bopImage.populateTransaction.entrustToken(token.address);
        await rop.Calling("First Pool", entrustTxData.data)
        await token.transfer((await getDirectPoolAccess()).address, "1000000000000")

        // Refovod still can't take!
        await takeAndCheckCommission(0, "0")

        // Now the first user claims token
        await claimTokenAndCheck(0, "80000000000")

        // Team can claim salaries
        await takeAndCheckCommission(1, "5000000", true)

        // Now refovod can take!
        const expectedRefPayments2 = await (await getDirectPoolAccess()).connect(investors[0].wallets[0]).claimableSalary();
        expect(expectedRefPayments2[0]).to.be.true
        expect(expectedRefPayments2[1].toString()).to.be.eq("9000000")
        await takeAndCheckCommission(0, "9000000")
        await takeAndCheckCommission(1, "5000000")
        await takeAndCheckCommission(2, "0")
        // Second attempt - nothing
        await takeAndCheckCommission(0, "0")
        await takeAndCheckCommission(1, "0")

        // Remaining user claim tokens
        await claimTokenAndCheck(1, "80000000000")
        await claimTokenAndCheck(2, "160000000000")
        await claimTokenAndCheck(3, "270000000000")
        await claimTokenAndCheck(7, "80000000000")
        await claimTokenAndCheck(13, "180000000000")
        await claimTokenAndCheck(10, "80000000000")

        // But only once
        await claimFails(0)
        await claimFails(1)
        await claimFails(2)
        await claimFails(3)
        await claimFails(7)
        await claimFails(13)
        await claimFails(10)

        // Team can claim tokens as well
        await claimTokenAndCheck(0, "1000000000", true)
        await claimTokenAndCheck(2, "10000000000", true)
        await claimFails(0, true)
        await claimFails(1, true)
        await claimFails(2, true)

        // Team sends more tokens
        await token.transfer((await getDirectPoolAccess()).address, "500000000000")

        // No stables left in fund
        expect(await usdt.balanceOf((await getDirectPoolAccess()).address)).to.be.eq(0)

        // Second wave of claiming
        await claimTokenAndCheck(0, "40000000000")
        await claimTokenAndCheck(1, "40000000000")
        await claimTokenAndCheck(2, "80000000000")
        await claimTokenAndCheck(3, "135000000000")
        await claimTokenAndCheck(7, "40000000000")
        await claimTokenAndCheck(13, "90000000000")
        await claimTokenAndCheck(10, "40000000000")

        // But only once
        await claimFails(0)
        await claimFails(1)
        await claimFails(2)
        await claimFails(3)
        await claimFails(7)
        await claimFails(13)
        await claimFails(10)

        // Team can claim tokens as well
        await claimTokenAndCheck(0, "500000000", true)
        await claimTokenAndCheck(2, "5000000000", true)
        await claimFails(0, true)
        await claimFails(1, true)
        await claimFails(2, true)

        // Admin claims their token
        const adminTokenBalanceBefore = await token.balanceOf(admin.address);
        await rop.connect(admin).claimName("First Pool")
        const adminTokenBalanceAfter = await token.balanceOf(admin.address);
        expect(adminTokenBalanceAfter.sub(adminTokenBalanceBefore).toString()).to.be.eq("88500000000");  // 59 USDT

        // No tokens left in fund
        expect(await token.balanceOf((await getDirectPoolAccess()).address)).to.be.eq(0)
    })
})
