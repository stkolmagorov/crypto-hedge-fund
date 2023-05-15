const hre = require("hardhat");
const { getFakeDeployment, ZERO_ADDRESS } = require('../../helpers.js');

module.exports = async ({ deployments }) => {
  const {save, log} = deployments;

  const zoinksAddress = (await deployments.get(hre.names.internal.zoinks)).address;
  const busdAddress = (await deployments.get(hre.names.external.tokens.busd)).address;

  // for LP and Pair interfaces there are different artifact names for
  // similarity of artifact name spaces for production and testing stage
  const prepareFactoryAndPairForDex = async (
    routerArtifactName,
    factoryArtifactName,
    lpArtifactName,
    pairArtifactName
  ) => {
    const router = await hre.ethers.getContractAt(
      hre.names.internal.iRouter,
      (await deployments.get(routerArtifactName)).address
    );
    
    const defaultFactories = {
      ape: "0x152349604d49c2Af10ADeE94b918b051104a143E",
      bi: "0xCbDf397E63DD9123B33d9Df0De602C85aD195e2f",
      pancake: "0xB7926C0430Afb07AA7DEfDE6DA862aE0Bde767bc"
    };

    const getFactory = async () => {
      try {
        return await router.factory();
      } catch (e) {
        switch (routerArtifactName) {
          case hre.names.external.routers.ape:
            return defaultFactories.ape;

          case hre.names.external.routers.bi:
            return defaultFactories.bi;

          case hre.names.external.routers.pancake:
            return defaultFactories.pancake;
            
          default:
            throw `Unknown router: ${routerArtifactName}`;
        }
      }
    };

    await getFakeDeployment(
      await getFactory(),
      factoryArtifactName,
      save,
      log
    );

    const factory = await hre.ethers.getContractAt(
      hre.names.internal.iFactory,
      (await deployments.get(factoryArtifactName)).address
    );

    let pairAddress = await factory.getPair(zoinksAddress, busdAddress);
    if (pairAddress == ZERO_ADDRESS) {
      await factory.createPair(zoinksAddress, busdAddress);
      pairAddress = await factory.getPair(zoinksAddress, busdAddress);
    }

    await getFakeDeployment(
      pairAddress,
      lpArtifactName,
      save,
      log
    );
    await getFakeDeployment(
      pairAddress,
      pairArtifactName,
      save,
      log
    );
  }
  
  await prepareFactoryAndPairForDex(
    hre.names.external.routers.pancake,
    hre.names.external.factories.pancake,
    hre.names.external.pairs.pancake.lp,
    hre.names.external.pairs.pancake.pair,
  );
  
  await prepareFactoryAndPairForDex(
    hre.names.external.routers.ape,
    hre.names.external.factories.ape,
    hre.names.external.pairs.ape.lp,
    hre.names.external.pairs.ape.pair,
  );

  await prepareFactoryAndPairForDex(
    hre.names.external.routers.bi,
    hre.names.external.factories.bi,
    hre.names.external.pairs.bi.lp,
    hre.names.external.pairs.bi.pair,
  );
}
module.exports.tags = ["after_real"];