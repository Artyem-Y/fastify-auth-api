"use strict";

const fastify = require("fastify")({
  logger: true
});
const { mongourl } = require("./config/config");
const swagger = require("./config/swagger");

//custom plugins
const AuthMongoJwt = require("./plugins/auth");

fastify.register(require("fastify-swagger"), swagger.options);

fastify.register(AuthMongoJwt, {
  auth: {
    secret: "thisisalongsecretjustfortests"
  },
  mongodb: {
    url: mongourl,
    w: 1,
    useNewUrlParser: true,
    forceClose: true
  }
});

fastify.get(
  "/",
  {
    schema: {
      description: "main api route",
      tags: ["General"]
    }
  },
  async function(req, res) {
    return { API: "works" };
  }
);

// Run the server!
const start = async () => {
  try {
    await fastify.listen(process.env.PORT || 3000, "0.0.0.0");
    fastify.swagger();
    fastify.log.info(`server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
