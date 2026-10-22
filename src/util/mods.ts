/**
 * 已安装 MOD 判定
 * ---------------------------------------------------------------------------
 * 目标：判断"这个 Nexus MOD 我本地是不是已经装了"，用于卡片上的标记。
 *
 * **不能靠名字**：Nexus 上重名的 MOD 很多，中文/英文名也可能不同。
 * 可靠依据是 Vortex 自己记录的 Nexus 标识：
 *   state.persistent.mods[gameId][internalModId].attributes.modId   ← Nexus 数字 mod id
 *   state.persistent.mods[gameId][internalModId].attributes.source  ← "nexus"
 *
 * 官方也是这么查的（mod_management/selectors.ts:118）：
 *   Object.values(mods).find((mod) => mod.attributes?.modId === modId)
 *
 * 注意：合集（collection）本身也有 attributes.modId（那是合集的 mod id），
 * 所以要把 type === "collection" 的条目排除掉，避免"装了合集以为装了原 mod"。
 */

/** 从整棵 state 里取出某游戏已安装的 Nexus mod id 集合 */
export function installedNexusModIds(state: any, gameId: string | undefined): number[] {
  if (!gameId) {
    return [];
  }

  const mods = state?.persistent?.mods?.[gameId];
  if (mods === undefined || mods === null) {
    return [];
  }

  const ids: number[] = [];
  for (const key of Object.keys(mods)) {
    const mod = mods[key];
    if (mod === undefined || mod === null) {
      continue;
    }
    // 合集不是"这个 MOD 装好了"，跳过
    if (mod.type === "collection") {
      continue;
    }
    const attributes = mod.attributes;
    if (attributes === undefined || attributes === null) {
      continue;
    }
    const nexusId = attributes.modId;
    if (typeof nexusId === "number" && isFinite(nexusId)) {
      ids.push(nexusId);
    }
  }

  return ids;
}

/** 便捷版：某个 Nexus mod 是否已安装 */
export function isNexusModInstalled(
  state: any,
  gameId: string | undefined,
  nexusModId: number,
): boolean {
  return installedNexusModIds(state, gameId).indexOf(nexusModId) !== -1;
}
