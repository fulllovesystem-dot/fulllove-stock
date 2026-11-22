import { useMemo, useState } from "react";
import {
  Package,
  PackagePlus,
  PackageMinus,
  ClipboardList,
  Plus,
  Trash2,
  Pencil,
  Printer,
  Search,
  X,
  History,
  Users,
  BookOpen,
  KeyRound,
} from "lucide-react";
import {
  CATEGORIES,
  SUBCATEGORIES,
  fmtMoney,
  today,
  round,
  useInventory,
  addItem,
  updateItem,
  deleteItem,
  addMovement,
  updateMovement,
  deleteMovement,
} from "./data";
import { printListing, printSimpleListing, printMovements, printReport } from "./print";
import HistoryTab from "./History";
import AccountsTab from "./Accounts";
import ChangePassword from "./ChangePassword";
import ItemDetail from "./ItemDetail";
import ItemsTab, { ItemsLock } from "./ItemsTab";

// 写入失败时提醒（例如没网络）
async function run(fn) {
  try {
    const r = await fn();
    return r ?? true;
  } catch (e) {
    alert("保存失败，请检查网络再试 / Save failed, please check your connection\n\n" + (e?.message || e));
    return false;
  }
}

export default function Inventory({ me, signOut }) {
  const { items, movements, loaded, error } = useInventory();
  const [tab, setTab] = useState("stock");
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [itemsUnlocked, setItemsUnlocked] = useState(false);

  const itemName = (id) => items.find((i) => i.id === id)?.name ?? "（已删除 / deleted）";

  // 每样货物现在的库存
  const stockMap = useMemo(() => {
    const map = {};
    items.forEach((i) => (map[i.id] = i.opening));
    movements.forEach((m) => {
      if (m.itemId in map) map[m.itemId] += m.type === "in" ? m.qty : -m.qty;
    });
    Object.keys(map).forEach((k) => (map[k] = round(map[k])));
    return map;
  }, [items, movements]);
  const stockOf = (item) => stockMap[item.id] ?? item.opening;

  const filteredItems = useMemo(
    () =>
      items
        .filter(
          (i) =>
            (activeCat === "all" || i.categoryId === activeCat) &&
            (i.name + (i.sub ?? "")).toLowerCase().includes(search.toLowerCase())
        )
        .sort(
          (a, b) =>
            a.categoryId.localeCompare(b.categoryId) ||
            (a.sub ?? "").localeCompare(b.sub ?? "", "zh") ||
            a.name.localeCompare(b.name, "zh")
        ),
    [items, activeCat, search]
  );

  const sortedAll = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          (a.sub ?? "").localeCompare(b.sub ?? "", "zh") || a.name.localeCompare(b.name, "zh")
      ),
    [items]
  );

  const totalValue = items.reduce((s, i) => s + stockOf(i) * i.price, 0);

  const actions = {
    addItem: (i) => run(() => addItem(me, i)),
    updateItem: (oldI, newI) => run(() => updateItem(me, oldI, newI)),
    deleteItem: (i) => run(() => deleteItem(me, i, movements)),
    addMovement: (m) => run(() => addMovement(me, m, itemName(m.itemId))),
    updateMovement: (oldM, newM) => run(() => updateMovement(me, oldM, newM, itemName(newM.itemId))),
    deleteMovement: (m) => run(() => deleteMovement(me, m, itemName(m.itemId))),
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800">
      <header className="bg-gradient-to-r from-rose-700 to-rose-600 text-white shadow-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">爱满天下 · 货物管理 / Inventory Management</h1>
            <p className="mt-1 text-sm text-rose-100">
              进出货记录 · 库存 · 每月结算 / Stock Movements · Inventory · Monthly Reports
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>
              👤 {me.name}
              {me.isAdmin ? "（管理员 / Admin）" : ""}
            </span>
            <button
              onClick={() => setShowPw(true)}
              className="flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 hover:bg-white/25"
            >
              <KeyRound size={14} /> 改密码 / Change PIN
            </button>
            <button onClick={signOut} className="rounded-lg bg-white/15 px-3 py-1.5 hover:bg-white/25">
              登出 / Sign out
            </button>
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          <TabBtn active={tab === "stock"} onClick={() => setTab("stock")} icon={<Package size={16} />} label="库存 / Stock" />
          {me.canManageItems && (
            <TabBtn active={tab === "items"} onClick={() => setTab("items")} icon={<BookOpen size={16} />} label="货物资料 / Items" />
          )}
          <TabBtn active={tab === "in"} onClick={() => setTab("in")} icon={<PackagePlus size={16} />} label="进货 / Stock In" />
          <TabBtn active={tab === "out"} onClick={() => setTab("out")} icon={<PackageMinus size={16} />} label="出货 / Stock Out" />
          <TabBtn active={tab === "report"} onClick={() => setTab("report")} icon={<ClipboardList size={16} />} label="月尾结算 / Monthly Report" />
          <TabBtn active={tab === "history"} onClick={() => setTab("history")} icon={<History size={16} />} label="修改记录 / Edit History" />
          {me.isAdmin && (
            <TabBtn active={tab === "accounts"} onClick={() => setTab("accounts")} icon={<Users size={16} />} label="员工账号 / Staff Accounts" />
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {(tab === "stock" || tab === "in" || tab === "out") && (
          <div className="mb-5 space-y-3">
            <div className="flex flex-wrap gap-2">
              <CatChip active={activeCat === "all"} onClick={() => setActiveCat("all")} label="全部 / All" />
              {CATEGORIES.map((c) => (
                <CatChip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} label={c.name} dot={c.color} />
              ))}
            </div>
            <div className="relative max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索货物名称 / Search items…"
                className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            读取资料失败 / Failed to load data：{error}
          </div>
        )}

        {!loaded && tab !== "history" && tab !== "accounts" ? (
          <div className="py-20 text-center text-sm text-stone-400">正在从云端读取资料… / Loading…</div>
        ) : (
          <>
            {tab === "stock" && (
              <StockTab
                items={filteredItems}
                allItems={sortedAll}
                stockOf={stockOf}
                movements={movements}
                totalValue={totalValue}
                activeCat={activeCat}
                onCatChange={setActiveCat}
                actions={actions}
                canManageItems={me.canManageItems}
                onGoItems={() => setTab("items")}
              />
            )}
            {(tab === "in" || tab === "out") && (
              <MovementTab
                key={tab}
                type={tab}
                items={filteredItems}
                allItems={items}
                movements={movements}
                stockOf={stockOf}
                actions={actions}
              />
            )}
            {tab === "report" && <ReportTab items={sortedAll} movements={movements} />}
            {tab === "items" &&
              me.canManageItems &&
              (itemsUnlocked ? (
                <ItemsTab allItems={items} movements={movements} stockOf={stockOf} actions={actions} />
              ) : (
                <ItemsLock me={me} onUnlock={() => setItemsUnlocked(true)} />
              ))}
            {tab === "history" && <HistoryTab itemName={itemName} />}
            {tab === "accounts" && me.isAdmin && <AccountsTab me={me} />}
          </>
        )}
      </main>

      {showPw && <ChangePassword isAdmin={me.isAdmin} onClose={() => setShowPw(false)} />}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
        active ? "border-rose-600 text-rose-700" : "border-transparent text-stone-500 hover:text-stone-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CatChip({ active, onClick, label, dot }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "border-rose-600 bg-rose-600 text-white" : "border-stone-300 bg-white text-stone-600 hover:border-rose-300"
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${active ? "bg-white" : dot}`} />}
      {label}
    </button>
  );
}

const fieldCls = "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400";

/* ---------------- 库存 Tab ---------------- */

function StockTab({ items, allItems, stockOf, movements, totalValue, activeCat, onCatChange, actions, canManageItems, onGoItems }) {
  const [detailId, setDetailId] = useState(null);
  const detailItem = allItems.find((i) => i.id === detailId);

  const catValues = CATEGORIES.map((c) => ({
    ...c,
    value: allItems.filter((i) => i.categoryId === c.id).reduce((s, i) => s + stockOf(i) * i.price, 0),
  }));

  return (
    <div>
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <ValueCard active={activeCat === "all"} onClick={() => onCatChange("all")} label="全部库存总价值 / All Departments" value={fmtMoney(totalValue)} highlight />
          {catValues.map((c) => (
            <ValueCard key={c.id} active={activeCat === c.id} onClick={() => onCatChange(c.id)} label={c.name} value={fmtMoney(c.value)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <OutlineBtn onClick={() => printSimpleListing(allItems, stockOf)}>
            <Printer size={16} /> 简易清单 / Simple List
          </OutlineBtn>
          <OutlineBtn onClick={() => printListing(allItems, movements, stockOf)}>
            <Printer size={16} /> 打印清单 / Print List
          </OutlineBtn>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          text={
            allItems.length === 0
              ? canManageItems
                ? "还没有货物，请到「货物资料」页面新增 / No items yet — add them in the Items page"
                : "还没有货物，请找负责的同事新增 / No items yet"
              : "没有符合条件的货物 / No matching items"
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3">货物 / Item</th>
                <th className="px-4 py-3">分类 / Department</th>
                <th className="px-4 py-3 text-right">单价 / Unit Price</th>
                <th className="px-4 py-3 text-right">库存 / Stock</th>
                <th className="px-4 py-3 text-right">库存价值 / Stock Value</th>
                <th className="px-4 py-3 text-right">进出货 / In · Out</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const cat = CATEGORIES.find((c) => c.id === i.categoryId);
                const stock = stockOf(i);
                return (
                  <tr key={i.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                    <td className="px-4 py-3 font-medium">
                      <button onClick={() => setDetailId(i.id)} className="text-left hover:text-rose-700 hover:underline">
                        {i.name}
                      </button>
                      {i.sub && <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-normal text-stone-500">{i.sub}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
                        <span className={`h-2 w-2 rounded-full ${cat?.color ?? "bg-stone-400"}`} />
                        {cat?.name ?? "其他 / Other"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-stone-600">{fmtMoney(i.price)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${stock <= 0 ? "text-red-600" : stock <= 5 ? "text-amber-600" : ""}`}>
                      {stock} {i.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-600">{fmtMoney(stock * i.price)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDetailId(i.id)}
                        className="whitespace-nowrap rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        进 / 出货 · In / Out
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detailItem && (
        <ItemDetail
          item={detailItem}
          movements={movements}
          stockOf={stockOf}
          actions={actions}
          onClose={() => setDetailId(null)}
          onEditItem={
            canManageItems
              ? () => {
                  setDetailId(null);
                  onGoItems();
                }
              : null
          }
        />
      )}
    </div>
  );
}

