module.exports = async ({deployments, network}) => {
  const {log} = deployments;
  if (network.name !== 'tenderly') {
    throw 'Network is not "tenderly"! Unexpected abort...';
  }
  log(message);
}
module.exports.tags = ["tenderly"];
module.exports.dependencies = ["testnet_predeploy", "configure", "sync_tenderly"];
module.exports.runAtTheEnd = true;
