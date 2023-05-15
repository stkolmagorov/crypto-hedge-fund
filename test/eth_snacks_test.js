const hre = require("hardhat");
const { expect } = require("chai");
const { ethers, deployments } = hre;
const snacksBaseTestSuite = require('../reusable_test_suits/snacks_base_test_suite.js');

describe("EthSnacks", () => {

  beforeEach(async () => {
    await deployments.fixture(['eth_snacks_test_fixtures']);
    ethSnacks = await ethers.getContractAt(
      hre.names.internal.ethSnacks,
      (await deployments.get(hre.names.internal.ethSnacks)).address
    );
  });

  const testCases = snacksBaseTestSuite(
    [7, 8, 9, 10, 20, 21],
    async () => await ethers.getContractAt(
      hre.names.internal.ethSnacks,
      (await deployments.get(hre.names.internal.ethSnacks)).address
    ),
    async () => await ethers.getContractAt(
      hre.names.internal.mockToken,
      (await deployments.get(hre.names.external.tokens.eth)).address
    ),
    async (who, amount, lpToken) => await lpToken.mint(who.address, amount)
  );

  testCases[9]("ETSNACK");

  testCases[10]("ethSnacks");

  it("Successful pause() execution", async () => {
    await ethSnacks.pause();
    expect(await ethSnacks.paused()).to.equal(true);
  });

  it("Successful unpause() execution", async () => {
    await ethSnacks.pause();
    expect(await ethSnacks.paused()).to.equal(true);
    await ethSnacks.unpause();
    expect(await ethSnacks.paused()).to.equal(false);
  });

  it("Successful configure() execution", async () => {
    await ethSnacks.configure(
      ethSnacks.address,
      ethSnacks.address,
      ethSnacks.address,
      ethSnacks.address,
      ethSnacks.address,
      ethSnacks.address,
      ethSnacks.address,
      ethSnacks.address,
      ethSnacks.address
    );
    expect(await ethSnacks.snacks()).to.equal(ethSnacks.address);
  });
});
