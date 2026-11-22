import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import { createStaff, resetStaffPin, setUserActive, setCanManageItems, setDepartments } from "./accounts";
import { CATEGORIES } from "./data";
import { inputCls } from "./ui";

export default function AccountsTab({ me }) {
  const [f, setF] = useState({ name: "", pin: "", role: "staff", departments: [] });
  const [editDept, setEditDept] = useState(null); // { id, departments }
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
      await createStaff(f.name, f.pin, f.role, f.departments);
      setMsg(`✅ 已开账号 / Created: ${f.name.trim()}`);
      setF({ name: "", pin: "", role: "staff", departments: [] });
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
        {!isAdminRole && (
          <div>
            <p className="mb-1 text-sm font-medium">负责部门（可以选多个）/ Departments *</p>
            <DeptPicker value={f.departments} onChange={(d) => setF({ ...f, departments: d })} />
            <p className="mt-1 text-xs text-stone-400">员工只看到这些部门的货物 / Staff only see items of these departments</p>
          </div>
        )}
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
            <li key={u.id} className="space-y-1.5 py-3">
              <div className={u.active ? "font-medium" : "text-stone-400 line-through"}>
                {u.displayName}
                {u.role === "admin" && <span className="ml-1 rounded bg-rose-100 px-1.5 py-0.5 text-xs font-normal text-rose-700">管理员 / Admin</span>}
                {u.id === me.uid && <span className="ml-1 text-xs font-normal text-stone-400">（你 / you）</span>}
                {u.replacedBy && <span className="ml-1 text-xs font-normal text-stone-400">（已换 PIN / PIN replaced）</span>}
              </div>
              {!u.replacedBy && (
                <>
                  {/* 部门 */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-stone-500">部门 / Dept：</span>
                    {u.role === "admin" || u.canManageItems ? (
                      <span className="text-stone-400">全部部门 / All</span>
                    ) : (u.departments ?? []).length === 0 ? (
                      <span className="text-amber-600">还没选 / None</span>
                    ) : (
                      (u.departments ?? []).map((d) => {
                        const c = CATEGORIES.find((x) => x.id === d);
                        return c ? (
                          <span key={d} className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${c.color}`} />
                            {c.name.split(" / ")[0]}
                          </span>
                        ) : null;
                      })
                    )}
                    {u.role !== "admin" && (
                      <button
                        onClick={() => setEditDept(editDept?.id === u.id ? null : { id: u.id, departments: u.departments ?? [] })}
                        className="rounded border border-stone-300 px-2 py-0.5 hover:bg-stone-50"
                      >
                        改部门 / Edit
                      </button>
                    )}
                  </div>
                  {editDept?.id === u.id && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
                      <DeptPicker value={editDept.departments} onChange={(d) => setEditDept({ ...editDept, departments: d })} />
                      <div className="mt-2 flex gap-2 text-xs">
                        <button
                          onClick={async () => {
                            if (editDept.departments.length === 0) return alert("请选至少一个部门 / Pick at least one department");
                            try {
                              await setDepartments(u, editDept.departments);
                              setEditDept(null);
                            } catch (x) {
                              alert("❌ " + (x?.message || "Failed"));
                            }
                          }}
                          className="rounded bg-rose-600 px-3 py-1 font-medium text-white"
                        >
                          保存 / Save
                        </button>
                        <button onClick={() => setEditDept(null)} className="rounded border border-stone-300 bg-white px-3 py-1">
                          取消 / Cancel
                        </button>
                        <span className="self-center text-stone-400">员工要登出再登入才生效 / Takes effect after re-login</span>
                      </div>
                    </div>
                  )}
                  {/* 动作 */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {u.role === "admin" ? (
                      <span className="text-stone-400">可以看库存 · 管理货物 / Stock access ✓</span>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-1 rounded border border-stone-300 px-2 py-1 hover:bg-stone-50">
                        <input
                          type="checkbox"
                          checked={!!u.canManageItems}
                          onChange={async (e) => {
                            try {
                              await setCanManageItems(u, e.target.checked);
                            } catch (x) {
                              alert("❌ " + (x?.message || "Failed"));
                            }
                          }}
                        />
                        可以看库存 · 管理货物 / Stock access
                      </label>
                    )}
                    <button onClick={() => resetPin(u)} className="rounded border border-stone-300 px-2 py-1 hover:bg-stone-50">
                      {u.id === me.uid ? "换我的密码 / Reset my password" : "换 PIN / Reset PIN"}
                    </button>
                    {u.id !== me.uid && (
                      <button onClick={() => toggleActive(u)} className="rounded border border-stone-300 px-2 py-1 hover:bg-stone-50">
                        {u.active ? "停用 / Disable" : "恢复 / Enable"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DeptPicker({ value, onChange }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {CATEGORIES.map((c) => (
        <label
          key={c.id}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
            value.includes(c.id) ? "border-rose-400 bg-rose-50" : "border-stone-200 bg-white hover:bg-stone-50"
          }`}
        >
          <input type="checkbox" checked={value.includes(c.id)} onChange={() => toggle(c.id)} />
          <span className={`h-2 w-2 rounded-full ${c.color}`} />
          {c.name}
        </label>
      ))}
    </div>
  );
}
