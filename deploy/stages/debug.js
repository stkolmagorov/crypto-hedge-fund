const { emptyStage } = require('../helpers');
module.exports = emptyStage('Debug stage...');
module.exports.tags = ["debug"];
module.exports.dependencies = ["before_mock", "main_first", "main_second", "configure"];
module.exports.runAtTheEnd = true;
