const { Utils } = require("./helpers/Utils.ts");

const { bob } = require("../scripts/sandbox/accounts");

describe("QFarm tests", async () => {
  var utils;

  before("setup", async () => {
    utils = new Utils();

    await utils.init();
  });

  it("should fail if not admin is trying to setup new admin", async () => {
    await utils.setProvider(bob.sk);
  });
});
