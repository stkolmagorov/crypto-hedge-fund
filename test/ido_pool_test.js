const {time} = require("@nomicfoundation/hardhat-network-helpers");
const {expect} = require("chai");
const hre = require("hardhat");
const {ZERO, ZERO_ADDRESS, mintZoinksAndAllSnacks, mockSwaps, withImpersonatedSigner, mintNativeTokens} = require("../deploy/helpers");
const {ethers, deployments} = hre;
const keccak256 = require("keccak256");
const {MerkleTree} = require('merkletreejs');
const abiCoder = ethers.utils.defaultAbiCoder;

describe("IDOPool", () => {
    const THOUSAND = ethers.utils.parseEther("1000");
    const SIX_HUNDRED = ethers.utils.parseEther("600");
    const HUNDRED = ethers.utils.parseEther("100");
    const TWO_HUNDRED = ethers.utils.parseEther("200");
    const THREE_HUNDRED = ethers.utils.parseEther("300");
    const FIVE_HUNDRED = ethers.utils.parseEther("500");
    const ONE = ethers.utils.parseEther("1");
    const THREE = ethers.utils.parseEther("3");

    beforeEach(async () => {
        await deployments.fixture(['debug']);
        [
            owner, 
            authority, 
            insuranceRecipient, 
            firstProjectFundsReceiver,
            secondProjectFundsReceiver,
            thirdProjectFundsReceiver
        ] = await ethers.getSigners();
        snacksPool = await ethers.getContractAt(
            hre.names.internal.snacksPool,
            (await deployments.get(hre.names.internal.snacksPool)).address
        );
        poolRewardDistributor = await ethers.getContractAt(
            hre.names.internal.poolRewardDistributor,
            (await deployments.get(hre.names.internal.poolRewardDistributor)).address
        );
        idoDistributor = await ethers.getContractAt(
            hre.names.internal.iDODistributor,
            (await deployments.get(hre.names.internal.iDODistributor)).address
        );
        // Grant role INVESTMENT_SYSTEM_DISTRIBUTOR to owner for simplification
        await idoDistributor.grantRole(keccak256("INVESTMENT_SYSTEM_DISTRIBUTOR_ROLE"), owner.address);
        idoFactory = await ethers.getContractAt(
            hre.names.internal.iDOFactory,
            (await deployments.get(hre.names.internal.iDOFactory)).address
        );
        // Open IDO
        const idoParameters = {
            numberOfProjects: 3,
            totalRequiredAmountOfFunds: 600,
            insuranceRecipient: insuranceRecipient.address,
            defaultOwner: owner.address,
            authority: authority.address,
            idoLunchBoxPoolAddress: ZERO_ADDRESS,
            idoPoolAddress: ZERO_ADDRESS,
            requiredAmountsOfFunds: [100, 200, 300],
            shares: [0, 0, 0],
            fundsReceivers: [
                firstProjectFundsReceiver.address, 
                secondProjectFundsReceiver.address, 
                thirdProjectFundsReceiver.address
            ],
            idoTokens: [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS],
            names: ["First Project", "Second Project", "Third Project"],
            symbols: ["FP", "SP", "TP"]
        }
        await idoFactory.openIdo(idoParameters);
        idoPool = await ethers.getContractAt(
            hre.names.internal.iDOPool,
            await idoFactory.idoPoolAddressById(0)
        );
        await idoPool.grantRole(keccak256("IDO_DISTRIBUTOR_ROLE"), owner.address);
        idoLunchBoxPool = await ethers.getContractAt(
            hre.names.internal.iDOLunchBoxPool,
            await idoPool.idoLunchBoxPool()
        );
        zoinks = await ethers.getContractAt(
            hre.names.internal.zoinks,
            (await deployments.get(hre.names.internal.zoinks)).address
        );
        busd = await ethers.getContractAt(
            hre.names.internal.mockToken,
            (await deployments.get(hre.names.external.tokens.busd)).address
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

    it("Successful initialize() check", async() => {
        const idoPoolParameters = {
            insuranceRecipient: insuranceRecipient.address,
            defaultOwner: owner.address,
            authority: authority.address,
            idoLunchBoxPoolAddress: ZERO_ADDRESS,
            idoPoolAddress: ZERO_ADDRESS,
            requiredAmountsOfFunds: [100, 200, 300],
            shares: [0, 0, 0],
            fundsReceivers: [
                firstProjectFundsReceiver.address, 
                secondProjectFundsReceiver.address, 
                thirdProjectFundsReceiver.address
            ],
            idoTokens: [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS]
        }
        await expect(idoPool.initialize(
            idoPoolParameters,
            [snacks.address, btcSnacks.address, ethSnacks.address],
            ZERO_ADDRESS,
            ZERO_ADDRESS,
            ZERO_ADDRESS,
            ZERO_ADDRESS
        )).to.be.revertedWith("IDOPool: already initialized");
    });

    it("Successful setFundsReceiver() execution", async() => {
        // Attempt to set invalid funds receiver
        await expect(idoPool.setFundsReceiver(1, thirdProjectFundsReceiver.address))
            .to.be.revertedWith("IDOPool: invalid funds receiver");
        await expect(idoPool.setFundsReceiver(3, secondProjectFundsReceiver.address))
            .to.be.revertedWith("IDOPool: invalid id");
        // Set funds receiver for second project
        expect(await idoPool.fundsReceiverByProjectId(1)).to.equal(secondProjectFundsReceiver.address);
        await idoPool.setFundsReceiver(1, authority.address);
        expect(await idoPool.fundsReceiverByProjectId(1)).to.equal(authority.address);
        // Remove project
        await idoPool.removeProject(0);
        // Attempt to set funds receiver for removed project
        await expect(idoPool.setFundsReceiver(0, secondProjectFundsReceiver.address))
            .to.be.revertedWith("IDOPool: project was completed or removed");
    });

    it("Successful changeIdoTokenNameAndSymbol() execution", async() => {
        idoToken = await ethers.getContractAt(
            hre.names.internal.iDOToken,
            await idoPool.idoTokens(0)
        );
        // Successful changing
        expect(await idoToken.name()).to.equal("First Project");
        expect(await idoToken.symbol()).to.equal("FP");
        await idoPool.changeIdoTokenNameAndSymbol(0, "TEST", "T");
        expect(await idoToken.name()).to.equal("TEST");
        expect(await idoToken.symbol()).to.equal("T");
        // Attempt to change with invalid id
        await expect(idoPool.changeIdoTokenNameAndSymbol(3, "TEST", "T"))
            .to.be.revertedWith("IDOPool: invalid id");
    });

    it("Successful provideRewardForProject() execution", async() => {
        await busd.approve(idoPool.address, HUNDRED);
        // Attempt to provide reward with invalid id
        await expect(idoPool.provideRewardForProject(3, ONE)).to.be.revertedWith("IDOPool: invalid id");
        // Attempt to provide zero reward
        await expect(idoPool.provideRewardForProject(0, 0)).to.be.revertedWith("IDOPool: insufficient amount");
        // Attempt to provide reward with removed project
        await idoPool.removeProject(0);
        await expect(idoPool.provideRewardForProject(0, ONE)).to.be.revertedWith("IDOPool: project was removed");
        // Reward providing
        expect(await idoPool.cumulativeSnacksRewardByProjectId(1)).to.equal(0);
        await idoPool.provideRewardForProject(1, ONE);
        expect(await idoPool.cumulativeSnacksRewardByProjectId(1)).to.be.gt(0);
    });

    it("Successful getReward() execution", async() => {
        // Notify reward
        await snacks.transfer(snacksPool.address, HUNDRED);
        await btcSnacks.transfer(snacksPool.address, HUNDRED);
        await ethSnacks.transfer(snacksPool.address, HUNDRED);
        await withImpersonatedSigner(poolRewardDistributor.address, async (poolRewardDistributorSigner) => {
            const hexAmountOfNativeTokens = '0x10000000000000000000';
            await mintNativeTokens(poolRewardDistributor.address, hexAmountOfNativeTokens);
            await snacksPool.connect(poolRewardDistributorSigner).notifyRewardAmount(snacks.address, HUNDRED);
            await snacksPool.connect(poolRewardDistributorSigner).notifyRewardAmount(btcSnacks.address, HUNDRED);
            await snacksPool.connect(poolRewardDistributorSigner).notifyRewardAmount(ethSnacks.address, HUNDRED);
        });
        // Stake
        await snacks.approve(idoPool.address, HUNDRED);
        await idoPool.stake(HUNDRED);
        // Activate LunchBox
        await idoLunchBoxPool.connect(authority).activateLunchBox(abiCoder.encode(["uint", "tuple(uint[], uint[])"], [10000, [[], []]]));
        await time.increase(100000);
        // Get reward
        expect(await idoPool.cumulativeCommonSnacksReward()).to.equal(0);
        expect(await idoPool.cumulativeCommonBtcSnacksReward()).to.equal(0);
        expect(await idoPool.cumulativeCommonEthSnacksReward()).to.equal(0);
        expect(await snacks.balanceOf(insuranceRecipient.address)).to.equal(0);
        expect(await btcSnacks.balanceOf(insuranceRecipient.address)).to.equal(0);
        expect(await ethSnacks.balanceOf(insuranceRecipient.address)).to.equal(0);
        await idoPool.connect(authority).getReward();
        expect(await idoPool.cumulativeCommonSnacksReward()).to.be.gt(0);
        expect(await idoPool.cumulativeCommonBtcSnacksReward()).to.be.gt(0);
        expect(await idoPool.cumulativeCommonEthSnacksReward()).to.be.gt(0);
        expect(await snacks.balanceOf(insuranceRecipient.address)).to.be.gt(0);
        expect(await btcSnacks.balanceOf(insuranceRecipient.address)).to.be.gt(0);
        expect(await ethSnacks.balanceOf(insuranceRecipient.address)).to.be.gt(0);
        // Get 0 rewards
        await idoPool.connect(authority).getReward();
        // Attempt to get reward when insurance deposit was closed
        await idoPool.connect(authority).closeInsuranceDeposit();
        await expect(idoPool.connect(authority).getReward()).to.be.revertedWith("IDOPool: insurance deposit was closed");
    });

    it("Successful closeInsuranceDeposit() execution", async() => {
        // Stake
        await snacks.approve(idoPool.address, HUNDRED);
        await idoPool.stake(HUNDRED);
        expect(await snacksPool.getBalance(idoPool.address)).to.be.gt(0);
        expect(await snacksPool.getBalance(idoLunchBoxPool.address)).to.be.gt(0);
        // Close 
        await idoPool.connect(authority).closeInsuranceDeposit();
        expect(await snacksPool.getBalance(idoPool.address)).to.equal(0);
        expect(await snacksPool.getBalance(idoLunchBoxPool.address)).to.equal(0);
        // Attempt to close again
        await expect(idoPool.connect(authority).closeInsuranceDeposit()).to.be.revertedWith("IDOPool: already closed")
    });

    it("Successful claimIdoTokens() execution", async() => {
        // Exchange investments
        await mockSwaps(
            hre.names.external.routers.pancake,
            deployments,
            ZERO,
            idoDistributor.address,
            HUNDRED,
        );
        await zoinks.transfer(idoDistributor.address, HUNDRED);
        await idoDistributor.exchangeInvestments(0, ONE, ONE, ONE, 0, 0, 0);
        zoinksAmountToDiversify = await idoDistributor.zoinksAmountToDiversifyById(0);
        busdAmountToDiversify = await idoDistributor.busdAmountToDiversifyById(0);
        snacksAmountToDiversify = await idoDistributor.snacksAmountToDiversifyById(0);
        await zoinks.transfer(idoDistributor.address, zoinksAmountToDiversify);
        await busd.transfer(idoDistributor.address, busdAmountToDiversify);
        await snacks.transfer(idoDistributor.address, snacksAmountToDiversify);
        // Diversify with IDO closing
        await idoDistributor.diversify(0);
        // Merkle tree generation
        const wallets = [authority.address, owner.address];
        const cumulativeIdoTokenArrays =[
            [10, 10, 10],
            [30, 30, 30]
        ];
        const elements = [];
        for (let i = 0; i < wallets.length; i++) {
            let data = ethers.utils.hexZeroPad(cumulativeIdoTokenArrays[i][0], 32).substring(2);
            for (let j = 1; j < cumulativeIdoTokenArrays[i].length; j++) {
                data += ethers.utils.hexZeroPad(cumulativeIdoTokenArrays[i][j], 32).substring(2);
            }
            elements[i] = wallets[i] + data;
        }
        const hashedElements = elements.map(keccak256).map(x => MerkleTree.bufferToHex(x));
        const tree = new MerkleTree(elements, keccak256, { hashLeaves: true, sort: true });
        const root = tree.getHexRoot();
        await idoPool.connect(authority).setMerkleRootForIdoTokens(root);
        const leaves = tree.getHexLeaves();
        const proofs = leaves.map(tree.getHexProof, tree);
        // Claim
        await idoPool.connect(authority).claimIdoTokens(
            authority.address,
            root, 
            proofs[leaves.indexOf(hashedElements[0])],
            cumulativeIdoTokenArrays[0]
        );
        idoToken = await ethers.getContractAt(
            hre.names.internal.iDOToken,
            await idoPool.idoTokens(0)
        );
        expect(await idoToken.balanceOf(authority.address)).to.equal(10);
        // Claim again
        await idoPool.connect(authority).claimIdoTokens(
            authority.address,
            root, 
            proofs[leaves.indexOf(hashedElements[0])],
            cumulativeIdoTokenArrays[0]
        );
        expect(await idoToken.balanceOf(authority.address)).to.equal(10);
        // Claim with invalid proof
        await expect(idoPool.connect(authority).claimIdoTokens(
            authority.address,
            root, 
            proofs[leaves.indexOf(hashedElements[1])],
            cumulativeIdoTokenArrays[0]
        )).to.be.revertedWith("IDOPool: invalid proof");
        // Claim with invalid root
        await expect(idoPool.connect(authority).claimIdoTokens(
            authority.address,
            ethers.utils.hexZeroPad("0x", 32), 
            proofs[leaves.indexOf(hashedElements[0])],
            cumulativeIdoTokenArrays[0]
        )).to.be.revertedWith("IDOPool: merkle root was updated");
    });

    it("Successful claimSnacks() execution", async() => {
        await snacks.transfer(idoPool.address, HUNDRED);
        await btcSnacks.transfer(idoPool.address, HUNDRED);
        await ethSnacks.transfer(idoPool.address, HUNDRED);
        // Merkle tree generation
        const wallets = [authority.address, owner.address];
        const cumulativeSnacksArrays =[
            [10, 10, 10],
            [30, 30, 30]
        ];
        const elements = [];
        for (let i = 0; i < wallets.length; i++) {
            let data = ethers.utils.hexZeroPad(cumulativeSnacksArrays[i][0], 32).substring(2);
            for (let j = 1; j < cumulativeSnacksArrays[i].length; j++) {
                data += ethers.utils.hexZeroPad(cumulativeSnacksArrays[i][j], 32).substring(2);
            }
            elements[i] = wallets[i] + data;
        }
        const hashedElements = elements.map(keccak256).map(x => MerkleTree.bufferToHex(x));
        const tree = new MerkleTree(elements, keccak256, { hashLeaves: true, sort: true });
        const root = tree.getHexRoot();
        await idoPool.connect(authority).setMerkleRootForSnacks(root);
        const leaves = tree.getHexLeaves();
        const proofs = leaves.map(tree.getHexProof, tree);
        // Claim
        await idoPool.connect(authority).claimSnacks(
            authority.address,
            root, 
            proofs[leaves.indexOf(hashedElements[0])],
            cumulativeSnacksArrays[0]
        );
        expect(await snacks.balanceOf(authority.address)).to.equal(10);
        // Claim again
        await idoPool.connect(authority).claimSnacks(
            authority.address,
            root, 
            proofs[leaves.indexOf(hashedElements[0])],
            cumulativeSnacksArrays[0]
        );
        expect(await snacks.balanceOf(authority.address)).to.equal(10);
        // Claim with invalid proof
        await expect(idoPool.connect(authority).claimSnacks(
            authority.address,
            root, 
            proofs[leaves.indexOf(hashedElements[1])],
            cumulativeSnacksArrays[0]
        )).to.be.revertedWith("IDOPool: invalid proof");
        // Claim with invalid root
        await expect(idoPool.connect(authority).claimSnacks(
            authority.address,
            ethers.utils.hexZeroPad("0x", 32), 
            proofs[leaves.indexOf(hashedElements[0])],
            cumulativeSnacksArrays[0]
        )).to.be.revertedWith("IDOPool: merkle root was updated");
    });

    it("Successful removeProject() execution (without self-closing)", async() => {
        await zoinks.transfer(idoPool.address, 480);
        // Mint 480
        await idoPool.mint(480);
        // Checks
        expect(await idoPool.requiredAmountOfFunds()).to.equal(120);
        expect(await idoPool.fundsRaisedByProjectId(0)).to.equal(80);
        expect(await idoPool.fundsRaisedByProjectId(1)).to.equal(160);
        expect(await idoPool.fundsRaisedByProjectId(2)).to.equal(240);
        // Remove project with non-existent id
        await expect(idoPool.removeProject(3)).to.be.revertedWith("IDOPool: invalid id");
        const ownerZoinksBalanceBefore = await zoinks.balanceOf(owner.address);
        // Successful removal
        await idoPool.removeProject(0);
        // Checks
        expect(await idoPool.isFundsReceiver(firstProjectFundsReceiver.address)).to.equal(false);
        expect(await idoPool.isFundraisingCompletedByProjectId(0)).to.equal(true);
        expect(await idoPool.numberOfProjectsInProgress()).to.equal(2);
        expect(await idoPool.requiredAmountOfFunds()).to.equal(100);
        expect(await idoPool.shares(0)).to.equal(0);
        expect(await idoPool.shares(1)).to.equal(ethers.BigNumber.from("2500000000000000000"));
        expect(await idoPool.shares(2)).to.equal(ethers.BigNumber.from("1666666666666666666"));
        expect(await idoPool.isRemovedByProjectId(0)).to.equal(true);
        expect(await zoinks.balanceOf(owner.address)).to.equal(ownerZoinksBalanceBefore.add(80));
        // Close IDO
        await zoinks.transfer(idoPool.address, 100);
        await idoPool.mint(100);
        expect(await zoinks.balanceOf(idoPool.address)).to.equal(0);
        expect(await idoPool.isFundraisingCompletedByProjectId(1)).to.equal(true);
        expect(await idoPool.isFundraisingCompletedByProjectId(2)).to.equal(true);
        expect(await idoPool.requiredAmountOfFunds()).to.equal(0);
        // Attempt to remove completed project
        await expect(idoPool.removeProject(1)).to.be.revertedWith("IDOPool: already closed");
        expect(await zoinks.balanceOf(secondProjectFundsReceiver.address)).to.equal(200);
        expect(await zoinks.balanceOf(thirdProjectFundsReceiver.address)).to.equal(300);
    });

    it("Successful removeProject() execution (with self-closing)", async() => {
        await idoPool.removeProject(0);
        await idoPool.removeProject(1);
        await idoPool.removeProject(2);
        expect(await idoFactory.isValidIdoId(0)).to.equal(false);
        expect(await idoPool.requiredAmountOfFunds()).to.equal(0);
    });

    it("Successful changeRequiredAmountOfFunds() execution", async() => {
        // Attempt to change with invalid id
        await expect(idoPool.changeRequiredAmountOfFunds(3, 100)).to.be.revertedWith("IDOPool: invalid id");
        // Attempt to change with invalid amount
        await expect(idoPool.changeRequiredAmountOfFunds(0, 100))
            .to.be.revertedWith("IDOPool: invalid new required amount of funds value");
        // Change on bigger value
        await idoPool.changeRequiredAmountOfFunds(0, 1000);
        expect(await idoPool.requiredAmountOfFunds()).to.equal(1500);
        expect(await idoPool.requiredAmountOfFundsByProjectId(0)).to.equal(1000);
        expect(await idoPool.shares(0)).to.equal(ethers.BigNumber.from("1500000000000000000"));
        expect(await idoPool.shares(1)).to.equal(ethers.BigNumber.from("7500000000000000000"));
        expect(await idoPool.shares(2)).to.equal(ethers.BigNumber.from("5000000000000000000"));
        // Change on lower value
        await idoPool.changeRequiredAmountOfFunds(0, 100);
        expect(await idoPool.requiredAmountOfFunds()).to.equal(600);
        expect(await idoPool.requiredAmountOfFundsByProjectId(0)).to.equal(100);
        expect(await idoPool.shares(0)).to.equal(ethers.BigNumber.from("6000000000000000000"));
        expect(await idoPool.shares(1)).to.equal(ethers.BigNumber.from("3000000000000000000"));
        expect(await idoPool.shares(2)).to.equal(ethers.BigNumber.from("2000000000000000000"));
        // Remove project
        await idoPool.removeProject(0);
        expect(await idoPool.requiredAmountOfFunds()).to.equal(500);
        expect(await idoPool.shares(0)).to.equal(ethers.BigNumber.from("0"));
        expect(await idoPool.shares(1)).to.equal(ethers.BigNumber.from("2500000000000000000"));
        expect(await idoPool.shares(2)).to.equal(ethers.BigNumber.from("1666666666666666666"));
        // Attempt to change on removed project
        await expect(idoPool.changeRequiredAmountOfFunds(0, 200)).to.be.revertedWith("IDOPool: already closed");
        // Change on bigger value
        await idoPool.changeRequiredAmountOfFunds(1, HUNDRED);
        expect(await idoPool.requiredAmountOfFunds()).to.equal(HUNDRED.add(300));
        expect(await idoPool.requiredAmountOfFundsByProjectId(1)).to.equal(HUNDRED);
        expect(await idoPool.shares(0)).to.equal(ethers.BigNumber.from("0"));
        expect(await idoPool.shares(1)).to.equal(ethers.BigNumber.from("1000000000000000003"));
        expect(await idoPool.shares(2)).to.equal(ethers.BigNumber.from("333333333333333334333333333333333333"));
        // Direct fund second project
        await snacks.approve(idoPool.address, HUNDRED.div(2));
        await idoPool.fundProjectDirectly(1, HUNDRED.div(2));
        // Change on smaller value
        await idoPool.changeRequiredAmountOfFunds(1, THREE);
        expect(await idoPool.requiredAmountOfFunds()).to.equal(ethers.BigNumber.from("938853437147124743"));
        expect(await idoPool.requiredAmountOfFundsByProjectId(1)).to.equal(THREE);
        expect(await idoPool.shares(0)).to.equal(ethers.BigNumber.from("0"));
        expect(await idoPool.shares(1)).to.equal(ethers.BigNumber.from("1000000000000000319"));
        expect(await idoPool.shares(2)).to.equal(ethers.BigNumber.from("3129511457157082476666666666666666"));
    });

    it("Successful fundProjectDirectly() execution", async() => {
        const idoParametersLocal = {
            numberOfProjects: 3,
            totalRequiredAmountOfFunds: SIX_HUNDRED,
            insuranceRecipient: insuranceRecipient.address,
            defaultOwner: owner.address,
            authority: authority.address,
            idoLunchBoxPoolAddress: ZERO_ADDRESS,
            idoPoolAddress: ZERO_ADDRESS,
            requiredAmountsOfFunds: [HUNDRED, TWO_HUNDRED, THREE_HUNDRED],
            shares: [0, 0, 0],
            fundsReceivers: [
                firstProjectFundsReceiver.address, 
                secondProjectFundsReceiver.address, 
                thirdProjectFundsReceiver.address
            ],
            idoTokens: [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS],
            names: ["First Project", "Second Project", "Third Project"],
            symbols: ["FP", "SP", "TP"]
        }
        await idoFactory.openIdo(idoParametersLocal);
        idoPoolLocal = await ethers.getContractAt(
            hre.names.internal.iDOPool,
            await idoFactory.idoPoolAddressById(1)
        );
        idoTokenLocal = await ethers.getContractAt(
            hre.names.internal.iDOToken,
            await idoPoolLocal.idoTokens(0)
        );
        await snacks.approve(idoPoolLocal.address, THOUSAND);
        // Checks
        await expect(idoPoolLocal.fundProjectDirectly(3, 100)).to.be.revertedWith("IDOPool: invalid id");
        await expect(idoPoolLocal.fundProjectDirectly(0, 10)).to.be.revertedWith("IDOPool: insufficient amount");
        await expect(idoPoolLocal.fundProjectDirectly(0, THOUSAND)).to.be.revertedWith("IDOPool: invalid amount");
        // Fund with 100 Snacks
        const fundAmount = await snacks.calculatePayTokenAmountOnRedeem(HUNDRED.mul(9).div(10));
        const requiredAmountOfFunds = await idoPoolLocal.requiredAmountOfFunds();
        const currentAllowableAmountToFund = await idoPoolLocal.currentAllowableAmountToFundByProjectId(0);
        await idoPoolLocal.fundProjectDirectly(0, HUNDRED);
        // Checks
        expect(await idoTokenLocal.balanceOf(owner.address)).to.equal(fundAmount);
        expect(await idoPoolLocal.fundsRaisedByProjectId(0)).to.equal(fundAmount);
        expect(await idoPoolLocal.requiredAmountOfFunds()).to.equal(requiredAmountOfFunds.sub(fundAmount));
        expect(await idoPoolLocal.currentAllowableAmountToFundByProjectId(0)).to.equal(currentAllowableAmountToFund.sub(fundAmount));
        // Remove project
        await idoPoolLocal.removeProject(0);
        // Attempt to fund removed project
        await expect(idoPoolLocal.fundProjectDirectly(0, HUNDRED)).to.be.revertedWith("IDOPool: fundraising completed");
    });

    it("Successful changeAllowablePercentageForDirectFunding() execution", async() => {
        const idoParametersLocal = {
            numberOfProjects: 3,
            totalRequiredAmountOfFunds: SIX_HUNDRED,
            insuranceRecipient: insuranceRecipient.address,
            defaultOwner: owner.address,
            authority: authority.address,
            idoLunchBoxPoolAddress: ZERO_ADDRESS,
            idoPoolAddress: ZERO_ADDRESS,
            requiredAmountsOfFunds: [HUNDRED, TWO_HUNDRED, THREE_HUNDRED],
            shares: [0, 0, 0],
            fundsReceivers: [
                firstProjectFundsReceiver.address, 
                secondProjectFundsReceiver.address, 
                thirdProjectFundsReceiver.address
            ],
            idoTokens: [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS],
            names: ["First Project", "Second Project", "Third Project"],
            symbols: ["FP", "SP", "TP"]
        }
        await idoFactory.openIdo(idoParametersLocal);
        idoPoolLocal = await ethers.getContractAt(
            hre.names.internal.iDOPool,
            await idoFactory.idoPoolAddressById(1)
        );
        // Checks
        await expect(idoPoolLocal.changeAllowablePercentageForDirectFunding(10001)).to.be.revertedWith("IDOPool: invalid percentage");
        expect(await idoPoolLocal.initialAllowableAmountToFundByProjectId(0)).to.equal(HUNDRED.mul(20).div(100));
        expect(await idoPoolLocal.currentAllowableAmountToFundByProjectId(0)).to.equal(HUNDRED.mul(20).div(100));
        // Remove second project
        await idoPoolLocal.removeProject(1);
        // Fund first project
        await snacks.approve(idoPoolLocal.address, THOUSAND);
        const fundAmount = await snacks.calculatePayTokenAmountOnRedeem(TWO_HUNDRED.mul(9).div(10));
        await idoPoolLocal.fundProjectDirectly(0, TWO_HUNDRED);
        expect(await idoPoolLocal.initialAllowableAmountToFundByProjectId(0)).to.equal(HUNDRED.mul(20).div(100));
        expect(await idoPoolLocal.currentAllowableAmountToFundByProjectId(0)).to.equal(HUNDRED.mul(20).div(100).sub(fundAmount));
        // Change allowable percent to 100
        await idoPoolLocal.changeAllowablePercentageForDirectFunding(10000);
        expect(await idoPoolLocal.initialAllowableAmountToFundByProjectId(0)).to.equal(HUNDRED);
        expect(await idoPoolLocal.currentAllowableAmountToFundByProjectId(0)).to.equal(HUNDRED.sub(fundAmount));
        // Change allowable percent to 1
        await idoPoolLocal.changeAllowablePercentageForDirectFunding(100);
        expect(await idoPoolLocal.initialAllowableAmountToFundByProjectId(0)).to.equal(HUNDRED.div(100));
        expect(await idoPoolLocal.currentAllowableAmountToFundByProjectId(0)).to.equal(0);
    });

    it("Successful mint() execution", async() => {
        const idoParametersLocal = {
            numberOfProjects: 3,
            totalRequiredAmountOfFunds: SIX_HUNDRED,
            insuranceRecipient: insuranceRecipient.address,
            defaultOwner: owner.address,
            authority: authority.address,
            idoLunchBoxPoolAddress: ZERO_ADDRESS,
            idoPoolAddress: ZERO_ADDRESS,
            requiredAmountsOfFunds: [HUNDRED, TWO_HUNDRED, THREE_HUNDRED],
            shares: [0, 0, 0],
            fundsReceivers: [
                firstProjectFundsReceiver.address, 
                secondProjectFundsReceiver.address, 
                thirdProjectFundsReceiver.address
            ],
            idoTokens: [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS],
            names: ["First Project", "Second Project", "Third Project"],
            symbols: ["FP", "SP", "TP"]
        }
        await idoFactory.openIdo(idoParametersLocal);
        idoPoolLocal = await ethers.getContractAt(
            hre.names.internal.iDOPool,
            await idoFactory.idoPoolAddressById(1)
        );
        // Fund first project with 40.838181257057511150 HZUSD
        const fundAmount = await snacks.calculatePayTokenAmountOnRedeem(THOUSAND.mul(9).div(10));
        await idoPoolLocal.changeAllowablePercentageForDirectFunding(10000);
        await snacks.approve(idoPoolLocal.address, THOUSAND);
        await idoPoolLocal.fundProjectDirectly(0, THOUSAND);
        // Mint 500
        await idoPoolLocal.grantRole(keccak256("IDO_DISTRIBUTOR_ROLE"), owner.address);
        await idoPoolLocal.mint(FIVE_HUNDRED);
        // Checks
        expect(await idoPoolLocal.numberOfProjectsInProgress()).to.equal(2);
        expect(await idoPoolLocal.shares(0)).to.equal(0);
        expect(await idoPoolLocal.shares(1)).to.equal(ethers.BigNumber.from("2500000000000000000"));
        expect(await idoPoolLocal.shares(2)).to.equal(ethers.BigNumber.from("1666666666666666666"));
        expect(await idoPoolLocal.requiredAmountOfFunds()).to.equal(SIX_HUNDRED.sub(FIVE_HUNDRED).sub(fundAmount));
    });

    it("Successful isFundsReceiver() execution", async() => {
        expect(await idoPool.isFundsReceiver(firstProjectFundsReceiver.address)).to.equal(true);
        expect(await idoPool.isFundsReceiver(owner.address)).to.equal(false);
    });

    it("Successful getFundsReceiversLength() execution", async() => {
        expect(await idoPool.getFundsReceiversLength()).to.equal(3);
    });

    it("Successful getFundsReceiverAt() execution", async() => {
        expect(await idoPool.getFundsReceiverAt(0)).to.equal(firstProjectFundsReceiver.address);
        expect(await idoPool.getFundsReceiverAt(1)).to.equal(secondProjectFundsReceiver.address);
        expect(await idoPool.getFundsReceiverAt(2)).to.equal(thirdProjectFundsReceiver.address);
        await expect(idoPool.getFundsReceiverAt(3)).to.be.reverted;
    });
});