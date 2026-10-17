#!/bin/bash
# usage: launch.sh <suite> <runs> <seed> [probe]
cd "$(dirname "$0")/../.."
for i in $(seq 0 11); do
  (npx vite-node research/mana/run.ts job --suite "$1" --runs "$2" --seed "$3" --shard $i/12 ${4:+--probe true} > /dev/null 2> "research/mana/shard-$1-$i.log" &)
done
