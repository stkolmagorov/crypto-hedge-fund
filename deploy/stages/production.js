const { emptyStage } = require('../helpers');
module.exports = emptyStage('Production stage...');
module.exports.tags = ["production"];
module.exports.dependencies = [
  "before_real", 
  "main_first", 
  "after_real", 
  "main_second", 
  "configure"
];
module.exports.runAtTheEnd = true;
