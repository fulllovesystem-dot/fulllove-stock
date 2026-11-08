import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { doc, getDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { auth, db, firebaseConfig } from "./firebase";

// 名字 → 登录用的 key（不分大小写、不管空格）
export function nameKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[/.#$[\]]/g, "_");
}

// Firebase 登录一定要 Email，所以每个账号配一个系统内部用的 Email（员工不用知道）
function newInternalEmail() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `u${Date.now().toString(36)}${rand}@fulllove-stock.app`;
}

export function validateName(name) {
  const n = String(name || "").trim();
  if (!n) throw new Error("请填名字 / Name required");
  if (n.length > 30) throw new Error("名字太长 / Name too long");
  return n;
}

export function validatePin(pin) {
  if (!/^\d{6}$/.test(String(pin || ""))) throw new Error("PIN 要是 6 个数字 / PIN must be 6 digits");
  return String(pin);
}

function validateAdminPassword(pw) {
  if (String(pw || "").length < 6) throw new Error("密码至少 6 个字 / Password min 6 characters");
  return String(pw);
}

// 第一次使用：有没有管理员了？
export async function setupDone() {
  const snap = await getDoc(doc(db, "meta", "setup"));
  return snap.exists();
}

// 登录：名字 + PIN / 密码
export async function loginWithName(name, pin) {
  const key = nameKey(name);
  if (!key) throw new Error("请填名字 / Name required");
  const snap = await getDoc(doc(db, "loginNames", key));
  if (!snap.exists()) throw new Error("名字或密码错误 / Wrong name or PIN");
  try {
    await signInWithEmailAndPassword(auth, snap.data().email, pin);
  } catch {
    throw new Error("名字或密码错误 / Wrong name or PIN");
  }
}

// 第一次使用：建立管理员
export async function createFirstAdmin(name, password) {
  const displayName = validateName(name);
  const pw = validateAdminPassword(password);
  if (await setupDone()) throw new Error("管理员已经存在 / Admin already exists");
  const email = newInternalEmail();
  const cred = await createUserWithEmailAndPassword(auth, email, pw);
  const uid = cred.user.uid;
  const key = nameKey(displayName);
  const b = writeBatch(db);
  b.set(doc(db, "meta", "setup"), { adminUid: uid, createdAt: serverTimestamp() });
  b.set(doc(db, "users", uid), {
    displayName,
    nameKey: key,
    role: "admin",
    active: true,
    email,
    createdAt: serverTimestamp(),
  });
  b.set(doc(db, "loginNames", key), { email, uid, displayName });
  await b.commit();
  return uid;
}

// 用另一个 Firebase 连线来开账号，这样管理员自己不会被登出
async function createAuthUserSeparately(email, password) {
  const tmp = initializeApp(firebaseConfig, `tmp-${Date.now()}`);
  try {
    const tmpAuth = getAuth(tmp);
    const cred = await createUserWithEmailAndPassword(tmpAuth, email, password);
    await signOut(tmpAuth);
    return cred.user.uid;
  } finally {
    await deleteApp(tmp);
  }
}

// 管理员开员工账号：名字 + 6 位数 PIN
export async function createStaff(name, pin, role = "staff") {
  const displayName = validateName(name);
  const password = role === "admin" ? validateAdminPassword(pin) : validatePin(pin);
  const key = nameKey(displayName);
  const existing = await getDoc(doc(db, "loginNames", key));
  if (existing.exists()) throw new Error("这个名字已经有账号了 / Name already used");
  const email = newInternalEmail();
  const uid = await createAuthUserSeparately(email, password);
  const b = writeBatch(db);
  b.set(doc(db, "users", uid), {
    displayName,
    nameKey: key,
    role,
    active: true,
    email,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid ?? null,
  });
  b.set(doc(db, "loginNames", key), { email, uid, displayName });
  await b.commit();
}

// 员工忘记 PIN：管理员帮他换一个新 PIN
// （网页不能直接改别人的密码，所以换成一个新的登录账号，名字不变，旧的停用）
export async function resetStaffPin(user, newPin) {
  const password = user.role === "admin" ? validateAdminPassword(newPin) : validatePin(newPin);
  const email = newInternalEmail();
  const uid = await createAuthUserSeparately(email, password);
  const b = writeBatch(db);
  b.set(doc(db, "users", uid), {
    displayName: user.displayName,
    nameKey: user.nameKey,
    role: user.role,
    active: true,
    email,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid ?? null,
    replaces: user.id,
  });
  b.update(doc(db, "users", user.id), { active: false, replacedBy: uid });
  b.set(doc(db, "loginNames", user.nameKey), { email, uid, displayName: user.displayName });
  await b.commit();
}

// 停用 / 恢复账号
export async function setUserActive(user, active) {
  const b = writeBatch(db);
  b.update(doc(db, "users", user.id), { active });
  await b.commit();
}

// 自己改密码 / PIN
export async function changeOwnPassword(currentPw, newPw, isAdmin) {
  const pw = isAdmin ? validateAdminPassword(newPw) : validatePin(newPw);
  const u = auth.currentUser;
  if (!u) throw new Error("请重新登录 / Please sign in again");
  try {
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, currentPw));
  } catch {
    throw new Error("现在的密码不对 / Current password is wrong");
  }
  await updatePassword(u, pw);
}
