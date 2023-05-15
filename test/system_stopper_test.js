const hre = require("hardhat");
const { ethers, deployments } = hre;
const { expect } = require("chai");

describe("SystemStopper", () => {
    beforeEach(async () => {
        await deployments.fixture(['debug']);
        [deployer, authority] = await ethers.getSigners();
        systemStopper = await ethers.getContractAt(
            hre.names.internal.systemStopper,
            (await deployments.get(hre.names.internal.systemStopper)).address
        );
        zoinks = await ethers.getContractAt(
            hre.names.internal.zoinks,
            (await deployments.get(hre.names.internal.zoinks)).address
        );
    });

    it("Successful configure() execution", async() => {
        const contracts = [deployer.address];
        await systemStopper.configure(contracts);
        expect(await systemStopper.getContractsLength()).to.equal(1);
        expect(await systemStopper.getContractAddressAt(0)).to.equal(deployer.address);
        expect(await systemStopper.isInListOnPause(deployer.address)).to.equal(true);
    });

    it("Successful pauseAllContracts() execution", async() => {
        await systemStopper.pauseAllContracts();
        expect(await zoinks.paused()).to.equal(true);
        await systemStopper.pauseAllContracts();
    });

    it("Successful unpauseAllContracts() execution", async() => {
        await systemStopper.pauseAllContracts();
        expect(await zoinks.paused()).to.equal(true);
        await systemStopper.unpauseAllContracts();
        expect(await zoinks.paused()).to.equal(false);
        await systemStopper.unpauseAllContracts();
    });
});