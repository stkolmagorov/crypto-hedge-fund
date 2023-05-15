const hre = require('hardhat');
const {
  skipDeploymentIfAlreadyDeployed,
  getMockToken,
  ZERO,
  getLastBlockTimestamp,
  getNamedAccountsFromTenderly
} = require('../../helpers.js');

module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
  network
}) => {  
  const {log, save, deploy} = deployments;
  log('Using Insert Mock Tokens stage...');
  
  const {deployer} = network.name === 'tenderly' ? await getNamedAccountsFromTenderly(hre, log) 
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
}
module.exports.tags = ["insert_mock_tokens"];
