# 2026-10-14 第二阶段更新

弹幕 VPS 已部署并接入，弹幕自动加载及 TV 模式已开启。下文为第一阶段交付记录；涉及“VPS 尚未部署/弹幕关闭/电视关闭”的描述已由 [实际 VPS 部署记录](VPS_DANMAKU_INTEGRATION.md) 和 [最终验收](DANMU_ACCEPTANCE.md) 取代。

# MoonTVPlus 私人 Cloudflare 部署

核实日期：2026-10-14。上游 `mtvpls/MoonTVPlus` main `c7c5a3648025b24c5d7c0c13eaef148cf8b29b48`，应用版本 `226.1.0`。当日 GitHub 未提供 latest release，故采用所核实的 main 提交，不称其为正式稳定发行版。

## 实际资源

- Fork：https://github.com/JackyHoSZ/MoonTVPlus （保留 upstream 关系）。
- 正式地址：https://tv.vafa.eu.org
- 备用地址：https://moontv-plus.hexj.workers.dev
- Worker：`moontv-plus`；免费 Workers；OpenNext + Next.js 14.2.35；Node.js 兼容标志。
- D1：`moontvplus`；binding `DB`；ID `1a7f2a68-6917-4f16-b50e-55ee749f0106`。
- Custom Domain 已绑定，HTTPS 已实际访问。根域及原有 Worker/Pages/D1 保留；未创建弹幕域名 DNS、未操作 VPS。
- D1 迁移 `001` 至 `012` 已按 Wrangler migrations 执行并核实实际表和迁移记录。008 重建通知表，仅在新空库初始化时执行；后续升级应逐项审查新迁移。

## 配置与安全

`wrangler.toml` 包含资源 ID 和非敏感变量。构建和运行时均使用 `NEXT_PUBLIC_STORAGE_TYPE=d1`。`SITE_BASE` 为正式域名。Worker Secrets：`USERNAME`、`PASSWORD`、`CRON_PASSWORD`，通过 Wrangler Secret bulk 提交；不进入 Git 或 CI 构建环境。管理员为 admin，随机高强度密码单独交付，不在本文保存。

D1 SiteConfig 已关闭公开注册及 OIDC 注册，弹幕自动加载关闭。用户本地设置云同步设为自动。电视模式、TVBox 订阅、一起看、离线下载、Telegram 登录/注册均关闭。部署入口 `cloudflare/worker.js` 在未设置管理员凭证时拒绝服务，默认禁止上游中间件豁免认证的公开媒体代理，并在弹幕未配置时返回空结果，避免访问上游公共默认弹幕服务。

禁用代理也意味着依赖代理的部分跨域 M3U8、Emby/OpenList 播放暂不可用。以后如需启用，应先实现适当的鉴权与目标限制。元数据/图片仍采用上游默认第三方豆瓣 CDN，其可用性依赖第三方；没有配置影视播放源。

Secrets 不会因普通 `wrangler deploy` 被清空。站点设置存于 D1，既有配置优先于初始化环境变量。后续修改既有站点请通过管理后台，不要只改环境变量后假定生效。

## 可重复部署

要求 Node.js 24、package.json 指定的 pnpm 10.14.0。项目锁定 Wrangler 4.60.0。

```sh
corepack enable
pnpm install --frozen-lockfile
NEXT_PUBLIC_STORAGE_TYPE=d1 NEXT_TELEMETRY_DISABLED=1 pnpm build:cloudflare
pnpm exec wrangler login
pnpm exec wrangler d1 migrations apply moontvplus --remote
pnpm exec wrangler deploy
```

首次创建新站点时先核对资源 ID，使用交互式 `pnpm exec wrangler secret put PASSWORD` 等命令设置三个 Secrets。不要把凭证写进命令行、仓库或构建日志。不要对本次已初始化的库重复手动执行原始建表 SQL。

GitHub Actions：`.github/workflows/cloudflare-deploy.yml`，main 代码推送或手动运行触发；文档单独变更不触发。流程：冻结依赖 → 无凭证构建 → 迁移 → 查表 → 发布 → HTTPS/D1/禁止注册检查。同一生产环境串行发布。

仓库 Secret 只有 `CLOUDFLARE_API_TOKEN`。令牌限制到当前账户（Workers Scripts Edit、D1 Edit）和 `vafa.eu.org`（Workers Routes Edit、Zone Read）。Cloudflare 账户级权限仍可覆盖该账户内其他 Worker/D1，不能理解为只授权单个项目。未授予 DNS Edit、账户管理或计费权限。六个无关的上游 Docker/Android/EdgeOne/Turso workflows 已在此 Fork 禁用，后续同步检查勿误启用。

## 更新、备份和回滚

1. 更新前记录当前 Git SHA、Worker version；执行 D1 导出并离线保存，SQL 含用户数据，不提交 Git 或公开 artifacts。
2. 在维护分支 fetch upstream、merge 指定上游提交，检查迁移及本地部署配置差异。先本地构建、审查变更，再合并 main 触发部署。不要用强制同步覆盖私人配置。
3. 核实 Actions 绿灯，实际登录、设置和播放记录仍存在。定期检查令牌有效性与免费额度。

