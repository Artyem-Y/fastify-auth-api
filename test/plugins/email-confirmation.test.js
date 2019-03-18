const { test } = require("tap");
const { users, build, getClient, database } = require("./helper");

test("email confirmation process", async t => {
  const app = build(t);

  const res1 = await app.inject({
    url: "/signup",
    method: "POST",
    body: users.first
  });

  t.equal(res1.statusCode, 200);
  t.match(JSON.parse(res1.body), { status: "ok" });

  const res2 = await app.inject({
    url: "/email-confirmation",
    method: "POST",
    body: {
      email: "test@test.com"
    }
  });

  t.equal(res2.statusCode, 200);
  t.match(JSON.parse(res2.body), {
    message: "verification code is created",
    email: "test@test.com"
  });

  const res3 = await app.inject({
    url: "/email-confirmation",
    method: "POST",
    body: {}
  });

  t.equal(res3.statusCode, 400);
  t.match(JSON.parse(res3.body), {
    statusCode: 400,
    error: "Bad Request",
    message: "body should have required property 'email'"
  });

  const client = getClient();
  const verificationCode = (await client
    .db(database)
    .collection("users")
    .findOne({ email: "test@test.com" })).verificationCode;

  const res4 = await app.inject({
    url: "/confirm-email",
    method: "POST",
    body: {
      email: "test@test.com",
      code: verificationCode
    }
  });

  t.equal(res4.statusCode, 200);
  t.match(JSON.parse(res4.body), {
    message: "email is confirmed",
    email: "test@test.com"
  });

  const res5 = await app.inject({
    url: "/confirm-email",
    method: "POST",
    body: {
      code: verificationCode
    }
  });

  t.equal(res5.statusCode, 400);
  t.match(JSON.parse(res5.body), {
    statusCode: 400,
    error: "Bad Request",
    message: "body should have required property 'email'"
  });

  const res6 = await app.inject({
    url: "/confirm-email",
    method: "POST",
    body: {
      email: "test@test.com",
      code: 12345
    }
  });

  t.equal(res6.statusCode, 400);
  t.match(JSON.parse(res6.body), {
    email: "test@test.com",
    message: "validation code is incorrect"
  });
});
