const hre = require('hardhat');
const { getNamedAccountsFromTenderly } = require('../../../helpers.js');
const keccak256 = require('keccak256');

module.exports = (getReplacedAddressAction) =>
  async ({
    getNamedAccounts,
    deployments,
    getChainId,
    getUnnamedAccounts,
    network
  }) => {
    const { execute, log } = deployments;

    let deployer;
    let authority;
    let recipient;
    let bdmWallet;
    let crmWallet;
    let devManagerWallet;
    let marketingManagerWallet;
    let devWallet;
    let marketingFundWallet;
    let situationalFundWallet;
    let multisigWallet;

    if (network.name === 'bsc_mainnet') {
      deployer = "0xf3CB3C06F29441010C7E9EE679C04668f83c9471"; // HD - 1
      authority = "0xd50d221D64A940133Fa19e4E8D68dE38B2a80f3C"; // HD - 2
      recipient = "0x32e7f724f8e20ebcabe6291867f56d0a2f7f934d"; // LunchBox (KuCoin BUSD) - 0x32e7f724f8e20ebcabe6291867f56d0a2f7f934d
      bdmWallet = "0x467927774B59F7cB023863b07960669f958EC19a"; // Chris Address – (5%) split – 0x467927774B59F7cB023863b07960669f958EC19a
      crmWallet = "0xc249aE80c56fE28628d5d3679651D45d96C9d0de"; // Andrew Address – (5%) split – 0xc249aE80c56fE28628d5d3679651D45d96C9d0de
      devManagerWallet = "0x0B84e85d4cFF631224e5549D408EFde4843bDe1E"; // Artem Address – (5%) split – 0x0B84e85d4cFF631224e5549D408EFde4843bDe1E
      marketingManagerWallet = "0x1e00D15771ed9c4cEfAe77528020DcaAce790243"; // Marketing Address – (5%) split 0x1e00D15771ed9c4cEfAe77528020DcaAce790243
      devWallet = "0xdBace8f59843c8B43fab6A8f6329FC7D5d157C03"; // Dev Fund - 0xdBace8f59843c8B43fab6A8f6329FC7D5d157C03
      marketingFundWallet = "0xAb9a33de8A4B024351Ea730F88ad9328f95d969b"; // Marketing Fund - 0xAb9a33de8A4B024351Ea730F88ad9328f95d969b
      situationalFundWallet = "0xC26a67F424dDAA5Ce000Fa34a0ed518Daf205465"; // Situational Fund - 0xC26a67F424dDAA5Ce000Fa34a0ed518Daf205465
      multisigWallet = "0x9EeBe68f49074f9DE70A1Dc04345DF3f17489183"; // EOA
    } else {
      const testnetAccounts = network.name === 'tenderly' ? await getNamedAccountsFromTenderly(hre, log) : await getNamedAccounts();
      deployer = testnetAccounts.deployer;
      authority = testnetAccounts.authority;
      recipient = testnetAccounts.recipient;
      bdmWallet = testnetAccounts.bdmWallet;
      crmWallet = testnetAccounts.crmWallet;
      devManagerWallet = testnetAccounts.devManagerWallet;
      marketingManagerWallet = testnetAccounts.marketingManagerWallet;
      devWallet = testnetAccounts.devWallet;
      marketingFundWallet = testnetAccounts.marketingFundWallet;
      situationalFundWallet = testnetAccounts.situationalFundWallet;
      multisigWallet = testnetAccounts.multisigWallet;
    }

    const rewardsDuration = ethers.BigNumber.from("43200");

    const busdAddress = (await deployments.get(hre.names.external.tokens.busd)).address;
    const btcAddress = (await deployments.get(hre.names.external.tokens.btc)).address;
    const ethAddress = (await deployments.get(hre.names.external.tokens.eth)).address;


    // with LP suffix is MockToken instances in debug stage
    // and witout LP suffix is MockContract instances in debug stage
    // in the production stage either with or without LP suffix won't do the difference
    // every addresses per DEX are similar
    // 
    // const pancakePairAddress = (await deployments.get(hre.names.external.pairs.pancake.pair)).address;
    // const apePairAddress = (await deployments.get(hre.names.external.pairs.ape.pair)).address;
    // const biPairAddress = (await deployments.get(hre.names.external.pairs.bi.pair)).address;
    const pancakePairLpAddress = (await deployments.get(hre.names.external.pairs.pancake.lp)).address;
    const apePairLpAddress = (await deployments.get(hre.names.external.pairs.ape.lp)).address;
    const biPairLpAddress = (await deployments.get(hre.names.external.pairs.bi.lp)).address;

    const systemStopperAddress = (await deployments.get(hre.names.internal.systemStopper)).address;
    const zoinksTokenAddress = (await deployments.get(hre.names.internal.zoinks)).address;
    const seniorageAddress = (await deployments.get(hre.names.internal.seniorage)).address;
    const pulseAddress = (await deployments.get(hre.names.internal.pulse)).address;
    const poolRewardDistributorAddress = (await deployments.get(hre.names.internal.poolRewardDistributor)).address;
    const holdingFeeDistributorAddress = (await deployments.get(hre.names.internal.holdingFeeDistributor)).address;
    const btcSnacksAddress = (await deployments.get(hre.names.internal.btcSnacks)).address;
    const ethSnacksAddress = (await deployments.get(hre.names.internal.ethSnacks)).address;
    const snacksAddress = (await deployments.get(hre.names.internal.snacks)).address;
    const snacksPoolAddress = (await deployments.get(hre.names.internal.snacksPool)).address;
    const averagePriceOracleAddress = (await deployments.get(hre.names.internal.averagePriceOracle)).address;
    const pancakeSwapPoolAddress = (await deployments.get(hre.names.internal.pancakeSwapPool)).address;
    const lunchBoxAddress = (await deployments.get(hre.names.internal.lunchBox)).address;
    const apeSwapPoolAddress = (await deployments.get(hre.names.internal.apeSwapPool)).address;
    const biwapPoolAddress = (await deployments.get(hre.names.internal.biSwapPool)).address;
    const investmentSystemDistributorAddress = (await deployments.get(hre.names.internal.investmentSystemDistributor)).address;
    const idoFactoryAddress = (await deployments.get(hre.names.internal.iDOFactory)).address;
    const idoDistributorAddress = (await deployments.get(hre.names.internal.iDODistributor)).address;
    const idoTokenBytecode = (await hre.artifacts.readArtifact('contracts/IDOToken.sol:IDOToken')).bytecode;
    const idoLunchBoxPoolBytecode = (await hre.artifacts.readArtifact('contracts/IDOLunchBoxPool.sol:IDOLunchBoxPool')).bytecode;
    const idoPoolByteCode = (await hre.artifacts.readArtifact('contracts/IDOPool.sol:IDOPool')).bytecode;

    const pausableContracts = [
      apeSwapPoolAddress, 
      biwapPoolAddress, 
      pancakeSwapPoolAddress, 
      snacksPoolAddress, 
      pulseAddress, 
      seniorageAddress, 
      poolRewardDistributorAddress,
      holdingFeeDistributorAddress,
      snacksAddress,
      zoinksTokenAddress,
      investmentSystemDistributorAddress
    ];

    // CONTRACTS CONFIGURATION

    await execute(
      hre.names.internal.zoinks,
      { from: deployer, log: true },
      'configure',
      authority,
      seniorageAddress,
      pulseAddress,
      snacksAddress,
      poolRewardDistributorAddress,
      averagePriceOracleAddress
    );

    await execute(
      hre.names.internal.poolRewardDistributor,
      { from: deployer, log: true },
      'configure',
      zoinksTokenAddress,
      snacksAddress,
      btcSnacksAddress,
      ethSnacksAddress,
      apeSwapPoolAddress,
      biwapPoolAddress,
      pancakeSwapPoolAddress,
      snacksPoolAddress,
      lunchBoxAddress,
      seniorageAddress,
      authority
    );

    await execute(
      hre.names.internal.zoinks,
      { from: deployer, log: true },
      'setBuffer',
      ethers.BigNumber.from('5')
    );

    await execute(
      hre.names.internal.holdingFeeDistributor,
      { from: deployer, log: true },
      'configure',
      btcSnacksAddress,
      ethSnacksAddress,
      authority
    );

    await execute(
      hre.names.internal.snacks,
      { from: deployer, log: true },
      'configure',
      zoinksTokenAddress,
      pulseAddress,
      poolRewardDistributorAddress,
      seniorageAddress,
      snacksPoolAddress,
      pancakeSwapPoolAddress,
      lunchBoxAddress,
      authority,
      btcSnacksAddress,
      ethSnacksAddress,
    );

    await execute(
      hre.names.internal.btcSnacks,
      { from: deployer, log: true },
      'configure',
      btcAddress,
      pulseAddress,
      poolRewardDistributorAddress,
      seniorageAddress,
      snacksPoolAddress,
      pancakeSwapPoolAddress,
      lunchBoxAddress,
      authority,
      await getReplacedAddressAction()
    );

    await execute(
      hre.names.internal.ethSnacks,
      { from: deployer, log: true },
      'configure',
      ethAddress,
      pulseAddress,
      poolRewardDistributorAddress,
      seniorageAddress,
      snacksPoolAddress,
      pancakeSwapPoolAddress,
      lunchBoxAddress,
      authority,
      await getReplacedAddressAction()
    );

    await execute(
      hre.names.internal.lunchBox,
      { from: deployer, log: true },
      'configure',
      zoinksTokenAddress,
      snacksAddress,
      btcSnacksAddress,
      ethSnacksAddress,
      snacksPoolAddress,
      poolRewardDistributorAddress,
      seniorageAddress,
      investmentSystemDistributorAddress
    );

    await execute(
      hre.names.internal.lunchBox,
      { from: deployer, log: true },
      'setRecipients',
      [recipient],
      [10000]
    );

    await execute(
      hre.names.internal.snacksPool,
      { from: deployer, log: true },
      'configure',
      seniorageAddress,
      poolRewardDistributorAddress,
      lunchBoxAddress,
      snacksAddress,
      btcSnacksAddress,
      ethSnacksAddress,
      investmentSystemDistributorAddress
    );

    await execute(
      hre.names.internal.snacksPool,
      { from: deployer, log: true },
      'approveAllSnacksTo',
      lunchBoxAddress
    );

    await execute(
      hre.names.internal.snacksPool,
      { from: deployer, log: true },
      'approveAllSnacksTo',
      idoDistributorAddress
    );

    await execute(
      hre.names.internal.snacksPool,
      { from: deployer, log: true },
      'grantRole',
      keccak256("AUTHORITY_ROLE"),
      idoFactoryAddress
    );

    await execute(
      hre.names.internal.pulse,
      { from: deployer, log: true },
      'configure',
      pancakePairLpAddress,
      zoinksTokenAddress,
      snacksAddress,
      btcSnacksAddress,
      ethSnacksAddress,
      pancakeSwapPoolAddress,
      snacksPoolAddress,
      seniorageAddress,
      authority
    );

    await execute(
      hre.names.internal.seniorage,
      { from: deployer, log: true },
      'configureCurrencies',
      pancakePairLpAddress,
      apePairLpAddress,
      biPairLpAddress,
      zoinksTokenAddress,
      btcAddress,
      ethAddress,
      snacksAddress,
      btcSnacksAddress,
      ethSnacksAddress
    );

    await execute(
      hre.names.internal.seniorage,
      { from: deployer, log: true },
      'setPulse',
      pulseAddress
    );

    await execute(
      hre.names.internal.seniorage,
      { from: deployer, log: true },
      'setLunchBox',
      lunchBoxAddress
    );

    await execute(
      hre.names.internal.seniorage,
      { from: deployer, log: true },
      'grantRole',
      keccak256("AUTHORITY_ROLE"),
      authority
    );

    await execute(
      hre.names.internal.seniorage,
      { from: deployer, log: true },
      'configureWallets',
      bdmWallet,
      crmWallet,
      devManagerWallet,
      marketingManagerWallet,
      devWallet,
      marketingFundWallet,
      situationalFundWallet,
      multisigWallet
    );

    await execute(
      hre.names.internal.investmentSystemDistributor,
      { from: deployer, log: true },
      'configure',
      snacksPoolAddress,
      lunchBoxAddress,
      idoDistributorAddress,
      idoFactoryAddress,
      authority
    );

    await execute(
      hre.names.internal.iDOFactory,
      { from: deployer, log: true },
      'configure',
      zoinksTokenAddress,
      snacksAddress,
      btcSnacksAddress,
      ethSnacksAddress,
      snacksPoolAddress,
      idoDistributorAddress,
      investmentSystemDistributorAddress,
      idoTokenBytecode,
      idoLunchBoxPoolBytecode,
      idoPoolByteCode
    );

    await execute(
      hre.names.internal.iDODistributor,
      { from: deployer, log: true },
      'configure',
      zoinksTokenAddress,
      btcAddress,
      ethAddress,
      snacksAddress,
      btcSnacksAddress,
      ethSnacksAddress,
      snacksPoolAddress,
      idoFactoryAddress,
      investmentSystemDistributorAddress
    );

    // PAUSE CONFIGURATION

    await execute(
      hre.names.internal.apeSwapPool,
      { from: deployer, log: true },
      'grantRole',
      keccak256("PAUSER_ROLE"),
      systemStopperAddress
    );

    await execute(
      hre.names.internal.biSwapPool,
      { from: deployer, log: true },
      'grantRole',
      keccak256("PAUSER_ROLE"),
      systemStopperAddress
    );

    await execute(
      hre.names.internal.pancakeSwapPool,
      { from: deployer, log: true },
      'grantRole',
      keccak256("PAUSER_ROLE"),
      systemStopperAddress
    );

    await execute(
      hre.names.internal.snacksPool,
      { from: deployer, log: true },
      'grantRole',
      keccak256("PAUSER_ROLE"),
      systemStopperAddress
    );

    await execute(
      hre.names.internal.pulse,
      { from: deployer, log: true },
      'grantRole',
      keccak256("PAUSER_ROLE"),
      systemStopperAddress
    );

    await execute(
      hre.names.internal.seniorage,
      { from: deployer, log: true },
      'grantRole',
      keccak256("PAUSER_ROLE"),
      systemStopperAddress
    );

    await execute(
      hre.names.internal.poolRewardDistributor,
      { from: deployer, log: true },
      'grantRole',
      keccak256("PAUSER_ROLE"),
      systemStopperAddress
    );

    await execute(
      hre.names.internal.holdingFeeDistributor,
      { from: deployer, log: true },
      'grantRole',
      keccak256("PAUSER_ROLE"),
      systemStopperAddress
    );

    await execute(
      hre.names.internal.snacks,
      { from: deployer, log: true },
      'grantRole',
      keccak256("PAUSER_ROLE"),
      systemStopperAddress
    );

    await execute(
      hre.names.internal.zoinks,
      { from: deployer, log: true },
      'grantRole',
      keccak256("PAUSER_ROLE"),
      systemStopperAddress
    );

    await execute(
      hre.names.internal.investmentSystemDistributor,
      { from: deployer, log: true },
      'grantRole',
      keccak256("PAUSER_ROLE"),
      systemStopperAddress
    );
    
    await execute(
      hre.names.internal.systemStopper,
      { from: deployer, log: true },
      'configure',
      pausableContracts
    );
  }