import { CATEGORIES, fmtMoney, today, round } from "./data";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function openPrint(html) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("浏览器挡住了弹出视窗，请允许弹出视窗 / Please allow pop-ups to print");
    return;
  }
  w.document.write(html);
  w.document.close();
}

const BASE_CSS = `
  body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:#333;padding:28px;}
  h1{font-size:18px;margin:0;} .sub-line{color:#777;font-size:12px;margin:4px 0 16px;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th,td{border:1px solid #bbb;padding:7px 8px;text-align:left;}
  th{background:#f5f0eb;} .r{text-align:right;}
  .foot{margin-top:20px;font-size:11px;color:#999;}
`;

// 打印库存清单：给厨房工作人员手填进货/出货，再输入电脑
export function printListing(allItems, movements, stockOf) {
  const sections = CATEGORIES.map((cat) => {
    const catItems = allItems.filter((i) => i.categoryId === cat.id);
    if (catItems.length === 0) return "";
    const rowsHtml = catItems
      .map((i) => {
        const ms = movements.filter((m) => m.itemId === i.id);
        const tin = round(ms.filter((m) => m.type === "in").reduce((s, m) => s + m.qty, 0));
        const tout = round(ms.filter((m) => m.type === "out").reduce((s, m) => s + m.qty, 0));
        return `<tr>
          <td>${esc(i.name)}${i.sub ? ` <span class="sub">(${esc(i.sub)})</span>` : ""}</td>
          <td>${esc(i.unit)}</td>
          <td class="r">${i.opening}</td>
          <td class="r">${tin || ""}</td>
          <td class="r">${tout || ""}</td>
          <td class="r"><b>${stockOf(i)}</b></td>
          <td class="w12"></td>
        </tr>`;
      })
      .join("");
    return `<tr class="cat"><td colspan="7">${esc(cat.name)}</td></tr>${rowsHtml}`;
  }).join("");
  openPrint(`<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>爱满天下 库存清单</title>
    <style>${BASE_CSS}
      .w12{width:12%;} .cat td{background:#efe9e3;font-weight:bold;}
      .sub{color:#999;font-size:11px;}
      .formula{margin-top:14px;font-size:12px;color:#555;font-weight:bold;}
    </style></head><body>
    <h1>爱满天下产后护理之家 · 库存清单 / Inventory List</h1>
    <p class="sub-line">打印日期 / Printed on: ${today()} · 已登记的进货 / 出货已自动印上 / Recorded stock movements included</p>
    <table><thead><tr>
      <th>货物名称 / Item Name</th><th>单位 / Unit</th><th class="r">库存 / Stock</th><th class="w12">进货 / Stock In</th><th class="w12">出货 / Stock Out</th><th class="w12">一共 / Total</th><th class="w12">备注 / Notes</th>
    </tr></thead><tbody>${sections}</tbody></table>
    <p class="formula">一共 = 库存 + 进货 − 出货 / Total = Opening Stock + Stock In − Stock Out</p>
    <p class="foot">填表人 / Prepared by: ________________　日期 / Date: ________________</p>
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
}

// 简易清单：只有货物名称 / 库存 / 进货 / 出货，按部门分页，每月打印给员工手填
export function printSimpleListing(allItems, stockOf) {
  const cats = CATEGORIES.filter((cat) => allItems.some((i) => i.categoryId === cat.id));
  const pages = cats
    .map((cat, idx) => {
      const rowsHtml = allItems
        .filter((i) => i.categoryId === cat.id)
        .map((i) => `<tr><td>${esc(i.name)}</td><td class="r">${stockOf(i)}</td><td></td><td></td></tr>`)
        .join("");
      return `<div class="page${idx > 0 ? " break" : ""}">
        <h1>${esc(cat.name)} · 月度清单 / Monthly List</h1>
        <p class="sub-line">月份 / Month: ____________　　打印日期 / Printed on: ${today()}</p>
        <table><thead><tr>
          <th>货物名称 / Item Name</th><th class="w20">库存 / Stock</th><th class="w20">进货 / Stock In</th><th class="w20">出货 / Stock Out</th>
        </tr></thead><tbody>${rowsHtml}</tbody></table>
        <p class="foot">填表人 / Prepared by: ________________　日期 / Date: ________________</p>
      </div>`;
    })
    .join("");
  openPrint(`<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>爱满天下 月度清单 / Monthly List</title>
    <style>${BASE_CSS}
      body{padding:0;margin:0;} .page{padding:28px;} .break{page-break-before:always;}
      th,td{padding:8px;} .w20{width:20%;}
    </style></head><body>
    ${pages}
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
}

// 打印进货 / 出货清单（含日期）
export function printMovements(type, list, items) {
  const isIn = type === "in";
  const title = isIn ? "进货清单 / Stock In List" : "出货清单 / Stock Out List";
  const rowsHtml = list
    .map((m) => {
      const item = items.find((i) => i.id === m.itemId);
      const cat = CATEGORIES.find((c) => c.id === item?.categoryId);
      return `<tr>
        <td>${esc(m.date)}</td>
        <td>${esc(item?.name ?? "（已删除 / Deleted）")}</td>
        <td>${esc(cat?.name ?? "")}</td>
        <td class="r">${m.qty} ${esc(item?.unit ?? "")}</td>
        ${isIn ? `<td class="r">${fmtMoney(m.qty * m.price)}</td>` : ""}
        <td>${esc(m.note)}</td>
      </tr>`;
    })
    .join("");
  const totalQty = round(list.reduce((s, m) => s + m.qty, 0));
  const totalAmt = list.reduce((s, m) => s + m.qty * m.price, 0);
  openPrint(`<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>爱满天下 ${title}</title>
    <style>${BASE_CSS} .total td{background:#f5f0eb;font-weight:bold;}</style></head><body>
    <h1>爱满天下产后护理之家 / Postnatal Care Centre · ${title}</h1>
    <p class="sub-line">打印日期 / Printed on: ${today()} · 共 ${list.length} 笔记录 / ${list.length} records</p>
    <table><thead><tr>
      <th>日期 / Date</th><th>货物名称 / Item Name</th><th>分类 / Department</th><th class="r">数量 / Quantity</th>${isIn ? '<th class="r">金额 / Amount</th>' : ""}<th>备注 / Notes</th>
    </tr></thead><tbody>${rowsHtml}
    <tr class="total"><td colspan="3">合计 / Total</td><td class="r">${totalQty}</td>${isIn ? `<td class="r">${fmtMoney(totalAmt)}</td>` : ""}<td></td></tr>
    </tbody></table>
    <p class="foot">填表人 / Prepared by: ________________　日期 / Date: ________________</p>
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
}

// 月尾结算报表（打印 / 存成 PDF）
export function printReport(groups, totals, rangeLabel) {
  const sections = groups
    .map((g, idx) => {
      const subIn = g.list.reduce((s, r) => s + r.inAmt, 0);
      const subOut = g.list.reduce((s, r) => s + r.outAmt, 0);
      const subVal = g.list.reduce((s, r) => s + r.closeValue, 0);
      const rowsHtml = g.list
        .map(
          ({ item, openStock, inQty, outQty, closeStock, closeValue }) => `<tr>
        <td>${esc(item.name)}</td>
        <td class="r">${fmtMoney(item.price)}</td>
        <td class="r">${openStock} ${esc(item.unit)}</td>
        <td class="r in">+${inQty}</td>
        <td class="r out">-${outQty}</td>
        <td class="r"><b>${closeStock} ${esc(item.unit)}</b></td>
        <td class="r">${fmtMoney(closeValue)}</td>
      </tr>`
        )
        .join("");
      return `<div class="section${idx > 0 ? " break" : ""}">
      <h2>${esc(g.cat.name)}</h2>
      <table><thead><tr>
        <th>货物 / Item</th><th class="r">单价 / Unit Price</th><th class="r">期初库存 / Opening Stock</th><th class="r">进货 / Stock In</th><th class="r">出货 / Stock Out</th><th class="r">期末库存 / Closing Stock</th><th class="r">期末价值 / Closing Value</th>
      </tr></thead><tbody>${rowsHtml}
      <tr class="total"><td>小计（进货 / 出货为金额） / Subtotal (Movement Value)</td><td></td><td></td><td class="r in">${fmtMoney(subIn)}</td><td class="r out">${fmtMoney(subOut)}</td><td></td><td class="r">${fmtMoney(subVal)}</td></tr>
      </tbody></table>
    </div>`;
    })
    .join("");
  openPrint(`<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>爱满天下 库存报表 ${esc(rangeLabel)}</title>
    <style>
      body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:#333;padding:32px;}
      h1{font-size:20px;margin:0;} .sub{color:#777;font-size:12px;margin:4px 0 20px;}
      h2{font-size:15px;margin:0 0 8px;border-left:4px solid #9f1239;padding-left:8px;}
      .cards{display:flex;gap:16px;margin-bottom:20px;}
      .card{flex:1;border:1px solid #ddd;border-radius:8px;padding:12px 16px;}
      .card p{margin:0;font-size:11px;color:#777;} .card b{font-size:16px;}
      table{width:100%;border-collapse:collapse;font-size:12px;}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;}
      th{background:#f5f0eb;} .r{text-align:right;} .in{color:#047857;} .out{color:#c2410c;}
      .total td{background:#f5f0eb;font-weight:bold;}
      .section{margin-bottom:8px;} .break{page-break-before:always;}
      .foot{margin-top:24px;font-size:11px;color:#999;}
    </style></head><body>
    <h1>爱满天下产后护理之家 · 库存报表 / Inventory Report</h1>
    <p class="sub">${esc(rangeLabel)} · 打印日期 / Printed on: ${today()} · 按部门分段，每个部门一页 / One page per department</p>
    <div class="cards">
      <div class="card"><p>进货总额 / Total Stock In Value</p><b class="in">${fmtMoney(totals.inAmt)}</b></div>
      <div class="card"><p>出货总额 / Total Stock Out Value</p><b class="out">${fmtMoney(totals.outAmt)}</b></div>
      <div class="card"><p>期末库存总价值 / Closing Inventory Value</p><b>${fmtMoney(totals.closeValue)}</b></div>
    </div>
    ${sections}
    <p class="foot">此报表由爱满天下货物管理系统生成 / Generated by Inventory Management</p>
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
}
