const hre = require('hardhat');
module.exports = async () => {
  // Reset workspace
  await hre.ethernal.resetWorkspace(process.env.ETHERNAL_WORKSPACE);
}
module.exports.tags = ["ethernal_workspace_reset"];
