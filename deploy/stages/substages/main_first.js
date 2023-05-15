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

  const busdAddress = (await deployments.get(hre.names.external.tokens.busd)).address;
  const btcAddress = (await deployments.get(hre.names.external.tokens.btc)).address;
  const ethAddress = (await deployments.get(hre.names.external.tokens.eth)).address;

  const apeSwapRouterAddress = (await deployments.get(hre.names.external.routers.ape)).address;
  const biSwapRouterAddress = (await deployments.get(hre.names.external.routers.bi)).address;
  const pancakeSwapRouterAddress = (await deployments.get(hre.names.external.routers.pancake)).address;

  await deploy(hre.names.internal.seniorage, {
    from: deployer,
    args: [busdAddress, pancakeSwapRouterAddress],
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });
  const seniorageAddress = (await deployments.get(hre.names.internal.seniorage)).address;

  await deploy(hre.names.internal.averagePriceOracle, {
    from: deployer,
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });

  await deploy(hre.names.internal.zoinks, {
    from: deployer,
    args: [busdAddress],
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });

  await deploy(hre.names.internal.pulse, {
    from: deployer,
    args: [busdAddress, pancakeSwapRouterAddress],
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });

  await deploy(hre.names.internal.poolRewardDistributor, {
    from: deployer,
    args: [busdAddress, pancakeSwapRouterAddress],
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });
  const poolRewardDistributorAddress = (
    await deployments.get(hre.names.internal.poolRewardDistributor)
  ).address;

  await deploy(hre.names.internal.btcSnacks, {
    from: deployer,
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });
  const btcSnacksAddress = (await deployments.get(hre.names.internal.btcSnacks)).address;

  await deploy(hre.names.internal.ethSnacks, {
    from: deployer,
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });
  const ethSnacksAddress = (await deployments.get(hre.names.internal.ethSnacks)).address;

  await deploy(hre.names.internal.snacks, {
    from: deployer,
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });
  const snacksAddress = (await deployments.get(hre.names.internal.snacks)).address;

  await deploy(hre.names.internal.holdingFeeDistributor, {
    from: deployer,
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });

  await deploy(hre.names.internal.snacksPool, {
    from: deployer,
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });

  await deploy(hre.names.internal.lunchBox, {
    from: deployer,
    args: [
      busdAddress,
      btcAddress,
      ethAddress,
      pancakeSwapRouterAddress
    ],
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });

  await deploy(hre.names.internal.investmentSystemDistributor, {
    from: deployer,
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });

  await deploy(hre.names.internal.iDOFactory, {
    from: deployer,
    args: [
      busdAddress
    ],
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });

  await deploy(hre.names.internal.iDODistributor, {
    from: deployer,
    args: [
      busdAddress,
      pancakeSwapRouterAddress
    ],
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });

  await deploy(hre.names.internal.systemStopper, {
    from: deployer,
    skipIfAlreadyDeployed: skipDeploymentIfAlreadyDeployed,
    log: true
  });
};
module.exports.tags = ["main_first"];
