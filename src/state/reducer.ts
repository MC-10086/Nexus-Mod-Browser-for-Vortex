/**
 * 插件状态（Redux slice）
 * ---------------------------------------------------------------------------
 * 注册路径：["session", "nexusBrowser"]
 *   - `session` 前缀 = **不持久化**（Vortex 重启后清空），符合官方对"临时 UI 状态"的约定
 *   - 之所以用 Redux 而不是组件内部 state：用户切到别的页面再切回来时，搜索结果还在
 *
 * 约定：
 *   - reducer 必须是纯函数，只返回新对象
 *   - action 用普通对象 { type, payload }，不引入 redux-act 依赖
 */

import { ACTIONS } from "../constants";
import { INexusBrowserState } from "../types";

export const DEFAULTS: INexusBrowserState = {
  domain: undefined,
  query: "",
  sort: "endorsements",
  page: 0,
  totalCount: 0,
  results: [],
  loading: false,
  error: undefined,
  selectedModId: undefined,
  detail: undefined,
  detailError: undefined,
  detailLoading: false,
};

export const reducerSpec = {
  reducers: {
    [ACTIONS.SET_QUERY]: (state: INexusBrowserState, payload: { query: string }) => ({
      ...state,
      query: payload.query,
      page: 0,
      results: [],
      totalCount: 0,
      error: undefined,
      loading: true,
    }),

    [ACTIONS.SET_SORT]: (state: INexusBrowserState, payload: { sort: string }) => ({
      ...state,
      sort: payload.sort,
      page: 0,
      results: [],
      error: undefined,
      loading: true,
    }),

    [ACTIONS.SET_PAGE]: (state: INexusBrowserState, payload: { page: number }) => ({
      ...state,
      page: payload.page,
      error: undefined,
      loading: true,
    }),

    [ACTIONS.LOAD_START]: (state: INexusBrowserState) => ({
      ...state,
      loading: true,
      error: undefined,
    }),

    [ACTIONS.LOAD_SUCCESS]: (
      state: INexusBrowserState,
      payload: { domain: string; results: any[]; totalCount: number },
    ) => ({
      ...state,
      domain: payload.domain,
      results: payload.results,
      totalCount: payload.totalCount,
      loading: false,
      error: undefined,
    }),

    [ACTIONS.LOAD_ERROR]: (
      state: INexusBrowserState,
      payload: { message: string; code?: string },
    ) => ({
      ...state,
      loading: false,
      results: [],
      totalCount: 0,
      error: { message: payload.message, code: payload.code },
    }),

    [ACTIONS.SET_GAME]: (state: INexusBrowserState, payload: { domain: string }) => ({
      ...DEFAULTS,
      sort: state.sort,
      domain: payload.domain,
      loading: true,
    }),

    [ACTIONS.SELECT_MOD]: (state: INexusBrowserState, payload: { modId: number }) => ({
      ...state,
      selectedModId: payload.modId,
      detail: undefined,
      detailError: undefined,
      detailLoading: true,
    }),

    [ACTIONS.CLOSE_DETAIL]: (state: INexusBrowserState) => ({
      ...state,
      selectedModId: undefined,
      detail: undefined,
      detailError: undefined,
      detailLoading: false,
    }),

    [ACTIONS.SET_DETAIL]: (state: INexusBrowserState, payload: { detail: any }) => ({
      ...state,
      detail: payload.detail,
      detailError: undefined,
      detailLoading: false,
    }),

    [ACTIONS.SET_DETAIL_ERROR]: (state: INexusBrowserState, payload: { message: string }) => ({
      ...state,
      detail: undefined,
      detailError: payload.message,
      detailLoading: false,
    }),
  },

  defaults: DEFAULTS,
};

/** 从整棵 state 里取出我们的切片（防御式：任何一层缺失都回退到默认值） */
export function nexusBrowserSlice(state: any): INexusBrowserState {
  return state?.session?.nexusBrowser ?? DEFAULTS;
}

/**
 * action creators。
 * 直接用 store.dispatch(action(...)) 即可，不需要 bindActionCreators。
 */
export const actions = {
  setQuery: (query: string) => ({ type: ACTIONS.SET_QUERY, payload: { query } }),
  setSort: (sort: string) => ({ type: ACTIONS.SET_SORT, payload: { sort } }),
  setPage: (page: number) => ({ type: ACTIONS.SET_PAGE, payload: { page } }),
  loadStart: () => ({ type: ACTIONS.LOAD_START, payload: {} }),
  loadSuccess: (domain: string, results: any[], totalCount: number) => ({
    type: ACTIONS.LOAD_SUCCESS,
    payload: { domain, results, totalCount },
  }),
  loadError: (message: string, code?: string) => ({
    type: ACTIONS.LOAD_ERROR,
    payload: { message, code },
  }),
  setGame: (domain: string) => ({ type: ACTIONS.SET_GAME, payload: { domain } }),
  selectMod: (modId: number) => ({ type: ACTIONS.SELECT_MOD, payload: { modId } }),
  closeDetail: () => ({ type: ACTIONS.CLOSE_DETAIL, payload: {} }),
  setDetail: (detail: any) => ({ type: ACTIONS.SET_DETAIL, payload: { detail } }),
  setDetailError: (message: string) => ({
    type: ACTIONS.SET_DETAIL_ERROR,
    payload: { message },
  }),
};
