const hre = require("hardhat");
const {expect} = require("chai");
const {ethers, deployments} = hre;
const {time} = require("@nomicfoundation/hardhat-network-helpers");
const { increase } = require("@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time");

const mintExactAmountOfAllSnacks = async(to, amount) => {
    const bigAmount = amount.mul(1000);
    await busd.connect(to).mint(to.address, bigAmount);
    await btc.connect(to).mint(to.address, bigAmount);
    await eth.connect(to).mint(to.address, bigAmount);
    await busd.connect(to).approve(zoinks.address, bigAmount);
    await zoinks.connect(to).mint(bigAmount);
    await zoinks.connect(to).approve(snacks.address, bigAmount);
    await snacks.connect(to).mintWithBuyTokenAmount(amount);
    await btc.connect(to).approve(btcSnacks.address, bigAmount);
    await btcSnacks.connect(to).mintWithBuyTokenAmount(amount);
    await eth.connect(to).approve(ethSnacks.address, bigAmount);
    await ethSnacks.connect(to).mintWithBuyTokenAmount(amount);
}

describe("Snacks pool (integration tests)", () => {
    beforeEach(async () => {
        await deployments.fixture(['snacks_test_fixtures']);
        [owner, authority, alice, bob, john] = await ethers.getSigners();
        snacksPool = await ethers.getContractAt(
            hre.names.internal.snacksPool,
            (await deployments.get(hre.names.internal.snacksPool)).address
        );
        busd = await ethers.getContractAt(
            hre.names.internal.mockToken,
            (await deployments.get(hre.names.external.tokens.busd)).address
        );
        zoinks = await ethers.getContractAt(
            hre.names.internal.zoinks,
            (await deployments.get(hre.names.internal.zoinks)).address
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
        pulse = await ethers.getContractAt(
            hre.names.internal.pulse,
            (await deployments.get(hre.names.internal.pulse)).address
        );
        poolRewardDistributor = await ethers.getContractAt(
            hre.names.internal.poolRewardDistributor,
            (await deployments.get(hre.names.internal.poolRewardDistributor)).address
        );
        seniorage = await ethers.getContractAt(
            hre.names.internal.seniorage,
            (await deployments.get(hre.names.internal.seniorage)).address
        );
    });

    it("Successful increase of holder deposits and withdraw from SnacksPool", async () => {
        // Check that all supplies are 0
        expect(await snacks.totalSupply()).to.equal(0);
        expect(await btcSnacks.totalSupply()).to.equal(0);
        expect(await ethSnacks.totalSupply()).to.equal(0);
        // Buying 100k Snacks/btcSnacks/ethSnacks by owner, alice and bob
        let amount = ethers.utils.parseEther("100000");
        await mintExactAmountOfAllSnacks(owner, amount);
        await mintExactAmountOfAllSnacks(alice, amount);
        await mintExactAmountOfAllSnacks(bob, amount);
        // Check balancess (owner alice and bob have 95k and on each contract 15k)
        const expectedHolderBalance = amount.mul(95).div(100); // 95k
        const expectedContractBalance = amount.mul(5).div(100).mul(3); // 15k
        expect(await snacks.balanceOf(owner.address)).to.equal(expectedHolderBalance);
        expect(await snacks.balanceOf(alice.address)).to.equal(expectedHolderBalance);
        expect(await snacks.balanceOf(bob.address)).to.equal(expectedHolderBalance);
        expect(await snacks.balanceOf(snacks.address)).to.equal(expectedContractBalance);
        expect(await btcSnacks.balanceOf(owner.address)).to.equal(expectedHolderBalance);
        expect(await btcSnacks.balanceOf(alice.address)).to.equal(expectedHolderBalance);
        expect(await btcSnacks.balanceOf(bob.address)).to.equal(expectedHolderBalance);
        expect(await btcSnacks.balanceOf(btcSnacks.address)).to.equal(expectedContractBalance);
        expect(await ethSnacks.balanceOf(owner.address)).to.equal(expectedHolderBalance);
        expect(await ethSnacks.balanceOf(alice.address)).to.equal(expectedHolderBalance);
        expect(await ethSnacks.balanceOf(bob.address)).to.equal(expectedHolderBalance);
        expect(await ethSnacks.balanceOf(ethSnacks.address)).to.equal(expectedContractBalance);
        // Check holder supply
        let snacksHolderSupply = (await snacks.totalSupply()).sub(await snacks.getExcludedBalance());
        let btcSnacksHolderSupply = (await btcSnacks.totalSupply()).sub(await btcSnacks.getExcludedBalance());
        let ethSnacksHolderSupply = (await ethSnacks.totalSupply()).sub(await ethSnacks.getExcludedBalance());
        let expectedHolderSupply = expectedHolderBalance.mul(3);
        expect(snacksHolderSupply).to.equal(expectedHolderSupply);
        expect(btcSnacksHolderSupply).to.equal(expectedHolderSupply);
        expect(ethSnacksHolderSupply).to.equal(expectedHolderSupply);
        // Stake 50k from owner, 10k from alice and 95k from bob
        const ownerAmountToStake = ethers.utils.parseEther("50000");
        const aliceAmountToStake = ethers.utils.parseEther("10000");
        const bobAmountToStake = ethers.utils.parseEther("95000");
        await snacks.approve(snacksPool.address, ownerAmountToStake);
        await snacks.connect(alice).approve(snacksPool.address, aliceAmountToStake);
        await snacks.connect(bob).approve(snacksPool.address, bobAmountToStake);
        await snacksPool.stake(ownerAmountToStake);
        await snacksPool.connect(alice).stake(aliceAmountToStake);
        await snacksPool.connect(bob).stake(bobAmountToStake);
        // Check snacks pool total supply and deposits
        expect(await snacksPool.getTotalSupply()).to.equal(
            ownerAmountToStake.add(aliceAmountToStake).add(bobAmountToStake)
        );
        expect(await snacksPool.getBalance(owner.address)).to.equal(ownerAmountToStake);
        expect(await snacksPool.getBalance(alice.address)).to.equal(aliceAmountToStake);
        expect(await snacksPool.getBalance(bob.address)).to.equal(bobAmountToStake);
        // 24 hours passed
        await time.increase(86400);
        // Owner exits
        await snacksPool.exit();
        expect(await snacks.balanceOf(owner.address)).to.equal(expectedHolderBalance);
        // Fee distribution (distribution amount = 15k on each contract)
        const distributionAmount = ethers.utils.parseEther("15000");
        await btcSnacks.connect(authority).distributeFee();
        await ethSnacks.connect(authority).distributeFee();
        await snacks.connect(authority).distributeFee();
        // Check balances
        expect(await btcSnacks.balanceOf(snacks.address))
            .to.equal(distributionAmount.mul(15).div(100));
        expect(await btcSnacks.balanceOf(pulse.address))
            .to.equal(distributionAmount.mul(15).div(100));
        expect(await btcSnacks.balanceOf(poolRewardDistributor.address))
            .to.equal(distributionAmount.mul(35).div(100));
        expect(await btcSnacks.balanceOf(seniorage.address))
            .to.equal(distributionAmount.mul(15).div(100).add(distributionAmount.mul(20).div(100).mul(10).div(100)));
        expect(await ethSnacks.balanceOf(snacks.address))
            .to.equal(distributionAmount.mul(15).div(100));
        expect(await ethSnacks.balanceOf(pulse.address))
            .to.equal(distributionAmount.mul(15).div(100));
        expect(await ethSnacks.balanceOf(poolRewardDistributor.address))
            .to.equal(distributionAmount.mul(35).div(100));
        expect(await ethSnacks.balanceOf(seniorage.address))
            .to.equal(distributionAmount.mul(15).div(100).add(distributionAmount.mul(20).div(100).mul(10).div(100)));
        expect(await snacks.balanceOf(pulse.address))
            .to.equal(distributionAmount.mul(35).div(100));
        expect(await snacks.balanceOf(poolRewardDistributor.address))
            .to.equal(distributionAmount.mul(45).div(100));
        expect(await snacks.balanceOf(seniorage.address))
            .to.equal(distributionAmount.mul(5).div(100).add(distributionAmount.mul(15).div(100).mul(10).div(100)));
        // Check holders supply
        snacksHolderSupply = (await snacks.totalSupply()).sub(await snacks.getExcludedBalance());
        let realHolderSupply = 
            (await snacks.balanceAndDepositOf(owner.address))
            .add(await snacks.balanceAndDepositOf(alice.address))
            .add(await snacks.balanceAndDepositOf(bob.address))
        expect(snacksHolderSupply).to.be.closeTo(realHolderSupply, 240000);
        btcSnacksHolderSupply = (await btcSnacks.totalSupply()).sub(await btcSnacks.getExcludedBalance());
        realHolderSupply = 
            (await btcSnacks.balanceOf(owner.address))
            .add(await btcSnacks.balanceOf(alice.address))
            .add(await btcSnacks.balanceOf(bob.address))
        expect(btcSnacksHolderSupply).to.be.closeTo(realHolderSupply, 225000);
        ethSnacksHolderSupply = (await ethSnacks.totalSupply()).sub(await ethSnacks.getExcludedBalance());
        realHolderSupply = 
            (await ethSnacks.balanceOf(owner.address))
            .add(await ethSnacks.balanceOf(alice.address))
            .add(await ethSnacks.balanceOf(bob.address))
        expect(ethSnacksHolderSupply).to.be.closeTo(realHolderSupply, 225000);
        // Check bob balance and deposit
        expect(await snacks.balanceAndDepositOf(bob.address))
            .to.equal(await snacksPool.getBalance(bob.address));
        // Check owner balance and deposit
        expect(await snacks.balanceAndDepositOf(owner.address))
            .to.equal(await snacks.balanceOf(owner.address));
        // Check alice balance and deposit
        expect(await snacks.balanceAndDepositOf(alice.address))
            .to.equal((await snacks.balanceOf(alice.address)).add(await snacksPool.getBalance(alice.address)));
        // Balance and deposit amount still must be equal between them all
        expect(await snacks.balanceAndDepositOf(owner.address)).to.equal(await snacks.balanceAndDepositOf(alice.address));
        expect(await snacks.balanceAndDepositOf(owner.address)).to.equal(await snacks.balanceAndDepositOf(bob.address));
        expect(await snacks.balanceAndDepositOf(alice.address)).to.equal(await snacks.balanceAndDepositOf(bob.address));
        // Alice withdraws all her snacks from pool
        const aliceDepositAmount = await snacksPool.getBalance(alice.address);
        const aliceBalanceBefore = await snacks.balanceOf(alice.address);
        await snacksPool.connect(alice).exit();
        // Check alice balance
        expect(await snacksPool.getBalance(alice.address)).to.equal(0);
        expect(await snacks.balanceOf(alice.address))
            .to.equal(aliceBalanceBefore.add(aliceDepositAmount));
        // Balance and deposit amount still must be equal between them all
        expect(await snacks.balanceAndDepositOf(owner.address)).to.equal(await snacks.balanceAndDepositOf(alice.address));
        expect(await snacks.balanceAndDepositOf(owner.address)).to.equal(await snacks.balanceAndDepositOf(bob.address));
        expect(await snacks.balanceAndDepositOf(alice.address)).to.equal(await snacks.balanceAndDepositOf(bob.address));
        // Bob withdraws 5000 snacks from pool
        const bobDepositAmountBefore = await snacksPool.getBalance(bob.address);
        const bobBalanceBefore = await snacks.balanceOf(bob.address);
        amount = ethers.utils.parseEther("5000");
        await snacksPool.connect(bob).withdraw(amount);
        // Check bob balance
        expect(await snacks.balanceOf(bob.address)).to.equal(bobBalanceBefore.add(amount));
        // Deposit from bob 5000 snacks
        await snacks.connect(bob).approve(snacksPool.address, amount);
        await snacksPool.connect(bob).stake(amount);
        expect(await snacksPool.getBalance(bob.address)).to.equal(bobDepositAmountBefore);
        // Distribute rewards on pools
        await poolRewardDistributor.connect(authority).distributeRewards(0);
        // 35% of 15000 = 5250 (pulse balance in snacks) and 10% of 5250 = 525
        const expectedPulseBalance = ethers.utils.parseEther("5250");
        expect(await snacks.balanceOf(pulse.address)).to.equal(expectedPulseBalance);
        const expectedStakeAmountByPulse = ethers.utils.parseEther("525"); 
        const totalSupplyBefore = await snacksPool.getTotalSupply();
        // Distribute snacks
        await pulse.connect(authority).distributeSnacks();
        // Check total supply after distribution
        expect(await snacksPool.getTotalSupply()).to.be.closeTo(totalSupplyBefore.add(expectedStakeAmountByPulse), 1);
    });

    it("Successful reward getting logic", async () => {
        // Buying snacks
        const ownerAmountToMint = ethers.utils.parseEther("10000");
        const aliceAmountToMint = ethers.utils.parseEther("20000");
        const bobAmountToMint = ethers.utils.parseEther("30000");
        await mintExactAmountOfAllSnacks(owner, ownerAmountToMint);
        await mintExactAmountOfAllSnacks(alice, aliceAmountToMint);
        await mintExactAmountOfAllSnacks(bob, bobAmountToMint);
        // Stake 5k from owner, 10k from alice, 20k from bob
        const ownerAmountToStake = ethers.utils.parseEther("5000");
        const aliceAmountToStake = ethers.utils.parseEther("10000");
        const bobAmountToStake = ethers.utils.parseEther("20000");
        await snacks.approve(snacksPool.address, ownerAmountToStake);
        await snacks.connect(alice).approve(snacksPool.address, aliceAmountToStake);
        await snacks.connect(bob).approve(snacksPool.address, bobAmountToStake);
        await snacksPool.stake(ownerAmountToStake);
        await snacksPool.connect(alice).stake(aliceAmountToStake);
        await snacksPool.connect(bob).stake(bobAmountToStake);
        // Check balances
        expect(await snacksPool.getBalance(owner.address)).to.equal(ownerAmountToStake);
        expect(await snacksPool.getBalance(alice.address)).to.equal(aliceAmountToStake);
        expect(await snacksPool.getBalance(bob.address)).to.equal(bobAmountToStake);
        // Get reward
        let ownerBalanceBefore = await snacks.balanceOf(owner.address);
        let aliceBalanceBefore = await snacks.balanceOf(alice.address);
        let bobBalanceBefore = await snacks.balanceOf(bob.address);
        await snacksPool.getReward();
        await snacksPool.connect(alice).getReward();
        await snacksPool.connect(bob).getReward();
        // Check balances
        expect(await snacks.balanceOf(owner.address)).to.equal(ownerBalanceBefore);
        expect(await snacks.balanceOf(alice.address)).to.equal(aliceBalanceBefore);
        expect(await snacks.balanceOf(bob.address)).to.equal(bobBalanceBefore);
        // Distribute rewards (1000 Snacks/btcSnacks/ethSnacks)
        // On SnacksPool contract will come 299.97 snacks, 385.74 btcSnacks, 385.74 ethSnacks
        let reward = ethers.utils.parseEther("1000");
        const snacksExpectedReward = ethers.utils.parseEther("299.97");
        const btcSnacksExpectedReward = ethers.utils.parseEther("385.74");
        const ethSnacksExpectedReward = ethers.utils.parseEther("385.74");
        // Transfer
        await snacks.transfer(poolRewardDistributor.address, reward);
        await btcSnacks.transfer(poolRewardDistributor.address, reward);
        await ethSnacks.transfer(poolRewardDistributor.address, reward);
        await poolRewardDistributor.connect(authority).distributeRewards(0);
        // Check token balances
        const balanceBefore = ownerAmountToStake.add(aliceAmountToStake).add(bobAmountToStake);
        expect(await snacks.balanceOf(snacksPool.address)).to.equal(balanceBefore.add(snacksExpectedReward));
        expect(await btcSnacks.balanceOf(snacksPool.address)).to.equal(btcSnacksExpectedReward);
        expect(await ethSnacks.balanceOf(snacksPool.address)).to.equal(ethSnacksExpectedReward);
        // Check reward rate
        const rewardsDuration = 43200;
        const snacksExpectedRewardRate = snacksExpectedReward.div(rewardsDuration);
        const btcSnacksExpectedRewardRate = btcSnacksExpectedReward.div(rewardsDuration);
        const ethSnacksExpectedRewardRate = ethSnacksExpectedReward.div(rewardsDuration);
        expect(await snacksPool.rewardRates(snacks.address)).to.equal(snacksExpectedRewardRate);
        expect(await snacksPool.rewardRates(btcSnacks.address)).to.equal(btcSnacksExpectedRewardRate);
        expect(await snacksPool.rewardRates(ethSnacks.address)).to.equal(ethSnacksExpectedRewardRate);
        expect(btcSnacksExpectedRewardRate).to.equal(ethSnacksExpectedRewardRate);
        // Increase time
        await time.increase(10000);
        // Rewards getting
        await snacksPool.getReward();
        await snacksPool.connect(alice).getReward();
        await snacksPool.connect(bob).getReward();
        // Increase time
        await time.increase(40000);
        // Fee distribution
        await btcSnacks.connect(authority).distributeFee();
        await ethSnacks.connect(authority).distributeFee();
        await snacks.connect(authority).distributeFee();
        // Increase time
        await time.increase(10000);
        // Rewards getting
        await snacksPool.getReward();
        await snacksPool.connect(alice).getReward(); 
        await snacksPool.connect(bob).getReward();
        // Period elapsed
        await time.increase(43000);
        await snacksPool.getReward();
        await snacksPool.connect(alice).getReward();
        await snacksPool.connect(bob).getReward();
        await time.increase(80000);
        await snacksPool.getReward();
        await snacksPool.connect(alice).getReward();
        await snacksPool.connect(bob).getReward();
        // All rewards distributed
        ownerSnacksBalanceBefore = await snacks.balanceOf(owner.address);
        ownerBtcSnacksBalanceBefore = await btcSnacks.balanceOf(owner.address);
        ownerEthSnacksBalanceBefore = await ethSnacks.balanceOf(owner.address);
        await time.increase(43000);
        await snacksPool.getReward();
        expect(await snacks.balanceOf(owner.address)).to.equal(ownerSnacksBalanceBefore);
        expect(await btcSnacks.balanceOf(owner.address)).to.equal(ownerBtcSnacksBalanceBefore);
        expect(await ethSnacks.balanceOf(owner.address)).to.equal(ownerEthSnacksBalanceBefore);
        let remainingSnacks = (await snacks.balanceOf(snacksPool.address)).sub(await snacksPool.getTotalSupply());
        // Exit (check that remaining amount is correct)
        await snacksPool.exit();
        await snacksPool.connect(alice).exit();
        await snacksPool.connect(bob).exit();
        expect(await snacks.balanceOf(snacksPool.address)).to.equal(remainingSnacks);
        // Stake
        await snacks.approve(snacksPool.address, ownerAmountToStake);
        await snacks.connect(alice).approve(snacksPool.address, aliceAmountToStake);
        await snacks.connect(bob).approve(snacksPool.address, bobAmountToStake);
        await snacksPool.stake(ownerAmountToStake);
        await snacksPool.connect(alice).stake(aliceAmountToStake);
        await snacksPool.connect(bob).stake(bobAmountToStake);
        // Reward transfer
        reward = ethers.utils.parseEther("1000");
        await snacks.transfer(poolRewardDistributor.address, reward);
        await btcSnacks.transfer(poolRewardDistributor.address, reward);
        await ethSnacks.transfer(poolRewardDistributor.address, reward);
        await poolRewardDistributor.connect(authority).distributeRewards(0);
        // Rewards getting
        await time.increase(2000);
        await snacksPool.getReward();
        await snacksPool.connect(alice).getReward();
        await snacksPool.connect(bob).getReward();
        await time.increase(45000);
        await snacksPool.getReward();
        await snacksPool.connect(alice).getReward();
        await snacksPool.connect(bob).getReward();
        remainingSnacks = (await snacks.balanceOf(snacksPool.address)).sub(await snacksPool.getTotalSupply());
        // Exit (check that remaining amount is correct)
        await snacksPool.exit();
        await snacksPool.connect(alice).exit();
        await snacksPool.connect(bob).exit();
        expect(await snacks.balanceOf(snacksPool.address)).to.be.equal(remainingSnacks);
    });

    it("Successful reflection in SnacksPool", async () => {
        // Mint 10 SNACK
        let amount = ethers.utils.parseEther("10");
        await mintExactAmountOfAllSnacks(owner, amount);
        // Transfer 0.5 SNACK to alice
        await snacks.transfer(alice.address, ethers.utils.parseEther("0.5"));
        // Stake 0.5 SNACK from alice
        await snacks.connect(alice).approve(snacksPool.address, ethers.utils.parseEther("0.5"));
        await snacksPool.connect(alice).stake(ethers.utils.parseEther("0.5"));
        // Transfer 3 SNACK to bob
        await snacks.transfer(bob.address, ethers.utils.parseEther("3"));
        // Stake 3 SNACK from bob
        await snacks.connect(bob).approve(snacksPool.address, ethers.utils.parseEther("3"));
        await snacksPool.connect(bob).stake(ethers.utils.parseEther("3"));
        // Backend run
        await snacks.connect(authority).distributeFee();
        await btcSnacks.connect(authority).distributeFee();
        await ethSnacks.connect(authority).distributeFee();
        await poolRewardDistributor.connect(authority).distributeRewards(0);
        // Get reward from alice
        await snacksPool.connect(alice).getReward();
        // +12h
        await time.increase(43200);
        // Get reward from alice and bob
        await snacksPool.connect(alice).getReward();
        await snacksPool.connect(bob).getReward();
        // Mint tokens
        amount = ethers.utils.parseEther("10000");
        await mintExactAmountOfAllSnacks(owner, amount);
        // Backend run
        await snacks.connect(authority).distributeFee();
        await btcSnacks.connect(authority).distributeFee();
        await ethSnacks.connect(authority).distributeFee();
        await poolRewardDistributor.connect(authority).distributeRewards(0);
        // +6h
        await time.increase(21600);
        // Get reward from alice
        await snacksPool.connect(alice).getReward();
        // +6h 
        await time.increase(21600);
        // Mint tokens
        amount = ethers.utils.parseEther("0.000001");
        await mintExactAmountOfAllSnacks(owner, amount);
        // Backend run
        await snacks.connect(authority).distributeFee();
        await btcSnacks.connect(authority).distributeFee();
        await ethSnacks.connect(authority).distributeFee();
        await poolRewardDistributor.connect(authority).distributeRewards(0);
        // +6h
        await time.increase(21600);
        // Get reward from alice and bob
        await snacksPool.connect(alice).getReward();
        await snacksPool.connect(bob).getReward();
        // +24h
        await time.increase(86400);
        // Get reward from alice and bob
        await snacksPool.connect(alice).getReward();
        await snacksPool.connect(bob).getReward();
    });
});
