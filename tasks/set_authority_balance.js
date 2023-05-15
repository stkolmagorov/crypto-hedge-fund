module.exports = (task) => 
    task("set_authority_balance", "Sets authorised address balance")
        .addParam("value", "New value for authorised address balance")
        .setAction(async (taskArgs, hre) => {
            const accounts = await hre.getNamedAccounts();
            const hexValue = hre.ethers.utils.parseEther(taskArgs.value).toHexString().replace("0x0", "0x");
            await hre.ethers.provider.send(
                "hardhat_setBalance", 
                [accounts.authority, hexValue]
            );
            console.log("Authority balance:", (await hre.ethers.provider.getBalance(accounts.authority)).toString());
        });
  