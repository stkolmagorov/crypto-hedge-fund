const hre = require('hardhat');
const { getFakeDeployment } = require('../../../../helpers');

module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
  network
}) => {  
  const {log, save} = deployments;

  // also there have to exist pairs with liquidity on pancake:
  // busd/btc
  // busd/eth

  const pancakePairAddr = "0x9c351b9529c80eD9795B39f867331993Bf4D9D9f"; 
  await getFakeDeployment(
    pancakePairAddr,
    hre.names.external.pairs.pancake.lp,
    save,
    log
  );
  await getFakeDeployment(
    pancakePairAddr,
    hre.names.external.pairs.pancake.pair,
    save,
    log
  );

  const apePairAddr = "0x203D3B925bA4903F9B5F88157a1a0696bD054946";
  await getFakeDeployment(
    apePairAddr,
    hre.names.external.pairs.ape.lp,
    save,
    log
  );
  await getFakeDeployment(
    apePairAddr,
    hre.names.external.pairs.ape.pair,
    save,
    log
  );

  const biPairAddr = "0x84385609B224B60d8aFCB06ee79b8Dc1e4AFFd10"; 
  await getFakeDeployment(
    biPairAddr,
    hre.names.external.pairs.bi.lp,
    save,
    log
  );
  await getFakeDeployment(
    biPairAddr,
    hre.names.external.pairs.bi.pair,
    save,
    log
  );
}
module.exports.tags = ["insert_pairs"];
