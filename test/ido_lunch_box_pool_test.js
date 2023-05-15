const {expect} = require("chai");
const {time} = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");
const keccak256 = require("keccak256");
const {mintZoinksAndAllSnacks} = require("../deploy/helpers");
const {ethers, deployments} = hre;
const abiCoder = ethers.utils.defaultAbiCoder;

describe("IDOLunchBoxPool", () => {
    const THOUSAND = ethers.utils.parseEther("1000");
    const TEN_THOUSAND = ethers.utils.parseEther("10000");
    const LUNCH_BOX_ACTIVATION_DATA = abiCoder.encode(
        ["uint", "tuple(uint[], uint[])"],
        [10000, [[], []]]
    );
    const INVALID_LUNCH_BOX_ACTIVATION_DATA = abiCoder.encode(
        ["uint", "tuple(uint[], uint[])"],
        [9000, [[], []]]
    );

    beforeEach(async () => {
        await deployments.fixture(['debug']);
        [owner, idoPool] = await ethers.getSigners();
        const IdoLunchBoxPool = await ethers.getContractFactory("IDOLunchBoxPool");
        idoLunchBoxPool = await IdoLunchBoxPool.deploy();
        snacks = await ethers.getContractAt(
            hre.names.internal.snacks,
            (await deployments.get(hre.names.internal.snacks)).address
        );
        snacksPool = await ethers.getContractAt(
            hre.names.internal.snacksPool,
            (await deployments.get(hre.names.internal.snacksPool)).address
        );
        lunchBox = await ethers.getContractAt(
            hre.names.internal.lunchBox,
            (await deployments.get(hre.names.internal.lunchBox)).address
        );
        await idoLunchBoxPool.grantRole(keccak256("IDO_POOL_ROLE"), owner.address);
        await mintZoinksAndAllSnacks(deployments, owner, TEN_THOUSAND, owner);
    });

    it("Successful initialize() execution", async() => {
        // Initialize
        await idoLunchBoxPool.initialize(snacks.address, snacksPool.address, idoPool.address, owner.address);
        // Checks
        expect(await idoLunchBoxPool.snacks()).to.equal(snacks.address);
        expect(await idoLunchBoxPool.snacksPool()).to.equal(snacksPool.address);
        expect(await idoLunchBoxPool.idoPool()).to.equal(idoPool.address);
        // Attempt to initialize again
        await expect(idoLunchBoxPool.initialize(snacks.address, snacksPool.address, idoPool.address, owner.address))
            .to.be.revertedWith("IDOLunchBoxPool: already initialized");
    });

    it("Successful stake() execution", async() => {
        // Initialize
        await idoLunchBoxPool.initialize(snacks.address, snacksPool.address, idoPool.address, owner.address);
        // Stake from IDOLunchBoxPool
        await snacks.approve(idoLunchBoxPool.address, 10000);
        await idoLunchBoxPool.stake(10000);
        // Check
        expect(await snacksPool.getBalance(idoLunchBoxPool.address)).to.equal(10000);
    });

    it("Successful exit() execution", async() => {
        // Initialize
        await idoLunchBoxPool.initialize(snacks.address, snacksPool.address, idoPool.address, owner.address);
        await snacksPool.excludeFromRestrictions(idoLunchBoxPool.address);
        // Stake from IDOLunchBoxPool
        await snacks.approve(idoLunchBoxPool.address, 10000);
        await idoLunchBoxPool.stake(10000);
        // Check
        expect(await snacksPool.getBalance(idoLunchBoxPool.address)).to.equal(10000);
        // Exit from IDOLunchBoxPool
        await idoLunchBoxPool.exit();
        // Check balance on IDOPool contract
        expect(await snacks.balanceOf(idoPool.address)).to.be.equal(10000);
    });

    it("Successful getReward() execution", async() => {
        // Initialize
        await idoLunchBoxPool.initialize(snacks.address, snacksPool.address, idoPool.address, owner.address);
        // Attempt to get reward without activated LunchBox
        await expect(idoLunchBoxPool.getReward()).to.be.revertedWith("IDOLunchBoxPool: LunchBox was not activated");
        // Stake from IDOLunchBoxPool
        await snacks.approve(idoLunchBoxPool.address, THOUSAND);
        await idoLunchBoxPool.stake(THOUSAND);
        // Attempt to activate LunchBox with invalid percentage
        await expect(idoLunchBoxPool.activateLunchBox(INVALID_LUNCH_BOX_ACTIVATION_DATA))
            .to.be.revertedWith("IDOLunchBoxPool: invalid percentage");
        // LunchBox activation
        await idoLunchBoxPool.activateLunchBox(LUNCH_BOX_ACTIVATION_DATA);
        // Get reward (0)
        await idoLunchBoxPool.getReward();
        // Notify LunchBox about reward
        await lunchBox.grantRole(keccak256("POOL_REWARD_DISTRIBUTOR_ROLE"), owner.address);
        await snacks.transfer(lunchBox.address, THOUSAND);
        await lunchBox.notifyRewardAmount(THOUSAND);
        await time.increase(100000);
        // Get earned amount
        const earned = await lunchBox.earned(idoLunchBoxPool.address);
        // Get reward
        await idoLunchBoxPool.getReward();
        // Check balance on IDOPool contract
        expect(await snacks.balanceOf(idoPool.address)).to.be.equal(earned);
    });
});