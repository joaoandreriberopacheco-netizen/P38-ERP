// adormecido — autenticação de operação (PIN/foto) desligada por defeito
// VITE_OPERACAO_AUTH_ENABLED=true → exige PIN; foto só com VITE_OPERACAO_AUTH_PHOTO_ENABLED=true
import { p38PublicEnvBool } from '@/lib/p38PublicEnv';

export const OPERACAO_AUTH_ENABLED = p38PublicEnvBool('VITE_OPERACAO_AUTH_ENABLED', false);

export const OPERACAO_AUTH_PHOTO_ENABLED =
    OPERACAO_AUTH_ENABLED && p38PublicEnvBool('VITE_OPERACAO_AUTH_PHOTO_ENABLED', false);

/**
 * Enviar pedido de compra ao financeiro — PIN desligado por defeito.
 * Para reativar: VITE_PEDIDO_COMPRA_SAVE_AUTH_PIN=true
 */
export const PEDIDO_COMPRA_SAVE_AUTH_ENABLED = p38PublicEnvBool('VITE_PEDIDO_COMPRA_SAVE_AUTH_PIN', false);

export const PEDIDO_COMPRA_STATUS_AGUARDANDO_FINANCEIRO = 'Aguardando Aprovação Financeira';

export function pedidoCompraSaveRequerPin(saveOptions = {}) {
    if (!PEDIDO_COMPRA_SAVE_AUTH_ENABLED) return false;
    return saveOptions?.status === PEDIDO_COMPRA_STATUS_AGUARDANDO_FINANCEIRO;
}

export function makeOperationCode() {
    return `OP-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

/** Payload quando auth está adormecida — sem modal, sem PIN, sem upload. */
export async function buildBypassAuthPayload(getUser) {
    const operationCode = makeOperationCode();
    const timestamp = new Date().toISOString();
    try {
        const u = await getUser();
        const name = u?.full_name;
        return {
            operationCode,
            userId: u?.id,
            userName: name,
            intervenienteName: name,
            intervenienteId: u?.id,
            evidenceUrl: null,
            timestamp,
        };
    } catch {
        return { operationCode, evidenceUrl: null, timestamp };
    }
}
