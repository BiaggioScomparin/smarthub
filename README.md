# 📦 SmartHub - Hub de Integração Omnichannel
### Mercado Livre • Shopee • TikTok Shop

Sistema desenvolvido sob medida para gerenciar vendas, unificar o catálogo de produtos e centralizar a expedição/etiquetas de envio em múltiplos marketplaces.

---

## 🏗️ Arquitetura & Banco de Dados na VPS

- **Banco de Dados**: PostgreSQL na VPS (`184.107.176.201`) via connection pooler (Supavisor) na porta `6543`.
- **Compatibilidade Vercel**: 100% compatível com Vercel Serverless Functions (`/api`), sem problemas de desconexão ou *cold start*.
- **Tabelas do Hub**: `hub_channels`, `hub_products`, `hub_product_channel_links`, `hub_orders`, `hub_activity_logs`.

---

## 🚀 Como Hospedar na Vercel (Passo a Passo)

1. Acesse o painel da **[Vercel](https://vercel.com)**.
2. Clique em **"Add New..."** $\rightarrow$ **"Project"**.
3. Selecione o repositório **`BiaggioScomparin/smarthub`**.
4. Em **Environment Variables**, adicione (opcional, já possui fallback para a VPS):
   - **`DATABASE_URL`**: `postgresql://postgres.your-tenant-id:dcad519bf34b193c9e81461b097fecf4@184.107.176.201:6543/postgres`
5. Clique em **"Deploy"**!

A Vercel fornecerá um link público com HTTPS automático (ex: `https://smarthub-xxx.vercel.app`).
Esse link já estará pronto para configurar os **Webhooks** da Shopee, Mercado Livre e TikTok Shop!

---

## 💻 Como Rodar Localmente

```bash
deno task start
# ou
deno task dev
```

Acesse: **`http://localhost:3000`**

---

## 🎯 Funcionalidades Principais

1. **Catálogo Único & Publicação 1-Click (*Multi-Publish*)**:
   - Cadastre o produto uma única vez (Título, SKU, Preço Base, Estoque, Dimensões e Fotos).
   - O sistema replica para o Mercado Livre, Shopee e TikTok Shop.
2. **Sincronização de Estoque em Tempo Real**:
   - Venda em qualquer canal diminui o estoque no banco central na VPS e sincroniza os outros canais automaticamente.
3. **Central de Expedição e Envio (*Order & Shipping Hub*)**:
   - Impressão de etiquetas formatadas com código de barras, declaração de conteúdo e endereço.
   - Despacho integrado com código de rastreamento.
4. **Simulador de Vendas Integrado**:
   - Botão para testar pedidos e ver o fluxo completo funcionando em segundos.
