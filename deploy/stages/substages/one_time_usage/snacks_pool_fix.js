const hre = require('hardhat');

module.exports = async ({
    deployments
}) => {
    const { execute, deploy } = deployments;
    const deployer = "0xf3CB3C06F29441010C7E9EE679C04668f83c9471";
    const authority = "0xd50d221D64A940133Fa19e4E8D68dE38B2a80f3C"; // HD - 2
    const recipient = "0x32e7f724f8e20ebcabe6291867f56d0a2f7f934d";

    const busdAddress = (await deployments.get(hre.names.external.tokens.busd)).address;
    const btcAddress = (await deployments.get(hre.names.external.tokens.btc)).address;
    const ethAddress = (await deployments.get(hre.names.external.tokens.eth)).address;

    const pancakePairLpAddress = (await deployments.get(hre.names.external.pairs.pancake.lp)).address;
    const pancakeSwapRouterAddress = (await deployments.get(hre.names.external.routers.pancake)).address;
    const systemStopperAddress = (await deployments.get(hre.names.internal.systemStopper)).address;
    const zoinksTokenAddress = (await deployments.get(hre.names.internal.zoinks)).address;
    const seniorageAddress = (await deployments.get(hre.names.internal.seniorage)).address;
    const pulseAddress = (await deployments.get(hre.names.internal.pulse)).address;
    const poolRewardDistributorAddress = (await deployments.get(hre.names.internal.poolRewardDistributor)).address;
    const holdingFeeDistributorAddress = (await deployments.get(hre.names.internal.holdingFeeDistributor)).address;
    const btcSnacksAddress = (await deployments.get(hre.names.internal.btcSnacks)).address;
    const ethSnacksAddress = (await deployments.get(hre.names.internal.ethSnacks)).address;
    const snacksAddress = (await deployments.get(hre.names.internal.snacks)).address;
    const pancakeSwapPoolAddress = (await deployments.get(hre.names.internal.pancakeSwapPool)).address;
    const apeSwapPoolAddress = (await deployments.get(hre.names.internal.apeSwapPool)).address;
    const biwapPoolAddress = (await deployments.get(hre.names.internal.biSwapPool)).address;

    await deploy(hre.names.internal.snacksPool, {
        from: deployer,
        args: [
            snacksAddress,
            poolRewardDistributorAddress,
            seniorageAddress,
            [
                snacksAddress,
                btcSnacksAddress,
                ethSnacksAddress
            ]
        ],
        skipIfAlreadyDeployed: false,
        log: true
    });
    const snacksPoolAddress = (await deployments.get(hre.names.internal.snacksPool)).address;

    await deploy(hre.names.internal.lunchBox, {
        from: deployer,
        args: [
            busdAddress,
            btcAddress,
            ethAddress,
            pancakeSwapRouterAddress
        ],
        skipIfAlreadyDeployed: false,
        log: true
    });
    const lunchBoxAddress = (await deployments.get(hre.names.internal.lunchBox)).address;

    await execute(
        hre.names.internal.poolRewardDistributor,
        { from: deployer, log: true },
        'configure',
        zoinksTokenAddress,
        snacksAddress,
        btcSnacksAddress,
        ethSnacksAddress,
        apeSwapPoolAddress,
        biwapPoolAddress,
        pancakeSwapPoolAddress,
        snacksPoolAddress,
        lunchBoxAddress,
        seniorageAddress,
        authority
    );

    await execute(
        hre.names.internal.snacks,
        { from: deployer, log: true },
        'configure',
        zoinksTokenAddress,
        pulseAddress,
        poolRewardDistributorAddress,
        seniorageAddress,
        snacksPoolAddress,
        pancakeSwapPoolAddress,
        lunchBoxAddress,
        authority,
        btcSnacksAddress,
        ethSnacksAddress,
    );

    await execute(
        hre.names.internal.btcSnacks,
        { from: deployer, log: true },
        'configure',
        btcAddress,
        pulseAddress,
        poolRewardDistributorAddress,
        seniorageAddress,
        snacksPoolAddress,
        pancakeSwapPoolAddress,
        lunchBoxAddress,
        authority,
        snacksAddress
    );

    await execute(
        hre.names.internal.ethSnacks,
        { from: deployer, log: true },
        'configure',
        ethAddress,
        pulseAddress,
        poolRewardDistributorAddress,
        seniorageAddress,
        snacksPoolAddress,
        pancakeSwapPoolAddress,
        lunchBoxAddress,
        authority,
        snacksAddress
    );

    await execute(
        hre.names.internal.snacksPool,
        { from: deployer, log: true },
        'configure',
        lunchBoxAddress,
        snacksAddress,
        btcSnacksAddress,
        ethSnacksAddress,
        authority
    );

    await execute(
        hre.names.internal.lunchBox,
        { from: deployer, log: true },
        'configure',
        zoinksTokenAddress,
        snacksAddress,
        btcSnacksAddress,
        ethSnacksAddress,
        snacksPoolAddress,
        poolRewardDistributorAddress,
        seniorageAddress
    );

    await execute(
        hre.names.internal.lunchBox,
        { from: deployer, log: true },
        'setRecipients',
        [recipient],
        [10000]
    );

    await execute(
        hre.names.internal.seniorage,
        { from: deployer, log: true },
        'setLunchBox',
        lunchBoxAddress
    );

    await execute(
        hre.names.internal.pulse,
        { from: deployer, log: true },
        'configure',
        pancakePairLpAddress,
        zoinksTokenAddress,
        snacksAddress,
        btcSnacksAddress,
        ethSnacksAddress,
        pancakeSwapPoolAddress,
        snacksPoolAddress,
        seniorageAddress,
        authority
    );

    await execute(
        hre.names.internal.snacksPool,
        { from: deployer, log: true },
        'grantRole',
        keccak256("PAUSER_ROLE"),
        systemStopperAddress
    );

    const pausableContracts = [
        apeSwapPoolAddress,
        biwapPoolAddress,
        pancakeSwapPoolAddress,
        snacksPoolAddress,
        pulseAddress,
        seniorageAddress,
        poolRewardDistributorAddress,
        holdingFeeDistributorAddress,
        snacksAddress,
        zoinksTokenAddress
    ];

    await execute(
        hre.names.internal.systemStopper,
        { from: deployer, log: true },
        'configure',
        pausableContracts
    );
}

module.exports.tags = ["snacks_pool_fix"];
