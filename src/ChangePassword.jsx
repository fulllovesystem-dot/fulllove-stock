import { useState } from "react";
import { changeOwnPassword } from "./accounts";
import { inputCls } from "./ui";

export default function ChangePassword({ isAdmin, onClose }) {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const clean = (v) => (isAdmin ? v : v.replace(/\D/g, ""));

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (f.next !== f.confirm) return setMsg("两次输入不一样 / They do not match");
    setBusy(true);
    try {
      await changeOwnPassword(f.current, f.next, isAdmin);
      setDone(true);
    } catch (x) {
      setMsg(x?.message || "Failed");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-semibold">{isAdmin ? "改密码 / Change password" : "改 PIN / Change PIN"}</h2>
        {done ? (
          <>
            <p className="mb-4 text-sm text-emerald-700">✅ 已经改好了，下次用新的登录 / Changed</p>
            <button onClick={onClose} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white">
              关闭 / Close
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input className={inputCls} type="password" inputMode={isAdmin ? undefined : "numeric"} placeholder="现在的 / Current" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required />
            <input
              className={inputCls}
              type="password"
              inputMode={isAdmin ? undefined : "numeric"}
              maxLength={isAdmin ? 50 : 6}
              placeholder={isAdmin ? "新密码（至少 6 个字）/ New (min 6)" : "新 PIN（6 个数字）/ New 6-digit PIN"}
              value={f.next}
              onChange={(e) => setF({ ...f, next: clean(e.target.value) })}
              required
            />
            <input
              className={inputCls}
              type="password"
              inputMode={isAdmin ? undefined : "numeric"}
              maxLength={isAdmin ? 50 : 6}
              placeholder="再输入一次 / Confirm"
              value={f.confirm}
              onChange={(e) => setF({ ...f, confirm: clean(e.target.value) })}
              required
            />
            {msg && <p className="text-sm text-rose-600">{msg}</p>}
            <div className="flex gap-2">
              <button disabled={busy} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                保存 / Save
              </button>
              <button type="button" onClick={onClose} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">
                取消 / Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
