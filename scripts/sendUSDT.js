const { mine } = require("@nomicfoundation/hardhat-network-helpers");


const main = async () => {
    const USDT = await ethers.getContractFactory("BEP20Token");
    const usdt = USDT.attach("0x0149135e2DC25fd30485877347B6b53e7FB76919");

    const users = [
        "0xc05A5747613847F9E070F307d1cBA6261A830Dd5",
        "0xae7685385465716E88401D5fB515D9060355c94c",
    ]

    const tx = await usdt.mint("10000000000")
    await tx.wait()
}

main()
