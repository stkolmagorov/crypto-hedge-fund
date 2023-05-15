const deliver = require(`./artifacts_delivery/${process.env.ABI_DELIVERY}_delivery`);
module.exports = (task) => task(
  "deliver_abi",
  "Delivers ABI of the contracts to the frontend",
  async (taskArgs, hre) => {
    await hre.run("compile");
    const artifactNames = (await hre.artifacts.getAllFullyQualifiedNames()).filter(e => {
      const matches = e.match(/(hardhat\/console.sol:console)|(.+Mock.+)/g) || [];
      return matches.length == 0;
    });
    console.log('Starting to deliver ABIs:');
    console.group();
    await deliver(hre, artifactNames)
    console.groupEnd();
    console.log('Ended ABI delivery.');
  }
);
