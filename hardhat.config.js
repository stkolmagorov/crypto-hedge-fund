const { lazyObject } = require("hardhat/plugins");

require("dotenv").config();
require("hardhat-deploy");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-docgen");
require('hardhat-abi-exporter');
require("hardhat-ethernal");
const tdly = require("@tenderly/hardhat-tenderly");
tdly.setup();

require("./tasks/get_all_artifacts")(task);
require("./tasks/ethernal_reset")(task);
require("./tasks/accounts")(task);
require("./tasks/ping")(task);
require("./tasks/mythx")(task);
require("./tasks/set_authority_balance")(task);
require("./tasks/time")(task);

const mainnetBscUrl = `https://rpc.ankr.com/bsc`;
const testnetBscUrl = `https://bsc-testnet.nodereal.io/v1/${process.env.MEGANODE_SECRET_TESTNET}`

const mainnetBscChainId = 56;
const testnetBscChainId = 97;

const DEFAULT_SETTING = {
    version: "0.8.15",
    settings: {
        optimizer: {
            enabled: true,
            runs: 200
        }
    }
}

extendEnvironment(async (hre) => {
    // This is for the deploy artifacts stage management.
    // The Deployments space is used for dependency injection for deploy scripts and test/fixtures scripts.
    // Example: For fixtures we have to have different artifacts for LP interface and IPair interface but still
    // logically it's one contract in the production stage. We also have our own contracts and the external ones,
    // that also have to be accesible from the Deployments space. This object is to organize the artifacts names
    // similar to the localization frameworks (in the "get" function of the "deployments" instance we use keys from
    // the hre.names object).
    // There are two groups of artifact names: internal (our own and local libraries) and external (like Uniswap or etc.). The internal
    // ones are populated automatically. The external ones and their subgroups are defined in the "external_artifacts_names.json"
    // file.
    //
    // Code example:
    // const <someContractInstanceVariable> = await hre.ethers.getContractAt(
    //   hre.names.internal.<valid valid deployments artifact>,
    //   (await deployments.get(hre.names.<full valid deployments artifact name>)).address
    // );
    //
    // Or:
    // const apeSwapPoolInstance = await hre.ethers.getContractAt(
    //   hre.names.internal.apeSwapPool,
    //   (await deployments.get(hre.names.internal.apeSwapPool)).address
    // );
    //
    // Or for tests/fixtures:
    // const busdInstance = await hre.ethers.getContractAt(
    //   hre.names.external.tokens.busd,
    //   (await deployments.get(hre.names.external.tokens.busd)).address
    // );
    //
    // Or for production:
    // const busdInstance = await hre.ethers.getContractAt(
    //   hre.names.internal.iERC20,
    //   (await deployments.get(hre.names.external.tokens.busd)).address
    // );
    //
    // "names" object contains all names of all types for the artifacts.
    const allArtifacts = await hre.run("get_all_artifacts");
    hre.names = {
        external: lazyObject(() => require('./external_artifacts_names.json')),
        internal: lazyObject(() => {
            // Gathering all our internal artifacts names and making them public
            const result = {};
            allArtifacts.map(e => e.split(':')[1]).forEach(e => {
                result[e[0].toLowerCase() + e.slice(1)] = e;
            })
            return result;
        })
    };
});

module.exports = {
  solidity: {
      compilers: [DEFAULT_SETTING]
  },
  networks: {
      hardhat: {
          forking: {
              url: mainnetBscUrl,
              chainId: mainnetBscChainId,
              blockNumber: 28222861
          },
          saveDeployments: true
      },
      bsc_mainnet: {
          url: mainnetBscUrl,
          chainId: mainnetBscChainId,
          accounts: {mnemonic: process.env.MAINNET_DEPLOY_MNEMONIC},
          saveDeployments: true
      },
      bsc_testnet: {
        url: testnetBscUrl,
        chainId: testnetBscChainId,
        accounts: {mnemonic: process.env.MNEMONIC},
        saveDeployments: true
      },
      tenderly: {
          url: `https://rpc.tenderly.co/fork/${process.env.TENDERLY_FORK}`,
          chainId: mainnetBscChainId
      },
      tenderly_testnet: {
        url: `https://rpc.tenderly.co/fork/${process.env.TENDERLY_FORK_TESTNET}`,
        chainId: testnetBscChainId
      },
  },
  namedAccounts: {
      deployer: 0,
      authority: 1,
      recipient: 2,
      bdmWallet: 3,
      crmWallet: 4,
      devManagerWallet: 5,
      marketingManagerWallet: 6,
      devWallet: 7,
      marketingFundWallet: 8,
      situationalFundWallet: 9,
      seniorageWallet: 10,
      multisigWallet: 11
  },
  gasReporter: {
      enabled: process.env.REPORT_GAS === "true" ? true : false,
      currency: "USD"
  },
  etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY
  },
  verify: {
      etherscan: {
          apiKey: process.env.ETHERSCAN_API_KEY
      }
  },
  docgen: {
      path: './docs',
      clear: true,
      runOnCompile: process.env.DOCGEN === "true" ? true : false
  },
  abiExporter: {
    path: '../frontend/src/abis',
    flat: false,
    pretty: true
  },
  ethernal: {
    email: process.env.ETHERNAL_EMAIL,
    password: process.env.ETHERNAL_PASSWORD,
    disabled: process.env.ETHERNAL_DISABLED === "true",
    workspace: process.env.ETHERNAL_WORKSPACE,
    uploadAst: true
  },
  tenderly: {
    project: "Zoinks Development",
    username: "numeralhuman",
    forkNetwork: process.env.TENDERLY_FORK,
    privateVerification: false,
    deploymentsDir: "deployments"
  },
};