function ValueCard({ active, onClick, label, value, highlight }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-3 text-left shadow-sm transition-colors ${active ? "bg-rose-700 text-white" : "bg-white hover:bg-rose-50"}`}
    >
      <p className={`text-xs ${active ? "text-rose-100" : "text-stone-500"}`}>{label}</p>
      <p className={`text-xl font-bold ${active ? "text-white" : highlight ? "text-rose-700" : "text-stone-800"}`}>{value}</p>
    </button>
  );
}

function OutlineBtn({ onClick, children, small }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white font-medium text-stone-600 shadow-sm hover:border-rose-300 hover:text-rose-700 ${
        small ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------------- 进货 / 出货 Tab ---------------- */

function MovementTab({ type, items, allItems, movements, stockOf, actions }) {
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [month, setMonth] = useState(today().slice(0, 7));

  const isIn = type === "in";
  const visibleIds = new Set(items.map((i) => i.id));
  const list = movements
    .filter((m) => m.type === type && (!month || m.date.startsWith(month)))
    // 跟上面的分类 / 搜索一起过滤
    .filter((m) => visibleIds.has(m.itemId))
    .sort((a, b) => b.date.localeCompare(a.date));

  const selected = allItems.find((i) => i.id === itemId);

  const resetForm = () => {
    setEditing(null);
    setItemId("");
    setQty("");
    setNote("");
    setDate(today());
  };

  const openEdit = (m) => {
    setEditing(m);
    setItemId(m.itemId);
    setQty(String(m.qty));
    setDate(m.date);
    setNote(m.note);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    const item = allItems.find((i) => i.id === itemId);
    const q = parseFloat(qty);
    if (!item) return alert("请选择货物 / Please select an item");
    if (!q || q <= 0) return alert("请填数量 / Please enter a quantity");
    if (!date) return alert("请选日期 / Please pick a date");
    if (busy) return;
    const fields = { itemId: item.id, type, qty: q, price: item.price, date, note: note.trim() };
    setBusy(true);
    const ok = editing ? await actions.updateMovement(editing, { ...editing, ...fields }) : await actions.addMovement(fields);
    setBusy(false);
    if (ok) resetForm();
  };

  // 下拉选单：编辑时就算货物不在目前的分类里，也要显示
  const options = selected && !items.some((i) => i.id === selected.id) ? [selected, ...items] : items;

  return (
    <div>
      <div className={`mb-5 rounded-xl border p-4 shadow-sm ${isIn ? "border-emerald-200 bg-emerald-50" : "border-orange-200 bg-orange-50"}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">
            {editing
              ? isIn
                ? "修改进货记录 / Edit Stock In"
                : "修改出货记录 / Edit Stock Out"
              : isIn
              ? "登记进货 / Record Stock In"
              : "登记出货 / Record Stock Out"}
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={`${fieldCls} lg:col-span-2`}>
            <option value="">选择货物 / Select Item *</option>
            {CATEGORIES.map((c) => {
              const list = options.filter((i) => i.categoryId === c.id);
              if (list.length === 0) return null;
              return (
                <optgroup key={c.id} label={c.name}>
                  {list.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                      {i.sub ? ` · ${i.sub}` : ""}（{i.unit}）
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          <input value={qty} onChange={(e) => setQty(e.target.value)} type="number" min="0" step="any" placeholder="数量 / Quantity *" className={fieldCls} />
          <input aria-label="日期 / Date" value={date} onChange={(e) => setDate(e.target.value)} type="date" className={fieldCls} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注 / Notes (Supplier / Purpose)" className={fieldCls} />
        </div>
        {selected && (
          <p className="mt-2 text-xs text-stone-500">
            现在库存 / Current stock：<b>{stockOf(selected)} {selected.unit}</b> · 单价 / Unit price：{fmtMoney(selected.price)}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <button
            onClick={submit}
            disabled={busy}
            className={`rounded-lg px-5 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              isIn ? "bg-emerald-600 hover:bg-emerald-700" : "bg-orange-600 hover:bg-orange-700"
            }`}
          >
            {editing ? "保存修改 / Save Changes" : isIn ? "确认进货 / Confirm Stock In" : "确认出货 / Confirm Stock Out"}
          </button>
          {editing && (
            <button onClick={resetForm} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
              取消 / Cancel
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-stone-500">显示月份 / Show month：</span>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={fieldCls} />
        <button onClick={() => setMonth("")} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm hover:bg-stone-50">
          全部 / All
        </button>
        <span className="text-stone-400">共 {list.length} 笔 / records</span>
        <div className="ml-auto">
          <OutlineBtn small onClick={() => printMovements(type, list, allItems)}>
            <Printer size={14} /> {isIn ? "打印进货清单 / Print Stock In" : "打印出货清单 / Print Stock Out"}
          </OutlineBtn>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState text={isIn ? "还没有进货记录 / No stock in records" : "还没有出货记录 / No stock out records"} />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3">日期 / Date</th>
                <th className="px-4 py-3">货物 / Item</th>
                <th className="px-4 py-3 text-right">数量 / Quantity</th>
                {isIn && <th className="px-4 py-3 text-right">金额 / Amount</th>}
                <th className="px-4 py-3">备注 / Notes</th>
                <th className="px-4 py-3 text-right">操作 / Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => {
                const item = allItems.find((i) => i.id === m.itemId);
                return (
                  <tr key={m.id} className={`border-b border-stone-100 last:border-0 hover:bg-stone-50 ${editing?.id === m.id ? "bg-amber-50" : ""}`}>
                    <td className="px-4 py-3 text-stone-600">{m.date}</td>
                    <td className="px-4 py-3 font-medium">{item?.name ?? "（已删除 / Deleted）"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${isIn ? "text-emerald-700" : "text-orange-700"}`}>
                      {isIn ? "+" : "-"}
                      {m.qty} {item?.unit ?? ""}
                    </td>
                    {isIn && <td className="px-4 py-3 text-right font-medium">{fmtMoney(m.qty * m.price)}</td>}
                    <td className="px-4 py-3 text-stone-500">{m.note}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(m)} className="text-stone-400 hover:text-rose-600" title="修改 / Edit">
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`确定删除这笔记录？\nDelete this record?\n\n${m.date} · ${item?.name ?? ""} × ${m.qty}`)) actions.deleteMovement(m);
                          }}
                          className="text-stone-400 hover:text-red-600"
                          title="删除 / Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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

/* ---------------- 月尾结算 Tab ---------------- */

function ReportTab({ items, movements }) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(thisMonth);
  const [from, setFrom] = useState(`${thisMonth}-01`);
  const [to, setTo] = useState(today());

  const { rangeFrom, rangeTo } = useMemo(() => {
    if (mode === "month") {
      const [y, mo] = (month || thisMonth).split("-").map(Number);
      const lastDay = new Date(y, mo, 0).getDate();
      const m = month || thisMonth;
      return { rangeFrom: `${m}-01`, rangeTo: `${m}-${String(lastDay).padStart(2, "0")}` };
    }
    return { rangeFrom: from, rangeTo: to };
  }, [mode, month, from, to, thisMonth]);

  const rangeLabel = mode === "month" ? `${month} 月份报表 / Monthly Report` : `${rangeFrom} 至 / to ${rangeTo} 报表 / Report`;

  const rows = useMemo(
    () =>
      items.map((item) => {
        const mine = movements.filter((m) => m.itemId === item.id);
        const before = mine.filter((m) => m.date < rangeFrom);
        const during = mine.filter((m) => m.date >= rangeFrom && m.date <= rangeTo);
        const openStock = round(item.opening + before.reduce((s, m) => s + (m.type === "in" ? m.qty : -m.qty), 0));
        const ins = during.filter((m) => m.type === "in");
        const outs = during.filter((m) => m.type === "out");
        const inQty = round(ins.reduce((s, m) => s + m.qty, 0));
        const outQty = round(outs.reduce((s, m) => s + m.qty, 0));
        const inAmt = ins.reduce((s, m) => s + m.qty * m.price, 0);
        const outAmt = outs.reduce((s, m) => s + m.qty * m.price, 0);
        const closeStock = round(openStock + inQty - outQty);
        return { item, openStock, inQty, outQty, inAmt, outAmt, closeStock, closeValue: closeStock * item.price };
      }),
    [items, movements, rangeFrom, rangeTo]
  );

  const totals = rows.reduce(
    (t, r) => ({ inAmt: t.inAmt + r.inAmt, outAmt: t.outAmt + r.outAmt, closeValue: t.closeValue + r.closeValue }),
    { inAmt: 0, outAmt: 0, closeValue: 0 }
  );

  const groups = useMemo(() => {
    const gs = CATEGORIES.map((cat) => ({ cat, list: rows.filter((r) => r.item.categoryId === cat.id) })).filter((g) => g.list.length > 0);
    const other = rows.filter((r) => !CATEGORIES.some((c) => c.id === r.item.categoryId));
    if (other.length > 0) gs.push({ cat: { id: "other", name: "其他 / Other", color: "bg-stone-400" }, list: other });
    return gs;
  }, [rows]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-stone-300 bg-white p-0.5 text-sm">
          <button onClick={() => setMode("month")} className={`rounded-md px-3 py-1.5 font-medium ${mode === "month" ? "bg-rose-600 text-white" : "text-stone-500"}`}>
            按月份 / By Month
          </button>
          <button onClick={() => setMode("range")} className={`rounded-md px-3 py-1.5 font-medium ${mode === "range" ? "bg-rose-600 text-white" : "text-stone-500"}`}>
            选日期 / Date Range
          </button>
        </div>
        {mode === "month" ? (
          <input type="month" aria-label="月份 / Month" value={month} onChange={(e) => setMonth(e.target.value)} className={fieldCls} />
        ) : (
          <>
            <input type="date" aria-label="开始日期 / Start Date" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldCls} />
            <span className="text-stone-400">至 / to</span>
            <input type="date" aria-label="结束日期 / End Date" value={to} onChange={(e) => setTo(e.target.value)} className={fieldCls} />
          </>
        )}
        <button
          onClick={() => printReport(groups, totals, rangeLabel)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900"
        >
          <Printer size={16} /> 打印 / 存 PDF 报表 / Print or Save PDF
        </button>
      </div>

      <p className="mb-3 text-sm text-stone-500">{rangeLabel}</p>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="进货总额 / Total Stock In Value" value={fmtMoney(totals.inAmt)} accent="text-emerald-700" />
        <StatCard label="出货总额 / Total Stock Out Value" value={fmtMoney(totals.outAmt)} accent="text-orange-700" />
        <StatCard label="期末库存总价值 / Closing Inventory Value" value={fmtMoney(totals.closeValue)} accent="text-rose-700" />
      </div>

      {rows.length === 0 ? (
        <EmptyState text="还没有货物 / No items yet" />
      ) : (
        groups.map((g) => {
          const subIn = g.list.reduce((s, r) => s + r.inAmt, 0);
          const subOut = g.list.reduce((s, r) => s + r.outAmt, 0);
          const subVal = g.list.reduce((s, r) => s + r.closeValue, 0);
          return (
            <div key={g.cat.id} className="mb-6 overflow-x-auto rounded-xl bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${g.cat.color}`} />
                <h3 className="text-sm font-bold text-stone-700">{g.cat.name}</h3>
                <span className="text-xs text-stone-400">{g.list.length} 项货物 / items</span>
              </div>
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-3">货物 / Item</th>
                    <th className="px-4 py-3 text-right">单价 / Unit Price</th>
                    <th className="px-4 py-3 text-right">期初库存 / Opening Stock</th>
                    <th className="px-4 py-3 text-right">进货 / Stock In</th>
                    <th className="px-4 py-3 text-right">出货 / Stock Out</th>
                    <th className="px-4 py-3 text-right">期末库存 / Closing Stock</th>
                    <th className="px-4 py-3 text-right">期末价值 / Closing Value</th>
                  </tr>
                </thead>
                <tbody>
                  {g.list.map(({ item, openStock, inQty, outQty, closeStock, closeValue }) => (
                    <tr key={item.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-right">{fmtMoney(item.price)}</td>
                      <td className="px-4 py-3 text-right text-stone-600">
                        {openStock} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700">+{inQty}</td>
                      <td className="px-4 py-3 text-right text-orange-700">-{outQty}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${closeStock <= 0 ? "text-red-600" : ""}`}>
                        {closeStock} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{fmtMoney(closeValue)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-stone-200 bg-stone-50 text-xs font-semibold text-stone-600">
                    <td className="px-4 py-2.5">小计 / Subtotal</td>
                    <td></td>
                    <td></td>
                    <td className="px-4 py-2.5 text-right text-emerald-700">{fmtMoney(subIn)}</td>
                    <td className="px-4 py-2.5 text-right text-orange-700">{fmtMoney(subOut)}</td>
                    <td></td>
                    <td className="px-4 py-2.5 text-right">{fmtMoney(subVal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-xl bg-white px-5 py-4 shadow-sm">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

export function EmptyState({ text }) {
  return <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 py-16 text-center text-sm text-stone-400">{text}</div>;
}
