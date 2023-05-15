const { types } = require("hardhat/config");
module.exports = (task) => 
  task(
    "get_all_artifacts",
    "Returns all artifacts full names with specific filters",
  )
    .addOptionalParam('areInterfacesExcluded', "Define whether interfaces should be excluded from the resulting set.", 'false', types.bool)
    .addOptionalParam("areMocksExcluded", "Define whether the mocks should be excluded from the resulting set.", 'false', types.bool)
    .addOptionalParam("areInternalContractsExcluded", "Define whether the internal contracts should be excluded from the resulting set.", 'false', types.bool)
    .setAction(async ({ areInterfacesExcluded, areMocksExcluded, areInternalContractsExcluded }, hre) =>
      (await hre.artifacts.getAllFullyQualifiedNames()).filter(e => {
          return !e.includes('hardhat') && (e.startsWith('contracts') || areInternalContractsExcluded) && 
            (!e.includes('interface') || areInterfacesExcluded) && 
            (!e.includes('Mock') || areMocksExcluded);
        }
      )
    );
  