import {describe, expect, it} from 'vitest';
import {setMainWorldBridgesEnabled} from '@/src/app/content/mainWorldBridgeLifecycle';
import {
    SHADOW_BRIDGE_DISPOSE_EVENT,
    SHADOW_BRIDGE_ENABLE_EVENT,
} from '@/src/platform/shadow-ui/pageBridgeCore';

describe('MAIN world bridge lifecycle publisher', () => {
    it('publishes enable and disable protocols for Shadow bridge in stable order', () => {
        const events: string[] = [];
        const target = {dispatchEvent: (event: Event) => events.push(event.type)};

        setMainWorldBridgesEnabled(target, false);
        setMainWorldBridgesEnabled(target, true);

        expect(events).toEqual([
            SHADOW_BRIDGE_DISPOSE_EVENT,
            SHADOW_BRIDGE_ENABLE_EVENT,
        ]);
    });
});
