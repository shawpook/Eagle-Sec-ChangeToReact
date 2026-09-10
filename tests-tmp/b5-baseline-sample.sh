#!/bin/bash
cd "H:/dev/Eagle-Sec-development - 副本" || exit 1
git stash push -u -m "b5-sample" -- src/ tests/ > /dev/null 2>&1
echo "stashed; dirty=$(git status --short -- src/ | wc -l)"
for i in 1 2 3; do
  pkill -f "vite" 2>/dev/null; pkill -f "electron" 2>/dev/null; sleep 4
  node tests/main-ui-workflow-closed-loop.mjs > tests-tmp/st-head-$i.txt 2>&1
  echo "HEAD run$i: $(grep -o 'MAIN_WORKFLOW_SMOKE_OK\|MAIN_WORKFLOW_SMOKE_ERROR Error: [a-z ]*' tests-tmp/st-head-$i.txt | head -1)"
done
git stash pop > /dev/null 2>&1
echo "restored; dirty=$(git status --short -- src/ | wc -l)"
