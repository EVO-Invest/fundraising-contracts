const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");
const { inputToConfig } = require("@ethereum-waffle/compiler");
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Root of Pools", async function () {
  beforeEach(async function () {
    Ranks = await ethers.getContractFactory("Ranking");
    [owner, addr1, addr2, addr3, devUSDT, dev, fund, ...addrs] =
      await ethers.getSigners();

    ranks = await Ranks.deploy();
    own_ranks = ranks.connect(owner);
    own_ranks.createRank(
      "Common",
      ["Min", "Max", "Commission"],
      [100, 500, 20],
      true
    );

    own_ranks.createRank(
      "Rare",
      ["Min", "Max", "Commission"],
      [100, 1000, 20],
      true
    );

    own_ranks.createRank(
      "Legendary",
      ["Min", "Max", "Commission"],
      [100, 1000, 20],
      true
    );

    own_ranks.createRank(
      "Admin",
      ["Min", "Max", "Commission"],
      [0, 10000, 0],
      true
    );

    await own_ranks.giveRank(owner.address, "Admin");

    USDT = await ethers.getContractFactory("BEP20Token");
    usdt = await USDT.deploy(6);

    MSig = await ethers.getContractFactory("MultiSigWallet");
    msig = await MSig.deploy([owner.address, addr1.address, addr2.address], 2);
    await msig.deployed();

    Root = await ethers.getContractFactory("RootOfPools_v013");
    root = await upgrades.deployProxy(Root, [usdt.address, ranks.address], {
      initializer: "initialize",
    });

    await root.deployed();

    await root.connect(owner).transferOwnership(msig.address);
  });

  describe("Rank System", async function () {
    it("Parameters must be in the initial state", async function () {
      expect(await ranks.owner()).to.equal(owner.address);
      expect(await ranks.getNameParRank("Common")).to.have.lengthOf(3);
      expect(await ranks.getParRank("Common")).to.have.lengthOf(3);
    });
  });

  describe("Main Functional", async function () {
    beforeEach(async function () {
      Branch = await ethers.getContractFactory("BranchOfPools");
      branch = await Branch.deploy(
        root.address,
        2000,
        100,
        1000, //001000 это 0,01$
        devUSDT.address
      );
      await branch.connect(owner).init();

      await branch.connect(owner).transferOwnership(root.address);

      tx = await root.populateTransaction.createPool("Test", branch.address);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);
    });

    it("Check if the child contract is connected successfully", async function () {
      pools = await root.getPools();
      expect(pools).to.have.lengthOf(1);
      expect(pools[0][1]).to.equal("Test");
    });

    it("Emergency Stop Fundraising", async function () {
      //Give some usdt user addr1 and addr2
      await usdt.connect(owner).transfer(addr1.address, 1000000000); //1000 usdt
      await usdt.connect(owner).transfer(addr2.address, 1000000000);
      expect((await usdt.balanceOf(addr1.address)).toString()).to.equal(
        "1000000000"
      );
      expect((await usdt.balanceOf(addr2.address)).toString()).to.equal(
        "1000000000"
      );

      //Open deposit in Test pool
      tx = await root.populateTransaction.startFundraising("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Deposit in Test pool
      await usdt.connect(addr1).approve(branch.address, 1000000000);
      await usdt.connect(addr2).approve(branch.address, 1000000000);

      await root.connect(addr1).deposit("Test", 500000000); //500 usdt
      await root.connect(addr2).deposit("Test", 500000000);

      //Emergency stop
      tx = await root.populateTransaction.stopEmergency("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Users return funds
      await root.connect(addr1).paybackEmergency("Test");
      await root.connect(addr2).paybackEmergency("Test");

      //The money should come back
      expect((await usdt.balanceOf(addr1.address)).toString()).to.equal(
        "1000000000"
      );
      expect((await usdt.balanceOf(addr2.address)).toString()).to.equal(
        "1000000000"
      );
    });

    it("Should be through a full cycle of deposit and mandatory completion of collection with a double unlocks", async function () {
      //Give some usdt user addr1 and addr2
      await usdt.connect(owner).transfer(addr1.address, 1000000000); //1000 usdt
      await usdt.connect(owner).transfer(addr2.address, 1000000000);

      //Open deposit in Test pool
      tx = await root.populateTransaction.startFundraising("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Deposit in Test pool
      await usdt.connect(addr1).approve(branch.address, 1000000000);
      await usdt.connect(addr2).approve(branch.address, 1000000000);

      await root.connect(addr1).deposit("Test", 500000000); //500 usdt
      await root.connect(addr2).deposit("Test", 500000000);

      //Close fundraising Test pool
      tx = await root.populateTransaction.stopFundraising("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect((await usdt.balanceOf(devUSDT.address)).toString()).to.equal(
        "800000000"
      ); // 800 usdt
      expect((await usdt.balanceOf(msig.address)).toString()).to.equal(
        "200000000"
      );

      //Create new token for entrust
      Token = await ethers.getContractFactory("SimpleToken");
      token = await Token.deploy("TEST", "TEST", 1000000);

      await token.connect(owner).transfer(dev.address, 1000000);
      await token.connect(dev).transfer(branch.address, 90000);

      tx = await root.populateTransaction.entrustToken("Test", token.address, 90000);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect((await token.balanceOf(branch.address)).toString()).to.equal(
        "90000"
      );
      

      //Claim tokens
      await root.connect(addr1).claimName("Test");
      await root.connect(addr2).claimName("Test");

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect((await token.balanceOf(addr1.address)).toString()).to.equal(
        "45000"
      );
      expect((await token.balanceOf(addr2.address)).toString()).to.equal(
        "45000"
      );

      //Next unlocks
      await token.connect(dev).transfer(branch.address, 90000);
      tx = await root.populateTransaction.entrustToken("Test", token.address, 90000);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect((await token.balanceOf(branch.address)).toString()).to.equal(
        "90000"
      );

      //Claim tokens
      await root.connect(addr1).claimName("Test");
      await root.connect(addr2).claimName("Test");

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect((await token.balanceOf(addr1.address)).toString()).to.equal(
        "90000"
      );
      expect((await token.balanceOf(addr2.address)).toString()).to.equal(
        "90000"
      );
    });

    it("Checking basic math", async function () {
      a = 100000000; //Колличество денег
      b = 200000000;
      c = 300000000;
      del_tokens = 240; //Колличество токенов от разработчиков за 1 раз разлока

      a_k = Math.floor(a - a * 0.2); //С комиссиями
      b_k = Math.floor(b - b * 0.2);
      c_k = Math.floor(c - c * 0.2);

      toContract = del_tokens;
      toOwner = Math.floor(del_tokens - toContract);
      console.log("toOwner first razlok- ", toOwner);

      a_tpu = Math.floor(toContract * (a_k / (a_k + b_k + c_k)));
      b_tpu = Math.floor(toContract * (b_k / (a_k + b_k + c_k)));
      c_tpu = Math.floor(toContract * (c_k / (a_k + b_k + c_k)));

      a_f = Math.floor(2 * a_tpu);
      b_f = Math.floor(2 * b_tpu);
      c_f = Math.floor(2 * c_tpu);

      console.log(a_f);
      console.log(b_f);
      console.log(c_f);

      //Give some usdt user addr1 and addr2
      await usdt.connect(owner).transfer(addr1.address, 1000000000); //1000 usdt
      await usdt.connect(owner).transfer(addr2.address, 1000000000);
      await usdt.connect(owner).transfer(addr3.address, 1000000000);

      //Open deposit in Test pool
      tx = await root.populateTransaction.startFundraising("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Get rank for addr2 and addr3
      await ranks.connect(owner).giveRank(addr2.address, "Rare");
      await ranks.connect(owner).giveRank(addr3.address, "Legendary");

      //Deposit in Test pool
      await usdt.connect(addr1).approve(branch.address, 1000000000);
      await usdt.connect(addr2).approve(branch.address, 1000000000);
      await usdt.connect(addr3).approve(branch.address, 1000000000);

      await root.connect(addr1).deposit("Test", a); //500 usdt
      await root.connect(addr2).deposit("Test", b); //500
      await root.connect(addr3).deposit("Test", c); //1000

      //Close fundraising Test pool
      tx = await root.populateTransaction.stopFundraising("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Create new token for entrust
      Token = await ethers.getContractFactory("SimpleToken");
      token = await Token.deploy("TEST", "TEST", 1000000);
      await token.connect(owner).transfer(dev.address, 1000000);
      await token.connect(dev).transfer(branch.address, del_tokens);
      tx = await root.populateTransaction.entrustToken("Test", token.address, del_tokens);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal(a_tpu.toString());
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal(b_tpu.toString());
      expect(
        (
          await branch.connect(addr3).myCurrentAllocation(addr3.address)
        ).toString()
      ).to.equal(c_tpu.toString());

      //Claim tokens
      await root.connect(addr1).claimName("Test");
      await root.connect(addr3).claimName("Test");

      //Next unlocks
      await token.connect(dev).transfer(branch.address, del_tokens);
      tx = await root.populateTransaction.entrustToken("Test", token.address, del_tokens);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Claim tokens
      await root.connect(addr1).claimName("Test");
      await root.connect(addr2).claimName("Test");
      await root.connect(addr3).claimName("Test");

      expect((await token.balanceOf(addr1.address)).toString()).to.equal(
        a_f.toString()
      );
      expect((await token.balanceOf(addr2.address)).toString()).to.equal(
        b_f.toString()
      );
      expect((await token.balanceOf(addr3.address)).toString()).to.equal(
        c_f.toString()
      );
      expect((await token.balanceOf(msig.address)).toString()).to.equal(
        (toOwner * 2).toString()
      );
    });

    it("Checking Price Independence", async function () {
      //Give some usdt user addr1 and addr2
      await usdt.connect(owner).transfer(addr1.address, 1000000000); //1000 usdt
      await usdt.connect(owner).transfer(addr2.address, 1000000000);
      await usdt.connect(owner).transfer(addr3.address, 1000000000);

      //Open deposit in Test pool
      tx = await root.populateTransaction.startFundraising("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Deposit in Test pool
      await usdt.connect(addr1).approve(branch.address, 1000000000);
      await usdt.connect(addr2).approve(branch.address, 1000000000);
      await usdt.connect(addr3).approve(branch.address, 1000000000);

      await root.connect(addr1).deposit("Test", 500000000); //500 usdt
      await root.connect(addr2).deposit("Test", 500000000); //500
      await root.connect(addr3).deposit("Test", 500000000); //500

      //Close fundraising Test pool
      tx = await root.populateTransaction.stopFundraising("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Create new token for entrust
      Token = await ethers.getContractFactory("SimpleToken");
      token = await Token.deploy("TEST", "TEST", 1000000);
      await token.connect(owner).transfer(dev.address, 1000000);
      await token.connect(dev).transfer(branch.address, 800);

      tx = await root.populateTransaction.entrustToken("Test", token.address, 800);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Claim tokens
      await root.connect(addr1).claimName("Test");
      await root.connect(addr2).claimName("Test");
      await root.connect(addr3).claimName("Test");

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr3).myCurrentAllocation(addr3.address)
        ).toString()
      ).to.equal("0");

      //Next unlocks
      await token.connect(dev).transfer(branch.address, 800);
      tx = await root.populateTransaction.entrustToken("Test", token.address, 800);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Claim tokens
      await root.connect(addr1).claimName("Test");
      await root.connect(addr2).claimName("Test");
      await root.connect(addr3).claimName("Test");

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr3).myCurrentAllocation(addr3.address)
        ).toString()
      ).to.equal("0");

      expect((await token.balanceOf(addr1.address)).toString()).to.equal("532");
      expect((await token.balanceOf(addr2.address)).toString()).to.equal("532");
      expect((await token.balanceOf(addr3.address)).toString()).to.equal("532");
    });

    it("Check claim all", async function () {
      tx = await root.populateTransaction.startFundraising("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      Branch = await ethers.getContractFactory("BranchOfPools");
      branch = await Branch.deploy(
        root.address,
        4500,
        100,
        1000, //001000 это 0,01$
        devUSDT.address
      );
      await branch.connect(owner).init();

      await branch.connect(owner).transferOwnership(root.address);

      tx = await root.populateTransaction.createPool("Test2", branch.address);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);
      
      pools = await root.prepClaimAll(owner.address);

      tx = await root.populateTransaction.claimAll(pools);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);
    });

    it("Check checkAllClaims", async function () {
      //Give some usdt user addr1 and addr2
      await usdt.connect(owner).transfer(addr1.address, 1000000000); //1000 usdt
      await usdt.connect(owner).transfer(addr2.address, 1000000000);
      await usdt.connect(owner).transfer(addr3.address, 1000000000);

      //Open deposit in Test pool
      tx = await root.populateTransaction.startFundraising("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Deposit in Test pool
      await usdt.connect(addr1).approve(branch.address, 1000000000);
      await usdt.connect(addr2).approve(branch.address, 1000000000);
      await usdt.connect(addr3).approve(branch.address, 1000000000);

      await root.connect(addr1).deposit("Test", 500000000); //500 usdt
      await root.connect(addr2).deposit("Test", 500000000); //500
      await root.connect(addr3).deposit("Test", 500000000); //500

      //Close fundraising Test pool
      tx = await root.populateTransaction.stopFundraising("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Create new token for entrust
      Token = await ethers.getContractFactory("SimpleToken");
      token = await Token.deploy("TEST", "TEST", 1000000);
      await token.connect(owner).transfer(dev.address, 1000000);
      await token.connect(dev).transfer(branch.address, 800);
      tx = await root.populateTransaction.entrustToken("Test", token.address, 800);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Claim tokens
      await root.connect(addr1).claimName("Test");
      await root.connect(addr2).claimName("Test");
      await root.connect(addr3).claimName("Test");

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr3).myCurrentAllocation(addr3.address)
        ).toString()
      ).to.equal("0");

      //Next unlocks
      await token.connect(dev).transfer(branch.address, 800);
      tx = await root.populateTransaction.entrustToken("Test", token.address, 800);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect(await root.checkAllClaims(addr1.address)).to.equal(266);
    });

    it("Data import check", async function(){
      let UsersNumber = 400; //Number of users participating in this test
      users = [];
      values = [];
      FR = UsersNumber * 100; //Share of each participant after subtracting the commission of 100
      CC = FR * 0,2;

      for(i = 0; i < UsersNumber; i++){
        users[i] = ethers.Wallet.createRandom().address;
        values[i] = 100;
        //console.log(users[i]);
      }

      tx = await root.populateTransaction.dataImport("Test", FR, CC, users, values);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      for(i = 0; i < UsersNumber; i++){
        expect(await branch.myAllocation(users[i])).to.equal(100);
      }

    });

    it("Check max value deposit", async function(){
      await usdt.connect(owner).transfer(addr1.address, "115792089237316195423570985008687907853269984665640564039457584007913129639935");
      await usdt.connect(addr1).approve(branch.address, "115792089237316195423570985008687907853269984665640564039457584007913129639935");

      //Open deposit in Test pool
      tx = await root.populateTransaction.startFundraising("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect(root.connect(addr1).deposit("Test", "115792089237316195423570985008687907853269984665640564039457584007913129639935")).to.be.reverted;
    });

    it("Check +1 token bag", async function(){
      await usdt.connect(owner).transfer(addr1.address, 1000000000); //1000 usdt
      await usdt.connect(owner).transfer(addr2.address, 1000000000);

      //Open deposit in Test pool
      tx = await root.populateTransaction.startFundraising("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Deposit in Test pool
      await usdt.connect(addr1).approve(branch.address, 1000000000);
      await usdt.connect(addr2).approve(branch.address, 1000000000);

      await usdt.connect(owner).transfer(branch.address, 1);

      await root.connect(addr1).deposit("Test", 500000000); //500 usdt
      await root.connect(addr2).deposit("Test", 500000000);

      //Close fundraising Test pool
      tx = await root.populateTransaction.stopFundraising("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect((await usdt.balanceOf(devUSDT.address)).toString()).to.equal(
        "800000000"
      ); // 800 usdt
      expect((await usdt.balanceOf(msig.address)).toString()).to.equal(
        "200000001"
      ); // 200 usdt

      //Create new token for entrust
      Token = await ethers.getContractFactory("SimpleToken");
      token = await Token.deploy("TEST", "TEST", 1000000);

      await token.connect(owner).transfer(dev.address, 1000000);
      await token.connect(dev).transfer(branch.address, 90000);

      await token.connect(dev).transfer(branch.address, 1);

      tx = await root.populateTransaction.entrustToken("Test", token.address, 90000);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect((await token.balanceOf(branch.address)).toString()).to.equal(
        "90001"
      );

      //Claim tokens
      await root.connect(addr1).claimName("Test");
      await root.connect(addr2).claimName("Test");

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect((await token.balanceOf(addr1.address)).toString()).to.equal(
        "45000"
      );
      expect((await token.balanceOf(addr2.address)).toString()).to.equal(
        "45000"
      );

      //Next unlocks
      await token.connect(dev).transfer(branch.address, 90000);
      tx = await root.populateTransaction.entrustToken("Test", token.address, 90000);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect((await token.balanceOf(branch.address)).toString()).to.equal(
        "90001"
      );

      //Claim tokens
      await root.connect(addr1).claimName("Test");
      await root.connect(addr2).claimName("Test");

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect((await token.balanceOf(addr1.address)).toString()).to.equal(
        "90000"
      );
      expect((await token.balanceOf(addr2.address)).toString()).to.equal(
        "90000"
      );
    });

    it("Check fill functional", async function(){
      await usdt.connect(owner).transfer(addr1.address, 1000000000); //1000 usdt
      await usdt.connect(owner).transfer(addr2.address, 1000000000);

      //Open deposit in Test pool
      tx = await root.populateTransaction.startFundraising("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Deposit in Test pool
      await usdt.connect(addr1).approve(branch.address, 1000000000);
      await usdt.connect(addr2).approve(branch.address, 1000000000);

      await root.connect(addr1).deposit("Test", 500000000); //500 usdt
      await root.connect(addr2).deposit("Test", 500000000);

      val = await branch.howMuch();
      await usdt.connect(owner).approve(branch.address, val)
      await branch.connect(owner).deposit(val);

      tx = await root.populateTransaction.collectFunds("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect((await usdt.balanceOf(devUSDT.address)).toString()).to.equal(
        "2000000000"
      ); 
      expect((await usdt.balanceOf(msig.address)).toString()).to.equal(
        "200000000"
      ); 

      //Create new token for entrust
      Token = await ethers.getContractFactory("SimpleToken");
      token = await Token.deploy("TEST", "TEST", 1000000);

      await token.connect(owner).transfer(dev.address, 1000000);
      await token.connect(dev).transfer(branch.address, 90000);

      tx = await root.populateTransaction.entrustToken("Test", token.address, 90000);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect((await token.balanceOf(branch.address)).toString()).to.equal(
        "90000"
      );

      //Claim tokens
      await root.connect(addr1).claimName("Test");
      await root.connect(addr2).claimName("Test");

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect((await token.balanceOf(addr1.address)).toString()).to.equal(
        "18000"
      );
      expect((await token.balanceOf(addr2.address)).toString()).to.equal(
        "18000"
      );

      //Next unlocks
      await token.connect(dev).transfer(branch.address, 90000);
      tx = await root.populateTransaction.entrustToken("Test", token.address, 90000);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect((await token.balanceOf(branch.address)).toString()).to.equal(
        "144000"
      );

      //Claim tokens
      await root.connect(addr1).claimName("Test");
      await root.connect(addr2).claimName("Test");

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect((await token.balanceOf(addr1.address)).toString()).to.equal(
        "36000"
      );
      expect((await token.balanceOf(addr2.address)).toString()).to.equal(
        "36000"
      );
    });

    it("Check for a refund from the developer", async function(){
      await usdt.connect(owner).transfer(addr1.address, 1000000000); //1000 usdt
      await usdt.connect(owner).transfer(addr2.address, 1000000000);

      //Open deposit in Test pool
      tx = await root.populateTransaction.startFundraising("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Deposit in Test pool
      await usdt.connect(addr1).approve(branch.address, 1000000000);
      await usdt.connect(addr2).approve(branch.address, 1000000000);

      await root.connect(addr1).deposit("Test", 500000000); //500 usdt
      await root.connect(addr2).deposit("Test", 500000000);

      //Close fundraising Test pool
      tx = await root.populateTransaction.stopFundraising("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect((await usdt.balanceOf(devUSDT.address)).toString()).to.equal(
        "800000000"
      ); // 800 usdt
      expect((await usdt.balanceOf(msig.address)).toString()).to.equal(
        "200000000"
      );

      //Refund from dev
      await usdt.connect(devUSDT).transfer(branch.address, 800000000);
      
      //Refund from admin
      tx = await usdt.populateTransaction.transfer(branch.address, 200000000);
      await msig.connect(owner).submitTransaction(usdt.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Try stop
      tx = await root.populateTransaction.stopEmergency("Test");
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect(await branch.getState()).to.equal(4);
    });
  });
});
