# 下一阶段 VPS 弹幕集成计划（尚未执行）

核实日期：2026-10-14。官方仓库 https://github.com/huangxd-/danmu_api ，源码提交 `f47b786876f2ab51ef69518e5e0b1c0574664589`；未有 latest release。MoonTVPlus 基线及部署见 [Cloudflare 文档](CLOUDFLARE_DEPLOYMENT.md)。本阶段未连接 VPS、未创建 `danmu.vafa.eu.org` DNS、未设置虚构的远端接口。

## 已核实调用链

浏览器 → 同域 MoonTVPlus `/api/danmaku/*` → Worker 服务端 → VPS。Moon 原生自定义配置适配 danmu_api 的 DandanPlay 风格接口，不需要浏览器直接访问 VPS。

| MoonTVPlus 入口 | 服务端请求（前缀为 base/TOKEN） | 参数/格式 |
|---|---|---|
| GET `/api/danmaku/search` | GET `/api/v2/search/anime` | keyword；JSON |
| POST `/api/danmaku/match` | POST `/api/v2/match` | JSON `{fileName}`；JSON |
| GET `/api/danmaku/episodes` | GET `/api/v2/bangumi/{animeId}` | JSON 剧集 |
| GET `/api/danmaku/comment` | GET `/api/v2/comment/{episodeId}?format=xml` | XML，Worker 转为 `{p,m,cid}` 数组 |
| 同上，按链接 | GET `/api/v2/comment?url=...&format=xml` | URL 编码，XML |

Moon 源码：`src/lib/danmaku/config.ts`、`src/lib/danmaku/api.ts`、`src/app/api/danmaku/*/route.ts`。环境变量 `DANMAKU_API_BASE`、`DANMAKU_API_TOKEN` 存在，但仅用于初始化配置；既有 D1 SiteConfig 优先。

下一阶段在管理后台「站点配置 → 弹幕配置」选择 custom，自定义 base=`https://danmu.vafa.eu.org`（不要包含 Token），Token 填 VPS 的随机 `TOKEN`。Moon 会追加 `/{TOKEN}`。禁止使用 `localhost:9321`、默认 `87654321` 或 ADMIN_TOKEN。VPS 部署验收后再改 `wrangler.toml` 的 `DANMAKU_ENABLED=true`、发布并启用后台弹幕自动加载。

普通播放器运行配置和 `/api/server-config` 不下发 Token；管理后台拥有者可读到 Token，这是管理员权限范围内的行为。Token 会进入 Worker 到 VPS 的 URL 路径，因此代理访问日志必须关闭或脱敏，出错日志不能记录完整地址。原生链路不需要开放浏览器 CORS；先不开 `Access-Control-Allow-Origin:*`。

## 功能与边界

- 原生播放器可自动搜索/按标题和集数匹配，允许手动选弹幕源/剧集。季数、不同剪辑、平台可用性需逐片实际联调，不能保证全网匹配。
- 支持速度、字号、透明度、显示区域、同步播放设置；未发现可据此承诺的逐视频手动时间偏移控件。可先通过服务端 `DANMU_OFFSET` 校正。
- Moon 本地上传只接受 XML；JSON 上传未支持，不能报告为已实现。VPS 独立本地弹幕管理能力不能等同于播放器原生上传支持。
- 多平台选择已在 UI/类型中发现；同时合并可使用 danmu_api `MERGE_SOURCE_PAIRS=tencent&iqiyi&youku,tencent,iqiyi,youku` 等后端配置，保留哪些单源由规则决定，不能承诺播放器有多选合并按钮。
- `GROUP_MINUTE=1` 为按一分钟分组合并去重，0 禁用，最大30。
- `DANMU_OFFSET` 示例 `剧名/S01:90,剧名/S01/E03@tencent&bilibili:-10`。正值延后、负值提前；可按剧/季/集/来源设定。`%` 模式按视频时长缩放，须先核实元数据时长。
- Moon search/match/episodes 为30秒 AbortController，comment 为120秒；响应头返回后会清除定时器，因此不是严格的整次下载时间上限。路由未实现显式自动重试，客户端失败返回空结果，视频可继续。
- Moon 评论在浏览器 IndexedDB 缓存，默认 `NEXT_PUBLIC_DANMAKU_CACHE_EXPIRE_MINUTES=4320`（3天），集数有本地缓存。VPS `.cache` 持久化；当前源码搜索/评论缓存默认均3分钟，下一阶段可按需求调5/30分钟（这是建议值）。
- Worker Node 兼容与 fetch 支持当前代理逻辑；大 XML 整体解析会占用内存，需验证最大弹幕量、响应时长及 Worker 限额，VPS 故障隔离需实测。

