const helpers = require("./helpers");

// get token for all routes only if email is confirmed
exports.checkEmailConfirmed = app => async (req, res) => {
  const users = app.mongo.db.collection("users"),
    email = req.user ? req.user.email : req.body.email,
    user = await users.findOne({ email });

  if (!user) {
    res.code(400).send({
      code: 400,
      status: "not ok",
      message: "login data is incorrect"
    });
  } else if (user.emailConfirmed === false) {
    res.code(401).send({
      code: 401,
      status: "not ok",
      message: "email is not confirmed"
    });
  }
};

exports.checkUserFromToken = app => async (req, res) => {
  try {
    const userId = await helpers.getUserFromToken(app, req.headers.authorization);

    if (userId !== req.params.id) {
      res.code(403).send({
        code: 403,
        status: "not ok",
        message: "such action is forbidden"
      });
    }
  } catch (err) {
    res.code(400).send({
      status: "not ok",
      message: "can't check user from token",
      error: err
    });
  }
};
