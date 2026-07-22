# Arquitetura da interface Operações 2.1

`OperationsNavigation` controla a seção ativa e os componentes de estado vazio/confirmação são reutilizáveis. A página usa exclusivamente `window.coreDesk.operations`; não existe persistência paralela no renderer.

Cada ação crítica deve usar `ConfirmDialog`, manter foco acessível e exibir erro contextual. A quilometragem permanece explicitamente manual até integração segura com Maps.
