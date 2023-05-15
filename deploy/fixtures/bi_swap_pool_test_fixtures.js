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
    hre.names.internal.biSwapPool,
    {from: deployer, log: true},
    'setPoolRewardDistributor',
    deployer
  );
}
module.exports.tags = ["bi_swap_pool_test_fixtures"];
module.exports.dependencies = ["debug"];
module.exports.runAtTheEnd = true;
