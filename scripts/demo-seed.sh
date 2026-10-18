#!/usr/bin/env bash
# Seeds a LOCAL demo account (never remote) so screenshots show a populated library.
set -euo pipefail
ID="${1:-deadbeef-0000-4000-8000-000000000001}"
NOW=$(($(date +%s) * 1000)); DAY=86400000
SQL="DELETE FROM library WHERE user_id='$ID'; DELETE FROM users WHERE id='$ID';
INSERT INTO users (id, wallet, status, created_at, display_name) VALUES ('$ID', 4200, 'online', $NOW, 'Demo Player');"
i=0
for g in 3 9 13 16 6 14 10 19 22 26 1 4 17 2 11; do
  inst=$((i % 3 == 0 ? 1 : 0)); pt=$((i * 37 % 400)); lp=$((i < 8 ? NOW - i * DAY * 3 : 0)); fav=$((i == 2 ? 1 : 0))
  SQL="$SQL INSERT INTO library (user_id, game_id, installed, playtime, favorite, last_played) VALUES ('$ID', $g, $inst, $pt, $fav, $lp);"
  i=$((i + 1))
done
npx wrangler d1 execute resteam --local --command "$SQL" > /dev/null
echo "seeded $ID"
