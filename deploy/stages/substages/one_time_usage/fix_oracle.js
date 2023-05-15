const hre = require('hardhat');

module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
  network
}) => {
  const {execute, deploy} = deployments;
  const deployer = "0xf3CB3C06F29441010C7E9EE679C04668f83c9471";
  const authority = "0xd50d221D64A940133Fa19e4E8D68dE38B2a80f3C"; // HD - 2

  const seniorageAddress = (await deployments.get(hre.names.internal.seniorage)).address;
  const pulseAddress = (await deployments.get(hre.names.internal.pulse)).address;
  const poolRewardDistributorAddress = (await deployments.get(hre.names.internal.poolRewardDistributor)).address;
  const snacksAddress = (await deployments.get(hre.names.internal.snacks)).address;
  const zoinksAddress = (await deployments.get(hre.names.internal.zoinks)).address;
  const apePairLpAddress = (await deployments.get(hre.names.external.pairs.ape.lp)).address;
  const biPairLpAddress = (await deployments.get(hre.names.external.pairs.bi.lp)).address;
  const pancakePairLpAddress = (await deployments.get(hre.names.external.pairs.pancake.lp)).address;

  await deploy(hre.names.internal.averagePriceOracle, {
    from: deployer,
    skipIfAlreadyDeployed: false,
    log: true
  });
  const newOracleAddress = (
    await deployments.get(hre.names.internal.averagePriceOracle)
  ).address;

  await execute(
    hre.names.internal.zoinks,
    {from: deployer, log: true},
    'configure',
    authority,
    seniorageAddress,
    pulseAddress,
    snacksAddress,
    poolRewardDistributorAddress,
    newOracleAddress
  );

  await execute(
    hre.names.internal.averagePriceOracle,
    {from: deployer, log: true},
    'initialize',
    zoinksAddress,
    apePairLpAddress,
    biPairLpAddress,
    pancakePairLpAddress
  );
} 

module.exports.tags = ["fix_oracle"];
