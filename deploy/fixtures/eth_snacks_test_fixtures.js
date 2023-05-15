const hre = require('hardhat');
module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
}) => {
  const {log} = deployments;
  log('Using empty stage...');
}
module.exports.tags = ["eth_snacks_test_fixtures"];
module.exports.dependencies = ["debug"];
module.exports.runAtTheEnd = true;
