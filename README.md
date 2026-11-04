# 📦 Hub de Integração Omnichannel
### Mercado Livre • Shopee • TikTok Shop

Sistema desenvolvido sob medida para gerenciar vendas, unificar o catálogo de produtos e centralizar a expedição/etiquetas de envio em múltiplos marketplaces.

---

## 🎯 Principais Funcionalidades

1. **Catálogo Único & Publicação 1-Click (*Multi-Publish*)**:
   - Cadastre o produto uma única vez (Título, SKU, Preço Base, Estoque, Dimensões e Fotos).
   - O sistema publica automaticamente nos 3 canais conectados.
2. **Sincronização de Estoque em Tempo Real**:
   - Vendeu no Mercado Livre $\rightarrow$ o estoque local é atualizado e disparado instantaneamente para a Shopee e o TikTok Shop, evitando vendas sem estoque (*overselling*).
3. **Central de Expedição e Envio (*Order & Shipping Hub*)**:
   - Todos os pedidos dos 3 marketplaces em uma tela unificada.
   - **Impressão de Etiquetas de Envio** com 1 clique (formatada para papel A4 ou etiquetas térmicas com código de barras, dados do destinatário e declaração de conteúdo).
   - Botão **"Despachar"** para atualizar o status e código de rastreamento no marketplace de origem.
4. **Simulador de Vendas Integrado**:
   - Botão **"Simular Venda"** no cabeçalho para testar em tempo real a recepção de pedidos, baixa de estoque sincronizada e impressão da etiqueta.
5. **Modos de Operação (Simulação vs. Produção)**:
   - Funciona imediatamente em **Modo Simulação (Sandbox)** para você testar todo o fluxo de trabalho.
   - Basta inserir suas credenciais oficiais de desenvolvedor para mudar para o **Modo Produção**.

---

## 🚀 Como Iniciar o Sistema

No terminal da pasta do projeto (`C:\Users\biagg\.gemini\antigravity\scratch\hub-marketplaces`):

```bash
deno task start
```
ou em modo desenvolvimento (com recarregamento automático):
```bash
deno task dev
```

Abra seu navegador em:
👉 **`http://localhost:3000`**

---

## 🛠️ Tecnologias Utilizadas

- **Runtime**: Deno 2.x (TypeScript nativo, sem necessidade de build ou Webpack)
- **Banco de Dados**: SQLite persistente (`hub.db`) em modo WAL de alta performance
- **Arquitetura de Adapters**:
  - `src/adapters/mercadolibre.ts`: Integração com a API do Mercado Livre (OAuth 2.0 / `api.mercadolibre.com`)
  - `src/adapters/shopee.ts`: Integração com Shopee Open Platform v2 (com assinaturas HMAC-SHA256)
  - `src/adapters/tiktok.ts`: Integração com TikTok Shop Partner API 202309
- **Frontend**: Single Page Application responsiva com Tailwind CSS, FontAwesome e Dashboard em tempo real.

---

## 🔑 Como Obter as Credenciais Oficiais das APIs

### 1. Mercado Livre
- Crie sua aplicação no portal de desenvolvedores: [Mercado Libre Developers](https://developers.mercadolibre.com.br/).
- Obtenha o `App ID`, `Client Secret` e gere seu `Access Token`.
- No hub, acesse **Conexões API** e cole os dados, mudando o modo para **Modo Produção**.

### 2. Shopee
- Registre-se no portal [Shopee Open Platform](https://open.shopee.com/).
- Obtenha o `Partner ID` e a `Partner Key`.
- Autorize a sua loja para gerar o `Shop ID` e o `Access Token`.

### 3. TikTok Shop
- Acesse o [TikTok Shop Partner Center](https://partner.tiktokshop.com/).
- Crie um aplicativo de vendedor ou ISV para obter a `App Key`, `App Secret`, `Shop Cipher` e `Access Token`.
