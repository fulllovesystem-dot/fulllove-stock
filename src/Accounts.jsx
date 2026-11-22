import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import { createStaff, resetStaffPin, setUserActive } from "./accounts";
import { inputCls } from "./ui";

export default function AccountsTab({ me }) {
  const [f, setF] = useState({ name: "", pin: "", role: "staff" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const [showOld, setShowOld] = useState(false);

  useEffect(
    () =>
      onSnapshot(collection(db, "users"), (s) =>
        setUsers(
          s.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || "", "zh"))
        )
      ),
    []
  );

  const isAdminRole = f.role === "admin";

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      await createStaff(f.name, f.pin, f.role);
      setMsg(`✅ 已开账号 / Created: ${f.name.trim()}`);
      setF({ name: "", pin: "", role: "staff" });
    } catch (x) {
      setMsg("❌ " + (x?.message || "Failed"));
    }
    setBusy(false);
  };

  const resetPin = async (u) => {
    const self = u.id === me.uid;
    const label = u.role === "admin" ? "新密码（至少 6 个字，可以是 6 个数字）/ New password (min 6)" : "新的 6 位数 PIN / New 6-digit PIN";
    const pin = prompt(`${self ? "换你自己的" : `帮「${u.displayName}」换`}${label}`);
    if (pin === null) return;
    try {
      await resetStaffPin(u, pin.trim());
      if (self) {
        alert(`✅ 已换好。现在会登出，请用「${u.displayName}」+ 新密码再登录一次 / Done, please sign in again`);
        await signOut(auth);
        return;
      }
      alert(`✅ 已换好，「${u.displayName}」可以用新的 PIN 登录了 / Done`);
    } catch (x) {
      alert("❌ " + (x?.message || "Failed"));
    }
  };

  const toggleActive = async (u) => {
    if (u.id === me.uid) return alert("不能停用自己 / You cannot disable yourself");
    const msgTxt = u.active
      ? `停用「${u.displayName}」？停用后他不能登录。\nDisable this account?`
      : `恢复「${u.displayName}」？\nRe-enable this account?`;
    if (!confirm(msgTxt)) return;
    try {
      await setUserActive(u, !u.active);
    } catch (x) {
      alert("❌ " + (x?.message || "Failed"));
    }
  };

  // 换过 PIN 的旧账号（replacedBy）默认不显示
  const visible = users.filter((u) => showOld || !u.replacedBy);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">开新账号 / New staff account</h2>
        <input className={inputCls} placeholder="名字 / Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value, pin: "" })}>
          <option value="staff">员工 / Staff</option>
          <option value="admin">管理员 / Admin（可以开账号 / can manage accounts）</option>
        </select>
        <input
          className={inputCls}
          inputMode={isAdminRole ? undefined : "numeric"}
          maxLength={isAdminRole ? 50 : 6}
          placeholder={isAdminRole ? "密码（至少 6 个字）/ Password (min 6)" : "PIN（6 个数字）/ PIN (6 digits)"}
          value={f.pin}
          onChange={(e) => setF({ ...f, pin: isAdminRole ? e.target.value : e.target.value.replace(/\D/g, "") })}
          required
        />
        <button disabled={busy} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
          {busy ? "建立中… / Creating…" : "建立 / Create"}
        </button>
        {msg && <p className="text-sm">{msg}</p>}
        <p className="text-xs text-stone-400">
          员工用「名字 + PIN」登录，名字不分大小写 / Staff sign in with name + PIN (name is not case-sensitive)
        </p>
      </form>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">全部账号 / All accounts</h2>
          <label className="flex items-center gap-1 text-xs text-stone-500">
            <input type="checkbox" checked={showOld} onChange={(e) => setShowOld(e.target.checked)} />
            显示旧记录 / Show old
          </label>
        </div>
        <ul className="divide-y divide-stone-100 text-sm">
          {visible.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className={u.active ? "" : "text-stone-400 line-through"}>
                {u.displayName}
                {u.role === "admin" && <span className="ml-1 rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-700">管理员 / Admin</span>}
                {u.id === me.uid && <span className="ml-1 text-xs text-stone-400">（你 / you）</span>}
                {u.replacedBy && <span className="ml-1 text-xs text-stone-400">（已换 PIN / PIN replaced）</span>}
              </span>
              {!u.replacedBy && (
                <span className="flex gap-2 text-xs">
                  <button onClick={() => resetPin(u)} className="rounded border border-stone-300 px-2 py-1 hover:bg-stone-50">
                    {u.id === me.uid ? "换我的密码 / Reset my password" : "换 PIN / Reset PIN"}
                  </button>
                  {u.id !== me.uid && (
                    <button onClick={() => toggleActive(u)} className="rounded border border-stone-300 px-2 py-1 hover:bg-stone-50">
                      {u.active ? "停用 / Disable" : "恢复 / Enable"}
                    </button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
