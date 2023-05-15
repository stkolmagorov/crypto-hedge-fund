const { emptyStage } = require('../../../../helpers');
module.exports = emptyStage('Second manual stage stage...');
module.exports.tags = ["second_manual"];
module.exports.dependencies = [
  "insert_pairs",
  "main_second",
  "configure"
];
