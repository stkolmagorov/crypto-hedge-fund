const hre = require('hardhat');
module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
}) => {
  const {execute} = deployments;
  const {
    deployer
  } = await getNamedAccounts();

  const seniorageAddress = (await deployments.get(hre.names.internal.seniorage)).address;
  const lunchBoxAddress = (await deployments.get(hre.names.internal.lunchBox)).address;
  const snacksAddress = (await deployments.get(hre.names.internal.snacks)).address;
  const btcSnacksAddress = (await deployments.get(hre.names.internal.btcSnacks)).address;
  const ethSnacksAddress = (await deployments.get(hre.names.internal.ethSnacks)).address;
  const investmentSystemDistributorAddress = (await deployments.get(hre.names.internal.investmentSystemDistributor)).address;

  await execute(
    hre.names.internal.snacksPool,
    {from: deployer, log: true},
    'configure',
    seniorageAddress,
    deployer,
    lunchBoxAddress,
    snacksAddress,
    btcSnacksAddress,
    ethSnacksAddress,
    investmentSystemDistributorAddress
  );
}
module.exports.tags = ["snacks_pool_test_fixtures"];
module.exports.dependencies = ["debug"];
module.exports.runAtTheEnd = true;
