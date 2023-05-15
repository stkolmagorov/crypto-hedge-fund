const hre = require('hardhat');
module.exports = async ({
  deployments
}) => {
  const { log } = deployments;

  const synchronizeWithTenderly = async (artifactName, contractAddress) => {
    await hre.tenderly.push({
      name: artifactName,
      address: contractAddress,
    });
    log(`Synchronizing with tenderly: ${artifactName} - ${contractAddress}`);
  }

  await synchronizeWithTenderly(
    hre.names.internal.iRouter,
    (await deployments.get(hre.names.external.routers.pancake)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.iRouter,
    (await deployments.get(hre.names.external.routers.ape)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.iRouter,
    (await deployments.get(hre.names.external.routers.bi)).address
  );

  await synchronizeWithTenderly(
    hre.names.internal.iPair,
    (await deployments.get(hre.names.external.pairs.pancake.pair)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.iPair,
    (await deployments.get(hre.names.external.pairs.ape.pair)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.iPair,
    (await deployments.get(hre.names.external.pairs.bi.pair)).address
  );

  await synchronizeWithTenderly(
    hre.names.internal.mockToken,
    (await deployments.get(hre.names.external.tokens.busd)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.mockToken,
    (await deployments.get(hre.names.external.tokens.eth)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.mockToken,
    (await deployments.get(hre.names.external.tokens.btc)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.averagePriceOracle,
    (await deployments.get(hre.names.internal.averagePriceOracle)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.apeSwapPool,
    (await deployments.get(hre.names.internal.apeSwapPool)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.biSwapPool,
    (await deployments.get(hre.names.internal.biSwapPool)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.pancakeSwapPool,
    (await deployments.get(hre.names.internal.pancakeSwapPool)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.btcSnacks,
    (await deployments.get(hre.names.internal.btcSnacks)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.ethSnacks,
    (await deployments.get(hre.names.internal.ethSnacks)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.poolRewardDistributor,
    (await deployments.get(hre.names.internal.poolRewardDistributor)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.pulse,
    (await deployments.get(hre.names.internal.pulse)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.seniorage,
    (await deployments.get(hre.names.internal.seniorage)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.snacks,
    (await deployments.get(hre.names.internal.snacks)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.snacksPool,
    (await deployments.get(hre.names.internal.snacksPool)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.zoinks,
    (await deployments.get(hre.names.internal.zoinks)).address
  );
  await synchronizeWithTenderly(
    hre.names.internal.lunchBox,
    (await deployments.get(hre.names.internal.lunchBox)).address
  );
}
module.exports.tags = ["sync_tenderly", "synchronize_with_tenderly"];
