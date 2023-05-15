const hre = require('hardhat');

module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
  network
}) => {  
  const apeSwapRouterAddress = (await deployments.get(hre.names.external.routers.ape)).address;
  const pancakeSwapRouterAddress = (await deployments.get(hre.names.external.routers.pancake)).address;
  const biSwapRouterAddress = (await deployments.get(hre.names.external.routers.bi)).address;
  
  const snacksPoolAddress = (await deployments.get(hre.names.internal.snacksPool)).address;
  const pancakeSwapPoolAddress = (await deployments.get(hre.names.internal.pancakeSwapPool)).address;
  const apeSwapPoolAddress = (await deployments.get(hre.names.internal.apeSwapPool)).address;
  const biSwapPoolAddress = (await deployments.get(hre.names.internal.biSwapPool)).address;

  const busd = await hre.ethers.getContractAt(
    hre.names.internal.mockToken,
    (await deployments.get(hre.names.external.tokens.busd)).address
  );
  const eth = await hre.ethers.getContractAt(
    hre.names.internal.mockToken,
    (await deployments.get(hre.names.external.tokens.eth)).address
  );
  const btc = await hre.ethers.getContractAt(
    hre.names.internal.mockToken,
    (await deployments.get(hre.names.external.tokens.btc)).address
  );
  const zoinks = await hre.ethers.getContractAt(
    hre.names.internal.zoinks,
    (await deployments.get(hre.names.internal.zoinks)).address
  );
  const snacks = await hre.ethers.getContractAt(
    hre.names.internal.snacks,
    (await deployments.get(hre.names.internal.snacks)).address
  );
  const ethSnacks = await hre.ethers.getContractAt(
    hre.names.internal.ethSnacks,
    (await deployments.get(hre.names.internal.ethSnacks)).address
  );
  const btcSnacks = await hre.ethers.getContractAt(
    hre.names.internal.btcSnacks,
    (await deployments.get(hre.names.internal.btcSnacks)).address
  );
  const pancakeZoinksBusdPair = await hre.ethers.getContractAt(
    hre.names.internal.iPair,
    (await deployments.get(hre.names.external.pairs.pancake.pair)).address
  );
  const apeZoinksBusdPair = await hre.ethers.getContractAt(
    hre.names.internal.iPair,
    (await deployments.get(hre.names.external.pairs.ape.pair)).address
  );
  const biZoinksBusdPair = await hre.ethers.getContractAt(
    hre.names.internal.iPair,
    (await deployments.get(hre.names.external.pairs.bi.pair)).address
  );

  const approveAmount = hre.ethers.utils.parseEther('1000000000000');

  await busd.approve(zoinks.address, approveAmount);
  await busd.approve(pancakeSwapRouterAddress, approveAmount);
  await busd.approve(apeSwapRouterAddress, approveAmount);
  await busd.approve(biSwapRouterAddress, approveAmount);

  await zoinks.approve(pancakeSwapRouterAddress, approveAmount);
  await zoinks.approve(apeSwapRouterAddress, approveAmount);
  await zoinks.approve(biSwapRouterAddress, approveAmount);

  await zoinks.approve(snacks.address, approveAmount);
  
  await snacks.approve(snacks.address, approveAmount);

  await btc.approve(btcSnacks.address, approveAmount);
  await eth.approve(ethSnacks.address, approveAmount);

  await btcSnacks.approve(btcSnacks.address, approveAmount);
  await ethSnacks.approve(ethSnacks.address, approveAmount);

  await pancakeZoinksBusdPair.approve(pancakeSwapRouterAddress, approveAmount);
  await apeZoinksBusdPair.approve(apeSwapRouterAddress, approveAmount);
  await biZoinksBusdPair.approve(biSwapRouterAddress, approveAmount);

  await pancakeZoinksBusdPair.approve(pancakeSwapPoolAddress, approveAmount);
  await apeZoinksBusdPair.approve(apeSwapPoolAddress, approveAmount);
  await biZoinksBusdPair.approve(biSwapPoolAddress, approveAmount);
  await snacks.approve(snacksPoolAddress, approveAmount);

  await eth.approve(pancakeSwapRouterAddress, approveAmount);
  await eth.approve(apeSwapRouterAddress, approveAmount);
  await eth.approve(biSwapRouterAddress, approveAmount);

  await btc.approve(pancakeSwapRouterAddress, approveAmount);
  await btc.approve(apeSwapRouterAddress, approveAmount);
  await btc.approve(biSwapRouterAddress, approveAmount);
}
module.exports.tags = ["all_approves"];
