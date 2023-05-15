const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, deployments } = hre;
const { ZERO } = require("../deploy/helpers");
const snacksBaseTestSuite = require('../reusable_test_suits/snacks_base_test_suite.js');

describe("Snacks", () => {

  // Signers
  let owner;

  // Contracts
  let zoinks;
  let snacks;
  let busd;

  beforeEach(async () => {
    await deployments.fixture(['snacks_test_fixtures']);
    [owner, authority, bob] = await ethers.getSigners();
    zoinks = await ethers.getContractAt(
      hre.names.internal.zoinks,
      (await deployments.get(hre.names.internal.zoinks)).address
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
  });

  const payTokenMintingAction = async (who, amount, payToken) => {
    await busd.mint(who.address, amount);
    await busd.approve(payToken.address, amount);
    await payToken.mint(amount);
    if (who.address !== owner.address) {
      await payToken.transfer(who.address, amount);
    }
  }

  const testCases = snacksBaseTestSuite(
    [1, 2, 3, 4, 5, 6, 9, 10],
    async () => await ethers.getContractAt(
      hre.names.internal.snacks,
      (await deployments.get(hre.names.internal.snacks)).address
    ),
    async () => await ethers.getContractAt(
      hre.names.internal.zoinks,
      (await deployments.get(hre.names.internal.zoinks)).address
    ),
    payTokenMintingAction
  );

  // 2. Check how many <token> we need to pay for 5 new <any>Snacks
  testCases[1](ethers.BigNumber.from('15000000000000'));

  // 3. Buy 5 new <any>Snacks and pay with 0.00000015 <token>. And check undistributed 5% mintWithBuyTokenAmount fee 0.25 <any>Snacks
  testCases[2](ethers.BigNumber.from('7000015000000000000'));

  // 4. Check how many <token> we need to return for 4.75 of total 5 <any>Snacks
  testCases[3](ethers.BigNumber.from('15009537823560035'));

  // 5. Check how many <token> we need to return for 6 of total 7 <any>Snacks
  testCases[4](ethers.BigNumber.from('22431944521089576'));

  // 6. Redeem 4.75 <any>Snacks and get <token>. And check undistributed 5% mintWithBuyTokenAmount + 10% redeem fee 0.50 <any>Snacks
  testCases[5](
    ethers.BigNumber.from('15000000000000'),
    ethers.BigNumber.from('14374687500000')
  );

  // 9. First we have 5 buyers of <any>Snacks, then distribute undistributed fee
  testCases[6](
    ethers.BigNumber.from('15000000000000'),
    ethers.BigNumber.from('40000000000000'),
    ethers.BigNumber.from('65000000000000'),
    ethers.BigNumber.from('90000000000000'),
    ethers.BigNumber.from('115000000000000'),
    ethers.utils.parseEther('0.4375'),
    ZERO,
    ethers.utils.parseEther('0.08125'),
    ethers.BigNumber.from('100000000000000000')
  );

  testCases[9]("SNACK");

  testCases[10]("Snacks");

  it("Check how many Snacks we mint, with 0.000015 Zoinks", async () => {
    // ACT
    const amountZoinksToSpend = ethers.utils.parseEther('0.000015');
    const snacksResult = await snacks.calculateBuyTokenAmountOnMint(amountZoinksToSpend);
    const snacksExpected = ethers.BigNumber.from('5000000000000000000');

    // ASSERT
    expect(snacksResult).to.be.equal(snacksExpected);
  });

  it("Check how many Snacks we mint, with 1 Zoinks and 5 Snacks already minted", async () => {
    // Current price
    const amountSnacksToMint = ethers.utils.parseEther('5');

    const zoinksCurrentPriceResult = await snacks.calculatePayTokenAmountOnMint(amountSnacksToMint);
    const zoinksCurrentPriceExpected = ethers.utils.parseEther('0.000015');
    // New price
    const amountZoinksToSpend = ethers.utils.parseEther('1');
    const currentTotalSupply = ethers.utils.parseEther('5');
    await busd.mint(owner.address, currentTotalSupply);
    await busd.approve(zoinks.address, currentTotalSupply);
    await zoinks.mint(currentTotalSupply);
    await zoinks.approve(snacks.address, currentTotalSupply);

    let snacksResult = await snacks.calculateBuyTokenAmountOnMint(amountZoinksToSpend);
    await snacks.mintWithPayTokenAmount(amountZoinksToSpend);
    const snacksExpected = ethers.BigNumber.from('1343027968223367525000');

    // ASSERT
    expect(zoinksCurrentPriceResult).to.be.equal(zoinksCurrentPriceExpected);
    expect(snacksResult.mul(95).div(100)).to.be.equal(snacksExpected);
  });

  it("Check big number os Zoinks to mintWithBuyTokenAmount Snacks calculation of TOTAL to mintWithBuyTokenAmount", async () => {
    // ACT
    const amountZoinksToSpend = ethers.BigNumber.from("50055015000000000000"); // 50.055015
    const currentTotalSupply = ethers.utils.parseEther('5');
    await payTokenMintingAction(owner, currentTotalSupply, zoinks);
    await zoinks.approve(snacks.address, currentTotalSupply);
    await snacks.mintWithBuyTokenAmount(currentTotalSupply);
    const snacksResult = await snacks.calculateBuyTokenAmountOnMint(amountZoinksToSpend);
    const snacksExpected = ethers.utils.parseEther('10000');

    // ASSERT
    expect(snacksResult).to.be.closeTo(snacksExpected, '1500000000000000');
  });

  it("Check very big number os Zoinks to mintWithBuyTokenAmount Snacks calculation of TOTAL to mintWithBuyTokenAmount", async () => {
    // ACT
    // Max zoinks to spend: 8361,00
    // Max snacks to mint: 129313
    const amountZoinksToSpend = ethers.BigNumber.from("8361000000000000000000"); // 500005.5
    const currentTotalSupply = ethers.utils.parseEther('5');
    await payTokenMintingAction(owner, currentTotalSupply, zoinks);
    await zoinks.approve(snacks.address, currentTotalSupply);
    const snacksResult = await snacks.calculateBuyTokenAmountOnMint(amountZoinksToSpend);
    const snacksExpected = ethers.utils.parseEther('129313');

    // ASSERT
    expect(snacksResult).to.be.closeTo(snacksExpected, '72400000000000000');
  });

  it("Successful notifyBtcSnacksAmount() execution", async () => {
    // Call from not the BtcSnacks contract
    await expect(snacks.notifyBtcSnacksFeeAmount(0)).to.be.reverted;
    // Call from the right address
    await snacks.configure(
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address
    );
    // Check
    await expect(snacks.notifyBtcSnacksFeeAmount(100))
      .to.emit(snacks, "BtcSnacksFeeAdded")
      .withArgs(100);
  });

  it("Successful notifyEthSnacksAmount() execution", async () => {
    // Call from not the BtcSnacks contract
    await expect(snacks.notifyEthSnacksFeeAmount(0)).to.be.reverted;
    // Call from the right address
    await snacks.configure(
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      
      owner.address
    );
    // Check
    await expect(snacks.notifyEthSnacksFeeAmount(100))
      .to.emit(snacks, "EthSnacksFeeAdded")
      .withArgs(100);
  });

  it("Successful withdrawBtcSnacks() execution (without offset)", async () => {
    const buyAmount = ethers.utils.parseEther("100");
    // Buying BtcSnacks
    await btc.approve(btcSnacks.address, buyAmount);
    await btcSnacks.mintWithPayTokenAmount(buyAmount);
    // Buying EthSnacks
    await eth.approve(ethSnacks.address, buyAmount);
    await ethSnacks.mintWithPayTokenAmount(buyAmount);
    // Buying Zoinks and Snacks
    await busd.approve(zoinks.address, buyAmount);
    await zoinks.mint(buyAmount);
    await zoinks.approve(snacks.address, buyAmount);
    await snacks.mintWithPayTokenAmount(buyAmount);
    // Distribute fee
    await btcSnacks.connect(authority).distributeFee();
    await ethSnacks.connect(authority).distributeFee();
    await snacks.connect(authority).distributeFee();
    // Withdraw BtcSnacks from Snacks contract
    const balanceBefore = await btcSnacks.balanceOf(owner.address);
    const response = await snacks["getPendingBtcSnacks()"]();
    const balanceExpected = balanceBefore.add(response[1]);
    await snacks["withdrawBtcSnacks()"]();
    await snacks["withdrawBtcSnacks()"]();
    expect(await btcSnacks.balanceOf(owner.address)).to.equal(balanceExpected);
  });

  it("Successful withdrawBtcSnacks() execution (with offset)", async () => {
    const buyAmount = ethers.utils.parseEther("100");
    // Buying BtcSnacks
    await btc.approve(btcSnacks.address, buyAmount);
    await btcSnacks.mintWithPayTokenAmount(buyAmount);
    // Buying EthSnacks
    await eth.approve(ethSnacks.address, buyAmount);
    await ethSnacks.mintWithPayTokenAmount(buyAmount);
    // Buying Zoinks and Snacks
    await busd.approve(zoinks.address, buyAmount);
    await zoinks.mint(buyAmount);
    await zoinks.approve(snacks.address, buyAmount);
    await snacks.mintWithPayTokenAmount(buyAmount);
    // Distribute fee
    await btcSnacks.connect(authority).distributeFee();
    await ethSnacks.connect(authority).distributeFee();
    await snacks.connect(authority).distributeFee();
    // Withdraw BtcSnacks from Snacks contract
    const balanceBefore = await btcSnacks.balanceOf(owner.address);
    await expect(snacks["getPendingBtcSnacks(uint256)"](3)).to.be.revertedWith("Snacks: invalid offset");
    const response = await snacks["getPendingBtcSnacks(uint256)"](1);
    const balanceExpected = balanceBefore.add(response[1]);
    await snacks["withdrawBtcSnacks(uint256)"](1);
    expect(await btcSnacks.balanceOf(owner.address)).to.equal(balanceExpected);
  });

  it("Successful withdrawEthSnacks() execution (without offset)", async () => {
    const buyAmount = ethers.utils.parseEther("100");
    // Buying BtcSnacks
    await btc.approve(btcSnacks.address, buyAmount);
    await btcSnacks.mintWithPayTokenAmount(buyAmount);
    // Buying EthSnacks
    await eth.approve(ethSnacks.address, buyAmount);
    await ethSnacks.mintWithPayTokenAmount(buyAmount);
    // Buying Zoinks and Snacks
    await busd.approve(zoinks.address, buyAmount);
    await zoinks.mint(buyAmount);
    await zoinks.approve(snacks.address, buyAmount);
    await snacks.mintWithPayTokenAmount(buyAmount);
    // Distribute fee
    await btcSnacks.connect(authority).distributeFee();
    await ethSnacks.connect(authority).distributeFee();
    await snacks.connect(authority).distributeFee();
    // Withdraw BtcSnacks from Snacks contract
    const balanceBefore = await ethSnacks.balanceOf(owner.address);
    const response = await snacks["getPendingEthSnacks()"]();
    const balanceExpected = balanceBefore.add(response[1]);
    await snacks["withdrawEthSnacks()"]();
    await snacks["withdrawEthSnacks()"]();
    expect(await ethSnacks.balanceOf(owner.address)).to.equal(balanceExpected);
  });

  it("Successful withdrawEthSnacks() execution (with offset)", async () => {
    const buyAmount = ethers.utils.parseEther("100");
    // Buying BtcSnacks
    await btc.approve(btcSnacks.address, buyAmount);
    await btcSnacks.mintWithPayTokenAmount(buyAmount);
    // Buying EthSnacks
    await eth.approve(ethSnacks.address, buyAmount);
    await ethSnacks.mintWithPayTokenAmount(buyAmount);
    // Buying Zoinks and Snacks
    await busd.approve(zoinks.address, buyAmount);
    await zoinks.mint(buyAmount);
    await zoinks.approve(snacks.address, buyAmount);
    await snacks.mintWithPayTokenAmount(buyAmount);
    // Distribute fee
    await btcSnacks.connect(authority).distributeFee();
    await ethSnacks.connect(authority).distributeFee();
    await snacks.connect(authority).distributeFee();
    // Withdraw BtcSnacks from Snacks contract
    const balanceBefore = await ethSnacks.balanceOf(owner.address);
    await expect(snacks["getPendingEthSnacks(uint256)"](3)).to.be.revertedWith("Snacks: invalid offset");
    const response = await snacks["getPendingEthSnacks(uint256)"](1);
    const balanceExpected = balanceBefore.add(response[1]);
    await snacks["withdrawEthSnacks(uint256)"](1);
    expect(await ethSnacks.balanceOf(owner.address)).to.equal(balanceExpected);
  });

  it("Successful balanceAndDepositOfAt() execution", async () => {
    const buyAmount = ethers.utils.parseEther("100");
    // Buying Zoinks and Snacks
    await busd.approve(zoinks.address, buyAmount);
    await zoinks.mint(buyAmount);
    await zoinks.approve(snacks.address, buyAmount);
    await snacks.mintWithPayTokenAmount(buyAmount);
    await expect(snacks.balanceAndDepositOfAt(owner.address, 0)).to.be.revertedWith("Snacks: id is 0");
    await expect(snacks.balanceAndDepositOfAt(owner.address, 1)).to.be.revertedWith("Snacks: nonexistent id");
    // Distribute fee
    await btcSnacks.connect(authority).distributeFee();
    await ethSnacks.connect(authority).distributeFee();
    await snacks.connect(authority).distributeFee();
    // Check balance
    expect(await snacks.balanceAndDepositOfAt(owner.address, 1)).to.equal(await snacks.balanceOf(owner.address));
  }); 
});