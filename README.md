# App Pedidos — Stock Global

## Instalar

```bash
npm install
```

## Executar

```bash
node server.js
```

## Abrir

```text
http://localhost:3000
```

## Alterações

- Stock é global por item.
- Stock é partilhado por todos os locais.
- Locais apenas escolhem quais itens aparecem.
- Quando um cliente encomenda num local, o stock global baixa para todos.
- Sem preços.


## Nova funcionalidade

- Campo de código de barras nos itens.
- O código aparece no cliente, operador, associação e base de dados.
- A importação aceita `codigo` nos itens.


## Nova funcionalidade

- Stock central/global continua nos itens.
- Cada bar tem também o seu próprio stock.
- O cliente/bar faz pedido ao stock central.
- Quando o operador muda o pedido para `Entregue`, o sistema:
  - desconta do stock central;
  - adiciona ao stock do bar que fez o pedido.
- Se o pedido já foi entregue uma vez, não duplica stock.


## Nova funcionalidade

- Cada local/bar tem uma password.
- Password por defeito dos locais existentes: `1234`.
- Nas Definições é possível criar local com password.
- Nas Definições é possível alterar a password de cada local.
- No lado Cliente, é preciso inserir a password correta para ver itens e enviar pedidos.
- O servidor também valida a password ao receber o pedido.


## Correção

- Stock por bar agora aparece numa tabela única.
- Itens na primeira coluna.
- Todos os locais aparecem em colunas à frente.
- Letra mais pequena para leitura rápida.
- Sem dropdown para escolher bar.

## Eventos / festas

A aplicação abre agora num ecrã de **Eventos**. Antes de entrar no painel principal, podes criar ou selecionar um evento.

Cada evento tem a sua própria base de dados separada:

- itens e códigos de barras;
- stock central;
- locais/barras e passwords;
- associação de itens a cada local;
- pedidos;
- stock por bar.

Os dados ficam guardados no ficheiro `eventos.json`, criado automaticamente na pasta do projeto quando o servidor arranca.
