const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

const chai = require('chai');
chai.use(require('chai-bignumber')());

describe("Gateway", () => {
    beforeEach(async () => {
        const Gateway = await ethers.getContractFactory("Gateway");
        this.gateway = await Gateway.deploy();
        await this.gateway.deployed();
        const tx = await this.gateway.initialize();
        await tx.wait();
    })
    it("Check Gateway Deploys", async () => {
        const [signer] = await ethers.getSigners();
        
        //const result = await signer.signMessage('Я подтверждаю свой кошелек для EVO и рефовода kostya');
        const result = await signer.signMessage('Я подтверждаю свой кошелек для EVO и рефовода yoko');
       
        const signature = result.substring(2);
        r = "0x" + signature.substring(0, 64);
        s = "0x" + signature.substring(64, 128);
        v = parseInt(signature.substring(128, 130), 16);
        console.log(signer.address, r, s, v);

        const tx = await this.gateway.populateTransaction.setRef_ru("yoko", v, r, s);
        console.log(tx)
        //const tx = await this.gateway.setRef_ru("kostya", v, r, s);
        //await tx.wait();
    })
/*
    it("Check Gateway Deploys", async () => {
        const [signer] = await ethers.getSigners();
        const domainData = {
          name: "EVO Gateway",
          version: "1",
          chainId: "31337",
          verifyingContract: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
        }
        const domain = [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ];
        const setRefType = [
            { name: "newUser", type: "address" },
            { name: "referral", type: "address" },
        ];
        const setRefData = {
          newUser: await signer.getAddress(),
          referral: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
        };
        
        const result = await signer._signTypedData(
          domainData, {setRef: setRefType}, setRefData
        );
        const signature = result.substring(2);
        r = "0x" + signature.substring(0, 64);
        s = "0x" + signature.substring(64, 128);
        v = parseInt(signature.substring(128, 130), 16);
        console.log(signer.address, r, s, v);

        const tx = await this.gateway.setRef(signer.address, "0x8ba1f109551bD432803012645Ac136ddd64DBA72", v, r, s);
    })
*/
})
