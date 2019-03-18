const fp = require("fastify-plugin");
const routes = require("./routes");

module.exports = fp(async function(app, opts) {
  app.register(routes, {
    prefix: opts.prefix
  });
});
