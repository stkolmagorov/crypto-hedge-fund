const hre = require('hardhat');
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
  await execute(
    hre.names.internal.pancakeSwapPool,
    {from: deployer, log: true},
    'setPoolRewardDistributor',
    deployer
  );
}
module.exports.tags = ["pancake_swap_pool_test_fixtures"];
module.exports.dependencies = ["debug"];
module.exports.runAtTheEnd = true;
