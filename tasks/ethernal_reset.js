module.exports = (task) => task(
  "ethernal_reset",
  "Resets the Ethernal Zoinks testnet Workspace",
  async (taskArgs, hre) => {
    await hre.ethernal.resetWorkspace(process.env.ETHERNAL_WORKSPACE);
  }
);
