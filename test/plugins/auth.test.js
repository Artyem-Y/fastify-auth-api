const { test } = require("tap");
const mock = require("mock-require");

mock("fb", {
  FB: {
    api: (...params) => {
      if (params[1].access_token === "OK_TOKEN") {
        return params[params.length - 1]({
          email: "jd@gmail.com",
          id: "TEST_FB_ID",
          username: "FB_USER_NAME"
        });
      } else if (params[1].access_token === "EXPIRED_TOKEN") {
        return params[params.length - 1]({
          error: {
            code: 190,
            type: "OAuthException",
            error_subcode: 463,
            message: "Error validating access token: Session has expired."
          }
        });
      } else if (params[1].access_token === "NOT_OK_TOKEN") {
        return params[params.length - 1]({
          error: {
            code: 190,
            type: "OAuthException",
            message: "Invalid OAuth access token."
          }
        });
      } else if (params[1].access_token === "OK_TOKEN_EMAIL_EMPTY") {
        return params[params.length - 1]({
          error: {
            status: "not ok",
            message: "email is empty"
          }
        });
      }
    }
  }
});

const { users, build, getClient, database } = require("./helper");

test("signup and login when email is confirmed", async t => {
  const app = build(t);

  const res1 = await app.inject({
    url: "/signup",
    method: "POST",
    body: users.first
  });

  t.deepEqual(res1.statusCode, 200);
  t.match(JSON.parse(res1.body), { status: "ok" });

  const client = getClient();
  await client
    .db(database)
    .collection("users")
    .updateOne({ email: "test@test.com" }, { $set: { emailConfirmed: true } });

  const res2 = await app.inject({
    url: "/login",
    method: "POST",
    body: {
      email: "test@test.com",
      password: "test"
    }
  });

  t.deepEqual(res2.statusCode, 200);
  t.match(JSON.parse(res2.body), { status: "ok" });

  const res3 = await app.inject({
    url: "/login",
    method: "POST",
    body: {
      email: "test@test.com",
      password: "test-2"
    }
  });

  t.deepEqual(res3.statusCode, 400);
  t.match(JSON.parse(res3.body), {
    status: "not ok",
    message: "login data is incorrect"
  });
});

test("signup and login when email is not confirmed", async t => {
  const app = build(t);

  const res1 = await app.inject({
    url: "/signup",
    method: "POST",
    body: users.first
  });

  t.deepEqual(res1.statusCode, 200);
  t.match(JSON.parse(res1.body), { status: "ok" });

  const res2 = await app.inject({
    url: "/login",
    method: "POST",
    body: {
      email: "test@test.com",
      password: "test"
    }
  });

  t.deepEqual(res2.statusCode, 401);
  t.match(JSON.parse(res2.body), {
    status: "not ok",
    message: "email is not confirmed"
  });

  const res3 = await app.inject({
    url: "/login",
    method: "POST",
    body: {
      email: "test-2@test.com",
      password: "test"
    }
  });

  t.deepEqual(res3.statusCode, 400);
  t.match(JSON.parse(res3.body), {
    status: "not ok",
    message: "login data is incorrect"
  });
});

test("signup without password", async t => {
  const app = build(t);

  const res1 = await app.inject({
    url: "/signup",
    method: "POST",
    body: {
      email: "test@test.com",
      firstName: "test",
      lastName: "test",
      phone: 123123123123
    }
  });

  t.deepEqual(res1.statusCode, 400);
  t.match(JSON.parse(res1.body), {
    statusCode: 400,
    error: "Bad Request",
    message: "body should have required property 'password'"
  });
});

test("signup without email", async t => {
  const app = build(t);

  const res1 = await app.inject({
    url: "/signup",
    method: "POST",
    body: {
      password: "aaaaa",
      firstName: "test",
      lastName: "test",
      phone: 123123123123
    }
  });

  t.deepEqual(res1.statusCode, 400);
  t.match(JSON.parse(res1.body), {
    statusCode: 400,
    error: "Bad Request",
    message: "body should have required property 'email'"
  });
});

test("signup without firstName", async t => {
  const app = build(t);

  const res1 = await app.inject({
    url: "/signup",
    method: "POST",
    body: {
      email: "test@test.com",
      password: "test",
      lastName: "test",
      phone: 123123123123
    }
  });

  t.deepEqual(res1.statusCode, 400);
  t.match(JSON.parse(res1.body), {
    statusCode: 400,
    error: "Bad Request",
    message: "body should have required property 'firstName'"
  });
});

test("signup without lastName", async t => {
  const app = build(t);

  const res1 = await app.inject({
    url: "/signup",
    method: "POST",
    body: {
      email: "test@test.com",
      password: "test",
      firstName: "test",
      phone: 123123123123
    }
  });

  t.deepEqual(res1.statusCode, 400);
  t.match(JSON.parse(res1.body), {
    statusCode: 400,
    error: "Bad Request",
    message: "body should have required property 'lastName'"
  });
});

test("signup without phone", async t => {
  const app = build(t);

  const res1 = await app.inject({
    url: "/signup",
    method: "POST",
    body: {
      email: "test@test.com",
      password: "test",
      firstName: "test",
      lastName: "test"
    }
  });

  t.deepEqual(res1.statusCode, 400);
  t.match(JSON.parse(res1.body), {
    statusCode: 400,
    error: "Bad Request",
    message: "body should have required property 'phone'"
  });
});

