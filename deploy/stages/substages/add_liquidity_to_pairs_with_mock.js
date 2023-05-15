const hre = require('hardhat');
const {
  ZERO,
  getLastBlockTimestamp,
  getNamedAccountsFromTenderly,
  getFakeDeployment
} = require('../../helpers.js');

module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
  network
}) => {  
  const {log, save} = deployments;

  const {deployer} = network.name === 'tenderly' ? await getNamedAccountsFromTenderly(hre, log) 
    : await getNamedAccounts();

  let busdBtcReserves;
  let busdEthReserves;
  
  if (!network.name.endsWith('_testnet')) {
    log('Using actual reserves...');
    const busdBtcRealPair = await hre.ethers.getContractAt(
      hre.names.internal.iPair,
      "0xF45cd219aEF8618A92BAa7aD848364a158a24F33"
    );
  
    const busdEthRealPair = await hre.ethers.getContractAt(
      hre.names.internal.iPair,
      "0x7213a321F1855CF1779f42c0CD85d3D95291D34C"
    );
    busdBtcReserves = await busdBtcRealPair.getReserves();
    busdEthReserves = await busdEthRealPair.getReserves();
  } else {
    log('Using default reserves...');
    busdBtcReserves = [hre.ethers.utils.parseEther('10000'), hre.ethers.utils.parseEther('10000')];
    busdEthReserves = [hre.ethers.utils.parseEther('10000'), hre.ethers.utils.parseEther('10000')];
  }
  
  const pancakeRouter = await hre.ethers.getContractAt(
    hre.names.internal.iRouter,
    (await deployments.get(hre.names.external.routers.pancake)).address
  );

  const busdAddress = (await deployments.get(hre.names.external.tokens.busd)).address;
  const ethAddress = (await deployments.get(hre.names.external.tokens.eth)).address;
  const btcAddress = (await deployments.get(hre.names.external.tokens.btc)).address;

  const latestTime = await getLastBlockTimestamp(hre, network);
  
  const deadline = hre.ethers.BigNumber.from(latestTime).add(hre.ethers.BigNumber.from('10000'));

  const ethMockToken = await hre.ethers.getContractAt(hre.names.internal.mockToken, ethAddress);
  const btcMockToken = await hre.ethers.getContractAt(hre.names.internal.mockToken, btcAddress);
  const busdMockToken = await hre.ethers.getContractAt(hre.names.internal.mockToken, busdAddress);

  await busdMockToken.mint(deployer, busdBtcReserves[1]);
  await btcMockToken.mint(deployer, busdBtcReserves[0]);

  await busdMockToken.mint(deployer, busdEthReserves[1]);
  await ethMockToken.mint(deployer, busdEthReserves[0]);

  await busdMockToken.approve(pancakeRouter.address, busdBtcReserves[1].add(busdEthReserves[1]));
  await btcMockToken.approve(pancakeRouter.address, busdBtcReserves[0]);
  await ethMockToken.approve(pancakeRouter.address, busdEthReserves[0]);

  await pancakeRouter.addLiquidity(
    busdAddress,
    btcAddress,
    busdBtcReserves[1],
    busdBtcReserves[0],
    ZERO,
    ZERO,
    deployer,
    deadline
  );

  await pancakeRouter.addLiquidity(
    busdAddress,
    ethAddress,
    busdEthReserves[1],
    busdEthReserves[0],
    ZERO,
    ZERO,
    deployer,
    deadline
  );

  const pancakeFactory = await hre.ethers.getContractAt(
    hre.names.internal.iFactory,
    await pancakeRouter.factory()
  );

  await getFakeDeployment(
    await pancakeFactory.getPair(busdAddress, ethAddress),
    hre.names.external.tokens.pairs.ethBusd,
    save,
    log
  );

  await getFakeDeployment(
    await pancakeFactory.getPair(busdAddress, btcAddress),
    hre.names.external.tokens.pairs.btcBusd,
    save,
    log
  );
}
module.exports.tags = ["add_liquidity_to_pairs_with_mock"];
