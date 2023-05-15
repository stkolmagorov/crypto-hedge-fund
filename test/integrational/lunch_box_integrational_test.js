const {time} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const {expect} = require("chai");
const hre = require("hardhat");
const {backendCall1224, mintZoinksAndAllSnacks} = require('../../deploy/helpers');
const {ethers, deployments, getNamedAccounts} = hre;
const abiCoder = ethers.utils.defaultAbiCoder;

describe("LunchBox (integrational)", () => {
  let owner;
  let alice;
  let bob;
  let slowpoke;
  let charlie;

  let lunchBox;
  let busd;
  let zoinks;
  let btc;
  let eth;
  let snacks;
  let btcSnacks;
  let ethSnacks;
  let router;
  let snacksPool;
  let poolRewardDistributor;
  let averagePriceOracle;
  let pulse;
  let cakeLpBusdZoinks;
  let pancakeSwapPool;
  let apeSwapPool;
  let biSwapPool;

  beforeEach(async () => {
    await deployments.fixture(['general_test_fixtures']);
    [owner, authority, bob, alice, slowpoke, charlie] = 
      await ethers.getSigners();
    
    lunchBox = await ethers.getContractAt(
      hre.names.internal.lunchBox, 
      (await deployments.get(hre.names.internal.lunchBox)).address
    );
    busd = await ethers.getContractAt(
      hre.names.internal.mockToken,
      (await deployments.get(hre.names.external.tokens.busd)).address
    );
    zoinks = await ethers.getContractAt(
      hre.names.internal.zoinks,
      (await deployments.get(hre.names.internal.zoinks)).address
    );
    btc = await ethers.getContractAt(
      hre.names.internal.mockToken,
      (await deployments.get(hre.names.external.tokens.btc)).address
    );
    eth = await ethers.getContractAt(
      hre.names.internal.mockToken,
      (await deployments.get(hre.names.external.tokens.eth)).address
    );
    snacks = await ethers.getContractAt(
      hre.names.internal.snacks,
      (await deployments.get(hre.names.internal.snacks)).address
    );
    btcSnacks = await ethers.getContractAt(
      hre.names.internal.btcSnacks,
      (await deployments.get(hre.names.internal.btcSnacks)).address
    );
    ethSnacks = await ethers.getContractAt(
      hre.names.internal.ethSnacks,
      (await deployments.get(hre.names.internal.ethSnacks)).address
    );
    router = await ethers.getContractAt(
      hre.names.internal.iRouter,
      (await deployments.get(hre.names.external.routers.pancake)).address
    );
    cakeLpBusdZoinks = await ethers.getContractAt(
      hre.names.internal.iERC20,
      (await deployments.get(hre.names.external.pairs.pancake.lp)).address
    );
    pulse = await ethers.getContractAt(
      hre.names.internal.pulse,
      (await deployments.get(hre.names.internal.pulse)).address
    );
    seniorage = await ethers.getContractAt(
      hre.names.internal.seniorage,
      (await deployments.get(hre.names.internal.seniorage)).address
    );
    snacksPool = await ethers.getContractAt(
      hre.names.internal.snacksPool,
      (await deployments.get(hre.names.internal.snacksPool)).address
    );
    pancakeSwapPool = await ethers.getContractAt(
      hre.names.internal.pancakeSwapPool,
      (await deployments.get(hre.names.internal.pancakeSwapPool)).address
    );
    apeSwapPool = await ethers.getContractAt(
      hre.names.internal.apeSwapPool,
      (await deployments.get(hre.names.internal.apeSwapPool)).address
    );
    biSwapPool = await ethers.getContractAt(
      hre.names.internal.biSwapPool,
      (await deployments.get(hre.names.internal.biSwapPool)).address
    );
    poolRewardDistributor = await ethers.getContractAt(
      hre.names.internal.poolRewardDistributor,
      (await deployments.get(hre.names.internal.poolRewardDistributor)).address
    );
    averagePriceOracle = await ethers.getContractAt(
      hre.names.internal.averagePriceOracle,
      (await deployments.get(hre.names.internal.averagePriceOracle)).address
    );
  });

  const expectsForBackendCall1124 = async () => {
    const DEAD_ADDRESS = await zoinks.DEAD_ADDRESS();
    return [
      // check inflation on zoinks
      async (applyTwapTx) => {
        if ((await averagePriceOracle.twapLast()).toNumber() == 10000) {
          expect(applyTwapTx).to.emit(zoinks, 'TimeWeightedAveragePrice').withArgs(10000);
          return;
        }
        const expectedEmissionAmount = (await averagePriceOracle.twapLast())
          .sub(10000)
          .mul(await zoinks.totalSupply())
          .div((await zoinks.buffer()).mul(10000));
        
        const zoinksAmountOnPRD = await zoinks.balanceOf(poolRewardDistributor.address);
        expect(zoinksAmountOnPRD).to.be.equal(expectedEmissionAmount.mul(6500).div(10000));
        
        const zoinksAmountOnSeniorage = await zoinks.balanceOf(seniorage.address);
        expect(zoinksAmountOnSeniorage).to.be.equal(expectedEmissionAmount.mul(2000).div(10000));

        const expectedAmountOfSnacksToBuy = expectedEmissionAmount.mul(1500).div(10000);
        const expectedSnacksAmountBought = await snacks.calculateBuyTokenAmountOnMint(expectedAmountOfSnacksToBuy);
        const snacksBoughtForDeadAddress = expectedSnacksAmountBought.mul(6667).div(10000);
        expect(await snacks.balanceOf(DEAD_ADDRESS)).to.be.equal(snacksBoughtForDeadAddress);
        const snacksBoughtForPulse = expectedSnacksAmountBought.mul(3333).div(10000);
        expect(await snacks.balanceOf(pulse.address)).to.be.equal(snacksBoughtForPulse);
        const zoinksAmountStored = await zoinks.zoinksAmountStored();
        expect(zoinksAmountStored).to.be.equal(ethers.constants.Zero);
      },
      
      // check fee distribution for btc snacks on btcSnacks
      {
        before: async () => {
          return {
            undistributedFee: await btcSnacks.balanceOf(btcSnacks.address)
          }
        },
        after: async (distributeFeeBtcSnacksTx, metadata) => {
          if (metadata.undistributedFee.eq(ethers.constants.Zero)) {
            expect(distributeFeeBtcSnacksTx).to.emit(btcSnacks, 'BtcSnacksFeeAdded')
              .withArgs(ethers.constants.Zero);
            return;
          }

          const expectedDistributedAmountToSnacks = metadata.undistributedFee
            .mul(1500).div(10000);
          expect(expectedDistributedAmountToSnacks).to.be.equal(
            await btcSnacks.balanceOf(snacks.address)
          );

          const expectedDistributedAmountToPulse = metadata.undistributedFee
            .mul(1500).div(10000);
          expect(expectedDistributedAmountToPulse).to.be.equal(
            await btcSnacks.balanceOf(pulse.address)
          );

          const expectedDistributedAmountToPRD = metadata.undistributedFee
            .mul(3500).div(10000);
          expect(expectedDistributedAmountToPRD).to.be.equal(
            await btcSnacks.balanceOf(poolRewardDistributor.address)
          );

          const expectedDistributedAmountToSeniorage = metadata.undistributedFee
            .mul(1500).div(10000);
          const expectedRemainderForSeniorage = metadata.undistributedFee
            .sub(expectedDistributedAmountToSnacks)
            .sub(expectedDistributedAmountToPulse)
            .sub(expectedDistributedAmountToPRD)
            .sub(expectedDistributedAmountToSeniorage)
            .div(10);
          expect(expectedDistributedAmountToSeniorage.add(expectedRemainderForSeniorage)).to.be.equal(
            await btcSnacks.balanceOf(seniorage.address)
          );
        }
      },

      // check fee distribution for eth snacks on ethSnacks
      {
        before: async () => {
          return {
            undistributedFee: await ethSnacks.balanceOf(ethSnacks.address)
          }
        },
        after: async (distributeFeeEthSnacksTx, metadata) => {
          // 1500
          // 3500
          // 1500
          if (metadata.undistributedFee.eq(ethers.constants.Zero)) {
            expect(distributeFeeEthSnacksTx).to.emit(ethSnacks, 'EthSnacksFeeAdded')
              .withArgs(ethers.constants.Zero);
            return;
          }

          const expectedDistributedAmountToSnacks = metadata.undistributedFee
            .mul(1500).div(10000);
          expect(expectedDistributedAmountToSnacks).to.be.equal(
            await ethSnacks.balanceOf(snacks.address)
          );

          const expectedDistributedAmountToPulse = metadata.undistributedFee
            .mul(1500).div(10000);
          expect(expectedDistributedAmountToPulse).to.be.equal(
            await ethSnacks.balanceOf(pulse.address)
          );

          const expectedDistributedAmountToPRD = metadata.undistributedFee
            .mul(3500).div(10000);
          expect(expectedDistributedAmountToPRD).to.be.equal(
            await ethSnacks.balanceOf(poolRewardDistributor.address)
          );

          const expectedDistributedAmountToSeniorage = metadata.undistributedFee
            .mul(1500).div(10000);
          const expectedRemainderForSeniorage = metadata.undistributedFee
            .sub(expectedDistributedAmountToSnacks)
            .sub(expectedDistributedAmountToPulse)
            .sub(expectedDistributedAmountToPRD)
            .sub(expectedDistributedAmountToSeniorage)
            .div(10);
          expect(expectedDistributedAmountToSeniorage.add(expectedRemainderForSeniorage)).to.be.equal(
            await ethSnacks.balanceOf(seniorage.address)
          );
        }
      },

      // check fee distribution for snacks on snacks
      {
        before: async () => {
          return {
            undistributedFee: await snacks.balanceOf(ethSnacks.address)
          }
        },
        after: async (distributeFeeSnacksTx, metadata) => {
          // 3500
          // 4500
          // 500
          if (metadata.undistributedFee.eq(ethers.constants.Zero)) {
            expect(distributeFeeSnacksTx).to.emit(snacks, 'RewardForHolders')
              .withArgs(ethers.constants.Zero);
            return;
          }

          const expectedDistributedAmountToPulse = metadata.undistributedFee
            .mul(3500).div(10000);
          expect(expectedDistributedAmountToPulse).to.be.equal(
            await snacks.balanceOf(pulse.address)
          );

          const expectedDistributedAmountToPRD = metadata.undistributedFee
            .mul(4500).div(10000);
          expect(expectedDistributedAmountToPRD).to.be.equal(
            await snacks.balanceOf(poolRewardDistributor.address)
          );

          const expectedDistributedAmountToSeniorage = metadata.undistributedFee
            .mul(500).div(10000);
          const expectedRemainderForSeniorage = metadata.undistributedFee
            .sub(expectedDistributedAmountToPulse)
            .sub(expectedDistributedAmountToPRD)
            .sub(expectedDistributedAmountToSeniorage)
            .div(10);
          expect(expectedDistributedAmountToSeniorage.add(expectedRemainderForSeniorage)).to.be.equal(
            await snacks.balanceOf(seniorage.address)
          );
        }
      },

      // check btcSnacks and ethSnacks distribution on pulse
      {
        before: async () => {
          return {
            btcSnacksBalance: await btcSnacks.balanceOf(pulse.address),
            ethSnacksBalance: await ethSnacks.balanceOf(pulse.address)
          }
        },
        after: async (distributeBtcSnacksAndEthSnacksTx, metadata) => {
          const expectedSeniorageBalanceInBtcSnacks = metadata.btcSnacksBalance.mul(5000).div(10000);
          const expectedSeniorageBalanceInEthSnacks = metadata.ethSnacksBalance.mul(5000).div(10000);
          expect(distributeBtcSnacksAndEthSnacksTx).to.emit(btcSnacks, 'Transfer')
            .withArgs(
              pulse.address,
              seniorage.address,
              expectedSeniorageBalanceInBtcSnacks
            );
          expect(distributeBtcSnacksAndEthSnacksTx).to.emit(ethSnacks, 'Transfer')
            .withArgs(
              pulse.address,
              seniorage.address,
              expectedSeniorageBalanceInEthSnacks
            );
        }
      },

      // check liquidity provision on seniorage
      async (provideLiquidityTx) => {
        const expectedPulseBalance = ethers.BigNumber.from('1590900292001731624994');
        expect(await seniorage.busdAmountStored()).to.be.equal(
          ethers.constants.Zero
        );
        expect(provideLiquidityTx).to.emit(cakeLpBusdZoinks, 'Transfer')
          .withArgs(
            seniorage.address,
            pulse.address,
            expectedPulseBalance
          );
      },

      // check distribution of non busd on seniorage
      {
        before: async () => {
          const tokens = [
            zoinks,
            btc,
            eth,
            snacks,
            ethSnacks,
            btcSnacks
          ];
          const tokensAndBalances = [];
          for (const token of tokens) {
            tokensAndBalances.push({
              tokenBalance: await token.balanceOf(seniorage.address),
              token
            });
          }
          const zoinksAmountStored = await seniorage.zoinksAmountStored();
          const btcAmountStored = await seniorage.btcAmountStored();
          const ethAmountStored = await seniorage.ethAmountStored();
          return { tokensAndBalances, zoinksAmountStored, btcAmountStored, ethAmountStored };
        },
        after: async (distributeNonBusdCurrenciesTx, metadata) => {
          const bdmWallet = await seniorage.bdmWallet();
          const crmWallet = await seniorage.crmWallet();
          const devManagerWallet = await seniorage.devManagerWallet();
          const marketingManagerWallet = await seniorage.marketingManagerWallet();
          const devWallet = await seniorage.devWallet();
          const marketingFundWallet = await seniorage.marketingFundWallet();
          const situationalFundWallet = await seniorage.situationalFundWallet();
          
          const BDM_WALLET_PERCENT = 500;
          const CRM_WALLET_PERCENT = 500;
          const DEV_MANAGER_WALLET_PERCENT = 500;
          const MARKETING_MANAGER_WALLET_PERCENT = 500;
          const DEV_WALLET_PERCENT = 1000;
          const SITUATIONAL_FUND_WALLET_PERCENT = 1500;
          const MARKETING_FUND_WALLET_PERCENT = 2000;
          
          for (const tokenAndTokenBalance of metadata.tokensAndBalances) {
            if (tokenAndTokenBalance.tokenBalance.eq(ethers.constants.Zero)) continue;
            expect(distributeNonBusdCurrenciesTx).to.emit(
              tokenAndTokenBalance.token,
              'Transfer'
            ).withArgs(
              seniorage.address,
              bdmWallet,
              tokenAndTokenBalance.tokenBalance.mul(BDM_WALLET_PERCENT).div(10000)
            );
  
            expect(distributeNonBusdCurrenciesTx).to.emit(
              tokenAndTokenBalance.token,
              'Transfer'
            ).withArgs(
              seniorage.address,
              crmWallet,
              tokenAndTokenBalance.tokenBalance.mul(CRM_WALLET_PERCENT).div(10000)
            );
  
            expect(distributeNonBusdCurrenciesTx).to.emit(
              tokenAndTokenBalance.token,
              'Transfer'
            ).withArgs(
              seniorage.address,
              devManagerWallet,
              tokenAndTokenBalance.tokenBalance.mul(DEV_MANAGER_WALLET_PERCENT).div(10000)
            );
  
            expect(distributeNonBusdCurrenciesTx).to.emit(
              tokenAndTokenBalance.token,
              'Transfer'
            ).withArgs(
              seniorage.address,
              marketingManagerWallet,
              tokenAndTokenBalance.tokenBalance.mul(MARKETING_MANAGER_WALLET_PERCENT).div(10000)
            );
  
            expect(distributeNonBusdCurrenciesTx).to.emit(
              tokenAndTokenBalance.token,
              'Transfer'
            ).withArgs(
              seniorage.address,
              devWallet,
              tokenAndTokenBalance.tokenBalance.mul(DEV_WALLET_PERCENT).div(10000)
            );
  
            expect(distributeNonBusdCurrenciesTx).to.emit(
              tokenAndTokenBalance.token,
              'Transfer'
            ).withArgs(
              seniorage.address,
              marketingFundWallet,
              tokenAndTokenBalance.tokenBalance.mul(MARKETING_FUND_WALLET_PERCENT).div(10000)
            );
  
            expect(distributeNonBusdCurrenciesTx).to.emit(
              tokenAndTokenBalance.token,
              'Transfer'
            ).withArgs(
              seniorage.address,
              situationalFundWallet,
              tokenAndTokenBalance.tokenBalance.mul(SITUATIONAL_FUND_WALLET_PERCENT).div(10000)
            );
          }
  
          expect(distributeNonBusdCurrenciesTx).to.emit(
            zoinks,
            'Transfer'
          ).withArgs(
            seniorage.address,
            lunchBox.address,
            metadata.tokensAndBalances[0].tokenBalance.sub(metadata.zoinksAmountStored)
          );
          expect(distributeNonBusdCurrenciesTx).to.emit(
            btc,
            'Transfer'
          ).withArgs(
            seniorage.address,
            lunchBox.address,
            metadata.tokensAndBalances[1].tokenBalance.sub(metadata.btcAmountStored)
          );
          expect(distributeNonBusdCurrenciesTx).to.emit(
            eth,
            'Transfer'
          ).withArgs(
            seniorage.address,
            lunchBox.address,
            metadata.tokensAndBalances[2].tokenBalance.sub(metadata.ethAmountStored)
          );

          expect(distributeNonBusdCurrenciesTx).to.emit(lunchBox, 'Staked')
            .withArgs(seniorage.address, (busdAmount) => busdAmount.gt(ethers.constants.Zero));
        }
      },

      // check distribution of busd on seniorage
      {
        before: async () => {
          return {
            busdBalance: (await busd.balanceOf(seniorage.address))
              .sub(await seniorage.busdAmountStored()),
            btcAmountStored: await seniorage.btcAmountStored(),
            ethAmountStored: await seniorage.ethAmountStored(),
            zoinksAmountStored: await seniorage.zoinksAmountStored(),
            busdAmountStored: await seniorage.busdAmountStored()
          }
        },
        after: async (distributeBusdTx, metadata) => {
          const SWAP_ON_BTC_PERCENT = 400;
          const SWAP_ON_ETH_PERCENT = 400;
          const BTC_SNACKS_PULSE_PERCENT = 5000;
          const ETH_SNACKS_PULSE_PERCENT = 5000;
          const SWAP_ON_ZOINKS_PERCENT = 200;
          const ADD_LIQUIDITY_PERCENT = 1500;
          const LUNCH_BOX_PERCENT = 4500;
          const MULTISIG_WALLET_PERCENT = 3000;
          
          const path = [busd.address, btc.address];
          const expectedBusdBtcSwap = await router.getAmountsOut(
            metadata.busdBalance.mul(SWAP_ON_BTC_PERCENT).div(10000),
            path
          );
          const expectedBtcSnacksMinted = await btcSnacks.calculateBuyTokenAmountOnMint(
            expectedBusdBtcSwap[1].add(metadata.btcAmountStored)
          );
          expect(distributeBusdTx).to.emit(
            btcSnacks,
            'Transfer'
          ).withArgs(
            seniorage.address, 
            pulse.address,
            expectedBtcSnacksMinted.mul(BTC_SNACKS_PULSE_PERCENT).div(10000)
          );

          path[1] = eth.address;
          const expectedBusdEthSwap = await router.getAmountsOut(
            metadata.busdBalance.mul(SWAP_ON_ETH_PERCENT).div(10000),
            path
          );
          const expectedEthSnacksMinted = await ethSnacks.calculateBuyTokenAmountOnMint(
            expectedBusdEthSwap[1].add(metadata.ethAmountStored)
          );
          expect(distributeBusdTx).to.emit(
            btcSnacks,
            'Transfer'
          ).withArgs(
            seniorage.address, 
            pulse.address,
            expectedEthSnacksMinted.mul(ETH_SNACKS_PULSE_PERCENT).div(10000)
          );

          path[1] = zoinks.address;
          const expectedBusdZoinksSwap = await router.getAmountsOut(
            metadata.busdBalance.mul(SWAP_ON_ZOINKS_PERCENT).div(10000),
            path
          );
          const expectedSnacksMinted = await snacks.calculateBuyTokenAmountOnMint(
            expectedBusdZoinksSwap[1].add(metadata.zoinksAmountStored)
          );
          expect(distributeBusdTx).to.emit(
            btcSnacks,
            'Transfer'
          ).withArgs(
            seniorage.address, 
            pulse.address,
            expectedSnacksMinted
          );

          expect(await seniorage.busdAmountStored()).to.be.equal(
            metadata.busdBalance.mul(ADD_LIQUIDITY_PERCENT).div(10000)
          );

          expect(await busd.balanceOf(await seniorage.multisigWallet()))
            .to.be.equal(metadata.busdBalance.mul(MULTISIG_WALLET_PERCENT).div(10000));

          expect(distributeBusdTx).to.emit(lunchBox, 'Staked').withArgs(seniorage.address, 
            metadata.busdBalance.mul(LUNCH_BOX_PERCENT).div(10000));
        }
      },

      // check harvest on pulse
      async (harvestTx) => {
        expect(harvestTx).to.emit(pancakeSwapPool, 'RewardPaid')
          .withArgs(anyValue, pulse.address, reward => reward.gt(ethers.constants.Zero));
        expect(harvestTx).to.emit(snacksPool, 'RewardPaid')
          .withArgs(anyValue, pulse.address, reward => reward.gt(ethers.constants.Zero));
      },

      // check distribute snacks on pulse
      {
        before: async () => {
          return {
            snacksBalance: await snacks.balanceOf(pulse.address)
          };
        },
        after: async (distributeSnacksTx, metadata) => {
          const SNACKS_DISTRIBUTION_PERCENT = 1000;
          const expectedAmountToStake = await snacks.calculatePayTokenAmountOnRedeem(
            metadata.snacksBalance.mul(SNACKS_DISTRIBUTION_PERCENT).div(10000)
          );
          expect(distributeSnacksTx).to.emit(
            snacksPool,
            'Staked'
          ).withArgs(pulse.address, expectedAmountToStake);
        }
      },

      // check distribute zoinks on pulse
      {
        before: async () => {
          return {
            zoinksBalance: await zoinks.balanceOf(pulse.address),
            cakeLpBusdZoinksBalance: await cakeLpBusdZoinks.balanceOf(pulse.address)
          };
        },
        after: async (distributeZoinksTx, metadata) => {
          const ZOINKS_DISTRIBUTION_PERCENT = 1000;
          const expectedAmountMinted = await snacks.calculateBuyTokenAmountOnMint(
            metadata.zoinksBalance.mul(ZOINKS_DISTRIBUTION_PERCENT).div(10000)
          );
          expect(distributeZoinksTx).to.emit(snacks, 'Buy')
            .withArgs(
              pulse.address, 
              anyValue, 
              expectedAmountMinted,
              anyValue,
              anyValue,
              anyValue 
            );
          expect(distributeZoinksTx).to.emit(
            pancakeSwapPool,
            'Staked'
          ).withArgs(pulse.address, metadata.cakeLpBusdZoinksBalance);
        }
      },

      // check distribute rewards on PRD
      {
        before: async () => {
          return {
            zoinksBalance: await zoinks.balanceOf(poolRewardDistributor.address),
            snacksBalance: await snacks.balanceOf(poolRewardDistributor.address),
            btcSnacksBalance: await btcSnacks.balanceOf(poolRewardDistributor.address),
            ethSnacksBalance: await ethSnacks.balanceOf(poolRewardDistributor.address),
            busdBalance: await busd.balanceOf(poolRewardDistributor.address)
          };
        },
        after: async (distributeRewardsTx, metadata) => {
          const SENIORAGE_FEE_PERCENT = 1000;
          const ZOINKS_APE_SWAP_POOL_PERCENT = 2308;
          const ZOINKS_BI_SWAP_POOL_PERCENT = 2308;
          const ZOINKS_PANCAKE_SWAP_POOL_PERCENT = 5384;
          const SNACKS_PANCAKE_SWAP_POOL_PERCENT = 6667;
          const SNACKS_SNACKS_POOL_PERCENT = 3333;
          const BTC_SNACKS_PANCAKE_SWAP_POOL_PERCENT = 5714;
          const BTC_SNACKS_SNACKS_POOL_PERCENT = 4286;
          const ETH_SNACKS_PANCAKE_SWAP_POOL_PERCENT = 5714;
          const ETH_SNACKS_SNACKS_POOL_PERCENT = 4286;
          
          const expectedSeniorageFeeAmountZoinks = metadata.zoinksBalance
            .mul(SENIORAGE_FEE_PERCENT).div(10000);
          expect(distributeRewardsTx).to.emit(
            zoinks,
            'Transfer'
          ).withArgs(
            poolRewardDistributor.address,
            seniorage.address,
            expectedSeniorageFeeAmountZoinks
          );

          const expectedDistributionAmountZoinks = metadata.zoinksBalance
            .sub(expectedSeniorageFeeAmountZoinks);

          const expectedRewardForApeSwapPoolZoinks = expectedDistributionAmountZoinks
            .mul(ZOINKS_APE_SWAP_POOL_PERCENT).div(10000);
          expect(distributeRewardsTx).to.emit(
            zoinks,
            'Transfer'
          ).withArgs(
            poolRewardDistributor.address,
            apeSwapPool.address,
            expectedRewardForApeSwapPoolZoinks
          );

          const expectedRewardForBiSwapPoolZoinks = expectedDistributionAmountZoinks
            .mul(ZOINKS_BI_SWAP_POOL_PERCENT).div(10000);
          expect(distributeRewardsTx).to.emit(
            zoinks,
            'Transfer'
          ).withArgs(
            poolRewardDistributor.address,
            biSwapPool.address,
            expectedRewardForBiSwapPoolZoinks
          );

          const expectedRewardForPancakeSwapPoolZoinks = expectedDistributionAmountZoinks
            .mul(ZOINKS_PANCAKE_SWAP_POOL_PERCENT).div(10000);
          expect(distributeRewardsTx).to.emit(
            zoinks,
            'Transfer'
          ).withArgs(
            poolRewardDistributor.address,
            pancakeSwapPool.address,
            expectedRewardForPancakeSwapPoolZoinks
          );

          const expectedSeniorageFeeAmountSnacks = metadata.snacksBalance
            .mul(SENIORAGE_FEE_PERCENT).div(10000);
          expect(distributeRewardsTx).to.emit(
            snacks,
            'Transfer'
          ).withArgs(
            poolRewardDistributor.address, 
            seniorage.address,
            expectedSeniorageFeeAmountSnacks
          );

          const expectedDistributionAmountSnacks = metadata.snacksBalance
            .sub(expectedSeniorageFeeAmountSnacks);

          const expectedRewardForPancakeSwapPoolSnacks = expectedDistributionAmountSnacks
            .mul(SNACKS_PANCAKE_SWAP_POOL_PERCENT).div(10000);
          expect(distributeRewardsTx).to.emit(
            snacks,
            'Transfer'
          ).withArgs(
            poolRewardDistributor.address,
            pancakeSwapPool.address,
            expectedRewardForPancakeSwapPoolSnacks
          );

          const expectedRewardForSnacksPoolSnacks = expectedDistributionAmountSnacks
            .mul(SNACKS_SNACKS_POOL_PERCENT).div(10000);
          expect(distributeRewardsTx).to.emit(
            snacks,
            'Transfer'
          ).withArgs(
            poolRewardDistributor.address,
            snacksPool.address,
            expectedRewardForSnacksPoolSnacks
          );

          const expectedSeniorageFeeAmountBtcSnacks = metadata.btcSnacksBalance
            .mul(SENIORAGE_FEE_PERCENT).div(10000);
          expect(distributeRewardsTx).to.emit(
            btcSnacks,
            'Transfer'
          ).withArgs(
            poolRewardDistributor.address, 
            seniorage.address,
            expectedSeniorageFeeAmountBtcSnacks
          );

          const expectedDistributionAmountBtcSnacks = metadata.btcSnacksBalance
            .sub(expectedSeniorageFeeAmountBtcSnacks);

          const expectedRewardForPancakeSwapPoolBtcSnacks = expectedDistributionAmountBtcSnacks
            .mul(BTC_SNACKS_PANCAKE_SWAP_POOL_PERCENT).div(10000);
          expect(distributeRewardsTx).to.emit(
            btcSnacks,
            'Transfer'
          ).withArgs(
            poolRewardDistributor.address,
            pancakeSwapPool.address,
            expectedRewardForPancakeSwapPoolBtcSnacks
          );

          const expectedRewardForSnacksPoolBtcSnacks = expectedDistributionAmountBtcSnacks
            .mul(BTC_SNACKS_SNACKS_POOL_PERCENT).div(10000);
          expect(distributeRewardsTx).to.emit(
            btcSnacks,
            'Transfer'
          ).withArgs(
            poolRewardDistributor.address,
            snacksPool.address,
            expectedRewardForSnacksPoolBtcSnacks
          );

          const expectedSeniorageFeeAmountEthSnacks = metadata.ethSnacksBalance
            .mul(SENIORAGE_FEE_PERCENT).div(10000);
          expect(distributeRewardsTx).to.emit(
            ethSnacks,
            'Transfer'
          ).withArgs(
            poolRewardDistributor.address, 
            seniorage.address,
            expectedSeniorageFeeAmountEthSnacks
          );

          const expectedDistributionAmountEthSnacks = metadata.btcSnacksBalance
            .sub(expectedSeniorageFeeAmountEthSnacks);

          const expectedRewardForPancakeSwapPoolEthSnacks = expectedDistributionAmountEthSnacks
            .mul(ETH_SNACKS_PANCAKE_SWAP_POOL_PERCENT).div(10000);
          expect(distributeRewardsTx).to.emit(
            ethSnacks,
            'Transfer'
          ).withArgs(
            poolRewardDistributor.address,
            pancakeSwapPool.address,
            expectedRewardForPancakeSwapPoolEthSnacks
          );

          const expectedRewardForSnacksPoolEthSnacks = expectedDistributionAmountEthSnacks
            .mul(ETH_SNACKS_SNACKS_POOL_PERCENT).div(10000);
          expect(distributeRewardsTx).to.emit(
            ethSnacks,
            'Transfer'
          ).withArgs(
            poolRewardDistributor.address,
            snacksPool.address,
            expectedRewardForSnacksPoolEthSnacks
          );

          const expectedSeniorageFeeAmountBusd = metadata.busdBalance
            .mul(SENIORAGE_FEE_PERCENT).div(10000);
          expect(distributeRewardsTx).to.emit(
            busd,
            'Transfer'
          ).withArgs(
            poolRewardDistributor.address,
            seniorage.address,
            expectedSeniorageFeeAmountBusd
          );

          const expectedDistributionAmountBusd = metadata.busdBalance
            .sub(expectedSeniorageFeeAmountBusd);

          const path = [busd.address, zoinks.address];
          const expectedBusdZoinksSwap = await router.getAmountsOut(
            expectedDistributionAmountBusd,
            path
          );
          const expectedSnacksMinted = await snacks
            .calculateBuyTokenAmountOnMint(expectedBusdZoinksSwap[1]);
          expect(distributeRewardsTx).to.emit(
            snacks,
            'Transfer'
          ).withArgs(
            poolRewardDistributor.address,
            lunchBox.address,
            expectedSnacksMinted
          );
        }
      },

      // check rewards delivery on LunchBox
      {
        before: async () => {
          return {
            busdBalance: await busd.balanceOf(lunchBox.address)
          };
        }, 
        after: async (
          deliverRewardsForAllLunchBoxParticipantsTx,
          totalRewardAmountForParticipantsInSnacks,
          totalRewardAmountForParticipantsInBtcSnacks,
          totalRewardAmountForParticipantsInEthSnacks,
          metadata
        ) => {
          expect(deliverRewardsForAllLunchBoxParticipantsTx)
            .to.emit(
              snacksPool,
              'RewardsDelivered'
            ).withArgs(
              totalRewardAmountForParticipantsInSnacks,
              totalRewardAmountForParticipantsInBtcSnacks,
              totalRewardAmountForParticipantsInEthSnacks,
              anyValue,
              anyValue,
              anyValue
            );
          
          if (
            totalRewardAmountForParticipantsInSnacks.lte(ethers.constants.Zero)
            && totalRewardAmountForParticipantsInBtcSnacks.lte(ethers.constants.Zero)
            && totalRewardAmountForParticipantsInEthSnacks.lte(ethers.constants.Zero)
            ) {
            return;
          }
          
          const path = [zoinks.address, busd.address];
          const expectedRedeemedZoinks = await snacks.calculatePayTokenAmountOnRedeem(
            totalRewardAmountForParticipantsInSnacks
          );
          const expectedBusdFromZoinks = await router.getAmountsOut(
            expectedRedeemedZoinks,
            path
          );
  
          path[0] = btc.address;
          const expectedRedeemedBtc = await btcSnacks.calculatePayTokenAmountOnRedeem(
            totalRewardAmountForParticipantsInBtcSnacks
          );
          const expectedBusdFromBtc = await router.getAmountsOut(
            expectedRedeemedBtc,
            path
          );
  
          path[0] = eth.address;
          const expectedRedeemedEth = await ethSnacks.calculatePayTokenAmountOnRedeem(
            totalRewardAmountForParticipantsInEthSnacks
          );
          const expectedBusdFromEth = await router.getAmountsOut(
            expectedRedeemedEth,
            path
          );
  
          expect(deliverRewardsForAllLunchBoxParticipantsTx).to.emit(
            busd,
            'Transfer'
          ).withArgs(
            lunchBox.address,
            anyValue,
            amount => metadata.busdBalance.gt(amount)
          );
  
          expect(deliverRewardsForAllLunchBoxParticipantsTx).to.emit(
            lunchBox,
            'Staked'
          ).withArgs(
            snacksPool.address,
            metadata.busdBalance
              .add(expectedBusdFromEth)
              .add(expectedBusdFromBtc)
              .add(expectedBusdFromZoinks)
          );
        }
      }
    ];
  }

  it('should calculate distributed rewards successfully', async () => {
    const totalAmount = ethers.utils.parseEther('100');
    await mintZoinksAndAllSnacks(deployments, owner, totalAmount, alice);
    await mintZoinksAndAllSnacks(deployments, owner, totalAmount, bob);
    await mintZoinksAndAllSnacks(deployments, owner, totalAmount, slowpoke);
    await mintZoinksAndAllSnacks(deployments, owner, totalAmount, charlie);

    await snacks.connect(alice).approve(snacksPool.address, totalAmount);
    await snacksPool.connect(alice).stake(totalAmount);

    await snacks.connect(bob).approve(snacksPool.address, totalAmount);
    await snacksPool.connect(bob).stake(totalAmount);

    await snacks.connect(slowpoke).approve(snacksPool.address, totalAmount);
    await snacksPool.connect(slowpoke).stake(totalAmount);

    await snacks.connect(charlie).approve(snacksPool.address, totalAmount);
    await snacksPool.connect(charlie).stake(totalAmount);

    const lunchBoxTotalReward = ethers.utils.parseEther('1000');
    await busd.mint(poolRewardDistributor.address, lunchBoxTotalReward);

    await time.increase(43201); // 24 h

    await backendCall1224(hre, await expectsForBackendCall1124());
    const data = abiCoder.encode(
      ["uint", "tuple(uint[], uint[])"],
      [10000, [[], []]]
    );
    await snacksPool.connect(alice).activateInvestmentSystem(data);
    await snacksPool.connect(bob).activateInvestmentSystem(data);
    await snacksPool.connect(slowpoke).activateInvestmentSystem(data);

    await time.increase(43200);

    let aliceEarned = await lunchBox.earned(alice.address); 
    let bobEarned = await lunchBox.earned(bob.address);
    let slowpokeEarned = await lunchBox.earned(slowpoke.address);  
    let charlieEarned = await lunchBox.earned(charlie.address);
    
    let aliceBalance = await snacks.balanceOf(alice.address); 
    let bobBalance = await snacks.balanceOf(bob.address);

    const expectDeltaBalance = async (oldBalance, sender, expectedDeltaValue) => {
      const newBalance = await snacks.balanceOf(sender.address);
      const precision = ethers.utils.parseEther('0.001');
      expect(newBalance.sub(oldBalance)).to.be.closeTo(expectedDeltaValue, precision);
      return newBalance;
    };

    await snacksPool.connect(alice).getReward();
    aliceBalance = await expectDeltaBalance(
      aliceBalance,
      alice,
      aliceEarned
    );
 
    await snacksPool.connect(bob).getReward();
    bobBalance = await expectDeltaBalance(
      bobBalance,
      bob,
      bobEarned
    );

    await time.increase(43200);

    aliceEarned = await lunchBox.earned(alice.address); 
    bobEarned = await lunchBox.earned(bob.address);
    charlieEarned = await lunchBox.earned(charlie.address);
    slowpokeEarned = await lunchBox.earned(slowpoke.address);  
    
    expect(aliceEarned).to.be.equal(ethers.constants.Zero);
    expect(bobEarned).to.be.equal(ethers.constants.Zero);
    expect(charlieEarned).to.be.equal(ethers.constants.Zero);
    expect(slowpokeEarned).to.be.gt(ethers.constants.Zero);

    await busd.mint(poolRewardDistributor.address, lunchBoxTotalReward);
    await backendCall1224(hre);
    await snacksPool.connect(charlie).activateInvestmentSystem(data);
    await time.increase(43200);

    const newAliceEarned = await lunchBox.earned(alice.address); 
    const newBobEarned = await lunchBox.earned(bob.address);
    const newCharlieEarned = await lunchBox.earned(charlie.address);
    const newSlowpokeEarned = await lunchBox.earned(slowpoke.address);

    expect(aliceEarned).to.be.lt(newAliceEarned);
    expect(bobEarned).to.be.lt(newBobEarned);
    expect(charlieEarned).to.be.lt(newCharlieEarned);
    expect(slowpokeEarned).to.be.lt(newSlowpokeEarned);
  });
});