# Personal IPTV subscription data

Checked on 2026-10-14. This directory contains playlist data only; it does not alter MoonTVPlus application code.

- primary.m3u: six distinct channels; HTTPS direct playback.
- backup.m3u: Hebei 4K and Qianjiang 720p alternatives. This is a separate source selector, not automatic failover.
- Video goes directly from the broadcaster endpoint to the viewer. No video relay, transcoding, cookies, signatures or access-control workarounds are included.
- A publicly reachable endpoint is not a redistribution licence. This playlist is for personal use; stream rights and geographic restrictions remain with the respective broadcasters.
- Source discovery: Guovin/iptv-api, iptv-org/iptv, fanmingming/live. Only tested broadcaster-domain URLs were selected. Frozen Zhejiang manifests dated 2023/2025, dead endpoints and unknown restreamers were excluded.
- Logos: fanmingming/live (channel trademarks remain their owners'). Three FAST channels have no verified accessible logo and use the application fallback.
- EPG: CCSH/IPTV public XMLTV feed; mappings are only used where exact channel identity is known. No substitute channel listings.
- The list is a manually reviewed snapshot. Upstream EPG updates itself. MoonTVPlus still needs its existing refresh action/cron to reload cached metadata. No scheduled updater is installed by these files.
- No credentials are included. Do not add expiring authenticated URLs or private data.

Guangzhou Comprehensive was removed after two browser playback failures, despite successful server-side segment probes.
