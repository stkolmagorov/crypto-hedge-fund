const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, deployments, getNamedAccounts } = hre;
const { mintZoinksAndAllSnacks, mockSwaps } = require("../deploy/helpers");

describe("PoolRewardDistributor", () => {

  let poolRewardDistributor; 
  let busd;
  let zoinks;
  let snacks;
  let ethSnacks;
  let btcSnacks;
  let seniorage;
  let pancakeSwapPool;
  let biSwapPool;
  let apeSwapPool;
  let snacksPool;
  let lunchBox;

  let deployer;
  let authority;

  beforeEach(async () => {
    await deployments.fixture(['debug']);
    [deployer, authority, alice] = await ethers.getSigners();

    poolRewardDistributor = await ethers.getContractAt(
      hre.names.internal.poolRewardDistributor,
      (await deployments.get(hre.names.internal.poolRewardDistributor)).address
    );
    busd = await ethers.getContractAt(
      hre.names.internal.mockToken,
      (await deployments.get(hre.names.external.tokens.busd)).address
    );
    zoinks = await ethers.getContractAt(
      hre.names.internal.zoinks,
      (await deployments.get(hre.names.internal.zoinks)).address
    );
    snacks = await ethers.getContractAt(
      hre.names.internal.snacks,
      (await deployments.get(hre.names.internal.snacks)).address
    );
    ethSnacks = await ethers.getContractAt(
      hre.names.internal.ethSnacks,
      (await deployments.get(hre.names.internal.ethSnacks)).address
    );
    btcSnacks = await ethers.getContractAt(
      hre.names.internal.btcSnacks,
      (await deployments.get(hre.names.internal.btcSnacks)).address
    );
    seniorage = await ethers.getContractAt(
      hre.names.internal.seniorage,
      (await deployments.get(hre.names.internal.seniorage)).address
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
    snacksPool = await ethers.getContractAt(
      hre.names.internal.snacksPool,
      (await deployments.get(hre.names.internal.snacksPool)).address
    );
    lunchBox = await ethers.getContractAt(
      hre.names.internal.lunchBox,
      (await deployments.get(hre.names.internal.lunchBox)).address
    );
  });

  it("Successful configure()", async() => {
    await expect(poolRewardDistributor.connect(authority).configure(
        zoinks.address,
        snacks.address,
        btcSnacks.address,
        ethSnacks.address,
        apeSwapPool.address,
        biSwapPool.address,
        pancakeSwapPool.address,
        snacksPool.address,
        lunchBox.address,
        seniorage.address,
        authority.address
    )).to.be.reverted;
    await expect(poolRewardDistributor.connect(deployer).configure(
      zoinks.address,
      snacks.address,
      btcSnacks.address,
      ethSnacks.address,
      apeSwapPool.address,
      biSwapPool.address,
      pancakeSwapPool.address,
      snacksPool.address,
      lunchBox.address,
      seniorage.address,
      authority.address
    ))
});

  it('Should pause the contract', async () => {
    await poolRewardDistributor.pause();
    expect(await poolRewardDistributor.paused()).to.be.true;
    await expect(poolRewardDistributor.distributeRewards(0))
      .to.be.revertedWith("Pausable: paused");
    await expect(poolRewardDistributor.connect(alice).pause())
      .to.be.reverted;
  });

  it('Should unpause the contract', async () => {
    await expect(poolRewardDistributor.unpause()).to.be.revertedWith("Pausable: not paused");
    await poolRewardDistributor.pause();
    await poolRewardDistributor.unpause();
    expect(await poolRewardDistributor.paused()).to.be.false;
  });

  it('Should fail if executed not by authority', async () => {
    await expect(poolRewardDistributor.distributeRewards(0)).to.be.reverted;
  });

  it('Should perform distributeRewards', async () => {
    const BASE_PERCENT = 10000;
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

    const totalAmountToMintOfAll = ethers.utils.parseEther('1');
    
    await mintZoinksAndAllSnacks(
      deployments, deployer, totalAmountToMintOfAll, poolRewardDistributor
    );

    let zoinksBalance = await zoinks.balanceOf(poolRewardDistributor.address);
    let snacksBalance = await snacks.balanceOf(poolRewardDistributor.address);
    let btcSnacksBalance = await btcSnacks.balanceOf(poolRewardDistributor.address);
    let ethSnacksBalance = await ethSnacks.balanceOf(poolRewardDistributor.address);

    await poolRewardDistributor.connect(authority).distributeRewards(0);

    zoinksBalance = zoinksBalance.sub(await zoinks.balanceOf(poolRewardDistributor.address));
    snacksBalance = snacksBalance.sub(await snacks.balanceOf(poolRewardDistributor.address));
    btcSnacksBalance = btcSnacksBalance.sub(await btcSnacks.balanceOf(poolRewardDistributor.address));
    ethSnacksBalance = ethSnacksBalance.sub(await ethSnacks.balanceOf(poolRewardDistributor.address));

    const expectBalances = async (
      token,
      expectedBalancesDictionary
    ) => {
      if (expectedBalancesDictionary.expectedSeniorageBalance) {
        expect(await token.balanceOf(seniorage.address), `Error at 1 expect with ${await token.name()}`)
          .to.be.equal(expectedBalancesDictionary.expectedSeniorageBalance);
      }
      if (expectedBalancesDictionary.expectedApeSwapPoolBalance) {
        expect(await token.balanceOf(apeSwapPool.address), `Error at 2 expect with ${await token.name()}`)
          .to.be.equal(expectedBalancesDictionary.expectedApeSwapPoolBalance);
      }
      if (expectedBalancesDictionary.expectedBiSwapPoolBalance) {
        expect(await token.balanceOf(biSwapPool.address), `Error at 3 expect with ${await token.name()}`)
          .to.be.equal(expectedBalancesDictionary.expectedBiSwapPoolBalance);
      }
      if (expectedBalancesDictionary.expectedPancakeSwapPoolBalance) {
        expect(await token.balanceOf(pancakeSwapPool.address), `Error at 4 expect with ${await token.name()}`)
          .to.be.equal(expectedBalancesDictionary.expectedPancakeSwapPoolBalance);
      }
      if (expectedBalancesDictionary.expectedSnacksPoolBalance) {
        expect(await token.balanceOf(snacksPool.address), `Error at 4 expect with ${await token.name()}`)
          .to.be.equal(expectedBalancesDictionary.expectedSnacksPoolBalance);
      }
      if (expectedBalancesDictionary.expectedLunchBoxBalance) {
        expect(await token.balanceOf(lunchBox.address), `Error at 5 expect with ${await token.name()}`)
          .to.be.equal(expectedBalancesDictionary.expectedLunchBoxBalance);
      }
    }

    const seniorageFeeAmountZoinks = zoinksBalance.mul(SENIORAGE_FEE_PERCENT).div(BASE_PERCENT);
    const distributionAmountZoinks = zoinksBalance.sub(seniorageFeeAmountZoinks);
    await expectBalances(
      zoinks,
      {
        expectedSeniorageBalance: seniorageFeeAmountZoinks,
        expectedApeSwapPoolBalance: distributionAmountZoinks.mul(ZOINKS_APE_SWAP_POOL_PERCENT).div(BASE_PERCENT),
        expectedBiSwapPoolBalance: distributionAmountZoinks.mul(ZOINKS_BI_SWAP_POOL_PERCENT).div(BASE_PERCENT),
        expectedPancakeSwapPoolBalance: distributionAmountZoinks.mul(ZOINKS_PANCAKE_SWAP_POOL_PERCENT).div(BASE_PERCENT)
      }
    );

    const seniorageFeeSnacks = snacksBalance.mul(SENIORAGE_FEE_PERCENT).div(BASE_PERCENT);
    const distributionAmountSnacks = snacksBalance.sub(seniorageFeeSnacks);
    await expectBalances(
      snacks,
      {
        expectedSeniorageBalance: seniorageFeeSnacks,
        expectedPancakeSwapPoolBalance: distributionAmountSnacks.mul(SNACKS_PANCAKE_SWAP_POOL_PERCENT).div(BASE_PERCENT),
        expectedSnacksPoolBalance: distributionAmountSnacks.mul(SNACKS_SNACKS_POOL_PERCENT).div(BASE_PERCENT)
      }
    );

    const seniorageFeeBtcSnacks = btcSnacksBalance.mul(SENIORAGE_FEE_PERCENT).div(BASE_PERCENT);
    const distributionAmountBtcSnacks = btcSnacksBalance.sub(seniorageFeeBtcSnacks);
    await expectBalances(
      btcSnacks,
      {
        expectedSeniorageBalance: seniorageFeeBtcSnacks,
        expectedPancakeSwapPoolBalance: distributionAmountBtcSnacks.mul(BTC_SNACKS_PANCAKE_SWAP_POOL_PERCENT).div(BASE_PERCENT),
        expectedSnacksPoolBalance: distributionAmountBtcSnacks.mul(BTC_SNACKS_SNACKS_POOL_PERCENT).div(BASE_PERCENT)
      }
    );

    const seniorageFeeEthSnacks = ethSnacksBalance.mul(SENIORAGE_FEE_PERCENT).div(BASE_PERCENT);
    const distributionAmountEthSnacks = ethSnacksBalance.sub(seniorageFeeEthSnacks);
    await expectBalances(
      ethSnacks,
      {
        expectedSeniorageBalance: seniorageFeeEthSnacks,
        expectedPancakeSwapPoolBalance: distributionAmountEthSnacks.mul(ETH_SNACKS_PANCAKE_SWAP_POOL_PERCENT).div(BASE_PERCENT),
        expectedSnacksPoolBalance: distributionAmountEthSnacks.mul(ETH_SNACKS_SNACKS_POOL_PERCENT).div(BASE_PERCENT)
      }
    );

    // Without any tokens
    await poolRewardDistributor.connect(authority).distributeRewards(0);
  });
});
