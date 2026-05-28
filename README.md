# PiCap

PiCap is a small Raspberry Pi web appliance for capturing mirrored Ethernet traffic.

## Requirements

- Raspberry Pi OS Bookworm
- Node.js 22+
- pnpm 10.16+
- `tcpdump`
- NetworkManager / `nmcli`

The project configures pnpm with a two-day package maturity gate:

```yaml
minimumReleaseAge: 2880
```

## Development

```bash
pnpm install
pnpm run build
pnpm run dev
```

## Runtime Environment

```text
PICAP_PASSWORD_HASH=<bcrypt hash>
PICAP_SESSION_SECRET=<random secret>
PICAP_CAPTURE_DIR=/var/lib/picap/captures
PICAP_DB_PATH=/var/lib/picap/picap.sqlite3
PICAP_CAPTURE_INTERFACE=eth0
PICAP_WIFI_INTERFACE=wlan0
PICAP_MAX_TOTAL_CAPTURE_GB=32
PICAP_DEFAULT_CHUNK_SECONDS=300
PICAP_DEFAULT_CHUNK_MB=256
PICAP_HOST=0.0.0.0
PICAP_PORT=8080
```

Generate a password hash after dependencies are installed:

```bash
pnpm run hash-password -- 'your-password'
```

## Install On A Pi

```bash
sudo scripts/install.sh
sudoedit /etc/picap.env
sudo systemctl enable --now picap
```

Example `/etc/picap.env`:

```text
PICAP_PASSWORD_HASH=$2b$12$...
PICAP_SESSION_SECRET=replace-with-a-long-random-secret
PICAP_CAPTURE_DIR=/var/lib/picap/captures
PICAP_DB_PATH=/var/lib/picap/picap.sqlite3
```

## Notes

- Production runtime configuration lives in `/etc/picap.env`.
- Local development still uses the ignored project-root `.env` file through `pnpm run dev`.
- The app runs as the `picap` user.
- `sudoers` grants access to `tcpdump` and `nmcli` only.
- Captures are rotated into `.pcap` chunks and indexed for download.
