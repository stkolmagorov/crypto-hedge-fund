const { emptyStage } = require('../../../../helpers');
module.exports = emptyStage('First manual stage stage...');
module.exports.tags = ["first_manual"];
module.exports.dependencies = [
  "insert_bsc_testnet_routers",
  "insert_mock_tokens",
  "main_first"
];
