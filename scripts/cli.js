const yargs = require("yargs");

const { compile, runMigrations } = require("./helpers");

const argv = yargs
  .command(
    "compile [contracts] [format] [output_dir]",
    "compiles the contract",
    {
      contracts: {
        description: "the contract to compile",
        alias: "c",
        type: "array",
      },
      format: {
        description: "fromat of output file",
        alias: "f",
        type: "string",
      },
      contracts_dir: {
        description: "contracts directory",
        alias: "p",
        type: "string",
      },
      output_dir: {
        description: "output directory",
        alias: "o",
        type: "string",
      },
      ligo_version: {
        description: "ligo version",
        alias: "v",
        type: "string",
      },
    },
    async (argv) => {
      for (i in argv.contracts) {
        compile(
          argv.contracts[i],
          argv.format,
          argv.contracts_dir,
          argv.output_dir,
          argv.ligo_version
        );
      }
    }
  )
  .command(
    "migrate [network] [from] [to]",
    "run migrations",
    {
      from: {
        description: "the migrations counter to start with",
        alias: "f",
        type: "number",
      },
      to: {
        description: "the migrations counter to end with",
        alias: "to",
        type: "number",
      },
      network: {
        description: "the network to deploy",
        alias: "n",
        type: "string",
      },
    },
    async (argv) => {
      runMigrations(argv);
    }
  )
  .help()
  .strictCommands()
  .demandCommand(1)
  .alias("help", "h").argv;
