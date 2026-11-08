# 爱满天下 · 货物管理 / Inventory Management

月子中心货物进出货与库存管理系统。React + Vite + Firebase，放在 Netlify。

## 功能
- 库存：新增 / 修改 / 删除货物，各部门库存价值，打印清单、简易清单
- 进货 / 出货：登记、修改、删除，按月份查看，打印清单
- 月尾结算：按月份或日期范围，打印 / 存 PDF
- 修改记录：谁在什么时候改了什么，永久保存
- 员工账号（管理员）：开账号（名字 + 6 位数 PIN）、换 PIN、停用 / 恢复
- 每个人都可以自己改 PIN / 密码

## 第一次使用
打开网站会叫你建立第一个管理员（名字 + 密码），之后在「员工账号」帮员工开账号。

## 文件
- `src/firebase.js` — Firebase 设定（项目 flstocksystem）
- `firestore.rules` — 数据库安全规则，改了要贴到 Firebase → Firestore → Rules → Publish
- `netlify.toml` — Netlify 打包设定

## 数据放在哪里
Firestore 集合：`items`（货物）、`movements`（进出货）、`users`（员工）、
`loginNames`（名字 → 登录用的内部 Email）、`audit_log`（修改记录）、`meta/setup`。
