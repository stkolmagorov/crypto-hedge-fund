const hre = require('hardhat');
const snacksAddressReplaceableConfigureStage = require("./reusable/snacks_address_replaceable_configure");

module.exports = snacksAddressReplaceableConfigureStage(
  async () => (await deployments.get(hre.names.internal.snacks)).address
);
module.exports.tags = ["configure"];
