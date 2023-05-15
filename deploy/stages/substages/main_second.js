const hre = require('hardhat');
const {skipDeploymentIfAlreadyDeployed, getNamedAccountsFromTenderly} = require('../../helpers.js');

module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
  network
}) => {
  const { deploy, log } = deployments;
  const { deployer } = network.name === 'tenderly' ? await getNamedAccountsFromTenderly(hre, log) 
    : await getNamedAccounts();

  const pancakePairLpAddress = (await deployments.get(hre.names.external.pairs.pancake.lp)).address;
  const apePairLpAddress = (await deployments.get(hre.names.external.pairs.ape.lp)).address;
  const biPairLpAddress = (await deployments.get(hre.names.external.pairs.bi.lp)).address;

  const poolRewardDistributorAddress = (await deployments.get(hre.names.internal.poolRewardDistributor)).address;
  const seniorageAddress = (await deployments.get(hre.names.internal.seniorage)).address;
  const zoinksTokenAddress = (await deployments.get(hre.names.internal.zoinks)).address;
  const snacksAddress = (await deployments.get(hre.names.internal.snacks)).address;
  const btcSnacksAddress = (await deployments.get(hre.names.internal.btcSnacks)).address;
  const ethSnacksAddress = (await deployments.get(hre.names.internal.ethSnacks)).address;

  await deploy(hre.names.internal.pancakeSwapPool, {
    from: deployer,
    args: [
      pancakePairLpAddress,
      poolRewardDistributorAddress,
      seniorageAddress,
      [
        zoinksTokenAddress,
        snacksAddress,
        btcSnacksAddress,
        ethSnacksAddress
      ]
    ],
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });

  await deploy(hre.names.internal.apeSwapPool, {
    from: deployer,
    args: [
      apePairLpAddress,
      zoinksTokenAddress,
      poolRewardDistributorAddress,
      seniorageAddress
    ],
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });

  await deploy(hre.names.internal.biSwapPool, {
    from: deployer,
    args: [
      biPairLpAddress,
      zoinksTokenAddress,
      poolRewardDistributorAddress,
      seniorageAddress
    ],
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });
};
module.exports.tags = ["main_second"];
