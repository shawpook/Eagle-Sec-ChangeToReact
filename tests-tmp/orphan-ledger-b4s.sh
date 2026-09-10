#!/bin/bash
# b1-9s orphan ledger double-check: for each candidate, find runtime refs excluding self/app.bundle.js/docs
FILES=(
src/app/js/annotation-preview.js
src/app/js/api-server.js
src/app/js/controllers/add-to-folder.js
src/app/js/controllers/auto-tagging.js
src/app/js/controllers/move-folder.js
src/app/js/directives/audio-media-element.js
src/app/js/directives/filter-item-annotation.js
src/app/js/directives/filter-item-bpm.js
src/app/js/directives/filter-item-camera.js
src/app/js/directives/filter-item-color.js
src/app/js/directives/filter-item-duration.js
src/app/js/directives/filter-item-folders.js
src/app/js/directives/filter-item-fonts.js
src/app/js/directives/filter-item-image.js
src/app/js/directives/filter-item-import.js
src/app/js/directives/filter-item-mtime.js
src/app/js/directives/filter-item-note.js
src/app/js/directives/filter-item-rating.js
src/app/js/directives/filter-item-resolution.js
src/app/js/directives/filter-item-semantic.js
src/app/js/directives/filter-item-shape.js
src/app/js/directives/filter-item-size.js
src/app/js/directives/filter-item-tags.js
src/app/js/directives/filter-item-types.js
src/app/js/directives/filter-item-url.js
src/app/js/directives/folder-sortable.js
src/app/js/directives/notification-btn.js
src/app/js/directives/smart-folder-sortable.js
src/app/js/directives/tag-rect-select.js
src/app/js/fix-utils.js
src/app/js/hover-preview/audio-hover-preview.js
src/app/js/hover-preview/bilibili-hover-preview.js
src/app/js/hover-preview/vimeo-hover-preview.js
src/app/js/hover-preview/youtube-hover-preview.js
src/app/js/ipc-helper.js
src/app/js/lib/api/duplicate-checker.js
src/app/js/lib/api/reverse-image-search.js
src/app/js/lib/api/url-enlarger-remote.js
src/app/js/lib/base.js
src/app/js/modules/angular-bind-notifier.min.js
src/app/js/modules/angular-vs-repeat.min.js
src/app/js/modules/flatpicker/plugins/confirmDate/confirmDate.js
src/app/js/modules/flatpicker/plugins/weekSelect/weekSelect.js
src/app/js/modules/nouislider/nouislider.min.js
src/app/js/recent-file-manager.js
src/app/js/rule-match.js
src/app/js/vendors/apng-canvas.min.js
src/app/js/vendors/bricks.min.js
src/app/js/vendors/google-analytics.js
src/app/js/vendors/jquery.hoverIntent.min.js
src/app/js/vendors/jquery.scrollTo.min.js
src/app/js/vendors/jquery.ui.sortable-animation.js
src/app/js/vendors/selectableScroll.js
src/app/js/vendors/underscore-min.js
)
CLEAN=0; DIRTY=0
for f in "${FILES[@]}"; do
  b=$(basename "$f")
  # runtime refs: search basenename across code trees; exclude the file itself, app.bundle.js, md/docs, tests-tmp
  hits=$(grep -rl "$b" src/app frontend electron tests backend --include="*.js" --include="*.cjs" --include="*.html" --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.json" 2>/dev/null | grep -v -F "$f" | grep -v "app.bundle.js" | grep -v "node_modules")
  if [ -z "$hits" ]; then
    CLEAN=$((CLEAN+1))
  else
    DIRTY=$((DIRTY+1))
    echo "== DIRTY: $f"
    echo "$hits" | sed 's/^/     /'
  fi
done
echo "RESULT: clean=$CLEAN dirty=$DIRTY total=${#FILES[@]}"
