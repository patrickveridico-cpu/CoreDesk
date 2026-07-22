# Modelo de dados

As entidades normalizadas são `OperationBase`, `OperationInsurer`, `OperationSpecialty`, `PricingTable`, `RouteCalculation` e `OperationQuote`. Cada entidade tem identificador CoreDesk; registros importados preservam `legacyId` e o mapa `idMap`.

Especialidades eram strings dentro das tabelas do TechRoute; o importador deduplica essas strings em `OperationSpecialty` sem inventar categorias.
