const hre = require('hardhat');

module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
  network
}) => {
  const {execute} = deployments;
  const deployer = "0xf3CB3C06F29441010C7E9EE679C04668f83c9471"; // HD - 1
  
  await execute(
    hre.names.internal.apeSwapPool,
    {from: deployer, log: true},
    'pause'
  );
  await execute(
    hre.names.internal.biSwapPool,
    {from: deployer, log: true},
    'pause'
  );
  await execute(
    hre.names.internal.btcSnacks,
    {from: deployer, log: true},
    'pause'
  );
  await execute(
    hre.names.internal.ethSnacks,
    {from: deployer, log: true},
    'pause'
  );
  await execute(
    hre.names.internal.pancakeSwapPool,
    {from: deployer, log: true},
    'pause'
  );
  await execute(
    hre.names.internal.poolRewardDistributor,
    {from: deployer, log: true},
    'pause'
  );
  await execute(
    hre.names.internal.pulse,
    {from: deployer, log: true},
    'pause'
  );
  await execute(
    hre.names.internal.seniorage,
    {from: deployer, log: true},
    'pause'
  );
  await execute(
    hre.names.internal.snacks,
    {from: deployer, log: true},
    'pause'
  );
  await execute(
    hre.names.internal.snacksPool,
    {from: deployer, log: true},
    'pause'
  );
  await execute(
    hre.names.internal.zoinks,
    {from: deployer, log: true},
    'pause'
  );
} 

module.exports.tags = ["pause_all_contracts"];
