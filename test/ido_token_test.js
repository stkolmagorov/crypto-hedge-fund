const {expect} = require("chai");
const hre = require("hardhat");
const {ZERO_ADDRESS} = require("../deploy/helpers");
const keccak256 = require("keccak256");
const {ethers} = hre;

describe("IDOToken", () => {
    beforeEach(async () => {
        [owner] = await ethers.getSigners();
        const IdoToken = await ethers.getContractFactory("IDOToken");
        idoToken = await IdoToken.deploy();
    });

    it("Successful initialize() execution", async() => {
        // Initialize
        await idoToken.initialize(100, "N", "S", ZERO_ADDRESS);
        // Checks
        expect(await idoToken.maxSupply()).to.equal(100);
        expect(await idoToken.name()).to.equal("N");
        expect(await idoToken.symbol()).to.equal("S");
    });

    it("Successful mint() execution", async() => {
        // Initialize
        await idoToken.initialize(100, "N", "S", ZERO_ADDRESS);
        await idoToken.grantRole(keccak256("IDO_POOL_ROLE"), owner.address);
        // Mint
        await idoToken.mint(100);
        // Check balance
        expect(await idoToken.balanceOf(owner.address)).to.equal(100);
        // Attempt to exceed maxSupply
        await expect(idoToken.mint(1)).to.be.revertedWith("IDOToken: max supply exceeded");
    });

    it("Successful mintFor() execution", async() => {
        // Initialize
        await idoToken.initialize(100, "N", "S", ZERO_ADDRESS);
        await idoToken.grantRole(keccak256("IDO_POOL_ROLE"), owner.address);
        // Mint for owner
        await idoToken.mintFor(owner.address, 100);
        // Check balance
        expect(await idoToken.balanceOf(owner.address)).to.equal(100);
        // Attempt to exceed maxSupply
        await expect(idoToken.mintFor(owner.address, 1)).to.be.revertedWith("IDOToken: max supply exceeded");
    });

    it("Successful changeNameAndSymbol() execution", async() => {
        // Initialize
        await idoToken.initialize(100, "N", "S", ZERO_ADDRESS);
        await idoToken.grantRole(keccak256("IDO_POOL_ROLE"), owner.address);
        // Change name and symbol
        await idoToken.changeNameAndSymbol("T", "M");
        // Checks
        expect(await idoToken.name()).to.equal("T");
        expect(await idoToken.symbol()).to.equal("M");
    });
});