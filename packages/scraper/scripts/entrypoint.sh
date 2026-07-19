#!/bin/bash
set -e

# Clean Chrome lock files from all profiles
find /app/profiles -name 'SingletonLock' -delete 2>/dev/null || true
find /app/profiles -name 'SingletonCookie' -delete 2>/dev/null || true
find /app/profiles -name 'SingletonSocket' -delete 2>/dev/null || true

# Start Xvfb on display :99
Xvfb :99 -screen 0 1280x1024x24 &
XVFB_PID=$!
echo "Xvfb started (PID: $XVFB_PID)"

# Start x11vnc on port 5900
VNC_PASSWORD="${VNC_PASSWORD:-fbstore}"
x11vnc -display :99 -forever -passwd "$VNC_PASSWORD" -quiet &
X11VNC_PID=$!
echo "x11vnc started (PID: $X11VNC_PID)"

# Start noVNC (websockify) on port 6080
websockify --web /usr/share/novnc 6080 localhost:5900 &
WEBSOCKIFY_PID=$!
echo "noVNC started (PID: $WEBSOCKIFY_PID)"

# Start the Node server
exec node packages/scraper/dist/server.js
