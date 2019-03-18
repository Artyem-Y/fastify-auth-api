const { beforeEach, tearDown } = require("tap");
const { MongoClient } = require("mongodb");
const clean = require("mongo-clean");
const { mongourl } = require("../../config/config");
const Fastify = require("fastify");

// Custom modules
const AuthMongoJwt = require("../../plugins/auth/index");
const EmailConfirmation = require("../../plugins/email-confirmation/index");

const database = "tests";

const users = {
  first: {
    email: "test@test.com",
    password: "test",
    firstName: "test",
    lastName: "test",
    address: "test address",
    phone: 123123123123
  },
  second: {
    email: "test2@test.com",
    password: "test2",
    firstName: "test2",
    lastName: "test2",
    address: "test address 2",
    phone: 123123123123
  }
};

const getToken = async (user, app) => {
  return await app.jwt.sign({ email: user.email });
};

let client;

const init = () => {
  beforeEach(async function() {
    if (!client) {
      client = await MongoClient.connect(mongourl, {
        w: 1,
        useNewUrlParser: true
      });
    }
    await clean(client.db(database));
  });

  tearDown(async function() {
    if (client) {
      await client.close();
      client = null;
    }
  });
};

init();

// needed for testing your plugins
function config() {
  return {
    auth: {
      secret: "thisisalongsecretjustfortests"
    },
    mongodb: {
      client,
      database
    }
  };
}

// automatically build and tear down our instance
function build(t) {
  const app = Fastify({
    logger: {
      level: "error"
    }
  });

  // we use fastify-plugin so that all decorators are exposed for testing purposes, this is
  // different from the production setup
  app.register(AuthMongoJwt, config());
  app.register(EmailConfirmation);

  // tear down our app after we are done
  t.tearDown(app.close.bind(app));

  return app;
}

module.exports = {
  users,
  getToken,
  database,
  getClient: (user, app) => client,
  build
};
