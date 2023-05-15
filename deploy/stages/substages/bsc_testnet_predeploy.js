module.exports = require('./testnet_predeploy');
module.exports.tags = ["bsc_testnet_predeploy"];
module.exports.dependencies = [
  "before_real",
  "insert_bsc_testnet_routers",
  "insert_mock_tokens", 
  "add_liquidity_to_pairs_with_mock",
  "main_first", 
  "after_real", 
  "main_second"
];
