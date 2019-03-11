const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  mongourl: process.env.DB_CONN
};
