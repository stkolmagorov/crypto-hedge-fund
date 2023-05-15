const { emptyStage } = require('../helpers');
module.exports = emptyStage('Backend fixture...');
module.exports.tags = ["general_test_fixtures"];
module.exports.dependencies = [
    "testnet_predeploy", 
    "configure"
];
module.exports.runAtTheEnd = true;
