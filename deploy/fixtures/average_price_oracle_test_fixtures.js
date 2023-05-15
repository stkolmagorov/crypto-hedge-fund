const hre = require('hardhat');
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const {
  ZERO,
  ZERO_ADDRESS,
  mockedResultOfSwap,
  mockedLiquidity,
  mockedReserve0,
  mockedReserve1,
  mockSwaps,
  mockPrice0Cumulative,
  mockReserves,
  mockLiquidity,
  mockGetPair
} = require('../helpers');

module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
}) => {
  const {deploy, save, execute} = deployments;
  const {
    deployer
  } = await getNamedAccounts();

  const zoinks = await ethers.getContractAt(
    hre.names.internal.zoinks,
    (await deployments.get(hre.names.internal.zoinks)).address
  );
  const busd = await ethers.getContractAt(
    hre.names.internal.mockToken,
    (await deployments.get(hre.names.external.tokens.busd)).address
  );

  // Zoinks mint by owner
  await busd.mint(deployer, ethers.utils.parseEther("100000000000000000000000000000"));
  await busd.approve(zoinks.address, ethers.utils.parseEther("100000000000000000000000000000"));
  await zoinks.mint(ethers.utils.parseEther("10000000000"));

  // mock swaps
  await mockSwaps(
    hre.names.external.routers.pancake,
    deployments,
    ZERO,
    deployer,
    mockedResultOfSwap,
  );
  await mockSwaps(
    hre.names.external.routers.ape,
    deployments,
    ZERO,
    deployer,
    mockedResultOfSwap,
  );
  await mockSwaps(
    hre.names.external.routers.bi,
    deployments,
    ZERO,
    deployer,
    mockedResultOfSwap,
  );

  // mock reserves
  await mockReserves(
    mockedReserve0,
    mockedReserve1,
    deployments
  );

  // mock pair
  await mockGetPair(deployments);

  // mock liquidity
  await mockLiquidity(
    mockedLiquidity,
    deployments
  );

  await mockPrice0Cumulative(
    mockedReserve1.div(mockedReserve0).mul(3600 * 12)
    .mul(
      ethers.BigNumber.from('2').pow(ethers.BigNumber.from('112'))
    ),
    deployments
  );
}

module.exports.tags = ["average_price_oracle_test_fixtures"];
module.exports.dependencies = ["debug"];
module.exports.runAtTheEnd = true;
