#!/bin/sh
# Copy one variable's value from .env to the clipboard WITHOUT printing it, so you can paste it into a hosted form yourself
# (e.g. the OpenAI key box in LangGraph Studio's "LangSmith Chat" panel, which keeps it in your browser, not on this server).
# usage: scripts/copy_key.sh [NAME]      (default OPENAI_API_KEY)
set -eu
name="${1:-OPENAI_API_KEY}"
case "$name" in
  *[!A-Za-z0-9_]*) echo "not a variable name: $name" >&2; exit 2 ;;
esac
value="$(grep -E "^${name}=" .env 2>/dev/null | head -1 | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//' | tr -d '\r\n')"
if [ -z "$value" ]; then
  echo "${name} is not set in .env" >&2
  exit 1
fi
if command -v pbcopy >/dev/null 2>&1; then
  printf '%s' "$value" | pbcopy
elif command -v xclip >/dev/null 2>&1; then
  printf '%s' "$value" | xclip -selection clipboard
else
  echo "no clipboard tool (pbcopy/xclip) found" >&2
  exit 3
fi
echo "${name} is on your clipboard (${#value} characters, not printed). Paste it into the form, then copy something else to clear it."
