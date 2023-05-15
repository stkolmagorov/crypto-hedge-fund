const hre = require("hardhat");
const ethers = hre.ethers;
const {
  skipDeploymentIfAlreadyDeployed,
  getMockToken,
  getMock,
  getNamedAccountsFromTenderly
} = require('../../helpers.js');

module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
  network
}) => {
  const {deploy, save, log} = deployments;
  const { deployer } = network.name === 'tenderly' ? await getNamedAccountsFromTenderly(hre, log) 
    : await getNamedAccounts();
  const totalSupply = ethers.utils.parseEther('1000000');

  await getMockToken(
    hre.names.external.tokens.eth,
    hre.names.external.tokens.eth,
    totalSupply,
    deploy,
    deployer,
    skipDeploymentIfAlreadyDeployed,
    save
  );

  await getMockToken(
    hre.names.external.tokens.btc,
    hre.names.external.tokens.btc,
    totalSupply,
    deploy,
    deployer,
    skipDeploymentIfAlreadyDeployed,
    save
  );

  await getMockToken(
    hre.names.external.tokens.busd,
    hre.names.external.tokens.busd,
    totalSupply,
    deploy,
    deployer,
    skipDeploymentIfAlreadyDeployed,
    save
  );

  await getMockToken(
    hre.names.external.pairs.pancake.lp,
    "PLP",
    totalSupply,
    deploy,
    deployer,
    skipDeploymentIfAlreadyDeployed,
    save
  );

  await getMockToken(
    hre.names.external.pairs.ape.lp,
    "ALP",
    totalSupply,
    deploy,
    deployer,
    skipDeploymentIfAlreadyDeployed,
    save
  );

  await getMockToken(
    hre.names.external.pairs.bi.lp,
    "BLP",
    totalSupply,
    deploy,
    deployer,
    skipDeploymentIfAlreadyDeployed,
    save
  );

  await getMock(
    hre.names.internal.iRouter,
    hre.names.external.routers.pancake,
    deploy,
    deployer,
    skipDeploymentIfAlreadyDeployed,
    save
  );

  await getMock(
    hre.names.internal.iRouter,
    hre.names.external.routers.ape,
    deploy,
    deployer,
    skipDeploymentIfAlreadyDeployed,
    save
  );

  await getMock(
    hre.names.internal.iRouter,
    hre.names.external.routers.bi,
    deploy,
    deployer,
    skipDeploymentIfAlreadyDeployed,
    save
  );

  await getMock(
    hre.names.internal.iFactory,
    hre.names.external.factories.pancake,
    deploy,
    deployer,
    skipDeploymentIfAlreadyDeployed,
    save
  );

  await getMock(
    hre.names.internal.iFactory,
    hre.names.external.factories.ape,
    deploy,
    deployer,
    skipDeploymentIfAlreadyDeployed,
    save
  );

  await getMock(
    hre.names.internal.iFactory,
    hre.names.external.factories.bi,
    deploy,
    deployer,
    skipDeploymentIfAlreadyDeployed,
    save
  );

  await getMock(
    hre.names.internal.iPair,
    hre.names.external.pairs.pancake.pair,
    deploy,
    deployer,
    skipDeploymentIfAlreadyDeployed,
    save
  );

  await getMock(
    hre.names.internal.iPair,
    hre.names.external.pairs.bi.pair,
    deploy,
    deployer,
    skipDeploymentIfAlreadyDeployed,
    save
  );

  await getMock(
    hre.names.internal.iPair,
    hre.names.external.pairs.ape.pair,
    deploy,
    deployer,
    skipDeploymentIfAlreadyDeployed,
    save
  );
}
module.exports.tags = ["before_mock"];
