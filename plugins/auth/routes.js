"use strict";

const securePassword = require("secure-password");
const DUPLICATE_KEY_ERROR = 11000;
const helpers = require("../../services/helpers");
const middleWares = require("../../services/middlewares");
const {FB, FacebookApiException} = require("fb");
const request = require("request");
const Mailgun = require("mailgun-js");
const mustache = require("mustache");

const errors = require("../../errors");

module.exports = async function (app, opts) {
  const users = app.mongo.db.collection("users");
  const pwd = securePassword();

  // Ensure that there is an index on email, so we do not store duplicated entries
  await users.createIndex(
    {
      email: 1
    },
    {unique: true}
  );

  app.post(
    "/signup",
    {
      schema: {
        description: "Sign up",
        tags: ["Authentication"],
        body: {
          type: "object",
          properties: {
            email: {type: "string"},
            emailConfirmed: {type: "boolean"},
            password: {type: "string"},
            firstName: {type: "string"},
            lastName: {type: "string"},
            address: {type: "string"},
            phone: {type: "string"},
            postCode: {type: "number"},
            locale: {type: "string"}
          },
          required: ["firstName", "lastName", "password", "email", "phone"]
        },
        response: {
          201: {
            description: "Successful response",
            type: "object",
            properties: {
              status: {type: "string"}
            }
          }
        }
      }
    },
    async function (req, reply) {
      const {email, password, firstName, lastName, address, phone, postCode, locale} = req.body;
      if (!helpers.validateEmail(email)) {
        reply.code(422).send({
          status: "not ok",
          message: "such email not valid",
          code: errors.EMAIL_NOT_VALID
        });
      } else if (phone && !helpers.validatePhoneNumber(phone)) {
        reply.code(422).send({
          status: "not ok",
          message: "such phone not valid",
          code: errors.PHONE_NOT_VALID
        });
      } else {
        const emailConfirmed = false;
        const createdAt = new Date();
        const hashedPassword = await pwd.hash(Buffer.from(password));
        try {
          await users.insertOne({
            email,
            hashedPassword,
            firstName,
            lastName,
            address,
            phone,
            postCode,
            locale,
            emailConfirmed,
            createdAt
          });
        } catch (err) {
          if (err.code === DUPLICATE_KEY_ERROR) {
            reply.code(422).send({
              status: "not ok",
              message: "such email already exists",
              code: errors.DUPLICATE_KEY_ERROR
            });
            return;
          }
          throw err;
        }
        return {status: "ok"};
      }
    }
  );

  app.get(
    "/me",
    {
      schema: {
        description: "Me",
        tags: ["Authentication"],
        response: {
          201: {
            description: "Successful response",
            type: "object",
            properties: {
              status: {type: "string"},
              id: {type: "string"},
              email: {type: "string"},
              firstName: {type: "string"},
              lastName: {type: "string"},
              address: {type: "string"},
              postCode: {type: "number"},
              phone: {type: "number"}
            }
          }
        }
      },
      beforeHandler: [
        async (request, reply) => {
          await request.jwtVerify();
        },
        middleWares.checkEmailConfirmed(app)
      ]
    },
    async function (req, reply) {
      try {
        const user = await users.findOne({email: req.user.email});
        reply.code(200);
        return {
          status: "ok",
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          address: user.address,
          postCode: user.postCode,
          phone: user.phone
        };
      } catch (err) {
        return {
          status: "not ok",
          err: err
        };
      }
    }
  );

  app.post(
    "/login",
    {
      schema: {
        description: "Log in",
        tags: ["Authentication"],
        body: {
          type: "object",
          properties: {
            email: {type: "string"},
            password: {type: "string"},
            locale: {type: "string"}
          },
          required: ["email", "password"]
        },
        response: {
          201: {
            description: "Successful response",
            type: "object",
            properties: {
              status: {type: "string"},
              token: {type: "string"}
            }
          }
        }
      },
      beforeHandler: [middleWares.checkEmailConfirmed(app)]
    },
    async function (req, reply) {
      const {email, password, locale} = req.body;
      const user = await users.findOne({email});
      const res = await pwd.verify(Buffer.from(password), user.hashedPassword.buffer);

      if (res === securePassword.INVALID_UNRECOGNIZED_HASH) {
        throw new Error("invalid unrecognized hash");
      } else if (res === securePassword.INVALID) {
        reply.code(400);
        return {
          message: "login data is incorrect",
          status: "not ok",
          code: errors.INVALID_UNRECOGNIZED_HASH
        };
      } else if (res === securePassword.VALID_NEEDS_REHASH) {
        req.log.info({email}, "password needs rehashing");
        const hashedPassword = await pwd.hash(Buffer.from(password));
        await users.update({_id: user._id}, {hashedPassword});
      }
      const token = await reply.jwtSign({email, _id: user._id});
      await users.updateOne({_id: user._id}, {$set: {locale: locale}});
      return {status: "ok", token};
    }
  );

  app.post(
    "/login/fb",
    {
      schema: {
        description: "Log in via FB or create new user via FB",
        tags: ["Authentication"],
        body: {
          type: "object",
          properties: {
            token: {type: "string"},
            locale: {type: "string"},
            email: {type: "string"}
          },
          required: ["token"]
        },
        response: {
          201: {
            description: "Successful response",
            type: "object",
            properties: {
              message: {type: "string"},
              status: {type: "string"},
              token: {type: "string"}
            }
          }
        }
      }
    },
    async function (req, reply) {
      const fbResp = await new Promise((resolve, reject) => {
        FB.api("me", {fields: ["id", "name", "email"], access_token: req.body.token}, res => resolve(res));
      });

      const email = fbResp.email || req.body.email;

      if (email === null || typeof email === "undefined") {
        reply.code(400);
        return {
          status: "not ok",
          message: "email is empty",
          code: errors.EMAIL_IS_EMPTY
        };
      } else if (fbResp.error) {
        if (fbResp.error.code === 190 && fbResp.error.error_subcode !== 463) {
          // not ok token
          reply.code(400);
          return {
            error: fbResp.error,
            code: errors.FACEBOOK_TOKEN_NOT_VALID
          };
        } else {
          // expired token
          reply.code(400);
          return {
            error: fbResp.error,
            code: errors.FACEBOOK_TOKEN_EXPIRED
          };
        }
      } else {
        const user = await users.findOne({email: email});
        // login via fb
        if (user && user.fbId === fbResp.id && (email !== null || email !== undefined)) {
          const token = await reply.jwtSign({email: email, _id: user._id});
          await users.updateOne({_id: user._id}, {$set: {locale: req.body.locale}});
          return {message: "login via fb", status: "ok", token};
          // attach fbId to existing user
        } else if (user && user.emailConfirmed === true) {
          const token = await reply.jwtSign({email: email, _id: user._id});
          await users.updateOne({_id: user._id}, {$set: {fbId: fbResp.id}});
          return {message: "login via fb", status: "ok", token};
        } else {
          // sign up via fb
          try {
            let userData;
            if (fbResp.name) {
              const userName = fbResp.name.split(" "),
                _firstName = userName[0],
                _lastName = userName[1];
              userData = {
                fbId: fbResp.id,
                email: email,
                firstName: _firstName,
                lastName: _lastName,
                createdAt: new Date()
              };
            } else {
              userData = {
                fbId: fbResp.id,
                email: email,
                createdAt: new Date()
              };
            }

            const newUserFromFb = await new Promise((resolve, reject) => {
              users.insertOne(userData, (err, data) => {
                if (err) return reject(err);
                resolve(data.ops[0]);
              });
            });

            const token = await reply.jwtSign({
              email: email,
              _id: newUserFromFb._id
            });
            return {message: "new user is created", status: "ok", token};
          } catch (err) {
            if (err.code === DUPLICATE_KEY_ERROR) {
              reply.code(422).send({
                status: "not ok",
                message: "such email already exists",
                code: errors.SOCIAL_NETWORKS_SUCH_EMAIL_ALREADY_EXIST
              });
            } else {
              return err;
            }
          }
        }
      }
    }
  );

  app.post(
    "/email-confirmation",
    {
      schema: {
        description: "Email confirmation request",
        tags: ["Authentication"],
        body: {
          type: "object",
          properties: {
            email: {type: "string"},
            locale: {type: "string"}
          },
          required: ["email"]
        },
        response: {
          201: {
            description: "Successful response",
            type: "object",
            properties: {
              status: {type: "string"},
              message: {type: "string"},
              email: {type: "string"}
            }
          }
        }
      }
    },
    async function (req, reply) {
      const {email, locale} = req.body;
      const user = await users.findOne({email});

      if (!user) {
        reply.code(400);
        return {
          message: "user not found",
          code: errors.USER_NOT_FOUND
        };
      }

      try {
        if (user && user.emailConfirmed === false) {
          const templateData = await helpers.readFileAsync("./plugins/auth/confirm-email.html"),
            template = templateData.toString(),
            verificationCode = Math.floor(1000 + Math.random() * 9000),
            subject = "Email verification";

          await users.updateOne({_id: user._id}, {$set: {verificationCode: verificationCode}});

          // send email
          const mailGun = new Mailgun({
            apiKey: process.env.MailgunApiKey,
            domain: process.env.MailgunDomain
          });
          const data = {
            from: process.env.MailgunEmailFrom,
            to: user.email,
            subject: subject,
            html: mustache.render(template, {
              firstName: user.firstName,
              verificationCode: verificationCode
            })
          };

          mailGun.messages().send(data, function (err, body) {
            if (err) {
              console.log("got an error: ", err);
            } else {
              console.log("Email is sent: ", body);
            }
          });
          reply.code(200);
          return {
            message: "verification code is created",
            email
          };
        } else if (user.emailConfirmed === true) {
          return {
            message: "this email is already verified",
            email,
            code: errors.THIS_EMAIL_VERIFIED
          };
        }
      } catch (err) {
        reply.code(400);
        return err;
      }
    }
  );

  app.post(
    "/confirm-email",
    {
      schema: {
        description: "Email confirmation using received code",
        tags: ["Authentication"],
        body: {
          type: "object",
          properties: {
            email: {type: "string"},
            code: {type: "number"}
          },
          required: ["email", "code"]
        },
        response: {
          201: {
            description: "Successful response",
            type: "object",
            properties: {
              message: {type: "string"},
              status: {type: "string"},
              email: {type: "string"}
            }
          }
        }
      }
    },
    async function (req, reply) {
      const {email, code} = req.body;
      const user = await users.findOne({email});

      if (!user) {
        reply.code(400);
        return {
          message: "user not found",
          code: errors.USER_NOT_FOUND
        };
      }

      try {
        if (user.verificationCode === code) {
          await users.bulkWrite([
            {
              updateOne: {
                filter: {_id: user._id},
                update: {
                  $set: {emailConfirmed: true},
                  $unset: {verificationCode: null}
                }
              }
            }
          ]);
          reply.code(200);
          return {
            message: "email is confirmed",
            email
          };
        } else {
          reply.code(400);
          return {
            message: "validation code is incorrect",
            email,
            code: errors.EMAIL_VALIDATION_CODE_INCORRECT
          };
        }
      } catch (err) {
        reply.code(400);
        return err;
      }
    }
  );
};