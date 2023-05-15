const { ethers, deployments } = require("hardhat");
const singleRewardPoolTestSuite = require('../reusable_test_suits/single_reward_pool_test_suite');

describe(hre.names.internal.apeSwapPool, () => {
  const rewardsDuration = ethers.BigNumber.from("43200");

  beforeEach(async () => {
    await deployments.fixture(['ape_swap_pool_test_fixtures']);
  });

  singleRewardPoolTestSuite(
    [],
    async (who, amount, lpToken) => {
      await lpToken.mint(who, amount);
    },
    async () => {
      return await ethers.getContractAt(
        hre.names.internal.apeSwapPool,
        (await deployments.get(hre.names.internal.apeSwapPool)).address
      );
    },
    async () => {
      return await ethers.getContractAt(
        hre.names.internal.mockToken,
        (await deployments.get(hre.names.external.pairs.ape.lp)).address
      );
    },
    rewardsDuration
  );
});