test("login wrong credentials", async t => {
  const app = build(t);

  const res1 = await app.inject({
    url: "/signup",
    method: "POST",
    body: {
      email: "test@test.com",
      password: "test",
      firstName: "test",
      lastName: "test",
      phone: 123123123123
    }
  });

  t.deepEqual(res1.statusCode, 200);
  t.match(JSON.parse(res1.body), { status: "ok" });

  const res2 = await app.inject({
    url: "/login",
    method: "POST",
    body: {
      email: "test@test.com",
      password: "collina"
    }
  });

  t.deepEqual(res2.statusCode, 401);
  t.match(JSON.parse(res2.body), { status: "not ok" });
});

test("double signup", async t => {
  const app = build(t);

  const res1 = await app.inject({
    url: "/signup",
    method: "POST",
    body: users.first
  });

  t.deepEqual(res1.statusCode, 200);
  t.match(JSON.parse(res1.body), { status: "ok" });

  const res2 = await app.inject({
    url: "/signup",
    method: "POST",
    body: users.first
  });

  t.deepEqual(res2.statusCode, 422);
  t.match(JSON.parse(res2.body), { status: "not ok" });
});

test("signup and login when email is confirmed", async t => {
  const app = build(t);

  const res1 = await app.inject({
    url: "/signup",
    method: "POST",
    body: users.first
  });

  const client = getClient();

  await client
    .db(database)
    .collection("users")
    .updateOne({ email: "test@test.com" }, { $set: { emailConfirmed: true } });

  t.deepEqual(res1.statusCode, 200);
  t.match(JSON.parse(res1.body), { status: "ok" });

  const res2 = await app.inject({
    url: "/login",
    method: "POST",
    body: {
      email: "test@test.com",
      password: "test"
    }
  });

  t.deepEqual(res2.statusCode, 200);
  const body2 = JSON.parse(res2.body);
  t.match(body2, { status: "ok" });

  const token = body2.token;
  t.ok(token);

  const res3 = await app.inject({
    url: "/me",
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  t.deepEqual(res3.statusCode, 200);
  t.match(JSON.parse(res3.body), {
    status: "ok",
    firstName: "test",
    lastName: "test",
    email: "test@test.com",
    address: "test address",
    phone: 123123123123
  });
});

test("login without password", async t => {
  const app = build(t);

  const res1 = await app.inject({
    url: "/login",
    method: "POST",
    body: {
      email: "test@test.com"
    }
  });

  t.deepEqual(res1.statusCode, 400);
  t.match(JSON.parse(res1.body), {
    statusCode: 400,
    error: "Bad Request",
    message: "body should have required property 'password'"
  });
});

test("login without email", async t => {
  const app = build(t);

  const res1 = await app.inject({
    url: "/login",
    method: "POST",
    body: {
      password: "aaaaa"
    }
  });

  t.deepEqual(res1.statusCode, 400);
  t.match(JSON.parse(res1.body), {
    statusCode: 400,
    error: "Bad Request",
    message: "body should have required property 'email'"
  });
});

test("signup and login with fb when email is empty", async t => {
  const app = build(t);

  const res1 = await app.inject({
    url: "/login/fb",
    method: "POST",
    body: {
      token: "OK_TOKEN_EMAIL_EMPTY"
    }
  });

  t.deepEqual(res1.statusCode, 400);
  t.match(JSON.parse(res1.body), {
    status: "not ok",
    message: "email is empty"
  });
});

test("signup and login with fb", async t => {
  const app = build(t);

  const res1 = await app.inject({
    url: "/login/fb",
    method: "POST",
    body: {
      token: "OK_TOKEN",
      email: "jd@gmail.com"
    }
  });

  t.deepEqual(res1.statusCode, 200);
  t.match(JSON.parse(res1.body), {
    message: "new user is created",
    status: "ok"
  });

  const res2 = await app.inject({
    url: "/login/fb",
    method: "POST",
    body: {
      token: "NOT_OK_TOKEN",
      email: "jd@gmail.com"
    }
  });

  t.deepEqual(res2.statusCode, 400);
  t.match(JSON.parse(res2.body), {
    error: {
      code: 190,
      type: "OAuthException",
      message: "Invalid OAuth access token."
    }
  });

  const res3 = await app.inject({
    url: "/login/fb",
    method: "POST",
    body: {
      token: "EXPIRED_TOKEN",
      email: "jd@gmail.com"
    }
  });

  t.deepEqual(res3.statusCode, 400);
  t.match(JSON.parse(res3.body), {
    error: {
      code: 190,
      type: "OAuthException",
      error_subcode: 463,
      message: "Error validating access token: Session has expired."
    }
  });

  const res4 = await app.inject({
    url: "/login/fb",
    method: "POST",
    body: {
      token: "OK_TOKEN",
      email: "jd@gmail.com"
    }
  });

  t.deepEqual(res4.statusCode, 200);
  t.match(JSON.parse(res4.body), {
    message: "login via fb",
    status: "ok"
  });
});

test("email confirmation process", async t => {
  const app = build(t);

  const res1 = await app.inject({
    url: "/signup",
    method: "POST",
    body: users.first
  });

  t.deepEqual(res1.statusCode, 200);
  t.match(JSON.parse(res1.body), { status: "ok" });

  const res2 = await app.inject({
    url: "/email-confirmation",
    method: "POST",
    body: {
      email: "test@test.com"
    }
  });

  t.deepEqual(res2.statusCode, 200);
  t.match(JSON.parse(res2.body), {
    message: "verification code is created",
    email: "test@test.com"
  });

  const res3 = await app.inject({
    url: "/email-confirmation",
    method: "POST",
    body: {}
  });

  t.deepEqual(res3.statusCode, 400);
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

  t.deepEqual(res4.statusCode, 200);
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

  t.deepEqual(res5.statusCode, 400);
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

  t.deepEqual(res6.statusCode, 400);
  t.match(JSON.parse(res6.body), {
    email: "test@test.com",
    message: "validation code is incorrect"
  });
});
