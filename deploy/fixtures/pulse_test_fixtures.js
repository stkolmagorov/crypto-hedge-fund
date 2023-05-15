const hre = require('hardhat');
const {
  ZERO,
  mockedResultOfSwap,
  ZERO_ADDRESS,
  getFakeDeployment,
  mockedLiquidity,
  mockSwaps,
  mockLiquidity
} = require('../helpers');

module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
}) => {
  const {deploy, save, execute} = deployments;
  const {
    deployer
  } = await getNamedAccounts();

  const zoinks = await ethers.getContractAt(
    hre.names.internal.zoinks,
    (await deployments.get(hre.names.internal.zoinks)).address
  );
  const busd = await ethers.getContractAt(
    hre.names.internal.mockToken,
    (await deployments.get(hre.names.external.tokens.busd)).address
  );
  const eth = await ethers.getContractAt(
    hre.names.internal.mockToken,
    (await deployments.get(hre.names.external.tokens.eth)).address
  );
  const btc = await ethers.getContractAt(
    hre.names.internal.mockToken,
    (await deployments.get(hre.names.external.tokens.btc)).address
  );
  const pancakeSwapPool = await ethers.getContractAt(
    hre.names.internal.pancakeSwapPool,
    (await deployments.get(hre.names.internal.pancakeSwapPool)).address
  );
  const pulse = await ethers.getContractAt(
    hre.names.internal.pulse,
    (await deployments.get(hre.names.internal.pulse)).address
  );
  const snacksPool = await ethers.getContractAt(
    hre.names.internal.snacksPool,
    (await deployments.get(hre.names.internal.snacksPool)).address
  );

  const snacksAddress = (await deployments.get(hre.names.internal.snacks)).address;
  const snacks = await ethers.getContractAt(hre.names.internal.snacks, snacksAddress);

  const btcSnacksAddress = (await deployments.get(hre.names.internal.btcSnacks)).address;
  const btcSnacks = await ethers.getContractAt(hre.names.internal.btcSnacks, btcSnacksAddress);

  const ethSnacksAddress = (await deployments.get(hre.names.internal.ethSnacks)).address;
  const ethSnacks = await ethers.getContractAt(hre.names.internal.ethSnacks, ethSnacksAddress);

  const pairAddress = (await deployments.get(hre.names.external.pairs.pancake.lp)).address;
  
  const seniorageAddress = (await deployments.get(hre.names.internal.seniorage)).address;

  const initialBalance = ethers.utils.parseEther("1000000000");

  await busd.mint(deployer, initialBalance);
  await btc.mint(deployer, initialBalance);
  await eth.mint(deployer, initialBalance);

  await busd.mint(deployer, initialBalance);
  await busd.approve(zoinks.address, initialBalance);
  await zoinks.mint(initialBalance);

  await pulse.configure(
    pairAddress,
    zoinks.address,
    snacks.address,
    btcSnacks.address,
    ethSnacks.address,
    pancakeSwapPool.address,
    snacksPool.address,
    seniorageAddress,
    deployer
  );

  // Snacks buying
  const amountToBuy = ethers.utils.parseEther("10000");
  const tokensToApprove = ethers.utils.parseEther("10000000");
  await zoinks.approve(snacks.address, tokensToApprove)
  await snacks.mintWithBuyTokenAmount(amountToBuy);

  // // BtcSnacks buying
  await btc.approve(btcSnacks.address, tokensToApprove);
  await btcSnacks.mintWithBuyTokenAmount(amountToBuy);

  // // BtcSnacks buying
  await eth.approve(ethSnacks.address, tokensToApprove);
  await ethSnacks.mintWithBuyTokenAmount(amountToBuy);

  await mockSwaps(
    hre.names.external.routers.pancake,
    deployments,
    ZERO,
    deployer,
    mockedResultOfSwap
  );

  await mockLiquidity(
    mockedLiquidity,
    deployments
  );

}
module.exports.tags = ["pulse_test_fixtures"];
module.exports.dependencies = ["debug"];
module.exports.runAtTheEnd = true;
