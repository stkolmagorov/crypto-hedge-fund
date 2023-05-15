const hre = require("hardhat")
const { ethers, deployments } = hre;
const multipleRewardPoolTestSuite = require('../reusable_test_suits/multiple_reward_pool_test_suite');

describe("PancakeSwapPool", () => {
  const rewardsDuration = ethers.BigNumber.from("43200");

  beforeEach(async () => {
    await deployments.fixture(['pancake_swap_pool_test_fixtures']);
  });

  multipleRewardPoolTestSuite(
    [],//[1, 2, 3, 4, 12, 16],
    [], // // no need to disable some expects of reward with penalties
    [], // no need to disable some expects of reward without penalties
    -1, // to need to take into account that staking token is a reward token
    async (who, amount, lpToken) => {
      await lpToken.mint(who, amount);
    },
    async () => {
      return await ethers.getContractAt(
        hre.names.internal.pancakeSwapPool,
        (await deployments.get(hre.names.internal.pancakeSwapPool)).address
      );
    },
    async () => {
      return await ethers.getContractAt(
        hre.names.internal.mockToken,
        (await deployments.get(hre.names.external.pairs.pancake.lp)).address
      );
    },
    rewardsDuration
);
});
