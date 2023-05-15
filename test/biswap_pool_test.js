const hre = require("hardhat");
const { ethers, deployments } = hre;
const singleRewardPoolTestSuite = require('../reusable_test_suits/single_reward_pool_test_suite');

describe("BiSwapPool", () => {
  const rewardsDuration = ethers.BigNumber.from("43200");

  beforeEach(async () => {
    await deployments.fixture(['bi_swap_pool_test_fixtures']);
  });

  singleRewardPoolTestSuite(
    [], // disable notifyRewardAmount reusable test case
    async (who, amount, lpToken) => {
      await lpToken.mint(who, amount);
    },
    async () => {
      return await ethers.getContractAt(
        hre.names.internal.biSwapPool,
        (await deployments.get(hre.names.internal.biSwapPool)).address
      );
    },
    async () => {
      return await ethers.getContractAt(
        hre.names.internal.mockToken,
        (await deployments.get(hre.names.external.pairs.bi.lp)).address
      );
    },
    rewardsDuration
  );
});
