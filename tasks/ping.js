module.exports = (task) => task(
  "ping",
  "Pings our test node",
  async (taskArgs, hre) => {
    const provider = await hre.ethers.getDefaultProvider('http://hh.zoinks.fi/');
    const network = await provider.getNetwork(56);
    console.log(`Here you are your network structure, buddy: ${JSON.stringify(network)}`);
  }
);
