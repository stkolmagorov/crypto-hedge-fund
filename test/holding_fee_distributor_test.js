const hre = require("hardhat");
const { ethers, deployments } = hre;
const { expect } = require("chai");
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { withImpersonatedSigner, mintNativeTokens, mintZoinksAndAllSnacks } = require("../deploy/helpers");
const etherToMintForImpersonatedSigners = '0x10000000000000000000000';

describe("HoldingFeeDistributor", () => {
    beforeEach(async () => {
        await deployments.fixture(['debug']);
        [deployer, authority, alice, bob] = await ethers.getSigners();
        zoinks = await ethers.getContractAt(
        hre.names.internal.zoinks,
        (await deployments.get(hre.names.internal.zoinks)).address
        );
        busd = await ethers.getContractAt(
        hre.names.internal.mockToken,
        (await deployments.get(hre.names.external.tokens.busd)).address
        );
        eth = await ethers.getContractAt(
        hre.names.internal.mockToken,
        (await deployments.get(hre.names.external.tokens.eth)).address
        );
        btc = await ethers.getContractAt(
        hre.names.internal.mockToken,
        (await deployments.get(hre.names.external.tokens.btc)).address
        );
        snacks = await ethers.getContractAt(
        hre.names.internal.snacks,
        (await deployments.get(hre.names.internal.snacks)).address
        );
        ethSnacks = await ethers.getContractAt(
        hre.names.internal.ethSnacks,
        (await deployments.get(hre.names.internal.ethSnacks)).address
        );
        btcSnacks = await ethers.getContractAt(
        hre.names.internal.btcSnacks,
        (await deployments.get(hre.names.internal.btcSnacks)).address
        );
        holdingFeeDistributor = await ethers.getContractAt(
        hre.names.internal.holdingFeeDistributor,
        (await deployments.get(hre.names.internal.holdingFeeDistributor)).address
        );
    });

    it("Successful onlyBtcSnacks check", async() => {
        await expect(holdingFeeDistributor.notifyBtcSnacksFeeAmount(0))
            .to.be.reverted;
    });

    it("Successful onlyEthSnacks check", async() => {
        await expect(holdingFeeDistributor.notifyEthSnacksFeeAmount(0))
            .to.be.reverted;
    });

    it("Successful onlyAuthority check", async() => {
        const padded = ethers.utils.hexZeroPad("0x", 32);
        await expect(holdingFeeDistributor.setMerkleRoot(padded)).to.be.reverted;
    });

    it("Successful notifyBtcSnacksFeeAmount() execution", async() => {
        await withImpersonatedSigner(btcSnacks.address, async (btcSnacksSigner) => {
            await mintNativeTokens(btcSnacksSigner, etherToMintForImpersonatedSigners);
            await expect(holdingFeeDistributor.connect(btcSnacksSigner).notifyBtcSnacksFeeAmount(100))
                .to.emit(holdingFeeDistributor, 'BtcSnacksFeeAdded')
                .withArgs(100);
            expect(await holdingFeeDistributor.cumulativeBtcSnacksFeeAmount()).to.equal(100);
        });
    });

    it("Successful notifyBtcSnacksFeeAmount execution", async() => {
        await withImpersonatedSigner(ethSnacks.address, async (ethSnacksSigner) => {
            await mintNativeTokens(ethSnacksSigner, etherToMintForImpersonatedSigners);
            await expect(holdingFeeDistributor.connect(ethSnacksSigner).notifyEthSnacksFeeAmount(100))
                .to.emit(holdingFeeDistributor, 'EthSnacksFeeAdded')
                .withArgs(100);
            expect(await holdingFeeDistributor.cumulativeEthSnacksFeeAmount()).to.equal(100);
        });
    });

    it("Successful setMerkleRoot() execution", async() => {
        const padded = ethers.utils.hexZeroPad("0x", 32);
        await expect(holdingFeeDistributor.connect(authority).setMerkleRoot(padded))
            .to.emit(holdingFeeDistributor, 'MerkleRootUpdated')
            .withArgs(padded, padded);
    });

    it("Successful claim() execution (both tokens was notified)", async() => {
        // Previous cumulative values
        const cumulativeBtcSnacksFeeAmountPrevious = await holdingFeeDistributor.cumulativeBtcSnacksFeeAmount();
        const cumulativeEthSnacksFeeAmountPrevious = await holdingFeeDistributor.cumulativeEthSnacksFeeAmount();
        // 100000 wei BSNACK has come on the contract
        await withImpersonatedSigner(btcSnacks.address, async (btcSnacksSigner) => {
            await mintNativeTokens(btcSnacksSigner, etherToMintForImpersonatedSigners);
            await holdingFeeDistributor.connect(btcSnacksSigner).notifyBtcSnacksFeeAmount(10000);
        });
        // 50000 wei ETSNACK has come on the contract
        await withImpersonatedSigner(ethSnacks.address, async (ethSnacksSigner) => {
            await mintNativeTokens(ethSnacksSigner, etherToMintForImpersonatedSigners);
            await holdingFeeDistributor.connect(ethSnacksSigner).notifyEthSnacksFeeAmount(50000);
        });
        // After distribute fee cumulative values
        const cumulativeBtcSnacksFeeAmountAfter = await holdingFeeDistributor.cumulativeBtcSnacksFeeAmount();
        const cumulativeEthSnacksFeeAmountAfter = await holdingFeeDistributor.cumulativeEthSnacksFeeAmount();
        // Difference
        const btcSnacksDifference = cumulativeBtcSnacksFeeAmountAfter.sub(cumulativeBtcSnacksFeeAmountPrevious);
        const ethSnacksDifference = cumulativeEthSnacksFeeAmountAfter.sub(cumulativeEthSnacksFeeAmountPrevious);
        // Mint 100K SNACK from Alice and 50K SNACK from Bob
        await mintZoinksAndAllSnacks(deployments, deployer, ethers.utils.parseEther("100"), alice);
        await mintZoinksAndAllSnacks(deployments, deployer, ethers.utils.parseEther("50"), bob);
        // Holder supply calculation
        const holderSupply = (await snacks.totalSupply()).sub(await snacks.getExcludedBalance());
        // Share calculations for Alice
        const aliceBalanceAndDeposit = await snacks.balanceAndDepositOf(alice.address);
        const btcSnacksAliceShare = aliceBalanceAndDeposit.mul(btcSnacksDifference).div(holderSupply);
        const ethSnacksAliceShare = aliceBalanceAndDeposit.mul(ethSnacksDifference).div(holderSupply);
        // Share calculations for Bob
        const bobBalanceAndDeposit = await snacks.balanceAndDepositOf(bob.address);
        const btcSnacksBobShare = bobBalanceAndDeposit.mul(btcSnacksDifference).div(holderSupply);
        const ethSnacksBobShare = bobBalanceAndDeposit.mul(ethSnacksDifference).div(holderSupply);
        // Merkle tree generation
        const wallets = [alice.address, bob.address];
        const btcSnacksAmounts = [btcSnacksAliceShare, btcSnacksBobShare];
        const ethSnacksAmounts = [ethSnacksAliceShare, ethSnacksBobShare];
        const elements = wallets.map(
            (w, i) => w
                + ethers.utils.hexZeroPad(btcSnacksAmounts[i], 32).substring(2)
                + ethers.utils.hexZeroPad(ethSnacksAmounts[i], 32).substring(2)
        );
        const hashedElements = elements.map(keccak256).map(x => MerkleTree.bufferToHex(x));
        const tree = new MerkleTree(elements, keccak256, { hashLeaves: true, sort: true });
        const root = tree.getHexRoot();
        await holdingFeeDistributor.connect(authority).setMerkleRoot(root);
        await btcSnacks.transfer(holdingFeeDistributor.address, 10000);
        await ethSnacks.transfer(holdingFeeDistributor.address, 50000);
        const leaves = tree.getHexLeaves();
        const proofs = leaves.map(tree.getHexProof, tree);
        const btcSnacksAliceBalanceBefore = await btcSnacks.balanceOf(alice.address);
        const ethSnacksAliceBalanceBefore = await ethSnacks.balanceOf(alice.address);
        await holdingFeeDistributor.connect(alice).claim(
            alice.address, // index = 0
            btcSnacksAliceShare, 
            ethSnacksAliceShare, 
            root, 
            proofs[leaves.indexOf(hashedElements[0])]
        );
        expect((await btcSnacks.balanceOf(alice.address)).sub(btcSnacksAliceBalanceBefore)).to.equal(btcSnacksAliceShare);
        expect((await ethSnacks.balanceOf(alice.address)).sub(ethSnacksAliceBalanceBefore)).to.equal(ethSnacksAliceShare);
        await expect(holdingFeeDistributor.connect(alice).claim(
            alice.address, // index = 0
            btcSnacksAliceShare, 
            ethSnacksAliceShare, 
            root, 
            proofs[leaves.indexOf(hashedElements[0])]
        )).to.be.revertedWith("HoldingFeeDistributor: nothing to claim");
        await expect(holdingFeeDistributor.connect(alice).claim(
            deployer.address, // index = 0
            btcSnacksAliceShare, 
            ethSnacksAliceShare, 
            root, 
            proofs[leaves.indexOf(hashedElements[0])]
        )).to.be.revertedWith("HoldingFeeDistributor: invalid proof");
        await holdingFeeDistributor.connect(authority).setMerkleRoot(ethers.utils.hexZeroPad("0x", 32));
        await expect(holdingFeeDistributor.connect(alice).claim(
            alice.address, // index = 0
            btcSnacksAliceShare, 
            ethSnacksAliceShare, 
            root, 
            proofs[leaves.indexOf(hashedElements[0])]
        )).to.be.revertedWith("HoldingFeeDistributor: merkle root was updated");
    });

    it("Successful claim() execution (BSNACK was notified)", async() => {
        // Previous cumulative values
        const cumulativeBtcSnacksFeeAmountPrevious = await holdingFeeDistributor.cumulativeBtcSnacksFeeAmount();
        const cumulativeEthSnacksFeeAmountPrevious = await holdingFeeDistributor.cumulativeEthSnacksFeeAmount();
        // 100000 wei BSNACK has come on the contract
        await withImpersonatedSigner(btcSnacks.address, async (btcSnacksSigner) => {
            await mintNativeTokens(btcSnacksSigner, etherToMintForImpersonatedSigners);
            await holdingFeeDistributor.connect(btcSnacksSigner).notifyBtcSnacksFeeAmount(10000);
        });
        // 50000 wei ETSNACK has come on the contract
        await withImpersonatedSigner(ethSnacks.address, async (ethSnacksSigner) => {
            await mintNativeTokens(ethSnacksSigner, etherToMintForImpersonatedSigners);
            await holdingFeeDistributor.connect(ethSnacksSigner).notifyEthSnacksFeeAmount(0);
        });
        // After distribute fee cumulative values
        const cumulativeBtcSnacksFeeAmountAfter = await holdingFeeDistributor.cumulativeBtcSnacksFeeAmount();
        const cumulativeEthSnacksFeeAmountAfter = await holdingFeeDistributor.cumulativeEthSnacksFeeAmount();
        // Difference
        const btcSnacksDifference = cumulativeBtcSnacksFeeAmountAfter.sub(cumulativeBtcSnacksFeeAmountPrevious);
        const ethSnacksDifference = cumulativeEthSnacksFeeAmountAfter.sub(cumulativeEthSnacksFeeAmountPrevious);
        // Mint 100K SNACK from Alice and 50K SNACK from Bob
        await mintZoinksAndAllSnacks(deployments, deployer, ethers.utils.parseEther("100"), alice);
        await mintZoinksAndAllSnacks(deployments, deployer, ethers.utils.parseEther("50"), bob);
        // Holder supply calculation
        const holderSupply = (await snacks.totalSupply()).sub(await snacks.getExcludedBalance());
        // Share calculations for Alice
        const aliceBalanceAndDeposit = await snacks.balanceAndDepositOf(alice.address);
        const btcSnacksAliceShare = aliceBalanceAndDeposit.mul(btcSnacksDifference).div(holderSupply);
        const ethSnacksAliceShare = aliceBalanceAndDeposit.mul(ethSnacksDifference).div(holderSupply);
        // Share calculations for Bob
        const bobBalanceAndDeposit = await snacks.balanceAndDepositOf(bob.address);
        const btcSnacksBobShare = bobBalanceAndDeposit.mul(btcSnacksDifference).div(holderSupply);
        const ethSnacksBobShare = bobBalanceAndDeposit.mul(ethSnacksDifference).div(holderSupply);
        // Merkle tree generation
        const wallets = [alice.address, bob.address];
        const btcSnacksAmounts = [btcSnacksAliceShare, btcSnacksBobShare];
        const ethSnacksAmounts = [ethSnacksAliceShare, ethSnacksBobShare];
        const elements = wallets.map(
            (w, i) => w
                + ethers.utils.hexZeroPad(btcSnacksAmounts[i], 32).substring(2)
                + ethers.utils.hexZeroPad(ethSnacksAmounts[i], 32).substring(2)
        );
        const hashedElements = elements.map(keccak256).map(x => MerkleTree.bufferToHex(x));
        const tree = new MerkleTree(elements, keccak256, { hashLeaves: true, sort: true });
        const root = tree.getHexRoot();
        await holdingFeeDistributor.connect(authority).setMerkleRoot(root);
        await btcSnacks.transfer(holdingFeeDistributor.address, 10000);
        const leaves = tree.getHexLeaves();
        const proofs = leaves.map(tree.getHexProof, tree);
        await holdingFeeDistributor.connect(alice).claim(
            alice.address, // index = 0
            btcSnacksAliceShare, 
            ethSnacksAliceShare, 
            root, 
            proofs[leaves.indexOf(hashedElements[0])]
        );
    });

    it("Successful claim() execution (ETSNACK was notified)", async() => {
        // Previous cumulative values
        const cumulativeBtcSnacksFeeAmountPrevious = await holdingFeeDistributor.cumulativeBtcSnacksFeeAmount();
        const cumulativeEthSnacksFeeAmountPrevious = await holdingFeeDistributor.cumulativeEthSnacksFeeAmount();
        // 100000 wei BSNACK has come on the contract
        await withImpersonatedSigner(btcSnacks.address, async (btcSnacksSigner) => {
            await mintNativeTokens(btcSnacksSigner, etherToMintForImpersonatedSigners);
            await holdingFeeDistributor.connect(btcSnacksSigner).notifyBtcSnacksFeeAmount(0);
        });
        // 50000 wei ETSNACK has come on the contract
        await withImpersonatedSigner(ethSnacks.address, async (ethSnacksSigner) => {
            await mintNativeTokens(ethSnacksSigner, etherToMintForImpersonatedSigners);
            await holdingFeeDistributor.connect(ethSnacksSigner).notifyEthSnacksFeeAmount(50000);
        });
        // After distribute fee cumulative values
        const cumulativeBtcSnacksFeeAmountAfter = await holdingFeeDistributor.cumulativeBtcSnacksFeeAmount();
        const cumulativeEthSnacksFeeAmountAfter = await holdingFeeDistributor.cumulativeEthSnacksFeeAmount();
        // Difference
        const btcSnacksDifference = cumulativeBtcSnacksFeeAmountAfter.sub(cumulativeBtcSnacksFeeAmountPrevious);
        const ethSnacksDifference = cumulativeEthSnacksFeeAmountAfter.sub(cumulativeEthSnacksFeeAmountPrevious);
        // Mint 100K SNACK from Alice and 50K SNACK from Bob
        await mintZoinksAndAllSnacks(deployments, deployer, ethers.utils.parseEther("100"), alice);
        await mintZoinksAndAllSnacks(deployments, deployer, ethers.utils.parseEther("50"), bob);
        // Holder supply calculation
        const holderSupply = (await snacks.totalSupply()).sub(await snacks.getExcludedBalance());
        // Share calculations for Alice
        const aliceBalanceAndDeposit = await snacks.balanceAndDepositOf(alice.address);
        const btcSnacksAliceShare = aliceBalanceAndDeposit.mul(btcSnacksDifference).div(holderSupply);
        const ethSnacksAliceShare = aliceBalanceAndDeposit.mul(ethSnacksDifference).div(holderSupply);
        // Share calculations for Bob
        const bobBalanceAndDeposit = await snacks.balanceAndDepositOf(bob.address);
        const btcSnacksBobShare = bobBalanceAndDeposit.mul(btcSnacksDifference).div(holderSupply);
        const ethSnacksBobShare = bobBalanceAndDeposit.mul(ethSnacksDifference).div(holderSupply);
        // Merkle tree generation
        const wallets = [alice.address, bob.address];
        const btcSnacksAmounts = [btcSnacksAliceShare, btcSnacksBobShare];
        const ethSnacksAmounts = [ethSnacksAliceShare, ethSnacksBobShare];
        const elements = wallets.map(
            (w, i) => w
                + ethers.utils.hexZeroPad(btcSnacksAmounts[i], 32).substring(2)
                + ethers.utils.hexZeroPad(ethSnacksAmounts[i], 32).substring(2)
        );
        const hashedElements = elements.map(keccak256).map(x => MerkleTree.bufferToHex(x));
        const tree = new MerkleTree(elements, keccak256, { hashLeaves: true, sort: true });
        const root = tree.getHexRoot();
        await holdingFeeDistributor.connect(authority).setMerkleRoot(root);
        await ethSnacks.transfer(holdingFeeDistributor.address, 50000);
        const leaves = tree.getHexLeaves();
        const proofs = leaves.map(tree.getHexProof, tree);
        await holdingFeeDistributor.connect(alice).claim(
            alice.address, // index = 0
            btcSnacksAliceShare, 
            ethSnacksAliceShare, 
            root, 
            proofs[leaves.indexOf(hashedElements[0])]
        );
    });

    it("Successful pause() execution", async() => {
        await holdingFeeDistributor.pause();
        expect(await holdingFeeDistributor.paused()).to.equal(true);
        await expect(holdingFeeDistributor.connect(alice).pause()).to.be.reverted;
    });

    it("Successful unpause() execution", async() => {
        await holdingFeeDistributor.pause();
        expect(await holdingFeeDistributor.paused()).to.equal(true);
        await holdingFeeDistributor.unpause();
        expect(await holdingFeeDistributor.paused()).to.equal(false);
        await expect(holdingFeeDistributor.connect(alice).unpause()).to.be.reverted;
    });
});