const {time} = require("@nomicfoundation/hardhat-network-helpers");
const {expect} = require("chai");
const hre = require("hardhat");
const {
  mockedResultOfSwap, 
  withImpersonatedSigner, 
  mintNativeTokens, 
  ZERO,
  mintZoinksAndAllSnacks,
  mockSwaps
} = require('../deploy/helpers');
const {ethers, deployments, getNamedAccounts} = hre;
const abiCoder = ethers.utils.defaultAbiCoder;

describe("LunchBox", () => {

    let recipient;
    let owner;
    let authority;

    let lunchBox;
    let busd;
    let zoinks;
    let btc;
    let eth;
    let snacks;
    let btcSnacks;
    let ethSnacks;
    let router;
    let snacksPool;
    let poolRewardDistributor;

    let amountToStake;
  
    beforeEach(async () => {
        await deployments.fixture(['lunch_box_test_fixtures']);
        const accounts = await getNamedAccounts();
        recipient = accounts.recipient;
        [owner, authority] = await ethers.getSigners();
        
        lunchBox = await ethers.getContractAt(
            hre.names.internal.lunchBox, 
            (await deployments.get(hre.names.internal.lunchBox)).address
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
        router = await ethers.getContractAt(
            hre.names.internal.iRouter,
            (await deployments.get(hre.names.external.routers.pancake)).address
        );
        seniorage = await ethers.getContractAt(
            hre.names.internal.seniorage,
            (await deployments.get(hre.names.internal.seniorage)).address
        );
        snacksPool = await ethers.getContractAt(
            hre.names.internal.snacksPool,
            (await deployments.get(hre.names.internal.snacksPool)).address
        );
        poolRewardDistributor = await ethers.getContractAt(
            hre.names.internal.poolRewardDistributor,
            (await deployments.get(hre.names.internal.poolRewardDistributor)).address
        );
        investmentSystemDistributor = await ethers.getContractAt(
            hre.names.internal.investmentSystemDistributor,
            (await deployments.get(hre.names.internal.investmentSystemDistributor)).address
        );
        amountToStake = ethers.utils.parseEther("950");

        await mintZoinksAndAllSnacks(deployments, owner, amountToStake);
        await mintZoinksAndAllSnacks(deployments, owner, amountToStake, authority);
        
        const hexAmountOfNativeTokens = '0x10000000000000000000';
        await mintNativeTokens(seniorage.address, hexAmountOfNativeTokens);
        await mintNativeTokens(snacksPool.address, hexAmountOfNativeTokens);
        await mintNativeTokens(poolRewardDistributor.address, hexAmountOfNativeTokens);
        await mintNativeTokens(lunchBox.address, hexAmountOfNativeTokens);
        await mintNativeTokens(investmentSystemDistributor.address, hexAmountOfNativeTokens);
    });

    it("Successful configure()", async() => {
        await expect(lunchBox.connect(authority).configure(
            zoinks.address,
            snacks.address,
            btcSnacks.address,
            ethSnacks.address,
            snacksPool.address,
            poolRewardDistributor.address,
            seniorage.address,
            investmentSystemDistributor.address
        )).to.be.reverted;
        await lunchBox.configure(
            zoinks.address,
            snacks.address,
            btcSnacks.address,
            ethSnacks.address,
            snacksPool.address,
            poolRewardDistributor.address,
            seniorage.address,
            investmentSystemDistributor.address
        );
    });

    it("Successful stakeForSeniorage() execution by Seniorage (BUSD)", async() => {
      await withImpersonatedSigner(seniorage.address, async (seniorageSigner) => {
        // Attempt to stake from owner
        await expect(lunchBox["stakeForSeniorage(uint256)"](amountToStake))
          .to.be.reverted;
        // Stake from Seniorage
        await busd.transfer(seniorage.address, amountToStake);
        await lunchBox.connect(seniorageSigner)["stakeForSeniorage(uint256)"](amountToStake);
        // Check recipient balance
        expect(await busd.balanceOf(recipient)).to.equal(amountToStake);
        // Zero stake from Seniorage
        await expect(lunchBox.connect(seniorageSigner)["stakeForSeniorage(uint256)"](0))
          .to.emit(lunchBox, 'Staked').withArgs(seniorageSigner.address, 0);
      });
    });

    it("Successful stakeForSeniorage() execution by Seniorage (non BUSD currencies)", async() => {
      await withImpersonatedSigner(seniorage.address, async (seniorageSigner) => {
        // Attempt to stake from owner
        await expect(lunchBox["stakeForSeniorage(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"]
          (
            amountToStake, 
            amountToStake, 
            amountToStake, 
            amountToStake, 
            amountToStake, 
            amountToStake,
            0,
            0,
            0
          )).to.be.reverted;
        // Stake from Seniorage
        await zoinks.transfer(seniorage.address, amountToStake);
        await btc.transfer(seniorage.address, amountToStake);
        await eth.transfer(seniorage.address, amountToStake);
        await snacks.transfer(seniorage.address, amountToStake);
        await btcSnacks.transfer(seniorage.address, amountToStake);
        await ethSnacks.transfer(seniorage.address, amountToStake);
        await busd.mint(lunchBox.address, ethers.utils.parseEther("6"));
        await lunchBox.connect(seniorageSigner)
          ["stakeForSeniorage(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"]
          (
            amountToStake, 
            amountToStake, 
            amountToStake, 
            amountToStake, 
            amountToStake, 
            amountToStake,
            0,
            0,
            0
          );
        // Check recipient balance
        expect(await busd.balanceOf(recipient)).to.equal(ethers.utils.parseEther("6"));
        await withImpersonatedSigner(lunchBox.address, async (lunchBoxSigner) => {
          // Transfer all tokens from LunchBox
          const zoinksBalance = await zoinks.balanceOf(lunchBox.address);
          const btcBalance = await btc.balanceOf(lunchBox.address);
          const ethBalance = await eth.balanceOf(lunchBox.address);
          const snacksBalance = await snacks.balanceOf(lunchBox.address);
          const btcSnacksBalance = await btcSnacks.balanceOf(lunchBox.address);
          const ethSnacksBalance = await ethSnacks.balanceOf(lunchBox.address);
          await zoinks.connect(lunchBoxSigner).transfer(seniorage.address, zoinksBalance);
          await btc.connect(lunchBoxSigner).transfer(seniorage.address, btcBalance);
          await eth.connect(lunchBoxSigner).transfer(seniorage.address, ethBalance);
          await snacks.connect(lunchBoxSigner).transfer(seniorage.address, snacksBalance);
          await btcSnacks.connect(lunchBoxSigner).transfer(seniorage.address, btcSnacksBalance);
          await ethSnacks.connect(lunchBoxSigner).transfer(seniorage.address, ethSnacksBalance);
          // Zero stake from Seniorage
          await expect(lunchBox.connect(seniorageSigner)
            ["stakeForSeniorage(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"]
            (0, 0, 0, 0, 0, 0, 0, 0, 0))
              .to.emit(lunchBox, 'Staked')
              .withArgs(seniorageSigner.address, 0);
        });
      });
    });

    it("Successful stakeForSeniorage() execution by Seniorage (non BUSD currencies and insufficient amount on redeem)", async() => {
      await withImpersonatedSigner(seniorage.address, async (seniorageSigner) => {
        const insufficientAmount = 10;
        const sufficientAmount = amountToStake.div(2);
        // Stake from Seniorage
        await zoinks.transfer(seniorage.address, sufficientAmount);
        await btc.transfer(seniorage.address, sufficientAmount);
        await eth.transfer(seniorage.address, sufficientAmount);
        await snacks.transfer(seniorage.address, insufficientAmount);
        await btcSnacks.transfer(seniorage.address, insufficientAmount);
        await ethSnacks.transfer(seniorage.address, insufficientAmount);
        await busd.mint(lunchBox.address, ethers.utils.parseEther("6"));
        await lunchBox.connect(seniorageSigner)
          ["stakeForSeniorage(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"]
          (
            sufficientAmount, 
            sufficientAmount, 
            sufficientAmount, 
            insufficientAmount, 
            insufficientAmount, 
            insufficientAmount,
            0,
            0,
            0
          );
        // Stored amounts check
        expect(await lunchBox.snacksAmountStoredFor(seniorage.address)).to.equal(insufficientAmount);
        expect(await lunchBox.btcSnacksAmountStoredFor(seniorage.address)).to.equal(insufficientAmount);
        expect(await lunchBox.ethSnacksAmountStoredFor(seniorage.address)).to.equal(insufficientAmount);
        // Another stake from Seniorage
        await zoinks.transfer(seniorage.address, sufficientAmount);
        await btc.transfer(seniorage.address, sufficientAmount);
        await eth.transfer(seniorage.address, sufficientAmount);
        await snacks.transfer(seniorage.address, sufficientAmount);
        await btcSnacks.transfer(seniorage.address, sufficientAmount);
        await ethSnacks.transfer(seniorage.address, sufficientAmount);
        await busd.mint(lunchBox.address, ethers.utils.parseEther("6"));
        await lunchBox.connect(seniorageSigner)
          ["stakeForSeniorage(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"]
          (
            sufficientAmount, 
            sufficientAmount, 
            sufficientAmount, 
            sufficientAmount, 
            sufficientAmount, 
            sufficientAmount,
            0,
            0,
            0
          );
        // Stored amounts check
        expect(await lunchBox.snacksAmountStoredFor(seniorage.address)).to.equal(0);
        expect(await lunchBox.btcSnacksAmountStoredFor(seniorage.address)).to.equal(0);
        expect(await lunchBox.ethSnacksAmountStoredFor(seniorage.address)).to.equal(0);
      });
    });

    it("Successful stakeForSnacksPool() execution by SnacksPool", async() => {
      await expect(lunchBox.stakeForSnacksPool(amountToStake, amountToStake, amountToStake, 0, 0, 0))
        .to.be.reverted;
      
      await withImpersonatedSigner(snacksPool.address, async (snacksPoolSigner) => {
        // Stake from SnacksPool
        const totalRewardAmount = amountToStake.div(2); // 950 / 2 = 475
        const amountSnacksToStake = amountToStake.div(10); // 950 / 10 = 95
        await snacks.transfer(snacksPool.address, totalRewardAmount);
        await snacks.transfer(lunchBox.address, totalRewardAmount);
        await btcSnacks.transfer(snacksPool.address, totalRewardAmount);
        await ethSnacks.transfer(snacksPool.address, totalRewardAmount);
        
        await busd.mint(lunchBox.address, totalRewardAmount);
        
        await withImpersonatedSigner(poolRewardDistributor.address, async (poolRewardDistributorSigner) => {
          await snacksPool.connect(poolRewardDistributorSigner).notifyRewardAmount(snacks.address, totalRewardAmount);
          await snacksPool.connect(poolRewardDistributorSigner).notifyRewardAmount(ethSnacks.address, totalRewardAmount);
          await snacksPool.connect(poolRewardDistributorSigner).notifyRewardAmount(btcSnacks.address, totalRewardAmount);
          await lunchBox.connect(poolRewardDistributorSigner).notifyRewardAmount(totalRewardAmount);
        });

        await snacks.approve(snacksPool.address, amountSnacksToStake);
        await snacksPool.stake(amountSnacksToStake);
        const data = abiCoder.encode(
          ["uint", "tuple(uint[], uint[])"],
          [10000, [[], []]]
        );
        await snacksPool.activateInvestmentSystem(data);

        await snacks.connect(authority).approve(snacksPool.address, amountSnacksToStake);
        await snacksPool.connect(authority).stake(amountSnacksToStake);
        await snacksPool.connect(authority).activateInvestmentSystem(data);

        await time.increase(3600 * 12 * 2);
        
        let expectedTotalRewardAmountForParticipantsInSnacks = ZERO;
        let expectedTotalRewardAmountForParticipantsInBtcSnacks = ZERO;
        let expectedTotalRewardAmountForParticipantsInEthSnacks = ZERO;
        let participants = [owner.address, authority.address];

        for (const participant of participants) {
          expectedTotalRewardAmountForParticipantsInSnacks =
            expectedTotalRewardAmountForParticipantsInSnacks
              .add(await snacksPool.earned(participant, snacks.address));
          expectedTotalRewardAmountForParticipantsInBtcSnacks =
            expectedTotalRewardAmountForParticipantsInBtcSnacks
              .add(await snacksPool.earned(participant, btcSnacks.address));
          
          expectedTotalRewardAmountForParticipantsInEthSnacks =
            expectedTotalRewardAmountForParticipantsInEthSnacks
              .add(await snacksPool.earned(participant, ethSnacks.address));
        }
        await expect(
          investmentSystemDistributor.connect(authority).deliverRewardsToLunchBox(
            expectedTotalRewardAmountForParticipantsInSnacks,
            expectedTotalRewardAmountForParticipantsInBtcSnacks,
            expectedTotalRewardAmountForParticipantsInEthSnacks,
            0,
            0,
            0
          )
        ).to.emit(investmentSystemDistributor, 'RewardsDeliveredToLunchBox').withArgs(
          expectedTotalRewardAmountForParticipantsInSnacks,
          expectedTotalRewardAmountForParticipantsInBtcSnacks,
          expectedTotalRewardAmountForParticipantsInEthSnacks,
        );

        await time.increase(3600 * 12 * 2);

        const expectedEarnedOfOwner = await snacksPool.getBalance(owner.address);
        const userRewardPerTokenPaidOfOwner = await lunchBox.userRewardPerTokenPaid(owner.address);

        const expectedEarnedOfAuthority = await snacksPool.getBalance(authority.address);
        const userRewardPerTokenPaidOfAuthority = await lunchBox.userRewardPerTokenPaid(authority.address);

        const rewardPerToken = await lunchBox.rewardPerToken();
        const precision = hre.ethers.utils.parseEther('1');
        const ownerStoredReward = await lunchBox.rewards(owner.address);
        const authorityStoredReward = await lunchBox.rewards(authority.address);

        expect(await lunchBox.earned(owner.address)).to.be.equal(
          expectedEarnedOfOwner
            .mul(rewardPerToken.sub(userRewardPerTokenPaidOfOwner))
            .div(precision)
            .add(ownerStoredReward)
        );
        
        expect(await lunchBox.earned(authority.address)).to.be.equal(
          expectedEarnedOfAuthority
            .mul(rewardPerToken.sub(userRewardPerTokenPaidOfAuthority))
            .div(precision)
            .add(authorityStoredReward)
        );
      });
    });

    it("Successful stakeForSnacksPool() execution by SnacksPool (insufficient amount on redeem)", async() => {
        const insufficientAmount = 10;
        const sufficientAmount = amountToStake.div(2);
        // Stake from SnacksPool
        await snacks.transfer(snacksPool.address, insufficientAmount);
        await btcSnacks.transfer(snacksPool.address, insufficientAmount);
        await ethSnacks.transfer(snacksPool.address, insufficientAmount);
        await busd.mint(lunchBox.address, hre.ethers.utils.parseEther("6"));

        await withImpersonatedSigner(investmentSystemDistributor.address, async (investmentSystemDistributorSigner) => {
          await lunchBox.connect(investmentSystemDistributorSigner)
            .stakeForSnacksPool(insufficientAmount, insufficientAmount, insufficientAmount, 0, 0, 0);
        });
        // Stored amounts check
        expect(await lunchBox.snacksAmountStoredFor(snacksPool.address)).to.equal(insufficientAmount);
        expect(await lunchBox.btcSnacksAmountStoredFor(snacksPool.address)).to.equal(insufficientAmount);
        expect(await lunchBox.ethSnacksAmountStoredFor(snacksPool.address)).to.equal(insufficientAmount);
        // Another stake from SnacksPool
        await snacks.transfer(snacksPool.address, sufficientAmount);
        await btcSnacks.transfer(snacksPool.address, sufficientAmount);
        await ethSnacks.transfer(snacksPool.address, sufficientAmount);
        await busd.mint(lunchBox.address, hre.ethers.utils.parseEther("6"));
        
        await withImpersonatedSigner(investmentSystemDistributor.address, async (investmentSystemDistributorSigner) => {
          await lunchBox.connect(investmentSystemDistributorSigner)
            .stakeForSnacksPool(sufficientAmount, sufficientAmount, sufficientAmount, 0, 0, 0);
        });
        // Stored amounts check
        expect(await lunchBox.snacksAmountStoredFor(snacksPool.address)).to.equal(0);
        expect(await lunchBox.btcSnacksAmountStoredFor(snacksPool.address)).to.equal(0);
        expect(await lunchBox.ethSnacksAmountStoredFor(snacksPool.address)).to.equal(0);

        await withImpersonatedSigner(investmentSystemDistributor.address, async (investmentSystemDistributorSigner) => {
          await expect(lunchBox.connect(investmentSystemDistributorSigner)
            .stakeForSnacksPool(0, 0, 0, 0, 0, 0)).to.emit(lunchBox, 'Staked').withArgs(snacksPool.address, 0);
        });
    });

    it("Successful getReward() execution", async() => {
      await withImpersonatedSigner(snacksPool.address, async (snacksPoolSigner) => {
        await lunchBox.connect(snacksPoolSigner).getReward(owner.address);
      });
      // Stake from owner to SnacksPool
      await snacks.approve(snacksPool.address, ethers.utils.parseEther("1"));
      await snacksPool.stake(ethers.utils.parseEther("1"));
      const data = abiCoder.encode(
        ["uint", "tuple(uint[], uint[])"],
        [10000, [[], []]]
      );
      await snacksPool.activateInvestmentSystem(data);
      // Stake from SnacksPool
      await snacks.transfer(snacksPool.address, amountToStake);
      await btcSnacks.transfer(snacksPool.address, amountToStake);
      await ethSnacks.transfer(snacksPool.address, amountToStake);
      await busd.mint(lunchBox.address, hre.ethers.utils.parseEther("6"));
      
      await withImpersonatedSigner(investmentSystemDistributor.address, async (investmentSystemDistributorSigner) => {
        await lunchBox.connect(investmentSystemDistributorSigner)
          .stakeForSnacksPool(amountToStake, amountToStake, amountToStake, 0, 0, 0);
      });
      
      // Notify LunchBox about reward
      await snacks.transfer(lunchBox.address, amountToStake);
      
      await withImpersonatedSigner(poolRewardDistributor.address, async (poolRewardDistributorSigner) => {
        await lunchBox.connect(poolRewardDistributorSigner).notifyRewardAmount(amountToStake);
      });
      const balanceBefore = await snacks.balanceOf(owner.address);
      // Get reward
      await withImpersonatedSigner(snacksPool.address, async (snacksPoolSigner) => {
        await lunchBox.connect(snacksPoolSigner).getReward(owner.address);
      });
      // Check balance
      const snacksReward = await lunchBox.rewardRate();
      expect(await snacks.balanceOf(owner.address)).to.equal(balanceBefore.add(snacksReward));
    });

    it("Successful notifyRewardAmount() execution", async() => {
        const reward = ethers.utils.parseEther("100");
        // Reward rate expected
        let rewardRate = reward.div(43200);
        // Call from not the PRD contract
        await expect(lunchBox.notifyRewardAmount(reward))
          .to.be.reverted;
        // Reward notification
        await snacks.transfer(lunchBox.address, reward);
        
        await withImpersonatedSigner(poolRewardDistributor.address, async (poolRewardDistributorSigner) => {
          await lunchBox.connect(poolRewardDistributorSigner).notifyRewardAmount(reward);
        });
        
        // Reward rate check
        expect(await lunchBox.rewardRate()).to.equal(rewardRate);
        // Another reward notification
        await snacks.transfer(lunchBox.address, reward);
        
        await withImpersonatedSigner(poolRewardDistributor.address, async (poolRewardDistributorSigner) => {
          await lunchBox.connect(poolRewardDistributorSigner).notifyRewardAmount(reward);
        });
        
        // Reward rate check
        rewardRate = ethers.BigNumber.from("4629522462277091");
        expect(await lunchBox.rewardRate()).to.equal(rewardRate);
        await time.increase(43200);
        // Reward notification after period finished
        await snacks.transfer(lunchBox.address, reward);
        
        await withImpersonatedSigner(poolRewardDistributor.address, async (poolRewardDistributorSigner) => {
          await lunchBox.connect(poolRewardDistributorSigner).notifyRewardAmount(reward);
        });
        
        rewardRate = reward.div(43200);
        // Reward rate check
        expect(await lunchBox.rewardRate()).to.equal(rewardRate);

        // Staking token clearing
        await withImpersonatedSigner(lunchBox.address, async (lunchBoxSigner) => {
          await snacks.connect(lunchBoxSigner).transfer(owner.address, await snacks.balanceOf(lunchBox.address));
        });

        await withImpersonatedSigner(poolRewardDistributor.address, async (poolRewardDistributorSigner) => {
          await expect(lunchBox.connect(poolRewardDistributorSigner).notifyRewardAmount(reward))
            .to.be.revertedWith("LunchBox: provided reward too high");
        });
    });

    it("Successful setRewardsDuration() execution", async() => {
        const reward = ethers.utils.parseEther("100");
        // Reward notification
        await snacks.transfer(lunchBox.address, reward);

        await withImpersonatedSigner(poolRewardDistributor.address, async (poolRewardDistributorSigner) => {
          await lunchBox.connect(poolRewardDistributorSigner).notifyRewardAmount(reward);
          // Call from not the owner
          await expect(lunchBox.connect(poolRewardDistributorSigner).setRewardsDuration(0))
            .to.be.reverted;
        });

        // Too early rewards duration change
        await expect(lunchBox.setRewardsDuration(0)).to.be.revertedWith("LunchBox: duration cannot be changed now");
        await time.increase(43200);
        // Successful change
        await expect(lunchBox.setRewardsDuration(1))
            .to.emit(lunchBox, "RewardsDurationUpdated")
            .withArgs(1);
    });

    it("Successful setRecipients() execution", async() => {
        let recipients = [owner.address, poolRewardDistributor.address];
        let percentages = [5000, 4000, 1000];
        
        await withImpersonatedSigner(snacksPool.address, async (snacksPoolSigner) => {
          // Call from not the owner
          await expect(lunchBox.connect(snacksPoolSigner).setRecipients(recipients, percentages))
            .to.be.reverted;
        });
        
        // Invalid array lengths
        await expect(lunchBox.setRecipients(recipients, percentages))
            .to.be.revertedWith("LunchBox: invalid array lengths");
        percentages = [3000, 2000];
        // Invalid sum of percentages
        await expect(lunchBox.setRecipients(recipients, percentages))
            .to.be.revertedWith("LunchBox: invalid sum of percentages");
        percentages = [5000, 5000];
        // Successful call
        await lunchBox.setRecipients(recipients, percentages);
    });

    it("Successful onlySnacks check", async() => {
        await expect(lunchBox.updateTotalSupplyFactor(100)).to.be.reverted;
    });
});