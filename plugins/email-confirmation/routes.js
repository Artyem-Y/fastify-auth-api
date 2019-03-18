"use strict";

const helpers = require("../../services/helpers");
const Mailgun = require("mailgun-js");
const mustache = require("mustache");
const errors = require("../../errors");

module.exports = async function (app, opts) {
  const users = app.mongo.db.collection("users");

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
          const templateData = await helpers.readFileAsync("./plugins/email-confirmation/confirm-email.html"),
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
