const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, deployments } = hre;
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const {
  ZERO,
  ZERO_ADDRESS,
  mockReserves,
  withImpersonatedSigner,
  mintNativeTokens
} = require('../deploy/helpers');

describe('AveragePriceOracle', () => {

  let zoinks;
  let averagePriceOracle;
  let pancakeZoinksBusdPairMockContract;
  let apeZoinksBusdPairMockContract;
  let biZoinksBusdPairMockContract;
  let pancakeZoinksBusdPair;

  let getReservesSelector;
  let apeSwapZoinksBusdPair;
  let biSwapZoinksBusdPair;
  let pancakeSwapZoinksBusdPair;

  const BASE_PERCENT = ethers.BigNumber.from("10000");
  const APE_SWAP_PERCENT = ethers.BigNumber.from("1500");
  const BI_SWAP_PERCENT = ethers.BigNumber.from("1500");
  const PANCAKE_SWAP_PERCENT = ethers.BigNumber.from("3500");
  const TWAP_PERCENT = ethers.BigNumber.from("6500");
  const RESOLUTION = ethers.BigNumber.from("1000000000000000000000000000000000000");

  const etherToMintForImpersonatedSigners = '0x10000000000000000000000';

  beforeEach(async () => {
    await deployments.fixture(['average_price_oracle_test_fixtures']);
    [owner, alice] = await ethers.getSigners();
    zoinks = await ethers.getContractAt(
      hre.names.internal.zoinks,
      (await deployments.get(hre.names.internal.zoinks)).address
    );
    averagePriceOracle = await ethers.getContractAt(
      hre.names.internal.averagePriceOracle,
      (await deployments.get(hre.names.internal.averagePriceOracle)).address
    );
    pancakeZoinksBusdPairMockContract = await hre.ethers.getContractAt(
      hre.names.internal.mockContract,
      (await deployments.get(hre.names.external.pairs.pancake.pair)).address
    );
    apeZoinksBusdPairMockContract = await hre.ethers.getContractAt(
      hre.names.internal.mockContract,
      (await deployments.get(hre.names.external.pairs.ape.pair)).address
    );
    biZoinksBusdPairMockContract = await hre.ethers.getContractAt(
      hre.names.internal.mockContract,
      (await deployments.get(hre.names.external.pairs.bi.pair)).address
    );
    pancakeZoinksBusdPair = await hre.ethers.getContractAt(
      hre.names.internal.iPair,
      (await deployments.get(hre.names.external.pairs.pancake.pair)).address
    );
    getReservesSelector = pancakeZoinksBusdPair
      .interface.encodeFunctionData("getReserves");
    apeSwapZoinksBusdPair = (await deployments.get(hre.names.external.pairs.ape.pair)).address;
    biSwapZoinksBusdPair = (await deployments.get(hre.names.external.pairs.bi.pair)).address;
    pancakeSwapZoinksBusdPair = (await deployments.get(hre.names.external.pairs.pancake.pair)).address;
    router = await ethers.getContractAt(
      hre.names.internal.iRouter,
      (await deployments.get(hre.names.external.routers.pancake)).address
    );
    busd = await ethers.getContractAt(
      hre.names.internal.mockToken,
      (await deployments.get(hre.names.external.tokens.busd)).address
    );
  });

  it('Should perform initialize properly', async () => {

    const currentTime = await time.latest();

    await mockReserves(ZERO, ZERO, deployments);

    await expect(averagePriceOracle.initialize(
      zoinks.address,
      apeSwapZoinksBusdPair,
      biSwapZoinksBusdPair,
      pancakeSwapZoinksBusdPair
    )).to.be.revertedWith("AveragePriceOracle: no reserves");

    await mockReserves(
      ethers.utils.parseEther('100'),
      ethers.utils.parseEther('200'),
      deployments
    );

    await averagePriceOracle.initialize(
      zoinks.address,
      apeSwapZoinksBusdPair,
      biSwapZoinksBusdPair,
      pancakeSwapZoinksBusdPair
    );

    await expect(averagePriceOracle.initialize(
      zoinks.address,
      apeSwapZoinksBusdPair,
      biSwapZoinksBusdPair,
      pancakeSwapZoinksBusdPair
    )).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("Successful update() execution", async () => {
    // Not initialized execution
    await withImpersonatedSigner(zoinks.address, async (impersonatedZoinksSigner) => {
      await mintNativeTokens(impersonatedZoinksSigner, etherToMintForImpersonatedSigners);
      await expect(
        averagePriceOracle.connect(impersonatedZoinksSigner).update()
      ).to.be.reverted;
    });
    await averagePriceOracle.initialize(
      zoinks.address,
      apeSwapZoinksBusdPair,
      biSwapZoinksBusdPair,
      pancakeSwapZoinksBusdPair
    );
    await time.increase(43200);
    await withImpersonatedSigner(zoinks.address, async (impersonatedZoinksSigner) => {
      await mintNativeTokens(impersonatedZoinksSigner, etherToMintForImpersonatedSigners);
      await averagePriceOracle.connect(impersonatedZoinksSigner).update();
    });
    let apeSwapAveragePriceLast = await averagePriceOracle.apeSwapAveragePriceLast();
    let biSwapAveragePriceLast = await averagePriceOracle.biSwapAveragePriceLast();
    let pancakeSwapAveragePriceLast = await averagePriceOracle.pancakeSwapAveragePriceLast();
    let twapFromContract = await averagePriceOracle.twapLast();
    let twap =
        APE_SWAP_PERCENT.mul(apeSwapAveragePriceLast)
        .add(BI_SWAP_PERCENT.mul(biSwapAveragePriceLast))
        .add(PANCAKE_SWAP_PERCENT.mul(pancakeSwapAveragePriceLast))
        .mul(BASE_PERCENT)
        .div(TWAP_PERCENT)
        .div(RESOLUTION);
    expect(twapFromContract).to.be.equal(twap);
    // 100k
    let amountToSwap = ethers.utils.parseEther("100000");
    let amountOutMin = ethers.utils.parseEther("90000");
    await busd.approve(router.address, amountToSwap.mul(10));
    // Swap
    block = await ethers.provider.getBlock();
    await router.swapExactTokensForTokens(
      amountToSwap,
      amountOutMin,
      [busd.address, zoinks.address],
      owner.address,
      block.timestamp + 100
    );
    await time.increase(43200);
    await withImpersonatedSigner(zoinks.address, async (impersonatedZoinksSigner) => {
      await mintNativeTokens(impersonatedZoinksSigner, etherToMintForImpersonatedSigners);
      await averagePriceOracle.connect(impersonatedZoinksSigner).update();
    });
    apeSwapAveragePriceLast = await averagePriceOracle.apeSwapAveragePriceLast();
    biSwapAveragePriceLast = await averagePriceOracle.biSwapAveragePriceLast();
    pancakeSwapAveragePriceLast = await averagePriceOracle.pancakeSwapAveragePriceLast();
    twapFromContract = await averagePriceOracle.twapLast();
    twap =
        APE_SWAP_PERCENT.mul(apeSwapAveragePriceLast)
        .add(BI_SWAP_PERCENT.mul(biSwapAveragePriceLast))
        .add(PANCAKE_SWAP_PERCENT.mul(pancakeSwapAveragePriceLast))
        .mul(BASE_PERCENT)
        .div(TWAP_PERCENT)
        .div(RESOLUTION);
    expect(twapFromContract).to.be.equal(twap);
    await time.increase(21600);
    amountToSwap = ethers.utils.parseEther("100000");
    amountOutMin = ethers.utils.parseEther("70000");
    // Swap
    block = await ethers.provider.getBlock();
    await router.swapExactTokensForTokens(
      amountToSwap,
      amountOutMin,
      [busd.address, zoinks.address],
      owner.address,
      block.timestamp + 100
    );
    await time.increase(21600);

    await withImpersonatedSigner(zoinks.address, async (impersonatedZoinksSigner) => {
      await mintNativeTokens(impersonatedZoinksSigner, etherToMintForImpersonatedSigners);
      await averagePriceOracle.connect(impersonatedZoinksSigner).update();
    });
    apeSwapAveragePriceLast = await averagePriceOracle.apeSwapAveragePriceLast();
    biSwapAveragePriceLast = await averagePriceOracle.biSwapAveragePriceLast();
    pancakeSwapAveragePriceLast = await averagePriceOracle.pancakeSwapAveragePriceLast();
    twapFromContract = await averagePriceOracle.twapLast();
    twap =
      APE_SWAP_PERCENT.mul(apeSwapAveragePriceLast)
      .add(BI_SWAP_PERCENT.mul(biSwapAveragePriceLast))
      .add(PANCAKE_SWAP_PERCENT.mul(pancakeSwapAveragePriceLast))
      .mul(BASE_PERCENT)
      .div(TWAP_PERCENT)
      .div(RESOLUTION);
    expect(twapFromContract).to.be.equal(twap);
    // Attempt to call once again on the first period
    await withImpersonatedSigner(zoinks.address, async (impersonatedZoinksSigner) => {
      await mintNativeTokens(impersonatedZoinksSigner, etherToMintForImpersonatedSigners);
      await expect(averagePriceOracle.connect(impersonatedZoinksSigner).update())
        .to.be.reverted;
    });
    // Successful call on the second period
    await time.increase(43200);
    await withImpersonatedSigner(zoinks.address, async (impersonatedZoinksSigner) => {
      await mintNativeTokens(impersonatedZoinksSigner, etherToMintForImpersonatedSigners);
      await averagePriceOracle.connect(impersonatedZoinksSigner).update();
    });
    // Attempt to call again on the second period
    await withImpersonatedSigner(zoinks.address, async (impersonatedZoinksSigner) => {
      await mintNativeTokens(impersonatedZoinksSigner, etherToMintForImpersonatedSigners);
      await expect(averagePriceOracle.connect(impersonatedZoinksSigner).update())
        .to.be.reverted;
    });
    // Call has not been made on the first period
    await time.increase(86400);
    await withImpersonatedSigner(zoinks.address, async (impersonatedZoinksSigner) => {
      await mintNativeTokens(impersonatedZoinksSigner, etherToMintForImpersonatedSigners);
      await averagePriceOracle.connect(impersonatedZoinksSigner).update();
    });
  });
});
