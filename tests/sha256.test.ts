import {createHash} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {sha256Hex} from '@/src/shared/function/sha256';

describe('shared synchronous SHA-256 identities', () => {
    it.each(['', 'abc', '流畅阅读🙂\u0000e\u0301', 'a'.repeat(55), 'a'.repeat(56),
        'a'.repeat(64), 'a'.repeat(65), '中文🙂'.repeat(50_000),
        JSON.stringify({service: 'fixture', token: 'local-test-key', text: '\uD800'})])(
        'matches native SHA-256 for input %#', value => {
            const digest = sha256Hex(value);
            expect(digest).toBe(createHash('sha256').update(value).digest('hex'));
            expect(digest).toMatch(/^[a-f0-9]{64}$/u);
        });

    it('uses standard UTF-8 replacement for isolated surrogate code units', () => {
        expect(sha256Hex('\uD800')).toBe(createHash('sha256').update('\uD800').digest('hex'));
    });
});
