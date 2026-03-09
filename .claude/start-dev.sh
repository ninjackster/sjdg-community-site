#!/bin/bash
export PATH="/tmp/node-v22.14.0-darwin-arm64/bin:$PATH"
cd "/Users/jaimemurillo/Desktop/SJDG Webpage"
exec vercel dev --listen 3030 --yes
