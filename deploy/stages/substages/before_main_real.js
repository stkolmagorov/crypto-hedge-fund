const hre = require("hardhat");
const { getFakeDeployment } = require('../../helpers.js');

module.exports = async ({ deployments }) => {
  const {save, log} = deployments;
  
  await getFakeDeployment(
    "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
    hre.names.external.tokens.btc,
    save,
    log
  );
  await getFakeDeployment(
    "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
    hre.names.external.tokens.busd,
    save,
    log
  );
  await getFakeDeployment(
    "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
    hre.names.external.tokens.eth,
    save,
    log
  );
  
  await getFakeDeployment(
    "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    hre.names.external.routers.pancake,
    save,
    log
  );
  await getFakeDeployment(
    "0xcF0feBd3f17CEf5b47b0cD257aCf6025c5BFf3b7",
    hre.names.external.routers.ape,
    save,
    log
  );
  await getFakeDeployment(
    "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8",
    hre.names.external.routers.bi,
    save,
    log
  );
}
module.exports.tags = ["before_real"];
