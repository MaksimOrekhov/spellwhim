#!/bin/sh
# Reproduces every table of the report. ~1.5 hours on 12 cores. Run from the repository root.
for e in ${EXPERIMENTS:-baseline grid factors pressure length extras iso armor mech2 pace phase2 r0fam final final2}; do
  node docs/data/combat-foundations-review-v1/lab/run.mjs $e --runs ${RUNS:-200} --workers ${WORKERS:-11} > /dev/null
done
