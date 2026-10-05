# Controle Dois Delivery

Quadro de pedidos do delivery (Pendentes, Em produção, Pronto/Saiu para entrega, Concluídos e Cancelados), projeto separado do PDV e do painel administrativo. Usa a mesma API e o mesmo login do Controle Dois.

- Tempo real pelo socket da API (evento `delivery:order:updated`) e recarga automática a cada 45 s.
- Pedidos do iFood chegam sozinhos; as mudanças de status feitas aqui são enviadas ao iFood pela fila do backend.

```bash
npm install
npm run dev     # http://localhost:5175
npm run build
```

`VITE_API_URL` aponta a API (padrão `http://localhost:3333`; produção em `.env.production`).
