const fsExtra = require('fs-extra');
module.exports = async (hre, artifactNames) => {
  const dirPath = '../frontend/src/abis/';
  await fsExtra.emptyDir(dirPath);
  for (let i = 0; i < artifactNames.length; i++) {
    console.log(`Delivering - ${artifactNames[i]}`);
    const artifact = await hre.artifacts.readArtifact(artifactNames[i]);
    await fsExtra.writeJSON(`${dirPath}/${artifact.contractName}.json`, artifact, {
      spaces: 2,
    });
  }
}
