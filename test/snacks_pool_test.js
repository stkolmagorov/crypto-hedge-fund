const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, deployments } = hre;
const multipleRewardPoolTestSuite = require('../reusable_test_suits/multiple_reward_pool_test_suite');
const { mintZoinksAndAllSnacks, mockSwaps, withImpersonatedSigner, mintNativeTokens, ZERO_ADDRESS } = require("../deploy/helpers");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const abiCoder = ethers.utils.defaultAbiCoder;
const data = abiCoder.encode(
  ["uint", "tuple(uint[], uint[])"],
  [10000, [[], []]]
);

describe("SnacksPool", () => {
  let pool;
  let lpToken;
  let owner;
  let alice;
  let zoinks;
  let btcSnacks;
  let ethSnacks;
  let snacks;
  let busd;

  const rewardsDuration = ethers.BigNumber.from("43200");

  const lpTokenInstanceAcquiringAction = async () => {
    return await ethers.getContractAt(
      hre.names.internal.snacks,
      (await deployments.get(hre.names.internal.snacks)).address
    );
  }

  const poolInstanceAcquiringAction = async () => {
    return await ethers.getContractAt(
      hre.names.internal.snacksPool,
      (await deployments.get(hre.names.internal.snacksPool)).address
    );
  }

  const stakingTokenMintingAction = async (who, amount, lpToken) => {
    const MINT_FEE_PERCENT = ethers.BigNumber.from('500');
    const amountWithFee = amount.add(amount.mul(MINT_FEE_PERCENT).div(10000));
    await busd.mint(owner.address, amountWithFee);
    await busd.approve(zoinks.address, amountWithFee);
    await zoinks.mint(amountWithFee);
    await zoinks.approve(lpToken.address, amountWithFee);
    await lpToken.mintWithPayTokenAmount(amountWithFee);
    if (who !== owner.address) {
      await lpToken.transfer(who, amount);
    }
  }

  beforeEach(async () => {
      await deployments.fixture(['snacks_pool_test_fixtures']);
      [owner, alice] = await ethers.getSigners();
      pool = await poolInstanceAcquiringAction();
      lpToken = await lpTokenInstanceAcquiringAction();
      zoinks = await ethers.getContractAt(
        hre.names.internal.zoinks,
        (await deployments.get(hre.names.internal.zoinks)).address
      );
      btcSnacks = await ethers.getContractAt(
        hre.names.internal.btcSnacks,
        (await deployments.get(hre.names.internal.btcSnacks)).address
      );
      ethSnacks = await ethers.getContractAt(
        hre.names.internal.ethSnacks,
        (await deployments.get(hre.names.internal.ethSnacks)).address
      );
      snacks = await ethers.getContractAt(
        hre.names.internal.snacks,
        (await deployments.get(hre.names.internal.snacks)).address
      );
      lunchBox = await ethers.getContractAt(
        hre.names.internal.lunchBox,
        (await deployments.get(hre.names.internal.lunchBox)).address
      );
      seniorage = await ethers.getContractAt(
        hre.names.internal.seniorage,
        (await deployments.get(hre.names.internal.seniorage)).address
      );
      busd = await ethers.getContractAt(
        hre.names.internal.mockToken,
        (await deployments.get(hre.names.external.tokens.busd)).address
      );
      pulse = await ethers.getContractAt(
        hre.names.internal.pulse,
        (await deployments.get(hre.names.internal.pulse)).address
      );
      idoFactory = await ethers.getContractAt(
        hre.names.internal.iDOFactory,
        (await deployments.get(hre.names.internal.iDOFactory)).address
      );
      THOUSAND = ethers.utils.parseEther("1000");
      await mintZoinksAndAllSnacks(deployments, owner, THOUSAND, owner);
      await mintZoinksAndAllSnacks(deployments, alice, THOUSAND, alice);
  });

  multipleRewardPoolTestSuite(
    // [0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 13, 14, 15],
    [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    [], // // no need to disable some expects of reward with penalties
    [], // no need to disable some expects of reward without penalties
    1, // staking token is first in reward tokens
    stakingTokenMintingAction,
    poolInstanceAcquiringAction,
    lpTokenInstanceAcquiringAction,
    rewardsDuration
  );

  it("Successful configure() execution", async () => {
    // Call from not the owner
    await expect(
      pool.connect(alice).configure(
        alice.address,
        alice.address,
        lunchBox.address,
        snacks.address,
        btcSnacks.address,
        ethSnacks.address,
        alice.address
    )).to.be.reverted;
    // Call from the owner
    await pool.configure(
      alice.address,
      alice.address,
      lunchBox.address,
      snacks.address,
      btcSnacks.address,
      ethSnacks.address,
      alice.address
    );
  });

  it("Successful activateInvestmentSystem() execution", async () => {
    // Attempt to activate LunchBox with 0 stake
    await expect(pool.activateInvestmentSystem(data))
      .to.be.reverted;
    // Stake 1000 snacks
    await snacks.approve(pool.address, THOUSAND);
    await pool.stake(THOUSAND);
    // Successful activation
    await pool.activateInvestmentSystem(data);
    expect(await pool.isLunchBoxParticipant(owner.address)).to.equal(true);
    // Attempt to activate again
    await expect(pool.activateInvestmentSystem(data)).to.be.reverted;
    // Impersonate pulse
    await withImpersonatedSigner(pulse.address, async (pulseSigner) => {
      await mintNativeTokens(pulseSigner, '0x100000000000000000');
      // Stake from pulse
      await snacks.transfer(pulse.address, THOUSAND);
      await pool.connect(pulseSigner).stake(THOUSAND);
      // Activation from pulse
      await pool.connect(pulseSigner).activateInvestmentSystem(data);
    });
    // Check participants supply
    expect(await pool.getLunchBoxParticipantsTotalSupply()).to.equal(THOUSAND.mul(2));
    // Exclude from restrictions
    await pool.excludeFromRestrictions(alice.address);
    // Open IDO
    const parameters = {
      numberOfProjects: 3,
      totalRequiredAmountOfFunds: 100,
      insuranceRecipient: alice.address,
      defaultOwner: owner.address,
      authority: alice.address,
      idoLunchBoxPoolAddress: ZERO_ADDRESS,
      idoPoolAddress: ZERO_ADDRESS,
      requiredAmountsOfFunds: [10, 20, 70],
      shares: [0, 0, 0],
      fundsReceivers: [alice.address, alice.address, alice.address],
      idoTokens: [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS],
      names: ["N", "NN", "NNN"],
      symbols: ["S", "SS", "SSS"]
    }
    await idoFactory.openIdo(parameters);
    // Stake 1000 snacks from Alice
    await snacks.connect(alice).approve(pool.address, THOUSAND);
    await pool.connect(alice).stake(THOUSAND);
    // Activate only IDO
    const idoData = abiCoder.encode(
      ["uint", "tuple(uint[], uint[])"],
      [0, [[10000], [0]]]
    );
    await pool.connect(alice).activateInvestmentSystem(idoData);
    expect(await pool.isInvestor(alice.address)).to.equal(true);
    expect(await idoFactory.isIdoParticipant(alice.address)).to.equal(true);
    // Attempt to get reward
    await expect(pool.connect(alice).getReward()).to.be.reverted;
    // Exit
    await pool.connect(alice).withdraw(100);
    await pool.connect(alice).exit();
    expect(await pool.isInvestor(alice.address)).to.equal(false);
    expect(await idoFactory.isIdoParticipant(alice.address)).to.equal(false);
    await snacks.addToExcludedHolders(alice.address);
    // Stake 1000 snacks from Alice
    await snacks.connect(alice).approve(pool.address, THOUSAND);
    await pool.connect(alice).stake(THOUSAND);
    await pool.connect(alice).activateInvestmentSystem(idoData);
    await pool.connect(alice).withdraw(100);
    await pool.connect(alice).exit();
  });

  it("Successful stake() execution (from not excluded LunchBox participant)", async () => {
    // Mint all snacks on 1000 payTokenAmount
    await mintZoinksAndAllSnacks(deployments, owner, THOUSAND, owner);
    await snacks.approve(pool.address, THOUSAND.mul(2));
    // Attempt to stake 0
    await expect(pool.stake(0)).to.be.reverted;
    // Stake 1000
    await pool.stake(THOUSAND);
    // LunchBox activation
    await pool.activateInvestmentSystem(data);
    // Check supplies
    expect(await pool.getTotalSupply()).to.equal(THOUSAND);
    expect(await pool.getLunchBoxParticipantsTotalSupply()).to.equal(THOUSAND);
    // Stake from participant
    await pool.stake(THOUSAND);
    // Check supplies
    expect(await pool.getTotalSupply()).to.equal(THOUSAND.mul(2));
    expect(await pool.getLunchBoxParticipantsTotalSupply()).to.equal(THOUSAND.mul(2));
  });

  it("Successful changeInvestmentSystemData() execution", async() => {
    // Stake 1000
    await snacks.approve(pool.address, THOUSAND);
    await pool.stake(THOUSAND);
    // Exclude from restrictions
    await pool.excludeFromRestrictions(owner.address);
    // Attempt to call without activation
    await expect(pool.changeInvestmentSystemData(data)).to.be.reverted;
    // LunchBox activation
    await pool.activateInvestmentSystem(data);
    expect(await pool.isLunchBoxParticipant(owner.address)).to.equal(true);
    await expect(pool.changeInvestmentSystemData(data)).to.be.reverted;
    // Open IDO
    const parameters = {
      numberOfProjects: 3,
      totalRequiredAmountOfFunds: 100,
      insuranceRecipient: alice.address,
      defaultOwner: owner.address,
      authority: alice.address,
      idoLunchBoxPoolAddress: ZERO_ADDRESS,
      idoPoolAddress: ZERO_ADDRESS,
      requiredAmountsOfFunds: [10, 20, 70],
      shares: [0, 0, 0],
      fundsReceivers: [alice.address, alice.address, alice.address],
      idoTokens: [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS],
      names: ["N", "NN", "NNN"],
      symbols: ["S", "SS", "SSS"]
    }
    await idoFactory.openIdo(parameters);
    const idoData = abiCoder.encode(
      ["uint", "tuple(uint[], uint[])"],
      [0, [[10000], [0]]]
    );
    await pool.changeInvestmentSystemData(idoData);
    await pool.changeInvestmentSystemData(data);
    await snacks.addToExcludedHolders(alice.address);
    expect(await snacks.isExcludedHolder(alice.address)).to.equal(true);
    // Stake 1000 snacks from Alice
    await snacks.connect(alice).approve(pool.address, THOUSAND);
    await pool.connect(alice).stake(THOUSAND);
    await pool.connect(alice).activateInvestmentSystem(data);
    await pool.connect(alice).changeInvestmentSystemData(idoData);
    await pool.connect(alice).changeInvestmentSystemData(data);
  });

  it("Successful stake() execution (from excluded LunchBox participant)", async () => {
    // Mint all snacks on 1000 payTokenAmount
    await mintZoinksAndAllSnacks(deployments, owner, THOUSAND, owner);
    await snacks.approve(pool.address, THOUSAND.mul(2));
    await snacks.addToExcludedHolders(owner.address);
    // Attempt to stake 0
    await expect(pool.stake(0)).to.be.reverted;
    // Stake 1000
    await pool.stake(THOUSAND);
    // LunchBox activation
    await pool.activateInvestmentSystem(data);
    // Check supplies
    expect(await pool.getTotalSupply()).to.equal(THOUSAND);
    expect(await pool.getLunchBoxParticipantsTotalSupply()).to.equal(THOUSAND);
    // Stake from participant
    await pool.stake(THOUSAND);
    // Check supplies
    expect(await pool.getTotalSupply()).to.equal(THOUSAND.mul(2));
    expect(await pool.getLunchBoxParticipantsTotalSupply()).to.equal(THOUSAND.mul(2));
  });

  it("Successful deactivateInvestmentSystem() execution", async () => {
    // Mint all snacks on 1000 payTokenAmount
    await mintZoinksAndAllSnacks(deployments, owner, THOUSAND, owner);
    // Stake 1000 snacks
    await snacks.approve(pool.address, THOUSAND);
    await pool.stake(THOUSAND);
    // Successful activation
    await pool.activateInvestmentSystem(data);
    // Attempt to deactivate before 24 hours
    await expect(pool.deactivateInvestmentSystem()).to.be.reverted;
    await time.increase(86400);
    // Successful deactivation
    await pool.deactivateInvestmentSystem();
    expect(await pool.isLunchBoxParticipant(owner.address)).to.equal(false);
    // Attempt to deactivate again
    await expect(pool.deactivateInvestmentSystem()).to.be.reverted;
    

    // Impersonate pulse
    await withImpersonatedSigner(pulse.address, async (pulseSigner) => {
      await mintNativeTokens(pulseSigner, '0x100000000000000000');
      // Stake from pulse
      await snacks.transfer(pulse.address, THOUSAND);
      await pool.connect(pulseSigner).stake(THOUSAND);
      // Activation from pulse
      await pool.connect(pulseSigner).activateInvestmentSystem(data);
      // Check participants supply
      expect(await pool.getLunchBoxParticipantsTotalSupply()).to.equal(THOUSAND);
      // 24 hr passed
      await time.increase(86400);
      // Deactivation from pulse
      await pool.connect(pulseSigner).deactivateInvestmentSystem();
    });
    // Check participants supply
    expect(await pool.getLunchBoxParticipantsTotalSupply()).to.equal(0);
  });

  it("Successful getBalance() execution", async () => {
    // Mint all snacks on 1000 payTokenAmount
    await mintZoinksAndAllSnacks(deployments, owner, THOUSAND, owner);
    // Check balance
    expect(await pool.getBalance(owner.address)).to.equal(0);
    // Stake 1000 snacks
    await snacks.approve(pool.address, THOUSAND);
    await pool.stake(THOUSAND);
    // Check balance
    expect(await pool.getBalance(owner.address)).to.equal(THOUSAND);
  });

  it("Successful getTotalSupply() execution", async () => {
    // Mint all snacks from owner
    await mintZoinksAndAllSnacks(deployments, owner, THOUSAND, owner);
    // Mint all from alice
    await mintZoinksAndAllSnacks(deployments, alice, THOUSAND.mul(2), alice);
    // Check totalSupply
    expect(await pool.getTotalSupply()).to.equal(0);
    // Stake 1000 snacks from the owner
    await snacks.approve(pool.address, THOUSAND);
    await pool.stake(THOUSAND);
    // Stake 2000 snacks from the alice
    await snacks.connect(alice).approve(pool.address, THOUSAND.mul(2));
    await pool.connect(alice).stake(THOUSAND.mul(2));
    // Check totalSupply
    expect(await pool.getTotalSupply()).to.equal(THOUSAND.mul(3));
  });

  it("Successful getLunchBoxParticipantsLength() execution", async () => {
    // Mint all snacks on 1000 payTokenAmount
    await mintZoinksAndAllSnacks(deployments, owner, THOUSAND, owner);
    // Stake 1000 snacks
    await snacks.approve(pool.address, THOUSAND);
    await pool.stake(THOUSAND);
    // LunchBox activation
    await pool.activateInvestmentSystem(data);
    // Check
    expect(await pool.getLunchBoxParticipantsLength()).to.equal(1);
  });

  it("Successful getLunchBoxParticipantAt() execution", async () => {
    // Mint all snacks on 1000 payTokenAmount
    await mintZoinksAndAllSnacks(deployments, owner, THOUSAND, owner);
    // Stake 1000 snacks
    await snacks.approve(pool.address, THOUSAND);
    await pool.stake(THOUSAND);
    // LunchBox activation
    await pool.activateInvestmentSystem(data);
    // Check
    expect(await pool.getLunchBoxParticipantAt(0)).to.equal(owner.address);
  });
  
  it("Successful withdraw() execution (from not excluded LunchBox participant)", async () => {
    // Get 1k snacks/btcSnacks/ethSnacks
    await mintZoinksAndAllSnacks(deployments, owner, THOUSAND, owner);
    // Attempt to withdraw with 0 stake
    await expect(pool.withdraw(THOUSAND)).to.be.reverted;
    // Stake 1000 snacks
    await snacks.approve(pool.address, THOUSAND);
    await pool.stake(THOUSAND);
    // Attempt to withdraw more than stake amount
    await expect(pool.withdraw(THOUSAND.add(1))).to.be.reverted;
    // Attempt to withdraw 0
    await expect(pool.withdraw(0)).to.be.reverted;
    // Withdraw before 24 hours passed
    let oldBalance = await snacks.balanceOf(owner.address);
    await pool.withdraw(THOUSAND);
    expect(await snacks.balanceOf(seniorage.address)).to.equal(THOUSAND.div(2));
    expect((await snacks.balanceOf(owner.address)).sub(oldBalance)).to.equal(THOUSAND.div(2));
    // Stake 1000 snacks
    await snacks.approve(pool.address, THOUSAND);
    await pool.stake(THOUSAND);
    // Withdraw after 24 hours passed
    await time.increase(86400);
    oldBalance = await snacks.balanceOf(owner.address);
    await pool.withdraw(THOUSAND);
    expect((await snacks.balanceOf(owner.address)).sub(oldBalance)).to.equal(THOUSAND);
    // Stake 1000 snacks
    await snacks.approve(pool.address, THOUSAND);
    await pool.stake(THOUSAND);
    // Activate lunchBox
    await pool.activateInvestmentSystem(data);
    // Withdraw all stake before 24 hours passed
    await expect(pool.withdraw(THOUSAND)).to.be.reverted;
    // Withdraw some stake before 24 hours passed
    oldBalance = await snacks.balanceOf(owner.address);
    seniorageOldBalance = await snacks.balanceOf(seniorage.address);
    await pool.withdraw(THOUSAND.div(2));
    expect((await snacks.balanceOf(seniorage.address)).sub(seniorageOldBalance)).to.equal(THOUSAND.div(4));
    expect((await snacks.balanceOf(owner.address)).sub(oldBalance)).to.equal(THOUSAND.div(4));
    // Withdraw all after 24 hours passed
    await time.increase(86400);
    oldBalance = await snacks.balanceOf(owner.address);
    await pool.withdraw(THOUSAND.div(2));
    expect((await snacks.balanceOf(owner.address)).sub(oldBalance)).to.equal(THOUSAND.div(2));
    expect(await pool.isLunchBoxParticipant(owner.address)).to.equal(false);
    // Impersonate pulse
    await withImpersonatedSigner(pulse.address, async (pulseSigner) => {
      await mintNativeTokens(pulseSigner, '0x100000000000000000');
      // Stake from pulse
      await snacks.transfer(pulse.address, THOUSAND);
      await pool.connect(pulseSigner).stake(THOUSAND);
      // Activation from pulse
      await pool.connect(pulseSigner).activateInvestmentSystem(data);
      // Check participants supply
      expect(await pool.getLunchBoxParticipantsTotalSupply()).to.equal(THOUSAND);
      // Withdraw from pulse
      await pool.connect(pulseSigner).withdraw(THOUSAND.div(2));
      // Check participants supply
      expect(await pool.getLunchBoxParticipantsTotalSupply()).to.equal(THOUSAND.div(2));
      // 24 hr passed
      await time.increase(86400);
      // Withdraw from pulse
      await pool.connect(pulseSigner).withdraw(THOUSAND.div(2));
    });
    // Check participants supply
    expect(await pool.getLunchBoxParticipantsTotalSupply()).to.equal(0);
  });

  it("Successful withdraw() execution (from excluded LunchBox participant)", async () => {
    // Get 1k snacks/btcSnacks/ethSnacks
    await mintZoinksAndAllSnacks(deployments, owner, THOUSAND, owner);
    // Attempt to withdraw with 0 stake
    await expect(pool.withdraw(THOUSAND)).to.be.reverted;
    // Stake 1000 snacks
    await snacks.addToExcludedHolders(owner.address);
    await snacks.approve(pool.address, THOUSAND);
    await pool.stake(THOUSAND);
    // Attempt to withdraw more than stake amount
    await expect(pool.withdraw(THOUSAND.add(1))).to.be.reverted;
    // Attempt to withdraw 0
    await expect(pool.withdraw(0)).to.be.reverted;
    // Withdraw before 24 hours passed
    let oldBalance = await snacks.balanceOf(owner.address);
    await pool.withdraw(THOUSAND);
    expect(await snacks.balanceOf(seniorage.address)).to.equal(THOUSAND.div(2));
    expect((await snacks.balanceOf(owner.address)).sub(oldBalance)).to.equal(THOUSAND.div(2));
    // Stake 1000 snacks
    await snacks.approve(pool.address, THOUSAND);
    await pool.stake(THOUSAND);
    // Withdraw after 24 hours passed
    await time.increase(86400);
    oldBalance = await snacks.balanceOf(owner.address);
    await pool.withdraw(THOUSAND);
    expect((await snacks.balanceOf(owner.address)).sub(oldBalance)).to.equal(THOUSAND);
    // Stake 1000 snacks
    await snacks.approve(pool.address, THOUSAND);
    await pool.stake(THOUSAND);
    // Activate lunchBox
    await pool.activateInvestmentSystem(data);
    // Withdraw all stake before 24 hours passed
    await expect(pool.withdraw(THOUSAND)).to.be.reverted;
    // Withdraw some stake before 24 hours passed
    oldBalance = await snacks.balanceOf(owner.address);
    seniorageOldBalance = await snacks.balanceOf(seniorage.address);
    await pool.withdraw(THOUSAND.div(2));
    expect((await snacks.balanceOf(seniorage.address)).sub(seniorageOldBalance)).to.equal(THOUSAND.div(4));
    expect((await snacks.balanceOf(owner.address)).sub(oldBalance)).to.equal(THOUSAND.div(4));
    // Withdraw all after 24 hours passed
    await time.increase(86400);
    oldBalance = await snacks.balanceOf(owner.address);
    await pool.withdraw(THOUSAND.div(2));
    expect((await snacks.balanceOf(owner.address)).sub(oldBalance)).to.equal(THOUSAND.div(2));
    expect(await pool.isLunchBoxParticipant(owner.address)).to.equal(false);
    // Impersonate pulse
    await withImpersonatedSigner(pulse.address, async (pulseSigner) => {
      await mintNativeTokens(pulseSigner, '0x100000000000000000');
      // Stake from pulse
      await snacks.transfer(pulse.address, THOUSAND);
      await pool.connect(pulseSigner).stake(THOUSAND);
      // Activation from pulse
      await pool.connect(pulseSigner).activateInvestmentSystem(data);
      // Check participants supply
      expect(await pool.getLunchBoxParticipantsTotalSupply()).to.equal(THOUSAND);
      // Withdraw from pulse
      await pool.connect(pulseSigner).withdraw(THOUSAND.div(2));
      // Check participants supply
      expect(await pool.getLunchBoxParticipantsTotalSupply()).to.equal(THOUSAND.div(2));
      // 24 hr passed
      await time.increase(86400);
      // Withdraw from pulse
      await pool.connect(pulseSigner).withdraw(THOUSAND.div(2));
    });
    // Check participants supply
    expect(await pool.getLunchBoxParticipantsTotalSupply()).to.equal(0);
  });

  it("Successful getReward() execution", async () => {
    // Get 10k snacks/btcSnacks/ethSnacks
    const TEN_THOUSAND = ethers.utils.parseEther("10000");
    const HUNDRED = ethers.utils.parseEther("100");
    await mintZoinksAndAllSnacks(deployments, owner, TEN_THOUSAND, owner);
    // Send rewards to pool (100 tokens)
    await snacks.transfer(pool.address, HUNDRED);
    await pool.notifyRewardAmount(snacks.address, HUNDRED);
    await btcSnacks.transfer(pool.address, HUNDRED);
    await pool.notifyRewardAmount(btcSnacks.address, HUNDRED);
    // Stake 1000 snacks
    await snacks.approve(pool.address, THOUSAND);
    await pool.stake(THOUSAND);
    // 1 hour passed
    await time.increase(3600);
    // Get reward
    const rewardRate = await pool.rewardRates(snacks.address); // For all tokens reward rate is the same 
    const expectedReward = rewardRate.mul(3601);
    let snacksOldBalance = await snacks.balanceOf(owner.address);
    let btcSnacksOldBalance = await btcSnacks.balanceOf(owner.address);
    await pool.getReward();
    expect((await snacks.balanceOf(owner.address)).sub(snacksOldBalance)).to.be.closeTo(expectedReward, 300);
    expect((await btcSnacks.balanceOf(owner.address)).sub(btcSnacksOldBalance)).to.be.closeTo(expectedReward, 300);
    // LunchBox activation
    await pool.activateInvestmentSystem(data);
    // 1 hour passed
    await time.increase(3600);
    // Get reward
    await busd.transfer(lunchBox.address, ethers.utils.parseEther("3"));
    await mockSwaps(
      "PancakeSwapRouter",
      deployments,
      0,
      owner.address,
      ethers.utils.parseEther("1")
    );
    await pool.getReward();
  });

  it("Successful getReward() execution (from LunchBox participant and 0 rewards)", async () => {
    // Mint all snacks from owner
    await mintZoinksAndAllSnacks(deployments, owner, THOUSAND, owner);
    // Stake 1000
    await snacks.approve(pool.address, THOUSAND);
    await pool.stake(THOUSAND);
    // LunchBox activation
    await pool.activateInvestmentSystem(data);
    // Get reward
    await pool.getReward();
  });

  it("Successful onlySnacks check", async() => {
    await expect(pool.updateTotalSupplyFactor(100)).to.be.reverted;
  });

  it("Successful check inside notifyRewardAmount()", async() => {
    await expect(pool.connect(alice).notifyRewardAmount(snacks.address, 100)).to.be.reverted;
  });

  it("Successful getRewardForDuration() execution", async() => {
    const amount = 100000;
    expect(await pool.getRewardForDuration(snacks.address)).to.equal(0);
    await snacks.transfer(pool.address, amount)
    await pool.notifyRewardAmount(snacks.address, amount);
    expect(await pool.getRewardForDuration(snacks.address)).to.be.gt(0);
  });

  it("Successful withdraw execution (trying to withdraw amount that bigger than deposit)", async() => {
    await mintZoinksAndAllSnacks(deployments, owner, THOUSAND, owner);
    await snacks.approve(pool.address, THOUSAND.mul(2));
    // Stake 1000
    await pool.stake(THOUSAND);
    // Withdraw 1000
    await expect(pool.connect(alice).withdraw(THOUSAND)).to.be.reverted;
  });
});
