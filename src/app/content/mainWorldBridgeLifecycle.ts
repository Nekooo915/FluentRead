/**
 * @file src/app/content/mainWorldBridgeLifecycle.ts
 * 文件职责：通过 DOM CustomEvent 跨越扩展 isolated world 与页面 MAIN world，统一启停 Shadow API 宿主桥。
 * 主要内容：汇集 Shadow bridge 的 enable/dispose 事件名，根据 enabled 选择事件并向给定 EventTarget 派发，实现站点禁用、恢复和页面生命周期时的幂等切换。
 * 模块边界：本文件不注入 MAIN-world 脚本、不修改宿主 prototype，也不持有页面状态；实际桥接实现属于 platform/shadow-ui 层。
 */
import {
    SHADOW_BRIDGE_DISPOSE_EVENT,
    SHADOW_BRIDGE_ENABLE_EVENT,
} from '@/src/platform/shadow-ui/pageBridgeCore';

export interface MainWorldBridgeEventTarget {
    dispatchEvent(event: Event): unknown;
}

/** 以 DOM 事件跨越 isolated/MAIN world，统一切换 Shadow 宿主 API bridge。 */
export function setMainWorldBridgesEnabled(target: MainWorldBridgeEventTarget, enabled: boolean): void {
    target.dispatchEvent(new CustomEvent(enabled ? SHADOW_BRIDGE_ENABLE_EVENT : SHADOW_BRIDGE_DISPOSE_EVENT));
}
