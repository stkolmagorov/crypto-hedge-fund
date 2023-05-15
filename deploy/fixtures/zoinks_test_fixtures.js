const hre = require('hardhat');
const {
  ZERO,
  mockedResultOfSwap,
  mockedReserve0,
  mockedReserve1,
  mockSwaps,
  mockReserves,
  mockPrice0Cumulative
} = require('../helpers');
const { time } = require("@nomicfoundation/hardhat-network-helpers");

module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
}) => {
  const {deploy, save, execute} = deployments;
  const { deployer } = await getNamedAccounts();

  const busdAddress = (await deployments.get(hre.names.external.tokens.busd)).address;
  const zoinksTokenAddress = (await deployments.get(hre.names.internal.zoinks)).address;

  await execute(
    hre.names.external.tokens.busd,
    {from: deployer, log: true},
    'mint',
    deployer,
    hre.ethers.utils.parseEther("10000000000000")
  );

  const amount = hre.ethers.utils.parseEther("1");
  await execute(
    hre.names.external.tokens.busd,
    {from: deployer, log: true},
    'approve',
    (await deployments.get(hre.names.internal.zoinks)).address,
    amount
  );

  await execute(
    hre.names.internal.zoinks,
    {from: deployer, log: true},
    'mint',
    amount
  );

  await execute(
    hre.names.external.tokens.busd,
    {from: deployer, log: true},
    'approve',
    (await deployments.get(hre.names.external.routers.pancake)).address,
    amount
  );

  await execute(
    hre.names.internal.zoinks,
    {from: deployer, log: true},
    'approve',
    (await deployments.get(hre.names.external.routers.pancake)).address,
    amount
  );

  await mockSwaps(
    hre.names.external.routers.pancake,
    deployments,
    amount,
    deployer,
    mockedResultOfSwap
  );
  await mockSwaps(
    hre.names.external.routers.ape,
    deployments,
    amount,
    deployer,
    mockedResultOfSwap
  );
  await mockSwaps(
    hre.names.external.routers.bi,
    deployments,
    amount,
    deployer,
    mockedResultOfSwap
  );

  await mockReserves(
    mockedReserve0,
    mockedReserve1,
    deployments
  );

  // Mocked price of zoinks in busd cumulative =
  //    busdReserve / zoinksReserve * 12hours
  //      * (2^112)
  await mockPrice0Cumulative(
    mockedReserve1.div(mockedReserve0).mul(3600 * 12)
    .mul(
      ethers.BigNumber.from('2').pow(ethers.BigNumber.from('112'))
    ),
    deployments
  );

  await execute(
    hre.names.internal.averagePriceOracle,
    {from: deployer, log: true},
    'initialize',
    zoinksTokenAddress,
    (await deployments.get(hre.names.external.pairs.ape.pair)).address,
    (await deployments.get(hre.names.external.pairs.bi.pair)).address,
    (await deployments.get(hre.names.external.pairs.pancake.pair)).address
  );

  // new mocked reserves are: 5 ZOINKS, 25 BUSD
  await mockPrice0Cumulative(
    mockedReserve1.add(ethers.utils.parseEther('5'))
    .div(mockedReserve0.sub(ethers.utils.parseEther('5')))
    .mul(3600 * 12)
    .mul(
      ethers.BigNumber.from('2').pow(ethers.BigNumber.from('112'))
    ),
    deployments
  );
}
module.exports.tags = ["zoinks_test_fixtures"];
module.exports.dependencies = ["debug"];
module.exports.runAtTheEnd = true;
