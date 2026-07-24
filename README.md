# discord-leaver — Bulk Leave Discord Servers

A simple CLI tool that lets you mass-leave (or delete) Discord servers and clean up your friends list. Sort, filter, pick the ones you want gone, and confirm. Done.

## Quick Start

```bash
git clone <repo-url>
cd discord-leaver
npm install
npm start
```

Requires **Node.js 18+**.

> **Disclaimer:** This tool automates **your own** Discord account using **your own** token.
> Automating a user account ("self-botting") is a gray area under Discord's Terms of Service
> and can put your account at risk. Use at your own risk. Never share your token with anyone,
> and never paste it into a tool you haven't read the source of.

## Getting Your Discord Token

1. Open Discord in your browser and log in.
2. Press `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac) to open Developer Tools.
3. Click the **Application** tab.
4. Expand **Local Storage** in the sidebar and click on the Discord entry.
5. Find the `token` key and copy its value (without quotes).

> Your token is like a password — never share it with anyone.

## Usage

1. **Enter your token** — pasted securely (hidden input).
2. **Choose mode** — manage servers or clean up your friends list.
3. **Servers** — sort your servers, optionally filter (owned/admin/verified, member count, creation date), then select manually or leave all matching servers.
4. **Friends** — select friends manually or remove all at once.
5. **Review & confirm** — see your selection summary, then confirm to proceed.
6. **Owned servers** — if you own a selected server, you'll be asked whether to delete it (with 2FA support).

## Built By

Built by [StartupBros](https://startupbros.com) for the [House of Vibe](https://houseofvibe.ai) community. Originally forked from [dandanthedev/BulkLeave](https://github.com/dandanthedev/BulkLeave).

## License

[MIT](LICENSE)
