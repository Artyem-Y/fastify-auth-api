const fs = require("fs");

// Helper methods

exports.validateEmail = email => {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
};

exports.validatePhoneNumber = phoneNumber => {
  const phoneRe = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im;
  return phoneRe.test(phoneNumber);
};

exports.getUserFromToken = async (app, _token) => {
  try {
    const token = _token.split(" ")[1],
      decodedToken = await app.jwt.decode(token);
    return decodedToken._id;
  } catch (err) {
    return {
      message: "can't get user from token",
      error: err
    };
  }
};
