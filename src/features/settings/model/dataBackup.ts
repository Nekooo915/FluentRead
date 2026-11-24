/**
 * @file src/features/settings/model/dataBackup.ts
 * 文件职责：定义配置的本机 JSON 备份信封，并兼容导入旧版配置备份或完整 FluentRead 备份中的配置部分。
 * 主要内容：提供版本化配置备份类型、顶层结构校验、凭据替换模式判断与导入预览统计。
 * 模块边界：只处理可序列化数据形状，不读取 IndexedDB、不保存配置、不下载文件。
 */
import {
    isConfigImportValid,
    type ConfigImportCredentialMode,
} from '@/src/core/config/transfer';
import {
    CONFIG_CREDENTIAL_FIELDS,
    type ConfigCredentialField,
} from '@/src/core/config/credentials';

export const FLUENTREAD_DATA_BACKUP_FORMAT = 'fluentread-data-backup' as const;
export const FLUENTREAD_DATA_BACKUP_LEGACY_VERSION = 1 as const;
export const FLUENTREAD_DATA_BACKUP_VERSION = 2 as const;
export const FLUENTREAD_DATA_BACKUP_EXACT_CREDENTIAL_MODE = 'exact-replace' as const;

export interface FluentReadDataBackup {
    format: typeof FLUENTREAD_DATA_BACKUP_FORMAT;
    version: typeof FLUENTREAD_DATA_BACKUP_LEGACY_VERSION | typeof FLUENTREAD_DATA_BACKUP_VERSION;
    configCredentialMode?: typeof FLUENTREAD_DATA_BACKUP_EXACT_CREDENTIAL_MODE;
    exportedAt: number;
    config: Record<string, unknown>;
}

export type LocalDataImport =
    | {kind: 'complete'; backup: FluentReadDataBackup}
    | {kind: 'config'; config: Record<string, unknown>};

export interface LocalDataImportSummary {
    kind: LocalDataImport['kind'];
    configIncluded: boolean;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function isStringMapping(value: unknown): boolean {
    return isPlainRecord(value) && Object.values(value).every(item => typeof item === 'string');
}

const exactCredentialFieldValidators: Record<ConfigCredentialField, (value: unknown) => boolean> = {
    privacyProtectionSecretTerms: value => Array.isArray(value) && value.length <= 128
        && value.every(term => typeof term === 'string' && term.length <= 256),
    token: isStringMapping,
    apiKeys: value => isPlainRecord(value)
        && Object.values(value).every(item => Array.isArray(item) && item.every(key => typeof key === 'string')),
    secret: isStringMapping,
    customHeaders: isStringMapping,
    ak: value => typeof value === 'string',
    sk: value => typeof value === 'string',
    appid: value => typeof value === 'string',
    key: value => typeof value === 'string',
    youdaoAppKey: value => typeof value === 'string',
    youdaoAppSecret: value => typeof value === 'string',
    tencentSecretId: value => typeof value === 'string',
    tencentSecretKey: value => typeof value === 'string',
    extra: isPlainRecord,
};

function hasExactCredentialSnapshot(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    return CONFIG_CREDENTIAL_FIELDS.every(field => (
        ((field === 'secret' || field === 'customHeaders' || field === 'apiKeys' || field === 'privacyProtectionSecretTerms')
            && !Object.prototype.hasOwnProperty.call(record, field))
        || (Object.prototype.hasOwnProperty.call(record, field)
        && exactCredentialFieldValidators[field](record[field]))
    ));
}

export function createFluentReadDataBackup(input: {
    config: Record<string, unknown>;
    exportedAt?: number;
}): FluentReadDataBackup {
    if (!isConfigImportValid(input.config)) throw new TypeError('备份中的配置无效');
    if (!hasExactCredentialSnapshot(input.config)) {
        throw new TypeError('备份配置的精确凭据快照无效');
    }
    const exportedAt = input.exportedAt ?? Date.now();
    if (!Number.isFinite(exportedAt) || exportedAt < 0) throw new TypeError('备份导出时间无效');
    return {
        format: FLUENTREAD_DATA_BACKUP_FORMAT,
        version: FLUENTREAD_DATA_BACKUP_VERSION,
        configCredentialMode: FLUENTREAD_DATA_BACKUP_EXACT_CREDENTIAL_MODE,
        exportedAt,
        config: input.config,
    };
}

export function parseLocalDataImport(value: unknown): LocalDataImport {
    if (!isPlainRecord(value)) throw new TypeError('备份文件必须是 JSON 对象');
    if (value.format === FLUENTREAD_DATA_BACKUP_FORMAT) {
        if (value.version !== FLUENTREAD_DATA_BACKUP_LEGACY_VERSION
            && value.version !== FLUENTREAD_DATA_BACKUP_VERSION) {
            throw new TypeError('备份版本不受支持');
        }
        if (value.version === FLUENTREAD_DATA_BACKUP_VERSION
            && value.configCredentialMode !== FLUENTREAD_DATA_BACKUP_EXACT_CREDENTIAL_MODE) {
            throw new TypeError('备份缺少精确凭据快照标记');
        }
        if (!Number.isFinite(value.exportedAt) || (value.exportedAt as number) < 0) {
            throw new TypeError('备份导出时间无效');
        }
        if (!isConfigImportValid(value.config)) throw new TypeError('备份中的配置无效');
        if (value.version === FLUENTREAD_DATA_BACKUP_VERSION
            && !hasExactCredentialSnapshot(value.config)) {
            throw new TypeError('备份配置的精确凭据快照无效');
        }
        return {
            kind: 'complete',
            backup: {
                format: FLUENTREAD_DATA_BACKUP_FORMAT,
                version: value.version,
                ...(value.configCredentialMode === FLUENTREAD_DATA_BACKUP_EXACT_CREDENTIAL_MODE
                    ? {configCredentialMode: FLUENTREAD_DATA_BACKUP_EXACT_CREDENTIAL_MODE}
                    : {}),
                exportedAt: value.exportedAt as number,
                config: value.config as Record<string, unknown>,
            },
        };
    }
    if (isConfigImportValid(value)) return {kind: 'config', config: value};
    throw new TypeError('不是受支持的 FluentRead 备份或旧版配置文件');
}

export function usesExactCredentialReplacement(backup: FluentReadDataBackup): boolean {
    return backup.version === FLUENTREAD_DATA_BACKUP_VERSION
        && backup.configCredentialMode === FLUENTREAD_DATA_BACKUP_EXACT_CREDENTIAL_MODE
        && hasExactCredentialSnapshot(backup.config);
}

export function resolveBackupConfigCredentialMode(
    backup: FluentReadDataBackup,
): ConfigImportCredentialMode {
    return usesExactCredentialReplacement(backup) ? 'replace' : 'merge-hydration-safe';
}

export function summarizeLocalDataImport(value: LocalDataImport): LocalDataImportSummary {
    return {
        kind: value.kind,
        configIncluded: true,
    };
}
