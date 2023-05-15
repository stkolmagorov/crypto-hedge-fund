const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, deployments } = hre;

describe("Snacks (integration tests)", () => {

  let owner;
  let authority;
  let buyer1;
  let buyer2;
  let buyer3;
  let buyer4;
  let buyer5;
  let seller;

  let zoinks;
  let snacks;
  let seniorage;
  let pulse;
  let busd;
  let poolRewardDistributor;
  let btcSnacks;
  let ethSnacks;
  let snacksPool;
  let pancakeSwapPool;
  let lunchBox;

  beforeEach(async () => {
    await deployments.fixture(['snacks_test_fixtures']);
    [owner, authority, buyer1, buyer2, buyer3, buyer4, buyer5, seller] = await ethers.getSigners();
    zoinks = await ethers.getContractAt(
      hre.names.internal.zoinks,
      (await deployments.get(hre.names.internal.zoinks)).address
    );
    seniorage = await ethers.getContractAt(
      hre.names.internal.seniorage,
      (await deployments.get(hre.names.internal.seniorage)).address
    );
    pulse = await ethers.getContractAt(
      hre.names.internal.pulse,
      (await deployments.get(hre.names.internal.pulse)).address
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
    busd = await ethers.getContractAt(
      hre.names.internal.mockToken,
      (await deployments.get(hre.names.external.tokens.busd)).address
    );
    btc = await ethers.getContractAt(
      hre.names.internal.mockToken,
      (await deployments.get(hre.names.external.tokens.btc)).address
    );
    eth = await ethers.getContractAt(
      hre.names.internal.mockToken,
      (await deployments.get(hre.names.external.tokens.eth)).address
    );
    poolRewardDistributor = await ethers.getContractAt(
      hre.names.internal.poolRewardDistributor,
      (await deployments.get(hre.names.internal.poolRewardDistributor)).address
    );
    snacksPool = await ethers.getContractAt(
      hre.names.internal.snacksPool,
      (await deployments.get(hre.names.internal.snacksPool)).address
    );
    pancakeSwapPool = await ethers.getContractAt(
      hre.names.internal.pancakeSwapPool,
      (await deployments.get(hre.names.internal.pancakeSwapPool)).address
    );
    lunchBox = await ethers.getContractAt(
      hre.names.internal.lunchBox,
      (await deployments.get(hre.names.internal.lunchBox)).address
    );
  });

  // Check integration Zoinks, BUSD, Snacks, Pulse, PoolRewardDistributor, Senyorage
  it("Test distributeFee", async () => {
    // ARRANGE
    const amountSnacksToBuy = ethers.utils.parseEther('5');
    const buyer1Zoinks = ethers.utils.parseEther('0.000015'); // zoinksToPay = 0.000015
    const buyer1BUSD = buyer1Zoinks;

    const buyer2Zoinks = ethers.utils.parseEther('0.000040'); // zoinksToPay = 0.000040
    const buyer2BUSD = buyer2Zoinks;

    const buyer3Zoinks = ethers.utils.parseEther('0.000065'); // zoinksToPay = 0.000065
    const buyer3BUSD = buyer3Zoinks;

    const buyer4Zoinks = ethers.utils.parseEther('0.000090'); // zoinksToPay = 0.000145
    const buyer4BUSD = buyer4Zoinks;

    const buyer5Zoinks = ethers.utils.parseEther('0.000115'); // zoinksToPay = 0.000180
    const buyer5BUSD = buyer5Zoinks;

    // ACT
    let zoinksToPay = await snacks.calculatePayTokenAmountOnMint(ethers.utils.parseEther('5'));
    expect(zoinksToPay.toString()).to.be.equal(buyer1Zoinks.toString());
    await busd.mint(buyer1.address, buyer1BUSD); // Busd to buyer
    await busd.connect(buyer1).approve(zoinks.address, buyer1BUSD); // Approve buyer to zoinks contract
    await zoinks.connect(buyer1).mint(buyer1Zoinks); // Generate zoinks for buyer
    // 1 buy snacks
    await zoinks.connect(buyer1).approve(snacks.address, buyer1Zoinks);
    await snacks.connect(buyer1).mintWithBuyTokenAmount(amountSnacksToBuy);

    zoinksToPay = await snacks.calculatePayTokenAmountOnMint(ethers.utils.parseEther('5'));
    expect(zoinksToPay.toString()).to.be.equal(buyer2Zoinks.toString());
    await busd.mint(buyer2.address, buyer2BUSD); // Busd to buyer
    await busd.connect(buyer2).approve(zoinks.address, buyer2BUSD); // Approve buyer to zoinks contract
    await zoinks.connect(buyer2).mint(buyer2Zoinks); // Generate zoinks for buyer
    // 2 buy snacks
    await zoinks.connect(buyer2).approve(snacks.address, buyer2Zoinks);
    await snacks.connect(buyer2).mintWithBuyTokenAmount(amountSnacksToBuy);

    zoinksToPay = await snacks.calculatePayTokenAmountOnMint(ethers.utils.parseEther('5'));
    expect(zoinksToPay.toString()).to.be.equal(buyer3Zoinks.toString());
    await busd.mint(buyer3.address, buyer3BUSD); // Busd to buyer
    await busd.connect(buyer3).approve(zoinks.address, buyer3BUSD); // Approve buyer to zoinks contract
    await zoinks.connect(buyer3).mint(buyer3Zoinks); // Generate zoinks for buyer
    // 3 buy snacks
    await zoinks.connect(buyer3).approve(snacks.address, buyer3Zoinks);
    await snacks.connect(buyer3).mintWithBuyTokenAmount(amountSnacksToBuy);

    zoinksToPay = await snacks.calculatePayTokenAmountOnMint(ethers.utils.parseEther('5'));
    expect(zoinksToPay.toString()).to.be.equal(buyer4Zoinks.toString());
    await busd.mint(buyer4.address, buyer4BUSD); // Busd to buyer
    await busd.connect(buyer4).approve(zoinks.address, buyer4BUSD); // Approve buyer to zoinks contract
    await zoinks.connect(buyer4).mint(buyer4Zoinks); // Generate zoinks for buyer
    // 4 buy snacks
    await zoinks.connect(buyer4).approve(snacks.address, buyer4Zoinks);
    await snacks.connect(buyer4).mintWithBuyTokenAmount(amountSnacksToBuy);

    zoinksToPay = await snacks.calculatePayTokenAmountOnMint(ethers.utils.parseEther('5'));
    expect(zoinksToPay.toString()).to.be.equal(buyer5Zoinks.toString());
    await busd.mint(buyer5.address, buyer5BUSD); // Busd to buyer
    await busd.connect(buyer5).approve(zoinks.address, buyer5BUSD); // Approve buyer to zoinks contract
    await zoinks.connect(buyer5).mint(buyer5Zoinks); // Generate zoinks for buyer
    // 5 buy snacks
    await zoinks.connect(buyer5).approve(snacks.address, buyer5Zoinks);
    await snacks.connect(buyer5).mintWithBuyTokenAmount(amountSnacksToBuy);

    // Check buyed snacks
    const holder1SnacksResult = await snacks.balanceOf(buyer1.address);
    const holder1SnacksExpected = ethers.utils.parseEther('4.75');
    const holder2SnacksResult = await snacks.balanceOf(buyer2.address);
    const holder2SnacksExpected = ethers.utils.parseEther('4.75');
    const holder3SnacksResult = await snacks.balanceOf(buyer3.address);
    const holder3SnacksExpected = ethers.utils.parseEther('4.75');
    const holder4SnacksResult = await snacks.balanceOf(buyer4.address);
    const holder4SnacksExpected = ethers.utils.parseEther('4.75');
    const holder5SnacksResult = await snacks.balanceOf(buyer5.address);
    const holder5SnacksExpected = ethers.utils.parseEther('4.75');
    // Check undistributed fee after 5 buys
    const undistributedFeeSnacksResult = await snacks.balanceOf(snacks.address);
    const undistributedFeeSnacksExpected = ethers.utils.parseEther('1.25');
    // Try to distribute
    await snacks.connect(authority).distributeFee();
    // Check resul of distribution
    // 35% Pulse = 35% of 1.25 Snacks = 0.4375
    const pulseSnacksWithFeeResult = await snacks.balanceOf(pulse.address);
    const pulseSnacksWithFeeExpected = ethers.utils.parseEther('0.4375');
    // 45% PoolRewardDistributor = 45% of 1.25 Snacks = 0.5625
    const poolRewardDistributorSnacksWithFeeResult = await snacks.balanceOf(poolRewardDistributor.address);
    const poolRewardDistributorSnacksWithFeeExpected = ethers.utils.parseEther('0.5625');
    
    // 15% Snacks holders = 15% of 1.25 Snacks = 0.1875 to all holders = 0,16875 (90%) + 0,01875 (10%)
    // = 0,03375 by holder + 0,01875 by senyorage (total 5 buyers 90% + 1 senyorage 10%)
    // buyer buy 5 snacs and pay 5% = 5.00 - 5% = 4.75
    // And after distribute fee buyer has 4.75 + fee = 4,75 + 0,03375 = 4,78375
    const holder1SnacksWithFeeResult = await snacks.balanceOf(buyer1.address);
    const holder1SnacksWithFeeExpected = ethers.utils.parseEther('4.78375');
    const holder2SnacksWithFeeResult = await snacks.balanceOf(buyer2.address);
    const holder2SnacksWithFeeExpected = ethers.utils.parseEther('4.78375');
    const holder3SnacksWithFeeResult = await snacks.balanceOf(buyer3.address);
    const holder3SnacksWithFeeExpected = ethers.utils.parseEther('4.78375');
    const holder4SnacksWithFeeResult = await snacks.balanceOf(buyer4.address);
    const holder4SnacksWithFeeExpected = ethers.utils.parseEther('4.78375');
    const holder5SnacksWithFeeResult = await snacks.balanceOf(buyer5.address);
    const holder5SnacksWithFeeExpected = ethers.utils.parseEther('4.78375');
    // Senyorage is holder. Result of distribue fee:
    // 5% Seniorage = 5% of 1.25 Snacks = 0.0625 + 0,01875 like 10% of holders = 0,08125
    const seniorageSnacksWithFeeResult = await snacks.balanceOf(seniorage.address);
    const seniorageSnacksWithFeeExpected = ethers.utils.parseEther('0.08125');

    // ASSERT
    expect(holder1SnacksExpected.toString()).to.be.equal(holder1SnacksResult.toString());
    expect(holder2SnacksExpected.toString()).to.be.equal(holder2SnacksResult.toString());
    expect(holder3SnacksExpected.toString()).to.be.equal(holder3SnacksResult.toString());
    expect(holder4SnacksExpected.toString()).to.be.equal(holder4SnacksResult.toString());
    expect(holder5SnacksExpected.toString()).to.be.equal(holder5SnacksResult.toString());
    expect(undistributedFeeSnacksExpected.toString()).to.be.equal(undistributedFeeSnacksResult.toString());

    expect(pulseSnacksWithFeeExpected.toString()).to.be.equal(pulseSnacksWithFeeResult.toString());
    expect(poolRewardDistributorSnacksWithFeeExpected.toString()).to.be.equal(poolRewardDistributorSnacksWithFeeResult.toString());
    expect(seniorageSnacksWithFeeExpected.toString()).to.be.equal(seniorageSnacksWithFeeResult.toString());

    expect(holder1SnacksWithFeeExpected).to.be.closeTo(holder1SnacksWithFeeResult, 5);
    expect(holder2SnacksWithFeeExpected).to.be.closeTo(holder2SnacksWithFeeResult, 5);
    expect(holder3SnacksWithFeeExpected).to.be.closeTo(holder3SnacksWithFeeResult, 5);
    expect(holder4SnacksWithFeeExpected).to.be.closeTo(holder4SnacksWithFeeResult, 5);
    expect(holder5SnacksWithFeeExpected).to.be.closeTo(holder5SnacksWithFeeResult, 5);
  });
  
  it("Successful snapshot logic", async () => {
    // Transfer 100k BUSD/BTC/ETH to buyer1
    const buyAmount = ethers.utils.parseEther("100000");
    await busd.transfer(buyer1.address, buyAmount);
    await btc.transfer(buyer1.address, buyAmount);
    await eth.transfer(buyer1.address, buyAmount);
    await busd.transfer(buyer3.address, buyAmount);
    await btc.transfer(buyer3.address, buyAmount);
    await eth.transfer(buyer3.address, buyAmount);
    // Buying 95K SNACK
    await busd.connect(buyer1).approve(zoinks.address, buyAmount);
    await zoinks.connect(buyer1).mint(buyAmount);
    await zoinks.connect(buyer1).approve(snacks.address, buyAmount);
    await snacks.connect(buyer1).mintWithBuyTokenAmount(buyAmount);
    expect(await snacks.balanceOf(buyer1.address)).to.equal(buyAmount.mul(95).div(100));
    // Buying 95K BSNACK
    await btc.connect(buyer1).approve(btcSnacks.address, buyAmount);
    await btcSnacks.connect(buyer1).mintWithBuyTokenAmount(buyAmount);
    expect(await btcSnacks.balanceOf(buyer1.address)).to.equal(buyAmount.mul(95).div(100));
    // Buying 95K ETSNACK
    await eth.connect(buyer1).approve(ethSnacks.address, buyAmount);
    await ethSnacks.connect(buyer1).mintWithBuyTokenAmount(buyAmount);
    expect(await ethSnacks.balanceOf(buyer1.address)).to.equal(buyAmount.mul(95).div(100));
    // Distribute fee, ID = 1
    await btcSnacks.connect(authority).distributeFee();
    await ethSnacks.connect(authority).distributeFee();
    await snacks.connect(authority).distributeFee();
    const buyer1BalanceFirstSnapshot = await snacks.balanceAndDepositOf(buyer1.address);
    const buyer2BalanceFirstSnapshot = await snacks.balanceAndDepositOf(buyer2.address);
    // Check contract logic
    expect(await snacks.getCurrentSnapshotId()).to.equal(1);
    expect(await snacks.getAvailableBtcSnacksOffsetByAccount(buyer1.address)).to.equal(1);
    expect(await snacks.getAvailableEthSnacksOffsetByAccount(buyer1.address)).to.equal(1);
    // Check pending comission
    let response = await snacks.connect(buyer1)["getPendingBtcSnacks()"]();
    expect(response[1]).to.be.closeTo(await btcSnacks.balanceOf(snacks.address), 1000);
    response = await snacks.connect(buyer1)["getPendingEthSnacks()"]();
    expect(response[1]).to.be.closeTo(await ethSnacks.balanceOf(snacks.address), 1000);
    // Withdraw comission
    let previousBalance = await btcSnacks.balanceOf(buyer1.address);
    await snacks.connect(buyer1)["withdrawBtcSnacks()"]();
    expect((await btcSnacks.balanceOf(buyer1.address)).sub(previousBalance)).to.be.closeTo(response[1], 1);
    await snacks.connect(buyer1)["withdrawEthSnacks()"]();
    expect((await ethSnacks.balanceOf(buyer1.address)).sub(previousBalance)).to.be.closeTo(response[1], 1);
    // Transfer 95K SNACK to buyer2
    await snacks.connect(buyer1).transfer(buyer2.address, await snacks.balanceOf(buyer1.address));
    // Check pending from buyer2
    response = await snacks.connect(buyer2)["getPendingBtcSnacks()"]();
    expect(response[1]).to.be.equal(0);
    response = await snacks.connect(buyer2)["getPendingEthSnacks()"]();
    expect(response[1]).to.be.equal(0);
    // Buying 95K BSNACK from buyer3
    await btc.connect(buyer3).approve(btcSnacks.address, buyAmount);
    await btcSnacks.connect(buyer3).mintWithBuyTokenAmount(buyAmount);
    // Buying 95K ETSNACK from buyer3
    await eth.connect(buyer3).approve(ethSnacks.address, buyAmount);
    await ethSnacks.connect(buyer3).mintWithBuyTokenAmount(buyAmount);
    // Distribute fee, ID = 2
    await btcSnacks.connect(authority).distributeFee();
    await ethSnacks.connect(authority).distributeFee();
    await snacks.connect(authority).distributeFee();
    const buyer1BalanceSecondSnapshot = await snacks.balanceAndDepositOf(buyer1.address);
    const buyer2BalanceSecondSnapshot = await snacks.balanceAndDepositOf(buyer2.address);
    // Check pending from buyer1
    response = await snacks.connect(buyer1)["getPendingBtcSnacks()"]();
    expect(response[1]).to.equal(0);
    response = await snacks.connect(buyer1)["getPendingEthSnacks()"]();
    expect(response[1]).to.equal(0);
    // Check pending from buyer2
    response = await snacks.connect(buyer2)["getPendingBtcSnacks()"]();
    expect(response[1]).to.be.closeTo(await btcSnacks.balanceOf(snacks.address), 1500);
    response = await snacks.connect(buyer2)["getPendingEthSnacks()"]();
    expect(response[1]).to.be.closeTo(await ethSnacks.balanceOf(snacks.address), 1500);
    // Check historical balances
    expect(buyer1BalanceFirstSnapshot).to.equal(await snacks.balanceAndDepositOfAt(buyer1.address, 1));
    expect(buyer2BalanceFirstSnapshot).to.equal(await snacks.balanceAndDepositOfAt(buyer2.address, 1));
    expect(buyer1BalanceSecondSnapshot).to.equal(await snacks.balanceAndDepositOfAt(buyer1.address, 2));
    expect(buyer2BalanceSecondSnapshot).to.equal(await snacks.balanceAndDepositOfAt(buyer2.address, 2));
    //expect(await snacks.balanceAndDepositOfAt(buyer1.address), 1);
  });

  it("Test configure", async () => {
    // ARRANGE
    // ACT
    snacks.configure(zoinks.address, pulse.address, poolRewardDistributor.address, seniorage.address,
      authority.address, btcSnacks.address, ethSnacks.address, snacksPool.address, pancakeSwapPool.address, lunchBox.address);
    // Test excluded holders is removed by for. Is needed for test coverage
    snacks.configure(zoinks.address, pulse.address, poolRewardDistributor.address, seniorage.address,
      authority.address, btcSnacks.address, ethSnacks.address, snacksPool.address, pancakeSwapPool.address, lunchBox.address);
    // ASSERT
  });
});
