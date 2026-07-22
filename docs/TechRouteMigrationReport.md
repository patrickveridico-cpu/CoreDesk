# Relatório de migração TechRoute

O pacote original em `C:\TechRoute-manual-route-fixed` é um Electron JavaScript com NeDB. O código foi auditado a partir do `resources/app.asar`; o projeto original não foi alterado.

## Compatibilidade

| Origem | Uso encontrado | CoreDesk |
|---|---|---|
| `bases.db` | `name`, `address`, `_id` | `OperationBase`, `legacyId` |
| `insurers.db` | `name`, `company`, `_id` | `OperationInsurer`, `legacyId` |
| `price_tables.db` | empresa, seguradora, especialidade, saída, franquia, km, hora | `PricingTable` |
| `history.db` | histórico e texto | prévia; conversão automática ainda pendente |

O TechRoute instalado contém 16 bases, 15 seguradoras, 88 tabelas e 2 históricos no perfil local auditado. Não foram lidas nem importadas chaves de IA ou dados de sessão.

## Regras

`kmExcedente = max(0, kmTotal - kmFranquia)` e `total = saída + kmExcedente × valorKm + horas × valorHora`. A tela antiga não utiliza pedágios, “km sujo” ou despesas extras; esses campos permanecem fora da migração principal. O CoreDesk suporta adicionais e desconto explicitamente, sem alterar a fórmula legada.

## Estado

Migrado: modelos, cálculo, tabelas, cadastro inicial, rota manual, memória de cálculo, texto para WhatsApp, histórico local e importação não destrutiva. Isolado: IA, captura automática por seletores do Maps e conversão automática do histórico antigo.
