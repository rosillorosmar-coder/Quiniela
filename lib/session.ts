import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const USER_COOKIE = "qm_user";
const ADMIN_COOKIE = "qm_admin";
const MAX_AGE = 60 * 60 * 24 * 45;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("Falta SESSION_SECRET.");
  return value;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function pack(value: string) {
  return `${value}.${sign(value)}`;
}

function unpack(payload?: string) {
  if (!payload) return null;

  const separator = payload.lastIndexOf(".");
  if (separator < 1) return null;

  const value = payload.slice(0, separator);
  const signature = payload.slice(separator + 1);
  const expected = sign(value);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  return value;
}

export async function setUserSession(userId: string) {
  const store = await cookies();
  store.set(USER_COOKIE, pack(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE
  });
}

export async function getUserIdFromSession() {
  const store = await cookies();
  return unpack(store.get(USER_COOKIE)?.value);
}

export async function clearUserSession() {
  const store = await cookies();
  store.delete(USER_COOKIE);
}

export async function setAdminSession() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, pack("admin"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE
  });
}

export async function isAdminSession() {
  const store = await cookies();
  return unpack(store.get(ADMIN_COOKIE)?.value) === "admin";
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
