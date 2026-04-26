# GitHub Push Anleitung

## Status
✅ Alle Änderungen sind lokal committed:
- `141f7c2` - Three.js 3D Engine mit Multiplayer und Triple-A Graphics
- `aba0acb` - Three.js Dependencies aktualisiert

## Pushen (manuell)

```bash
cd /Users/maammaam/.paperclip/instances/default/projects/40119577-5c0b-453d-957d-de0494bf8c86/12f96ef6-25e4-430b-8ee9-0acc4579b612/_default

# Option 1: Mit Personal Access Token
git push https://agentzz1:DEIN_TOKEN@github.com/agentzz1/horror-game-p2p.git main

# Option 2: Token im Git Credential Helper speichern
echo "https://agentzz1:DEIN_TOKEN@github.com" > ~/.git-credentials
chmod 600 ~/.git-credentials
git config --global credential.helper store
git push origin main

# Option 3: Einmalig mit Keychain
GIT_ASKPASS=echo git push origin main
```

## Token erstellen
https://github.com/settings/tokens → Generate new token (classic)
- Scope: repo (full control of private repositories)
- Keine Expiration für dauerhaften Zugriff
