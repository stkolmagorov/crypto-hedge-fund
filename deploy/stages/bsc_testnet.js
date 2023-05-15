const { emptyStage } = require('../helpers');
module.exports = emptyStage('BSC Testnet stage...');
module.exports.tags = ["bsc_testnet"];
module.exports.dependencies = ["bsc_testnet_predeploy", "configure"];
module.exports.runAtTheEnd = true;
