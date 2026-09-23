import { jwtDecode } from "jwt-decode";

interface userJWTPayload {
  uuid: string;
  "https://hasura.io/jwt/claims": {
    "x-hasura-allowed-roles": string[];
    "x-hasura-default-role": string;
  };
}

export interface user {
  username: string;
  uuid: string;
}

const getUser = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  let payload: userJWTPayload;
  try {
    payload = jwtDecode(token);
  } catch (error) {
    console.warn("本地登录令牌无效，已退出登录", error);
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    return null;
  }

  const username = localStorage.getItem("username");
  if (!username) return null;
  const user: user = {
    username: username,
    uuid: payload.uuid,
  };
  return user;
};

export default getUser;
