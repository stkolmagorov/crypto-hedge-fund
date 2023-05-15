const {expect} = require("chai");
const hre = require("hardhat");
const keccak256 = require('keccak256');
const {ZERO, ZERO_ADDRESS, mintZoinksAndAllSnacks, mockSwaps, mockedResultOfSwap} = require("../deploy/helpers");
const {ethers, deployments} = hre;
const abiCoder = ethers.utils.defaultAbiCoder;

describe("InvestmentSystemDistributor", () => {
    const THOUSAND = ethers.utils.parseEther("1000");
    const LUNCH_BOX_ACTIVATION_DATA = abiCoder.encode(
        ["uint", "tuple(uint[], uint[])"],
        [10000, [[], []]]
    );
    const IDO_ACTIVATION_DATA = abiCoder.encode(
        ["uint", "tuple(uint[], uint[])"],
        [0, [[10000], [0]]]
    );
    const BOTH_PROGRAMS_DATA = abiCoder.encode(
        ["uint", "tuple(uint[], uint[])"],
        [5000, [[5000], [0]]]
    );
    const stakingAction = async(account, amount) => {
        await snacks.connect(account).approve(snacksPool.address, amount);
        await snacksPool.connect(account).stake(amount);
    }
    const openIdoAction = async() => {
        const IDO_PARAMETERS = {
            numberOfProjects: 3,
            totalRequiredAmountOfFunds: 100,
            insuranceRecipient: ZERO_ADDRESS,
            defaultOwner: ZERO_ADDRESS,
            authority: ZERO_ADDRESS,
            idoLunchBoxPoolAddress: ZERO_ADDRESS,
            idoPoolAddress: ZERO_ADDRESS,
            requiredAmountsOfFunds: [10, 20, 70],
            shares: [0, 0, 0],
            fundsReceivers: [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS],
            idoTokens: [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS],
            names: ["N", "NN", "NNN"],
            symbols: ["S", "SS", "SSS"]
        }
        await idoFactory.openIdo(IDO_PARAMETERS);
    }

    beforeEach(async () => {
        await deployments.fixture(['debug']);
        [owner, authority] = await ethers.getSigners();
        investmentSystemDistributor = await ethers.getContractAt(
            hre.names.internal.investmentSystemDistributor,
            (await deployments.get(hre.names.internal.investmentSystemDistributor)).address
        );
        snacksPool = await ethers.getContractAt(
            hre.names.internal.snacksPool,
            (await deployments.get(hre.names.internal.snacksPool)).address
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
        idoFactory = await ethers.getContractAt(
            hre.names.internal.iDOFactory,
            (await deployments.get(hre.names.internal.iDOFactory)).address
        );
        lunchBox = await ethers.getContractAt(
            hre.names.internal.lunchBox,
            (await deployments.get(hre.names.internal.lunchBox)).address
        );
        idoDistributor = await ethers.getContractAt(
            hre.names.internal.iDODistributor,
            (await deployments.get(hre.names.internal.iDODistributor)).address
        );
        busd = await ethers.getContractAt(
            hre.names.internal.mockToken,
            (await deployments.get(hre.names.external.tokens.busd)).address
        );
        zoinks = await ethers.getContractAt(
            hre.names.internal.zoinks,
            (await deployments.get(hre.names.internal.zoinks)).address
        );
        await snacksPool.excludeFromRestrictions(owner.address);
        await mintZoinksAndAllSnacks(deployments, owner, THOUSAND, owner);
        await mintZoinksAndAllSnacks(deployments, authority, THOUSAND, authority);
    });

    it("Successful activateInvestmentSystem() execution", async() => {
        // Stake 1000 from owner
        await stakingAction(owner, THOUSAND);
        // Activate LunchBox from owner
        await snacksPool.activateInvestmentSystem(LUNCH_BOX_ACTIVATION_DATA);
        // Not IDO participant
        expect(await idoFactory.isIdoParticipant(owner.address)).to.equal(false);
        expect(await snacksPool.isLunchBoxParticipant(owner.address)).to.equal(true);
        // Deactivate investment system
        await snacksPool.deactivateInvestmentSystem();
        // Open IDO
        await openIdoAction();
        // Activate IDO
        await snacksPool.activateInvestmentSystem(IDO_ACTIVATION_DATA);
        // Is IDO participant
        expect(await idoFactory.isIdoParticipant(owner.address)).to.equal(true);
        expect(await idoFactory.getIdoParticipantsLength()).to.equal(1);
        expect(await idoFactory.getIdoParticipantAt(0)).to.equal(owner.address);
        // Checks
        let idoParticipantInfo = await idoFactory.getIdoParticipantInfo(owner.address);
        expect(idoParticipantInfo.percentages[0]).to.equal(ethers.BigNumber.from("10000"));
        expect(idoParticipantInfo.indicies[0]).to.equal(ethers.BigNumber.from("0"));
    });

    it("Successful updateInvestmentSystemData() execution", async() => {
        // Open IDO
        await openIdoAction();
        // Stake 1000 from owner
        await stakingAction(owner, THOUSAND);
        // Activate LunchBox
        await snacksPool.activateInvestmentSystem(LUNCH_BOX_ACTIVATION_DATA);
        // Is LunchBox participant
        expect(await snacksPool.isLunchBoxParticipant(owner.address)).to.equal(true);
        // Change to IDO
        await snacksPool.changeInvestmentSystemData(IDO_ACTIVATION_DATA);
        // Is IDO participant
        expect(await idoFactory.isIdoParticipant(owner.address)).to.equal(true);
        expect(await idoFactory.getIdoParticipantsLength()).to.equal(1);
        expect(await idoFactory.getIdoParticipantAt(0)).to.equal(owner.address);
        expect(await snacksPool.isLunchBoxParticipant(owner.address)).to.equal(false);
        // Change to LunchBox
        await snacksPool.changeInvestmentSystemData(LUNCH_BOX_ACTIVATION_DATA);
        // Is LunchBox participant
        expect(await idoFactory.isIdoParticipant(owner.address)).to.equal(false);
        expect(await idoFactory.getIdoParticipantsLength()).to.equal(0);
        expect(await snacksPool.isLunchBoxParticipant(owner.address)).to.equal(true);
        // Deactivation
        await snacksPool.deactivateInvestmentSystem();
        // IDO activation
        await snacksPool.activateInvestmentSystem(IDO_ACTIVATION_DATA);
        // Change to both
        await snacksPool.changeInvestmentSystemData(BOTH_PROGRAMS_DATA);
        // Is IDO and LunchBox participant
        expect(await idoFactory.isIdoParticipant(owner.address)).to.equal(true);
        expect(await idoFactory.getIdoParticipantsLength()).to.equal(1);
        expect(await idoFactory.getIdoParticipantAt(0)).to.equal(owner.address);
        expect(await snacksPool.isLunchBoxParticipant(owner.address)).to.equal(true);
        // Deactivate
        await snacksPool.deactivateInvestmentSystem();
        // Checks
        expect(await idoFactory.isIdoParticipant(owner.address)).to.equal(false);
        expect(await idoFactory.getIdoParticipantsLength()).to.equal(0);
        expect(await snacksPool.isLunchBoxParticipant(owner.address)).to.equal(false);
    });

    it("Successful deliverRewardsToLunchBox() execution", async() => {
        await snacks.transfer(snacksPool.address, 100);
        await btcSnacks.transfer(snacksPool.address, 100);
        await ethSnacks.transfer(snacksPool.address, 100);
        await mockSwaps(
            hre.names.external.routers.pancake,
            deployments,
            ZERO,
            lunchBox.address,
            mockedResultOfSwap,
        );
        await busd.transfer(lunchBox.address, THOUSAND);
        await expect(investmentSystemDistributor.connect(authority).deliverRewardsToLunchBox(
            100,
            100,
            100,
            0,
            0,
            0
        )).to.emit(investmentSystemDistributor, "RewardsDeliveredToLunchBox").withArgs(100, 100, 100);
    });

    it("Successful deliverRewardsToIdo() execution", async() => {
        await expect(investmentSystemDistributor.connect(authority).deliverRewardsToIdo(
            0,
            100,
            100,
            100,
            0,
            0,
            0
        )).to.be.revertedWith("InvestmentSystemDistributor: invalid IDO id");
        await openIdoAction();
        await mockSwaps(
            hre.names.external.routers.pancake,
            deployments,
            ZERO,
            idoDistributor.address,
            mockedResultOfSwap,
        );
        await busd.transfer(idoDistributor.address, THOUSAND);
        await zoinks.transfer(idoDistributor.address, THOUSAND);
        await snacks.transfer(snacksPool.address, 100);
        await btcSnacks.transfer(snacksPool.address, 100);
        await ethSnacks.transfer(snacksPool.address, 100);
        await expect(investmentSystemDistributor.connect(authority).deliverRewardsToIdo(
            0,
            50,
            50,
            50,
            0,
            0,
            0
        )).to.emit(investmentSystemDistributor, "RewardsDeliveredToIdo").withArgs(0, 50, 50, 50);
        await idoFactory.closeIdo(0);
        await expect(investmentSystemDistributor.connect(authority).deliverRewardsToIdo(
            0,
            50,
            50,
            50,
            0,
            0,
            0
        )).to.emit(investmentSystemDistributor, "RewardsDeliveredToIdo").withArgs(0, 50, 50, 50);
    });

    it("Successful verifyData() execution", async() => {
        let invalidData = abiCoder.encode(
            ["uint", "tuple(uint[], uint[])"],
            [5000, [[5000, 2000], [0]]]
        );
        await expect(investmentSystemDistributor.verifyData(invalidData))
            .to.be.revertedWith("InvestmentSystemDistributor: invalid array lengths in IDO data");
        await openIdoAction();
        invalidData = abiCoder.encode(
            ["uint", "tuple(uint[], uint[])"],
            [5000, [[0], [1]]]
        );
        await expect(investmentSystemDistributor.verifyData(invalidData))
            .to.be.revertedWith("InvestmentSystemDistributor: invalid IDO id");
        invalidData = abiCoder.encode(
            ["uint", "tuple(uint[], uint[])"],
            [5000, [[0], [0]]]
        );
        await expect(investmentSystemDistributor.verifyData(invalidData))
            .to.be.revertedWith("InvestmentSystemDistributor: invalid percentage in IDO data");
        invalidData = abiCoder.encode(
            ["uint", "tuple(uint[], uint[])"],
            [5000, [[5001], [0]]]
        );
        await expect(investmentSystemDistributor.verifyData(invalidData))
            .to.be.revertedWith("InvestmentSystemDistributor: invalid sum of percentages");
    });
});