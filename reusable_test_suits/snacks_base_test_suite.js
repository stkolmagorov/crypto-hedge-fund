const { expect } = require("chai");
const { ethers, deployments, getNamedAccounts } = require("hardhat");
const { ZERO_ADDRESS, ZERO } = require("../deploy/helpers");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const startImpersonating = async (address) => {
  await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address]
  });
  await hre.network.provider.send("hardhat_setBalance", [address, ethers.utils.parseEther("1000.0").toHexString().replace("0x0", "0x")]);
}

module.exports = (
  disabledTestCaseIndicies,
  snacksInstanceAcquiringAction,
  tokenInstanceAcquiringAction,
  payTokenMintingAction
) => {
  const decimals = 18;

  let owner;
  let buyer1;
  let buyer2;
  let buyer3;
  let buyer4;
  let buyer5;
  let seller;

  let zoinks;
  let token;
  let anySnacks;
  let seniorage;
  let pulse;
  let snacks;

  const mintSnacksThroughPayToken = async (buyer, tokenToPay) => {
    await payTokenMintingAction(buyer, tokenToPay, token);
    await token.connect(buyer).approve(anySnacks.address, tokenToPay);
    await anySnacks.connect(buyer).mintWithPayTokenAmount(tokenToPay);
  }
  const mintSnacksThroughBuyToken = async (buyer, tokenToPay, amountToBuy) => {
    await payTokenMintingAction(buyer, tokenToPay, token);
    await token.connect(buyer).approve(anySnacks.address, tokenToPay);
    await anySnacks.connect(buyer).mintWithBuyTokenAmount(amountToBuy);
  }

  beforeEach(async () => {
    [
      owner,
      buyer1,
      buyer2,
      buyer3,
      buyer4,
      buyer5,
      seller
    ] = await ethers.getSigners();
    zoinks = await ethers.getContractAt(
      "Zoinks",
      (await deployments.get("Zoinks")).address
    );
    seniorage = await ethers.getContractAt(
      "Seniorage",
      (await deployments.get("Seniorage")).address
    );
    pulse = await ethers.getContractAt(
      "Pulse",
      (await deployments.get("Pulse")).address
    );
    snacks = await ethers.getContractAt(
      "Snacks",
      (await deployments.get("Snacks")).address
    );
    token = await tokenInstanceAcquiringAction();
    anySnacks = await snacksInstanceAcquiringAction();
  });

  const testCases = [
    () => it("Check after deploy we don't have any total supply of <any>Snacks", async () => {
      expect(await anySnacks.totalSupply()).to.be.equal(ZERO);
    }),

    (overridenExpectedValue) => it("Check how many <token> we need to pay for 5 new <any>Snacks", async () => {
      // newLastSnack min ONE_SNACK
      // for redeem also min ONE_SNACK
      expect(await anySnacks.calculatePayTokenAmountOnMint(
        ethers.utils.parseEther('5')
      )).to.be.equal(
        overridenExpectedValue || ethers.BigNumber.from('150000000000')
      );
    }),

    (overridenBuyerBTCInitial) => it("Buy 5 new <any>Snacks and pay with 0.00000015 <token>. And check undistributed 5% buy fee 0.25 <any>Snacks", async () => {
      // ARRANGE
      const amountBtcSnacksToBuy = ethers.utils.parseEther('5');
      // const buyerBTCInitial = ethers.BigNumber.from('7000000150000000000'); // tokenToPay = 0.00000015
      const buyerBTCInitial = overridenBuyerBTCInitial || ethers.BigNumber.from('7000000150000000000'); // tokenToPay = 0.00000015
      await payTokenMintingAction(buyer1, buyerBTCInitial, token);
      // Check minted <token> to buyer
      const buyerBTCMintedResult = await token.balanceOf(buyer1.address);

      expect(buyerBTCInitial).to.be.equal(buyerBTCMintedResult);

      // Check buy Snacks by buyer
      await token.connect(buyer1).approve(anySnacks.address, buyerBTCMintedResult);
      await anySnacks.connect(buyer1).mintWithBuyTokenAmount(amountBtcSnacksToBuy);
      const buyerBTCExpected = ethers.utils.parseEther('7');
      const buyerBTCResult = await token.balanceOf(buyer1.address);
      // Check bought snacks
      const boughtBtcSnacksResult = await anySnacks.balanceOf(buyer1.address);
      const boughtBtcSnacksExpected = ethers.utils.parseEther((5 - 5 / 100 * 5).toString()); // 5 Snacks - 5% buy fee
      // Check undistributedFeeSnacks
      const undistributedFeeSnacksResult = await anySnacks.balanceOf(anySnacks.address);
      const undistributedFeeSnacksExpected = ethers.utils.parseEther("0.25");

      // ASSERT
      expect(buyerBTCResult).to.be.equal(buyerBTCExpected);
      expect(boughtBtcSnacksResult).to.be.equal(boughtBtcSnacksExpected);
      expect(undistributedFeeSnacksResult).to.be.equal(undistributedFeeSnacksExpected);
    }),

    (overridenTokenToReturnExpected) => it("Check how many <token> we need to return for 4.75 of total 5 <any>Snacks", async () => {
      // ACT
      const amountBtcSnacksToBurn = ethers.utils.parseEther('4.75');
      const currentTotalSupply = ethers.utils.parseEther('5');
      await mintSnacksThroughPayToken(owner, currentTotalSupply);
      const tokenToReturnResult = await anySnacks.calculatePayTokenAmountOnRedeem(amountBtcSnacksToBurn);
      const tokenToReturnExpected = overridenTokenToReturnExpected || ethers.BigNumber.from('1501969076267738');

      // ASSERT
      expect(tokenToReturnResult).to.be.equal(tokenToReturnExpected);
    }),

    (overridenTokenToReturnExpected) => it("Check how many <token> we need to return for 6 of total 7 <any>Snacks", async () => {
      // ACT
      const amountBtcSnacksToBurn = ethers.utils.parseEther('6');
      const currentTotalSupply = ethers.utils.parseEther('7');
      await mintSnacksThroughPayToken(owner, currentTotalSupply);
      const tokenToReturnResult = await anySnacks.calculatePayTokenAmountOnRedeem(amountBtcSnacksToBurn);
      const tokenToReturnExpected = overridenTokenToReturnExpected || ethers.BigNumber.from('2244814432264809');

      // ASSERT
      expect(tokenToReturnResult).to.be.equal(tokenToReturnExpected);
    }),

    (
      overridenBuyerBTC,
      overridenSellerBTCExpected
    ) => it("Redeem 4.75 <any>Snacks and get <token>. And check undistributed 5% buy + 10% redeem fee 0.50 <any>Snacks", async () => {
      // ACT
      // Step 1: buy Snacks
      const amountBtcSnacksToBuy = ethers.utils.parseEther('5');
      // Mint <token> for buy Snacks
      const buyerBTC = overridenBuyerBTC || ethers.BigNumber.from('150000000000'); // tokenToPay = 0.00000015
      await payTokenMintingAction(seller, buyerBTC, token);
      // Buy Snacks by seller
      await token.connect(seller).approve(anySnacks.address, buyerBTC);
      await anySnacks.connect(seller).mintWithBuyTokenAmount(amountBtcSnacksToBuy);
      // Buyed snacks at this moment = 5 - 5% = 4.75 Snacks

      // Step 2: redeem Snacks
      const amountBtcSnacksToRedeem = ethers.utils.parseEther('4.75');
      const sellerBTCExpected = overridenSellerBTCExpected || ethers.BigNumber.from('143746875000');
      // Redeem Snacks by seller
      await anySnacks.connect(seller).redeem(amountBtcSnacksToRedeem);
      const sellerBTCResult = await token.balanceOf(seller.address);

      // Check undistributedFeeSnacks
      const undistributedFeeSnacksResult = await anySnacks.balanceOf(anySnacks.address);
      const undistributedFeeSnacksExpected = ethers.utils.parseEther((0.25 + 0.475).toString()); // 0.25 buy fee, 0.475 redeem fee

      // ASSERT
      expect(sellerBTCResult).to.be.equal(sellerBTCExpected);
      expect(undistributedFeeSnacksResult).to.be.equal(undistributedFeeSnacksExpected);
    }),

    (
      overridenBuyer1BTC,
      overridenBuyer2BTC,
      overridenBuyer3BTC,
      overridenBuyer4BTC,
      overridenBuyer5BTC,
      overridenPulseBtcSnacksWithFeeExpected,
      overridenSnacksBtcSnacksWithFeeExpected,
      overridenSeniorageBtcSnacksWithFeeExpected,
      overridenTolerance
    ) => it("First we have 5 buyers of <any>Snacks, then distribute undistributed fee", async () => {
      // ACT
      const amountBtcSnacksToBuy = ethers.utils.parseEther('5'); // total supply 0

      const buyer1BTC = overridenBuyer1BTC || ethers.BigNumber.from('150000000000'); // tokenToPay = 0.00000015
      await mintSnacksThroughBuyToken(buyer1, buyer1BTC, amountBtcSnacksToBuy);

      const buyer2BTC = overridenBuyer2BTC || ethers.BigNumber.from('400000000000'); // tokenToPay = 0.00000040
      await mintSnacksThroughBuyToken(buyer2, buyer2BTC, amountBtcSnacksToBuy);

      const buyer3BTC = overridenBuyer3BTC || ethers.BigNumber.from('650000000000'); // tokenToPay = 0.00000065
      await mintSnacksThroughBuyToken(buyer3, buyer3BTC, amountBtcSnacksToBuy);

      const buyer4BTC = overridenBuyer4BTC || ethers.BigNumber.from('900000000000'); // tokenToPay = 0.00000090
      await mintSnacksThroughBuyToken(buyer4, buyer4BTC, amountBtcSnacksToBuy);

      const buyer5BTC = overridenBuyer5BTC || ethers.BigNumber.from('1150000000000'); // tokenToPay = 0.00000115
      await mintSnacksThroughBuyToken(buyer5, buyer5BTC, amountBtcSnacksToBuy);

      // // Check bought snacks
      const balance1BtcSnacksResult = await anySnacks.balanceOf(buyer1.address);
      const balance1BtcSnacksExpected = ethers.utils.parseEther('4.75');
      const balance2BtcSnacksResult = await anySnacks.balanceOf(buyer2.address);
      const balance2BtcSnacksExpected = ethers.utils.parseEther('4.75');
      const balance3BtcSnacksResult = await anySnacks.balanceOf(buyer3.address);
      const balance3BtcSnacksExpected = ethers.utils.parseEther('4.75');
      const balance4BtcSnacksResult = await anySnacks.balanceOf(buyer4.address);
      const balance4BtcSnacksExpected = ethers.utils.parseEther('4.75');
      const balance5BtcSnacksResult = await anySnacks.balanceOf(buyer5.address);
      const balance5BtcSnacksExpected = ethers.utils.parseEther('4.75');
      // Check undistributed fee after 5 buys
      const undistributedFeeBtcSnacksResult = await anySnacks.balanceOf(anySnacks.address);
      const undistributedFeeBtcSnacksExpected = ethers.utils.parseEther('1.25');
      // Try to distribute
      // buyer4 is an authority see the config namedAccounts object
      await anySnacks.connect(buyer1).distributeFee();
      // Check resul of distribution
      // 15% PULSE = 15% of 1.25 <any>Snacks = 0.1875
      const pulseBtcSnacksWithFeeResult = await anySnacks.balanceOf(pulse.address);
      const pulseBtcSnacksWithFeeExpected = overridenPulseBtcSnacksWithFeeExpected || ethers.utils.parseEther('0.1875');

      // 15% Snacks holders = 15% of 1.25 <any>Snacks = 0.1875
      const snacksBtcSnacksWithFeeResult = await anySnacks.balanceOf(snacks.address);
      const snacksBtcSnacksWithFeeExpected = overridenSnacksBtcSnacksWithFeeExpected || ethers.utils.parseEther('0.1875');

      // 15% seniorage = 15% of 1.25 <any>Snacks = 0.1875 + 0.025 of <any>Snacks for seniorage from undistributed fees
      const seniorageBtcSnacksWithFeeResult = await anySnacks.balanceOf(seniorage.address);
      const seniorageBtcSnacksWithFeeExpected = overridenSeniorageBtcSnacksWithFeeExpected || ethers.utils.parseEther('0.2125');

      // 20% <any>Snacks holders = 20% of 1.25 <any>Snacks = 0.25 to all holders = ~0.05 by holder (total 5), result bought 4.75 + 0.05
      const balance1BtcSnacksWithFeeResult = await anySnacks.balanceOf(buyer1.address);
      const balance1BtcSnacksWithFeeExpected = ethers.utils.parseEther('4.8');
      const balance2BtcSnacksWithFeeResult = await anySnacks.balanceOf(buyer2.address);
      const balance2BtcSnacksWithFeeExpected = ethers.utils.parseEther('4.8');
      const balance3BtcSnacksWithFeeResult = await anySnacks.balanceOf(buyer3.address);
      const balance3BtcSnacksWithFeeExpected = ethers.utils.parseEther('4.8');
      const balance4BtcSnacksWithFeeResult = await anySnacks.balanceOf(buyer4.address);
      const balance4BtcSnacksWithFeeExpected = ethers.utils.parseEther('4.8');
      const balance5BtcSnacksWithFeeResult = await anySnacks.balanceOf(buyer5.address);
      const balance5BtcSnacksWithFeeExpected = ethers.utils.parseEther('4.8');

      // ASSERT
      expect(balance1BtcSnacksResult).to.be.equal(balance1BtcSnacksExpected);
      expect(balance2BtcSnacksResult).to.be.equal(balance2BtcSnacksExpected);
      expect(balance3BtcSnacksResult).to.be.equal(balance3BtcSnacksExpected);
      expect(balance4BtcSnacksResult).to.be.equal(balance4BtcSnacksExpected);
      expect(balance5BtcSnacksResult).to.be.equal(balance5BtcSnacksExpected);
      expect(undistributedFeeBtcSnacksResult).to.be.equal(undistributedFeeBtcSnacksExpected);

      expect(pulseBtcSnacksWithFeeResult).to.be.equal(pulseBtcSnacksWithFeeExpected);
      expect(snacksBtcSnacksWithFeeResult).to.be.equal(snacksBtcSnacksWithFeeExpected);

      expect(seniorageBtcSnacksWithFeeResult).to.be.equal(seniorageBtcSnacksWithFeeExpected);

      const tolerance = overridenTolerance || ethers.BigNumber.from('10000000000000000');

      expect(balance1BtcSnacksWithFeeResult).to.be.closeTo(balance1BtcSnacksWithFeeExpected, tolerance);
      expect(balance2BtcSnacksWithFeeResult).to.be.closeTo(balance2BtcSnacksWithFeeExpected, tolerance);
      expect(balance3BtcSnacksWithFeeResult).to.be.closeTo(balance3BtcSnacksWithFeeExpected, tolerance);
      expect(balance4BtcSnacksWithFeeResult).to.be.closeTo(balance4BtcSnacksWithFeeExpected, tolerance);
      expect(balance5BtcSnacksWithFeeResult).to.be.closeTo(balance5BtcSnacksWithFeeExpected, tolerance);
    }),

    () => it("Successful pause() execution", async () => {
      await expect(anySnacks.connect(buyer1).pause()).to.be.reverted;
      await expect(anySnacks.pause())
        .to.emit(anySnacks, "Paused")
        .withArgs(owner.address);
      await expect(
        mintSnacksThroughPayToken(owner, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("Pausable: paused");
    }),

    () => it("Successful unpause() execution", async () => {
      await expect(anySnacks.pause())
        .to.emit(anySnacks, "Paused")
        .withArgs(owner.address);
      await expect(
        mintSnacksThroughPayToken(owner, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("Pausable: paused");
      await expect(anySnacks.connect(buyer1).unpause()).to.be.reverted;
      await expect(anySnacks.unpause())
        .to.emit(anySnacks, "Unpaused")
        .withArgs(owner.address);
      await mintSnacksThroughPayToken(owner, ethers.utils.parseEther("1"))
    }),

    (symbol) => it("Test symbol()", async () => {
      // ARRANGE
      const symbolExpected = symbol;

      // ACT
      const symbolResult = await anySnacks.symbol();

      // ASSERT
      expect(symbolResult).to.be.equal(symbolExpected);
    }),

    (name) => it("Test name()", async () => {
      // ARRANGE
      const nameExpected = name;

      // ACT
      const nameResult = await anySnacks.name();

      // ASSERT
      expect(nameResult).to.be.equal(nameExpected);
    }),

    () => it("Test decimals()", async () => {
      // ARRANGE
      const decimalsExpected = decimals;

      // ACT
      const decimalsResult = await anySnacks.decimals();

      // ASSERT
      expect(decimalsResult).to.be.equal(decimalsExpected);
    }),

    () => it("Test sufficientBuyTokenAmountOnMint()", async () => {
      // ARRANGE
      const buyTokenAmount_ = ethers.utils.parseEther('5');

      // ACT
      const result = await anySnacks.sufficientBuyTokenAmountOnMint(buyTokenAmount_);
      const expected = true;

      // ASSERT
      expect(result).to.be.equal(expected);
    }),

    () => it("Test approve & decreaseAllowance", async () => {
      // ARRANGE
      const amountApprove = ethers.utils.parseEther('5');
      const amountDecrease = ethers.utils.parseEther('4');
      const allowed1Expected = ethers.utils.parseEther('5');
      const decreased2Expected = ethers.utils.parseEther('1');
      const decreased3Expected = ethers.utils.parseEther('0');

      // ACT
      await anySnacks.approve(buyer1.address, amountApprove);
      const allowed1Result = await anySnacks.allowance(owner.address, buyer1.address);

      await anySnacks.decreaseAllowance(buyer1.address, amountDecrease);
      const decreased2Result = await anySnacks.allowance(owner.address, buyer1.address);

      await anySnacks.decreaseAllowance(buyer1.address, amountDecrease);
      const decreased3Result = await anySnacks.allowance(owner.address, buyer1.address);

      // ASSERT
      expect(allowed1Result).to.be.equal(allowed1Expected);
      expect(decreased2Result).to.be.equal(decreased2Expected);
      expect(decreased3Result).to.be.equal(decreased3Expected);
    }),

    () => it("Test increaseAllowance", async () => {
      // ARRANGE
      const amountIncrease = ethers.utils.parseEther('5');
      const allowedExpected = ethers.utils.parseEther('5');

      // ACT
      await expect(anySnacks.increaseAllowance(buyer1.address, amountIncrease))
        .to.emit(anySnacks, "Approval")
        .withArgs(owner.address, buyer1.address, amountIncrease);
      const allowedResult = await anySnacks.allowance(owner.address, buyer1.address);

      // ASSERT
      expect(allowedResult).to.be.equal(allowedExpected);
    }),

    () => it("Valid addresses check", async () => {
      await expect(anySnacks.distributeFee()).to.be.reverted;
      await startImpersonating(ZERO_ADDRESS);
      const zeroAddress = await ethers.getSigner(ZERO_ADDRESS);
      await expect(anySnacks.connect(zeroAddress).increaseAllowance(owner.address, 100))
        .to.be.revertedWith("SnacksBase: approve from the zero address");
      await expect(anySnacks.increaseAllowance(ZERO_ADDRESS, 100))
        .to.be.revertedWith("SnacksBase: approve to the zero address");
      await expect(anySnacks.connect(zeroAddress).transfer(owner.address, 100))
        .to.be.revertedWith("SnacksBase: transfer from the zero address");
        await expect(anySnacks.transfer(ZERO_ADDRESS, 100))
        .to.be.revertedWith("SnacksBase: transfer to the zero address");
    }),

    () => it("Successful calculations check", async () => {
      await expect(anySnacks.calculatePayTokenAmountOnMint(100)).to.be.revertedWith("SnacksBase: invalid buy token amount");
      await expect(anySnacks.calculateBuyTokenAmountOnMint(100)).to.be.revertedWith("SnacksBase: invalid pay token amount");
      await expect(anySnacks.calculatePayTokenAmountOnRedeem(100)).to.be.revertedWith("SnacksBase: invalid buy token amount");
    }),

    () => it("Fee distribution when holders supply is 0", async () => {
      const amount = ethers.utils.parseEther("1");
      await payTokenMintingAction(owner, amount, token);
      await token.approve(anySnacks.address, amount);
      await anySnacks.mintWithPayTokenAmount(amount);
      await anySnacks.transfer(pulse.address, await anySnacks.balanceOf(owner.address));
      await anySnacks.connect(buyer1).distributeFee();
    }),

    () => it("Successful addToExcludedHolders() execution", async () => {
      // Call from not the owner
      await expect(anySnacks.connect(buyer1).addToExcludedHolders(buyer2.address))
        .to.be.reverted;
      // Add buyer2 to excluded
      await anySnacks.addToExcludedHolders(buyer2.address);
      // Check
      expect(await anySnacks.isExcludedHolder(buyer2.address)).to.equal(true);
      // Attempt to add again
      await expect(anySnacks.addToExcludedHolders(buyer2.address)).to.be.revertedWith("SnacksBase: already excluded");
    }),

    () => it("Successful removeFromExcludedHolders() execution", async () => {
      // Call from not the owner
      await expect(anySnacks.connect(buyer1).removeFromExcludedHolders(anySnacks.address))
        .to.be.reverted;
      // Add buyer2 to excluded
      await anySnacks.removeFromExcludedHolders(anySnacks.address);
      // Check
      expect(await anySnacks.isExcludedHolder(anySnacks.address)).to.equal(false);
      // Attempt to add again
      await expect(anySnacks.removeFromExcludedHolders(anySnacks.address)).to.be.revertedWith("SnacksBase: not excluded");
    })
  ];

  for (let i = 0; i < testCases.length; i++) {
    if (disabledTestCaseIndicies.includes(i)) continue;
    testCases[i]();
  }

  return testCases;
}
