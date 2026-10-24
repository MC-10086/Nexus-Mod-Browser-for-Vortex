/**
 * 持久化偏好（persistent.nexusBrowserPrefs）
 * ---------------------------------------------------------------------------
 * 只存一类东西：**用户勾了"不再提醒"的前置**。
 *
 * 为什么需要它：有些用户的前置是从网盘/手动装的，Vortex 里没有 attributes.modId，
 * 我们无法识别成"已安装"。弹窗里勾上"不再提醒" = 声明本地已经有了 / 不想再被提醒，
 * 记在这里；以后**任何** MOD 再需要这个前置时都直接跳过。
 *
 * 注意：
 *   - 这是 persistent 分支，Vortex 重启后仍然保留
 *   - 如果用户后来用 Vortex 装了同一个前置，实装判定优先，这份标记不影响
 *   - 标记按"游戏域名 + 前置 modId"存；modId 只在游戏内唯一，所以必须带域名
 */

import { INexusBrowserPrefs } from "../types";
import { isLanguage, Language } from "../i18n";

export const PREFS_ACTIONS = {
  MARK_MANUAL_REQUIREMENT: "NEXUS_BROWSER_MARK_MANUAL_REQUIREMENT",
  UNMARK_MANUAL_REQUIREMENT: "NEXUS_BROWSER_UNMARK_MANUAL_REQUIREMENT",
  SET_LANGUAGE: "NEXUS_BROWSER_SET_LANGUAGE",
};

export const PREFS_DEFAULTS: INexusBrowserPrefs = {
  manualRequirements: {},
  language: "zh",
};

function withoutKey<T>(record: { [key: string]: T }, key: string): { [key: string]: T } {
  if (record[key] === undefined) {
    return record;
  }
  const next = { ...record };
  delete next[key];
  return next;
}

export const prefsReducerSpec = {
  reducers: {
    [PREFS_ACTIONS.MARK_MANUAL_REQUIREMENT]: (
      state: INexusBrowserPrefs,
      payload: { domain: string; modId: number },
    ) => {
      const { domain, modId } = payload;
      if (domain === undefined || domain.length === 0 || !isFinite(modId) || modId <= 0) {
        return state;
      }

      const current = state.manualRequirements?.[domain] ?? [];
      if (current.indexOf(modId) !== -1) {
        return state;
      }

      return {
        ...state,
        manualRequirements: {
          ...state.manualRequirements,
          [domain]: current.concat([modId]).sort((lhs, rhs) => lhs - rhs),
        },
      };
    },

    [PREFS_ACTIONS.UNMARK_MANUAL_REQUIREMENT]: (
      state: INexusBrowserPrefs,
      payload: { domain: string; modId: number },
    ) => {
      const { domain, modId } = payload;
      const current = state.manualRequirements?.[domain] ?? [];
      if (current.indexOf(modId) === -1) {
        return state;
      }

      const remaining = current.filter((id) => id !== modId);
      return {
        ...state,
        manualRequirements:
          remaining.length === 0
            ? withoutKey(state.manualRequirements ?? {}, domain)
            : { ...state.manualRequirements, [domain]: remaining },
      };
    },

    [PREFS_ACTIONS.SET_LANGUAGE]: (
      state: INexusBrowserPrefs,
      payload: { language: Language },
    ) => {
      const language = payload?.language;
      if (!isLanguage(language) || state.language === language) {
        return state;
      }
      return { ...state, language };
    },
  },

  defaults: PREFS_DEFAULTS,
};

/** 防御式取切片（state 还没初始化时回退默认值） */
export function prefsSlice(state: any): INexusBrowserPrefs {
  return state?.persistent?.nexusBrowserPrefs ?? PREFS_DEFAULTS;
}

/** 某个游戏下勾了"不再提醒"的前置 modId */
export function manualRequirementIds(state: any, domain: string): number[] {
  return prefsSlice(state).manualRequirements?.[domain] ?? [];
}

/** 用户保存的插件语言；只有用户主动选择时才改变 */
export function prefsLanguage(state: any): Language {
  const value = prefsSlice(state).language;
  return isLanguage(value) ? value : "zh";
}

export const prefsActions = {
  markManualRequirement: (domain: string, modId: number) => ({
    type: PREFS_ACTIONS.MARK_MANUAL_REQUIREMENT,
    payload: { domain, modId },
  }),
  unmarkManualRequirement: (domain: string, modId: number) => ({
    type: PREFS_ACTIONS.UNMARK_MANUAL_REQUIREMENT,
    payload: { domain, modId },
  }),
  setLanguage: (language: Language) => ({
    type: PREFS_ACTIONS.SET_LANGUAGE,
    payload: { language },
  }),
};
