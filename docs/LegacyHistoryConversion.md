# Conversão do histórico legado

O histórico NeDB é lido sem modificar os arquivos originais. Registros são classificados como convertidos, parciais ou pendentes. Campos ausentes não recebem valores inventados; o registro bruto e o `legacyId` são preservados para revisão.
