// Here we are emulating named addresses from hardhat-deploy.

const DATA = {
  Gateway: {
    testbsc: "0xfE2233F0e576e521586F2A1e27Af531ee552fD20",
  },
  UnionWallet: {
    testbsc: "0xB3475FC39E82cc7e0BcE082dB39C3da806F0a015",
  },
  Ranking: {
    testbsc: "0xfe75dF1B834327fc820fBf40D7aA770CC28bB086",
  },
  RewardCalcs: {
    testbsc: "0xB112D80f9E61c8A76160A4E43a89B07806E52Cd5",
  },
};

module.exports = (alias) => {
  return DATA[alias][hre.network.name] || DATA[alias]["default"]
}

