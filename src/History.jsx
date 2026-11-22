import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import { today } from "./data";

const ACTION = { INSERT: "新增 / Added", UPDATE: "修改 / Edited", DELETE: "删除 / Deleted" };
const FIELD = {
  name: "名称 / Name",
  sub: "小分类 / Sub",
  unit: "单位 / Unit",
  price: "单价 / Price",
  opening: "库存 / Stock",
  minStock: "最低库存 / Min stock",
  categoryId: "分类 / Category",
  qty: "数量 / Qty",
  date: "日期 / Date",
  note: "备注 / Note",
  type: "类型 / Type",
  itemName: "货物 / Item",
};

export default function HistoryTab({ itemName, allowed = () => true }) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [day, setDay] = useState(today());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoaded(false);
      setErr("");
      try {
        const col = collection(db, "audit_log");
        let q;
        if (day) {
          const start = new Date(`${day}T00:00:00`);
          const end = new Date(start.getTime() + 86400000);
          q = query(
            col,
            where("createdAt", ">=", Timestamp.fromDate(start)),
            where("createdAt", "<", Timestamp.fromDate(end)),
            orderBy("createdAt", "desc")
          );
        } else {
          q = query(col, orderBy("createdAt", "desc"), limit(1000));
        }
        const snap = await getDocs(q);
        if (!cancelled) setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        if (!cancelled) setErr(e?.message || String(e));
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [day]);

  const shown = rows.filter(allowed);

  const describe = (r) => {
    const d = r.newData ?? r.oldData ?? {};
    const what =
      r.table === "items"
        ? `货物 / Item：${d.name ?? ""}`
        : `${d.type === "in" ? "进货 / In" : "出货 / Out"}：${d.itemName ?? itemName(d.itemId)} × ${d.qty ?? ""}（${d.date ?? ""}）`;
    let changes = "";
    if (r.action === "UPDATE" && r.oldData && r.newData) {
      changes = Object.keys(FIELD)
        .filter((k) => k in r.newData && String(r.oldData[k] ?? "") !== String(r.newData[k] ?? ""))
        .map((k) => `${FIELD[k]}: ${String(r.oldData[k] ?? "")} → ${String(r.newData[k] ?? "")}`)
        .join("；");
    }
    return { what, changes };
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 text-sm shadow-sm">
        <span className="font-medium">选日期 / Pick date：</span>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1" />
        <button onClick={() => setDay("")} className="rounded-lg border border-stone-300 px-3 py-1 hover:bg-stone-50">
          全部（最近 1000 条）/ All (latest 1000)
        </button>
        <span className="text-stone-500">共 {shown.length} 条 / records · 记录永久保存，不能删除 / Permanent, cannot be deleted</span>
      </div>
      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {!loaded ? (
        <div className="py-20 text-center text-sm text-stone-400">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-stone-500">
              <tr>
                <th className="px-3 py-2">时间 / Time</th>
                <th className="px-3 py-2">谁 / Who</th>
                <th className="px-3 py-2">动作 / Action</th>
                <th className="px-3 py-2">内容 / Details</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-stone-400">
                    还没有记录 / No history yet
                  </td>
                </tr>
              )}
              {shown.map((r) => {
                const { what, changes } = describe(r);
                return (
                  <tr key={r.id} className="border-t border-stone-100 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-stone-500">
                      {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString("zh-CN") : "…"}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.userName ?? "—"}</td>
                    <td className="px-3 py-2">{ACTION[r.action] ?? r.action}</td>
                    <td className="px-3 py-2">
                      <div>{what}</div>
                      {changes && <div className="text-xs text-amber-700">{changes}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
