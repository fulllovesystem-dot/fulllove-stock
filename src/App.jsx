import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { setupDone, loginWithName, createFirstAdmin } from "./accounts";
import Inventory from "./Inventory";
import { inputCls } from "./ui";


export default function App() {
  const [state, setStateRaw] = useState({ ready: false, me: null, needSetup: false, blocked: "" });
  const seq = useRef(0);
  const settingUp = useRef(false);

  // 只用最新一次读取的结果（避免旧的结果盖掉新的）
  const load = async (user) => {
    const my = ++seq.current;
    const setState = (v) => {
      if (my === seq.current) setStateRaw(v);
    };
    if (user && settingUp.current) return; // 正在建立管理员，等建好再读
    if (!user) {
      let needSetup = false;
      try {
        needSetup = !(await setupDone());
      } catch {
        /* 读不到就当已经设定好，显示登录 */
      }
      setState({ ready: true, me: null, needSetup, blocked: "" });
      return;
    }
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        setState({ ready: true, me: null, needSetup: false, blocked: "这个账号还没开通 / This account is not set up" });
        return;
      }
      const u = snap.data();
      if (!u.active) {
        await signOut(auth);
        setState({ ready: true, me: null, needSetup: false, blocked: "这个账号已经停用 / This account is disabled" });
        return;
      }
      setState({
        ready: true,
        needSetup: false,
        blocked: "",
        me: { uid: user.uid, name: u.displayName, role: u.role, isAdmin: u.role === "admin" },
      });
    } catch (e) {
      setState({ ready: true, me: null, needSetup: false, blocked: "读取账号失败 / Failed to load account: " + (e?.message || e) });
    }
  };

  useEffect(() => onAuthStateChanged(auth, (u) => load(u)), []);

  if (!state.ready) return <div className="py-20 text-center text-sm text-stone-400">Loading…</div>;
  if (state.me) return <Inventory me={state.me} signOut={() => signOut(auth)} />;
  if (state.needSetup)
    return (
      <SetupForm
        onStart={() => (settingUp.current = true)}
        onDone={() => {
          settingUp.current = false;
          return load(auth.currentUser);
        }}
      />
    );
  return (
    <LoginForm
      notice={state.blocked}
      onSignOut={auth.currentUser ? () => signOut(auth) : null}
    />
  );
}

function Shell({ title, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-md">
        <h1 className="text-xl font-bold text-rose-700">爱满天下 · 货物管理</h1>
        <p className="mb-5 text-sm text-stone-500">{title}</p>
        {children}
      </div>
    </div>
  );
}

function LoginForm({ notice, onSignOut }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await loginWithName(name, pin);
    } catch (x) {
      setErr(x?.message || "登录失败 / Sign in failed");
    }
    setBusy(false);
  };

  return (
    <Shell title="员工登录 / Staff Login">
      {notice && (
        <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {notice}
          {onSignOut && (
            <button onClick={onSignOut} className="ml-2 underline">
              登出 / Sign out
            </button>
          )}
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        <input
          className={inputCls}
          placeholder="名字 / Name"
          autoComplete="username"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className={inputCls}
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          placeholder="6 位数 PIN / 6-digit PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          required
        />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {busy ? "登录中… / Signing in…" : "登录 / Sign in"}
        </button>
        <p className="text-xs text-stone-400">
          没有账号或忘记 PIN，请找管理员 / Ask the admin for an account or a new PIN
        </p>
      </form>
    </Shell>
  );
}

function SetupForm({ onStart, onDone }) {
  const [f, setF] = useState({ name: "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (f.password !== f.confirm) {
      setErr("两次密码不一样 / Passwords do not match");
      return;
    }
    setBusy(true);
    onStart();
    try {
      await createFirstAdmin(f.name, f.password);
    } catch (x) {
      setErr(x?.message || "Failed");
    }
    setBusy(false);
    await onDone();
  };

  return (
    <Shell title="第一次使用：建立管理员账号 / First time: create admin account">
      <form onSubmit={submit} className="space-y-3">
        <input
          className={inputCls}
          placeholder="管理员名字 / Admin name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          required
        />
        <input
          className={inputCls}
          type="password"
          placeholder="密码（至少 6 个字）/ Password (min 6)"
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
          required
        />
        <input
          className={inputCls}
          type="password"
          placeholder="再输入一次密码 / Confirm password"
          value={f.confirm}
          onChange={(e) => setF({ ...f, confirm: e.target.value })}
          required
        />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          建立 / Create
        </button>
        <p className="text-xs text-stone-400">以后用这个名字和密码登录 / Sign in later with this name and password</p>
      </form>
    </Shell>
  );
}
