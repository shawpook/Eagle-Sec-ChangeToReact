/**
 * Eagle API V2 完整測試腳本
 *
 * 使用方式：整段複製貼到 Chrome DevTools Console，一次執行完畢
 * Server: http://localhost:41595
 * 覆蓋 36/38 個 API V2 端點（跳過 setCustomThumbnail、searchByBase64、library/switch）
 */

(async () => {

const BASE = 'http://localhost:41595';
const T = {};  // 儲存測試資源 ID
let passed = 0, failed = 0;

const api = async (method, path, body) => {
    const url = `${BASE}${path}`;
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    return await res.json();
};
const GET  = (path) => api('GET', path);
const POST = (path, body) => api('POST', path, body);
const log  = (label, r) => {
    const ok = r.status === 'success';
    ok ? passed++ : failed++;
    console.log(`${ok ? '✅' : '❌'} ${label}`, r.data);
    return r.data;
};
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

console.log('🚀 開始 API V2 完整測試...\n');

// ===== Phase 1: 系統資訊 =====

log('[1] GET app/info', await GET('/api/v2/app/info'));
log('[2] GET library/info', await GET('/api/v2/library/info'));

const lh = log('[2b] GET library/history', await GET('/api/v2/library/history'));
console.log('   → total:', lh?.total, '| returned:', lh?.data?.length);

try {
    const libInfo = await GET('/api/v2/library/info');
    const libPath = libInfo?.data?.library?.path;
    if (libPath) {
        log('[2c] GET library/icon', await GET(`/api/v2/library/icon?libraryPath=${encodeURIComponent(libPath)}`));
    } else {
        console.log('⚠️ [2c] library/icon 跳過（無法取得 library path）');
    }
} catch (e) {
    console.log('⚠️ [2c] library/icon 跳過（icon 不存在）:', e.message);
}

// ===== Phase 2: 建立資源 =====

const folder = log('[3] POST folder/create', await POST('/api/v2/folder/create', {
    name: '_API_TEST_FOLDER_' + Date.now(),
    description: 'API V2 測試用資料夾'
}));
T.folderId = folder?.id;

const item1 = log('[4a] POST item/add (item 1)', await POST('/api/v2/item/add', {
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=200&h=200&fit=crop',
    name: '_API_TEST_ITEM_' + Date.now(),
    website: 'https://unsplash.com',
    tags: ['api-test-tag-A', 'api-test-tag-B'],
    annotation: 'API V2 測試用圖片',
    folders: T.folderId ? [T.folderId] : []
}));
T.itemId = item1?.id;
console.log(`   → item/add 回傳 ID: ${T.itemId} (type: ${typeof T.itemId})`);
if (typeof T.itemId === 'string' && T.itemId.length > 0) {
    passed++; console.log('✅ [4a-verify] item/add 回傳有效 ID');
} else {
    failed++; console.log('❌ [4a-verify] item/add 未回傳有效 ID');
}

const item2 = log('[4b] POST item/add (item 2)', await POST('/api/v2/item/add', {
    url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=200&h=200&fit=crop',
    name: '_API_TEST_ITEM2_' + Date.now(),
    tags: ['api-test-tag-B', 'api-test-tag-C'],
    annotation: 'API V2 第二張測試圖片'
}));
T.itemId2 = item2?.id;

const batchResult = log('[4c] POST item/add (batch mode)', await POST('/api/v2/item/add', {
    items: [
        {
            url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=200&h=200&fit=crop',
            name: '_API_TEST_BATCH_1_' + Date.now(),
            tags: ['api-test-batch'],
            annotation: 'API V2 批量測試圖片 1'
        },
        {
            url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
            name: '_API_TEST_BATCH_2_' + Date.now(),
            tags: ['api-test-batch'],
            annotation: 'API V2 批量測試圖片 2'
        }
    ]
}));
T.batchIds = batchResult?.ids || [];
console.log(`   → batch ids: ${JSON.stringify(T.batchIds)} (count: ${T.batchIds.length})`);
if (Array.isArray(T.batchIds) && T.batchIds.length === 2) {
    passed++; console.log('✅ [4c-verify] batch item/add 回傳正確數量的 IDs');
} else {
    failed++; console.log('❌ [4c-verify] batch item/add 回傳 IDs 數量不正確');
}

const overLimit = await POST('/api/v2/item/add', {
    items: Array.from({ length: 1001 }, (_, i) => ({
        url: 'https://example.com/test.png',
        name: `_LIMIT_TEST_${i}`
    }))
});
if (overLimit.status === 'error') {
    passed++; console.log('✅ [4d] batch limit 超過 1000 正確拒絕');
} else {
    failed++; console.log('❌ [4d] batch limit 未正確拒絕超限請求');
}

// 輪詢等待 item 進入 itemMappings（最多 15 秒）
console.log('   ⏳ 等待圖片下載完成...');
for (let i = 0; i < 15; i++) {
    await wait(1000);
    const check = await POST('/api/v2/item/get', { id: T.itemId });
    if (check?.data?.data?.[0]?.id === T.itemId) {
        console.log(`   ✅ item 就緒（${i + 1} 秒）`);
        break;
    }
    if (i === 14) console.log('   ⚠️ 等待超時，後續 item 操作可能失敗');
}

const group = log('[5] POST tagGroup/create', await POST('/api/v2/tagGroup/create', {
    name: '_API_TEST_GROUP_' + Date.now(),
    tags: ['api-test-tag-A'],
    color: 'blue',
    description: 'API V2 測試群組'
}));
T.tagGroupId = group?.id;

console.log('   📦 已建立資源:', T, '\n');

// ===== Phase 3: 讀取驗證 =====

const f6 = log('[6] GET folder/get (paginated)', await GET('/api/v2/folder/get?limit=5&offset=0'));
console.log('   → total:', f6?.total, '| returned:', f6?.data?.length);

const f7 = log('[7] POST folder/get (by id)', await POST('/api/v2/folder/get', { id: T.folderId }));
console.log('   → found:', f7?.data?.[0]?.name);

const i8 = log('[8] GET item/get (paginated)', await GET('/api/v2/item/get?limit=5&offset=0'));
console.log('   → total:', i8?.total, '| returned:', i8?.data?.length);

log('[9a] POST item/get (by id)', await POST('/api/v2/item/get', { id: T.itemId }));
log('[9b] POST item/get (by tags)', await POST('/api/v2/item/get', { tags: ['api-test-tag-A'], limit: 5 }));
log('[9c] POST item/get (by keywords)', await POST('/api/v2/item/get', { keywords: ['_API_TEST_'], limit: 5 }));

const q10 = log('[10] POST item/query', await POST('/api/v2/item/query', { query: '_API_TEST_', limit: 10 }));
console.log('   → total:', q10?.total, '| returned:', q10?.data?.length);

log('[11] GET item/countAll', await GET('/api/v2/item/countAll'));

log('[12a] GET tag/get (paginated)', await GET('/api/v2/tag/get?limit=10&offset=0'));
log('[12b] POST tag/get (filter)', await POST('/api/v2/tag/get', { name: 'api-test' }));

log('[13a] GET tag/getRecentTags', await GET('/api/v2/tag/getRecentTags?limit=10'));
log('[13b] GET tag/getStarredTags', await GET('/api/v2/tag/getStarredTags?limit=10'));

const tg14 = log('[14] GET tagGroup/get', await GET('/api/v2/tagGroup/get?limit=50'));
console.log('   → total:', tg14?.total, '| returned:', tg14?.data?.length);

// ===== Phase 3.5: 邊界防護驗證 =====

log('[14b] GET app/info with query token', await GET('/api/v2/app/info?token=test-token'));

const noSource = await POST('/api/v2/item/add', { name: 'test' });
if (noSource.status === 'error') {
    passed++; console.log('✅ [14c] item/add 無來源正確拒絕');
} else {
    failed++; console.log('❌ [14c] item/add 無來源未拒絕');
}

const selfMerge = await POST('/api/v2/tag/merge', { source: 'api-test-tag-A', target: 'api-test-tag-A' });
if (selfMerge.status === 'error') {
    passed++; console.log('✅ [14d] tag/merge 自我合併正確拒絕');
} else {
    failed++; console.log('❌ [14d] tag/merge 自我合併未拒絕');
}

const badTags = await POST('/api/v2/tagGroup/addTags', { groupId: T.tagGroupId, tags: 'not-array' });
if (badTags.status === 'error') {
    passed++; console.log('✅ [14e] tagGroup/addTags 非陣列正確拒絕');
} else {
    failed++; console.log('❌ [14e] tagGroup/addTags 非陣列未拒絕');
}

const longStr = await POST('/api/v2/item/update', { id: T.itemId, name: 'x'.repeat(10001) });
if (longStr.status === 'error') {
    passed++; console.log('✅ [14f] 超長字串正確拒絕');
} else {
    failed++; console.log('❌ [14f] 超長字串未拒絕');
}

// ===== Phase 4: 更新資源 =====

log('[15] POST item/update', await POST('/api/v2/item/update', {
    id: T.itemId,
    name: '_API_TEST_ITEM_UPDATED',
    annotation: '已透過 API V2 更新',
    tags: ['api-test-tag-A', 'api-test-tag-B', 'api-test-tag-C'],
    star: 3
}));

log('[16] POST folder/update', await POST('/api/v2/folder/update', {
    id: T.folderId,
    name: '_API_TEST_FOLDER_UPDATED',
    description: '已透過 API V2 更新',
    iconColor: 'green'
}));

log('[17] POST tag/update (rename C→C-renamed)', await POST('/api/v2/tag/update', {
    originalName: 'api-test-tag-C',
    name: 'api-test-tag-C-renamed'
}));

log('[18] POST tagGroup/update', await POST('/api/v2/tagGroup/update', {
    id: T.tagGroupId,
    name: '_API_TEST_GROUP_UPDATED',
    color: 'red',
    description: '已透過 API V2 更新'
}));

// ===== Phase 5: 特殊操作 =====

log('[19a] POST tagGroup/addTags', await POST('/api/v2/tagGroup/addTags', {
    groupId: T.tagGroupId,
    tags: ['api-test-tag-B', 'api-test-tag-C-renamed']
}));

log('[19b] POST tagGroup/removeTags', await POST('/api/v2/tagGroup/removeTags', {
    groupId: T.tagGroupId,
    tags: ['api-test-tag-C-renamed']
}));

log('[20] POST tag/merge (B→A)', await POST('/api/v2/tag/merge', {
    source: 'api-test-tag-B',
    target: 'api-test-tag-A'
}));

log('[21] POST item/refreshThumbnail', await POST('/api/v2/item/refreshThumbnail', {
    itemId: T.itemId
}));

// ===== Phase 6: AI Search =====

for (const ep of ['isInstalled', 'isReady', 'isStarting', 'isSyncing', 'getSyncStatus', 'checkServiceHealth']) {
    log(`[22] GET aiSearch/${ep}`, await GET(`/api/v2/aiSearch/${ep}`));
}

log('[23] POST aiSearch/searchByText', await POST('/api/v2/aiSearch/searchByText', {
    query: 'test image', options: { limit: 5 }
}));

log('[24] POST aiSearch/searchByItemId', await POST('/api/v2/aiSearch/searchByItemId', {
    itemId: T.itemId, options: { limit: 5 }
}));

// ===== Phase 7: 清理 =====

console.log('\n🧹 清理測試資源...');

log('[25a] item → 垃圾桶 (item 1)', await POST('/api/v2/item/update', { id: T.itemId, isDeleted: true }));
log('[25b] item → 垃圾桶 (item 2)', await POST('/api/v2/item/update', { id: T.itemId2, isDeleted: true }));
for (const bid of T.batchIds) {
    log(`[25b-batch] item → 垃圾桶 (batch ${bid})`, await POST('/api/v2/item/update', { id: bid, isDeleted: true }));
}
log('[25c] tagGroup/remove', await POST('/api/v2/tagGroup/remove', { id: T.tagGroupId }));

// ===== 結果 =====

console.log(`\n🏁 測試完成！ ✅ ${passed} 通過 | ❌ ${failed} 失敗`);
console.log('   ⚠️ folder 和 tags 需手動清理（API 無刪除端點）');
console.log('   ⚠️ item 已移至垃圾桶（含批量新增的項目）');
console.log('   ⏭️ 跳過：item/setCustomThumbnail、aiSearch/searchByBase64、library/switch');

})();

