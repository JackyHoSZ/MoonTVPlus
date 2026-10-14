# VPS 弹幕服务实际部署与维护

部署日期：2026-10-14。以下为实际运行配置；不包含密钥。

## 当前架构

浏览器 → `https://tv.vafa.eu.org/api/danmaku/*` → Cloudflare Worker → `https://danmu.vafa.eu.org` → 现有 Nginx → `127.0.0.1:9321` → `danmu-api`。

- Ubuntu 22.04.5，amd64，Docker 29.6.0；复用现有 Docker 和 Nginx。
- 官方镜像 `logvar/danmu-api:latest`，实际拉取 digest：`sha256:7c6c80e6e51d0a77aaa8745a1cbaf95fe333118697d3fdaaabc5ca3bc24e5529`。容器固定使用拉取时的 image ID；记录在 `current-image-id`、`image-digests.json`。
- 官方源码核对提交：`f47b786876f2ab51ef69518e5e0b1c0574664589`。该提交是文档/接口核对基线，不声称镜像内构建提交与之相同。
- 仅原生 Docker CLI；容器 `danmu-api`，目录 `/docker/danmu-api`。未引入额外容器管理系统。
- DNS：`danmu` A 记录指向 VPS，DNS only。未改 `tv` 及其他 DNS。
- 由于区级 TLS 为 Flexible，Worker 同区子请求曾产生重定向循环。新增专用页面规则 `danmu.vafa.eu.org/*` → SSL 严格；未改全区 TLS。
- Nginx 独立配置 `/etc/nginx/conf.d/DanmuApi.conf`。复用现有 `*.vafa.eu.org` 证书（此次核验有效至 2026-12-08）。已检查原有 acme.sh --cron 任务存在；续期后仍需确保 Nginx reload。

## Docker 运行参数

当前容器由 `scripts/common.sh` 内的 `start_container` 创建，等价于：

```sh
docker run -d --name danmu-api \
  --label io.moontvplus.managed=moontvplus-danmu \
  --restart unless-stopped --security-opt no-new-privileges:true \
  -p 127.0.0.1:9321:9321 \
  --mount type=bind,src=/docker/danmu-api/config,dst=/app/config \
  --mount type=bind,src=/docker/danmu-api/.cache,dst=/app/.cache \
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \
  VERIFIED_IMAGE_ID
```

`VERIFIED_IMAGE_ID` 应使用实际 `current-image-id` 中的值，不能把占位符直接运行。不要在已有同名容器时重复执行 docker run。

目录 `config/`、`.cache/`、`backups/` 权限 700；配置 `.env` 600。宿主机绑定挂载可保存配置、搜索/剧集映射、收藏及本地数据。此次未创建收藏或导入测试弹幕。

9321 仅回环监听，外网连接实测拒绝。公开 HTTPS 仅允许带查询 Token 的搜索、匹配、剧集与弹幕读取接口；根路径、错误 Token、配置及管理路径均 404。普通 Token 不拥有管理写入权限。反代关闭访问日志和包含路径的错误日志；不要使用完整 `nginx -T` 或打印 `.env` 到公开日志。

## 配置

`/app/config/.env` 由上游自动加载，并有文件变更监听；容器未通过 `--env-file` 注入同名变量，因此宿主机编辑可热更新。实际轮换 Token 后验证热更新生效；监听有短暂延迟，立即检查可能失败，几秒后再检查。

主要配置：

```dotenv
TOKEN=<随机查询密钥，已配置，不在此记录>
ADMIN_TOKEN=<独立随机管理密钥，已配置，不在此记录>
FAVORITE_REQUIRE_ADMIN=true
LOCAL_DANMU_NOT_REQUIRE_ADMIN=false
SOURCE_ORDER=360,tencent,iqiyi,youku,imgo,bilibili,dandan,migu
ENABLE_ANIME_EPISODE_FILTER=true
GROUP_MINUTE=1
RATE_LIMIT_MAX_REQUESTS=60
SEARCH_CACHE_MINUTES=10
COMMENT_CACHE_MINUTES=60
VOD_REQUEST_TIMEOUT=8000
LOG_LEVEL=warn
LOCAL_CACHE_ENABLED=true
USE_BANGUMI_DATA=false
DANMU_API_PUBLIC_PROTO=https
```

360 是节目搜索聚合源，最终弹幕由腾讯/爱奇艺/优酷/芒果/B站等平台取得；不可把 360 当作独立弹幕平台。豆瓣源连续出现超时及空数据错误，已从搜索顺序移除。平台专用请求还受上游内部超时/重试逻辑控制，`VOD_REQUEST_TIMEOUT` 不代表所有请求统一 8 秒。

