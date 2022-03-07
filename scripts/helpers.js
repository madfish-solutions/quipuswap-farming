const fs = require("fs");

const { execSync } = require("child_process");

const { TezosToolkit } = require("@taquito/taquito");
const { InMemorySigner } = require("@taquito/signer");

const { confirmOperation } = require("./confirmation");

const env = require("../env");

const getLigo = (isDockerizedLigo, ligoVersion = env.ligoVersion) => {
  let path = "ligo";

  if (isDockerizedLigo) {
    path = `docker run -v $PWD:$PWD --rm -i ligolang/ligo:${ligoVersion}`;

    try {
      execSync(`${path}  --help`);
    } catch (err) {
      path = "ligo";

      execSync(`${path}  --help`);
    }
  } else {
    try {
      execSync(`${path}  --help`);
    } catch (err) {
      path = `docker run -v $PWD:$PWD --rm -i ligolang/ligo:${ligoVersion}`;

      execSync(`${path}  --help`);
    }
  }

  return path;
};

const getContractsList = () => {
  return fs
    .readdirSync(env.contractsDir)
    .filter((file) => file.endsWith(".ligo"))
    .map((file) => file.slice(0, file.length - 5));
};

const getMigrationsList = () => {
  return fs
    .readdirSync(env.migrationsDir)
    .filter((file) => file.endsWith(".js"))
    .map((file) => file.slice(0, file.length - 3));
};

const compile = async (
  contract,
  format,
  contractsDir = env.contractsDir,
  outputDir = env.buildDir,
  ligoVersion = env.ligoVersion
) => {
  const ligo = getLigo(true, ligoVersion);
  const contracts = !contract ? getContractsList() : [contract];

  contracts.forEach((contract) => {
    const michelson = execSync(
      `${ligo} compile contract $PWD/${contractsDir}/${contract}.ligo ${
        format === "json" ? "--michelson-format json" : ""
      } --protocol hangzhou`,
      { maxBuffer: 1024 * 500 }
    ).toString();

    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
      }

      if (format === "json") {
        const artifacts = JSON.stringify(
          {
            contractName: contract,
            michelson: JSON.parse(michelson),
            networks: {},
            compiler: {
              name: "ligo",
              version: ligoVersion,
            },
            networkType: "tezos",
          },
          null,
          2
        );

        fs.writeFileSync(`${outputDir}/${contract}.json`, artifacts);
      } else {
        fs.writeFileSync(`${outputDir}/${contract}.tz`, michelson);
      }
    } catch (e) {
      console.error(e);
    }
  });
};

const compileLambdas = async (
  json,
  contract,
  ligoVersion = env.ligoVersion
) => {
  const ligo = getLigo(true, ligoVersion);
  const pwd = execSync("echo $PWD").toString();
  const lambdas = JSON.parse(
    fs.readFileSync(`${pwd.slice(0, pwd.length - 1)}/${json}`)
  );
  let res = [];

  try {
    for (const lambda of lambdas) {
      const michelson = execSync(
        `${ligo} compile expression pascaligo 'Setup_func(record [index=${lambda.index}n; func=Bytes.pack(${lambda.name})])' --michelson-format json --init-file $PWD/${contract} --protocol hangzhou`,
        { maxBuffer: 1024 * 500 }
      ).toString();

      res.push(JSON.parse(michelson).args[0].args[0]);

      console.log(
        lambda.index + 1 + ". " + lambda.name + " successfully compiled."
      );
    }

    if (!fs.existsSync(`${env.buildDir}/lambdas`)) {
      fs.mkdirSync(`${env.buildDir}/lambdas`);
    }

    if (contract.includes("q_farm")) {
      fs.writeFileSync(
        `${env.buildDir}/lambdas/q_farm_lambdas.json`,
        JSON.stringify(res)
      );
    } else {
      fs.writeFileSync(
        `${env.buildDir}/lambdas/t_farm_lambdas.json`,
        JSON.stringify(res)
      );
    }
  } catch (e) {
    console.error(e);
  }
};

const migrate = async (tezos, contract, storage, network) => {
  try {
    const artifacts = JSON.parse(
      fs.readFileSync(`${env.buildDir}/${contract}.json`)
    );
    const operation = await tezos.contract
      .originate({
        code: artifacts.michelson,
        storage: storage,
      })
      .catch((e) => {
        console.error(e);

        return { contractAddress: null };
      });

    await confirmOperation(tezos, operation.hash);

    artifacts.networks[network] = { [contract]: operation.contractAddress };

    if (!fs.existsSync(env.buildDir)) {
      fs.mkdirSync(env.buildDir);
    }

    fs.writeFileSync(
      `${env.buildDir}/${contract}.json`,
      JSON.stringify(artifacts, null, 2)
    );

    return operation.contractAddress;
  } catch (e) {
    console.error(e);
  }
};

const getDeployedAddress = (contract, network) => {
  try {
    const artifacts = JSON.parse(
      fs.readFileSync(`${env.buildDir}/${contract}.json`)
    );

    return artifacts.networks[network][contract];
  } catch (e) {
    console.error(e);
  }
};

const runMigrations = async (options) => {
  try {
    const migrations = getMigrationsList();

    options.network = options.network || "development";
    options.optionFrom = options.from || 0;
    options.optionTo = options.to || migrations.length;

    const networkConfig = env.networks[options.network];
    const tezos = new TezosToolkit(networkConfig.rpc);

    tezos.setProvider({
      config: {
        confirmationPollingTimeoutSecond: env.confirmationPollingTimeoutSecond,
      },
      rpc: networkConfig.rpc,
      signer: await InMemorySigner.fromSecretKey(networkConfig.secretKey),
    });

    for (const migration of migrations) {
      const execMigration = require(`../${env.migrationsDir}/${migration}.js`);

      await execMigration(tezos, options.network);
    }
  } catch (e) {
    console.error(e);
  }
};

module.exports = {
  getLigo,
  getContractsList,
  getMigrationsList,
  getDeployedAddress,
  compile,
  compileLambdas,
  migrate,
  runMigrations,
  env,
};
