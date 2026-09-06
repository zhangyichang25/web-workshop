import express from "express";
import jwt from "jsonwebtoken";
import { gql } from "graphql-request";
import { client, sdk as graphql } from "./index";
import authenticate from "./authenticate";
import { sendEmail } from "./email";

interface userJWTPayload {
  uuid: string;
  "https://hasura.io/jwt/claims": {
    "x-hasura-allowed-roles": string[];
    "x-hasura-default-role": string;
  };
}

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(422).send("422 Unprocessable Entity: Missing username or password");
  }
  try {
    const queryResult = await graphql.getUsersByUsername({ username: username });
    if (queryResult.user.length === 0) {
      return res.status(404).send("404 Not Found: User does not exist");
    }
    const user = queryResult.user[0];
    if (user.password !== password) {
      return res.status(401).send("401 Unauthorized: Password does not match");
    }
    const payload: userJWTPayload = {
      uuid: user.uuid,
      "https://hasura.io/jwt/claims": {
        "x-hasura-allowed-roles": ["admin", "user"],
        "x-hasura-default-role": "user",
      },
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: "24h",
    });
    return res.status(200).json({ token });
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

router.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(422).send("422 Unprocessable Entity: Missing username or password");
  }
  try {
    const queryResult = await graphql.getUsersByUsername({ username: username });
    if (queryResult.user.length !== 0) {
      return res.status(409).send("409 Conflict: User already exists");
    }
    const mutationResult = await graphql.addUser({ username: username, password: password });
    const payload: userJWTPayload = {
      uuid: mutationResult.insert_user_one?.uuid,
      "https://hasura.io/jwt/claims": {
        "x-hasura-allowed-roles": ["admin", "user"],
        "x-hasura-default-role": "user",
      },
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: "24h",
    });
    return res.status(200).json({ token });
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

router.post("/change-password/request", async (req, res) => {
  const { username } = req.body;
  if (typeof username !== "string" || !emailPattern.test(username)) {
    return res.status(422).send("422 Unprocessable Entity: Username must be an email");
  }
  try {
    const result = await graphql.getUsersByUsername({ username });
    if (result.user.length === 0) {
      return res.status(404).send("404 Not Found: User does not exist");
    }
    const token = jwt.sign(
      { uuid: result.user[0].uuid, purpose: "password-reset" },
      process.env.JWT_SECRET!,
      { expiresIn: "15m" },
    );
    const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
    const link = `${frontend.replace(/\/$/, "")}/#/change-password/action?token=${encodeURIComponent(token)}`;
    await sendEmail(username, "Web Workshop 密码重置", `请在 15 分钟内打开以下链接重置密码：\n${link}`);
    return res.send("Password reset email sent");
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

router.post("/change-password/action", async (req, res) => {
  const { token, newPassword } = req.body;
  if (typeof token !== "string" || typeof newPassword !== "string" || !newPassword) {
    return res.status(422).send("422 Unprocessable Entity: Missing token or newPassword");
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { uuid?: string; purpose?: string };
    if (!decoded.uuid || decoded.purpose !== "password-reset") {
      return res.status(401).send("401 Unauthorized: Token invalid");
    }
    const result = await client.request<{ update_user_by_pk: { uuid: string } | null }>(
      gql`
        mutation updatePassword($uuid: uuid!, $password: String!) {
          update_user_by_pk(pk_columns: {uuid: $uuid}, _set: {password: $password}) { uuid }
        }
      `,
      { uuid: decoded.uuid, password: newPassword },
    );
    if (!result.update_user_by_pk) {
      return res.status(404).send("404 Not Found: User does not exist");
    }
    return res.send("Password updated successfully");
  } catch (err) {
    console.error(err);
    return res.status(401).send("401 Unauthorized: Token expired or invalid");
  }
});

router.get("/delete", authenticate, async (_req, res) => {
  try {
    const result = await client.request<{ delete_user_by_pk: { uuid: string } | null }>(
      gql`
        mutation deleteUser($uuid: uuid!) {
          delete_user_by_pk(uuid: $uuid) { uuid }
        }
      `,
      { uuid: res.locals.userUuid },
    );
    if (!result.delete_user_by_pk) {
      return res.status(404).send("404 Not Found: User does not exist");
    }
    return res.send("User deleted successfully");
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

export default router;