```sh
pnpm exec wrangler d1 export moontvplus --remote --output ../moontvplus-backup.sql
pnpm exec wrangler deployments list
pnpm exec wrangler versions list
# 用实际列表中的已验证版本 ID，必要时回滚代码：
pnpm exec wrangler rollback <VERSION_ID>
git fetch upstream
git switch -c update-upstream
git merge upstream/main
```

代码回滚不会回滚 D1 schema/data。数据库恢复先检查 D1 Time Travel/导出内容和业务写入，单独确认恢复点与影响，不盲目导入覆盖。定期备份到用户控制的安全位置。本次没有建立自动数据库备份计划。

## 已解决的问题

- 原始 Wrangler OAuth 过期：重新官方授权成功；GitHub 通过官方 device flow 授权。
- pnpm 11 与项目版本不一致：改用锁定 pnpm 10.14.0，撤销其添加的 workspace allowBuilds。
- 官方工作流未固定 Wrangler、SQL 错误被忽略且存在输出含密钥配置风险：固定依赖、使用迁移跟踪及失败即停止，不输出密钥。
- 浏览器主题脚本 `ReferenceError: e is not defined`：Wrangler keep_names 注入 helper 被 next-themes 序列化后脱离作用域。配置 `keep_names=false` 修复，未改业务源码。
- 压缩 Worker 约 2.7 MiB，符合当前免费套餐 3 MiB 上限；以后更新仍须检查包体。

## 限制与验收证据

管理员 API 登录/配置保存读取、D1 12 次迁移/实际表、重复发布后配置保留、正式 HTTPS 已验证。完整浏览器与 CI 最终验收记录见交付的验收报告。无影视源，聚合搜索结果、真实资源详情、跨源选集与跨设备播放尚不能报告成功。VPS 和弹幕平台联调属于下一阶段。

上游构建的 serverExternalPackages/Edge Node API 和 eval 警告未导致当前构建失败；不能据此保证所有未启用功能兼容 Workers。免费配额可能变化，参阅 [Workers 限制](https://developers.cloudflare.com/workers/platform/limits/) 与 [D1 定价](https://developers.cloudflare.com/d1/platform/pricing/)。本次未升级套餐或购买资源。

## 最终验收（2026-10-14）

实际部署 Git SHA：`0ca984d8afe0697a54e315bc3842be397d9e1cfc`。GitHub [首次自动部署](https://github.com/JackyHoSZ/MoonTVPlus/actions/runs/38502164035) 成功，后续仅文档提交不改变运行代码。Worker version：`14d16e6d-245b-45f2-8ded-605ab288915a`；压缩上传2611.84 KiB，启动51 ms。Actions 再次运行迁移提示无待执行项。

| 检查 | 实测结果 |
|---|---|
| 正式域名、TLS、首页、CSS/图片 | 通过；857px和1280px桌面视口加载 |
| 管理员登录、退出、重新登录 | 通过；站长角色、d1显示正确 |
| 后台保存与刷新 | 通过；用户设置云同步自动模式刷新保留 |
| D1结构和读写 | 12个迁移已记录；admin_config一条；真实播放器写入play_records |
| 重发布后数据 | Actions发布后配置和测试视频6/52秒记录仍在；首页显示继续观看 |
| 影视搜索 | 页面及空源搜索通过；Sintel返回0组，无虚构资源 |
| 影视详情 | 豆瓣详情面板标题、简介、演员等加载成功；播放源详情仍待配源验证 |
| ArtPlayer | W3C Sintel MP4实际出现画面并前进，D1记录写入；单直链没有多集可选 |
| 客户端日志 | 首页/搜索/详情新标签无error；MP4测速会产生非阻断HLS networkError，实际播放成功；主题阻断错误已修复 |
| Worker运行日志 | 发布后15次请求均outcome=ok，无exceptions、无error日志（抽样，不代表未测功能） |
| 匿名访问 | 首页307去登录；admin/config与playrecords为401；公开代理404；TVBox订阅403；错误cron口令401 |
| 弹幕未部署 | 接口返回可处理的空结果；视频正常播放，不访问默认公共弹幕 |
| 移动端 | 390×844视口覆盖未生效，实测仍为857/1280px；未计为移动端通过，iPhone/Windows实机待测 |

尚未验证：有权限的多影视源搜索/线路/选集、不同设备进度恢复、腾讯/爱奇艺等弹幕联调、完整错误压力与容量测试。没有添加未知资源站。测速提示来自上游MP4测速走HLS路径；当前不阻断播放，保留为后续上游修复项，没有为此大改业务逻辑。

Actions 使用的v4动作有Node20弃用提示，实际运行被GitHub切到Node24且成功；ubuntu-latest也有即将更新镜像提示。后续维护应升级核实过的actions并重新验证，当前不据此声称零警告。