## VPS 实施模板

下一阶段先检查系统架构、空闲磁盘/内存、Docker/Compose、现有端口与反代。不擅自覆盖现有服务。官方 Dockerfile 基于 Node 22 Alpine，监听9321，工作目录 `/app`；官方推荐镜像 `logvar/danmu-api:latest`。执行时确认官方镜像供应链及架构，拉取后记录并使用实际 digest 固定，不虚构摘要。

下列是待实施模板，本次未运行。假设 Caddy 在宿主机运行；如果已有容器反代，改成共享隔离网络，不开放9321公网。

```yaml
services:
  danmu-api:
    image: ${DANMU_IMAGE:?set verified logvar/danmu-api image digest}
    restart: unless-stopped
    ports:
      - '127.0.0.1:9321:9321'
    volumes:
      - ./config:/app/config
      - ./cache:/app/.cache
    security_opt:
      - no-new-privileges:true
```

`config/.env` 权限600，目录700，使用两个独立随机长令牌，不提交版本库：

```dotenv
TOKEN=<new-random-service-token>
ADMIN_TOKEN=<different-random-admin-token>
FAVORITE_REQUIRE_ADMIN=true
LOCAL_DANMU_NOT_REQUIRE_ADMIN=false
SOURCE_ORDER=douban,360,tencent,youku,iqiyi,imgo,bilibili,migu
GROUP_MINUTE=1
SEARCH_CACHE_MINUTES=5
COMMENT_CACHE_MINUTES=30
```

官方支持 `config/.env` 热更新，cache 应映射到 `/app/.cache`（不要照抄 README 的 `.chche` 拼写）。不挂载 Docker socket，不额外部署 Redis/Watchtower。备份 config 与 cache；ADMIN_TOKEN 仅经 SSH 隧道访问本地管理页。

## 网络、HTTPS与访问控制

待得到实际 VPS IP 后，检查现有 DNS 冲突，再创建 `danmu.vafa.eu.org`。使用 Caddy 自动证书或现有 Nginx+ACME；Cloudflare DNS 模式/代理超时根据实际网络联调决定，必须验证端到端 TLS。仅开放反代80/443，SSH限制来源，9321仅回环。

Caddy 模板如下，环境变量 `DANMU_SERVICE_TOKEN` 与 TOKEN 相同；不要将展开后的配置写进公开日志。配置完成先 `caddy validate`，再 reload。未配置 access log，错误日志仍需检查脱敏。

```caddyfile
danmu.vafa.eu.org {
  @api path /{$DANMU_SERVICE_TOKEN}/api/v2/search/anime /{$DANMU_SERVICE_TOKEN}/api/v2/match /{$DANMU_SERVICE_TOKEN}/api/v2/bangumi/* /{$DANMU_SERVICE_TOKEN}/api/v2/comment/* /{$DANMU_SERVICE_TOKEN}/api/v2/comment
  handle @api {
    reverse_proxy 127.0.0.1:9321
  }
  handle {
    respond 404
  }
}
```

仅放行 Moon 所需路径；公开禁止根页面、日志、system/admin、配置、favorites、本地上传等。上游 favorite/list 可公开读，不应直接向公网开放整个服务。后续按实际版本复核 API 权限和远端 URL 输入/SSRF 限制，避免把管理能力暴露出去。

## 下一阶段验收清单

1. 验证容器启动、重启后 config/cache 保留、非授权请求被拒。
2. 验证 DNS/证书/443，9321公网不可达、ADMIN_TOKEN/管理路径公网不可达。
3. 使用有权限访问的腾讯、爱奇艺、优酷、B站示例逐一验证 search、match、bangumi、comment XML；记录每个平台成功/失败与地域限制。
4. 设置 Moon custom base/token → 开启部署开关 → 后台开启自动加载。通过浏览器网络确认只请求同域，不暴露 Token。
5. 测试电影、电视剧跨季/集数、手选源、合并和去重、偏移、样式及本地 XML。
6. 停止测试容器/模拟超时验证视频仍播放；恢复后缓存和重试行为正常。
7. 记录实际镜像 digest、VPS 配置、备份/回滚方法和未通过项目。JSON 上传仍列为待开发，未授权做额外源码扩展。

参考：[官方 README](https://github.com/huangxd-/danmu_api/blob/f47b786876f2ab51ef69518e5e0b1c0574664589/README.md)、[环境变量源码](https://github.com/huangxd-/danmu_api/blob/f47b786876f2ab51ef69518e5e0b1c0574664589/config/.env.example)。