/**
 * 端點覆蓋（36/38）
 *
 * ✅ GET  /api/v2/app/info                    [1]
 * ✅ GET  /api/v2/library/info                 [2]
 * ✅ GET  /api/v2/library/history              [2b]
 * ✅ GET  /api/v2/library/icon                 [2c]
 * ⏭️ POST /api/v2/library/switch              跳過（會切換資料庫）
 * ✅ POST /api/v2/folder/create                [3]
 * ✅ POST /api/v2/item/add                     [4a,4b] 單一模式
 * ✅ POST /api/v2/item/add (batch)             [4c] 批量模式
 * ✅ POST /api/v2/tagGroup/create              [5]
 * ✅ GET  /api/v2/folder/get                   [6]
 * ✅ POST /api/v2/folder/get                   [7]
 * ✅ GET  /api/v2/item/get                     [8]
 * ✅ POST /api/v2/item/get                     [9a,9b,9c]
 * ✅ POST /api/v2/item/query                   [10]
 * ✅ GET  /api/v2/item/countAll                [11]
 * ✅ GET  /api/v2/tag/get                      [12a]
 * ✅ POST /api/v2/tag/get                      [12b]
 * ✅ GET  /api/v2/tag/getRecentTags            [13a]
 * ✅ GET  /api/v2/tag/getStarredTags           [13b]
 * ✅ GET  /api/v2/tagGroup/get                 [14]
 * ✅ GET  /api/v2/app/info?token=              [14b] query string token
 * ✅ POST /api/v2/item/update                  [15,25a,25b]
 * ✅ POST /api/v2/folder/update                [16]
 * ✅ POST /api/v2/tag/update                   [17]
 * ✅ POST /api/v2/tagGroup/update              [18]
 * ✅ POST /api/v2/tagGroup/addTags             [19a]
 * ✅ POST /api/v2/tagGroup/removeTags          [19b]
 * ✅ POST /api/v2/tag/merge                    [20]
 * ✅ POST /api/v2/item/refreshThumbnail        [21]
 * ✅ GET  /api/v2/aiSearch/isInstalled          [22]
 * ✅ GET  /api/v2/aiSearch/isReady              [22]
 * ✅ GET  /api/v2/aiSearch/isStarting           [22]
 * ✅ GET  /api/v2/aiSearch/isSyncing            [22]
 * ✅ GET  /api/v2/aiSearch/getSyncStatus        [22]
 * ✅ GET  /api/v2/aiSearch/checkServiceHealth   [22]
 * ✅ POST /api/v2/aiSearch/searchByText         [23]
 * ⏭️ POST /api/v2/aiSearch/searchByBase64      跳過
 * ✅ POST /api/v2/aiSearch/searchByItemId       [24]
 * ⏭️ POST /api/v2/item/setCustomThumbnail      跳過
 * ✅ POST /api/v2/tagGroup/remove              [25c]
 */
