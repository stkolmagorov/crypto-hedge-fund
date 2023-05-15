const { types } = require("hardhat/config");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
module.exports = (task) => 
  task(
    "time",
    "Helps manipulating time in localhost testnet",
  )
    .addOptionalParam("duration", "The duration of time travel in seconds.", 43200, types.int)
    .setAction(async ({ duration }, hre) => {
            await time.increase(duration);
        }
    );
  