自动匹配已验证 `三体 S01E01 @qq` 与 `三体 S01E02 @qq` 返回不同且正确的腾讯集数。`PLATFORM_ORDER` 为可选优选平台（qq/qiyi/imgo/youku/bilibili1 等），未强行设置，以保留不同内容可用来源。分集过滤已开启。

`GROUP_MINUTE=1` 用于相同弹幕去重。多源合并 `MERGE_SOURCE_PAIRS` 和时间偏移 `DANMU_OFFSET` 为原项目能力，未对不同剪辑强行合并或施加统一偏移。Moon 播放器支持手动选源、选集、时间调整及本地 XML 导入；未额外开放 VPS 的上传/管理接口。

## MoonTVPlus

管理后台四项配置：`DanmakuSourceType=custom`、`DanmakuApiBase=https://danmu.vafa.eu.org`、`DanmakuApiToken` 为查询密钥、`DanmakuAutoLoadDefault=true`。基础地址不包含 Token，由服务端拼接。已回读确认其他后台配置未改。

Worker 开关 `DANMAKU_ENABLED=true`、`ENABLE_TV_MODE=true`。继续复用原 Worker/D1，未重置数据库。弹幕代理异常原本会返回带 Token 的 URL；现已修改为固定错误文案且不记录原始异常，并轮换查询密钥。

上游配置使用进程内缓存，修改后台后不同 Worker 实例可能暂时持有旧值。更换 Token 后应同时更新 VPS `.env`、Nginx 允许路径、Moon 后台，然后重新发布 Worker，使实例一致使用新值。

已实测普通三体播放页自动搜索弹幕，首次多候选需选源一次，第1/2集自动换弹幕成功；直链播放模式按上游设计不自动搜索。

电视模式地址 `https://tv.vafa.eu.org/tv`。电视页复用网页弹幕 API 辅助模块，但使用自己的 React/CSS 渲染器，不是直接复用桌面 ArtPlayer 插件。未在实体电视/遥控器上完整验证。

## 运维命令

```sh
docker ps --filter name='^/danmu-api$'
docker logs --tail 100 danmu-api
docker restart danmu-api
python3 /docker/danmu-api/scripts/healthcheck.py
sudoedit /docker/danmu-api/config/.env
/docker/danmu-api/scripts/update.sh
/docker/danmu-api/scripts/rollback.sh
```

Docker 服务已 enabled，容器策略 `unless-stopped`。系统正常启动时会恢复运行；如果人为 `docker stop`，此策略会尊重停止状态，需要手动 `docker start danmu-api`。未为验证而重启整台 VPS，以免影响其他项目。

更新脚本只接受带本项目所有权标签的 `danmu-api`，加互斥锁，备份配置和缓存、记录旧 image ID、给旧镜像加回滚标签，拉取新镜像并按相同绑定挂载重建。旧版恢复不覆盖持久化数据。健康失败会自动恢复旧镜像；不清理镜像或其他项目。

已实测更新脚本在镜像未变化时正常备份并退出；`backups/20261014T032430Z/` 为首次维护测试备份。重启后本地健康和历史剧集映射仍可用。

`rollback.sh` 需要发生过一次实际版本升级生成 `previous-image-id`；首次部署没有上一版可回滚。未人为拉取未知旧镜像来宣称跨版本回滚通过。数据结构若不向后兼容，需要停本容器后人工选择备份恢复，不可盲目覆盖现有数据。备份会包含密钥，保持 700/600 权限，勿公开。

## 常见故障

- 根 URL 404 是预期：管理与调试界面未公开，不能用首页 404 判断服务故障。
- 本地健康失败：检查仅本容器日志、配置文件权限、挂载路径和热更新延迟。
- Worker 重定向循环：检查弹幕域名专用严格 TLS 规则和 Nginx 证书；不要改回 Flexible 或关闭证书校验。
- 搜索成功但某源无弹幕：用对应平台公开条目和正确集数验证；登录/地区/风控限制不绕过。
- 片名相似、周年版或动画版误匹配：在播放器弹幕栏选择准确来源/集数，不把不同剪辑混合。
- 查询 Token 轮换：同步 `.env`、Nginx 路径白名单、Moon 后台并重新发布；旧备份中的 Token 已失效，不应重新启用。
- Nginx 修改后先 `nginx -t` 再 `systemctl reload nginx`，不要覆盖其他站点。

参考：[danmu_api 官方源码与说明](https://github.com/huangxd-/danmu_api)、[Cloudflare 重定向诊断](https://developers.cloudflare.com/ssl/troubleshooting/too-many-redirects/)。
