/**
 * P3-b：来源文件夹模式的 React/store 状态。
 *
 * 语义（2026-09-14 用户决策，见收口计划 P3-b）：
 *  - 只读浏览 + 预览；来源元数据编辑**不**接入资源库 images-change 持久化路径；
 *  - 目录导航以 (sourceRootId, relativePath) 标识，经 React/store 正式更新网格状态；
 *  - 管理只负责 连接/索引/扫描/移除索引。
 */
import { create } from 'zustand';

export interface SourceDirectoryNode {
  id: string;
  name: string;
  relativePath: string;
  assetCount?: number;
  children?: SourceDirectoryNode[];
}

export interface SourceRootNode {
  id: string;
  name: string;
  path?: string;
  assetCount?: number;
  missingCount?: number;
  watch?: boolean;
  directories?: SourceDirectoryNode[];
}

interface SourceModeState {
  /** 是否处于来源模式 */
  active: boolean;
  roots: SourceRootNode[];
  selectedRootId: string;
  /** 选中目录（'.' = 来源根；含其下所有子目录素材） */
  selectedRelativePath: string;
  /** 目录树的展开状态（按 rootId） */
  expanded: Record<string, boolean>;
  /** 重扫中（key=rootId；防同一来源重复触发） */
  scanning: Record<string, boolean>;
  lastError: string | null;
  view: 'tree' | 'manage';
}

export const useSourceModeState = create<SourceModeState>(() => ({
  active: false,
  roots: [],
  selectedRootId: '',
  selectedRelativePath: '.',
  expanded: {},
  scanning: {},
  lastError: null,
  view: 'tree',
}));