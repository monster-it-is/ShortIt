# Zero-cost hosting verification

Verified against official public pricing pages on **8 October 2026**. Re-check those pages before creating accounts. This stack is selected only because each piece publishes a $0 option that does not require a credit card when used as described.

**Do not add a payment method to any of these accounts.** If a free quota is exhausted and no card is on file, the provider suspends or throttles the service instead of charging. That is the intended $0 failure mode.

This application is **not** guaranteed always-on. Render's free web service sleeps, and quotas can suspend it.

## Selected platforms

### Render Hobby + Free web service + Static Site

| Field | Value |
| --- | --- |
| Free plan name | Hobby workspace; Web Service compute plan **Free**; Static Sites (no compute plan) |
| Monthly cost | $0 workspace fee; $0 Free compute; $0 static site hosting |
| Credit card | Not required to sign up or use Free instances / static sites ([Deploy for Free](https://render.com/docs/free), [Workspaces](https://render.com/docs/team-members)) |
| Official pages | [render.com/docs/free](https://render.com/docs/free), [render.com/pricing](https://render.com/pricing), [Hobby plan changes](https://render.com/docs/new-workspace-plans) |
| Remains free indefinitely? | Hobby remains a published $0 workspace plan. Render can change terms. Free instances are for hobby/preview use, not an SLA. |

**Usage limits (Hobby / Free, as published):**

- Free web service: **512 MB RAM**, **0.1 CPU**, **one instance**, ephemeral disk.
- **Spins down after 15 minutes** with no inbound HTTP/WebSocket traffic. Next request **spins up in about one minute**. Render may show a loading page on the API host during wake-up.
- **750 Free instance hours / workspace / calendar month.** Running services consume hours; spun-down services do not. Unused hours do not roll over. Exhaustion **suspends all Free web services until the next month**.
- One Free web service running 24/7 uses about **720–744 hours** in a 30–31 day month, which is close to the 750-hour cap. Extra deploys or a second Free web service can exhaust the quota. ShortIt uses **one** Free web service (the API). The static frontend does **not** consume instance hours.
- Outbound bandwidth: **5 GB / month** included on Hobby, then $0.15/GB **if a payment method is on file**. With **no card**, Render **suspends Free services** for the rest of the month instead of billing.
- Build pipeline: **500 minutes / month**. Exhaustion **bills if a card is on file**; otherwise **new builds are disabled** and existing artifacts keep serving.
- Static sites share the bandwidth and pipeline quotas. They are free to deploy and get `onrender.com` HTTPS (Let's Encrypt / Google Trust Services) automatically.
- Render may restart Free web services at any time. Local files are lost on restart/spin-down. Persistent disks, scaling, SSH, and edge caching for web services are **not** on Free.
- Free web services cannot use reserved ports `18012`, `18013`, `19099`, or outbound SMTP ports `25`/`465`/`587`.
- Hobby includes **two custom domains**; extra domains are $0.25/month. **Do not add a custom domain.** Use the assigned `*.onrender.com` hosts.
- Dedicated outbound IPs are **$100/month** and require Pro. **Rejected.**
- Render Postgres Free **expires after 30 days** and then requires a paid upgrade or data loss. **Rejected.**
- Render Key Value (Redis-compatible) is not used. A paid instance would violate the budget; the Free Key Value instance is in-memory only and still extra infrastructure. Rate limits stay in-process.

**Conditions that could incur charges (avoid all of these):**

- Adding a payment method, then exceeding bandwidth or pipeline minutes.
- Selecting any compute plan other than **Free**.
- Enabling dedicated IPs, private links, extra custom domains, persistent disks, or paid Postgres/Key Value.
- Automatic paid upgrades. Do not turn them on.

### MongoDB Atlas Free cluster (M0)

| Field | Value |
| --- | --- |
| Free plan name | Atlas **Free** cluster (formerly **M0**) |
| Monthly cost | $0 (published as “Free forever”) |
| Credit card | Atlas account creation and M0 deploy docs do not require a card. **Do not add a payment method or Atlas credits that convert to a paid bill.** |
| Official pages | [mongodb.com/pricing](https://www.mongodb.com/pricing), [Deploy a Free Cluster](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/), [Free cluster limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) |
| Remains free indefinitely? | MongoDB publishes M0 as free forever and never-expiring. Atlas may pause **idle** Free clusters after **30 days with zero connections**. You can resume without paying unless the cluster is on an unrestorable old version. Terms can change. |

**Usage limits:**

- **512 MB (0.5 GB)** storage (data + indexes).
- **100 operations/second**; **10 GB in / 10 GB out** per rolling 7 days (throttle, not a card charge).
- **500 connections** max; **100 databases / 500 collections**.
- One Free cluster **per Atlas project**.
- Shared RAM/vCPU. No backups, no private endpoints, no VPC peering, no customer-managed encryption keys.
- MongoDB 8.0 on Free clusters (Atlas-managed).
- Idle pause after 30 days with no connections.

**Conditions that could incur charges (avoid):**

- Scaling to Flex / M10+ or enabling paid backups, peering, or private endpoints.
- Atlas App Services or other billable add-ons beyond the cluster.
- Activating promotional credits that require a card later.

### GitHub Free + GitHub Actions standard runners

| Field | Value |
| --- | --- |
| Free plan name | **GitHub Free** (personal account); Actions on **standard GitHub-hosted runners** in a **public** repository |
| Monthly cost | $0 |
| Credit card | GitHub Terms: free accounts are **not** required to provide payment information |
| Official pages | [github.com/pricing](https://github.com/pricing), [GitHub's plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans), [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [Choosing a runner](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job) |
| Remains free indefinitely? | GitHub publishes Free as **$0 per month forever** for unlimited public repositories. Terms can change. |

**Usage limits:**

- Public repositories: standard runner minutes are **free and unlimited**.
- Private repositories: **2,000 minutes/month** then billed if a payment method exists. **Keep ShortIt public.**
- Artifact/Packages storage on Free: **500 MB** shared. This workflow does not upload artifacts.
- **Larger runners are always billed**, including on public repos. The workflow uses `ubuntu-latest` only.

**Conditions that could incur charges (avoid):**

- Larger runners, hosted compute beyond standard.
- Private-repo Actions over the included minutes **with a card on file**.
- Paid GitHub Copilot / Team / Enterprise.

## Rejected paid or card-required options

| Option | Why rejected |
| --- | --- |
| Render paid compute (`starter` / `0.5c-512mb` and up) | Recurring compute cost |
| Render dedicated outbound IPs | $100/month, Pro workspace |
| Render Postgres Free | 30-day expiry, then paid upgrade or deletion |
| Render Key Value | Extra infra; persistence needs paid; not required |
| Custom domain + DNS purchase | User rule: never buy a domain |
| Atlas M2/M5/Flex/M10+ | Paid database tiers |
| Atlas private endpoints / peering | Not on M0; paid networking |
| Redis Cloud / Upstash paid | Paid Redis forbidden; MemoryStore is enough |
| Fly.io | Card required for new signups; no current free tier for new users |
| Railway trial credits | Time-limited credits that become a bill |
| GitHub larger runners | Always billed |

## Atlas network access and Render outbound IPs

Render Free web services send MongoDB traffic from **shared regional outbound CIDR ranges**, not a single static IP. Those ranges are listed on the service page: **Connect → Outbound**. They are shared with other Render customers in the same region.

Safer options, in order:

1. **Allowlist Render's shared outbound CIDRs (recommended, $0).** Copy every range from the API service's Outbound tab into Atlas **Network Access**. Also add **your own IP** if you need Atlas UI / Compass / local `pnpm run dev` against the same cluster. Consequences: **any Render service in that region** can attempt TCP to your cluster. Database access is still gated by the Atlas database user password, TLS, and ShortIt's application auth. This is **not** a private network.
2. **Dedicated Render outbound IPs.** Static and exclusive, but **$100/month and Pro-only**. **Rejected** under the $0 budget.
3. **Atlas private endpoints / VPC peering.** **Not available on Free (M0)** clusters.
4. **`0.0.0.0/0` (allow from anywhere).** **Do not use this unless (1) failed and you understand (4).** Atlas emails project users when a `/0` CIDR is added. Consequences: **any host on the internet** can reach the MongoDB TLS port and try to authenticate. A leaked or weak database password becomes a full data compromise (read/exfiltrate/wipe). There is no network-level restriction. If you still choose this: use a long random database password, least-privilege `readWrite` on the `shortit` database only (never `atlasAdmin`), rotate credentials after any leak, and keep `MONGODB_URI` only in Render's secret env (never in git). Atlas still requires SCRAM + TLS; that is not equivalent to an IP allowlist.

ShortIt does **not** enable `0.0.0.0/0` in config. Network Access is an Atlas dashboard setting you control.

## What happens when quotas run out

- Render instance hours: API **suspends until next calendar month**. Frontend static files may still load; API calls fail. Short URLs stop resolving.
- Render bandwidth (no card): **Free services suspend** for the rest of the month.
- Render pipeline minutes (no card): **new deploys stop**; the last successful build keeps serving.
- Atlas storage 512 MB: writes fail; the cluster is not automatically upgraded if you never add billing.
- Atlas idle pause (30 days, zero connections): cluster pauses; resume from the Atlas UI (free). First request after resume is slow.
- None of these are paid upgrades unless you add a card and opt in.

## Availability statement

ShortIt on this stack is a **public portfolio demo** with:

- Cold starts around **one minute** after 15 minutes idle.
- Possible **monthly suspension** if 750 instance hours, 5 GB bandwidth, or 500 build minutes are exhausted.
- Atlas **throttling** at 100 ops/s or 0.5 GB storage.
- No uptime SLA.

Do not advertise it as always-on production hosting.
