import { useMemo, useState } from "react";
import { Printer, AlertTriangle } from "lucide-react";
import { CATEGORIES, round, today } from "./data";
import { printRestock } from "./print";

// 日期工具（用本地时间）
function toStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parse(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
// 一个星期 = 星期六 到 星期五
export function weekOf(dateStr) {
  const d = parse(dateStr);
  const back = (d.getDay() + 1) % 7; // 星期六 = 0
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { start: toStr(start), end: toStr(end) };
}

// 每样货物：到某一天为止的库存、这个星期进 / 出多少、要不要补货
export function restockRows(items, movements, start, end) {
  return items.map((item) => {
    const mine = movements.filter((m) => m.itemId === item.id);
    const upTo = mine.filter((m) => m.date <= end);
    const stock = round(item.opening + upTo.reduce((s, m) => s + (m.type === "in" ? m.qty : -m.qty), 0));
    const week = mine.filter((m) => m.date >= start && m.date <= end);
    const weekIn = round(week.filter((m) => m.type === "in").reduce((s, m) => s + m.qty, 0));
    const weekOut = round(week.filter((m) => m.type === "out").reduce((s, m) => s + m.qty, 0));
    const min = item.minStock || 0;
    // 建议进货：够下个星期用（照这个星期的用量），而且还留着最低库存
    const suggest = min > 0 || weekOut > 0 ? Math.max(0, Math.ceil(round(weekOut + min - stock))) : 0;
    // 从来没进过货、也没设最低库存的货物：还没开始用，不算「没货」
    const started = mine.length > 0 || item.opening !== 0 || min > 0;
    const status = stock <= 0 ? (started ? "out" : "new") : min > 0 && stock <= min ? "low" : "ok";
    return { item, stock, weekIn, weekOut, min, suggest, status, need: status === "out" || status === "low" || suggest > 0 };
  });
}

export default function RestockTab({ items, movements }) {
  const t = today();
  const [day, setDay] = useState(t);
  const [onlyNeed, setOnlyNeed] = useState(true);
  const { start, end } = weekOf(day);
  const asOf = end > t ? t : end; // 这个星期还没过完：库存算到今天

  const rows = useMemo(() => restockRows(items, movements, start, asOf), [items, movements, start, asOf]);

  const groups = CATEGORIES.map((cat) => {
    const all = rows.filter((r) => r.item.categoryId === cat.id);
    return {
      cat,
      total: all.length,
      needCount: all.filter((r) => r.need).length,
      list: (onlyNeed ? all.filter((r) => r.need) : all).sort(
        (a, b) => (a.status === "out" ? 0 : a.status === "low" ? 1 : 2) - (b.status === "out" ? 0 : b.status === "low" ? 1 : 2) || a.item.name.localeCompare(b.item.name, "zh")
      ),
    };
  }).filter((g) => g.total > 0);

  const needTotal = rows.filter((r) => r.need).length;
  const noMin = rows.filter((r) => !r.min).length;
  const label = `${start}（六 Sat）至 / to ${end}（五 Fri）`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold">每周补货报告 / Weekly Restock Report</h2>
          <p className="text-sm text-stone-500">{label}</p>
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm">
          选星期 / Week：
          <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" />
        </label>
        <button
          onClick={() => printRestock(groups, label, asOf, onlyNeed)}
          className="flex items-center gap-1.5 rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900"
        >
          <Printer size={16} /> 打印 / 存 PDF / Print or PDF
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${needTotal ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {needTotal ? <AlertTriangle size={18} /> : "✅"}
          {needTotal ? `有 ${needTotal} 样货物要进货 / ${needTotal} items to restock` : "全部货物都够 / Everything is stocked"}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyNeed} onChange={(e) => setOnlyNeed(e.target.checked)} />
          只显示要进货的 / Only items to restock
        </label>
      </div>

      {noMin > 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          有 {noMin} 样货物还没设「最低库存」，系统只能在库存用完时才提醒。请到「货物资料」帮它们设好 / {noMin} items have no minimum stock set — set it in the Items page
        </p>
      )}

      {groups.map((g) => (
        <div key={g.cat.id} className="mb-5 overflow-x-auto rounded-xl bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2.5">
            <span className={`h-2.5 w-2.5 rounded-full ${g.cat.color}`} />
            <h3 className="text-sm font-bold text-stone-700">{g.cat.name}</h3>
            <span className={`text-xs ${g.needCount ? "font-semibold text-red-600" : "text-stone-400"}`}>
              {g.needCount ? `${g.needCount} 样要进货 / to restock` : "都够 / OK"}
            </span>
          </div>
          {g.list.length === 0 ? (
            <p className="px-4 py-4 text-sm text-stone-400">这个部门不用进货 / Nothing to restock</p>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-2.5">货物 / Item</th>
                  <th className="px-4 py-2.5 text-right">现在库存 / Stock</th>
                  <th className="px-4 py-2.5 text-right">最低库存 / Min</th>
                  <th className="px-4 py-2.5 text-right">本周进货 / In</th>
                  <th className="px-4 py-2.5 text-right">本周用量 / Used</th>
                  <th className="px-4 py-2.5 text-right">建议进货 / Buy</th>
                  <th className="px-4 py-2.5">状态 / Status</th>
                </tr>
              </thead>
              <tbody>
                {g.list.map((r) => (
                  <tr key={r.item.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium">
                      {r.item.name}
                      {r.item.sub && <span className="ml-2 text-xs font-normal text-stone-400">{r.item.sub}</span>}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${r.status === "ok" ? "" : "text-red-600"}`}>
                      {r.stock} {r.item.unit}
                    </td>
                    <td className="px-4 py-2.5 text-right text-stone-500">{r.min || "—"}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-700">{r.weekIn || "—"}</td>
                    <td className="px-4 py-2.5 text-right text-orange-700">{r.weekOut || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-rose-700">{r.suggest ? `${r.suggest} ${r.item.unit}` : "—"}</td>
                    <td className="px-4 py-2.5">
                      {r.status === "out" ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">没货了 / Out</span>
                      ) : r.status === "low" ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">不够 / Low</span>
                      ) : r.status === "new" ? (
                        <span className="text-xs text-stone-400">还没进过货 / Not started</span>
                      ) : r.suggest ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">下周可能不够 / May run low</span>
                      ) : (
                        <span className="text-xs text-stone-400">够 / OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      <p className="text-xs text-stone-400">
        建议进货 = 本周用量 + 最低库存 − 现在库存（够下个星期用）/ Suggested = weekly usage + min stock − current stock
      </p>
    </div>
  );
}
