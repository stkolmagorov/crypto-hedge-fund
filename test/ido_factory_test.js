const {expect} = require("chai");
const hre = require("hardhat");
const {ZERO_ADDRESS, mintZoinksAndAllSnacks} = require("../deploy/helpers");
const {ethers, deployments} = hre;
const abiCoder = ethers.utils.defaultAbiCoder;

describe("IDOFactory", () => {
    const THOUSAND = ethers.utils.parseEther("1000");
    const IDO_ACTIVATION_DATA = abiCoder.encode(
        ["uint", "tuple(uint[], uint[])"],
        [0, [[10000], [0]]]
    );
    const MULTIPLE_IDO_ACTIVATION_DATA = abiCoder.encode(
        ["uint", "tuple(uint[], uint[])"],
        [0, [[5000, 5000], [0, 1]]]
    );
    const stakingAction = async(account, amount) => {
        await snacks.connect(account).approve(snacksPool.address, amount);
        await snacksPool.connect(account).stake(amount);
    }

    beforeEach(async () => {
        await deployments.fixture(['debug']);
        [owner, authority] = await ethers.getSigners();
        snacksPool = await ethers.getContractAt(
            hre.names.internal.snacksPool,
            (await deployments.get(hre.names.internal.snacksPool)).address
        );
        idoFactory = await ethers.getContractAt(
            hre.names.internal.iDOFactory,
            (await deployments.get(hre.names.internal.iDOFactory)).address
        );
        snacks = await ethers.getContractAt(
            hre.names.internal.snacks,
            (await deployments.get(hre.names.internal.snacks)).address
        );
        await snacksPool.excludeFromRestrictions(owner.address);
        await mintZoinksAndAllSnacks(deployments, owner, THOUSAND, owner);
    });

    it("Successful openIdo() execution", async() => {
        // Open IDO with valid parameters
        const validIdoParameters = {
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
        await idoFactory.openIdo(validIdoParameters);
        // Checks
        expect(await idoFactory.getNextIdoId()).to.equal(1);
        const idoPoolAddress = await idoFactory.idoPoolAddressById(0);
        expect(await idoFactory.idByIdoPoolAddress(idoPoolAddress)).to.equal(0);
        expect(await idoFactory.idoPoolAddressById(0)).to.equal(idoPoolAddress);
        expect(await idoFactory.isValidIdoId(0)).to.equal(true);
        expect(await idoFactory.getValidIdoIdsLength()).to.equal(1);
        expect(await idoFactory.getValidIdoIdAt(0)).to.equal(0);
        // Attempts to open IDO with invalid parameters
        let invalidIdoParameters = {
            numberOfProjects: 3,
            totalRequiredAmountOfFunds: 100,
            insuranceRecipient: ZERO_ADDRESS,
            defaultOwner: ZERO_ADDRESS,
            authority: ZERO_ADDRESS,
            idoLunchBoxPoolAddress: ZERO_ADDRESS,
            idoPoolAddress: ZERO_ADDRESS,
            requiredAmountsOfFunds: [10, 70],
            shares: [0, 0, 0],
            fundsReceivers: [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS],
            idoTokens: [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS],
            names: ["N", "NN", "NNN"],
            symbols: ["S", "SS", "SSS"]
        }
        await expect(idoFactory.openIdo(invalidIdoParameters)).to.be.revertedWith("IDOFactory: invalid array lengths");
        invalidIdoParameters = {
            numberOfProjects: 3,
            totalRequiredAmountOfFunds: 100,
            insuranceRecipient: ZERO_ADDRESS,
            defaultOwner: ZERO_ADDRESS,
            authority: ZERO_ADDRESS,
            idoLunchBoxPoolAddress: ZERO_ADDRESS,
            idoPoolAddress: ZERO_ADDRESS,
            requiredAmountsOfFunds: [10, 70, 40],
            shares: [0, 0, 0],
            fundsReceivers: [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS],
            idoTokens: [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS],
            names: ["N", "NN", "NNN"],
            symbols: ["S", "SS", "SSS"]
        }
        await expect(idoFactory.openIdo(invalidIdoParameters)).to.be.revertedWith("IDOFactory: invalid sum");
    });

    it("Successful closeIdo() execution", async() => {
        // Open IDO
        const idoParameters = {
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
        await idoFactory.openIdo(idoParameters);
        // Close non-existent IDO
        await expect(idoFactory.closeIdo(1)).to.be.revertedWith("IDOFactory: id not found");
        // Close IDO
        await idoFactory.closeIdo(0);
        // Check
        expect(await idoFactory.isValidIdoId(0)).to.equal(false);
    });

    it("Successful updateIdoParticipantInfo() execution", async() => {
        // Open IDO
        const idoParameters = {
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
        await idoFactory.openIdo(idoParameters);
        // Stake
        await stakingAction(owner, THOUSAND);
        // Activate IDO
        await snacksPool.activateInvestmentSystem(IDO_ACTIVATION_DATA);
        // Checks
        let idoParticipantInfo = await idoFactory.getIdoParticipantInfo(owner.address);
        expect(idoParticipantInfo.percentages[0]).to.equal(ethers.BigNumber.from("10000"));
        expect(idoParticipantInfo.indicies[0]).to.equal(ethers.BigNumber.from("0"));
        expect(await idoFactory.isIdoParticipant(owner.address)).to.equal(true);
        expect(await idoFactory.getIdoParticipantsLength()).to.equal(1);
        expect(await idoFactory.getIdoParticipantAt(0)).to.equal(owner.address);
        // Open another IDO
        await idoFactory.openIdo(idoParameters);
        // Activate multiple IDOs
        await snacksPool.changeInvestmentSystemData(MULTIPLE_IDO_ACTIVATION_DATA);
    });

    it("Successful deleteIdoParticipantInfo() execution", async() => {
        // Open IDO
        const idoParameters = {
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
        await idoFactory.openIdo(idoParameters);
        // Stake
        await stakingAction(owner, THOUSAND);
        // Activate IDO
        await snacksPool.activateInvestmentSystem(IDO_ACTIVATION_DATA);
        // Checks
        let idoParticipantInfo = await idoFactory.getIdoParticipantInfo(owner.address);
        expect(idoParticipantInfo.percentages[0]).to.equal(ethers.BigNumber.from("10000"));
        expect(idoParticipantInfo.indicies[0]).to.equal(ethers.BigNumber.from("0"));
        expect(await idoFactory.isIdoParticipant(owner.address)).to.equal(true);
        expect(await idoFactory.getIdoParticipantsLength()).to.equal(1);
        expect(await idoFactory.getIdoParticipantAt(0)).to.equal(owner.address);
        // Deactivation
        await snacksPool.deactivateInvestmentSystem();
        // Checks
        expect(await idoFactory.isIdoParticipant(owner.address)).to.equal(false);
        expect(await idoFactory.getIdoParticipantsLength()).to.equal(0);
        idoParticipantInfo = await idoFactory.getIdoParticipantInfo(owner.address);
        expect(idoParticipantInfo.percentages.length).to.equal(0);
        expect(idoParticipantInfo.indicies.length).to.equal(0);
    });
});