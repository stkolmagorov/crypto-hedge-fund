const util = require('node:util');
const exec = util.promisify(require('node:child_process').exec);
const fsExtra = require('fs-extra');

module.exports = (task) => task(
  "mythx",
  "Starting the process of MythX analysis",
  async (taskArgs, hre) => {
    const allArtifacts = await hre.run("get_all_artifacts", {
      areInterfacesExcluded: 'false',
      areMocksExcluded: 'true',
      areInternalContractsExcluded: 'false'
    });

    const analysisGroupName = `zoinksAnalysisGroup${Date.now()}`;
    const groupOpeningResult = (await exec(`mythx group open ${analysisGroupName}`)).stdout.toString('utf-8');
    console.log(groupOpeningResult);

    const groupId = groupOpeningResult.split(' ')[4];
    console.log(`Parsed analysis group ID: ${groupId}`);

    const importRemappings = [
      '--remap-import "@openzeppelin/=$(pwd)/node_modules/@openzeppelin/"',
      '--remap-import "@prb/=$(pwd)/node_modules/@prb/"',
      '--remap-import "@uniswap/=$(pwd)/node_modules/@uniswap/"'
    ];

    let analyzeCommandSrc = `mythx --yes --api-key ${process.env.MYTHX_API_KEY} analyze --solc-version ${hre.config.solidity.compilers[0].version} --mode ${process.env.MYTHX_MODE} --group-id ${groupId} --group-name ${analysisGroupName} ${importRemappings.join(' ')} --scenario=solidity --wait`;
    console.group();
    for (let i = 0; i < allArtifacts.length; i++) {
      const artifact = allArtifacts[i];
      analyzeCommandSrc += ` ${artifact}`;
      console.log(`Adding on analyze queue: ${artifact}`);
    }
    console.group();
    console.log('--- Constructed analyze command start ---:');
    console.log(`${analyzeCommandSrc}`);
    console.log('--- Constructed analyze command end ---:');
    console.groupEnd();
    console.groupEnd();
    console.log((await exec(analyzeCommandSrc)).stdout.toString('utf-8'));
    console.log((await exec(`mythx group close ${groupId}`)).stdout.toString('utf-8'));
    console.log((await exec(`mythx render --markdown ${groupId}`)).stdout.toString('utf-8'));
  }
);
