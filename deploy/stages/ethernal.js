const { emptyStage } = require('../helpers');
module.exports = emptyStage('Ethernal stage...');
module.exports.tags = ["ethernal"];
module.exports.dependencies = [
    "ethernal_workspace_reset", 
    "testnet_predeploy", 
    "ethernal_configure", 
    "all_approves",
    "sync",
];
module.exports.runAtTheEnd = true;
