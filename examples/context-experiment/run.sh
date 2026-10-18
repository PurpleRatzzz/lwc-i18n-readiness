#!/usr/bin/env bash
# Translate the three conditions of one set with project A, the same way for every condition.
#   bash examples/context-experiment/run.sh <dreamhouse|starterkit>
# Needs ANTHROPIC_API_KEY in the environment; it is passed on to A's process, never written anywhere.
# Isolation: A gets nothing but the exported XLIFF file (source text plus notes). It never sees
# design.json, the preregistered expectations or anything from the session that wrote them.
set -euo pipefail
cd "$(dirname "$0")/../.."

SET=${1:?usage: run.sh <dreamhouse|starterkit>}
A_DIR=${A_DIR:-$(cd ../project-a && pwd)}
OUT=examples/context-experiment/$SET/runs
mkdir -p "$OUT"
: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY is not set}"

# Record exactly which translator ran: A's commit, whether its tree had local changes, and its model.
cat > "$OUT/run-info.json" <<INFO
{
  "set": "$SET",
  "startedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "projectB": "$(git rev-parse --short HEAD)",
  "projectA": "$(git -C "$A_DIR" rev-parse --short HEAD)",
  "projectADirty": $( [ -z "$(git -C "$A_DIR" status --porcelain)" ] && echo false || echo true ),
  "model": "$(sed -n 's/^MODEL = "\(.*\)"/\1/p' "$A_DIR/l10n_pipeline/llm.py")",
  "command": "python -m l10n_pipeline translate --content-type ui --target-lang zh-CN (default config E)"
}
INFO

export LWC_I18N_TRANSLATOR_CMD="cd '$A_DIR' && .venv/bin/python -m l10n_pipeline translate --in {in} --out {out} --content-type ui --target-lang {lang}"
node examples/context-experiment/make-conditions.mjs "$SET"
for c in c1 c2 c3; do
    node src/cli.js xliff-export "examples/context-experiment/$SET/conditions/$c.labels-meta.xml" --target-lang zh-CN --out "$OUT/$c.en.xlf"
    node src/cli.js translate "$OUT/$c.en.xlf" --out "$OUT/$c.zh-CN.xlf" --lang zh-CN --translator command 2> "$OUT/$c.log"
done
echo "done: $OUT"
