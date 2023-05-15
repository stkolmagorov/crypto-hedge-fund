const { expect } = require("chai");
const { ethers, deployments, getNamedAccounts } = require("hardhat");
const { ZERO_ADDRESS } = require("../deploy/helpers");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

module.exports = (
  disabledTestCaseIndicies,
  stakingTokenMintingAction,
  poolInstanceAcquiringAction,
  lpTokenInstanceAcquiringAction,
  rewardsDuration
) => {

  let owner;
  let alice;

  let seniorage;
  let lpToken;
  let zoinks;
  let pool;
  let busd;

  const amountToStake = ethers.utils.parseEther("100");
  const amountToTransfer = ethers.utils.parseEther("1000");

  beforeEach(async () => {
    [owner, alice] = await ethers.getSigners();
    pool = await poolInstanceAcquiringAction();
    lpToken = await lpTokenInstanceAcquiringAction();
    zoinks = await ethers.getContractAt(
      "Zoinks",
      (await deployments.get("Zoinks")).address
    );
    seniorage = await ethers.getContractAt(
      "Seniorage",
      (await deployments.get("Seniorage")).address
    );
    await stakingTokenMintingAction(
      owner.address,
      ethers.utils.parseEther("10000"),
      lpToken
    );
    await stakingTokenMintingAction(
      alice.address,
      ethers.utils.parseEther("10000"),
      lpToken
    );
    busd = await ethers.getContractAt(
      "MockToken",
      (await deployments.get("BUSD")).address
    );
    const zoinksAmountToMint = ethers.utils.parseEther("10000000");
    await busd.mint(owner.address, zoinksAmountToMint);
    await busd.approve(zoinks.address, zoinksAmountToMint);
    await zoinks.mint(zoinksAmountToMint);
  });

  const testCases = [
    () => it("Successful stake() execution", async () => {
      // Stake
      await expect(pool.stake(0)).to.be.revertedWith("SingleRewardPool: can not stake 0");
      await lpToken.approve(pool.address, amountToStake);
      await pool.stake(amountToStake);
      // Balance check
      expect(await pool.balances(owner.address)).to.equal(amountToStake);
    }),

    () => it("Successful notifyRewardAmount() execution", async () => {
      await lpToken.approve(pool.address, amountToStake);
      await pool.stake(amountToStake);
      // Reward transfer
      await zoinks.transfer(pool.address, amountToTransfer);
      // Notify
      await pool.notifyRewardAmount(amountToTransfer);
      let block = await ethers.provider.getBlock();
      // Contract state check
      expect(await pool.rewardRate()).to.equal(amountToTransfer.div(rewardsDuration));
      expect(await pool.lastUpdateTime()).to.equal(block.timestamp);
      expect(await pool.periodFinish()).to.equal(rewardsDuration.add(block.timestamp));
      const previousPeriodFinish = rewardsDuration.add(block.timestamp);
      const previousRewardRate = await pool.rewardRate();
      // Reward transfer
      await zoinks.transfer(pool.address, amountToTransfer);
      // Notify
      await pool.notifyRewardAmount(amountToTransfer);
      block = await ethers.provider.getBlock();
      const remaining = previousPeriodFinish.sub(block.timestamp);
      const leftover = remaining.mul(previousRewardRate);
      // Contract state check
      expect(await pool.rewardRate()).to.equal(amountToTransfer.add(leftover).div(rewardsDuration));
      expect(await pool.lastUpdateTime()).to.equal(block.timestamp);
      expect(await pool.periodFinish()).to.equal(rewardsDuration.add(block.timestamp));
      // 10 days passed
      await time.increase(864000);
      // Get reward from user
      await pool.getReward();
      // 10 days passed
      await time.increase(864000);
      // Get reward from user
      await pool.getReward();
      // 10 days passed
      await time.increase(864000);
      // Get reward from user
      await pool.getReward();
      // Big reward transfer
      await expect(pool.notifyRewardAmount(amountToTransfer.mul(1000))).to.be.revertedWith("SingleRewardPool: provided reward too high");
    }),

    () => it("Successful getReward() execution", async () => {
      // Rewards transfer and notifications`
      await zoinks.transfer(pool.address, amountToTransfer);
      await pool.notifyRewardAmount(amountToTransfer);
      await pool.grantRole(ethers.utils.hexZeroPad(0, 32), alice.address);
      // Attempting to get reward without stake
      await pool.connect(alice).getReward();
      // Stake
      const amountToStake = ethers.utils.parseEther("100");
      await lpToken.connect(alice).approve(pool.address, amountToStake);
      await pool.connect(alice).stake(amountToStake);
      await time.increase(1);
      // Calculate rewards
      let zoinksPotentialReward = (await pool.earned(alice.address)).mul(4);
      // Get reward
      await pool.connect(alice).getReward();
      // Check balances
      expect(await zoinks.balanceOf(alice.address)).to.equal(zoinksPotentialReward.div(2));
      // Clear reward tokens
      await zoinks.connect(alice).transfer(owner.address, await zoinks.balanceOf(alice.address));
      // await zoinks.connect(seniorage).transfer(owner.address, await zoinks.balanceOf(seniorage.address));
      // 1 day passed
      await time.increase(86400);
      // Calculate rewards
      zoinksPotentialReward = await pool.earned(alice.address);
      // Get reward
      const oldSeniorageBalance = await zoinks.balanceOf(seniorage.address)
      await pool.connect(alice).getReward();
      // Check balances
      expect(await zoinks.balanceOf(alice.address)).to.equal(zoinksPotentialReward);
    }),

    () => it("Successful exit() execution", async () => {
      // Rewards transfer and notifications
      await zoinks.transfer(pool.address, amountToTransfer);
      await pool.notifyRewardAmount(amountToTransfer);
      await pool.grantRole(ethers.utils.hexZeroPad(0, 32), alice.address);
      await expect(pool.exit()).to.be.revertedWith("SingleRewardPool: can not withdraw 0");
      // Stake
      const amountToStake = ethers.utils.parseEther("100");
      await lpToken.connect(alice).approve(pool.address, amountToStake);
      await pool.connect(alice).stake(amountToStake);
      await time.increase(1);
      // Calculate rewards and balance before exit
      let zoinksPotentialReward = (await pool.earned(alice.address)).mul(4);
      let balanceBefore = await lpToken.balanceOf(alice.address);
      // Exit
      await pool.connect(alice).exit();
      // Check balances
      expect(await zoinks.balanceOf(alice.address)).to.equal(zoinksPotentialReward.div(2));
      expect(await lpToken.balanceOf(alice.address)).to.equal(balanceBefore.add(amountToStake.div(2)));
      // Clear reward tokens
      await zoinks.connect(alice).transfer(owner.address, await zoinks.balanceOf(alice.address));
      // await zoinks.connect(seniorage).transfer(owner.address, await zoinks.balanceOf(seniorage.address));
      // Stake
      await lpToken.connect(alice).approve(pool.address, amountToStake);
      await pool.connect(alice).stake(amountToStake);
      // 1 day passed
      await time.increase(86400);
      // Calculate rewards and balance before exit
      zoinksPotentialReward = await pool.earned(alice.address);
      balanceBefore = await lpToken.balanceOf(alice.address);
      // Exit
      await pool.connect(alice).exit();
      // Check balances
      expect(await zoinks.balanceOf(alice.address)).to.equal(zoinksPotentialReward);
      expect(await lpToken.balanceOf(alice.address)).to.equal(balanceBefore.add(amountToStake.mul(9).div(10)));
    }),

    () => it("Successful withdraw() execution", async () => {
      // Rewards transfer and notifications
      await zoinks.transfer(pool.address, amountToTransfer);
      await pool.notifyRewardAmount(amountToTransfer);
      // Require check
      await expect(pool.withdraw(0)).to.be.revertedWith("SingleRewardPool: can not withdraw 0");
      // // Stake
      const amountToStake = ethers.utils.parseEther("100");
      await lpToken.approve(pool.address, amountToStake);
      await pool.stake(amountToStake);
      // // Calculate balance before
      let balanceBefore = await lpToken.balanceOf(owner.address);
      await pool.withdraw(amountToStake);
      // Balance check
      expect(await lpToken.balanceOf(owner.address)).to.equal(balanceBefore.add(amountToStake.div(2)));
    }),

    () => it("Successful lastTimeRewardApplicable() execution", async () => {
      await zoinks.transfer(pool.address, amountToTransfer);
      await pool.notifyRewardAmount(amountToTransfer);
      const block = await ethers.provider.getBlock();
      expect(await pool.lastTimeRewardApplicable()).to.equal(block.timestamp);
      await time.increase(86400);
      expect(await pool.lastTimeRewardApplicable()).to.equal(rewardsDuration.add(block.timestamp));
    }),

    () => it("Successful setPoolRewardDistributor() execution", async () => {
      await expect(pool.connect(alice).setPoolRewardDistributor(alice.address)).to.be.reverted;
      await pool.setPoolRewardDistributor(alice.address);
    }),

    () => it("Successful setSeniorage() execution", async () => {
      await expect(pool.connect(alice).setSeniorage(alice.address)).to.be.reverted;
      await pool.setSeniorage(alice.address);
    }),

    () => it("Successful setRewardsDuration() execution", async () => {
      await zoinks.transfer(pool.address, amountToTransfer);
      await pool.notifyRewardAmount(amountToTransfer);
      await expect(pool.setRewardsDuration(100)).to.be.revertedWith("SingleRewardPool: duration cannot be changed now");
      await time.increase(86400);
      await pool.setRewardsDuration(100);
    }),

    () => it("Successful getRewardForDuration() execution", async () => {
      await zoinks.transfer(pool.address, amountToTransfer);
      await pool.notifyRewardAmount(amountToTransfer);
      const rewardForDuration = await pool.getRewardForDuration();
      const rewardRate = await pool.rewardRate();
      expect(rewardForDuration).to.equal(rewardRate.mul(rewardsDuration));
    }),

    () => it("Successful onlyPoolRewardDistributor check", async () => {
      await zoinks.transfer(pool.address, amountToTransfer);
      await expect(pool.connect(alice).notifyRewardAmount(amountToTransfer))
        .to.be.reverted;
      await pool.notifyRewardAmount(amountToTransfer);
    }),

    () => it("Successful pause() execution", async () => {
      // Pause from not the owner
      await expect(pool.connect(alice).pause())
        .to.be.reverted;
      // Pause from the owner
      await pool.pause();
      // Attempt to call
      await expect(pool.exit()).to.be.revertedWith("Pausable: paused");
    }),

    () => it("Successful unpause() execution", async () => {
      // Pause from the owner
      await pool.pause();
      // Unpause from not the owner
      await expect(pool.connect(alice).unpause())
        .to.be.reverted;
      // Attempt to call
      await expect(pool.exit()).to.be.revertedWith("Pausable: paused");
      // Unpause from the owner
      await pool.unpause();
      // Successful call
      await lpToken.approve(pool.address, 1000);
      await pool.stake(1000);
      await pool.exit();
    })
  ];

  for (let i = 0; i < testCases.length; i++) {
    if (disabledTestCaseIndicies.includes(i)) continue;
    testCases[i]();
  }
}
