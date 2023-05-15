const {expect} = require("chai");
const hre = require("hardhat");
const {ZERO, ZERO_ADDRESS, mintZoinksAndAllSnacks, mockSwaps, mockedResultOfSwap} = require("../deploy/helpers");
const {ethers, deployments} = hre;
const keccak256 = require("keccak256");

describe("IDODistributor", () => {
    const THOUSAND = ethers.utils.parseEther("1000");
    const THREE_HUNDRED = ethers.utils.parseEther("300");
    const HUNDRED = ethers.utils.parseEther("100");
    const ONE = ethers.utils.parseEther("1");

    beforeEach(async () => {
        await deployments.fixture(['debug']);
        [owner, authority] = await ethers.getSigners();
        snacksPool = await ethers.getContractAt(
            hre.names.internal.snacksPool,
            (await deployments.get(hre.names.internal.snacksPool)).address
        );
        idoDistributor = await ethers.getContractAt(
            hre.names.internal.iDODistributor,
            (await deployments.get(hre.names.internal.iDODistributor)).address
        );
        idoFactory = await ethers.getContractAt(
            hre.names.internal.iDOFactory,
            (await deployments.get(hre.names.internal.iDOFactory)).address
        );
        zoinks = await ethers.getContractAt(
            hre.names.internal.zoinks,
            (await deployments.get(hre.names.internal.zoinks)).address
        );
        busd = await ethers.getContractAt(
            hre.names.internal.mockToken,
            (await deployments.get(hre.names.external.tokens.busd)).address
        );
        btc = await ethers.getContractAt(
            hre.names.internal.mockToken,
            (await deployments.get(hre.names.external.tokens.btc)).address
        );
        eth = await ethers.getContractAt(
            hre.names.internal.mockToken,
            (await deployments.get(hre.names.external.tokens.eth)).address
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
        await snacksPool.excludeFromRestrictions(owner.address);
        await mintZoinksAndAllSnacks(deployments, owner, THOUSAND, owner);
        await snacks.transfer(snacksPool.address, HUNDRED);
        await btcSnacks.transfer(snacksPool.address, HUNDRED);
        await ethSnacks.transfer(snacksPool.address, HUNDRED);
    });

    it("Successful configure() execution", async() => {
        await idoDistributor.configure(
            zoinks.address,
            btc.address,
            eth.address,
            snacks.address,
            owner.address,
            owner.address,
            owner.address,
            owner.address,
            owner.address
        );
    });

    it("Successful approveSnacksToIdoPool() execution", async() => {
        await idoDistributor.grantRole(keccak256("IDO_FACTORY_ROLE"), owner.address);
        // Approve
        await idoDistributor.approveSnacksToIdoPool(owner.address);
        // Check
        expect(await snacks.allowance(idoDistributor.address, owner.address)).to.equal(ethers.constants.MaxUint256);
    });

    it("Successful exchangeInvestments() execution", async() => {
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
        // Grant role INVESTMENT_SYSTEM_DISTRIBUTOR to owner for simplification
        await idoDistributor.grantRole(keccak256("INVESTMENT_SYSTEM_DISTRIBUTOR_ROLE"), owner.address);
        // All three currencies > 0 (insufficient amounts)
        await idoDistributor.exchangeInvestments(0, 10, 10, 10, 0, 0, 0);
        expect(await idoDistributor.snacksAmountStoredById(0)).to.equal(8);
        expect(await idoDistributor.zoinksAmountToDiversifyById(0)).to.equal(0);
        expect(await idoDistributor.btcSnacksAmountStoredById(0)).to.equal(10);
        expect(await idoDistributor.ethSnacksAmountStoredById(0)).to.equal(10);
        expect(await idoDistributor.busdAmountToDiversifyById(0)).to.equal(0);
        expect(await idoDistributor.zoinksAmountStoredById(0)).to.equal(0);
        expect(await idoDistributor.snacksAmountToDiversifyById(0)).to.equal(2);
        // Mock swaps
        await mockSwaps(
            hre.names.external.routers.pancake,
            deployments,
            ZERO,
            idoDistributor.address,
            mockedResultOfSwap,
        );
        await zoinks.transfer(idoDistributor.address, mockedResultOfSwap);
        // All three currencies > 0 (sufficient amounts)
        await idoDistributor.exchangeInvestments(0, ONE, ONE, ONE, 0, 0, 0);
        expect(await idoDistributor.snacksAmountStoredById(0)).to.equal(0);
        expect(await idoDistributor.zoinksAmountToDiversifyById(0)).to.equal(ethers.BigNumber.from("32994285805646009"));
        expect(await idoDistributor.btcSnacksAmountStoredById(0)).to.equal(0);
        expect(await idoDistributor.ethSnacksAmountStoredById(0)).to.equal(0);
        expect(await idoDistributor.busdAmountToDiversifyById(0)).to.equal(ethers.BigNumber.from("3200000000000000000"));
        expect(await idoDistributor.zoinksAmountStoredById(0)).to.equal(0);
        expect(await idoDistributor.snacksAmountToDiversifyById(0)).to.equal(ethers.BigNumber.from("41642324909611775002"));
        // All three currencies = 0
        await idoDistributor.exchangeInvestments(0, 0, 0, 0, 0, 0, 0);
        expect(await idoDistributor.snacksAmountStoredById(0)).to.equal(0);
        expect(await idoDistributor.zoinksAmountToDiversifyById(0)).to.equal(ethers.BigNumber.from("32994285805646009"));
        expect(await idoDistributor.btcSnacksAmountStoredById(0)).to.equal(0);
        expect(await idoDistributor.ethSnacksAmountStoredById(0)).to.equal(0);
        expect(await idoDistributor.busdAmountToDiversifyById(0)).to.equal(ethers.BigNumber.from("3200000000000000000"));
        expect(await idoDistributor.zoinksAmountStoredById(0)).to.equal(0);
        expect(await idoDistributor.snacksAmountToDiversifyById(0)).to.equal(ethers.BigNumber.from("41642324909611775002"));
        await zoinks.transfer(idoDistributor.address, mockedResultOfSwap);
        // All three currencies > 0 (sufficient amounts)
        await idoDistributor.exchangeInvestments(0, ONE, ONE, ONE, 0, 0, 0);
        // Mock swaps
        await mockSwaps(
            hre.names.external.routers.pancake,
            deployments,
            ZERO,
            idoDistributor.address,
            10,
        );
        // All three currencies > 0 (sufficient amounts)
        await idoDistributor.exchangeInvestments(0, ONE, ONE, ONE, 0, 0, 0);
        expect(await idoDistributor.zoinksAmountStoredById(0)).to.equal(10);
        // Mock swaps
        await mockSwaps(
            hre.names.external.routers.pancake,
            deployments,
            ZERO,
            idoDistributor.address,
            mockedResultOfSwap,
        );
        await zoinks.transfer(idoDistributor.address, mockedResultOfSwap.add(10));
        // All three currencies > 0 (sufficient amounts)
        await idoDistributor.exchangeInvestments(0, ONE, ONE, ONE, 0, 0, 0);
        expect(await idoDistributor.zoinksAmountStoredById(0)).to.equal(0);
        // Exchange when IDO is invalid
        await idoFactory.closeIdo(0);
        // All three > 0
        await idoDistributor.exchangeInvestments(0, ONE, ONE, ONE, 0, 0, 0);
        const idoPoolAddress = await idoFactory.idoPoolAddressById(0);
        expect(await snacks.balanceOf(idoPoolAddress)).to.equal(ONE);
        expect(await btcSnacks.balanceOf(idoPoolAddress)).to.equal(ONE);
        expect(await ethSnacks.balanceOf(idoPoolAddress)).to.equal(ONE);
        // All three = 0
        await idoDistributor.exchangeInvestments(0, 0, 0, 0, 0, 0, 0);
        expect(await snacks.balanceOf(idoPoolAddress)).to.equal(ONE);
        expect(await btcSnacks.balanceOf(idoPoolAddress)).to.equal(ONE);
        expect(await ethSnacks.balanceOf(idoPoolAddress)).to.equal(ONE);
    });

    it("Successful fundIDO() execution", async() => {
        // Attempt to fund invalid IDO
        await expect(idoDistributor.fundIDO(0, 100, 100)).to.be.revertedWith("IDODistributor: invalid IDO id");
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
        // Attempt to fund IDO with insufficient balances
        await expect(idoDistributor.fundIDO(0, 10, 10)).to.be.revertedWith("IDODistributor: insufficient balance");
        // Transfer tokens to IDODistributor
        await zoinks.transfer(idoDistributor.address, HUNDRED);
        await busd.transfer(idoDistributor.address, HUNDRED);
        // Attempt to fund IDO with invalid amount
        await expect(idoDistributor.fundIDO(0, 100, 100)).to.be.revertedWith("IDODistributor: invalid amount to fund");
        // Successful call
        await idoDistributor.fundIDO(0, 50, 50);
        expect(await idoDistributor.busdAmountToDiversifyById(0)).to.equal(50);
        expect(await idoDistributor.zoinksAmountToDiversifyById(0)).to.equal(50);
    });

    it("Successful diversify() execution", async() => {
        // Grant role INVESTMENT_SYSTEM_DISTRIBUTOR to owner for simplification
        await idoDistributor.grantRole(keccak256("INVESTMENT_SYSTEM_DISTRIBUTOR_ROLE"), owner.address);
        // Open IDO
        const idoParameters = {
            numberOfProjects: 3,
            totalRequiredAmountOfFunds: THREE_HUNDRED,
            insuranceRecipient: ZERO_ADDRESS,
            defaultOwner: ZERO_ADDRESS,
            authority: ZERO_ADDRESS,
            idoLunchBoxPoolAddress: ZERO_ADDRESS,
            idoPoolAddress: ZERO_ADDRESS,
            requiredAmountsOfFunds: [HUNDRED, HUNDRED, HUNDRED],
            shares: [0, 0, 0],
            fundsReceivers: [owner.address, owner.address, owner.address],
            idoTokens: [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS],
            names: ["N", "NN", "NNN"],
            symbols: ["S", "SS", "SSS"]
        }
        await idoFactory.openIdo(idoParameters);
        // Mock swaps
        await mockSwaps(
            hre.names.external.routers.pancake,
            deployments,
            ZERO,
            idoDistributor.address,
            mockedResultOfSwap,
        );
        await zoinks.transfer(idoDistributor.address, mockedResultOfSwap);
        // Exchange investments
        let zoinksAmountToDiversify = ethers.BigNumber.from("32994285805646008");
        let busdAmountToDiversify = ethers.BigNumber.from("3200000000000000000");
        let snacksAmountToDiversify = ethers.BigNumber.from("41642324909611775000");
        await idoDistributor.exchangeInvestments(0, ONE, ONE, ONE, 0, 0, 0);
        expect(await idoDistributor.snacksAmountStoredById(0)).to.equal(0);
        expect(await idoDistributor.zoinksAmountToDiversifyById(0)).to.equal(zoinksAmountToDiversify);
        expect(await idoDistributor.btcSnacksAmountStoredById(0)).to.equal(0);
        expect(await idoDistributor.ethSnacksAmountStoredById(0)).to.equal(0);
        expect(await idoDistributor.busdAmountToDiversifyById(0)).to.equal(busdAmountToDiversify);
        expect(await idoDistributor.zoinksAmountStoredById(0)).to.equal(0);
        expect(await idoDistributor.snacksAmountToDiversifyById(0)).to.equal(snacksAmountToDiversify);
        // Transfer tokens
        await zoinks.transfer(idoDistributor.address, zoinksAmountToDiversify);
        await busd.transfer(idoDistributor.address, busdAmountToDiversify);
        await snacks.transfer(idoDistributor.address, snacksAmountToDiversify);
        // Diversify with non zero amounts
        await idoDistributor.diversify(0);
        expect(await idoDistributor.zoinksAmountToDiversifyById(0)).to.equal(0);
        expect(await idoDistributor.busdAmountToDiversifyById(0)).to.equal(0);
        expect(await idoDistributor.snacksAmountToDiversifyById(0)).to.equal(0);
        // Diversify with zero amounts
        await idoDistributor.diversify(0);
        // Mock swaps
        await mockSwaps(
            hre.names.external.routers.pancake,
            deployments,
            ZERO,
            idoDistributor.address,
            THOUSAND.div(2),
        );
        await zoinks.transfer(idoDistributor.address, THOUSAND.div(2));
        await idoDistributor.exchangeInvestments(0, ONE, ONE, ONE, 0, 0, 0);
        zoinksAmountToDiversify = await idoDistributor.zoinksAmountToDiversifyById(0);
        busdAmountToDiversify = await idoDistributor.busdAmountToDiversifyById(0);
        snacksAmountToDiversify = await idoDistributor.snacksAmountToDiversifyById(0);
        await zoinks.transfer(idoDistributor.address, zoinksAmountToDiversify);
        await busd.transfer(idoDistributor.address, busdAmountToDiversify);
        await snacks.transfer(idoDistributor.address, snacksAmountToDiversify);
        // Diversify with IDO closing
        await idoDistributor.diversify(0);
        expect(await idoFactory.isValidIdoId(0)).to.equal(false);
        idoPool = await ethers.getContractAt(
            hre.names.internal.iDOPool,
            await idoFactory.idoPoolAddressById(0)
        );
        expect(await idoPool.requiredAmountOfFunds()).to.equal(0);
    });
});