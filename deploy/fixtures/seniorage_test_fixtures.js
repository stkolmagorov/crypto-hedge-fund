const hre = require('hardhat');
const keccak256 = require('keccak256');

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { execute } = deployments;
  const { deployer } = await getNamedAccounts();
  const [
    , // dont remove, owner is important order
    bdmWallet,
    crmWallet,
    devManagerWallet,
    marketingManagerWallet,
    devWallet,
    marketingFundWallet,
    situationalFundWallet,
    multisigWallet
  ] = await ethers.getSigners();

  const {
    ZERO,
    mockedResultOfSwap,
    mockSwaps
  } = require('../helpers');

  await execute(
    hre.names.internal.seniorage,
    { from: deployer, log: true },
    'configureWallets',
    bdmWallet.address,
    crmWallet.address,
    devManagerWallet.address,
    marketingManagerWallet.address,
    devWallet.address,
    marketingFundWallet.address,
    situationalFundWallet.address,
    multisigWallet.address
  );

  await execute(
    hre.names.internal.seniorage,
    { from: deployer, log: true },
    'configureCurrencies',
    (await deployments.get(hre.names.external.pairs.pancake.lp)).address,
    (await deployments.get(hre.names.external.pairs.ape.lp)).address,
    (await deployments.get(hre.names.external.pairs.bi.lp)).address,
    (await deployments.get(hre.names.internal.zoinks)).address,
    (await deployments.get(hre.names.external.tokens.btc)).address,
    (await deployments.get(hre.names.external.tokens.eth)).address,
    (await deployments.get(hre.names.internal.snacks)).address,
    (await deployments.get(hre.names.internal.btcSnacks)).address,
    (await deployments.get(hre.names.internal.ethSnacks)).address
  );

  await execute(
    hre.names.internal.seniorage,
    { from: deployer, log: true },
    'setPulse',
    (await deployments.get(hre.names.internal.pulse)).address
  );

  await execute(
    hre.names.internal.seniorage,
    { from: deployer, log: true },
    'grantRole',
    keccak256("AUTHORITY_ROLE"),
    deployer
  );

  await execute(
    hre.names.internal.seniorage,
    { from: deployer, log: true },
    'setLunchBox',
    (await deployments.get(hre.names.internal.lunchBox)).address
  );

  await mockSwaps(
    hre.names.external.routers.pancake,
    deployments,
    ZERO,
    deployer,
    mockedResultOfSwap,
  );
}
module.exports.tags = ["seniorage_test_fixtures"];
module.exports.dependencies = ["debug"];
module.exports.runAtTheEnd = true;
