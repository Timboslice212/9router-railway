import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || '/source';
function replaceOnce(file, before, after) {
  const target = path.join(root, file);
  const source = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
  if (source.split(before).length !== 2) throw new Error(`Upstream changed: review ${file}`);
  fs.writeFileSync(target, source.replace(before, after));
}

replaceOnce('src/app/api/auth/login/route.js',
  'import { isLocalRequest } from "@/dashboardGuard";',
  'import { setBootstrapCookie } from "@/lib/auth/railwayBootstrap";');
replaceOnce('src/app/api/auth/login/route.js',
  '!storedHash && !process.env.INITIAL_PASSWORD && !isLocalRequest(request);',
  '!storedHash && (process.env.INITIAL_PASSWORD || "123456") === "123456";');
const loginFile = path.join(root, 'src/app/api/auth/login/route.js');
let login = fs.readFileSync(loginFile, 'utf8');
const begin = login.indexOf('      if (mustChangePassword) {');
const end = login.indexOf('\n      const cookieStore = await cookies();', begin);
if (begin < 0 || end < 0) throw new Error('Upstream login flow changed; review bootstrap patch');
login = login.slice(0, begin) + `      if (mustChangePassword) {
        // Limited first-run capability: never issue dashboard auth before rotation.
        const cookieStore = await cookies();
        cookieStore.delete("auth_token");
        await setBootstrapCookie(cookieStore, request);
        return NextResponse.json({ success: true, mustChangePassword: true }, { headers: NO_STORE_HEADERS });
      }
` + login.slice(end);
fs.writeFileSync(loginFile, login);

replaceOnce('src/dashboardGuard.js', '  "/api/auth/status",',
  '  "/api/auth/status",\n  "/api/auth/setup-password",');
replaceOnce('src/app/login/page.js',
  'const res = await fetch("/api/settings", {\n        method: "PATCH",',
  'const res = await fetch("/api/auth/setup-password", {\n        method: "POST",');

const helper = `import { SignJWT, jwtVerify } from "jose";
import crypto from "node:crypto";
import { shouldUseSecureCookie } from "./dashboardSession";

function bootstrapKey() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required for first-run setup");
  // Separate key: a setup token cannot be renamed into an auth_token.
  return crypto.createHash("sha256").update("9router:bootstrap:v1:").update(process.env.JWT_SECRET).digest();
}
export async function setBootstrapCookie(cookieStore, request) {
  const token = await new SignJWT({ purpose: "password-setup" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(bootstrapKey());
  cookieStore.set("9r_bootstrap", token, { httpOnly: true, secure: shouldUseSecureCookie(request), sameSite: "strict", path: "/api/auth", maxAge: 600 });
}
export async function verifyBootstrapCookie(token) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, bootstrapKey(), { algorithms: ["HS256"] });
    return payload.purpose === "password-setup";
  } catch { return false; }
}
export function clearBootstrapCookie(cookieStore, request) {
  cookieStore.set("9r_bootstrap", "", { httpOnly: true, secure: shouldUseSecureCookie(request), sameSite: "strict", path: "/api/auth", maxAge: 0 });
}
`;
fs.writeFileSync(path.join(root, 'src/lib/auth/railwayBootstrap.js'), helper);

const routeDir = path.join(root, 'src/app/api/auth/setup-password');
fs.mkdirSync(routeDir, { recursive: true });
fs.writeFileSync(path.join(routeDir, 'route.js'), `import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getSettings } from "@/lib/localDb";
import { getAdapter } from "@/lib/db/driver";
import { parseJson, stringifyJson } from "@/lib/db/helpers/jsonCol";
import { verifyBootstrapCookie, clearBootstrapCookie } from "@/lib/auth/railwayBootstrap";
import { setDashboardAuthCookie } from "@/lib/auth/dashboardSession";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function POST(request) {
  try {
    const expectedOrigin = new URL(process.env.BASE_URL || request.url).origin;
    if (request.headers.get("origin") !== expectedOrigin) return NextResponse.json({ error: "Invalid setup origin" }, { status: 403, headers });
    const cookieStore = await cookies();
    if (!(await verifyBootstrapCookie(cookieStore.get("9r_bootstrap")?.value))) return NextResponse.json({ error: "Sign in with the initial password to start setup" }, { status: 401, headers });
    if ((process.env.INITIAL_PASSWORD || "123456") !== "123456") return NextResponse.json({ error: "Default-password setup is unavailable" }, { status: 409, headers });
    const { newPassword } = await request.json();
    if (typeof newPassword !== "string" || newPassword.trim().length < 8 || Buffer.byteLength(newPassword, "utf8") > 72 || newPassword === "123456") return NextResponse.json({ error: "Choose a new password of at least 8 characters, up to 72 UTF-8 bytes" }, { status: 400, headers });
    if ((await getSettings()).password) return NextResponse.json({ error: "Password is already configured; sign in normally" }, { status: 409, headers });
    const hash = await bcrypt.hash(newPassword, 12);
    const db = await getAdapter();
    // Atomic compare-and-set: concurrent setup or replay cannot replace an existing password.
    const saved = db.transaction(() => {
      const row = db.get("SELECT data FROM settings WHERE id = 1");
      const current = row ? parseJson(row.data, {}) : {};
      if (current.password) return false;
      db.run("INSERT INTO settings(id, data) VALUES(1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data", [stringifyJson({ ...current, password: hash })]);
      return true;
    });
    if (!saved) return NextResponse.json({ error: "Password is already configured; sign in normally" }, { status: 409, headers });
    clearBootstrapCookie(cookieStore, request);
    await setDashboardAuthCookie(cookieStore, request);
    return NextResponse.json({ success: true }, { headers });
  } catch {
    return NextResponse.json({ error: "Password setup failed" }, { status: 500, headers });
  }
}
`);
console.log('Applied limited first-run password setup; application source otherwise unchanged.');

