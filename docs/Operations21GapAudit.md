# Auditoria de lacunas — Operações 2.1

Auditoria baseada no código presente antes desta execução. Estado não é inferido pela aparência.

| Requisito | Estado | Arquivo | Função/componente | Teste | Ação necessária |
|---|---|---|---|---|---|
| Navegação interna | parcialmente implementado | `src/modules/operations/pages/OperationsPage.tsx` | `NAV`, `open` | não havia teste de UI | extrair navegação e testar estado persistido |
| Novo orçamento | parcialmente implementado | mesmo arquivo | `QuoteView`, `calculate` | `tests/operations.test.ts` cobre cálculo, não formulário | adicionar rascunho, adicionais estruturados e limpeza acessível |
| Seleção de tabela | parcialmente implementado | `OperationsService.ts`, `QuoteView` | `selectPricingTable`, `table` | casos básico/inativo | suportar múltiplas e explicar correspondência |
| Memória de cálculo | implementado parcialmente | `QuoteView` | painel lateral | cálculo unitário | adicionar fórmula, snapshot e copiar memória |
| Adicionais | apenas numérico | `QuoteView`, `calculateQuote` | `extras` | sem teste de editor | criar itens estruturados e subtotal |
| WhatsApp | parcialmente implementado | `QuoteView` | cópia para clipboard | sem teste de integração | selecionar perfil e abrir perfil sem envio automático |
| Histórico | parcialmente implementado | `HistoryView` | busca livre | sem filtros comportamentais | filtros, detalhe, duplicação, revisão, arquivamento |
| Detalhe/revisões/comparação | não implementado | — | — | — | criar modelos, IPC e telas |
| Bases/seguradoras/especialidades | parcialmente implementado | `CatalogView` | somente adicionar | testes de serviço básicos | CRUD, status, duplicidade, arquivamento e mesclagem |
| Tabelas/versionamento/comparação | parcialmente implementado | `CatalogView`, `OperationsService` | listagem | sem testes de versão | nova versão, motivo, vigência e comparação |
| Importação em etapas/conflitos | parcialmente implementado | `ImportView`, `OperationsService` | análise/confirmação | sem teste de wizard | etapas, decisões por conflito e relatório |
| Backups/restauração | parcialmente implementado | `BackupView`, governance IPC | criar/listar/restaurar | governance unitário | confirmação interna, backup de segurança e detalhes |
| Auditoria | parcialmente implementado | `AuditView`, governance service | listagem | governance unitário | filtros, detalhe e diff seguro |
| Arquivamento | não implementado | — | — | — | status e proteção de dependências |
| Estados vazios | implementado parcialmente | `EmptyState` | listagens | não havia teste | ações contextuais e erros dedicados |
| Erros/toasts/confirmações | parcialmente implementado | `OperationsPage.tsx` | `notice`, confirm/prompt nativos | sem testes | componentes acessíveis e sem APIs nativas |
| Acessibilidade | parcialmente implementado | JSX da página | labels básicos | sem testes | foco, diálogo, aria e teclado |
| Responsividade | parcialmente implementado | classes Tailwind | grid/drawer ausente | sem captura | validar resoluções e painel móvel |
| Comandos | parcialmente implementado | `electron/main.ts` | registro de IDs | sem teste de abertura de tela | mapear todos os comandos para páginas corretas |
| Testes | insuficiente | `tests/` | 22 testes gerais | não cobrem UI/fluxos | adicionar testes comportamentais e de domínio |

Conclusão inicial: o backend de cálculo, persistência, auditoria e backup existe; a interface 2.1 anterior era um protótipo funcional parcial, não uma conclusão integral.

## Correções desta auditoria

Foi criada uma composição visual separada em `OperationsPageSafe.tsx` com navegação, importação confirmada por diálogo interno, backups, auditoria, estados vazios e componentes reutilizáveis (`OperationsNavigation`, `ConfirmDialog`, `EmptyState`, `StatusBadge`). A página antiga foi reduzida a um re-export para evitar duas implementações concorrentes.

Também foi adicionada a função `findPricingTables` e um teste para múltiplas tabelas aplicáveis. A suíte passou de 22 para 23 testes.

Ainda não concluído: CRUD de edição/arquivamento, revisões e comparação visual, mesclagem de especialidades, filtros avançados, detalhe de orçamento e capturas reais de todas as telas. Esses itens permanecem explicitamente parciais e não são declarados prontos.
