const hre = require("hardhat");
const { expect } = require("chai");
const { ethers, deployments } = hre;
const snacksBaseTestSuite = require('../reusable_test_suits/snacks_base_test_suite.js');

describe("BtcSnacks", () => {

  beforeEach(async () => {
    await deployments.fixture(['btc_snacks_test_fixtures']);
    btcSnacks = await ethers.getContractAt(
      hre.names.internal.btcSnacks,
      (await deployments.get(hre.names.internal.btcSnacks)).address
    );
  });

  const testCases = snacksBaseTestSuite(
    [7, 8, 9, 10, 20, 21],
    async () => await ethers.getContractAt(
      hre.names.internal.btcSnacks,
      (await deployments.get(hre.names.internal.btcSnacks)).address
    ),
    async () => await ethers.getContractAt(
      hre.names.internal.mockToken,
      (await deployments.get(hre.names.external.tokens.btc)).address
    ),
    async (who, amount, lpToken) => await lpToken.mint(who.address, amount)
  );

  testCases[9]("BSNACK");

  testCases[10]("btcSnacks");

  it("Successful pause() execution", async () => {
    await btcSnacks.pause();
    expect(await btcSnacks.paused()).to.equal(true);
  });

  it("Successful unpause() execution", async () => {
    await btcSnacks.pause();
    expect(await btcSnacks.paused()).to.equal(true);
    await btcSnacks.unpause();
    expect(await btcSnacks.paused()).to.equal(false);
  });

  it("Successful configure() execution", async () => {
    await btcSnacks.configure(
      btcSnacks.address,
      btcSnacks.address,
      btcSnacks.address,
      btcSnacks.address,
      btcSnacks.address,
      btcSnacks.address,
      btcSnacks.address,
      btcSnacks.address,
      btcSnacks.address
    );
    expect(await btcSnacks.snacks()).to.equal(btcSnacks.address);
  });
});
