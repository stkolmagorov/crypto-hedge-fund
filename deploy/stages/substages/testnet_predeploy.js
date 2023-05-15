const hre = require('hardhat');
const { 
  ZERO, 
  getFakeDeployment,
  getNamedAccountsFromTenderly,
  getLastBlockTimestamp
} = require('../../helpers');

module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
  network
}) => {
  const {log, execute, save} = deployments;
  const {deployer} = network.name === 'tenderly' ? await getNamedAccountsFromTenderly(hre, log) 
  : await getNamedAccounts();

  const zoinksAddress = (await deployments.get(hre.names.internal.zoinks)).address;
  const busdAddress = (await deployments.get(hre.names.external.tokens.busd)).address;

  const pancakePairAddress = (await deployments.get(hre.names.external.pairs.pancake.pair)).address;
  const apePairAddress = (await deployments.get(hre.names.external.pairs.ape.pair)).address;
  const biPairAddress = (await deployments.get(hre.names.external.pairs.bi.pair)).address;

  const pancakeRouterAddress = (await deployments.get(hre.names.external.routers.pancake)).address;
  const apeRouterAddress = (await deployments.get(hre.names.external.routers.ape)).address;
  const biRouterAddress = (await deployments.get(hre.names.external.routers.bi)).address;

  const seniorageAddress = (await deployments.get(hre.names.internal.seniorage)).address;
  const pulseAddress = (await deployments.get(hre.names.internal.pulse)).address;
  const snacksAddress = (await deployments.get(hre.names.internal.snacks)).address;
  const poolRewardDistributorAddress = (await deployments.get(hre.names.internal.poolRewardDistributor)).address;
  const averagePriceOracleAddress = (await deployments.get(hre.names.internal.averagePriceOracle)).address;

  // These two executions below will be repeated at "configure" stage without any changes, but now
  // it is necessary that we able to buy zoinks to provide liquidity into our pairs at testnet.
  await execute(
    hre.names.internal.zoinks,
    {from: deployer, log: true},
    'configure',
    deployer,
    seniorageAddress,
    pulseAddress,
    snacksAddress,
    poolRewardDistributorAddress,
    averagePriceOracleAddress
  );
  await execute(
    hre.names.internal.zoinks,
    {from: deployer, log: true},
    'setBuffer',
    hre.ethers.BigNumber.from('5')
  );

  const provideLiquidityTimeoutInSeconds = hre.ethers.BigNumber.from('600');
  
  const logReserves = async (pairAddress) => {
    const pair = await hre.ethers.getContractAt(hre.names.internal.iPair, pairAddress);
    log(`Liquidity added: ${(await pair.getReserves()).toString()}`);
  }

  const sendLiquidity = async (routerAddress, pairArtifactName, pairLpArtifactName) => {
    const zoinks = await hre.ethers.getContractAt(hre.names.internal.zoinks, zoinksAddress);
    const busd = await hre.ethers.getContractAt(hre.names.internal.mockToken, busdAddress);
    const router = await hre.ethers.getContractAt(hre.names.internal.iRouter, routerAddress);

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

    const factory = await hre.ethers.getContractAt(
      hre.names.internal.iFactory, 
      await getFactory()
    );

    const totalBusd = hre.ethers.utils.parseEther('10000');
    await busd.mint(deployer, totalBusd);

    const busdForPairAmount = totalBusd.div(2);
    const zoinksForPairAmount = totalBusd.sub(busdForPairAmount);

    await busd.approve(zoinks.address, zoinksForPairAmount);
    await zoinks.mint(zoinksForPairAmount);

    await busd.approve(routerAddress, busdForPairAmount);
    await zoinks.approve(routerAddress, zoinksForPairAmount);
    
    const latestTime = await getLastBlockTimestamp(hre, network);

    await router.addLiquidity(
      zoinks.address,
      busd.address,
      zoinksForPairAmount,
      busdForPairAmount,
      ZERO,
      ZERO,
      deployer,
      hre.ethers.BigNumber.from(latestTime).add(provideLiquidityTimeoutInSeconds)
    );

    const pairAddress = await factory.getPair(zoinks.address, busd.address);
    await getFakeDeployment(
      pairAddress,
      pairLpArtifactName,
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

  await sendLiquidity(
    pancakeRouterAddress, 
    hre.names.external.pairs.pancake.pair,
    hre.names.external.pairs.pancake.lp
  );
  await sendLiquidity(
    apeRouterAddress,
    hre.names.external.pairs.ape.pair,
    hre.names.external.pairs.ape.lp
  );
  await sendLiquidity(
    biRouterAddress,
    hre.names.external.pairs.bi.pair,
    hre.names.external.pairs.bi.lp
  );

  await execute(
    hre.names.internal.averagePriceOracle,
    {from: deployer, log: true},
    'initialize',
    zoinksAddress,
    apePairAddress,
    biPairAddress,
    pancakePairAddress
  );

  await logReserves(pancakePairAddress);
  await logReserves(apePairAddress);
  await logReserves(biPairAddress);
}
module.exports.tags = ["testnet_predeploy"];
module.exports.dependencies = [
  "before_real",
  "insert_mock_tokens",
  "add_liquidity_to_pairs_with_mock",
  "main_first", 
  "after_real", 
  "main_second"
];
