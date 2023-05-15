const hre = require('hardhat');
const fse = require("fs-extra");

module.exports = async ({
  deployments
}) => {
  const { log } = deployments;
  const rootPathOfContracts = hre.config.paths.sources;
  const pushOptions = [];
  let isRecompileNeeded;

  const synchronizeWithEthernal = async (artifactName, contractAddress, options) => {
    let actualArtifactName = artifactName;
    // options object contains:
    // key: readableName - name of the new interface instead of base name (string)
    // key: interfacesDir - name of the dir where a specific interface lies (string)
    if (options !== undefined 
        && options.readableName !== undefined 
        && options.interfacesDir !== undefined) {
      const interfacePath = `${rootPathOfContracts}/${options.interfacesDir}/${artifactName}.sol`;
      const dirForGeneratedInterfaces = `${rootPathOfContracts}/${options.interfacesDir}/generated_for_ethernal`;
      await fse.ensureDir(dirForGeneratedInterfaces);
      const newInterfacePath = `${dirForGeneratedInterfaces}/${options.readableName}.sol`;
      actualArtifactName = options.readableName;
      isRecompileNeeded = true;
      if (!(await fse.pathExists(newInterfacePath))) {
        if (options.readableName.length > 0) {
          await fse.copy(interfacePath, newInterfacePath);
          // rewrite the sol file of the interface so the names would match
          let interfaceSource = await fse.readFile(newInterfacePath, {encoding: 'utf-8'});
          // change name;
          interfaceSource = interfaceSource.replace(artifactName, options.readableName);
          await fse.outputFile(newInterfacePath, interfaceSource);
        } else {
          throw 'Cannot copy an interface under empty name!';
        }
      }
    }
    pushOptions.push({
      name: actualArtifactName,
      address: contractAddress
    });
    log(`Adding to synchronize queue with ethernal: <${artifactName}/${actualArtifactName}> - ${contractAddress}`);
  }

  await synchronizeWithEthernal(
    hre.names.internal.iRouter,
    (await deployments.get(hre.names.external.routers.pancake)).address,
    {
      interfacesDir: 'interfaces',
      readableName: hre.names.external.routers.pancake
    }
  );
  await synchronizeWithEthernal(
    hre.names.internal.iRouter,
    (await deployments.get(hre.names.external.routers.ape)).address,
    {
      interfacesDir: 'interfaces',
      readableName: hre.names.external.routers.ape
    }
  );
  await synchronizeWithEthernal(
    hre.names.internal.iRouter,
    (await deployments.get(hre.names.external.routers.bi)).address,
    {
      interfacesDir: 'interfaces',
      readableName: hre.names.external.routers.bi
    }
  );

  await synchronizeWithEthernal(
    hre.names.internal.iPair,
    (await deployments.get(hre.names.external.pairs.pancake.pair)).address,
    {
      interfacesDir: 'interfaces',
      readableName: hre.names.external.pairs.pancake.pair
    }
  );
  await synchronizeWithEthernal(
    hre.names.internal.iPair,
    (await deployments.get(hre.names.external.pairs.ape.pair)).address,
    {
      interfacesDir: 'interfaces',
      readableName: hre.names.external.pairs.ape.pair
    }
  );
  await synchronizeWithEthernal(
    hre.names.internal.iPair,
    (await deployments.get(hre.names.external.pairs.bi.pair)).address,
    {
      interfacesDir: 'interfaces',
      readableName: hre.names.external.pairs.bi.pair
    }
  );

  await synchronizeWithEthernal(
    hre.names.internal.iPair,
    (await deployments.get(hre.names.external.tokens.pairs.ethBusd)).address,
    {
      interfacesDir: 'interfaces',
      readableName: hre.names.external.tokens.pairs.ethBusd
    }
  );
  await synchronizeWithEthernal(
    hre.names.internal.iPair,
    (await deployments.get(hre.names.external.tokens.pairs.btcBusd)).address,
    {
      interfacesDir: 'interfaces',
      readableName: hre.names.external.tokens.pairs.btcBusd
    }
  );

  await synchronizeWithEthernal(
    hre.names.internal.mockToken,
    (await deployments.get(hre.names.external.tokens.busd)).address,
    {
      interfacesDir: 'mock',
      readableName: hre.names.external.tokens.busd
    }
  );
  await synchronizeWithEthernal(
    hre.names.internal.mockToken,
    (await deployments.get(hre.names.external.tokens.eth)).address,
    {
      interfacesDir: 'mock',
      readableName: hre.names.external.tokens.eth
    }
  );
  await synchronizeWithEthernal(
    hre.names.internal.mockToken,
    (await deployments.get(hre.names.external.tokens.btc)).address,
    {
      interfacesDir: 'mock',
      readableName: hre.names.external.tokens.btc
    }
  );

  await synchronizeWithEthernal(
    hre.names.internal.averagePriceOracle,
    (await deployments.get(hre.names.internal.averagePriceOracle)).address
  );
  await synchronizeWithEthernal(
    hre.names.internal.apeSwapPool,
    (await deployments.get(hre.names.internal.apeSwapPool)).address
  );
  await synchronizeWithEthernal(
    hre.names.internal.biSwapPool,
    (await deployments.get(hre.names.internal.biSwapPool)).address
  );
  await synchronizeWithEthernal(
    hre.names.internal.pancakeSwapPool,
    (await deployments.get(hre.names.internal.pancakeSwapPool)).address
  );
  await synchronizeWithEthernal(
    hre.names.internal.btcSnacks,
    (await deployments.get(hre.names.internal.btcSnacks)).address
  );
  await synchronizeWithEthernal(
    hre.names.internal.ethSnacks,
    (await deployments.get(hre.names.internal.ethSnacks)).address
  );
  await synchronizeWithEthernal(
    hre.names.internal.poolRewardDistributor,
    (await deployments.get(hre.names.internal.poolRewardDistributor)).address
  );
  await synchronizeWithEthernal(
    hre.names.internal.pulse,
    (await deployments.get(hre.names.internal.pulse)).address
  );
  await synchronizeWithEthernal(
    hre.names.internal.seniorage,
    (await deployments.get(hre.names.internal.seniorage)).address
  );
  await synchronizeWithEthernal(
    hre.names.internal.snacks,
    (await deployments.get(hre.names.internal.snacks)).address
  );
  await synchronizeWithEthernal(
    hre.names.internal.snacksPool,
    (await deployments.get(hre.names.internal.snacksPool)).address
  );
  await synchronizeWithEthernal(
    hre.names.internal.zoinks,
    (await deployments.get(hre.names.internal.zoinks)).address
  );
  await synchronizeWithEthernal(
    hre.names.internal.lunchBox,
    (await deployments.get(hre.names.internal.lunchBox)).address
  );
  await synchronizeWithEthernal(
    hre.names.internal.holdingFeeDistributor,
    (await deployments.get(hre.names.internal.holdingFeeDistributor)).address
  );

  if (isRecompileNeeded) {
    console.log('Recompilation is needed due to new generated for the Ethernal artifacts...');
    await hre.run('compile');
  }
  for (const pushOption of pushOptions) {
    await hre.ethernal.push(pushOption);
  }
}
module.exports.tags = ["sync", "synchronize_with_ethernal"];
