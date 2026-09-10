#!/bin/bash
# B5 二分驱动：找「第一个导致 allData 加载链断裂的最小区块前缀」
cd "H:/dev/Eagle-Sec-development - 副本" || exit 1
PY="C:/Users/Administrator/AppData/Local/Programs/Python/Python312/python.exe"
TOTAL=$("$PY" tests-tmp/bz-b5-subset.py none | sed 's/.*change_blocks=\([0-9]*\).*/\1/')
echo "变化块总数 = $TOTAL"

TOTAL=310
lo=0
hi=$TOTAL
while [ $((hi - lo)) -gt 1 ]; do
  mid=$(((lo + hi) / 2))
  "$PY" tests-tmp/bz-b5-subset.py "$mid" > /dev/null
  if ! node node_modules/esbuild/bin/esbuild --loader=ts --log-level=error < src/app/react/core/dataMachinery.ts > /dev/null 2>&1; then
    echo "prefix=$mid SYNTAX_FAIL — 中止"
    exit 1
  fi
  pkill -f "vite" 2>/dev/null; pkill -f "electron" 2>/dev/null; sleep 2
  out=$(node tests-tmp/probe-b5-load.mjs 2>&1 | grep -o "PROBE_RESULT [A-Z_]*")
  echo "prefix=$mid -> $out"
  case "$out" in
    *LOAD_OK*) lo=$mid ;;
    *LOAD_BROKEN*) hi=$mid ;;
    *) echo "prefix=$mid 结果异常，中止"; exit 1 ;;
  esac
done
echo "==== 结论：最小断裂前缀 = $hi（即第 $hi 块引入断裂）===="
"$PY" tests-tmp/bz-b5-subset.py "$hi" > /dev/null
echo "已把工作区置为 prefix=$hi 以便检视"
