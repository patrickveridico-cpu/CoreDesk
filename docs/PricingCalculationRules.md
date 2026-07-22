# Regras de cálculo e equivalência

| Regra original | Entrada | Implementação | Caso |
|---|---|---|---|
| Franquia | km total, franquia | `Math.max(0, kmTotal - franquia)` | 30 km / 40 km = 0 excedente |
| Excedente | km excedente, valor/km | multiplicação direta | 60 km / 40 km / R$2 = R$40 |
| Saída | valor de saída | soma | R$100 permanece R$100 |
| Hora | horas, valor/hora | parcela opcional | só quando informada |

Valores monetários são arredondados apenas no resultado monetário final para duas casas. Fixtures de equivalência estão em `tests/operations.test.ts`.
