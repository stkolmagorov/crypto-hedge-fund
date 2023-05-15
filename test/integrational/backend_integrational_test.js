const hre = require("hardhat");
const {time} = require("@nomicfoundation/hardhat-network-helpers");
const {backendCall1224} = require('../../deploy/helpers');

describe("Backend chain test", () => {

    beforeEach(async () => {
        await deployments.fixture(['general_test_fixtures']);
    });

    it("Call contracts every 12/24h", async () => {
        // ARRANGE
        const period = ethers.BigNumber.from(43200); // 43200 = 12 hours. 86400 = 1 day in seconds
        // ACT
        await time.increase(period);
        await backendCall1224(hre);
        await time.increase(period);
        await backendCall1224(hre);
        await time.increase(period);
        await backendCall1224(hre);
        // ASSERT
    });
});
