const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, deployments, getNamedAccounts } = hre;
const {
  mockedLiquidity,
  mockedResultOfSwap,
  ZERO_ADDRESS,
  ZERO,
  withImpersonatedSigner,
  mintNativeTokens
} = require("../deploy/helpers");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Pulse", () => {

    let deployer;
    let owner;
    let bob;
    let seniorage;
    let busd;
    let btc;
    let eth;
    let zoinks;
    let snacksPool;
    let pulse;
    let router;
    let snacks;
    let ethSnacks;
    let btcSnacks;
    let pancakeSwapPool;
    let poolRewardDistributor;

    const amountToBuy = ethers.utils.parseEther("10000");
    const amountToTransfer = ethers.utils.parseEther('1000');

    beforeEach(async () => {
      await deployments.fixture(['pulse_test_fixtures']);
      [deployer, authority, bob] = await ethers.getSigners();
      owner = deployer;

      poolRewardDistributor = await ethers.getContractAt(
        hre.names.internal.poolRewardDistributor,
        (await deployments.get(hre.names.internal.poolRewardDistributor)).address
      );
      seniorage = await ethers.getContractAt(
        hre.names.internal.seniorage,
        (await deployments.get(hre.names.internal.seniorage)).address
      );
      zoinks = await ethers.getContractAt(
        hre.names.internal.zoinks,
        (await deployments.get(hre.names.internal.zoinks)).address
      );
      pancakeSwapPool = await ethers.getContractAt(
        hre.names.internal.pancakeSwapPool,
        (await deployments.get(hre.names.internal.pancakeSwapPool)).address
      );
      busd = await ethers.getContractAt(
        hre.names.internal.mockToken,
        (await deployments.get(hre.names.external.tokens.busd)).address
      );
      eth = await ethers.getContractAt(
        hre.names.internal.mockToken,
        (await deployments.get(hre.names.external.tokens.eth)).address
      );
      btc = await ethers.getContractAt(
        hre.names.internal.mockToken,
        (await deployments.get(hre.names.external.tokens.btc)).address
      );
      router = await ethers.getContractAt(
        hre.names.internal.iRouter,
        (await deployments.get(hre.names.external.routers.pancake)).address
      );
      pulse = await ethers.getContractAt(
        hre.names.internal.pulse,
        (await deployments.get(hre.names.internal.pulse)).address
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
      snacksPool = await ethers.getContractAt(
        hre.names.internal.snacksPool,
        (await deployments.get(hre.names.internal.snacksPool)).address
      );
      pairLpToken = await ethers.getContractAt(
        hre.names.internal.mockToken,
        (await deployments.get(hre.names.external.pairs.pancake.lp)).address
      );
      await pairLpToken.mint(pulse.address, mockedLiquidity);
    });

    it("Successful configure() execution", async() => {
      const pairAddress = await pulse.cakeLP();
      await pulse.configure(
        pairAddress,
        zoinks.address,
        snacks.address,
        btcSnacks.address,
        ethSnacks.address,
        pancakeSwapPool.address,
        snacksPool.address,
        seniorage.address,
        deployer.address
      )
    });

    it("Successful distributeBtcSnacksAndEthSnacks() execution", async() => {
      // Only authority check
      await expect(
        pulse.connect(bob).distributeBtcSnacksAndEthSnacks()
      ).to.be.reverted;
      // Zero balance distribution
      await pulse.distributeBtcSnacksAndEthSnacks();
      // Transfer 1000 BTCSNACKS
      await btcSnacks.transfer(pulse.address, amountToTransfer);
      // Transfer 1000 ETHSNACKS
      await ethSnacks.transfer(pulse.address, amountToTransfer);
      // Distribution
      await pulse.distributeBtcSnacksAndEthSnacks();
      // Check seniorage balance
      expect(await btcSnacks.balanceOf(seniorage.address)).to.equal(amountToTransfer.div(2));
      expect(await ethSnacks.balanceOf(seniorage.address)).to.equal(amountToTransfer.div(2));
    });

    it("Successful distributeSnacks() execution (sufficient amount to buy snacks)", async() => {
      await expect(pulse.connect(bob).distributeSnacks()).to.be.reverted;
      await pulse.distributeSnacks();
      // Transfer 1000 SNACKS to pulse
      await snacks.transfer(pulse.address, amountToTransfer);
      // 100 SNACKS
      const redeemAmount = amountToTransfer.mul(10).div(100);
      // 10 SNACKS
      const redeemComission = redeemAmount.mul(10).div(100);
      // Calculate amount of ZOINKS after redeem
      const amountOfZoinks = await snacks.calculatePayTokenAmountOnRedeem(
        redeemAmount.sub(redeemComission)
      );
      await pulse.distributeSnacks();
      // Checking balances
      expect(await zoinks.balanceOf(pulse.address)).to.equal(amountOfZoinks);
    });

    it("Successful distributeSnacks() execution (insufficient amount to buy snacks)", async() => {
      // Transfer 1 wei SNACKS to Pulse
      await snacks.transfer(pulse.address, 100);
      // Distribution
      await pulse.distributeSnacks();
      // Checking balances
      expect(await snacks.balanceOf(pulse.address)).to.equal(90);
      expect(await zoinks.balanceOf(pulse.address)).to.equal(0);
    });

    it("Successful distributeZoinks() execution (sufficient amount to buy snacks)", async() => {
      // // Require check
      await pulse.distributeZoinks();
      // // Transfer 1000 ZOINKS
      await zoinks.transfer(pulse.address, amountToTransfer);
      // // 10% ZOINKS of pulse balance
      const amountToOperate = amountToTransfer.mul(10).div(100);
      // // Calculate how much SNACKS pulse will receive on 100 ZOINKS
      const amountOfSnacks = await snacks.calculateBuyTokenAmountOnMint(amountToOperate);
      const fee = amountOfSnacks.mul(5).div(100);

      await pulse.distributeZoinks();
      // Checking balances
      expect(await snacks.balanceOf(pulse.address)).to.be.equal(amountOfSnacks.sub(fee));
      expect(await pancakeSwapPool.getBalance(pulse.address)).to.be.equal(mockedLiquidity);
    });

    it("Successful distributeZoinks() execution (insufficient amount to buy snacks)", async() => {
      // Transfer 100 wei ZOINKS
      await zoinks.transfer(pulse.address, 100);
      await pulse.distributeZoinks();
      // Checking balances
      expect(await snacks.balanceOf(pulse.address)).to.be.equal(0);
      expect(await pancakeSwapPool.getBalance(pulse.address)).to.be.equal(mockedLiquidity);
    });

    it("Successful harvest() execution", async() => {
      // Transfer 1000 ZOINKS
      await zoinks.transfer(pulse.address, amountToTransfer);
      // Transfer 1000 SNACKS to pulse
      await snacks.transfer(pulse.address, amountToTransfer);

      await pulse.distributeZoinks();
      await pulse.distributeSnacks();

      // Transfer rewards
      await snacks.transfer(snacksPool.address, amountToTransfer);
      await ethSnacks.transfer(snacksPool.address, amountToTransfer);
      await btcSnacks.transfer(snacksPool.address, amountToTransfer);
      await snacks.transfer(pancakeSwapPool.address, amountToTransfer);
      await ethSnacks.transfer(pancakeSwapPool.address, amountToTransfer);
      await btcSnacks.transfer(pancakeSwapPool.address, amountToTransfer);

      await withImpersonatedSigner(poolRewardDistributor.address, async (distributorSigner) => {
        await mintNativeTokens(distributorSigner, '0x100000000000000000');
        await snacksPool.connect(distributorSigner).notifyRewardAmount(
          snacks.address,
          amountToTransfer
        );
        await snacksPool.connect(distributorSigner).notifyRewardAmount(
          ethSnacks.address,
          amountToTransfer
        );
        await snacksPool.connect(distributorSigner).notifyRewardAmount(
          btcSnacks.address,
          amountToTransfer
        );
        await pancakeSwapPool.connect(distributorSigner).notifyRewardAmount(
          snacks.address,
          amountToTransfer
        );
        await pancakeSwapPool.connect(distributorSigner).notifyRewardAmount(
          ethSnacks.address,
          amountToTransfer
        );
        await pancakeSwapPool.connect(distributorSigner).notifyRewardAmount(
          btcSnacks.address,
          amountToTransfer
        );
      });

      await time.increase(864000); // 10 days

      let expectedRewardFromSnacksPoolInSnacks = await snacksPool.earned(pulse.address, snacks.address);
      let expectedRewardFromPancakeSwapPoolInSnacks = await pancakeSwapPool.earned(pulse.address, snacks.address);
      let expectedRewardFromSnacksPoolInEthSnacks = await snacksPool.earned(pulse.address, ethSnacks.address);
      let expectedRewardFromPancakeSwapPoolInEthSnacks = await pancakeSwapPool.earned(pulse.address, ethSnacks.address);
      let expectedRewardFromSnacksPoolInBtcSnacks = await snacksPool.earned(pulse.address, btcSnacks.address);
      let expectedRewardFromPancakeSwapPoolInBtcSnacks = await pancakeSwapPool.earned(pulse.address, btcSnacks.address);

      // Harvest
      const oldSnacksBalance = await snacks.balanceOf(pulse.address);
      const oldEthSnacksBalance = await ethSnacks.balanceOf(pulse.address);
      const oldBtcSnacksBalance = await btcSnacks.balanceOf(pulse.address);

      await pulse.harvest();

      expect((await snacks.balanceOf(pulse.address)).sub(oldSnacksBalance)).to.be.equal(
        expectedRewardFromSnacksPoolInSnacks.add(expectedRewardFromPancakeSwapPoolInSnacks)
      );
      expect((await ethSnacks.balanceOf(pulse.address)).sub(oldEthSnacksBalance)).to.be.equal(
        expectedRewardFromSnacksPoolInEthSnacks.add(expectedRewardFromPancakeSwapPoolInEthSnacks)
      );
      expect((await btcSnacks.balanceOf(pulse.address)).sub(oldBtcSnacksBalance)).to.be.equal(
        expectedRewardFromSnacksPoolInBtcSnacks.add(expectedRewardFromPancakeSwapPoolInBtcSnacks)
      );
    });

    it("Test pause", async () => {
      // ARRANGE
      // ACT
      await expect(pulse.pause())
        .to.emit(pulse, "Paused")
        .withArgs(owner.address);
      await expect(pulse.connect(bob).pause()).to.be.reverted;
      // ASSERT
    });
  
    it("Test unpause", async () => {
      // ARRANGE
      // ACT
      await pulse.pause();
      await expect(pulse.unpause())
        .to.emit(pulse, "Unpaused")
        .withArgs(owner.address);
      // ASSERT
    });

    it("Successful withdrawCakeLP() execution", async() => {
      const amount = ethers.utils.parseEther("100");
      await pairLpToken.mint(pulse.address, amount);
      previousBalance = await pairLpToken.balanceOf(owner.address);
      await pulse.withdrawCakeLP(owner.address);
      expect((await pairLpToken.balanceOf(owner.address)).sub(previousBalance)).to.equal(amount.add(mockedLiquidity));
      await pulse.withdrawCakeLP(owner.address);
    });

    it("Successful withdrawCakeLPFromPool() execution", async() => {
      const amountToStake = ethers.utils.parseEther("100");
      await pairLpToken.mint(pulse.address, amountToStake);
      await pulse.distributeZoinks();
      await expect(pulse.withdrawCakeLPFromPool(owner.address, amountToStake.mul(2))).to.be.revertedWith("Pulse: invalid amount to withdraw");
      previousBalance = await pairLpToken.balanceOf(owner.address);
      await pulse.withdrawCakeLPFromPool(owner.address, amountToStake.add(mockedLiquidity));
      expect((await pairLpToken.balanceOf(owner.address)).sub(previousBalance)).to.equal(amountToStake.div(2).add(mockedLiquidity.div(2)));
      expect(await pairLpToken.balanceOf(seniorage.address)).to.equal(amountToStake.div(2).add(mockedLiquidity.div(2)));
  });
});