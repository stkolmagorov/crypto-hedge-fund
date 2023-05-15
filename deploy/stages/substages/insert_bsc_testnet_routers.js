const hre = require('hardhat');
const { getFakeDeployment } = require('../../helpers.js');

module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
  network
}) => {  
  const {log, save} = deployments;
  await getFakeDeployment(
    "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3",
    hre.names.external.routers.pancake,
    save,
    log
  );
  await getFakeDeployment(
    "0xDaf2841D5997dff3c0412b60ccaee1a003fBd401",
    hre.names.external.routers.ape,
    save,
    log
  );
  await getFakeDeployment(
    "0xB01130462861960B38F7Bd649774FacC42639f8b",
    hre.names.external.routers.bi,
    save,
    log
  );
}
module.exports.tags = ["insert_bsc_testnet_routers"];
